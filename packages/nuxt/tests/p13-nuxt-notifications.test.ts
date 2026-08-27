import { panelNotification } from '@holo-js/panels-core'
import { ClientToastStore } from '@holo-js/panels-vue'
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PanelPage, type NuxtPanelPage } from '../src'
import { configureNuxtNavigation } from './nuxt-imports'

interface RecordedRequest {
  readonly operation: string
  readonly panelId: string
  readonly payload: Record<string, unknown>
}

function panelPage(options: {
  readonly channel?: string | null
  readonly placement?: 'sidebar' | 'topbar'
  readonly polling?: false | number
  readonly realtime?: boolean
} = {}): NuxtPanelPage {
  const configured = options.placement !== undefined
  return {
    bootstrap: {
      actor: { id: 7 },
      manifest: {
        branding: { favicon: null, logo: null, name: 'Admin' },
        databaseNotifications: configured
          ? {
              placement: options.placement!,
              polling: options.polling ?? 30_000,
              realtime: options.realtime ?? false,
            }
          : null,
  default: true,
  globalSearch: true,
        id: 'admin',
        navigation: [],
        navigationMode: 'sidebar',
        path: '/admin',
        sidebarCollapsible: true,
        slots: {},
        tenancy: null,
        theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
        userMenu: [],
      },
      notifications: configured ? { realtimeChannel: options.channel ?? null } : null,
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
}

function resourcePage(): NuxtPanelPage {
  const current = panelPage()
  return {
    ...current,
    page: {
      ...current.page,
      manifest: { ...current.page.manifest, body: { component: 'resource-page', properties: {} }, pageType: 'create' },
      schema: {
        actions: [],
        formActions: [{ badge: null, color: null, confirmation: null, disabled: false, icon: 'plus', id: 'create', kind: 'create', label: 'Create', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'create', visible: true }],
        basePath: '/admin/articles',
        columns: [],
        fields: [{ disabled: false, helperText: null, hint: null, label: 'Title', path: 'title', placeholder: null, properties: {}, readOnly: false, required: false, type: 'text', visible: true }],
        filters: [],
        kind: 'resource',
        recordTitle: 'title',
        resourceId: 'articles',
        routeKey: 'id',
      },
    },
  }
}

function installFetch(effects: readonly Record<string, unknown>[] = [], mutationSucceeds = true, mutationRecord?: Readonly<Record<string, unknown>>) {
  const requests: RecordedRequest[] = []
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const fields = new URLSearchParams(String(init?.body ?? ''))
    const envelope = JSON.parse(fields.get('request') ?? '{}') as RecordedRequest & { readonly id: string }
    requests.push(envelope)
    const data = envelope.operation === 'notification'
      ? { items: [], page: 1, pageSize: 20, total: 0, unread: 0 }
      : { ...(mutationRecord ? { record: mutationRecord } : {}), saved: true }
    const mutation = envelope.operation === 'form-submit'
    const body = mutation && !mutationSucceeds
      ? {
          effects,
          error: { category: 'validation', code: 'invalid', message: 'Could not save', retryable: false },
          id: envelope.id,
          ok: false,
          protocolVersion: '1.0',
        }
      : {
          data,
          effects: mutation ? effects : [],
          id: envelope.id,
          ok: true,
          protocolVersion: '1.0',
        }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status: mutation && !mutationSucceeds ? 422 : 200 })
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, requests }
}

