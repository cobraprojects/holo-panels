import { describe, expect, it, vi } from 'vitest'
import type { PanelDatabaseNotificationPage } from '@holo-js/panels-core'
import { panelNotification } from '@holo-js/panels-core'
import { ClientNotificationInboxStore, ClientToastStore } from '../src'

function page(read = false): PanelDatabaseNotificationPage {
  return {
    items: [{
      createdAt: '2026-07-27T10:00:00.000Z',
      id: 'one',
      presentation: panelNotification('saved').title('Saved').presentation(),
      read,
      type: 'saved',
    }],
    page: 1,
    pageSize: 20,
    total: 1,
    unread: read ? 0 : 1,
  }
}

describe('P13 client notifications', () => {
  it('queues, announces, deduplicates, dismisses, and limits client actions', async () => {
    const store = new ClientToastStore()
    const trusted = panelNotification('saved').title('Saved').persistent().action('read', 'Read', 'mark-read').presentation()
    store.push(trusted)
    store.push(trusted)
    expect(store.state.items).toHaveLength(1)
    expect(store.state.liveMessage).toBe('Saved')

    store.push(trusted, false)
    expect(store.state.items[0]?.actions).toEqual([])
    await expect(store.trigger('saved', 'read')).rejects.toThrow('Unknown notification action')
    store.dismiss('saved')
    expect(store.state.items).toHaveLength(0)
  })

  it('ignores stale loads and refreshes after mutation and realtime invalidation', async () => {
    let resolveFirst: (value: PanelDatabaseNotificationPage) => void = () => undefined
    let firstPending = true
    let current = page()
    const list = vi.fn((requestedPage: number) => {
      if (requestedPage === 1 && firstPending) {
        firstPending = false
        return new Promise<PanelDatabaseNotificationPage>(resolve => { resolveFirst = resolve })
      }
      return Promise.resolve(current)
    })
    const realtimeListeners = new Set<() => void>()
    const store = new ClientNotificationInboxStore({
      polling: false,
      realtime: { subscribe: listener => { realtimeListeners.add(listener); return () => realtimeListeners.delete(listener) } },
      transport: {
        delete: async () => 1,
        list: (requestedPage, _pageSize, _signal) => list(requestedPage),
        markRead: async () => { current = page(true); return 1 },
        markUnread: async () => 1,
      },
    })

    const initial = store.start()
    await store.load(2)
    resolveFirst(page())
    await initial
    expect(store.state.page).toBe(1)
    expect(store.state.unread).toBe(1)
    await store.markRead(['one'])
    expect(store.state.unread).toBe(0)
    current = page()
    for (const listener of realtimeListeners) listener()
    await vi.waitFor(() => expect(store.state.unread).toBe(1))
    store.dispose()
    expect(realtimeListeners).toHaveLength(0)
  })

  it('reports mutation failures programmatically and exposes only sanitized client errors', async () => {
    let listFails = false
    const sensitive = new Error('SQLSTATE secret_table connection password=hidden')
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => { throw sensitive },
        list: async () => {
          if (listFails) throw sensitive
          return page()
        },
        markRead: async () => { throw sensitive },
        markUnread: async () => { throw sensitive },
      },
    })
    await store.start()

    await expect(store.markRead(['one'])).rejects.toBe(sensitive)
    expect(store.state.error).toBe('Unable to update notifications')
    await expect(store.markUnread(['one'])).rejects.toBe(sensitive)
    await expect(store.delete(['one'])).rejects.toBe(sensitive)
    await expect(store.markAllRead()).rejects.toBe(sensitive)
    expect(store.state.error).toBe('Unable to update notifications')
    expect(store.state.error).not.toContain('SQLSTATE')

    listFails = true
    await expect(store.refresh()).resolves.toBeUndefined()
    expect(store.state.error).toBe('Notifications failed to load')
    expect(store.state.error).not.toContain('password')
  })

  it('accepts only credential-free local and absolute HTTP notification navigation', async () => {
    const navigationPage = page()
    const item = navigationPage.items[0]!
    const urls = [
      ['/reports', '/reports'],
      ['https://example.com/report', 'https://example.com/report'],
      ['https://user:password@example.com/report', null],
      ['https://example.com\\@evil.test/report', null],
      ['https://exa\nmple.com/report', null],
      ['https://', null],
    ] as const
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 1,
        list: async () => ({
          ...navigationPage,
          items: [{
            ...item,
            presentation: {
              ...item.presentation,
              actions: urls.map(([url], index) => ({ id: `navigate-${index}`, kind: 'navigate', label: `Navigate ${index}`, url })),
            },
          }],
        }),
        markRead: async () => 1,
        markUnread: async () => 1,
      },
    })
    await store.start()

    for (const [index, [, expected]] of urls.entries()) {
      const result = store.trigger('one', `navigate-${index}`)
      if (expected === null) await expect(result).rejects.toThrow('unsafe URL')
      else await expect(result).resolves.toBe(expected)
    }
  })
})
