import { ClientNotificationInboxStore } from '@holo-js/panels-client'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactNotificationInboxTrigger } from '../src/notifications'

const mounted: Array<{ readonly container: HTMLDivElement, readonly root: Root }> = []
const presentation = {
  actions: [],
  body: null,
  closeable: true,
  color: null,
  duration: null,
  icon: null,
  id: 'notice-1',
  persistent: true,
  status: 'info' as const,
  title: 'Deployment complete',
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    act(() => item.root.unmount())
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P13 React notification inbox trigger', () => {
  it('does not mount or load a lazy inbox until its trigger is opened', async () => {
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 0,
        list: async (page, pageSize) => ({ items: [], page, pageSize, total: 0, unread: 0 }),
        markRead: async () => 0,
        markUnread: async () => 0,
      },
    })
    const start = vi.spyOn(store, 'start')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted.push({ container, root })

    await act(async () => root.render(<ReactNotificationInboxTrigger lazy placement="topbar" store={store} />))
    expect(container.querySelector('.hp-notification-inbox')).toBeNull()
    expect(start).not.toHaveBeenCalled()
    await act(async () => container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')?.click())
    expect(container.querySelector('.hp-notification-inbox')).not.toBeNull()
    expect(start).toHaveBeenCalledOnce()
  })

  it('keeps the inbox mounted while closed and supports accessible topbar interaction', async () => {
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 1,
        list: async (page, pageSize) => ({
          items: [{ createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'standard' }],
          page,
          pageSize,
          total: 1,
          unread: 1,
        }),
        markRead: async () => 1,
        markUnread: async () => 1,
      },
    })
    const start = vi.spyOn(store, 'start')
    const dispose = vi.spyOn(store, 'dispose')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted.push({ container, root })

    await act(async () => root.render(<ReactNotificationInboxTrigger placement="topbar" store={store} />))
    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = container.querySelector<HTMLDivElement>('.hp-notification-inbox-trigger-content')
    const inbox = container.querySelector<HTMLElement>('.hp-notification-inbox')
    expect(button?.textContent).toContain('Notifications')
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(button?.getAttribute('aria-controls')).toBe(content?.id)
    expect(content?.hidden).toBe(true)
    expect(inbox?.dataset.placement).toBe('dropdown')
    expect(container.querySelector('.hp-notification-inbox-trigger-badge')?.textContent).toBe('1')
    expect(start).toHaveBeenCalledOnce()

    await act(async () => button?.click())
    expect(button?.getAttribute('aria-expanded')).toBe('true')
    expect(content?.hidden).toBe(false)
    await act(async () => button?.click())
    expect(content?.hidden).toBe(true)
    expect(dispose).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledOnce()
  })

  it('maps sidebar placement and restores trigger focus after Escape and outside clicks', async () => {
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 0,
        list: async (page, pageSize) => ({ items: [], page, pageSize, total: 0, unread: 0 }),
        markRead: async () => 0,
        markUnread: async () => 0,
      },
    })
    const container = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(container, outside)
    const root = createRoot(container)
    mounted.push({ container, root })
    await act(async () => root.render(<ReactNotificationInboxTrigger label="Inbox" placement="sidebar" store={store} />))
    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = container.querySelector<HTMLDivElement>('.hp-notification-inbox-trigger-content')
    expect(container.querySelector<HTMLElement>('.hp-notification-inbox')?.dataset.placement).toBe('sidebar')
    expect(button?.textContent).toContain('Inbox')

    await act(async () => button?.click())
    outside.focus()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(content?.hidden).toBe(true)
    expect(document.activeElement).toBe(button)

    await act(async () => button?.click())
    outside.focus()
    await act(async () => outside.click())
    expect(content?.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
    outside.remove()
  })
})
