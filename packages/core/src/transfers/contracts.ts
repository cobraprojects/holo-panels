import type { DiscoverableDefinition } from '../discovery/types'
import type { ImportColumnMapping } from '../imports/mapping'
import type { JsonObject } from '../protocol/json'
import type { TableQueryState, TableRecordIdentifier, TableSelection } from '../tables/query/contracts'

export interface TransferExecutionContext<TActor extends object, TTenant> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly provider: string | null
  readonly resourceId: string
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface TransferQueueConfiguration {
  readonly backoff?: number | readonly number[]
  readonly connection?: string
  readonly queue?: string
  readonly tries?: number
}

export interface TransferStorageConfiguration {
  readonly directory?: string
  readonly disk: string
}

export interface TransferRetentionConfiguration {
  readonly artifactMilliseconds: number
  readonly operationMilliseconds: number
}

export type TransferPolicy<TActor extends object, TTenant> = (
  context: TransferExecutionContext<TActor, TTenant>,
) => boolean | Promise<boolean>

export interface ImportRowExecutionContext<TActor extends object, TTenant>
  extends TransferExecutionContext<TActor, TTenant> {
  readonly operationId: string
  readonly row: number
}

export interface ImportLimits {
  readonly maxCellBytes: number
  readonly maxColumns: number
  readonly maxFileBytes: number
  readonly maxRows: number
}

export type ImportMutationDecision<TRecord>
  = { readonly kind: 'create' }
    | { readonly kind: 'update', readonly record: TRecord }

export interface ImportMutationAdapter<
  TRecord,
  TValues extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
> {
  choose(values: TValues, context: ImportRowExecutionContext<TActor, TTenant>): Promise<ImportMutationDecision<TRecord>>
  create(values: TValues, context: ImportRowExecutionContext<TActor, TTenant>): Promise<TRecord>
  update(record: TRecord, values: TValues, context: ImportRowExecutionContext<TActor, TTenant>): Promise<TRecord>
  validate(values: TValues, context: ImportRowExecutionContext<TActor, TTenant>): void | Promise<void>
  duplicateKey(values: TValues, context: ImportRowExecutionContext<TActor, TTenant>): string | Promise<string>
  transaction<TResult>(operation: () => Promise<TResult>): Promise<TResult>
}

export interface TransferInputSource {
  readonly digest: TransferArtifactDigest
  readonly size: number
  chunks(options?: { readonly chunkBytes?: number }): AsyncIterable<Uint8Array>
}

export interface ImportFormatInspection {
  readonly headers: readonly string[]
  readonly rows: number
}

export interface ImportFormatAdapter<TOptions extends object> {
  readonly id: string
  readonly label: string
  inspect(source: TransferInputSource, options: TOptions): Promise<ImportFormatInspection>
  readChunk(
    source: TransferInputSource,
    options: TOptions,
    offset: number,
    limit: number,
  ): Promise<readonly Readonly<Record<string, string>>[]>
}

export interface CompiledImportFormat {
  readonly id: string
  readonly label: string
  inspect(source: TransferInputSource): Promise<ImportFormatInspection>
  readChunk(source: TransferInputSource, offset: number, limit: number): Promise<readonly Readonly<Record<string, string>>[]>
}

export interface CompiledImportColumn<TActor extends object, TTenant> {
  readonly example: string | null
  readonly key: string
  readonly label: string
  readonly required: boolean
  parse(value: string, context: ImportRowExecutionContext<TActor, TTenant>): unknown | Promise<unknown>
  resolve?(value: unknown, context: ImportRowExecutionContext<TActor, TTenant>): unknown | Promise<unknown>
}

export interface ImportColumnManifest {
  readonly example: string | null
  readonly key: string
  readonly label: string
  readonly required: boolean
}

export interface ImporterManifest {
  readonly columns: readonly ImportColumnManifest[]
  readonly formatIds: readonly string[]
  readonly id: string
  readonly kind: 'import'
  readonly label: string
  readonly maxFileBytes: number
  readonly maxRows: number
  readonly resourceId: string
}

