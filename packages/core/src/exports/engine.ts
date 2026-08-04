import { type CsvExportCell, type CsvExportOptions, writeCsvExport } from './csv'

export type ExportAggregateKind = 'average' | 'count' | 'exists' | 'max' | 'min' | 'sum'

export interface ExportAggregatePlan {
  readonly column?: string
  readonly kind: ExportAggregateKind
  readonly relation: string
}

export interface ExportColumnOption {
  readonly label: string
  readonly value: CsvExportCell
}

export interface ExportColumnContext<TRecord, TContext> {
  readonly context: TContext
  readonly record: Readonly<TRecord>
}

export interface ExportColumnValueContext<TRecord, TContext> extends ExportColumnContext<TRecord, TContext> {
  readonly value: CsvExportCell
}

export interface ExportColumnDefinition<TRecord, TContext> {
  readonly aggregate?: ExportAggregatePlan
  readonly format?: (input: ExportColumnValueContext<TRecord, TContext>) => CsvExportCell | Promise<CsvExportCell>
  readonly id: string
  readonly label: string
  readonly options?: (
    input: ExportColumnContext<TRecord, TContext>,
  ) => readonly ExportColumnOption[] | Promise<readonly ExportColumnOption[]>
  readonly path?: string
  readonly relation?: string
  readonly state?: (input: ExportColumnContext<TRecord, TContext>) => CsvExportCell | Promise<CsvExportCell>
  readonly visibleByDefault?: boolean
}

export interface ExportQueryAdapter<TQuery, TRecord, TContext> {
  readonly primaryKey: string
  applyAggregates(query: TQuery, aggregates: readonly ExportAggregatePlan[]): TQuery
  applyAuthorizationScope(query: TQuery, context: TContext): TQuery
  applyRelations(query: TQuery, relations: readonly string[]): TQuery
  applyTenantScope(query: TQuery, context: TContext): TQuery
  authorize(context: TContext): boolean | void | Promise<boolean | void>
  count(query: TQuery): Promise<number>
  createQuery(): TQuery
  fetchChunk(query: TQuery, offset: number, limit: number): Promise<readonly TRecord[]>
  orderBy(query: TQuery, column: string, direction: 'asc'): TQuery
}

export interface ExportDefinition<TQuery, TRecord, TContext> {
  readonly columns: readonly ExportColumnDefinition<TRecord, TContext>[]
  readonly query: ExportQueryAdapter<TQuery, TRecord, TContext>
  readonly overrideQuery?: (query: TQuery, context: TContext) => TQuery | Promise<TQuery>
}

export interface ExportRequest<TContext> {
  readonly chunkSize: number
  readonly context: TContext
  readonly maxRows: number
  readonly selectedColumns?: readonly string[]
  readonly visibleTableColumns?: readonly string[]
}

export interface ExportPlan<TRecord, TContext> {
  readonly aggregates: readonly ExportAggregatePlan[]
  readonly columns: readonly ExportColumnDefinition<TRecord, TContext>[]
  readonly headers: readonly string[]
  readonly relations: readonly string[]
}

export interface ExportExecutionChunk {
  readonly index: number
  readonly offset: number
  readonly rows: readonly (readonly CsvExportCell[])[]
  readonly totalRows: number
}

export interface ExportExecutionResult {
  readonly chunks: number
  readonly columnIds: readonly string[]
  readonly rows: number
}

export type ExportChunkConsumer = (chunk: ExportExecutionChunk) => void | Promise<void>

export type ExportEngineErrorCode
  = 'duplicate_column'
    | 'inconsistent_source'
    | 'invalid_column'
    | 'invalid_configuration'
    | 'invalid_value'
    | 'max_rows_exceeded'
    | 'unauthorized'
    | 'unknown_column'

export class ExportEngineError extends Error {
  constructor(readonly code: ExportEngineErrorCode, message: string) {
    super(message)
    this.name = 'ExportEngineError'
  }
}

const identifierPattern = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu

function fail(code: ExportEngineErrorCode, message: string): never {
  throw new ExportEngineError(code, message)
}

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) fail('invalid_configuration', `${label} must be a safe identifier path`)
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail('invalid_configuration', `${label} must be a positive safe integer`)
}

function unique<TValue>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...new Set(values)])
}

function aggregateKey(aggregate: ExportAggregatePlan): string {
  return `${aggregate.kind}:${aggregate.relation}:${aggregate.column ?? ''}`
}

function validateDefinition<TQuery, TRecord, TContext>(definition: ExportDefinition<TQuery, TRecord, TContext>): void {
  assertIdentifier(definition.query.primaryKey, 'Export primary key')
  if (definition.columns.length === 0) fail('invalid_configuration', 'Exports require at least one column')
  const ids = new Set<string>()
  for (const column of definition.columns) {
    assertIdentifier(column.id, 'Export column identifier')
    if (ids.has(column.id)) fail('duplicate_column', `Export column "${column.id}" is duplicated`)
    ids.add(column.id)
    if (!column.label.trim()) fail('invalid_configuration', `Export column "${column.id}" requires a label`)
    if (!column.path && !column.state) {
      fail('invalid_configuration', `Export column "${column.id}" requires a path or state resolver`)
    }
    if (column.path) assertIdentifier(column.path, `Export column "${column.id}" path`)
    if (column.relation) assertIdentifier(column.relation, `Export column "${column.id}" relation`)
    if (column.aggregate) {
      assertIdentifier(column.aggregate.relation, `Export column "${column.id}" aggregate relation`)
      if (column.aggregate.column) {
        assertIdentifier(column.aggregate.column, `Export column "${column.id}" aggregate column`)
      }
    }
  }
}

function requestedColumnIds<TQuery, TRecord, TContext>(
  definition: ExportDefinition<TQuery, TRecord, TContext>,
  request: Pick<ExportRequest<TContext>, 'selectedColumns' | 'visibleTableColumns'>,
): readonly string[] {
  if (request.selectedColumns) return request.selectedColumns
  if (request.visibleTableColumns) return request.visibleTableColumns
  return definition.columns.filter(column => column.visibleByDefault !== false).map(column => column.id)
}

export function planExport<TQuery, TRecord, TContext>(
  definition: ExportDefinition<TQuery, TRecord, TContext>,
  request: Pick<ExportRequest<TContext>, 'selectedColumns' | 'visibleTableColumns'>,
): ExportPlan<TRecord, TContext> {
  validateDefinition(definition)
  const ids = requestedColumnIds(definition, request)
  if (ids.length === 0) fail('invalid_column', 'Exports require at least one selected column')
  if (new Set(ids).size !== ids.length) fail('duplicate_column', 'Export column selection contains duplicates')
  const definitions = new Map(definition.columns.map(column => [column.id, column]))
  const columns = ids.map((id) => {
    const column = definitions.get(id)
    if (!column) fail('unknown_column', `Unknown export column "${id}"`)
    return column
  })
  const relations = unique(columns.flatMap(column => column.relation ? [column.relation] : []))
  const aggregateMap = new Map<string, ExportAggregatePlan>()
  for (const aggregate of columns.flatMap(column => column.aggregate ? [column.aggregate] : [])) {
    aggregateMap.set(aggregateKey(aggregate), aggregate)
  }
  return Object.freeze({
    aggregates: Object.freeze([...aggregateMap.values()]),
    columns: Object.freeze(columns),
    headers: Object.freeze(columns.map(column => column.label)),
    relations,
  })
}

function valueAtPath(record: object, path: string): unknown {
  let current: unknown = record
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return null
    current = Reflect.get(current, segment)
  }
  return current
}

function exportCell(value: unknown, columnId: string): CsvExportCell {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
  return fail('invalid_value', `Export column "${columnId}" resolved a non-scalar value`)
}

