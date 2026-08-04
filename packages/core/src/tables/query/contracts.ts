export type TableQueryScalar = string | number | boolean | null
export type TableRecordIdentifier = string | number
export type TableFilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'in' | 'not-in' | 'between' | 'null' | 'not-null'
export type TableSortDirection = 'asc' | 'desc'
export type TablePaginationMode = 'page' | 'simple' | 'cursor' | 'all'
export type TableAggregateKind = 'count' | 'exists' | 'sum' | 'avg' | 'min' | 'max'

export interface TableQuerySort {
  readonly column: string
  readonly direction: TableSortDirection
}

export interface TableQueryFilter {
  readonly id: string
  readonly operator: TableFilterOperator
  readonly value?: TableQueryScalar | readonly TableQueryScalar[]
}

export interface TableQueryState {
  readonly pagination: TablePaginationMode
  readonly page?: number
  readonly perPage?: number | 'all'
  readonly cursor?: string | null
  readonly search?: string
  readonly sort?: readonly TableQuerySort[]
  readonly filters?: readonly TableQueryFilter[]
  readonly visibleColumns?: readonly string[]
  readonly includeTotal?: boolean
}

export interface TableQueryColumnDefinition {
  readonly column: string
  readonly searchable?: boolean
  readonly sortable?: boolean
  readonly relation?: string
  readonly aggregate?: TableQueryAggregateDefinition
}

export interface TableQueryAggregateDefinition {
  readonly kind: TableAggregateKind
  readonly relation: string
  readonly column?: string
}

export interface TableQueryFilterDefinition {
  readonly column: string
  readonly operators: readonly TableFilterOperator[]
}

export interface HoloPaginationMeta {
  readonly total: number
  readonly perPage: number
  readonly currentPage: number
  readonly lastPage: number
  readonly hasMorePages: boolean
}

export interface HoloPaginatedResult<TRecord> {
  readonly data: readonly TRecord[]
  readonly meta: HoloPaginationMeta
}

export interface HoloSimplePaginationMeta {
  readonly perPage: number
  readonly currentPage: number
  readonly hasMorePages: boolean
}

export interface HoloSimplePaginatedResult<TRecord> {
  readonly data: readonly TRecord[]
  readonly meta: HoloSimplePaginationMeta
}

export interface HoloCursorPaginatedResult<TRecord> {
  readonly data: readonly TRecord[]
  readonly perPage: number
  readonly nextCursor: string | null
  readonly prevCursor: string | null
}

export interface HoloTableQuery<TQuery, TRecord> {
  where(column: string, operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like', value: TableQueryScalar): TQuery
  whereAny(columns: readonly string[], operator: 'like', value: string): TQuery
  whereIn(column: string, values: readonly TableQueryScalar[]): TQuery
  whereNotIn(column: string, values: readonly TableQueryScalar[]): TQuery
  whereBetween(column: string, range: readonly [TableQueryScalar, TableQueryScalar]): TQuery
  whereNull(column: string): TQuery
  whereNotNull(column: string): TQuery
  orderBy(column: string, direction: TableSortDirection): TQuery
  with(...relations: readonly string[]): TQuery
  withCount(...relations: readonly string[]): TQuery
  withExists(...relations: readonly string[]): TQuery
  withSum(relation: string, column: string): TQuery
  withAvg(relation: string, column: string): TQuery
  withMin(relation: string, column: string): TQuery
  withMax(relation: string, column: string): TQuery
  limit(value: number): TQuery
  get(): Promise<readonly TRecord[]>
  first(): Promise<TRecord | undefined>
  count(): Promise<number>
  paginate(perPage: number, page: number): Promise<HoloPaginatedResult<TRecord>>
  simplePaginate(perPage: number, page: number): Promise<HoloSimplePaginatedResult<TRecord>>
  cursorPaginate(perPage: number, cursor: string | null): Promise<HoloCursorPaginatedResult<TRecord>>
}

export interface TableQueryDefinition<TQuery, TContext> {
  readonly primaryKey: string
  readonly columns: Readonly<Record<string, TableQueryColumnDefinition>>
  readonly filters?: Readonly<Record<string, TableQueryFilterDefinition>>
  readonly eagerLoads?: readonly string[]
  readonly defaultSort?: readonly TableQuerySort[]
  readonly maxPerPage?: number
  readonly maxPage?: number
  readonly maxSearchLength?: number
  readonly maxCursorLength?: number
  readonly allowAll?: boolean
  readonly maxAllRecords?: number
  readonly maxSelectionRecords?: number
  createQuery(): TQuery
  applyResourceScope(query: TQuery, context: TContext): TQuery
  applyTenantScope(query: TQuery, context: TContext): TQuery
}

export type TableSelection<TRecordId extends TableRecordIdentifier> =
  | { readonly mode: 'explicit', readonly recordIds: readonly TRecordId[] }
  | { readonly mode: 'all-matching', readonly excludedRecordIds: readonly TRecordId[] }

export interface PageTableQueryResult<TRecord> {
  readonly mode: 'page'
  readonly records: readonly TRecord[]
  readonly total: number
  readonly page: number
  readonly perPage: number
  readonly lastPage: number
  readonly hasMore: boolean
}

export interface SimpleTableQueryResult<TRecord> {
  readonly mode: 'simple'
  readonly records: readonly TRecord[]
  readonly total?: number
  readonly page: number
  readonly perPage: number
  readonly hasMore: boolean
}

export interface CursorTableQueryResult<TRecord> {
  readonly mode: 'cursor'
  readonly records: readonly TRecord[]
  readonly total?: number
  readonly perPage: number
  readonly nextCursor: string | null
  readonly previousCursor: string | null
}

export interface AllTableQueryResult<TRecord> {
  readonly mode: 'all'
  readonly records: readonly TRecord[]
  readonly total: number
}

export type TableQueryResult<TRecord> =
  | PageTableQueryResult<TRecord>
  | SimpleTableQueryResult<TRecord>
  | CursorTableQueryResult<TRecord>
  | AllTableQueryResult<TRecord>
