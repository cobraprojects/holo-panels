import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActionExecutionError,
  createRequestEnvelope,
  definePage,
  definePanel,
  TRANSPORT_REQUEST_FIELD,
  type HoloAuth,
  type JsonObject,
  type ResponseEnvelope,
} from '@holo-js/panels-core'
import { ClientEffectSession, ClientToastStore } from '@holo-js/panels-react'
import { nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'
import { NextPanelClient } from '../src/panel-client'
import { createPanelOperationRoute } from '../src/operation'
import { NextPanelResourcePage } from '../src/resource-page'
import { resolveNextPanelPage } from '../src/runtime'
import type { NextPanelPagePayload, NextPanelsRuntime } from '../src/contracts'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@holo-js/security/next/server', () => ({
  csrfProtection: () => (request: Request) => request.headers.get('x-csrf-token') === 'valid'
    ? undefined
    : new Response('CSRF token mismatch.', { status: 419 }),
}))

class Actor {
  declare readonly id: number
}

const actor = { id: 7 }
const flashed = new Map<string, unknown>()
const auth: HoloAuth<object> = {
  guard: () => ({
    async flash(key, value) {
      flashed.set(key, structuredClone(value))
    },
    provider: async () => 'session',
    async take<TValue>(key: string): Promise<TValue | undefined> {
      const value = flashed.get(key) as TValue | undefined
      flashed.delete(key)
      return value
    },
    user: async () => actor,
  }),
}
const basePanel = definePanel('admin', Actor)
  .path('/admin')
  .presentActor(current => ({ id: current.id }))
  .compile()
const page = definePage('dashboard', { actor: Actor, load: () => ({ ready: true }) })
  .path('/admin')
  .title('Dashboard')
  .compile()

function runtime(execute?: NextPanelsRuntime['execute']): NextPanelsRuntime {
  return {
    auth,
    ...(execute ? { execute } : {}),
    registry: {
      'admin:page:dashboard': async () => page,
      'admin:panel:admin': async () => basePanel,
    },
  }
}

async function payload(): Promise<NextPanelPagePayload> {
  return resolveNextPanelPage('admin', [], new Request('https://example.test/admin'), runtime())
}

function withNotifications(
  source: NextPanelPagePayload,
  placement: 'sidebar' | 'topbar',
  realtime: boolean,
  channel: string | null = null,
): NextPanelPagePayload {
  return {
    ...source,
    bootstrap: {
      ...source.bootstrap,
      manifest: {
        ...source.bootstrap.manifest,
        databaseNotifications: { placement, polling: 1_000, realtime },
      },
      notifications: { realtimeChannel: channel },
    },
  }
}

async function decodedRequest(input: string | URL | Request, init?: RequestInit): Promise<{ readonly id: string }> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const request = new Request(new URL(url, 'https://example.test'), init)
  const body = await request.formData()
  return JSON.parse(String(body.get(TRANSPORT_REQUEST_FIELD))) as { readonly id: string }
}

function notificationResponse(id: string): Response {
  return Response.json({
    data: { items: [], page: 1, pageSize: 20, total: 0, unread: 0 },
    effects: [],
    id,
    ok: true,
    protocolVersion: '1.0',
  })
}

function operationRequest(): Request {
  const envelope = createRequestEnvelope({ id: 'request-p13', operation: 'action', panelId: 'admin', payload: {} })
  return new Request('https://example.test/holo/panels/admin/action', {
    body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: JSON.stringify(envelope), _token: 'valid' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
    method: 'POST',
  })
}

function editProperties(): JsonObject {
  const body = nextPanelAcceptanceFixture.pages[3]?.manifest.body
  if (body?.component !== 'resource-page') throw new Error('The acceptance edit page is missing its resource manifest.')
  return body.properties
}

async function click(container: HTMLElement, label: string): Promise<void> {
  await act(async () => {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent === label)
    if (!button) throw new Error(`Missing ${label} button`)
    button.click()
    await Promise.resolve()
  })
}