export interface ImporterServerDefinition<
  TRecord,
  TValues extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
> {
  readonly authorize: TransferPolicy<TActor, TTenant>
  readonly authorizeCancellation: TransferPolicy<TActor, TTenant>
  readonly chunkSize: number
  readonly columns: readonly CompiledImportColumn<TActor, TTenant>[]
  readonly formats: readonly CompiledImportFormat[]
  readonly limits: ImportLimits
  readonly mutation: ImportMutationAdapter<TRecord, TValues, TActor, TTenant>
  readonly queue: TransferQueueConfiguration
  readonly retention: TransferRetentionConfiguration
  readonly storage: TransferStorageConfiguration
}

export interface ImporterDefinition<
  TRecord,
  TValues extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
> extends Omit<DiscoverableDefinition<'import'>, 'client'> {
  readonly client: Readonly<ImporterManifest>
  readonly resourceId: string
  readonly server: Readonly<ImporterServerDefinition<TRecord, TValues, TActor, TTenant>>
}

export type ExportCell = boolean | Date | number | string | null
export type ExportAggregateKind = 'average' | 'count' | 'exists' | 'max' | 'min' | 'sum'

export interface ExportAggregatePlan {
  readonly column?: string
  readonly kind: ExportAggregateKind
  readonly relation: string
}

type ExportPathDepth = 0 | 1 | 2 | 3 | 4
type PreviousExportPathDepth = { readonly 0: 0, readonly 1: 0, readonly 2: 1, readonly 3: 2, readonly 4: 3 }

export type ExportRecordPath<TRecord, TDepth extends ExportPathDepth = 4> = TDepth extends 0
  ? never
  : {
      [TKey in Extract<keyof TRecord, string>]:
        NonNullable<TRecord[TKey]> extends ExportCell
          ? TKey
          : NonNullable<TRecord[TKey]> extends (...parameters: never[]) => unknown
            ? never
            : NonNullable<TRecord[TKey]> extends object
              ? `${TKey}.${ExportRecordPath<NonNullable<TRecord[TKey]>, PreviousExportPathDepth[TDepth]>}`
              : never
    }[Extract<keyof TRecord, string>]

export type ExportRelationPath<TRecord, TDepth extends ExportPathDepth = 4> = TDepth extends 0
  ? never
  : {
      [TKey in Extract<keyof TRecord, string>]:
        NonNullable<TRecord[TKey]> extends readonly (infer TRelated)[]
          ? TRelated extends object
            ? TKey | `${TKey}.${ExportRelationPath<TRelated, PreviousExportPathDepth[TDepth]>}`
            : never
          : NonNullable<TRecord[TKey]> extends (...parameters: never[]) => unknown
            ? never
            : NonNullable<TRecord[TKey]> extends object
              ? NonNullable<TRecord[TKey]> extends Date
                ? never
                : TKey | `${TKey}.${ExportRelationPath<NonNullable<TRecord[TKey]>, PreviousExportPathDepth[TDepth]>}`
              : never
    }[Extract<keyof TRecord, string>]

export type ExportPathValue<TRecord, TPath extends string> = TPath extends `${infer THead}.${infer TTail}`
  ? THead extends keyof TRecord ? ExportPathValue<NonNullable<TRecord[THead]>, TTail> : never
  : TPath extends keyof TRecord ? TRecord[TPath] : never

export interface ExportColumnBatchContext<TRecord, TActor extends object, TTenant>
  extends TransferExecutionContext<TActor, TTenant> {
  readonly records: readonly Readonly<TRecord>[]
}

export interface ExportColumnBatchValueContext<TRecord, TValue extends ExportCell, TActor extends object, TTenant>
  extends ExportColumnBatchContext<TRecord, TActor, TTenant> {
  readonly values: readonly TValue[]
}

export interface ExportColumnOption<TValue extends ExportCell> {
  readonly label: string
  readonly value: TValue
}

