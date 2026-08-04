import { describe, expect, it } from 'vitest'
import { TableStateStore } from '../src/tables'

type Row = { readonly id: string, readonly title: string }

function table(tableId = 'posts', filterMode: 'deferred' | 'live' = 'live') {
  return new TableStateStore<Row, string>({
    panelId: 'admin',
    tableId,
    filterMode,
    visibleColumns: ['title', 'id'],
  })
}

describe('P4-B table query state', () => {
  it('tracks table query, request, data, loading, and error state', () => {
    const store = table()
    store.setSearch('  published posts  ')
    store.setPage(3)
    store.setSort([{ column: 'title', direction: 'desc' }])
    store.setGrouping({ column: 'category.name', direction: 'asc' })
    store.setVisibleColumns(['title'])

    expect(store.snapshot).toMatchObject({
      page: 1,
      search: 'published posts',
      loading: true,
      error: null,
      queryVersion: 5,
      grouping: { column: 'category.name', direction: 'asc' },
      visibleColumns: ['title'],
    })
    expect(store.applyData({ queryVersion: 5, records: [{ id: '1', title: 'First' }], total: 1 })).toBe(true)
    expect(store.snapshot).toMatchObject({ loading: false, total: 1, records: [{ id: '1', title: 'First' }] })
    store.setPage(2)
    expect(store.applyError(6, { code: 'offline', message: 'Connection unavailable' })).toBe(true)
    expect(store.snapshot.error).toEqual({ code: 'offline', message: 'Connection unavailable' })
  })

  it('applies live filters immediately and batches deferred filters on commit', () => {
    const live = table('live-posts')
    live.setFilter('status', 'published')
    expect(live.snapshot).toMatchObject({ queryVersion: 1, loading: true })
    expect(live.snapshot.filters.applied).toEqual({ status: 'published' })

    const deferred = table('deferred-posts', 'deferred')
    deferred.setFilter('status', 'draft')
    deferred.setFilter('author.id', 'actor-1')
    expect(deferred.snapshot).toMatchObject({ queryVersion: 0, loading: false })
    expect(deferred.snapshot.filters.applied).toEqual({})
    expect(deferred.snapshot.filters.draft).toEqual({ 'author.id': 'actor-1', status: 'draft' })

    deferred.applyDeferredFilters()
    expect(deferred.snapshot).toMatchObject({ queryVersion: 1, loading: true })
    expect(deferred.snapshot.filters.applied).toEqual({ 'author.id': 'actor-1', status: 'draft' })
  })

  it('defines explicit page and all-matching selection with exclusions', () => {
    const store = table()
    store.selectPage(['3', '1'])
    expect(store.snapshot.selection).toEqual({
      mode: 'explicit',
      selectedRecordIds: ['1', '3'],
      excludedRecordIds: [],
    })
    store.setPage(2)
    expect(store.snapshot.selection.selectedRecordIds).toEqual(['1', '3'])

    store.selectAllMatching()
    store.selectRecord('7', false)
    expect(store.isSelected('6')).toBe(true)
    expect(store.isSelected('7')).toBe(false)
    expect(store.selectionPayload()).toMatchObject({
      mode: 'all-matching',
      excludedRecordIds: ['7'],
      query: { panelId: 'admin', tableId: 'posts' },
    })
    expect(store.selectionPayload()).not.toHaveProperty('query.page')

    store.setSearch('changed query')
    expect(store.snapshot.selection).toEqual({ mode: 'explicit', selectedRecordIds: [], excludedRecordIds: [] })
  })

  it('does not let stale responses or stale errors replace newer state', () => {
    const store = table()
    store.setSearch('old')
    const oldVersion = store.snapshot.queryVersion
    store.setSearch('new')
    const newVersion = store.snapshot.queryVersion

    expect(store.applyData({ queryVersion: newVersion, records: [{ id: 'new', title: 'New' }], total: 1 })).toBe(true)
    expect(store.applyData({ queryVersion: oldVersion, records: [{ id: 'old', title: 'Old' }], total: 1 })).toBe(false)
    expect(store.applyError(oldVersion, { code: 'old', message: 'Old error' })).toBe(false)
    expect(store.snapshot.records[0]?.id).toBe('new')
    expect(store.snapshot.error).toBeNull()
  })

  it('publishes one immutable transition for a page selection', () => {
    const store = table()
    const transitions: number[] = []
    const unsubscribe = store.subscribe((state, previous) => {
      expect(Object.isFrozen(state)).toBe(true)
      expect(state).not.toBe(previous)
      transitions.push(state.selection.selectedRecordIds.length)
    })

    store.selectPage(['1', '2', '3'])
    unsubscribe()
    store.selectRecord('4')

    expect(transitions).toEqual([3])
  })

  it('serializes multiple table namespaces canonically without collision', () => {
    const posts = table('posts')
    const users = table('users')
    posts.setSearch('hello world')
    posts.setFilter('status', 'published')
    users.setSort([{ column: 'email', direction: 'asc' }])
    users.setPage(4)

    const combined = new URLSearchParams(posts.toQueryString())
    for (const [key, value] of new URLSearchParams(users.toQueryString())) combined.set(key, value)
    combined.sort()
    const query = combined.toString()
    expect(query).toContain('hp%5Badmin%5D%5Bposts%5D')
    expect(query).toContain('hp%5Badmin%5D%5Busers%5D')

    const restoredPosts = table('posts')
    const restoredUsers = table('users')
    restoredPosts.restoreFromQuery(query)
    restoredUsers.restoreFromQuery(query)
    expect(restoredPosts.snapshot).toMatchObject({ search: 'hello world', page: 1 })
    expect(restoredPosts.snapshot.filters.applied).toEqual({ status: 'published' })
    expect(restoredUsers.snapshot).toMatchObject({ page: 4, sort: [{ column: 'email', direction: 'asc' }] })
  })

  it('restores back and forward history snapshots as one versioned transition', () => {
    const store = table()
    const initial = store.toQueryString()
    store.setSearch('draft')
    store.setPage(3)
    const forward = store.toQueryString()

    store.restoreFromQuery(initial)
    expect(store.snapshot).toMatchObject({ search: '', page: 1, queryVersion: 3, loading: true })
    store.restoreFromQuery(forward)
    expect(store.snapshot).toMatchObject({ search: 'draft', page: 3, queryVersion: 4, loading: true })
  })
})
