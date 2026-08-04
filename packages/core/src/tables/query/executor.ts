import type {
  HoloCursorPaginatedResult,
  HoloPaginatedResult,
  HoloSimplePaginatedResult,
  HoloTableQuery,
  TableAggregateKind,
  TableFilterOperator,
  TableQueryAggregateDefinition,
  TableQueryDefinition,
  TableQueryFilter,
  TableQueryResult,
  TableQueryScalar,
  TableQueryState,
  TableRecordIdentifier,
  TableSelection,
} from './contracts'

const identifierPattern = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu
const defaultMaxPerPage = 100
const defaultMaxPage = 100_000
const defaultMaxSearchLength = 500
const defaultMaxCursorLength = 2_048
const defaultMaxAllRecords = 1_000
const defaultMaxSelectionRecords = 10_000

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`[Holo Panels] Invalid ${label} path "${value}".`)
}

function assertPositiveInteger(value: number, label: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`[Holo Panels] ${label} must be an integer from 1 to ${maximum}.`)
  }
}

function escapeLikeSearch(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function requireArray(value: TableQueryFilter['value'], operator: TableFilterOperator): readonly TableQueryScalar[] {
  if (!Array.isArray(value)) throw new Error(`[Holo Panels] Filter operator "${operator}" requires an array value.`)
  for (const item of value) assertScalar(item, `Filter operator "${operator}"`)
  return value
}

function requireScalar(value: TableQueryFilter['value'], operator: TableFilterOperator): TableQueryScalar {
  if (typeof value === 'undefined' || (typeof value === 'object' && value !== null)) {
    throw new Error(`[Holo Panels] Filter operator "${operator}" requires a scalar value.`)
  }
  assertScalar(value, `Filter operator "${operator}"`)
  return value
}

function assertScalar(value: TableQueryScalar, label: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`[Holo Panels] ${label} requires a finite number.`)
}

function assertRecordIdentifier(value: TableRecordIdentifier): void {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('[Holo Panels] Invalid table record identifier.')
  }
}

function applyFilter<TQuery, TRecord>(
  query: HoloTableQuery<TQuery, TRecord>,
  column: string,
  filter: TableQueryFilter,
): TQuery {
  if (filter.operator === 'in') return query.whereIn(column, requireArray(filter.value, filter.operator))
  if (filter.operator === 'not-in') return query.whereNotIn(column, requireArray(filter.value, filter.operator))
  if (filter.operator === 'between') {
    const values = requireArray(filter.value, filter.operator)
    if (values.length !== 2) throw new Error('[Holo Panels] Between filters require exactly two values.')
    return query.whereBetween(column, [values[0] ?? null, values[1] ?? null])
  }
  if (filter.operator === 'null') return query.whereNull(column)
  if (filter.operator === 'not-null') return query.whereNotNull(column)
  return query.where(column, filter.operator, requireScalar(filter.value, filter.operator))
}

function applyAggregate<TQuery, TRecord>(
  query: HoloTableQuery<TQuery, TRecord>,
  aggregate: TableQueryAggregateDefinition,
): TQuery {
  if (aggregate.kind === 'count') return query.withCount(aggregate.relation)
  if (aggregate.kind === 'exists') return query.withExists(aggregate.relation)
  if (!aggregate.column) throw new Error(`[Holo Panels] ${aggregate.kind} aggregates require a column.`)
  if (aggregate.kind === 'sum') return query.withSum(aggregate.relation, aggregate.column)
  if (aggregate.kind === 'avg') return query.withAvg(aggregate.relation, aggregate.column)
  if (aggregate.kind === 'min') return query.withMin(aggregate.relation, aggregate.column)
  return query.withMax(aggregate.relation, aggregate.column)
}

function unique<TValue>(values: readonly TValue[]): readonly TValue[] {
  return [...new Set(values)]
}

function validateAggregate(aggregate: TableQueryAggregateDefinition): void {
  assertIdentifier(aggregate.relation, 'aggregate relation')
  if (aggregate.column) assertIdentifier(aggregate.column, 'aggregate column')
  const supported: readonly TableAggregateKind[] = ['count', 'exists', 'sum', 'avg', 'min', 'max']
  if (!supported.includes(aggregate.kind)) throw new Error(`[Holo Panels] Unsupported aggregate kind "${aggregate.kind}".`)
}

export class TableQueryExecutor<TQuery extends HoloTableQuery<TQuery, TRecord>, TRecord, TContext> {
  readonly #definition: TableQueryDefinition<TQuery, TContext>

  constructor(definition: TableQueryDefinition<TQuery, TContext>) {
    assertIdentifier(definition.primaryKey, 'primary key')
    for (const [id, column] of Object.entries(definition.columns)) {
      assertIdentifier(id, 'column identifier')
      assertIdentifier(column.column, 'column')
      if (column.relation) assertIdentifier(column.relation, 'relation')
      if (column.aggregate) validateAggregate(column.aggregate)
    }
    for (const [id, filter] of Object.entries(definition.filters ?? {})) {
      assertIdentifier(id, 'filter identifier')
      assertIdentifier(filter.column, 'filter column')
      if (filter.operators.length === 0) throw new Error(`[Holo Panels] Filter "${id}" must allow at least one operator.`)
    }
    for (const relation of definition.eagerLoads ?? []) assertIdentifier(relation, 'eager-load relation')
    this.#definition = definition
  }

