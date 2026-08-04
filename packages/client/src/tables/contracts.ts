import type { JsonValue } from '@holo-js/panels-core'

export type TableSortDirection = 'asc' | 'desc'

export type TableSort = {
  readonly column: string
  readonly direction: TableSortDirection
}

export type TableGrouping = {
  readonly column: string
  readonly direction: TableSortDirection
}

export type TableFilterMode = 'deferred' | 'live'

export type TableFilters = {
  readonly applied: Readonly<Record<string, JsonValue>>
  readonly draft: Readonly<Record<string, JsonValue>>
  readonly mode: TableFilterMode
}

export type TableSelectionMode = 'all-matching' | 'explicit'

export type TableRecordId = number | string

export type TableSelection<TRecordId extends TableRecordId> = {
  readonly mode: TableSelectionMode
  readonly selectedRecordIds: readonly TRecordId[]
  readonly excludedRecordIds: readonly TRecordId[]
}

export type TableStateError = {
  readonly code: string
  readonly message: string
}

export type TableState<TRecord extends object, TRecordId extends TableRecordId> = {
  readonly panelId: string
  readonly tableId: string
  readonly page: number
  readonly perPage: number
  readonly search: string
  readonly sort: readonly TableSort[]
  readonly filters: TableFilters
  readonly grouping: TableGrouping | null
  readonly visibleColumns: readonly string[]
  readonly selection: TableSelection<TRecordId>
  readonly loading: boolean
  readonly error: TableStateError | null
  readonly queryVersion: number
  readonly records: readonly TRecord[]
  readonly total: number
}

export type TableStateListener<TRecord extends object, TRecordId extends TableRecordId> = (
  state: TableState<TRecord, TRecordId>,
  previous: TableState<TRecord, TRecordId>,
) => void

export type TableStateOptions<TRecord extends object> = {
  readonly panelId: string
  readonly tableId: string
  readonly perPage?: number
  readonly filterMode?: TableFilterMode
  readonly visibleColumns?: readonly string[]
  readonly records?: readonly TRecord[]
  readonly total?: number
}

export type TableDataResponse<TRecord extends object> = {
  readonly queryVersion: number
  readonly records: readonly TRecord[]
  readonly total: number
}

export type TableQuerySnapshot = {
  readonly panelId: string
  readonly tableId: string
  readonly page: number
  readonly perPage: number
  readonly search: string
  readonly sort: readonly TableSort[]
  readonly filters: Readonly<Record<string, JsonValue>>
  readonly grouping: TableGrouping | null
  readonly visibleColumns: readonly string[]
  readonly queryVersion: number
}

export type ExplicitTableSelection<TRecordId extends TableRecordId> = {
  readonly mode: 'explicit'
  readonly recordIds: readonly TRecordId[]
}

export type AllMatchingTableSelection<TRecordId extends TableRecordId> = {
  readonly mode: 'all-matching'
  readonly excludedRecordIds: readonly TRecordId[]
  readonly query: Omit<TableQuerySnapshot, 'page' | 'queryVersion'>
}

export type TableSelectionPayload<TRecordId extends TableRecordId> =
  | AllMatchingTableSelection<TRecordId>
  | ExplicitTableSelection<TRecordId>
