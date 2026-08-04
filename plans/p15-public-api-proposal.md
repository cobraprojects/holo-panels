# P15 public API proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

The cohesive P15 public API should be additive and organized into four surfaces: authoring builders, serialized transport/manifests, server runtime contracts, and Holo integration.

## 1. Authoring API

```ts
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

export type TransferPolicy<TActor extends object, TTenant>
  = (
      context: TransferExecutionContext<TActor, TTenant>,
    ) => boolean | Promise<boolean>
```

Importer columns remain typed to the resource input:

```ts
export interface ImportColumnValueContext<
  TValue,
  TActor extends object,
  TTenant,
> extends TransferExecutionContext<TActor, TTenant> {
  readonly row: number
  readonly value: TValue
}

export class ImportColumnBuilder<
  TValue,
  TActor extends object,
  TTenant,
> {
  label(label: string): this
  required(required?: boolean): this
  example(example: string): this

  parse(
    parser: (
      value: string,
      context: Omit<
        ImportColumnValueContext<TValue, TActor, TTenant>,
        'value'
      >,
    ) => TValue | Promise<TValue>,
  ): this

  resolve(
    resolver: (
      context: ImportColumnValueContext<TValue, TActor, TTenant>,
    ) => TValue | Promise<TValue>,
  ): this
}
```

The mutation contract preserves Holo validation, policies, transactions, create/update hooks, and idempotency:

```ts
export type ImportMutationDecision<TRecord>
  = { readonly kind: 'create' }
    | { readonly kind: 'update', readonly record: TRecord }

export interface ImportMutationAdapter<
  TRecord,
  TValues extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
> {
  choose(
    values: TValues,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): Promise<ImportMutationDecision<TRecord>>

  create(
    values: TValues,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): Promise<TRecord>

  update(
    record: TRecord,
    values: TValues,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): Promise<TRecord>

  validate(
    values: TValues,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): void | Promise<void>

  duplicateKey(
    values: TValues,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): string | Promise<string>

  transaction<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult>
}

export interface ImportRowExecutionContext<
  TActor extends object,
  TTenant,
> extends TransferExecutionContext<TActor, TTenant> {
  readonly operationId: string
  readonly row: number
}
```

Importer definition:

```ts
export interface ImportLimits {
  readonly maxCellBytes: number
  readonly maxColumns: number
  readonly maxFileBytes: number
  readonly maxRows: number
}

export class ImporterBuilder<
  TRecord,
  TValues extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
> implements DiscoverableBuilder<'import'> {
  readonly discoveryMarker: typeof DISCOVERY_MARKER
  readonly id: string
  readonly kind: 'import'

  label(label: string): this

  column<TKey extends Extract<keyof TValues, string>>(
    key: TKey,
    configure: (
      column: ImportColumnBuilder<TValues[TKey], TActor, TTenant>,
    ) => ImportColumnBuilder<TValues[TKey], TActor, TTenant>,
  ): this

  format<TOptions extends object>(
    adapter: ImportFormatAdapter<TOptions>,
    options: TOptions,
  ): this

  limits(limits: ImportLimits): this
  chunkSize(rows: number): this
  queue(configuration: TransferQueueConfiguration): this
  storage(configuration: TransferStorageConfiguration): this
  retention(configuration: TransferRetentionConfiguration): this
  authorize(policy: TransferPolicy<TActor, TTenant>): this
  authorizeCancellation(policy: TransferPolicy<TActor, TTenant>): this

  mutation(
    adapter: ImportMutationAdapter<
      TRecord,
      TValues,
      TActor,
      TTenant
    >,
  ): this

  compile(): ImporterDefinition<TRecord, TValues, TActor, TTenant>
  compileDiscoveryDefinition(): ImporterDefinition<
    TRecord,
    TValues,
    TActor,
    TTenant
  >
}
```

Resource inference should come from the resource builder, avoiding repeated manual generics:

