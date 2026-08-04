import { describe, expect, it, vi } from 'vitest'
import type { ClientNavigationManifest } from '../src/navigation/contracts'
import { NavigationStore } from '../src/navigation/store'
import type { ClientSearchResponse } from '../src/search/contracts'
import { GlobalSearchStore } from '../src/search/store'

const manifest: ClientNavigationManifest = {
  activeItemId: 'dashboard',
  clusters: [{ active: false, collapsible: true, id: 'content', label: 'Content', sort: 20 }],
  collapsible: true,
  groups: [{ active: false, id: 'Publishing', label: 'Publishing', sort: 20 }],
  items: [
    { active: true, badge: null, cluster: null, group: null, icon: 'home', id: 'dashboard', kind: 'dashboard', label: 'Dashboard', parent: null, path: '/admin', sort: 10, variant: null },
    { active: false, badge: '2', cluster: 'content', group: 'Publishing', icon: 'document', id: 'posts', kind: 'resource', label: 'Posts', parent: null, path: '/admin/posts', sort: 20, variant: null },
  ],
  layout: 'sidebar',
  panelId: 'admin',
  panels: [
    { active: true, icon: null, id: 'admin', label: 'Admin', path: '/admin', sort: 10 },
    { active: false, icon: null, id: 'vendor', label: 'Vendor', path: '/vendor', sort: 20 },
  ],
}

describe('P11-A client navigation', () => {
  it('supports responsive collapse, sections, active routes, keyboard navigation, and authorized panel switching', () => {
    const store = new NavigationStore(manifest, 500)
    const states: boolean[] = []
    const unsubscribe = store.subscribe(state => states.push(state.menuOpen))
    expect(store.snapshot.menuOpen).toBe(false)
    store.toggleMenu()
    expect(store.snapshot.menuOpen).toBe(true)
    store.key('ArrowDown')
    expect(store.snapshot.focusedItemId).toBe('posts')
    expect(store.key('Enter')).toBe('/admin/posts')
    store.toggleGroup('Publishing')
    expect(store.visibleItems.map(item => item.id)).toEqual(['dashboard'])
    store.toggleGroup('Publishing')
    store.toggleCluster('content')
    expect(store.visibleItems.map(item => item.id)).toEqual(['dashboard'])
    store.key('Escape')
    expect(store.snapshot.menuOpen).toBe(false)
    store.setViewport(1280)
    expect(store.snapshot.menuOpen).toBe(true)
    store.activePath('/admin/posts/1/edit')
    expect(store.snapshot.focusedItemId).toBe('posts')
    expect(store.switchPanel('vendor')).toBe('/vendor')
    expect(() => store.switchPanel('secret')).toThrow('unauthorized')
    unsubscribe()
    expect(states).toContain(true)
  })
})

describe('P11-B client global search', () => {
  it('debounces requests, ignores stale responses, enforces lengths, and supports keyboard selection', async () => {
    vi.useFakeTimers()
    const resolvers: Array<(response: ClientSearchResponse) => void> = []
    const search = vi.fn((_term: string, _signal: AbortSignal) => new Promise<ClientSearchResponse>(resolve => resolvers.push(resolve)))
    const store = new GlobalSearchStore({ search }, { debounceMilliseconds: 100, maximumLength: 20, minimumLength: 2 })
    const observed: string[] = []
    const unsubscribe = store.subscribe(state => observed.push(state.term))

    expect(store.shortcut('k', { ctrl: true, meta: false })).toBe(true)
    store.input('a')
    await vi.advanceTimersByTimeAsync(100)
    expect(search).not.toHaveBeenCalled()
    store.input('first')
    await vi.advanceTimersByTimeAsync(100)
    store.input('second')
    await vi.advanceTimersByTimeAsync(100)
    expect(search.mock.calls.map(([term]) => term)).toEqual(['first', 'second'])

    resolvers[1]?.({ panelId: 'admin', results: [
      { actions: [], details: {}, icon: null, id: '2', image: null, resourceId: 'posts', title: 'Second', url: '/admin/posts/2' },
      { actions: [], details: {}, icon: null, id: '3', image: null, resourceId: 'posts', title: 'Third', url: '/admin/posts/3' },
    ], term: 'second' })
    await Promise.resolve()
    resolvers[0]?.({ panelId: 'admin', results: [{ actions: [], details: {}, icon: null, id: '1', image: null, resourceId: 'posts', title: 'First', url: '/admin/posts/1' }], term: 'first' })
    await Promise.resolve()
    expect(store.snapshot.results.map(result => result.title)).toEqual(['Second', 'Third'])
    store.move(1)
    expect(store.selectedUrl()).toBe('/admin/posts/3')
    store.close()
    expect(store.snapshot.open).toBe(false)
    unsubscribe()
    expect(observed).toContain('second')
    vi.useRealTimers()
  })
})