async function resolveColumn<TRecord, TContext>(
  column: ExportColumnDefinition<TRecord, TContext>,
  record: Readonly<TRecord>,
  context: TContext,
): Promise<CsvExportCell> {
  const input = Object.freeze({ context, record })
  const raw = column.state
    ? await column.state(input)
    : exportCell(valueAtPath(record as object, column.path!), column.id)
  let value = exportCell(raw, column.id)
  if (column.options) {
    const options = await column.options(input)
    const option = options.find(candidate => Object.is(candidate.value, value))
    if (option) value = option.label
  }
  return column.format
    ? exportCell(await column.format(Object.freeze({ ...input, value })), column.id)
    : value
}

async function resolveRows<TRecord, TContext>(
  columns: readonly ExportColumnDefinition<TRecord, TContext>[],
  records: readonly TRecord[],
  context: TContext,
): Promise<readonly (readonly CsvExportCell[])[]> {
  return Object.freeze(await Promise.all(records.map(async record => Object.freeze(
    await Promise.all(columns.map(column => resolveColumn(column, record, context))),
  ))))
}

async function scopedQuery<TQuery, TRecord, TContext>(
  definition: ExportDefinition<TQuery, TRecord, TContext>,
  plan: ExportPlan<TRecord, TContext>,
  context: TContext,
): Promise<TQuery> {
  const authorized = await definition.query.authorize(context)
  if (authorized === false) fail('unauthorized', 'Export authorization failed')
  let query = definition.query.createQuery()
  query = definition.query.applyAuthorizationScope(query, context)
  query = definition.query.applyTenantScope(query, context)
  if (definition.overrideQuery) query = await definition.overrideQuery(query, context)
  query = definition.query.applyRelations(query, plan.relations)
  query = definition.query.applyAggregates(query, plan.aggregates)
  return definition.query.orderBy(query, definition.query.primaryKey, 'asc')
}

export async function executeExport<TQuery, TRecord, TContext>(
  definition: ExportDefinition<TQuery, TRecord, TContext>,
  request: ExportRequest<TContext>,
  consume: ExportChunkConsumer,
): Promise<ExportExecutionResult> {
  assertPositiveInteger(request.maxRows, 'Export maximum rows')
  assertPositiveInteger(request.chunkSize, 'Export chunk size')
  if (request.chunkSize > request.maxRows) {
    fail('invalid_configuration', 'Export chunk size cannot exceed the maximum rows')
  }
  const plan = planExport(definition, request)
  const query = await scopedQuery(definition, plan, request.context)
  const totalRows = await definition.query.count(query)
  if (!Number.isSafeInteger(totalRows) || totalRows < 0) {
    fail('inconsistent_source', 'Export query returned an invalid row count')
  }
  if (totalRows > request.maxRows) {
    fail('max_rows_exceeded', `Export exceeds the ${request.maxRows} row limit`)
  }
  let chunkIndex = 0
  for (let offset = 0; offset < totalRows; offset += request.chunkSize) {
    const expected = Math.min(request.chunkSize, totalRows - offset)
    const records = await definition.query.fetchChunk(query, offset, expected)
    if (records.length !== expected) {
      fail('inconsistent_source', 'Export source changed while deterministic chunks were being read')
    }
    await consume(Object.freeze({
      index: chunkIndex,
      offset,
      rows: await resolveRows(plan.columns, records, request.context),
      totalRows,
    }))
    chunkIndex += 1
  }
  return Object.freeze({
    chunks: chunkIndex,
    columnIds: Object.freeze(plan.columns.map(column => column.id)),
    rows: totalRows,
  })
}

export async function executeCsvExport<TQuery, TRecord, TContext>(
  definition: ExportDefinition<TQuery, TRecord, TContext>,
  request: ExportRequest<TContext>,
  options: CsvExportOptions = {},
): Promise<string> {
  const plan = planExport(definition, request)
  const rows: (readonly CsvExportCell[])[] = []
  await executeExport(definition, request, (chunk) => {
    rows.push(...chunk.rows)
  })
  return writeCsvExport({ headers: plan.headers, rows }, options)
}
