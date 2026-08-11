import { createRequestEnvelope, type Effect, type JsonObject } from '@holo-js/panels-core'
import { ClientToastStore } from '@holo-js/panels-vue'
import { createApp as createH3App, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { createApp, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  failFlash: false,
  failTake: false,
  flashed: new Map<string, unknown>(),
  guardNames: [] as string[],
}))

vi.mock('@holo-js/security/nuxt/server', () => ({
  csrfProtection: () => defineEventHandler(() => undefined),
}))

vi.mock('@holo-js/adapter-nuxt/runtime', () => ({
  holo: {
    getApp: vi.fn(async () => ({ projectRoot: '/app' })),
    getAuth: vi.fn(async () => ({
      guard: (name: string) => {
        authState.guardNames.push(name)
        return {
          async flash(key: string, value: unknown) {
            if (authState.failFlash) throw new Error('Flash unavailable')
            authState.flashed.set(key, value)
          },
          async provider() {
            return 'users'
          },
          async take<TValue = unknown>(key: string): Promise<TValue | undefined> {
            if (authState.failTake) throw new Error('Take unavailable')
            const value = authState.flashed.get(key) as TValue | undefined
            authState.flashed.delete(key)
            return value
          },
          async user() {
            return { id: 7 }
          },
        }
      },
    })),
  },
  runWithNuxtRequest: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))

const { PanelPage } = await import('../src')
const { createPanelOperationHandler } = await import('../src/server')
import type { NuxtPanelOperationContext, NuxtPanelOperationResult, NuxtPanelPage, NuxtPanelRuntime } from '../src'

const page: NuxtPanelPage = {
  bootstrap: {
    actor: { id: 7 },
    manifest: {
      branding: { favicon: null, logo: null, name: 'Admin' },
      databaseNotifications: null,
      default: true,
      globalSearch: true,
      id: 'admin',
      navigation: [],
      navigationMode: 'sidebar',
      path: '/admin',
      sidebarCollapsible: true,
      tenancy: null,
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
      userMenu: [],
    },
    notifications: null,
    provider: 'users',
    tenancy: null,
  },
  page: {
    breadcrumbs: [],
    data: {},
    heading: 'Dashboard',
    manifest: { body: null, id: 'dashboard', pageType: 'custom', path: '/admin', schemaId: null, widgets: { footer: [], header: [] } },
    schema: null,
    subheading: null,
    title: 'Dashboard',
  },
  path: '/admin',
  widgets: { footer: [], header: [] },
}

function formRequest(panelId: string, operation: string, payload: JsonObject = {}): Request {
  const envelope = createRequestEnvelope({ id: 'request-1234567890', operation, panelId, payload })
  return new Request(`http://localhost/holo/panels/${panelId}/${operation}`, {
    body: new URLSearchParams({ request: JSON.stringify(envelope), _token: 'valid' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  })
}

function runtime(
  panelIds: readonly string[],
  execute: (context: NuxtPanelOperationContext) => NuxtPanelOperationResult | Promise<NuxtPanelOperationResult>,
): NuxtPanelRuntime {
  return {
    panels: Object.fromEntries(panelIds.map(panelId => [panelId, { access: () => true, guard: `${panelId}-guard` }])),
    execute,
  }
}

function webHandler(panelRuntime: NuxtPanelRuntime, panelIds: readonly string[] = ['admin']): (request: Request) => Promise<Response> {
  const app = createH3App()
  const router = createRouter()
  const handler = createPanelOperationHandler({ panelIds, runtime: panelRuntime })
  router.get('/holo/panels/:panelId/:operation', handler)
  router.post('/holo/panels/:panelId/:operation', handler)
  app.use(router)
  return toWebHandler(app)
}

function pageRequest(panelId: string): Request {
  return new Request(`http://localhost/holo/panels/${panelId}/page-data?path=%2F${panelId}`)
}

beforeEach(() => {
  authState.failFlash = false
  authState.failTake = false
  authState.flashed.clear()
  authState.guardNames.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('Nuxt redirect toast session handoff', () => {
  it('rejects a multibyte operation envelope above 4 MiB without flashing success effects', async () => {
    const effects: readonly Effect[] = [
      { kind: 'redirect', url: '/admin' },
      { kind: 'toast', level: 'success', message: 'Oversized success' },
    ]
    const emptyEnvelope = { data: { text: '' }, effects, id: 'request-1234567890', ok: true, protocolVersion: '1.0' }
    const remainingBytes = 4_194_305 - new TextEncoder().encode(JSON.stringify(emptyEnvelope)).byteLength
    const text = '😀'.repeat(Math.floor(remainingBytes / 4)) + 'a'.repeat(remainingBytes % 4)
    expect(new TextEncoder().encode(JSON.stringify({ ...emptyEnvelope, data: { text } })).byteLength).toBe(4_194_305)
    const fetch = webHandler(runtime(['admin'], () => ({ data: { text }, effects })))
    const response = await fetch(formRequest('admin', 'action'))

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      effects: [],
      error: {
        category: 'internal',
        code: 'response_too_large',
        message: 'Panel operation response exceeded the server limit.',
        retryable: false,
      },
      id: 'request-1234567890',
      ok: false,
      protocolVersion: '1.0',
    })
    expect(authState.flashed.size).toBe(0)
  })

  it('survives a redirect once and applies the consumed toast once on the client', async () => {
    const toast: Effect = { kind: 'toast', level: 'success', message: 'Article saved' }
    const effects: readonly Effect[] = [{ kind: 'redirect', url: '/admin' }, toast]
    const fetch = webHandler(runtime(['admin'], context => context.operation === 'page-data' ? { data: page } : { data: { saved: true }, effects }))

    const mutation = await fetch(formRequest('admin', 'form-submit'))
    expect(mutation.status).toBe(200)
    expect(await mutation.json()).toMatchObject({ effects, ok: true })
    expect(authState.flashed.get('panels.effects.admin')).toEqual([toast])

    const redirected = await fetch(pageRequest('admin'))
    const redirectedPage = await redirected.json() as NuxtPanelPage
    expect(redirectedPage.effects).toEqual([toast])
    expect(authState.flashed.has('panels.effects.admin')).toBe(false)

    const replay = await fetch(pageRequest('admin'))
    await expect(replay.json()).resolves.toMatchObject({ effects: [] })

    const push = vi.spyOn(ClientToastStore.prototype, 'push')
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, { page: redirectedPage })
    app.mount(container)
    await nextTick()
    await vi.waitFor(() => expect(container.querySelector('.hp-notification-toasts')?.textContent).toContain('Article saved'))
    await nextTick()
    expect(push).toHaveBeenCalledTimes(1)
    app.unmount()
    expect(authState.guardNames).toContain('admin-guard')
  })

  it('rejects malformed and non-toast payloads without consuming another panel key', async () => {
    const staffToast: Effect = { kind: 'toast', level: 'info', message: 'Staff only' }
    const fetch = webHandler(runtime(['admin', 'staff'], () => ({ data: page })), ['admin', 'staff'])
    authState.flashed.set('panels.effects.admin', [{ kind: 'toast', level: 'success' }])
    authState.flashed.set('panels.effects.staff', [staffToast])

    const invalid = await fetch(pageRequest('admin'))
    await expect(invalid.json()).resolves.toMatchObject({ effects: [] })
    expect(authState.flashed.get('panels.effects.staff')).toEqual([staffToast])

    authState.flashed.set('panels.effects.admin', [{ kind: 'redirect', url: '/admin' }])
    const nonToast = await fetch(pageRequest('admin'))
    await expect(nonToast.json()).resolves.toMatchObject({ effects: [] })
    expect(authState.flashed.get('panels.effects.staff')).toEqual([staffToast])
  })

  it('preserves committed mutation responses and page rendering when flash or take fails', async () => {
    const toast: Effect = { kind: 'toast', level: 'success', message: 'Saved' }
    const effects: readonly Effect[] = [toast, { kind: 'redirect', url: '/admin' }]
    const fetch = webHandler(runtime(['admin'], context => context.operation === 'page-data' ? { data: page } : { data: { saved: true }, effects }))
    authState.failFlash = true

    const mutation = await fetch(formRequest('admin', 'form-submit'))
    expect(mutation.status).toBe(200)
    await expect(mutation.json()).resolves.toMatchObject({ data: { saved: true }, effects, ok: true })

    authState.failTake = true
    const rendered = await fetch(pageRequest('admin'))
    expect(rendered.status).toBe(200)
    await expect(rendered.json()).resolves.toMatchObject({ effects: [], page: { title: 'Dashboard' } })
  })
})
