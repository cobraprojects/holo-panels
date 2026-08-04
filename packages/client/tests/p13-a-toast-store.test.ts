import { panelNotification, type PanelNotificationPresentation } from '@holo-js/panels-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientToastStore } from '../src/notifications/toast-store'

const stores: ClientToastStore[] = []

function store(): ClientToastStore {
  const value = new ClientToastStore()
  stores.push(value)
  return value
}

afterEach(() => {
  for (const value of stores.splice(0)) value.dispose()
  vi.useRealTimers()
})

describe('P13-A client toast state', () => {
  it('queues distinct notifications, deduplicates by ID, resets timers, and publishes live-region state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T10:00:00Z'))
    const toasts = store()
    const states: string[] = []
    toasts.subscribe(state => states.push(state.liveMessage))
    const saved = panelNotification('saved').title('Saved').body('Post updated').duration(2_000).presentation()
    const queued = panelNotification('queued').title('Queued').duration(3_000).presentation()

    toasts.push(saved)
    toasts.push(queued)
    vi.advanceTimersByTime(1_500)
    toasts.push(saved)

    expect(toasts.state.items.map(item => item.id)).toEqual(['queued', 'saved'])
    expect(toasts.state.items[1]?.createdAt).toBe(Date.now())
    expect(toasts.state.liveMessage).toBe('Saved. Post updated')
    vi.advanceTimersByTime(1_000)
    expect(toasts.state.items.map(item => item.id)).toEqual(['queued', 'saved'])
    vi.advanceTimersByTime(600)
    expect(toasts.state.items.map(item => item.id)).toEqual(['saved'])
    vi.advanceTimersByTime(1_000)
    expect(toasts.state.items).toEqual([])
    expect(states).toContain('')
  })

  it('keeps persistent notifications until dismissal and invokes configured actions', async () => {
    vi.useFakeTimers()
    const toasts = store()
    const handler = vi.fn(async () => undefined)
    toasts.onAction(handler)
    const presentation = panelNotification('review')
      .title('Review ready')
      .persistent()
      .closeable(false)
      .action('open', 'Open', 'navigate', '/reviews/1')
      .action('dismiss', 'Dismiss', 'dismiss')
      .presentation()

    toasts.push(presentation)
    vi.runAllTimers()
    expect(toasts.state.items).toHaveLength(1)
    expect(toasts.state.items[0]?.closeable).toBe(false)
    await toasts.trigger('review', 'open')
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'open', kind: 'navigate' }), expect.objectContaining({ id: 'review' }))
    await toasts.trigger('review', 'dismiss')
    expect(toasts.state.items).toEqual([])
  })

  it('revalidates client-originated presentations and strips unsafe or trusted-only actions', async () => {
    const toasts = store()
    const unsafe: PanelNotificationPresentation = {
      ...panelNotification('client.notice').title('Client notice').persistent().presentation(),
      actions: [
        { id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' },
        { id: 'read', kind: 'mark-read', label: 'Read', url: null },
        { id: 'safe', kind: 'navigate', label: 'Safe', url: '/safe' },
        { id: 'dismiss', kind: 'dismiss', label: 'Dismiss', url: null },
      ],
    }

    toasts.push(unsafe, false)
    expect(toasts.state.items[0]?.actions).toEqual([
      { id: 'safe', kind: 'navigate', label: 'Safe', url: '/safe' },
      { id: 'dismiss', kind: 'dismiss', label: 'Dismiss', url: null },
    ])
    await expect(toasts.trigger('client.notice', 'read')).rejects.toThrow('Unknown notification action')
  })
})