  compile(state: TableQueryState, context: TContext): TQuery {
    const constrained = this.applyUserConstraints(this.createScopedQuery(context), state)
    return this.applyPlans(this.applySort(constrained, state), state)
  }

  async execute(state: TableQueryState, context: TContext): Promise<TableQueryResult<TRecord>> {
    this.validatePagination(state)
    if (state.pagination === 'all' || state.perPage === 'all') return this.executeAll(state, context)
    const query = this.compile(state, context)
    const perPage = state.perPage ?? 25
    if (typeof perPage !== 'number') throw new Error('[Holo Panels] Invalid table page size.')
    if (state.pagination === 'cursor') {
      const result = await query.cursorPaginate(perPage, state.cursor ?? null)
      const total = state.includeTotal ? await this.count(state, context) : undefined
      return this.cursorResult(result, total)
    }
    const page = state.page ?? 1
    if (state.pagination === 'simple') {
      const result = await query.simplePaginate(perPage, page)
      const total = state.includeTotal ? await this.count(state, context) : undefined
      return this.simpleResult(result, total)
    }
    return this.pageResult(await query.paginate(perPage, page))
  }

  async count(state: TableQueryState, context: TContext): Promise<number> {
    return this.applyUserConstraints(this.createScopedQuery(context), state).count()
  }

