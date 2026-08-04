import { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
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
  it('renders and operates an accessible persistent toast queue with safe navigation', async () => {
    const store = new ClientToastStore()
    store.push(presentation)
    store.push({ ...presentation, actions: [{ id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' }], id: 'notice-2', persistent: false, title: 'Unsafe link' })
    const markup = renderToStaticMarkup(<ReactToastViewport placement="bottom" store={store} />)
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-label="Notification queue"')
    expect(markup).toContain('data-persistent="true"')
    expect(markup).toContain('data-color="brand-accent"')
    expect(markup).not.toContain('style="')
    expect(markup).toContain('href="/reports"')
    expect(markup).not.toContain('javascript:')

    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactToastViewport store={store} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close Report ready"]')?.click())
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
    expect(plain).toContain('Mark all read')
    expect(plain).toContain('Mark read')
    expect(plain).toContain('Mark unread')
    expect(plain).toContain('Delete')
    expect(plain).toContain('Page 1 of 3')
    expect(plain).toContain('aria-label="Next notification page"')
    expect(plain).toContain('href="/reports"')

    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push({ container, root })
    await act(async () => root.render(<ReactNotificationInbox store={store} />))
    const button = (label: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent === label)
    await act(async () => button('Mark read')?.click())
    expect(transport.markRead).toHaveBeenCalledWith(['db-1'], expect.any(AbortSignal))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Next notification page"]')?.click())
    expect(list).toHaveBeenCalledWith(2, 10, expect.any(AbortSignal))
    await act(async () => button('Delete')?.click())
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
