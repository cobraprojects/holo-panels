import type { TableRecordIdentifier } from '../tables/query/contracts'
import type {
  ExportCell,
  ExporterDefinition,
  TransferArtifactWriter,
  TransferExecutionContext,
  TransferNextChunk,
  TransferOperationRecord,
  TransferResultPart,
  TransferStorageAdapter,
  TransferStoredArtifact,
} from './contracts'
import type { TransferOperationLifecycle } from './lifecycle'
import { transferDefinitionRevision } from './revision'

const encoder = new TextEncoder()
const maximumCellBytes = 1_048_576
const partContentType = 'application/vnd.holo-panels.transfer-part+jsonl'

type EncodedCell
  = readonly ['b', 0 | 1]
    | readonly ['d', string]
    | readonly ['n']
    | readonly ['s', string]
    | readonly ['t', string]

export type TransferPartsErrorCode
  = 'authorization_revoked'
    | 'definition_mismatch'
    | 'incomplete_parts'
    | 'invalid_part'
    | 'part_unavailable'
    | 'result_unavailable'
    | 'unknown_column'
    | 'unknown_format'

export class TransferPartsError extends Error {
  constructor(readonly code: TransferPartsErrorCode) {
    super('[Holo Panels] Transfer result parts are unavailable.')
    this.name = 'TransferPartsError'
  }
}

export interface PersistTransferExportPartOptions<TRequestScope, TRecordId extends TableRecordIdentifier> {
  readonly chunk: number
  readonly chunkSize: number
  readonly columnCount: number
  readonly completed: number
  readonly disk: string
  readonly lifecycle: TransferOperationLifecycle<TRequestScope, TRecordId>
  readonly next: TransferNextChunk
  readonly operationId: string
  readonly rows: readonly (readonly ExportCell[])[]
  readonly storage: TransferStorageAdapter
}

export async function persistTransferExportPart<TRequestScope, TRecordId extends TableRecordIdentifier>(
  options: PersistTransferExportPartOptions<TRequestScope, TRecordId>,
): Promise<TransferOperationRecord<TRecordId>> {
  const part = await writeTransferResultPart(options)
  try {
    return await options.lifecycle.progress(options.operationId, {
      completed: options.completed,
      kind: 'export',
      next: options.next,
      part,
    })
  } catch (error) {
    await options.storage.delete([part.artifact])
    throw error
  }
}

export interface WriteTransferResultPartOptions {
  readonly chunk: number
  readonly chunkSize: number
  readonly columnCount: number
  readonly disk: string
  readonly operationId: string
  readonly rows: readonly (readonly ExportCell[])[]
  readonly storage: TransferStorageAdapter
}

export async function writeTransferResultPart(options: WriteTransferResultPartOptions): Promise<TransferResultPart> {
  assertPartBounds(options.chunk, options.rows.length, options.chunkSize, options.columnCount)
  const writer = await options.storage.writer({
    contentType: partContentType,
    disk: options.disk,
    filename: `chunk-${options.chunk}.jsonl`,
    operationId: options.operationId,
    purpose: 'part',
  })
  try {
    for (const row of options.rows) {
      if (row.length !== options.columnCount) throw new TransferPartsError('invalid_part')
      await writeBytes(writer, encoder.encode(`${encodeRow(row)}\n`))
    }
    return Object.freeze({ artifact: await writer.close(), chunk: options.chunk, rows: options.rows.length })
  } catch (error) {
    await writer.abort()
    throw error
  }
}

export interface FinalizeTransferExportPartsOptions<
  TRequestScope,
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  readonly context: TransferExecutionContext<TActor, TTenant>
  readonly definition: ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant>
  readonly lifecycle: TransferOperationLifecycle<TRequestScope, TRecordId>
  readonly operation: TransferOperationRecord<TRecordId>
  readonly storage: TransferStorageAdapter
}

