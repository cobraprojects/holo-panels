import { panelNotification } from '@holo-js/panels-core'
import { ClientToastStore } from '@holo-js/panels-vue'
import { createApp, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PanelPage, type NuxtPanelPage } from '../src'

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
        id: 'admin',
        navigation: [],
        navigationMode: 'sidebar',
        path: '/admin',
        sidebarCollapsible: true,
        theme: { darkMode: 'system' },
        userMenu: [],
      },
      notifications: configured ? { realtimeChannel: options.channel ?? null } : null,
      provider: 'users',
    },
    page: {
      breadcrumbs: [],
      data: {},
      heading: 'Dashboard',
      manifest: { body: null, id: 'dashboard', pageType: 'custom', path: '/admin', schemaId: null },
      schema: null,
      subheading: null,
      title: 'Dashboard',
    },
    path: '/admin',
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

function installFetch(effects: readonly Record<string, unknown>[] = [], mutationSucceeds = true) {
  const requests: RecordedRequest[] = []
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const fields = new URLSearchParams(String(init?.body ?? ''))
    const envelope = JSON.parse(fields.get('request') ?? '{}') as RecordedRequest & { readonly id: string }
    requests.push(envelope)
    const data = envelope.operation === 'notification'
      ? { items: [], page: 1, pageSize: 20, total: 0, unread: 0 }
      : { saved: true }
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
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('Nuxt P13 notification integration', () => {
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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(notificationRealtime).toHaveBeenCalledWith('panels.notifications.admin-7')
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-placement="topbar"]')).not.toBeNull()
    expect(container.querySelector('.hp-notification-toasts')).not.toBeNull()
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
    vi.spyOn(window.location, 'assign').mockImplementation(() => { order.push('redirect') })
    const { requests } = installFetch([
      { kind: 'redirect', url: '/admin/articles' },
      { kind: 'toast', presentation },
    ], succeeds)
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, { page: resourcePage() })

    app.mount(container)
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(container.querySelector('.hp-notification-toasts')?.textContent).toContain('Article saved'))
    expect(order).toEqual(['toast', 'redirect'])
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull()
    expect(requests.at(-1)).toMatchObject({ operation: 'form-submit', panelId: 'admin' })
    await nextTick()
    app.unmount()
  })
})
