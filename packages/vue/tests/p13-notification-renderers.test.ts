import { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'
import { createApp, createSSRApp, defineComponent, h, nextTick, type App } from 'vue'
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
  it('renders and operates the accessible toast queue with persistence and safe actions', async () => {
    const store = new ClientToastStore()
    store.push(presentation)
    store.push({ ...presentation, actions: [{ id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' }], id: 'notice-2', persistent: false, title: 'Unsafe link' })
    const markup = await renderToString(createSSRApp(() => h(VueToastViewport, { placement: 'bottom', store })))
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('data-sonner-toaster')
    expect(markup).toContain('data-y-position="bottom"')
    expect(markup).not.toContain('javascript:')

    const container = document.createElement('div')
    const app = createApp(() => h(VueToastViewport, { store }))
    apps.push(app)
    app.mount(container)
    await vi.waitFor(() => expect(Array.from(container.querySelectorAll('[data-sonner-toast]')).some(toast => toast.textContent?.includes('Report ready'))).toBe(true))
    const reportToast = Array.from(container.querySelectorAll('[data-sonner-toast]')).find(toast => toast.textContent?.includes('Report ready'))
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

    const container = document.createElement('div')
    const app = createApp(() => h(VueNotificationInbox, { store }))
    apps.push(app)
    app.mount(container)
    await nextTick()
    const button = (label: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent === label)
    button('Mark read')?.click()
    await nextTick()
    expect(transport.markRead).toHaveBeenCalledWith(['db-1'], expect.any(AbortSignal))
    container.querySelector<HTMLButtonElement>('[aria-label="Next notification page"]')?.click()
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
