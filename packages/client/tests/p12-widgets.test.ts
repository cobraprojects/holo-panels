import { describe, expect, it, vi } from 'vitest'
import type { JsonValue } from '@holo-js/panels-core'
import type { WidgetClientManifest, WidgetFilterStorage, WidgetScheduler } from '../src/widgets/contracts'
import { WidgetFilterPersistence } from '../src/widgets/filters'
import { resolveWidgetGrid } from '../src/widgets/grid'
import { WidgetStore } from '../src/widgets/store'

const manifest: WidgetClientManifest = {
  filters: [{ defaultValue: 'month', id: 'period', label: 'Period' }],
  id: 'sales',
  layout: { columnSpan: 2, columnStart: 3 },
  lazy: true,
  polling: { enabled: true, interval: 5_000 },
}

class MemoryStorage implements WidgetFilterStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

class TestScheduler implements WidgetScheduler {
  callback: (() => void) | null = null
  clear = vi.fn(() => { this.callback = null })
  every = vi.fn((callback: () => void): object => {
    this.callback = callback
    return {}
  })
}

describe('P12 widget client state', () => {
  it('discards denied data and never exposes loader exception details', async () => {
    for (const status of ['hidden', 'unauthorized'] as const) {
      const result = { data: { secret: 'private' }, status }
      const store = new WidgetStore(manifest, async () => result, { initialResult: result })
      expect(store.snapshot.data).toBeNull()
      await store.load()
      expect(store.snapshot.data).toBeNull()
    }
    const failed = new WidgetStore(manifest, async () => { throw new Error('SQL password at /srv/private.ts') })
    await failed.load()
    expect(failed.snapshot.error).toBe('Unable to load widget')
  })

  it('uses server-resolved widget data without a duplicate client request', () => {
    const loader = vi.fn(async () => ({ data: null, status: 'ready' as const }))
    const store = new WidgetStore(manifest, loader, {
      initialResult: { data: { stats: [{ id: 'posts', value: '3' }] }, status: 'ready' },
    })

    expect(store.snapshot).toMatchObject({ data: { stats: [{ id: 'posts', value: '3' }] }, loading: false, status: 'ready' })
    expect(loader).not.toHaveBeenCalled()
  })

  it('loads lazily, exposes unauthorized state without data, and reports errors', async () => {
    const loader = vi.fn(async () => ({ status: 'unauthorized' as const }))
    const store = new WidgetStore(manifest, loader)
    expect(store.snapshot.status).toBe('idle')
    await store.activate()
    expect(store.snapshot).toMatchObject({ data: null, loading: false, status: 'unauthorized' })

    const failed = new WidgetStore({ ...manifest, polling: { enabled: false, interval: null } }, async () => { throw new Error('Network unavailable') })
    await failed.load()
    expect(failed.snapshot).toMatchObject({ error: 'Unable to load widget', status: 'error' })
  })

  it('cancels stale requests during filter changes and keeps the latest filtered data', async () => {
    const requests: { filter: JsonValue, resolve: (value: { readonly data: JsonValue, readonly status: 'ready' }) => void, signal: AbortSignal }[] = []
    const store = new WidgetStore(manifest, async (_id, filters, signal) => new Promise(resolve => {
      requests.push({ filter: filters.period ?? null, resolve, signal })
    }))
    const first = store.load()
    const second = store.setFilter('period', 'year')
    expect(requests[0]?.signal.aborted).toBe(true)
    requests[1]?.resolve({ data: { value: 120 }, status: 'ready' })
    await second
    requests[0]?.resolve({ data: { value: 1 }, status: 'ready' })
    await first
    expect(store.snapshot).toMatchObject({ data: { value: 120 }, filters: { period: 'year' }, status: 'ready' })
  })

  it('persists only allow-listed filters in panel, dashboard, and widget scope', async () => {
    const storage = new MemoryStorage()
    const persistence = new WidgetFilterPersistence(storage, 'admin', 'overview', 'sales')
    persistence.write({ injected: true, period: 'year' }, manifest.filters)
    expect(persistence.read(manifest.filters)).toEqual({ period: 'year' })
    const store = new WidgetStore(manifest, async () => ({ data: [], status: 'ready' }), { persistence })
    expect(store.snapshot.filters).toEqual({ period: 'year' })
    await store.resetFilters()
    expect(store.snapshot.filters).toEqual({ period: 'month' })
    expect(storage.values.size).toBe(0)
  })

  it('starts one polling loop and cancels both polling and in-flight loading on stop', async () => {
    const scheduler = new TestScheduler()
    const signals: AbortSignal[] = []
    const store = new WidgetStore(manifest, async (_id, _filters, requestSignal) => new Promise(() => {
      signals.push(requestSignal)
    }), { scheduler })
    void store.activate()
    store.startPolling()
    expect(scheduler.every).toHaveBeenCalledOnce()
    expect(scheduler.every).toHaveBeenCalledWith(expect.any(Function), 5_000)
    store.stop()
    expect(signals[0]?.aborted).toBe(true)
    expect(scheduler.clear).toHaveBeenCalledOnce()
    expect(store.snapshot).toMatchObject({ loading: false, status: 'idle' })
  })

  it('resolves responsive layout without placing spans outside the grid', () => {
    expect(resolveWidgetGrid([manifest], 1280)).toEqual([{ columnSpan: 2, columnStart: 3, columns: 4, widgetId: 'sales' }])
    expect(resolveWidgetGrid([manifest], 800)).toEqual([{ columnSpan: 2, columnStart: null, columns: 2, widgetId: 'sales' }])
    expect(resolveWidgetGrid([manifest], 500)).toEqual([{ columnSpan: 1, columnStart: null, columns: 1, widgetId: 'sales' }])
    expect(resolveWidgetGrid([{ ...manifest, layout: { columnSpan: 'full', columnStart: null } }], 1280)[0]?.columnSpan).toBe(4)
  })
})
