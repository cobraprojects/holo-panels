import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonValue } from '../../protocol/json'

export interface InlineEditableColumnManifest {
  readonly inlineEditor: { readonly action?: unknown } | null
  readonly path: string
}

export interface InlineEditRequest<TRecordId extends number | string> {
  readonly action: string
  readonly columnPath: string
  readonly expectedVersion?: string
  readonly recordId: TRecordId
  readonly value: JsonValue
}

export interface InlineEditActionInput<TRecordId extends number | string> extends JsonObject {
  action: string
  columnPath: string
  expectedVersion: string | null
  recordId: TRecordId
  value: JsonValue
}

export interface InlineEditActionExecutor<TRecordId extends number | string, TResult> {
  execute(input: InlineEditActionInput<TRecordId>, signal?: AbortSignal): Promise<TResult>
}

function assertRecordId(recordId: number | string): void {
  if (typeof recordId === 'number' && (!Number.isSafeInteger(recordId) || recordId < 0)) throw new Error('Inline edit record IDs must be non-negative safe integers')
  if (typeof recordId === 'string' && (recordId.length === 0 || recordId.length > 255)) throw new Error('Inline edit record IDs must contain 1 to 255 characters')
}

export async function executeInlineColumnEdit<TRecordId extends number | string, TResult>(
  column: InlineEditableColumnManifest,
  request: InlineEditRequest<TRecordId>,
  executor: InlineEditActionExecutor<TRecordId, TResult>,
  signal?: AbortSignal,
): Promise<TResult> {
  const editor = column.inlineEditor
  if (!editor) throw new Error(`Column "${column.path}" does not support inline editing`)
  const configuredAction = editor.action
  if (typeof configuredAction !== 'string') throw new Error('Compiled inline editor action IDs must be strings')
  if (request.columnPath !== column.path) throw new Error('Inline edit column paths must match the allow-listed compiled column')
  if (request.action !== configuredAction) throw new Error('Inline edits cannot select a different server action')
  assertRecordId(request.recordId)
  const value = toJsonValue(request.value)
  return executor.execute({
    action: configuredAction,
    columnPath: column.path,
    expectedVersion: request.expectedVersion ?? null,
    recordId: request.recordId,
    value,
  }, signal)
}