async function openNotifications(container: HTMLElement): Promise<void> {
  await act(async () => {
    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    if (!button) throw new Error('Missing notification inbox trigger')
    button.click()
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => {
  flashed.clear()
  routerPush.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Next notification and effect integration', () => {
  it('keeps resource effects alive through the React Strict Mode lifecycle', async () => {
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = await decodedRequest(input, init)
      return Response.json({
        data: { record: { id: 1, slug: 'first-post', title: 'First post' } },
        effects: [{ kind: 'toast', level: 'success', message: 'Post saved.' }],
        id: request.id,
        ok: true,
        protocolVersion: '1.0',
      })
    }))
    const source = await payload()
    const strictPayload: NextPanelPagePayload = {
      ...source,
      page: {
        ...source.page,
        data: { record: { category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' } },
        heading: 'Edit Post',
        manifest: {
          ...source.page.manifest,
          body: { component: 'resource-page', properties: editProperties() },
        },
      },
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StrictMode><NextPanelClient payload={strictPayload} /></StrictMode>)
      await Promise.resolve()
      await Promise.resolve()
    })
    await click(container, 'Save post')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Post saved.'))
    await act(async () => root.unmount())
  })

  it('rejects a multibyte operation envelope above 4 MiB without flashing success effects', async () => {
    const effects = [
      { kind: 'redirect' as const, url: '/admin' },
      { kind: 'toast' as const, level: 'success' as const, message: 'Oversized success' },
    ]
    const emptyEnvelope = { data: { text: '' }, effects, id: 'request-p13', ok: true, protocolVersion: '1.0' }
    const remainingBytes = 4_194_305 - new TextEncoder().encode(JSON.stringify(emptyEnvelope)).byteLength
    const text = '😀'.repeat(Math.floor(remainingBytes / 4)) + 'a'.repeat(remainingBytes % 4)
    expect(new TextEncoder().encode(JSON.stringify({ ...emptyEnvelope, data: { text } })).byteLength).toBe(4_194_305)
    const route = createPanelOperationRoute({
      panelIds: ['admin'],
      runtime: runtime(async () => ({ data: { text }, effects })),
    })
    const response = await route.POST(operationRequest(), { params: Promise.resolve({ operation: 'action', panelId: 'admin' }) })

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
      id: 'request-p13',
      ok: false,
      protocolVersion: '1.0',
    })
    expect(flashed.size).toBe(0)
  })

  it('renders no inbox when database notifications are not configured', async () => {
    const markup = renderToString(<NextPanelClient payload={await payload()} />)
    expect(markup).not.toContain('hp-notification-inbox-trigger')
  })

  it.each(['topbar', 'sidebar'] as const)('mounts the %s inbox on the fixed notification endpoint', async placement => {
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push(url)
      return notificationResponse((await decodedRequest(input, init)).id)
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<NextPanelClient payload={withNotifications(await payload(), placement, false)} />)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.hp-notification-inbox-trigger-button')).not.toBeNull()
    await openNotifications(container)
    expect(container.querySelector(`[data-placement="${placement === 'topbar' ? 'dropdown' : 'sidebar'}"]`)).not.toBeNull()
    expect(calls).toEqual(['/holo/panels/admin/notification'])
    await act(async () => root.unmount())
  })

  it('injects realtime only for the trusted bootstrap channel and falls back to polling when subscription fails', async () => {
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => notificationResponse((await decodedRequest(input, init)).id))
    vi.stubGlobal('fetch', fetch)
    const notificationRealtime = vi.fn(() => ({ subscribe: () => { throw new Error('offline') } }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<NextPanelClient notificationRealtime={notificationRealtime} payload={withNotifications(await payload(), 'topbar', true, 'panels.admin.7')} />)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(notificationRealtime).toHaveBeenCalledOnce()
    expect(notificationRealtime).toHaveBeenCalledWith('panels.admin.7')
    await openNotifications(container)
    expect(fetch).toHaveBeenCalled()
    await act(async () => root.unmount())

    const withoutChannel = createRoot(container)
    await act(async () => {
      withoutChannel.render(<NextPanelClient notificationRealtime={notificationRealtime} payload={withNotifications(await payload(), 'topbar', true)} />)
      await Promise.resolve()
    })
    expect(notificationRealtime).toHaveBeenCalledOnce()
    await act(async () => withoutChannel.unmount())
  })

  it.each([true, false])('applies %s response effects once and runs a toast before redirect', async ok => {
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    const toastStore = new ClientToastStore()
    const order: string[] = []
    toastStore.subscribe(state => {
      if (state.items.length > 0) order.push('toast')
    })
    const effects = new ClientEffectSession({ panelId: 'admin', redirect: () => { order.push('redirect') }, toastStore })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = await decodedRequest(input, init)
      const envelope: ResponseEnvelope = ok
        ? { data: null, effects: [{ kind: 'redirect', url: '/admin' }, { kind: 'toast', level: 'success', message: 'Saved' }], id: request.id, ok: true, protocolVersion: '1.0' }
        : { effects: [{ kind: 'redirect', url: '/admin' }, { kind: 'toast', level: 'danger', message: 'Failed safely' }], error: { category: 'internal', code: 'failed', message: 'The operation could not be completed.', retryable: false }, id: request.id, ok: false, protocolVersion: '1.0' }
      return Response.json(envelope, { status: ok ? 200 : 500 })
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<NextPanelResourcePage data={{ record: { id: 1, slug: 'first-post', title: 'First post' } }} effects={effects} panelId="admin" panelPath="/admin" properties={editProperties()} />))
    await click(container, 'Delete')
    await click(container, 'Confirm')
    await click(container, 'Run action')
    expect(order).toEqual(['toast', 'redirect'])
    expect(toastStore.state.items).toHaveLength(1)
    if (!ok) expect(toastStore.state.items[0]?.title).toBe('Failed safely')
    await act(async () => root.unmount())
    effects.dispose()
  })

  it('preserves validated ActionExecutionError effects without exposing causes or effects from ordinary errors', async () => {
    const safeEffect = { kind: 'toast' as const, level: 'danger' as const, message: 'Try again' }
    const actionFailure = new ActionExecutionError('failed', 'secret database cause', [safeEffect])
    Reflect.set(actionFailure, 'cause', new Error('credential=secret'))
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime(async () => { throw actionFailure }) })
    const context = { params: Promise.resolve({ operation: 'action', panelId: 'admin' }) }
    const response = await route.POST(operationRequest(), context)
    const body = await response.json() as ResponseEnvelope
    expect(body.effects).toEqual([safeEffect])
    expect(JSON.stringify(body)).not.toContain('secret')

    const ordinary = new Error('ordinary secret')
    Reflect.set(ordinary, 'effects', [safeEffect])
    const ordinaryRoute = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime(async () => { throw ordinary }) })
    const ordinaryBody = await (await ordinaryRoute.POST(operationRequest(), context)).json() as ResponseEnvelope
    expect(ordinaryBody.effects).toEqual([{ kind: 'toast', level: 'danger', message: 'Please try again later.', title: 'An error occurred' }])
    expect(JSON.stringify(ordinaryBody)).not.toContain('ordinary secret')

    const invalidEffect = new ActionExecutionError('failed', 'invalid effect')
    Reflect.set(invalidEffect, 'effects', [{ kind: 'redirect', url: 'javascript:alert(1)' }])
    const invalidRoute = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime(async () => { throw invalidEffect }) })
    const invalidBody = await (await invalidRoute.POST(operationRequest(), context)).json() as ResponseEnvelope
    expect(invalidBody.effects).toEqual([])
  })

  it('atomically carries redirect toasts through the guard-scoped session into the next page', async () => {
    const toast = { kind: 'toast' as const, level: 'success' as const, message: 'Saved across redirect' }
    const route = createPanelOperationRoute({
      panelIds: ['admin'],
      runtime: runtime(async () => ({
        data: null,
        effects: [toast, { kind: 'redirect', url: '/admin' }],
      })),
    })
    const context = { params: Promise.resolve({ operation: 'action', panelId: 'admin' }) }

    await expect(route.POST(operationRequest(), context).then(response => response.status)).resolves.toBe(200)
    expect(flashed.get('panels.effects.admin')).toEqual([toast])

    const redirected = await payload()
    expect(redirected.effects).toEqual([toast])
    expect(flashed.has('panels.effects.admin')).toBe(false)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<NextPanelClient payload={redirected} />)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Saved across redirect')
    await act(async () => root.unmount())
    await expect(payload().then(value => value.effects)).resolves.toEqual([])

    flashed.set('panels.effects.admin', [{ kind: 'redirect', url: '/vendor' }])
    await expect(payload().then(value => value.effects)).resolves.toEqual([])
  })
})