  async executeSelection<TRecordId extends TableRecordIdentifier>(
    state: TableQueryState,
    selection: TableSelection<TRecordId>,
    context: TContext,
  ): Promise<readonly TRecord[]> {
    const maximum = this.#definition.maxSelectionRecords ?? defaultMaxSelectionRecords
    const identifiers = selection.mode === 'explicit' ? selection.recordIds : selection.excludedRecordIds
    if (identifiers.length > maximum) throw new Error(`[Holo Panels] Table selection exceeds the ${maximum} record limit.`)
    for (const identifier of identifiers) assertRecordIdentifier(identifier)
    let query = this.applyUserConstraints(this.createScopedQuery(context), state)
    query = selection.mode === 'explicit'
      ? query.whereIn(this.#definition.primaryKey, identifiers)
      : query.whereNotIn(this.#definition.primaryKey, identifiers)
    const count = await query.count()
    if (count > maximum) throw new Error(`[Holo Panels] Table selection exceeds the ${maximum} record limit.`)
    return this.applyPlans(query.limit(maximum), state).get()
  }

  async resolveRowAction<TRecordId extends TableRecordIdentifier>(
    state: TableQueryState,
    recordId: TRecordId,
    context: TContext,
  ): Promise<TRecord | undefined> {
    assertRecordIdentifier(recordId)
    const query = this.compile(state, context).where(this.#definition.primaryKey, '=', recordId)
    return query.first()
  }

  private createScopedQuery(context: TContext): TQuery {
    const resourceScoped = this.#definition.applyResourceScope(this.#definition.createQuery(), context)
    return this.#definition.applyTenantScope(resourceScoped, context)
  }

  private applyUserConstraints(query: TQuery, state: TableQueryState): TQuery {
    let next = query
    const search = state.search?.trim() ?? ''
    const maximum = this.#definition.maxSearchLength ?? defaultMaxSearchLength
    if (search.length > maximum) throw new Error(`[Holo Panels] Table search exceeds the ${maximum} character limit.`)
    if (search) {
      const columns = Object.values(this.#definition.columns).filter(column => column.searchable).map(column => column.column)
      if (columns.length === 0) throw new Error('[Holo Panels] This table has no searchable columns.')
      next = next.whereAny(unique(columns), 'like', `%${escapeLikeSearch(search)}%`)
    }
    const seenFilters = new Set<string>()
    if ((state.filters?.length ?? 0) > Object.keys(this.#definition.filters ?? {}).length) {
      throw new Error('[Holo Panels] Table filter count exceeds the configured filter definitions.')
    }
    for (const filter of state.filters ?? []) {
      if (seenFilters.has(filter.id)) throw new Error(`[Holo Panels] Duplicate table filter "${filter.id}".`)
      seenFilters.add(filter.id)
      const definition = this.#definition.filters?.[filter.id]
      if (!definition) throw new Error(`[Holo Panels] Unknown table filter "${filter.id}".`)
      if (!definition.operators.includes(filter.operator)) {
        throw new Error(`[Holo Panels] Filter "${filter.id}" does not allow operator "${filter.operator}".`)
      }
      next = applyFilter(next, definition.column, filter)
    }
    return next
  }

  private applySort(query: TQuery, state: TableQueryState): TQuery {
    let next = query
    const sort = state.sort?.length ? state.sort : this.#definition.defaultSort ?? []
    if (sort.length > Object.keys(this.#definition.columns).length) {
      throw new Error('[Holo Panels] Table sort count exceeds the configured columns.')
    }
    const seenColumns = new Set<string>()
    for (const item of sort) {
      if (seenColumns.has(item.column)) throw new Error(`[Holo Panels] Duplicate table sort "${item.column}".`)
      seenColumns.add(item.column)
      const definition = this.#definition.columns[item.column]
      if (!definition?.sortable) throw new Error(`[Holo Panels] Unknown or unsortable table column "${item.column}".`)
      if (item.direction !== 'asc' && item.direction !== 'desc') throw new Error('[Holo Panels] Invalid table sort direction.')
      next = next.orderBy(definition.column, item.direction)
    }
    if (![...seenColumns].some(id => this.#definition.columns[id]?.column === this.#definition.primaryKey)) {
      next = next.orderBy(this.#definition.primaryKey, 'asc')
    }
    return next
  }

  private applyPlans(query: TQuery, state: TableQueryState): TQuery {
    const visibleIds = state.visibleColumns ?? Object.keys(this.#definition.columns)
    if (visibleIds.length > Object.keys(this.#definition.columns).length) {
      throw new Error('[Holo Panels] Visible table column count exceeds the configured columns.')
    }
    const relations = [...(this.#definition.eagerLoads ?? [])]
    const aggregates: TableQueryAggregateDefinition[] = []
    for (const id of visibleIds) {
      const column = this.#definition.columns[id]
      if (!column) throw new Error(`[Holo Panels] Unknown visible table column "${id}".`)
      if (column.relation) relations.push(column.relation)
      if (column.aggregate) aggregates.push(column.aggregate)
    }
    let next = query
    const eagerLoads = unique(relations)
    if (eagerLoads.length > 0) next = next.with(...eagerLoads)
    const seenAggregates = new Set<string>()
    for (const aggregate of aggregates) {
      const key = `${aggregate.kind}:${aggregate.relation}:${aggregate.column ?? ''}`
      if (seenAggregates.has(key)) continue
      seenAggregates.add(key)
      next = applyAggregate(next, aggregate)
    }
    return next
  }

  private validatePagination(state: TableQueryState): void {
    if (!['page', 'simple', 'cursor', 'all'].includes(state.pagination)) {
      throw new Error('[Holo Panels] Invalid table pagination mode.')
    }
    const maximumPerPage = this.#definition.maxPerPage ?? defaultMaxPerPage
    const maximumPage = this.#definition.maxPage ?? defaultMaxPage
    if (state.perPage !== 'all') assertPositiveInteger(state.perPage ?? 25, 'Table page size', maximumPerPage)
    if (state.pagination !== 'cursor') assertPositiveInteger(state.page ?? 1, 'Table page', maximumPage)
    if (state.pagination === 'cursor' && (state.cursor?.length ?? 0) > (this.#definition.maxCursorLength ?? defaultMaxCursorLength)) {
      throw new Error('[Holo Panels] Table cursor exceeds the configured length limit.')
    }
    if (state.pagination === 'all' || state.perPage === 'all') {
      if (state.pagination !== 'all' || state.perPage !== 'all') {
        throw new Error('[Holo Panels] All-record pagination requires both pagination "all" and perPage "all".')
      }
      if (!this.#definition.allowAll) throw new Error('[Holo Panels] All-record table pagination is disabled.')
    }
  }

  private async executeAll(state: TableQueryState, context: TContext): Promise<TableQueryResult<TRecord>> {
    const maximum = this.#definition.maxAllRecords ?? defaultMaxAllRecords
    const total = await this.count(state, context)
    if (total > maximum) throw new Error(`[Holo Panels] All-record table result exceeds the ${maximum} record limit.`)
    const records = await this.compile(state, context).limit(maximum).get()
    return Object.freeze({ mode: 'all', records, total })
  }

  private pageResult(result: HoloPaginatedResult<TRecord>): TableQueryResult<TRecord> {
    return Object.freeze({
      mode: 'page',
      records: result.data,
      total: result.meta.total,
      page: result.meta.currentPage,
      perPage: result.meta.perPage,
      lastPage: result.meta.lastPage,
      hasMore: result.meta.hasMorePages,
    })
  }

  private simpleResult(result: HoloSimplePaginatedResult<TRecord>, total?: number): TableQueryResult<TRecord> {
    return Object.freeze({
      mode: 'simple',
      records: result.data,
      ...(typeof total === 'number' ? { total } : {}),
      page: result.meta.currentPage,
      perPage: result.meta.perPage,
      hasMore: result.meta.hasMorePages,
    })
  }

  private cursorResult(result: HoloCursorPaginatedResult<TRecord>, total?: number): TableQueryResult<TRecord> {
    return Object.freeze({
      mode: 'cursor',
      records: result.data,
      ...(typeof total === 'number' ? { total } : {}),
      perPage: result.perPage,
      nextCursor: result.nextCursor,
      previousCursor: result.prevCursor,
    })
  }
}
