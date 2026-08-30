import { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactNotificationInbox, ReactToastViewport, registerReactNotificationRenderer, type ReactCustomNotificationProps } from '../src'
import { createComponentRegistry } from '../src/registry'

const roots: Array<{ readonly container: HTMLDivElement, readonly root: Root }> = []
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
  for (const item of roots.splice(0)) act(() => item.root.unmount())
  vi.restoreAllMocks()
})

describe('P13 React notification renderers', () => {
  it('removes owned toast presentations when navigation unmounts their viewport', async () => {
    const store = new ClientToastStore()
    store.push({ ...presentation, id: 'departing-page' })
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactToastViewport store={store} />))
    expect(toast.getToasts().some(item => item.id === 'departing-page')).toBe(true)
    await act(async () => root.render(null))
    expect(toast.getToasts().some(item => item.id === 'departing-page')).toBe(false)
    expect(store.state.items.some(item => item.id === 'departing-page')).toBe(true)
  })

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
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactNotificationInbox store={store} />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading notifications')
    expect(container.textContent).not.toContain('No notifications')
    await act(async () => fail(new Error('SQLSTATE password=secret /srv/private.ts:42')))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Notifications failed to load')
    expect(container.textContent).not.toContain('No notifications')
    expect(container.textContent).not.toMatch(/SQLSTATE|secret|private\.ts/)
    recovered = true
    await act(async () => store.refresh())
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
    const root = createRoot(container)
    roots.push({ container, root })
    await store.start()

    await act(async () => root.render(<ReactNotificationInbox locale="ar" store={store} />))

    expect(container.textContent).toContain('لا توجد إشعارات')
    expect(container.textContent).toContain('لا توجد إشعارات جديدة.')
  })

  it('executes a toast action once after shared confirmation without an inbox', async () => {
    const executeToastAction = vi.fn(async () => ({ effects: [], items: [], status: 'succeeded' as const }))
    const store = new ClientToastStore()
    store.connectActions({ executeToastAction })
    const actionManifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: 'rotate-cw', id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    store.push({ ...presentation, actions: [{ actionManifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', token: 'signed-token', url: null }] })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactToastViewport store={store} />))
    await vi.waitFor(() => expect(container.querySelector('[data-action-id="retry"]')).not.toBeNull())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action-id="retry"]')?.click())
    expect(executeToastAction).not.toHaveBeenCalled()
    await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click())
    expect(executeToastAction).toHaveBeenCalledWith('signed-token', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal))
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
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactNotificationInbox store={store} />))
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Retry')?.click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Retry publishing?')
    expect(executeAction).not.toHaveBeenCalled()
    await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click())
    expect(executeAction).toHaveBeenCalledWith('saved-1', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal))
    expect(executeAction).toHaveBeenCalledOnce()
  })

  it('renders and operates an accessible persistent toast queue with safe navigation', async () => {
    const store = new ClientToastStore()
    store.push({ ...presentation, color: '#16a34a', iconColor: '#b42318' })
    store.push({ ...presentation, actions: [{ id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' }], id: 'notice-2', persistent: false, title: 'Unsafe link' })
    const markup = renderToStaticMarkup(<ReactToastViewport placement="bottom" store={store} />)
    expect(markup).toContain('aria-live="polite"')
    expect(markup).not.toContain('javascript:')

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactToastViewport store={store} />))
    await vi.waitFor(() => expect(document.querySelector('[data-slot="notification-toast"]')).not.toBeNull())
    expect(document.querySelector('[data-persistent="true"]')).not.toBeNull()
    const colored = document.querySelector<HTMLElement>('.hp-notification-toast[data-color="#16a34a"]')!
    expect(getComputedStyle(colored).borderInlineStartColor).toBe('#16a34a')
    expect(getComputedStyle(colored.querySelector<HTMLElement>('[data-slot="notification-icon"]')!).color).toBe('#b42318')
    expect(document.querySelector('a[href="/reports"]')).not.toBeNull()
    expect(document.body.innerHTML).not.toContain('javascript:')
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close Report ready"]')?.click())
    expect(store.state.items.some(item => item.id === 'notice-1')).toBe(false)
  })

  it('renders topbar dropdown, sidebar, and page inbox placements with unread state, pagination, mutations, and namespaced custom types', async () => {
    const list = vi.fn(async (page: number, pageSize: number) => ({
      items: [
        { createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'build' },
        { createdAt: '2026-07-28T09:00:00.000Z', id: 'db-2', presentation: { ...presentation, id: 'notice-read', title: 'Read notice' }, read: true, type: 'standard' },
      ],
      page,
      pageSize,
      total: 25,
      unread: 1,
    }))
    const transport = { delete: vi.fn(async () => 1), list, markRead: vi.fn(async () => 1), markUnread: vi.fn(async () => 1) }
    const store = new ClientNotificationInboxStore({ pageSize: 10, polling: false, transport })
    await store.start()
    const registry = registerReactNotificationRenderer(createComponentRegistry(), 'build', ({ notification }: ReactCustomNotificationProps) => <strong data-custom-notification={notification.id}>Custom {notification.presentation.title}</strong>)
    const topbar = renderToStaticMarkup(<ReactNotificationInbox placement="dropdown" store={store} />)
    expect(topbar).toContain('data-placement="dropdown"')

    const custom = renderToStaticMarkup(<ReactNotificationInbox placement="sidebar" registry={registry} store={store} />)
    expect(custom).toContain('data-placement="sidebar"')
    expect(custom).toContain('aria-label="1 unread"')
    expect(custom).toContain('data-custom-notification="db-1"')
    expect(custom).toContain('data-color="brand-accent"')

    const plain = renderToStaticMarkup(<ReactNotificationInbox store={store} />)
    expect(plain).toContain('data-placement="page"')
    expect(plain).toContain('data-read="false"')
    expect(plain).toContain('data-slot="notification-inbox-header"')
    expect(plain).toContain('data-slot="notification-inbox-count"')
    expect(plain).toContain('data-slot="notification-list"')
    expect(plain).toContain('data-slot="notification-item-content"')
    expect(plain).toContain('data-slot="notification-item-time"')
    expect(plain).toContain('data-slot="notification-actions"')
    expect(plain).toContain('data-slot="notification-pagination"')
    expect(plain).toContain('Mark all read')
    expect(plain).toContain('Mark read')
    expect(plain).toContain('Mark unread')
    expect(plain).toContain('Delete')
    expect(plain).toContain('Page 1 of 3')
    expect(plain).toContain('aria-label="Next"')
    expect(plain).toContain('href="/reports"')
    const arabic = renderToStaticMarkup(<ReactNotificationInbox locale="ar" store={store} />)
    expect(arabic).toContain('الإشعارات')
    expect(arabic).toContain('الصفحة 1 من 3')
    expect(arabic).toContain('hp:rtl:rotate-180')

    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactNotificationInbox store={store} />))
    const button = (label: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent === label)
    await act(async () => button('Mark read')?.click())
    expect(transport.markRead).toHaveBeenCalledWith(['db-1'], expect.any(AbortSignal))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Next"]')?.click())
    expect(list).toHaveBeenCalledWith(2, 10, expect.any(AbortSignal))
    await act(async () => button('Delete')?.click())
    const deleteDialog = document.querySelector('[role="alertdialog"]')
    await act(async () => Array.from(deleteDialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(candidate => candidate.textContent === 'Delete')?.click())
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
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactNotificationInbox store={store} />))
    const markReadButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark read')
    await act(async () => {
      markReadButton?.click()
      await Promise.resolve()
    })
    expect(mutation).toHaveBeenCalledWith(['db-1'])
  })
})