```ts
export function defineImporter<
  TModel extends { readonly definition: ResourceModelDefinition },
  TRecord extends ResourceRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
>(
  id: string,
  resource: ResourceBuilder<
    TModel,
    TRecord,
    TQuery,
    TInput,
    TActor,
    TTenant,
    TSoftDeletes
  >,
): ImporterBuilder<TRecord, TInput, TActor, TTenant>
```

The compiled importer contracts are:

```ts
export interface CompiledImportColumn<
  TActor extends object,
  TTenant,
> {
  readonly example: string | null
  readonly key: string
  readonly label: string
  readonly required: boolean
  parse(
    value: string,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): unknown | Promise<unknown>
  resolve?(
    value: unknown,
    context: ImportRowExecutionContext<TActor, TTenant>,
  ): unknown | Promise<unknown>
}

export interface CompiledImportFormat {
  readonly id: string
  readonly label: string
  inspect(source: TransferInputSource): Promise<ImportFormatInspection>
  readChunk(
    source: TransferInputSource,
    offset: number,
    limit: number,
  ): Promise<readonly Readonly<Record<string, string>>[]>
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
> extends DiscoverableDefinition<'import'> {
  readonly client: Readonly<ImporterManifest>
  readonly resourceId: string
  readonly server: Readonly<
    ImporterServerDefinition<TRecord, TValues, TActor, TTenant>
  >
}
```

Exporter columns and query adapter:

```ts
export type ExportCell = boolean | Date | number | string | null

type ExportPathDepth = 0 | 1 | 2 | 3 | 4

type PreviousExportPathDepth = {
  readonly 0: 0
  readonly 1: 0
  readonly 2: 1
  readonly 3: 2
  readonly 4: 3
}

export type ExportRecordPath<
  TRecord,
  TDepth extends ExportPathDepth = 4,
> = TDepth extends 0
  ? never
  : {
      [TKey in Extract<keyof TRecord, string>]:
        NonNullable<TRecord[TKey]> extends ExportCell
          ? TKey
          : NonNullable<TRecord[TKey]> extends (...parameters: never[]) => unknown
            ? never
            : NonNullable<TRecord[TKey]> extends object
              ? `${TKey}.${ExportRecordPath<
                  NonNullable<TRecord[TKey]>,
                  PreviousExportPathDepth[TDepth]
                >}`
              : never
    }[Extract<keyof TRecord, string>]

export type ExportRelationPath<
  TRecord,
  TDepth extends ExportPathDepth = 4,
> = TDepth extends 0
  ? never
  : {
      [TKey in Extract<keyof TRecord, string>]:
        NonNullable<TRecord[TKey]> extends readonly (infer TRelated)[]
          ? TRelated extends object
            ? TKey | `${TKey}.${ExportRelationPath<
                TRelated,
                PreviousExportPathDepth[TDepth]
              >}`
            : never
          : NonNullable<TRecord[TKey]> extends (...parameters: never[]) => unknown
            ? never
            : NonNullable<TRecord[TKey]> extends object
              ? NonNullable<TRecord[TKey]> extends Date
                ? never
                : TKey | `${TKey}.${ExportRelationPath<
                    NonNullable<TRecord[TKey]>,
                    PreviousExportPathDepth[TDepth]
                  >}`
              : never
    }[Extract<keyof TRecord, string>]

export type ExportPathValue<
  TRecord,
  TPath extends string,
> = TPath extends `${infer THead}.${infer TTail}`
  ? THead extends keyof TRecord
    ? ExportPathValue<NonNullable<TRecord[THead]>, TTail>
    : never
  : TPath extends keyof TRecord
    ? TRecord[TPath]
    : never

export interface ExportColumnContext<
  TRecord,
  TActor extends object,
  TTenant,
> extends TransferExecutionContext<TActor, TTenant> {
  readonly record: Readonly<TRecord>
}

export interface ExportColumnValueContext<
  TRecord,
  TValue extends ExportCell,
  TActor extends object,
  TTenant,
> extends ExportColumnContext<TRecord, TActor, TTenant> {
  readonly value: TValue
}

export interface ExportColumnOption<TValue extends ExportCell> {
  readonly label: string
  readonly value: TValue
}

export class ExportColumnBuilder<
  TRecord,
  TValue extends ExportCell,
  TActor extends object,
  TTenant,
> {
  label(label: string): this
  visibleByDefault(visible?: boolean): this
  relation<TPath extends ExportRelationPath<TRecord>>(path: TPath): this

  aggregate<TPath extends ExportRelationPath<TRecord>>(
    kind: ExportAggregateKind,
    relation: TPath,
    column?: string,
  ): this

  options(
    resolver: (
      context: ExportColumnContext<TRecord, TActor, TTenant>,
    ) => readonly ExportColumnOption<TValue>[]
      | Promise<readonly ExportColumnOption<TValue>[]>,
  ): this

  format(
    formatter: (
      context: ExportColumnValueContext<
        TRecord,
        TValue,
        TActor,
        TTenant
      >,
    ) => ExportCell | Promise<ExportCell>,
  ): this
}

export interface ExportQueryAdapter<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  readonly primaryKey: string

  authorize(
    context: TransferExecutionContext<TActor, TTenant>,
  ): boolean | void | Promise<boolean | void>

  createQuery(): TQuery

  applyAuthorizationScope(
    query: TQuery,
    context: TransferExecutionContext<TActor, TTenant>,
  ): TQuery

  applyTenantScope(
    query: TQuery,
    context: TransferExecutionContext<TActor, TTenant>,
  ): TQuery

  applyTableState(
    query: TQuery,
    state: TableQueryState,
    context: TransferExecutionContext<TActor, TTenant>,
  ): TQuery

  applySelection(
    query: TQuery,
    selection: TableSelection<TRecordId>,
    context: TransferExecutionContext<TActor, TTenant>,
  ): TQuery

  applyRelations(
    query: TQuery,
    relations: readonly string[],
  ): TQuery

  applyAggregates(
    query: TQuery,
    aggregates: readonly ExportAggregatePlan[],
  ): TQuery

  orderBy(
    query: TQuery,
    column: string,
    direction: 'asc',
  ): TQuery

  override?(
    query: TQuery,
    context: TransferExecutionContext<TActor, TTenant>,
  ): TQuery | Promise<TQuery>

  count(query: TQuery): Promise<number>

  fetchChunk(
    query: TQuery,
    offset: number,
    limit: number,
  ): Promise<readonly TRecord[]>
}
```

