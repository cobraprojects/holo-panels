import { toJsonValue, type JsonValue } from '@holo-js/panels-core'
import type {
  TableDataResponse,
  TableGrouping,
  TableQuerySnapshot,
  TableRecordId,
  TableSelection,
  TableSelectionPayload,
  TableSort,
  TableState,
  TableStateError,
  TableStateListener,
  TableStateOptions,
} from './contracts'
import { assertTableColumnIdentifier, assertTableIdentifier, restoreTableQuery, serializeTableQuery } from './query-parameters'

function uniqueSorted<TValue extends TableRecordId>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...new Set(values)].sort((left, right) => String(left).localeCompare(String(right))))
}

function emptySelection<TRecordId extends TableRecordId>(): TableSelection<TRecordId> {
  return Object.freeze({ mode: 'explicit', selectedRecordIds: Object.freeze([]), excludedRecordIds: Object.freeze([]) })
}

function freezeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJsonValue)) as JsonValue
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeJsonValue(child)])))
  }
  return value
}

function freezeFilters(filters: Readonly<Record<string, JsonValue>>): Readonly<Record<string, JsonValue>> {
  return Object.freeze(Object.fromEntries(Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, freezeJsonValue(value)])))
}

function freezeState<TRecord extends object, TRecordId extends TableRecordId>(
  state: TableState<TRecord, TRecordId>,
): TableState<TRecord, TRecordId> {
  return Object.freeze({
    ...state,
    sort: Object.freeze(state.sort.map(item => Object.freeze({ ...item }))),
    filters: Object.freeze({
      mode: state.filters.mode,
      applied: freezeFilters(state.filters.applied),
      draft: freezeFilters(state.filters.draft),
    }),
    grouping: state.grouping ? Object.freeze({ ...state.grouping }) : null,
    visibleColumns: Object.freeze([...state.visibleColumns]),
    selection: Object.freeze({
      mode: state.selection.mode,
      selectedRecordIds: Object.freeze([...state.selection.selectedRecordIds]),
      excludedRecordIds: Object.freeze([...state.selection.excludedRecordIds]),
    }),
    error: state.error ? Object.freeze({ ...state.error }) : null,
    records: Object.freeze([...state.records]),
  })
}

export class TableStateStore<TRecord extends object, TRecordId extends TableRecordId = string> {
  #state: TableState<TRecord, TRecordId>
  #selectionQuery: Omit<TableQuerySnapshot, 'page' | 'queryVersion'> | null = null
  readonly #matchingRecordIds = new Set<TableRecordId>()
  readonly selectionSettings: Readonly<{ currentPageOnly: boolean, groupsOnly: boolean, maximum: number | null }>
  #selectedGroup: string | null = null
  #matchingTotal = 0
  readonly #listeners = new Set<TableStateListener<TRecord, TRecordId>>()