export interface CompiledExportColumn<TRecord, TActor extends object, TTenant> {
  readonly aggregate?: ExportAggregatePlan
  readonly id: string
  readonly label: string
  readonly path?: ExportRecordPath<TRecord>
  readonly relation?: ExportRelationPath<TRecord>
  readonly visibleByDefault: boolean
  state?(context: ExportColumnBatchContext<TRecord, TActor, TTenant>): readonly ExportCell[] | Promise<readonly ExportCell[]>
  options?(context: ExportColumnBatchValueContext<TRecord, ExportCell, TActor, TTenant>): readonly ExportColumnOption<ExportCell>[] | Promise<readonly ExportColumnOption<ExportCell>[]>
  format?(context: ExportColumnBatchValueContext<TRecord, ExportCell, TActor, TTenant>): readonly ExportCell[] | Promise<readonly ExportCell[]>
}

export interface ExportQueryAdapter<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant> {
  readonly primaryKey: string
  authorize(context: TransferExecutionContext<TActor, TTenant>): boolean | void | Promise<boolean | void>
  createQuery(): TQuery
  applyAuthorizationScope(query: TQuery, context: TransferExecutionContext<TActor, TTenant>): TQuery
  applyTenantScope(query: TQuery, context: TransferExecutionContext<TActor, TTenant>): TQuery
  applyTableState(query: TQuery, state: TableQueryState, context: TransferExecutionContext<TActor, TTenant>): TQuery
  applySelection(query: TQuery, selection: TableSelection<TRecordId>, context: TransferExecutionContext<TActor, TTenant>): TQuery
  applyRelations(query: TQuery, relations: readonly string[]): TQuery
  applyAggregates(query: TQuery, aggregates: readonly ExportAggregatePlan[]): TQuery
  orderBy(query: TQuery, column: string, direction: 'asc'): TQuery
  override?(query: TQuery, context: TransferExecutionContext<TActor, TTenant>): TQuery | Promise<TQuery>
  count(query: TQuery): Promise<number>
  fetchChunk(query: TQuery, offset: number, limit: number): Promise<readonly TRecord[]>
}

export interface ExportFormatInput {
  readonly headers: readonly string[]
  readonly rows: AsyncIterable<readonly (readonly ExportCell[])[]>
}

export interface ExportFormatArtifact {
  readonly contentType: string
  readonly extension: string
  readonly filename: string
}

export interface TransferStoredArtifact {
  readonly contentType: string
  readonly digest: TransferArtifactDigest
  readonly disk: string
  readonly filename: string
  readonly path: string
  readonly size: number
}

export interface TransferArtifactDigest {
  readonly algorithm: 'sha256'
  readonly value: string
}

export type TransferIdentityValue = number | string

export interface TransferIdentity {
  readonly type: 'number' | 'string'
  readonly value: TransferIdentityValue
}

export interface TransferOperationIdentity {
  readonly actor: TransferIdentity
  readonly guard: string
  readonly panelId: string
  readonly provider: string | null
  readonly tenant: TransferIdentity | null
}

export type TransferOperationKind = 'export' | 'import'
export type TransferOperationStatus = 'cancelled' | 'completed' | 'failed' | 'queued' | 'running'

export interface TransferOperationProgress {
  readonly completed: number
  readonly total: number
}

export interface TransferFailureRows {
  readonly artifact: TransferStoredArtifact
  readonly count: number
}

export interface TransferResultPart {
  readonly artifact: TransferStoredArtifact
  readonly chunk: number
  readonly rows: number
}

export interface TransferSanitizedError {
  readonly code: string
  readonly message: string
}

export interface TransferImportExecutionInput {
  readonly formatId: string
  readonly kind: 'import'
  readonly mappings: readonly ImportColumnMapping[]
  readonly source: TransferStoredArtifact
}

export interface TransferExportExecutionInput<
  TRecordId extends TableRecordIdentifier = TableRecordIdentifier,
> {
  readonly columnIds: readonly string[]
  readonly formatId: string
  readonly kind: 'export'
  readonly selection: TableSelection<TRecordId>
  readonly tableState: TableQueryState
}