export async function finalizeTransferExportParts<
  TRequestScope,
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
>(options: FinalizeTransferExportPartsOptions<TRequestScope, TQuery, TRecord, TRecordId, TActor, TTenant>): Promise<TransferOperationRecord<TRecordId>> {
  const { context, definition, operation, storage } = options
  if (operation.kind !== 'export' || operation.input.kind !== 'export' || operation.progress.completed !== operation.progress.total) {
    throw new TransferPartsError('incomplete_parts')
  }
  if (definition.id !== operation.definitionId || definition.resourceId !== operation.resourceId
    || transferDefinitionRevision(definition) !== operation.definitionRevision || context.panelId !== operation.identity.panelId
    || context.resourceId !== operation.resourceId || context.guard !== operation.identity.guard
    || context.provider !== operation.identity.provider) throw new TransferPartsError('definition_mismatch')
  if (await definition.server.authorize(context) === false || await definition.server.query.authorize(context) === false) {
    throw new TransferPartsError('authorization_revoked')
  }
  const availableColumns = new Map(definition.server.columns.map(column => [column.id, column]))
  const columns = operation.input.columnIds.map(columnId => availableColumns.get(columnId) ?? fail('unknown_column'))
  const format = definition.server.formats.find(candidate => candidate.id === operation.input.formatId) ?? fail('unknown_format')
  validateParts(operation.parts, operation.progress.total, definition.server.chunkSize, columns.length)
  const writer = new CapturingWriter(await storage.writer({
    contentType: format.artifact.contentType,
    disk: definition.server.storage.disk,
    filename: format.artifact.filename,
    operationId: operation.id,
    purpose: 'result',
  }))
  let result: TransferStoredArtifact | null = null
  try {
    await format.write({
      headers: Object.freeze(columns.map(column => column.label)),
      rows: readTransferResultParts(storage, operation.parts, definition.server.chunkSize, columns.length),
    }, writer)
    result = writer.artifact ?? fail('result_unavailable')
    const completed = await options.lifecycle.complete(operation.id, result)
    if (completed.artifact?.path !== result.path) await storage.delete([result])
    return completed
  } catch (error) {
    if (result) await storage.delete([result])
    throw error
  }
}

export async function * readTransferResultParts(
  storage: TransferStorageAdapter,
  parts: readonly TransferResultPart[],
  chunkSize: number,
  columnCount: number,
): AsyncIterable<readonly (readonly ExportCell[])[]> {
  validateParts(parts, parts.reduce((total, part) => total + part.rows, 0), chunkSize, columnCount)
  for (const part of parts) {
    const source = await storage.source(part.artifact)
    if (!source) throw new TransferPartsError('part_unavailable')
    if (source.size !== part.artifact.size || source.digest.algorithm !== part.artifact.digest.algorithm
      || source.digest.value !== part.artifact.digest.value) throw new TransferPartsError('invalid_part')
    let rows = 0
    for await (const row of decodeRows(source.chunks(), columnCount)) {
      rows += 1
      if (rows > part.rows) throw new TransferPartsError('invalid_part')
      yield Object.freeze([row])
    }
    if (rows !== part.rows) throw new TransferPartsError('invalid_part')
  }
}

function encodeRow(row: readonly ExportCell[]): string {
  return JSON.stringify(row.map(encodeCell))
}

function encodeCell(value: ExportCell): EncodedCell {
  if (value === null) return ['n']
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TransferPartsError('invalid_part')
    return ['t', value.toISOString()]
  }
  if (typeof value === 'boolean') return ['b', value ? 1 : 0]
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TransferPartsError('invalid_part')
    return ['d', Object.is(value, -0) ? '-0' : String(value)]
  }
  if (encoder.encode(value).byteLength > maximumCellBytes) throw new TransferPartsError('invalid_part')
  return ['s', value]
}

async function * decodeRows(chunks: AsyncIterable<Uint8Array>, columnCount: number): AsyncIterable<readonly ExportCell[]> {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let pending = ''
  try {
    for await (const chunk of chunks) {
      pending += decoder.decode(chunk, { stream: true })
      let lineEnd = pending.indexOf('\n')
      while (lineEnd >= 0) {
        const line = pending.slice(0, lineEnd)
        pending = pending.slice(lineEnd + 1)
        yield decodeRow(line, columnCount)
        lineEnd = pending.indexOf('\n')
      }
      if (encoder.encode(pending).byteLength > maximumCellBytes * columnCount) throw new TransferPartsError('invalid_part')
    }
    pending += decoder.decode()
  } catch (error) {
    if (error instanceof TransferPartsError) throw error
    throw new TransferPartsError('invalid_part')
  }
  if (pending) throw new TransferPartsError('invalid_part')
}

