import { describe, expect, it } from 'vitest'
import { toJsonValue } from '@holo-js/panels-core'
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

    const selection = store.selectionPayload()
    store.setSearch('changed query')
    store.setFilter('status', 'draft')
    store.setSort([{ column: 'title', direction: 'desc' }])
    store.setPage(3)
    expect(store.selectionPayload()).toEqual(selection)
    store.clearSelection()
    expect(store.selectionPayload()).toEqual({ mode: 'explicit', recordIds: [] })
  })

  it('preserves explicit selections while the user changes pages, filters, search, and sorting', () => {
    const store = table()
    store.selectPage(['1', '3'])
    store.setPage(2)
    store.setFilter('status', 'published')
    store.setSearch('second page')
    store.setSort([{ column: 'title', direction: 'asc' }])
    store.selectRecord('8')

    expect(store.snapshot.selection).toEqual({
      mode: 'explicit',
      selectedRecordIds: ['1', '3', '8'],
      excludedRecordIds: [],
    })
    expect(store.selectionPayload()).toEqual({ mode: 'explicit', recordIds: ['1', '3', '8'] })
  })

  it('keeps matching membership separate from additional selections in another filter view', () => {
    const store = table()
    store.setFilter('status', 'published')
    store.selectAllMatching()
    store.selectRecord('excluded', false)
    store.setFilter('status', 'draft')
    expect(store.isSelected('draft')).toBe(false)
    const selection = store.selectionPayload()
    store.applyData({ queryVersion: store.query.queryVersion, records: [{ id: 'overlap', title: 'Overlap' }], total: 1, selection: { key: JSON.stringify(toJsonValue(selection)), matchingRecordIds: ['overlap'] } })
    expect(store.isSelected('overlap')).toBe(true)
    store.selectRecord('draft')
    expect(store.selectionPayload()).toMatchObject({ mode: 'all-matching', recordIds: ['draft'], excludedRecordIds: ['excluded'], query: { filters: { status: 'published' } } })
    store.selectRecord('draft', false)
    expect(store.isSelected('draft')).toBe(false)
    expect(store.selectionPayload()).toMatchObject({ excludedRecordIds: ['excluded'] })
  })

  it('enforces maximum, current-page, and group-only selections through the store', () => {
    const limited = new TableStateStore<Row>({ panelId: 'admin', tableId: 'posts', total: 10, selection: { maximum: 2 } })
    limited.selectPage(['1', '2', '3'])
    limited.selectRecord('4')
    expect(limited.selectionPayload()).toEqual({ mode: 'explicit', recordIds: ['1', '2'] })
    expect(limited.canSelectAllMatching).toBe(false)
    limited.selectAllMatching()
    expect(limited.selectionPayload()).toEqual({ mode: 'explicit', recordIds: ['1', '2'] })
    const page = new TableStateStore<Row>({ panelId: 'admin', tableId: 'posts', selection: { currentPageOnly: true } })
    const firstPageQuery = page.toQueryString()
    page.selectPage(['1'])
    expect(page.canSelectAllMatching).toBe(false)
    page.setPage(2)
    expect(page.selectionPayload()).toEqual({ mode: 'explicit', recordIds: [] })
    page.selectRecord('2')
    page.restoreFromQuery(firstPageQuery)
    expect(page.selectionPayload()).toEqual({ mode: 'explicit', recordIds: [] })
    const grouped = new TableStateStore<Row>({ panelId: 'admin', tableId: 'posts', selection: { groupsOnly: true } })
    grouped.selectPage(['1', '2'])
    expect(grouped.selectionPayload()).toEqual({ mode: 'explicit', recordIds: [] })
    grouped.selectGroup(['1', '2'], 'first')
    grouped.selectRecord('3', true, 'second')
    expect(grouped.selectionPayload()).toEqual({ mode: 'explicit', recordIds: ['3'] })
  })

  it('counts exclusions against the captured total and limits additions from another view', () => {
    const store = new TableStateStore<Row>({ panelId: 'admin', tableId: 'posts', total: 2, selection: { maximum: 2 } })
    store.selectAllMatching()
    store.selectRecord('1', false)
    store.setSearch('another view')
    store.applyData({ queryVersion: store.query.queryVersion, records: [], total: 20 })
    expect(store.selectedCount).toBe(1)
    store.selectPage(['3', '4'])
    expect(store.selectionPayload()).toMatchObject({ recordIds: ['3'], excludedRecordIds: ['1'] })
    expect(store.selectedCount).toBe(2)
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
