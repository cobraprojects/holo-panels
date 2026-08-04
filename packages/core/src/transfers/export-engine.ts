import type { TableQueryState, TableRecordIdentifier, TableSelection } from '../tables/query/contracts'
import type {
  CompiledExportColumn,
  ExportCell,
  ExportColumnOption,
  ExporterDefinition,
  TransferExecutionContext,
} from './contracts'

export type ExportEngineErrorCode
  = 'inconsistent_resolver'
    | 'inconsistent_source'
    | 'invalid_configuration'
    | 'invalid_options'
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

export interface ExecuteTransferExportRequest<TRecordId extends TableRecordIdentifier, TActor extends object, TTenant> {
  readonly columnIds?: readonly string[]
  readonly context: TransferExecutionContext<TActor, TTenant>
  readonly selection: TableSelection<TRecordId>
  readonly tableState: TableQueryState
}

export interface TransferExportChunk {
  readonly index: number
  readonly offset: number
  readonly rows: readonly (readonly ExportCell[])[]
  readonly totalRows: number
}

export interface TransferExportResult {
  readonly chunks: number
  readonly columnIds: readonly string[]
  readonly headers: readonly string[]
  readonly rows: number
}

function fail(code: ExportEngineErrorCode, message: string): never {
  throw new ExportEngineError(code, message)
}

function scalar(value: unknown, columnId: string): ExportCell {
  if (value === null || value instanceof Date || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
  return fail('invalid_value', `Export column "${columnId}" resolved a non-scalar value.`)
}

function valueAtPath(record: object, path: string): unknown {
  let current: unknown = record
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return null
    current = Reflect.get(current, segment)
  }
  return current
}

function assertLength(values: readonly unknown[], expected: number, columnId: string): void {
  if (values.length !== expected) fail('inconsistent_resolver', `Export column "${columnId}" returned an inconsistent result count.`)
}

function optionKey(value: ExportCell): string {
  if (value instanceof Date) return `date:${value.toISOString()}`
  return `${typeof value}:${String(value)}`
}

function optionMap(options: readonly ExportColumnOption<ExportCell>[], columnId: string): ReadonlyMap<string, string> {
  if (options.length > 10_000) fail('invalid_options', `Export column "${columnId}" returned too many options.`)
  const mapped = new Map<string, string>()
  for (const option of options) {
    const value = scalar(option.value, columnId)
    const key = optionKey(value)
    if (mapped.has(key)) fail('invalid_options', `Export column "${columnId}" returned duplicate option values.`)
    mapped.set(key, option.label)
  }
  return mapped
}

async function resolveColumn<TRecord, TActor extends object, TTenant>(
  column: CompiledExportColumn<TRecord, TActor, TTenant>,
  records: readonly TRecord[],
  context: TransferExecutionContext<TActor, TTenant>,
): Promise<readonly ExportCell[]> {
  const batch = Object.freeze({ ...context, records: Object.freeze([...records]) })
  const raw = column.state
    ? await column.state(batch)
    : records.map(record => scalar(valueAtPath(record as object, column.path!), column.id))
  assertLength(raw, records.length, column.id)
  let values = raw.map(value => scalar(value, column.id))
  if (column.options) {
    const options = optionMap(await column.options(Object.freeze({ ...batch, values: Object.freeze(values) })), column.id)
    values = values.map(value => options.get(optionKey(value)) ?? value)
  }
  if (column.format) {
    const formatted = await column.format(Object.freeze({ ...batch, values: Object.freeze(values) }))
    assertLength(formatted, records.length, column.id)
    values = formatted.map(value => scalar(value, column.id))
  }
  return Object.freeze(values)
}

async function resolveRows<TRecord, TActor extends object, TTenant>(
  columns: readonly CompiledExportColumn<TRecord, TActor, TTenant>[],
  records: readonly TRecord[],
  context: TransferExecutionContext<TActor, TTenant>,
): Promise<readonly (readonly ExportCell[])[]> {
  const values = await Promise.all(columns.map(column => resolveColumn(column, records, context)))
  return Object.freeze(records.map((_, row) => Object.freeze(values.map(column => column[row]!))))
}

export async function executeTransferExport<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
>(
  definition: ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant>,
  request: ExecuteTransferExportRequest<TRecordId, TActor, TTenant>,
  consume: (chunk: TransferExportChunk) => void | Promise<void>,
): Promise<TransferExportResult> {
  const server = definition.server
  const authorized = await server.authorize(request.context)
  if (authorized === false) fail('unauthorized', 'Export authorization failed.')
  const requestedIds = request.columnIds ?? server.columns.filter(column => column.visibleByDefault).map(column => column.id)
  if (requestedIds.length === 0 || new Set(requestedIds).size !== requestedIds.length) fail('invalid_configuration', 'Export column selection is invalid.')
  const available = new Map(server.columns.map(column => [column.id, column]))
  const columns = requestedIds.map(id => available.get(id) ?? fail('unknown_column', `Unknown export column "${id}".`))
  const relations = [...new Set(columns.flatMap(column => column.relation ? [column.relation] : []))]
  const aggregates = columns.flatMap(column => column.aggregate ? [column.aggregate] : [])
  let query = server.query.createQuery()
  query = server.query.applyAuthorizationScope(query, request.context)
  query = server.query.applyTenantScope(query, request.context)
  query = server.query.applyTableState(query, request.tableState, request.context)
  query = server.query.applySelection(query, request.selection, request.context)
  if (server.query.override) query = await server.query.override(query, request.context)
  query = server.query.applyRelations(query, relations)
  query = server.query.applyAggregates(query, aggregates)
  query = server.query.orderBy(query, server.query.primaryKey, 'asc')
  const totalRows = await server.query.count(query)
  if (!Number.isSafeInteger(totalRows) || totalRows < 0) fail('inconsistent_source', 'Export query returned an invalid row count.')
  if (totalRows > server.maxRows) fail('max_rows_exceeded', `Export exceeds the ${server.maxRows} row limit.`)
  let chunks = 0
  for (let offset = 0; offset < totalRows; offset += server.chunkSize) {
    if (request.context.signal.aborted) throw request.context.signal.reason
    const limit = Math.min(server.chunkSize, totalRows - offset)
    const records = await server.query.fetchChunk(query, offset, limit)
    if (records.length !== limit) fail('inconsistent_source', 'Export source changed while chunks were read.')
    await consume(Object.freeze({
      index: chunks,
      offset,
      rows: await resolveRows(columns, records, request.context),
      totalRows,
    }))
    chunks += 1
  }
  return Object.freeze({
    chunks,
    columnIds: Object.freeze([...requestedIds]),
    headers: Object.freeze(columns.map(column => column.label)),
    rows: totalRows,
  })
}