export type TransferExecutionInput<
  TRecordId extends TableRecordIdentifier = TableRecordIdentifier,
> = TransferImportExecutionInput | TransferExportExecutionInput<TRecordId>

export interface TransferOperationRecord<
  TRecordId extends TableRecordIdentifier = TableRecordIdentifier,
> {
  readonly artifact: TransferStoredArtifact | null
  readonly cleanupAfter: Date | null
  readonly createdAt: Date
  readonly definitionId: string
  readonly definitionRevision: string
  readonly failure: TransferSanitizedError | null
  readonly failureRows: TransferFailureRows | null
  readonly id: string
  readonly identity: TransferOperationIdentity
  readonly input: TransferExecutionInput<TRecordId>
  readonly kind: TransferOperationKind
  readonly parts: readonly TransferResultPart[]
  readonly progress: TransferOperationProgress
  readonly resourceId: string
  readonly revision: number
  readonly status: TransferOperationStatus
  readonly updatedAt: Date
}

export interface TransferNextChunk {
  readonly chunk: number
  readonly configuration: TransferQueueConfiguration
}

export type TransferProgressTransition
  = {
      readonly completed: number
      readonly kind: 'import'
      readonly next: TransferNextChunk | null
    }
    | {
      readonly completed: number
      readonly kind: 'export'
      readonly next: TransferNextChunk | null
      readonly part: TransferResultPart
    }

export type TransferOutboxEvent
  = {
      readonly configuration: TransferQueueConfiguration
      readonly envelope: TransferQueueEnvelope
      readonly kind: 'queue'
    }
    | {
      readonly kind: 'notification'
      readonly status: 'completed' | 'failed'
    }

export interface TransferOutboxRecord {
  readonly attempt: number
  readonly availableAt: Date
  readonly createdAt: Date
  readonly event: TransferOutboxEvent
  readonly id: string
  readonly leaseExpiresAt: Date | null
  readonly operationId: string
  readonly operationRevision: number
  readonly revision: number
  readonly updatedAt: Date
}

export interface TransferOutboxLease {
  readonly leaseId: string
  readonly records: readonly TransferOutboxRecord[]
}

export interface TransferOutboxFailure {
  readonly retryAt: Date
  readonly sanitizedCode: string
}

export interface TransferOperationStore<TRecordId extends TableRecordIdentifier = TableRecordIdentifier> {
  create(operation: TransferOperationRecord<TRecordId>, outbox: readonly TransferOutboxRecord[]): Promise<void>
  find(operationId: string): Promise<TransferOperationRecord<TRecordId> | null>
  compareAndSwap(
    operationId: string,
    expectedRevision: number,
    operation: TransferOperationRecord<TRecordId>,
    outbox: readonly TransferOutboxRecord[],
  ): Promise<boolean>
  claimOutbox(input: {
    readonly availableBefore: Date
    readonly leaseMilliseconds: number
    readonly limit: number
  }): Promise<TransferOutboxLease>
  acknowledgeOutbox(input: {
    readonly leaseId: string
    readonly outboxId: string
    readonly expectedRevision: number
  }): Promise<boolean>
  releaseOutbox(input: {
    readonly expectedRevision: number
    readonly failure: TransferOutboxFailure
    readonly leaseId: string
    readonly outboxId: string
  }): Promise<boolean>
  cleanupEligible(before: Date, limit: number): Promise<readonly TransferOperationRecord<TRecordId>[]>
  delete(operationId: string, expectedRevision: number): Promise<boolean>
}

export interface TransferUploadResolver {
  resolve(sourceId: string, identity: TransferOperationIdentity): Promise<TransferStoredArtifact | null>
}

export interface TransferStorageAdapter {
  readonly visibility: 'private'
  source(artifact: TransferStoredArtifact): Promise<TransferInputSource | null>
  writer(input: {
    readonly contentType: string
    readonly disk: string
    readonly filename: string
    readonly operationId: string
    readonly purpose: 'failure-rows' | 'input' | 'part' | 'result'
  }): Promise<TransferArtifactWriter>
  delete(artifacts: readonly TransferStoredArtifact[]): Promise<void>
}