Exporter definition:

```ts
export class ExporterBuilder<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> implements DiscoverableBuilder<'export'> {
  readonly discoveryMarker: typeof DISCOVERY_MARKER
  readonly id: string
  readonly kind: 'export'

  label(label: string): this

  column<const TPath extends ExportRecordPath<TRecord>>(
    id: string,
    path: TPath,
    configure?: (
      column: ExportColumnBuilder<
        TRecord,
        Extract<ExportPathValue<TRecord, TPath>, ExportCell>,
        TActor,
        TTenant
      >,
    ) => ExportColumnBuilder<
      TRecord,
      Extract<ExportPathValue<TRecord, TPath>, ExportCell>,
      TActor,
      TTenant
    >,
  ): this

  computed<TValue extends ExportCell>(
    id: string,
    state: (
      context: ExportColumnContext<TRecord, TActor, TTenant>,
    ) => TValue | Promise<TValue>,
    configure?: (
      column: ExportColumnBuilder<
        TRecord,
        TValue,
        TActor,
        TTenant
      >,
    ) => ExportColumnBuilder<
      TRecord,
      TValue,
      TActor,
      TTenant
    >,
  ): this

  query(
    adapter: ExportQueryAdapter<
      TQuery,
      TRecord,
      TRecordId,
      TActor,
      TTenant
    >,
  ): this

  format<TOptions extends object>(
    adapter: ExportFormatAdapter<TOptions>,
    options: TOptions,
  ): this

  maxRows(rows: number): this
  chunkSize(rows: number): this
  queue(configuration: TransferQueueConfiguration): this
  storage(configuration: TransferStorageConfiguration): this
  retention(configuration: TransferRetentionConfiguration): this
  authorize(policy: TransferPolicy<TActor, TTenant>): this
  authorizeCancellation(policy: TransferPolicy<TActor, TTenant>): this

  compile(): ExporterDefinition<
    TQuery,
    TRecord,
    TRecordId,
    TActor,
    TTenant
  >

  compileDiscoveryDefinition(): ExporterDefinition<
    TQuery,
    TRecord,
    TRecordId,
    TActor,
    TTenant
  >
}

export function defineExporter<
  TModel extends { readonly definition: ResourceModelDefinition },
  TRecord extends ResourceRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
>(
  id: string,
  resource: ResourceBuilder<
    TModel,
    TRecord,
    TQuery,
    TInput,
    TActor,
    TTenant,
    TSoftDeletes
  >,
): ExporterBuilder<
  TQuery,
  TRecord,
  ResourceIdentifier,
  TActor,
  TTenant
>
```