afterEach(() => {
  configureNuxtNavigation(async () => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

async function openNotifications(container: HTMLElement): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
  if (!button) throw new Error('Missing notification inbox trigger')
  button.click()
  await nextTick()
}

describe('Nuxt P13 notification integration', () => {
  it('aborts only the replaced resource client and ignores its late effects', async () => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const pending: Array<{
      readonly id: string
      readonly signal: AbortSignal | null
      resolve(response: Response): void
    }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const fields = new URLSearchParams(String(init?.body ?? ''))
      const envelope = JSON.parse(fields.get('request') ?? '{}') as { readonly id: string }
      return await new Promise<Response>(resolve => pending.push({ id: envelope.id, resolve, signal: init?.signal ?? null }))
    }))
    const current = shallowRef(resourcePage())
    const Harness = defineComponent(() => () => h(PanelPage, { page: current.value }))
    const container = document.createElement('div')
    document.body.append(container)
    const push = vi.spyOn(ClientToastStore.prototype, 'push')
    const app = createApp(Harness)
    app.mount(container)
    await nextTick()

    container.querySelector<HTMLFormElement>('form')?.requestSubmit()
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    current.value = {
      ...current.value,
      page: {
        ...current.value.page,
        manifest: { ...current.value.page.manifest, path: '/admin/articles/create-again' },
      },
      path: '/admin/articles/create-again',
    }
    await nextTick()
    expect(pending[0]?.signal?.aborted).toBe(true)

    container.querySelector<HTMLFormElement>('form')?.requestSubmit()
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[1]?.signal?.aborted).toBe(false)
    pending[0]?.resolve(Response.json({ data: { saved: true }, effects: [{ kind: 'toast', level: 'danger', message: 'Obsolete response' }], id: pending[0].id, ok: true, protocolVersion: '1.0' }))
    pending[1]?.resolve(Response.json({ data: { saved: true }, effects: [{ kind: 'toast', level: 'success', message: 'Current response' }], id: pending[1].id, ok: true, protocolVersion: '1.0' }))

    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(push.mock.calls[0]?.[0]).toMatchObject({ title: 'Current response' })
    app.unmount()
  })

  it('coalesces duplicate realtime invalidation while configured polling remains active', async () => {
    vi.useFakeTimers()
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const { fetch, requests } = installFetch()
    const unsubscribe = vi.fn()
    let invalidate: (() => void) | undefined
    const subscribe = vi.fn((listener: () => void) => {
      invalidate = listener
      return unsubscribe
    })
    const notificationRealtime = vi.fn(() => ({ subscribe }))
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, {
      notificationRealtime,
      page: panelPage({ channel: 'panels.notifications.admin-7', placement: 'topbar', polling: 1_000, realtime: true }),
    })

    app.mount(container)
    await openNotifications(container)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(notificationRealtime).toHaveBeenCalledWith('panels.notifications.admin-7')
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-placement="dropdown"]')).not.toBeNull()
    expect(container.querySelector('[data-sonner-toaster]')).not.toBeNull()
    expect(requests[0]).toMatchObject({
      operation: 'notification',
      panelId: 'admin',
      payload: { action: 'list', page: 1, pageSize: 20 },
    })
    invalidate?.()
    invalidate?.()
    await vi.advanceTimersByTimeAsync(0)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))

    app.unmount()
    app.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not call realtime with an untrusted channel and falls back to configured polling', async () => {
    vi.useFakeTimers()
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const { fetch } = installFetch()
    const notificationRealtime = vi.fn(() => ({ subscribe: vi.fn(() => vi.fn()) }))
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, {
      notificationRealtime,
      page: panelPage({ channel: 'panels.notifications.admin-7?tenant=other', placement: 'sidebar', polling: 1_000, realtime: true }),
    })

    app.mount(container)
    await openNotifications(container)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(notificationRealtime).not.toHaveBeenCalled()
    expect(container.querySelector('[data-placement="sidebar"]')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    app.unmount()
  })

  it.each([
    { label: 'success', succeeds: true },
    { label: 'failure', succeeds: false },
  ])('applies $label response effects with toast before redirect', async ({ succeeds }) => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const presentation = panelNotification('article.saved')
      .title('Article saved')
      .body('The draft is ready')
      .status('success')
      .icon('check')
      .color('#15803d')
      .persistent()
      .closeable(false)
      .presentation()
    const order: string[] = []
    const originalPush = ClientToastStore.prototype.push
    vi.spyOn(ClientToastStore.prototype, 'push').mockImplementation(function (
      this: ClientToastStore,
      ...args: Parameters<ClientToastStore['push']>
    ) {
      order.push('toast')
      return originalPush.apply(this, args)
    })
    configureNuxtNavigation(async () => { order.push('redirect') })
    const { requests } = installFetch([
      { kind: 'redirect', url: '/admin/articles' },
      { kind: 'toast', presentation },
    ], succeeds)
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, { page: resourcePage() })

    app.mount(container)
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(container.querySelector('[data-slot="notification-toast"]')?.textContent).toContain('Article saved'))
    expect(order).toEqual(['toast', 'redirect'])
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull()
    expect(requests.at(-1)).toMatchObject({ operation: 'form-submit', panelId: 'admin' })
    await nextTick()
    app.unmount()
  })

  it('redirects successful resource creates using the configured Filament destination', async () => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const page = resourcePage()
    const configured: NuxtPanelPage = {
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: {
          ...page.bootstrap.manifest,
          runtime: {
            databaseTransactions: false,
            readOnlyRelationManagersOnResourceViewPagesByDefault: true,
            resourceCreatePageRedirect: 'view',
            resourceEditPageRedirect: null,
            spa: false,
            spaUrlExceptions: [],
            strictAuthorization: false,
            unsavedChangesAlerts: false,
          },
        },
      },
    }
    const routerPush = vi.fn(async () => undefined)
    configureNuxtNavigation(routerPush)
    installFetch([], true, { id: 'article-1' })
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, { page: configured })

    app.mount(container)
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith('/admin/articles/article-1'))
    app.unmount()
  })
})