  constructor(options: TableStateOptions<TRecord>) {
    const maximum = options.selection?.maximum ?? null
    if (maximum !== null && (!Number.isSafeInteger(maximum) || maximum < 1)) throw new Error('[Holo Panels] Maximum selection must be a positive integer.')
    this.selectionSettings = Object.freeze({ currentPageOnly: options.selection?.currentPageOnly ?? false, groupsOnly: options.selection?.groupsOnly ?? false, maximum })
    assertTableIdentifier(options.panelId, 'panel')
    assertTableIdentifier(options.tableId, 'table')
    const perPage = options.perPage ?? 25
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 500) {
      throw new Error('[Holo Panels] Table page size must be an integer from 1 to 500.')
    }
    if (!Number.isSafeInteger(options.total ?? 0) || (options.total ?? 0) < 0) {
      throw new Error('[Holo Panels] Table totals must be non-negative safe integers.')
    }
    for (const column of options.visibleColumns ?? []) assertTableColumnIdentifier(column)
    this.#state = freezeState({
      panelId: options.panelId,
      tableId: options.tableId,
      page: 1,
      perPage,
      search: '',
      sort: [],
      filters: { mode: options.filterMode ?? 'live', applied: {}, draft: {} },
      grouping: null,
      visibleColumns: uniqueSorted(options.visibleColumns ?? []),
      selection: emptySelection(),
      loading: false,
      error: null,
      queryVersion: 0,
      records: options.records ?? [],
      total: options.total ?? 0,
    })
  }

  get snapshot(): TableState<TRecord, TRecordId> {
    return this.#state
  }

  get canSelectAllMatching(): boolean {
    return !this.selectionSettings.currentPageOnly && !this.selectionSettings.groupsOnly
      && (this.selectionSettings.maximum === null || this.#state.total <= this.selectionSettings.maximum)
  }

  get selectedCount(): number {
    if (this.#state.selection.mode === 'explicit') return this.#state.selection.selectedRecordIds.length
    return Math.max(0, this.#matchingTotal - this.#state.selection.excludedRecordIds.length)
      + this.#state.selection.selectedRecordIds.filter(id => !this.#matchingRecordIds.has(id)).length
  }

  canSelectRecord(recordId: TRecordId): boolean {
    return this.isSelected(recordId) || this.selectionSettings.maximum === null
      || this.selectedCount < this.selectionSettings.maximum
  }

  get query(): TableQuerySnapshot {
    const state = this.#state
    return Object.freeze({
      panelId: state.panelId,
      tableId: state.tableId,
      page: state.page,
      perPage: state.perPage,
      search: state.search,
      sort: state.sort,
      filters: state.filters.applied,
      grouping: state.grouping,
      visibleColumns: state.visibleColumns,
      queryVersion: state.queryVersion,
    })
  }

  subscribe(listener: TableStateListener<TRecord, TRecordId>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setPage(page: number): void {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('[Holo Panels] Table pages must be positive integers.')
    if (page === this.#state.page) return
    this.#invalidate({ page }, this.selectionSettings.currentPageOnly)
  }

  setPerPage(perPage: number): void {
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 500) {
      throw new Error('[Holo Panels] Table page size must be an integer from 1 to 500.')
    }
    if (perPage === this.#state.perPage) return
    this.#invalidate({ perPage, page: 1 }, this.selectionSettings.currentPageOnly)
  }

  setSearch(search: string): void {
    const normalized = search.trim().slice(0, 500)
    if (normalized === this.#state.search) return
    this.#invalidate({ search: normalized, page: 1 }, this.#queryChangeResetsSelection())
  }

  setSort(sort: readonly TableSort[]): void {
    const columns = new Set<string>()
    for (const item of sort) {
      assertTableColumnIdentifier(item.column)
      if (item.direction !== 'asc' && item.direction !== 'desc') throw new Error('[Holo Panels] Invalid table sort direction.')
      if (columns.has(item.column)) throw new Error(`[Holo Panels] Duplicate table sort column "${item.column}".`)
      columns.add(item.column)
    }
    const normalized = sort.map(item => Object.freeze({ ...item }))
    if (JSON.stringify(normalized) === JSON.stringify(this.#state.sort)) return
    this.#invalidate({ sort: normalized, page: 1 }, this.#queryChangeResetsSelection())
  }

  setGrouping(grouping: TableGrouping | null): void {
    if (grouping) {
      assertTableColumnIdentifier(grouping.column)
      if (grouping.direction !== 'asc' && grouping.direction !== 'desc') throw new Error('[Holo Panels] Invalid table grouping direction.')
    }
    if (JSON.stringify(grouping) === JSON.stringify(this.#state.grouping)) return
    this.#invalidate({ grouping, page: 1 }, this.#queryChangeResetsSelection())
  }

  setVisibleColumns(columns: readonly string[]): void {
    for (const column of columns) assertTableColumnIdentifier(column)
    const visibleColumns = uniqueSorted(columns)
    if (JSON.stringify(visibleColumns) === JSON.stringify(this.#state.visibleColumns)) return
    this.#invalidate({ visibleColumns }, false)
  }

  setFilter(filterId: string, value: JsonValue): void {
    assertTableColumnIdentifier(filterId)
    const normalized = toJsonValue(value)
    const draft = freezeFilters({ ...this.#state.filters.draft, [filterId]: normalized })
    if (this.#state.filters.mode === 'deferred') {
      this.#publish({ ...this.#state, filters: { ...this.#state.filters, draft } })
      return
    }
    const applied = draft
    this.#invalidate({ filters: { ...this.#state.filters, applied, draft }, page: 1 }, this.#queryChangeResetsSelection())
  }

  removeFilter(filterId: string): void {
    assertTableColumnIdentifier(filterId)
    const draft = { ...this.#state.filters.draft }
    delete draft[filterId]
    const frozenDraft = freezeFilters(draft)
    if (this.#state.filters.mode === 'deferred') {
      this.#publish({ ...this.#state, filters: { ...this.#state.filters, draft: frozenDraft } })
      return
    }
    this.#invalidate({ filters: { ...this.#state.filters, applied: frozenDraft, draft: frozenDraft }, page: 1 }, this.#queryChangeResetsSelection())
  }

  applyDeferredFilters(): void {
    if (this.#state.filters.mode !== 'deferred') return
    if (JSON.stringify(this.#state.filters.applied) === JSON.stringify(this.#state.filters.draft)) return
    this.#invalidate({
      filters: { ...this.#state.filters, applied: this.#state.filters.draft },
      page: 1,
    }, this.#queryChangeResetsSelection())
  }

  resetFilters(): void {
    if (Object.keys(this.#state.filters.applied).length === 0 && Object.keys(this.#state.filters.draft).length === 0) return
    this.#invalidate({ filters: { ...this.#state.filters, applied: {}, draft: {} }, page: 1 }, this.#queryChangeResetsSelection())
  }

  selectRecord(recordId: TRecordId, selected = true, groupKey?: string): void {
    if (selected && !this.#selectGroupScope(groupKey)) return
    if (selected && !this.canSelectRecord(recordId)) return
    if (this.#state.selection.mode === 'all-matching') {
      const excluded = new Set(this.#state.selection.excludedRecordIds)
      const included = new Set(this.#state.selection.selectedRecordIds)
      if (this.#matchesSelection(recordId)) {
        if (selected) excluded.delete(recordId)
        else excluded.add(recordId)
      } else if (selected) included.add(recordId)
      else included.delete(recordId)
      this.#setSelection({ mode: 'all-matching', selectedRecordIds: uniqueSorted([...included]), excludedRecordIds: uniqueSorted([...excluded]) })
      return
    }
    const selectedIds = new Set(this.#state.selection.selectedRecordIds)
    if (selected) selectedIds.add(recordId)
    else selectedIds.delete(recordId)
    this.#setSelection({ mode: 'explicit', selectedRecordIds: uniqueSorted([...selectedIds]), excludedRecordIds: [] })
  }

  selectPage(recordIds: readonly TRecordId[], selected = true, groupKey?: string): void {
    if (selected && !this.#selectGroupScope(groupKey)) return
    if (this.#state.selection.mode === 'all-matching') {
      const excluded = new Set(this.#state.selection.excludedRecordIds)
      const included = new Set(this.#state.selection.selectedRecordIds)
      for (const recordId of recordIds) {
        if (this.#matchesSelection(recordId)) {
          if (selected) excluded.delete(recordId)
          else excluded.add(recordId)
        } else if (!selected) included.delete(recordId)
        else if (this.selectionSettings.maximum === null || this.#matchingTotal - excluded.size + included.size < this.selectionSettings.maximum) included.add(recordId)
      }
      this.#setSelection({ mode: 'all-matching', selectedRecordIds: uniqueSorted([...included]), excludedRecordIds: uniqueSorted([...excluded]) })
      return
    }
    const selectedIds = new Set(this.#state.selection.selectedRecordIds)
    for (const recordId of recordIds) {
      if (!selected) selectedIds.delete(recordId)
      else if (this.selectionSettings.maximum === null || selectedIds.size < this.selectionSettings.maximum) selectedIds.add(recordId)
    }
    this.#setSelection({ mode: 'explicit', selectedRecordIds: uniqueSorted([...selectedIds]), excludedRecordIds: [] })
  }

  selectAllMatching(): void {
    if (!this.canSelectAllMatching) return
    const { page: _page, queryVersion: _queryVersion, ...query } = this.query
    this.#selectionQuery = Object.freeze(query)
    this.#matchingTotal = this.#state.total
    this.#matchingRecordIds.clear()
    this.#setSelection({ mode: 'all-matching', selectedRecordIds: [], excludedRecordIds: [] })
  }

  clearSelection(): void {
    this.#selectionQuery = null
    this.#matchingRecordIds.clear()
    this.#selectedGroup = null
    this.#setSelection(emptySelection())
  }

  selectGroup(recordIds: readonly TRecordId[], groupKey: string, selected = true): void {
    this.selectPage(recordIds, selected, groupKey)
  }

  isSelected(recordId: TRecordId): boolean {
    if (this.#state.selection.mode === 'all-matching') return this.#state.selection.selectedRecordIds.includes(recordId) || this.#matchesSelection(recordId) && !this.#state.selection.excludedRecordIds.includes(recordId)
    return this.#state.selection.selectedRecordIds.includes(recordId)
  }

  selectionPayload(): TableSelectionPayload<TRecordId> {
    if (this.#state.selection.mode === 'explicit') {
      return Object.freeze({ mode: 'explicit', recordIds: this.#state.selection.selectedRecordIds })
    }
    if (!this.#selectionQuery) throw new Error('[Holo Panels] All-matching selection requires a captured query.')
    return Object.freeze({
      mode: 'all-matching',
      ...(this.#state.selection.selectedRecordIds.length ? { recordIds: this.#state.selection.selectedRecordIds } : {}),
      excludedRecordIds: this.#state.selection.excludedRecordIds,
      query: this.#selectionQuery,
    })
  }

  applyData(response: TableDataResponse<TRecord>): boolean {
    if (response.queryVersion !== this.#state.queryVersion) return false
    if (!Number.isSafeInteger(response.total) || response.total < 0) {
      throw new Error('[Holo Panels] Table totals must be non-negative safe integers.')
    }
    if (response.selection?.key === JSON.stringify(toJsonValue(this.selectionPayload())) && Array.isArray(response.selection.matchingRecordIds)) {
      for (const recordId of response.selection.matchingRecordIds) {
        if (typeof recordId === 'number' || typeof recordId === 'string') this.#matchingRecordIds.add(recordId)
      }
    }
    this.#publish({
      ...this.#state,
      records: response.records,
      total: response.total,
      loading: false,
      error: null,
    })
    return true
  }

  applyError(queryVersion: number, error: TableStateError): boolean {
    if (queryVersion !== this.#state.queryVersion) return false
    this.#publish({ ...this.#state, loading: false, error })
    return true
  }

  toQueryString(): string {
    return serializeTableQuery(this.query)
  }

  restoreFromQuery(parameters: URLSearchParams | string): void {
    const restored = restoreTableQuery(parameters, this.#state.panelId, this.#state.tableId)
    if (!restored.present) return
    const appliedFilters = restored.filters ?? {}
    const page = restored.page ?? 1
    const perPage = restored.perPage ?? this.#state.perPage
    const search = restored.search ?? ''
    const sort = restored.sort ?? []
    const grouping = restored.grouping ?? null
    const visibleColumns = restored.visibleColumns ?? this.#state.visibleColumns
    const queryChanged = page !== this.#state.page
      || perPage !== this.#state.perPage
      || search !== this.#state.search
      || JSON.stringify(sort) !== JSON.stringify(this.#state.sort)
      || JSON.stringify(grouping) !== JSON.stringify(this.#state.grouping)
      || JSON.stringify(visibleColumns) !== JSON.stringify(this.#state.visibleColumns)
      || JSON.stringify(appliedFilters) !== JSON.stringify(this.#state.filters.applied)
    if (!queryChanged) return
    const selectionChanged = this.#queryChangeResetsSelection() && (page !== this.#state.page
      || perPage !== this.#state.perPage
      || search !== this.#state.search
      || JSON.stringify(sort) !== JSON.stringify(this.#state.sort)
      || JSON.stringify(grouping) !== JSON.stringify(this.#state.grouping)
      || JSON.stringify(appliedFilters) !== JSON.stringify(this.#state.filters.applied))
    this.#invalidate({
      page,
      perPage,
      search,
      sort,
      filters: { ...this.#state.filters, applied: appliedFilters, draft: appliedFilters },
      grouping,
      visibleColumns,
    }, selectionChanged)
  }

  #setSelection(selection: TableSelection<TRecordId>): void {
    this.#publish({ ...this.#state, selection })
  }

  #queryChangeResetsSelection(): boolean {
    return this.selectionSettings.currentPageOnly
  }

  #selectGroupScope(groupKey: string | undefined): boolean {
    if (!this.selectionSettings.groupsOnly) return true
    if (groupKey === undefined) return false
    if (this.#selectedGroup !== groupKey) {
      this.clearSelection()
      this.#selectedGroup = groupKey
    }
    return true
  }

  #matchesSelection(recordId: TRecordId): boolean {
    return this.#matchingRecordIds.has(recordId) || this.#selectionQuery !== null
      && this.#selectionQuery.search === this.#state.search
      && JSON.stringify(this.#selectionQuery.filters) === JSON.stringify(this.#state.filters.applied)
  }

  #invalidate(
    changes: Partial<Pick<TableState<TRecord, TRecordId>, 'filters' | 'grouping' | 'page' | 'perPage' | 'search' | 'sort' | 'visibleColumns'>>,
    resetSelection: boolean,
  ): void {
    this.#publish({
      ...this.#state,
      ...changes,
      selection: resetSelection ? emptySelection() : this.#state.selection,
      loading: true,
      error: null,
      queryVersion: this.#state.queryVersion + 1,
    })
  }

  #publish(state: TableState<TRecord, TRecordId>): void {
    const previous = this.#state
    const next = freezeState(state)
    this.#state = next
    for (const listener of this.#listeners) listener(next, previous)
  }
}