The compiled exporter contracts are:

```ts
export interface CompiledExportFormat {
  readonly artifact: ExportFormatArtifact
  readonly id: string
  readonly label: string
  write(
    input: ExportFormatInput,
    output: TransferArtifactWriter,
  ): Promise<void>
}

export interface CompiledExportColumn<
  TRecord,
  TActor extends object,
  TTenant,
> {
  readonly aggregate?: ExportAggregatePlan
  readonly id: string
  readonly label: string
  readonly path?: ExportRecordPath<TRecord>
  readonly relation?: ExportRelationPath<TRecord>
  readonly visibleByDefault: boolean
  format?(
    context: ExportColumnValueContext<
      TRecord,
      ExportCell,
      TActor,
      TTenant
    >,
  ): ExportCell | Promise<ExportCell>
  options?(
    context: ExportColumnContext<TRecord, TActor, TTenant>,
  ): readonly ExportColumnOption<ExportCell>[]
    | Promise<readonly ExportColumnOption<ExportCell>[]>
  state?(
    context: ExportColumnContext<TRecord, TActor, TTenant>,
  ): ExportCell | Promise<ExportCell>
}

export interface ExporterServerDefinition<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  readonly authorize: TransferPolicy<TActor, TTenant>
  readonly authorizeCancellation: TransferPolicy<TActor, TTenant>
  readonly chunkSize: number
  readonly columns: readonly CompiledExportColumn<
    TRecord,
    TActor,
    TTenant
  >[]
  readonly formats: readonly CompiledExportFormat[]
  readonly maxRows: number
  readonly query: ExportQueryAdapter<
    TQuery,
    TRecord,
    TRecordId,
    TActor,
    TTenant
  >
  readonly queue: TransferQueueConfiguration
  readonly retention: TransferRetentionConfiguration
  readonly storage: TransferStorageConfiguration
}

export interface ExporterDefinition<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> extends DiscoverableDefinition<'export'> {
  readonly client: Readonly<ExporterManifest>
  readonly resourceId: string
  readonly server: Readonly<
    ExporterServerDefinition<
      TQuery,
      TRecord,
      TRecordId,
      TActor,
      TTenant
    >
  >
}
```

## 2. Format contracts

These are format adapters, not competing storage or queue systems.

The existing parser/writer configuration shapes become public unchanged:

```ts
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

export interface ImportColumnMapping {
  readonly column: string
  readonly header: string
}

export type ExportAggregateKind
  = 'average'
    | 'count'
    | 'exists'
    | 'max'
    | 'min'
    | 'sum'

export interface ExportAggregatePlan {
  readonly column?: string
  readonly kind: ExportAggregateKind
  readonly relation: string
}
```

