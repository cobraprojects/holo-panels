import type { PanelDatabaseNotificationItem, PanelDatabaseNotificationPage } from '@holo-js/panels-core'
import { panelNotification } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { ClientNotificationInboxStore } from '../src/notifications/inbox-store'

function item(id: string, read = false, actions = panelNotification(`item-${id}`).title(`Item ${id}`).presentation().actions): PanelDatabaseNotificationItem {
  return {
    createdAt: '2026-07-28T10:00:00.000Z',
    id,
    presentation: { ...panelNotification(`item-${id}`).title(`Item ${id}`).presentation(), actions },
    read,
    type: 'item',
  }
}

function page(items: readonly PanelDatabaseNotificationItem[], number = 1, pageSize = 2, total = items.length): PanelDatabaseNotificationPage {
  return { items, page: number, pageSize, total, unread: items.filter(entry => !entry.read).length }
}

describe('P13-B client notification inbox runtime', () => {
  it('marks unread notifications across every page and refreshes the authoritative count', async () => {
    let records = [item('1'), item('2'), item('3'), item('4', true), item('5')]
    const markRead = vi.fn(async (ids: readonly string[]) => {
      const selected = new Set(ids)
      records = records.map(entry => selected.has(entry.id) ? { ...entry, read: true } : entry)
      return ids.length
    })
    const list = vi.fn(async (requestedPage: number, pageSize: number) => {
      const start = (requestedPage - 1) * pageSize
      const result = page(records.slice(start, start + pageSize), requestedPage, pageSize, records.length)
      return { ...result, unread: records.filter(entry => !entry.read).length }
    })
    const store = new ClientNotificationInboxStore({
      pageSize: 2,
      polling: false,
      transport: { delete: async () => 0, list, markRead, markUnread: async () => 0 },
    })

    await store.start()
    await store.markAllRead()
    expect(markRead).toHaveBeenCalledWith(['1', '2', '3', '5'], expect.any(AbortSignal))
    expect(store.state.unread).toBe(0)
    expect(store.state.items.every(entry => entry.read)).toBe(true)
    expect(list.mock.calls.some(call => call[0] === 3)).toBe(true)
  })

  it('executes database actions and defensively rejects unsafe navigation', async () => {
    const actions = panelNotification('actionable')
      .title('Actionable')
      .action('read', 'Read', 'mark-read')
      .action('remove', 'Remove', 'dismiss')
      .action('open', 'Open', 'navigate', '/inbox/1')
      .presentation().actions
    let current = page([item('1', false, actions)])
    const markRead = vi.fn(async () => { current = page(current.items.map(entry => ({ ...entry, read: true }))); return 1 })
    const remove = vi.fn(async () => { current = page([]); return 1 })
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: { delete: remove, list: async () => current, markRead, markUnread: async () => 0 },
    })
    await store.start()

    expect(await store.trigger('1', 'open')).toBe('/inbox/1')
    await store.trigger('1', 'read')
    expect(store.state.unread).toBe(0)
    current = page([item('1', false, [{ id: 'bad', kind: 'navigate', label: 'Bad', url: '/\\attacker.test' }])])
    await store.refresh()
    await expect(store.trigger('1', 'bad')).rejects.toThrow('unsafe URL')
    current = page([item('1', false, actions)])
    await store.refresh()
    await store.trigger('1', 'remove')
    expect(remove).toHaveBeenCalledWith(['1'], expect.any(AbortSignal))
    expect(store.state.total).toBe(0)
  })

  it('deduplicates realtime invalidation, reconnects, disables polling, and aborts stale loads', async () => {
    vi.useFakeTimers()
    const listeners = new Set<() => void>()
    const signals: AbortSignal[] = []
    let calls = 0
    const list = vi.fn(async (_page: number, _pageSize: number, signal: AbortSignal) => {
      signals.push(signal)
      calls++
      return page([item(String(calls))])
    })
    const realtime = { subscribe: vi.fn((listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }) }
    const store = new ClientNotificationInboxStore({
      polling: false,
      realtime,
      transport: { delete: async () => 0, list, markRead: async () => 0, markUnread: async () => 0 },
    })
    await store.start()
    for (const listener of listeners) {
      listener()
      listener()
      listener()
    }
    await vi.runAllTimersAsync()
    expect(list).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(list).toHaveBeenCalledTimes(2)

    const firstLoad = store.load(2)
    const secondLoad = store.load(3)
    await Promise.all([firstLoad, secondLoad])
    expect(signals.at(-2)?.aborted).toBe(true)
    await store.reconnectRealtime()
    expect(realtime.subscribe).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledTimes(5)
    store.dispose()
    expect(listeners.size).toBe(0)
    vi.useRealTimers()
  })

  it('polls at the configured interval and cancels polling when disposed', async () => {
    vi.useFakeTimers()
    const list = vi.fn(async () => page([item('poll')]))
    const store = new ClientNotificationInboxStore({
      polling: 1_000,
      transport: { delete: async () => 0, list, markRead: async () => 0, markUnread: async () => 0 },
    })

    await store.start()
    expect(list).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(list).toHaveBeenCalledTimes(2)
    store.dispose()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(list).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