function decodeRow(line: string, columnCount: number): readonly ExportCell[] {
  let parsed: unknown
  try { parsed = JSON.parse(line) } catch { throw new TransferPartsError('invalid_part') }
  if (!Array.isArray(parsed) || parsed.length !== columnCount) throw new TransferPartsError('invalid_part')
  const row = Object.freeze(parsed.map(decodeCell))
  if (encodeRow(row) !== line) throw new TransferPartsError('invalid_part')
  return row
}

function decodeCell(value: unknown): ExportCell {
  if (!Array.isArray(value)) throw new TransferPartsError('invalid_part')
  if (value.length === 1 && value[0] === 'n') return null
  if (value.length !== 2) throw new TransferPartsError('invalid_part')
  if (value[0] === 'b' && (value[1] === 0 || value[1] === 1)) return value[1] === 1
  if (value[0] === 'd' && typeof value[1] === 'string') {
    const number = Number(value[1])
    if (Number.isFinite(number) && (value[1] === '-0' ? Object.is(number, -0) : String(number) === value[1])) return number
  }
  if (value[0] === 's' && typeof value[1] === 'string' && encoder.encode(value[1]).byteLength <= maximumCellBytes) return value[1]
  if (value[0] === 't' && typeof value[1] === 'string') {
    const date = new Date(value[1])
    if (Number.isFinite(date.getTime()) && date.toISOString() === value[1]) return date
  }
  throw new TransferPartsError('invalid_part')
}

function validateParts(parts: readonly TransferResultPart[], totalRows: number, chunkSize: number, columnCount: number): void {
  if (!Number.isSafeInteger(totalRows) || totalRows < 0 || !Number.isSafeInteger(chunkSize) || chunkSize < 1
    || !Number.isSafeInteger(columnCount) || columnCount < 1 || columnCount > 16_384) throw new TransferPartsError('invalid_part')
  const paths = new Set<string>()
  let rows = 0
  parts.forEach((part, chunk) => {
    assertPartBounds(part.chunk, part.rows, chunkSize, columnCount)
    if (part.chunk !== chunk || paths.has(`${part.artifact.disk}:${part.artifact.path}`)) throw new TransferPartsError('invalid_part')
    paths.add(`${part.artifact.disk}:${part.artifact.path}`)
    rows += part.rows
  })
  if (rows !== totalRows) throw new TransferPartsError('incomplete_parts')
}

function assertPartBounds(chunk: number, rows: number, chunkSize: number, columnCount: number): void {
  if (!Number.isSafeInteger(chunk) || chunk < 0 || !Number.isSafeInteger(rows) || rows < 1 || rows > chunkSize
    || !Number.isSafeInteger(chunkSize) || chunkSize < 1 || !Number.isSafeInteger(columnCount) || columnCount < 1 || columnCount > 16_384) {
    throw new TransferPartsError('invalid_part')
  }
}

async function writeBytes(writer: TransferArtifactWriter, bytes: Uint8Array): Promise<void> {
  for (let offset = 0; offset < bytes.byteLength; offset += 65_536) await writer.write(bytes.slice(offset, offset + 65_536))
}

function fail(code: TransferPartsErrorCode): never {
  throw new TransferPartsError(code)
}

class CapturingWriter implements TransferArtifactWriter {
  artifact: TransferStoredArtifact | null = null

  constructor(private readonly writer: TransferArtifactWriter) {}

  abort(): Promise<void> { return this.writer.abort() }

  async close(): Promise<TransferStoredArtifact> {
    this.artifact = await this.writer.close()
    return this.artifact
  }

  write(chunk: Uint8Array): Promise<void> { return this.writer.write(chunk) }
}