```ts
export interface TransferInputSource {
  readonly size: number
  bytes(): Promise<Uint8Array>
}

export interface ImportFormatInspection {
  readonly headers: readonly string[]
  readonly rows: number
}

export interface ImportFormatAdapter<TOptions extends object> {
  readonly id: string
  readonly label: string

  inspect(
    source: TransferInputSource,
    options: TOptions,
  ): Promise<ImportFormatInspection>

  readChunk(
    source: TransferInputSource,
    options: TOptions,
    offset: number,
    limit: number,
  ): Promise<
    readonly Readonly<Record<string, string>>[]
  >
}

export interface ExportFormatInput {
  readonly headers: readonly string[]
  readonly rows: AsyncIterable<
    readonly (readonly ExportCell[])[]
  >
}

export interface ExportFormatArtifact {
  readonly contentType: string
  readonly extension: string
  readonly filename: string
}

export interface ExportFormatAdapter<TOptions extends object> {
  readonly id: string
  readonly label: string
  readonly artifact: ExportFormatArtifact

  write(
    input: ExportFormatInput,
    output: TransferArtifactWriter,
    options: TOptions,
  ): Promise<void>
}

export interface TransferArtifactWriter {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<TransferStoredArtifact>
  abort(): Promise<void>
}

export function csvImportFormat(
  options?: CsvImportOptions,
): ImportFormatAdapter<CsvImportOptions>

export function csvExportFormat(
  options?: CsvExportOptions,
): ExportFormatAdapter<CsvExportOptions>

export function xlsxExportFormat(
  options?: XlsxExportOptions,
): ExportFormatAdapter<XlsxExportOptions>
```

```ts
export interface XlsxExportOptions {
  readonly dateFormat?: string
  readonly sheetName?: string
}
```

The existing `TableQueryState`, `TableSelection`, `TableRecordIdentifier`,
`JsonObject`, and `JsonValue` declarations are reused by exact name and remain
unchanged in `@holo-js/panels-core`.

Formula escaping remains enabled by default in `csvExportFormat()` and requires an explicit server-side opt-out.

## 3. Operation records and runtime adapters

Polymorphic identity is persisted with its primitive type:

```ts
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

export type TransferOperationStatus
  = 'cancelled'
    | 'completed'
    | 'failed'
    | 'queued'
    | 'running'

export interface TransferOperationProgress {
  readonly completed: number
  readonly total: number
}

export interface TransferStoredArtifact {
  readonly contentType: string
  readonly disk: string
  readonly filename: string
  readonly path: string
  readonly size: number
}

export interface TransferFailureRows {
  readonly count: number
  readonly artifact: TransferStoredArtifact
}

export interface TransferSanitizedError {
  readonly code: string
  readonly message: string
}

export interface TransferOperationRecord {
  readonly artifact: TransferStoredArtifact | null
  readonly cleanupAfter: Date | null
  readonly createdAt: Date
  readonly definitionId: string
  readonly failure: TransferSanitizedError | null
  readonly failureRows: TransferFailureRows | null
  readonly id: string
  readonly identity: TransferOperationIdentity
  readonly kind: TransferOperationKind
  readonly progress: TransferOperationProgress
  readonly resourceId: string
  readonly revision: number
  readonly status: TransferOperationStatus
  readonly updatedAt: Date
}
```

Persistent storage requires atomic revisions:

```ts
export interface TransferOperationStore {
  create(
    operation: TransferOperationRecord,
  ): Promise<void>

  find(
    operationId: string,
  ): Promise<TransferOperationRecord | null>

  compareAndSwap(
    operationId: string,
    expectedRevision: number,
    operation: TransferOperationRecord,
  ): Promise<boolean>

  cleanupEligible(
    before: Date,
    limit: number,
  ): Promise<readonly TransferOperationRecord[]>

  delete(
    operationId: string,
    expectedRevision: number,
  ): Promise<boolean>
}
```

Holo Storage integration is represented by a narrow private-disk contract:

```ts
export interface TransferUploadResolver {
  resolve(
    sourceId: string,
    identity: TransferOperationIdentity,
  ): Promise<TransferStoredArtifact | null>
}

export interface TransferStorageAdapter {
  readonly visibility: 'private'

  source(
    artifact: TransferStoredArtifact,
  ): Promise<TransferInputSource | null>

  writer(input: {
    readonly contentType: string
    readonly disk: string
    readonly filename: string
    readonly operationId: string
    readonly purpose: 'failure-rows' | 'result' | 'temporary'
  }): Promise<TransferArtifactWriter>

  read(
    artifact: TransferStoredArtifact,
  ): Promise<Uint8Array | null>

  delete(
    artifacts: readonly TransferStoredArtifact[],
  ): Promise<void>
}
```

