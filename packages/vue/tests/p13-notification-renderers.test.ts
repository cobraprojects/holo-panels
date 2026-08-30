import { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'
import { createApp, createSSRApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerVueNotificationRenderer, VueNotificationInbox, VueToastViewport } from '../src'
import { createComponentRegistry } from '../src/registry'

const apps: App[] = []
const presentation = {
  actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: '/reports' }],
  body: 'Quarterly report is ready',
  closeable: true,
  color: 'brand-accent',
  duration: null,
  icon: 'check',
  id: 'notice-1',
  persistent: true,
  status: 'success' as const,
  title: 'Report ready',
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.restoreAllMocks()
})

describe('P13 Vue notification renderers', () => {
  it('distinguishes loading and failed inbox requests from an empty inbox', async () => {
    let fail: (error: Error) => void = () => undefined
    let recovered = false
    const store = new ClientNotificationInboxStore({ polling: false, transport: {
      delete: async () => 0,
      list: (page, pageSize) => recovered
        ? Promise.resolve({ items: [], page, pageSize, total: 0, unread: 0 })
        : new Promise((_resolve, reject) => { fail = reject }),
      markRead: async () => 0,
      markUnread: async () => 0,
    } })
    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { store }))
    apps.push(app)
    app.mount(container)
    await nextTick()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading notifications')
    expect(container.textContent).not.toContain('No notifications')
    fail(new Error('SQLSTATE password=secret /srv/private.ts:42'))
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Notifications failed to load'))
    expect(container.textContent).not.toContain('No notifications')
    expect(container.textContent).not.toMatch(/SQLSTATE|secret|private\.ts/)
    recovered = true
    await store.refresh()
    await nextTick()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('No notifications')
  })

  it('renders the empty notification journey in Arabic', async () => {
    const store = new ClientNotificationInboxStore({ polling: false, transport: {
      delete: async () => 0,
      list: async (page, pageSize) => ({ items: [], page, pageSize, total: 0, unread: 0 }),
      markRead: async () => 0,
      markUnread: async () => 0,
    } })
    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { locale: 'ar', store }))
    apps.push(app)
    await store.start()

    app.mount(container)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('لا توجد إشعارات')
      expect(container.textContent).toContain('لا توجد إشعارات جديدة.')
    })
  })

  it('updates notification copy when the locale changes', async () => {
    const store = new ClientNotificationInboxStore({ polling: false, transport: {
      delete: async () => 0,
      list: async (page, pageSize) => ({ items: [], page, pageSize, total: 0, unread: 0 }),
      markRead: async () => 0,
      markUnread: async () => 0,
    } })
    const locale = ref('en')
    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { locale: locale.value, store }))
    apps.push(app)
    await store.start()
    app.mount(container)
    expect(container.textContent).toContain('You are all caught up.')

    locale.value = 'ar'
    await nextTick()

    await vi.waitFor(() => expect(container.textContent).toContain('لا توجد إشعارات جديدة.'))
  })

  it('executes a toast action once after shared confirmation without an inbox', async () => {
    const executeToastAction = vi.fn(async () => ({ effects: [], items: [], status: 'succeeded' as const }))
    const store = new ClientToastStore()
    store.connectActions({ executeToastAction })
    const actionManifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: 'rotate-cw', id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    store.push({ ...presentation, actions: [{ actionManifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', token: 'signed-token', url: null }] })
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(() => h(VueToastViewport, { store }))
    apps.push(app)
    app.mount(container)
    await nextTick()
    await vi.waitFor(() => expect(container.querySelector('[data-action-id="retry"]')).not.toBeNull())
    container.querySelector<HTMLButtonElement>('[data-action-id="retry"]')?.click()
    await nextTick()
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
    expect(executeToastAction).not.toHaveBeenCalled()
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click()
    await nextTick()
    await vi.waitFor(() => expect(executeToastAction).toHaveBeenCalledWith('signed-token', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal)))
    expect(executeToastAction).toHaveBeenCalledOnce()
    store.dispose()
  })
  it('runs saved notification actions through the shared confirmation dialog', async () => {
    const executeAction = vi.fn(async () => ({ effects: [], items: [], status: 'succeeded' as const }))
    const manifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: 'rotate-cw', id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    const store = new ClientNotificationInboxStore({ transport: {
      delete: async () => 1, executeAction, markRead: async () => 1, markUnread: async () => 1,
      list: async (page, pageSize) => ({ items: [{ createdAt: '2026-07-28T10:00:00.000Z', id: 'saved-1', presentation: { ...presentation, actions: [{ actionManifest: manifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', url: null }] }, read: false, type: 'standard' }], page, pageSize, total: 1, unread: 1 }),
    } })
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(() => h(VueNotificationInbox, { store }))
    apps.push(app)
    app.mount(container)
    await vi.waitFor(() => expect(container.textContent).toContain('Retry'))
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Retry')?.click()
    await nextTick()
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Retry publishing?'))
    expect(executeAction).not.toHaveBeenCalled()
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click()
    await nextTick()
    await vi.waitFor(() => expect(executeAction).toHaveBeenCalledWith('saved-1', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal)))
    expect(executeAction).toHaveBeenCalledOnce()
  })

  it('renders and operates the accessible toast queue with persistence and safe actions', async () => {
    const store = new ClientToastStore()
    store.push({ ...presentation, color: '#16a34a', iconColor: '#b42318' })
    store.push({ ...presentation, actions: [{ id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' }], id: 'notice-2', persistent: false, title: 'Unsafe link' })
    const markup = await renderToString(createSSRApp(() => h(VueToastViewport, { placement: 'bottom', store })))
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('data-sonner-toaster')
    expect(markup).toContain('data-y-position="bottom"')
    expect(markup).not.toContain('javascript:')

    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(() => h(VueToastViewport, { store }))
    apps.push(app)
    app.mount(container)
    await vi.waitFor(() => expect(Array.from(container.querySelectorAll('[data-sonner-toast]')).some(toast => toast.textContent?.includes('Report ready'))).toBe(true))
    const reportToast = Array.from(container.querySelectorAll('[data-sonner-toast]')).find(toast => toast.textContent?.includes('Report ready'))
    if (!reportToast) throw new Error('Expected the report notification')
    const colored = reportToast.querySelector<HTMLElement>('.hp-notification-toast')!
    expect(getComputedStyle(colored).borderInlineStartColor).toBe('#16a34a')
    expect(getComputedStyle(colored.querySelector<HTMLElement>('[data-slot="notification-icon"]')!).color).toBe('#b42318')
    reportToast?.querySelector<HTMLButtonElement>('[aria-label="Close Report ready"]')?.click()
    await vi.waitFor(() => expect(store.state.items.some(item => item.id === 'notice-1')).toBe(false))
  })

  it('renders topbar dropdown, sidebar, and page inbox placements with unread controls, pagination, and namespaced custom types', async () => {
    const transport = {
      delete: vi.fn(async () => 1),
      list: vi.fn(async (page: number, pageSize: number) => ({
        items: [
          { createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'build' },
          { createdAt: '2026-07-28T09:00:00.000Z', id: 'db-2', presentation: { ...presentation, id: 'notice-read', title: 'Read notice' }, read: true, type: 'standard' },
        ],
        page,
        pageSize,
        total: 25,
        unread: 1,
      })),
      markRead: vi.fn(async () => 1),
      markUnread: vi.fn(async () => 1),
    }
    const store = new ClientNotificationInboxStore({ pageSize: 10, polling: false, transport })
    await store.start()
    const Custom = defineComponent({ props: { notification: { required: true, type: Object } }, setup: props => () => h('strong', { 'data-custom-notification': String(props.notification.id) }, `Custom ${String(props.notification.id)}`) })
    const registry = registerVueNotificationRenderer(createComponentRegistry(), 'build', Custom)
    const topbar = await renderToString(createSSRApp(() => h(VueNotificationInbox, { placement: 'dropdown', store })))
    expect(topbar).toContain('data-placement="dropdown"')

    const custom = await renderToString(createSSRApp(() => h(VueNotificationInbox, { placement: 'sidebar', registry, store })))
    expect(custom).toContain('data-placement="sidebar"')
    expect(custom).toContain('aria-label="1 unread"')
    expect(custom).toContain('data-custom-notification="db-1"')
    expect(custom).toContain('data-color="brand-accent"')

    const plain = await renderToString(createSSRApp(() => h(VueNotificationInbox, { store })))
    expect(plain).toContain('data-placement="page"')
    expect(plain).toContain('data-read="false"')
    expect(plain).toContain('hp-notification-inbox-header')
    expect(plain).toContain('hp-notification-inbox-count')
    expect(plain).toContain('data-slot="notification-list"')
    expect(plain).toContain('hp-notification-item-content')
    expect(plain).toContain('hp-notification-item-time')
    expect(plain).toContain('data-slot="notification-actions"')
    expect(plain).toContain('hp-notification-pagination')
    expect(plain).toContain('Mark all read')
    expect(plain).toContain('Mark read')
    expect(plain).toContain('Mark unread')
    expect(plain).toContain('Delete')
    expect(plain).toContain('Page 1 of 3')
    expect(plain).toContain('href="/reports"')
    const arabic = await renderToString(h(VueNotificationInbox, { locale: 'ar', store }))
    expect(arabic).toContain('الإشعارات')
    expect(arabic).toContain('الصفحة 1 من 3')
    expect(arabic).toContain('hp:rtl:rotate-180')

    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { store }))
    apps.push(app)
    app.mount(container)
    await nextTick()
    const button = (label: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent === label)
    button('Mark read')?.click()
    await nextTick()
    expect(transport.markRead).toHaveBeenCalledWith(['db-1'], expect.any(AbortSignal))
    container.querySelector<HTMLButtonElement>('[aria-label="Next"]')?.click()
    await nextTick()
    expect(transport.list).toHaveBeenCalledWith(2, 10, expect.any(AbortSignal))
    button('Delete')?.click()
    await nextTick()
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(candidate => candidate.textContent === 'Delete')?.click()
    await nextTick()
    expect(transport.delete).toHaveBeenCalledWith(['db-1'], expect.any(AbortSignal))
  })

  it('contains rejected inbox mutations at the renderer event boundary', async () => {
    const failure = new Error('sensitive transport failure')
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 1,
        list: async (page, pageSize) => ({ items: [{ createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'standard' }], page, pageSize, total: 1, unread: 1 }),
        markRead: async () => 1,
        markUnread: async () => 1,
      },
    })
    await store.start()
    const mutation = vi.spyOn(store, 'markRead').mockRejectedValue(failure)
    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { store }))
    apps.push(app)
    app.mount(container)
    await nextTick()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark read')?.click()
    await Promise.resolve()
    await nextTick()
    expect(mutation).toHaveBeenCalledWith(['db-1'])
  })
})
