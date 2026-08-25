import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClientNotificationInboxStore } from '@holo-js/panels-client'
import type { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SvelteNotificationInboxTrigger } from '../src/notifications'

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
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
let flushClient: typeof flushSync
let mountClient: typeof mount
let unmountClient: typeof unmount

beforeAll(async () => {
  const packagePath = createRequire(import.meta.url).resolve('svelte/package.json')
  const client = await import(pathToFileURL(resolve(dirname(packagePath), 'src/index-client.js')).href)
  flushClient = client.flushSync as typeof flushSync
  mountClient = client.mount as typeof mount
  unmountClient = client.unmount as typeof unmount
})

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await unmountClient(item.component)
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

describe('P13 Svelte notification inbox trigger', () => {
  it('does not mount or load a lazy inbox until its trigger is opened', () => {
    const store = emptyStore()
    const start = vi.spyOn(store, 'start')
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(SvelteNotificationInboxTrigger, { props: { lazy: true, placement: 'topbar', store }, target: container })
    mounted.push({ component, container })
    flushClient()
    expect(container.querySelector('.hp-notification-inbox')).toBeNull()
    expect(start).not.toHaveBeenCalled()
    container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')?.click()
    flushClient()
    expect(document.querySelector('.hp-notification-inbox')).not.toBeNull()
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
    await store.start()
    const dispose = vi.spyOn(store, 'dispose')
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(SvelteNotificationInboxTrigger, { props: { placement: 'topbar', store }, target: container })
    mounted.push({ component, container })
    flushClient()

    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = document.querySelector<HTMLElement>('.hp-notification-inbox-trigger-content')
    expect(button?.getAttribute('aria-label')).toBe('Notifications, 1 unread')
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(button?.getAttribute('aria-controls')).toBeNull()
    expect(document.querySelector<HTMLElement>('.hp-notification-inbox')?.dataset.placement).toBe('dropdown')
    const badge = container.querySelector('.hp-notification-inbox-trigger-badge')
    expect(badge?.textContent).toBe('1')
    expect(badge?.getAttribute('aria-hidden')).toBe('true')

    button?.click()
    flushClient()
    expect(button?.getAttribute('aria-expanded')).toBe('true')
    expect(content?.dataset.state).toBe('open')
    button?.click()
    flushClient()
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(dispose).not.toHaveBeenCalled()
  })

  it('maps sidebar placement and restores trigger focus after Escape and outside clicks', async () => {
    const container = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(container, outside)
    const component = mountClient(SvelteNotificationInboxTrigger, { props: { label: 'Inbox', placement: 'sidebar', store: emptyStore() }, target: container })
    mounted.push({ component, container })
    flushClient()
    const button = container.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')
    const content = document.querySelector<HTMLElement>('.hp-notification-inbox-trigger-content')
    expect(document.querySelector<HTMLElement>('.hp-notification-inbox')?.dataset.placement).toBe('sidebar')
    expect(button?.getAttribute('aria-label')).toBe('Inbox')

    button?.click()
    flushClient()
    await new Promise((resolve) => setTimeout(resolve, 5))
    outside.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    flushClient()
    await Promise.resolve()
    flushClient()
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)

    button?.click()
    flushClient()
    await new Promise((resolve) => setTimeout(resolve, 5))
    outside.focus()
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerType: 'mouse' }))
    outside.click()
    flushClient()
    await vi.waitFor(() => {
      flushClient()
      expect(button?.getAttribute('aria-expanded')).toBe('false')
    })
    expect(document.activeElement).toBe(button)
    outside.remove()
  })
})