The production adapter must wrap `@holo-js/storage/runtime` and reject any disk whose visibility is not `private`.

Queue payloads are fixed, versioned, and contain no callbacks or arbitrary job names:

```ts
export interface TransferQueueEnvelope extends JsonObject {
  attempt: number
  chunk: number
  definitionId: string
  kind: TransferOperationKind
  operationId: string
  panelId: string
  version: 1
}

export interface TransferQueueAdapter {
  enqueue(
    envelope: TransferQueueEnvelope,
    configuration: TransferQueueConfiguration,
  ): Promise<{ readonly jobId: string }>
}
```

The production adapter wraps one fixed registered Holo Queue job. Builder-supplied queue configuration may select only a configured connection and queue; the browser cannot provide either.

Completion notification integration:

```ts
export interface TransferCompletionNotifier<
  TActor extends object,
  TTenant,
> {
  completed(
    operation: TransferOperationRecord,
    context: TransferExecutionContext<TActor, TTenant>,
  ): Promise<void>

  failed(
    operation: TransferOperationRecord,
    context: TransferExecutionContext<TActor, TTenant>,
  ): Promise<void>
}
```

## 4. Serialized client surface

Only JSON-safe presentation is serialized:

```ts
export interface ImportColumnManifest extends JsonObject {
  example: string | null
  key: string
  label: string
  required: boolean
}

export interface ImporterManifest extends JsonObject {
  columns: ImportColumnManifest[]
  formatIds: string[]
  id: string
  kind: 'import'
  label: string
  maxFileBytes: number
  maxRows: number
  resourceId: string
}

export interface ExportColumnManifest extends JsonObject {
  id: string
  label: string
  visibleByDefault: boolean
}

export interface ExporterManifest extends JsonObject {
  columns: ExportColumnManifest[]
  formatIds: string[]
  id: string
  kind: 'export'
  label: string
  maxRows: number
  resourceId: string
}

export interface TransferDownloadPresentation
  extends JsonObject {
  expiresAt: string
  url: string
}

export interface TransferOperationPresentation
  extends JsonObject {
  artifact: {
    contentType: string
    download: TransferDownloadPresentation
    filename: string
    size: number
  } | null
  createdAt: string
  failure: TransferSanitizedError | null
  failureRows: {
    count: number
    download: TransferDownloadPresentation
  } | null
  id: string
  kind: TransferOperationKind
  progress: TransferOperationProgress
  status: TransferOperationStatus
  updatedAt: string
}
```

Requests:

```ts
export interface InspectImportRequest extends JsonObject {
  formatId: string
  importerId: string
  sourceId: string
}

export interface StartImportRequest extends JsonObject {
  formatId: string
  importerId: string
  mappings: ImportColumnMapping[]
  sourceId: string
}

export interface StartExportRequest<
  TRecordId extends TableRecordIdentifier,
> extends JsonObject {
  columnIds?: string[]
  exporterId: string
  formatId: string
  selection: TableSelection<TRecordId>
  tableState: TableQueryState
}

export interface TransferOperationRequest extends JsonObject {
  operationId: string
}

export interface IssueTransferDownloadRequest extends JsonObject {
  artifact: 'failure-rows' | 'result'
  operationId: string
}

export interface TransferDownloadRequest {
  readonly artifact: 'failure-rows' | 'result'
  readonly operationId: string
  readonly token: string
}

export interface TransferDownloadResponse {
  readonly body: Uint8Array
  readonly headers: Readonly<{
    'cache-control': 'private, no-store'
    'content-disposition': string
    'content-length': string
    'content-type': string
    'x-content-type-options': 'nosniff'
  }>
}
```

The fixed framework route derives panel, guard, provider, actor, resource, and active tenant. Those fields are never accepted from these requests.