export interface TransferQueueEnvelope extends JsonObject {
  readonly attempt: number
  readonly chunk: number
  readonly definitionId: string
  readonly definitionRevision: string
  readonly kind: TransferOperationKind
  readonly operationId: string
  readonly operationRevision: number
  readonly panelId: string
  readonly version: 2
}

export interface StartImportRequest {
  readonly formatId: string
  readonly importerId: string
  readonly mappings: ImportColumnMapping[]
  readonly sourceId: string
}

export interface StartExportRequest<TRecordId extends TableRecordIdentifier = TableRecordIdentifier> {
  readonly columnIds?: string[]
  readonly exporterId: string
  readonly formatId: string
  readonly selection: TableSelection<TRecordId>
  readonly tableState: TableQueryState
}

export interface TransferOperationRequest {
  readonly operationId: string
}

export interface TransferQueueAdapter {
  enqueue(envelope: TransferQueueEnvelope, configuration: TransferQueueConfiguration): Promise<{ readonly jobId: string }>
}

export interface TransferCompletionNotifier<TActor extends object, TTenant> {
  completed(operation: TransferOperationRecord, context: TransferExecutionContext<TActor, TTenant>, deduplicationKey: string): Promise<void>
  failed(operation: TransferOperationRecord, context: TransferExecutionContext<TActor, TTenant>, deduplicationKey: string): Promise<void>
}

export interface TransferArtifactWriter {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<TransferStoredArtifact>
  abort(): Promise<void>
}

export interface ExportFormatAdapter<TOptions extends object> {
  readonly id: string
  readonly label: string
  readonly artifact: ExportFormatArtifact
  write(input: ExportFormatInput, output: TransferArtifactWriter, options: TOptions): Promise<void>
}

export interface CompiledExportFormat {
  readonly artifact: ExportFormatArtifact
  readonly id: string
  readonly label: string
  write(input: ExportFormatInput, output: TransferArtifactWriter): Promise<void>
}

export interface ExportColumnManifest {
  readonly id: string
  readonly label: string
  readonly visibleByDefault: boolean
}

export interface ExporterManifest {
  readonly columns: readonly ExportColumnManifest[]
  readonly formatIds: readonly string[]
  readonly id: string
  readonly kind: 'export'
  readonly label: string
  readonly maxRows: number
  readonly resourceId: string
}

export interface ExporterServerDefinition<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant> {
  readonly authorize: TransferPolicy<TActor, TTenant>
  readonly authorizeCancellation: TransferPolicy<TActor, TTenant>
  readonly chunkSize: number
  readonly columns: readonly CompiledExportColumn<TRecord, TActor, TTenant>[]
  readonly formats: readonly CompiledExportFormat[]
  readonly maxRows: number
  readonly query: ExportQueryAdapter<TQuery, TRecord, TRecordId, TActor, TTenant>
  readonly queue: TransferQueueConfiguration
  readonly retention: TransferRetentionConfiguration
  readonly storage: TransferStorageConfiguration
}

export interface ExporterDefinition<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant>
  extends Omit<DiscoverableDefinition<'export'>, 'client'> {
  readonly client: Readonly<ExporterManifest>
  readonly resourceId: string
  readonly server: Readonly<ExporterServerDefinition<TQuery, TRecord, TRecordId, TActor, TTenant>>
}

export interface CsvImportLimits {
  readonly maxBytes: number
  readonly maxCellBytes: number
  readonly maxColumns: number
  readonly maxRows: number
}

export interface CsvImportOptions {
  readonly delimiter?: string
  readonly headerOffset?: number
  readonly limits: CsvImportLimits
}

export interface CsvExportOptions {
  readonly delimiter?: string
  readonly escapeFormulas?: boolean
  readonly lineEnding?: '\n' | '\r\n'
}

export interface XlsxExportOptions {
  readonly dateFormat?: string
  readonly sheetName?: string
}
