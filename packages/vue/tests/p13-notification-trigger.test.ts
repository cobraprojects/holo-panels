import { ClientNotificationInboxStore } from '@holo-js/panels-client'
import { createApp, h, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueNotificationInboxTrigger } from '../src/notifications'

const mounted: Array<{ readonly app: App, readonly container: HTMLDivElement }> = []
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
    item.app.unmount()
    item.container.remove()
  }
  vi.restoreAllMocks()
})

function emptyStore(): ClientNotificationInboxStore {
  return new ClientNotificationInboxStore({
    polling: false,
    transport: {
      delete: async () => 0,
      list: async (page, pageSize) => ({ items: [], page, pageSize, total: 0, unread: 0 }),
      markRead: async () => 0,
      markUnread: async () => 0,
    },
  })
}

describe('P13 Vue notification inbox trigger', () => {
  it('does not mount or load a lazy inbox until its trigger is opened', async () => {
    const store = emptyStore()
    const start = vi.spyOn(store, 'start')
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(() => h(VueNotificationInboxTrigger, { lazy: true, placement: 'topbar', store }))
    mounted.push({ app, container })
    app.mount(container)
    await nextTick()
    expect(container.querySelector('.hp-notification-inbox')).toBeNull()
    expect(start).not.toHaveBeenCalled()
    container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')?.click()
    await nextTick()
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
    const app = createApp(() => h(VueNotificationInboxTrigger, { placement: 'topbar', store }))
    mounted.push({ app, container })
    app.mount(container)
    await Promise.resolve()
    await nextTick()

    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = container.querySelector<HTMLDivElement>('.hp-notification-inbox-trigger-content')
    expect(button?.textContent).toContain('Notifications')
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(button?.getAttribute('aria-controls')).toBe(content?.id)
    expect(content?.hidden).toBe(true)
    expect(container.querySelector<HTMLElement>('.hp-notification-inbox')?.dataset.placement).toBe('dropdown')
    expect(container.querySelector('.hp-notification-inbox-trigger-badge')?.textContent).toBe('1')
    expect(start).toHaveBeenCalledOnce()

    button?.click()
    await nextTick()
    expect(button?.getAttribute('aria-expanded')).toBe('true')
    expect(content?.hidden).toBe(false)
    button?.click()
    await nextTick()
    expect(content?.hidden).toBe(true)
    expect(dispose).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledOnce()
  })

  it('maps sidebar placement and restores trigger focus after Escape and outside clicks', async () => {
    const container = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(container, outside)
    const app = createApp(() => h(VueNotificationInboxTrigger, { label: 'Inbox', placement: 'sidebar', store: emptyStore() }))
    mounted.push({ app, container })
    app.mount(container)
    await nextTick()
    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = container.querySelector<HTMLDivElement>('.hp-notification-inbox-trigger-content')
    expect(container.querySelector<HTMLElement>('.hp-notification-inbox')?.dataset.placement).toBe('sidebar')
    expect(button?.textContent).toContain('Inbox')

    button?.click()
    await nextTick()
    outside.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await nextTick()
    expect(content?.hidden).toBe(true)
    expect(document.activeElement).toBe(button)

    button?.click()
    await nextTick()
    outside.focus()
    outside.click()
    await nextTick()
    expect(content?.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
    outside.remove()
  })
})