Not serialized:

- Actor or tenant objects.
- Actor/tenant identity records.
- Storage disk/path keys.
- Queue connection, queue, retry, or job names.
- Mutation/query/validation/relationship callbacks.
- Policies and cancellation policies.
- Format implementations.
- Operation store, storage, queue, upload, notification, or signing adapters.
- Stack traces and raw failures.

## 5. Action and discovery registration

Additive action unions:

```ts
export type ActionKind
  = 'create'
  | 'export'
  | 'import'
  | 'custom'
  | 'delete'
  | 'edit'
  | 'force-delete'
  | 'replicate'
  | 'restore'
  | 'view'

export type ActionMount
  = 'bulk'
    | 'modal'
    | 'notification'
    | 'page'
    | 'record'
    | 'table'
```

Each compiled importer/exporter contributes one stable table action using the existing action registry. Built-ins and custom transfer definitions therefore use the same registry and authorization route.

Discovery additions:

```ts
export interface DiscoveryDirectories {
  readonly clusters?: string
  readonly exports?: string
  readonly imports?: string
  readonly pages?: string
  readonly relationManagers?: string
  readonly resources?: string
  readonly widgets?: string
}

export class PanelBuilder<TActor> {
  discoverImporters(path?: string): this
  discoverExporters(path?: string): this
}
```

Generated artifacts add `imports.ts` and `exports.ts`. The server registry registers transfer definitions and their table actions; the client manifest contains only the manifests above.

Generator commands become:

```text
holo make:importer <Name> --resource <Resource> [--panel admin]
holo make:exporter <Name> --resource <Resource> [--panel admin]
```

They generate:

```text
server/{panel}/imports/{Name}.ts
server/{panel}/exports/{Name}.ts
```

The templates import the selected resource builder and call:

```ts
defineImporter('stable-id', Resource)
defineExporter('stable-id', Resource)
```

## Required Holo-JS host additions

Three additive prerequisites are necessary.

### Holo Auth: fresh queued actor resolution

```ts
export interface AuthBaseGuardFacade {
  findUserById(
    userId: string | number,
  ): Promise<AuthenticatedAuthUser | null>
}
```

The implementation delegates to the guard’s configured provider adapter. A queued job must load a fresh actor and repeat panel, tenant, Shield, Holo policy, and operation authorization. Persisting an actor snapshot is insufficient.

### Holo Security: framework-neutral signed route tokens

```ts
export type SecuritySignedTokenPrimitive
  = boolean | number | string | null

export type SecuritySignedTokenValue
  = SecuritySignedTokenPrimitive
    | readonly SecuritySignedTokenValue[]
    | { readonly [key: string]: SecuritySignedTokenValue }

export type SecuritySignedTokenPayload
  = Readonly<Record<string, SecuritySignedTokenValue>>

export interface SecuritySignedTokenOptions {
  readonly expiresAt: Date
  readonly purpose: string
}

export function createSignedToken<
  TPayload extends SecuritySignedTokenPayload,
>(
  payload: TPayload,
  options: SecuritySignedTokenOptions,
): string

export function verifySignedToken<
  TPayload extends SecuritySignedTokenPayload,
>(
  token: string,
  options: {
    readonly now?: Date
    readonly purpose: string
  },
): TPayload | null
```

This uses the configured application signing key, constant-time verification, explicit purpose separation, and embedded expiry. It is needed because Holo Storage currently supports `temporaryUrl()` only for S3. Panels still reauthorizes the current session when serving every local private download; a valid signature alone is not authorization.

### Holo Panels tenancy compiled server contract

No Holo-JS repository change is needed, but the already-approved Panels tenancy contract needs this additive server-only method:

```ts
export interface CompiledPanelTenancy<TActor> {
  resolveQueuedValue(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<unknown>
}
```

It returns the fresh authorized tenant object already available internally from `PanelTenancyRuntime.resolveQueued()`. It is never serialized. The matched resource/import/export definition narrows it to its `TTenant` after registry binding.
