# P15 durable transfer execution public API amendment proposal

Status: awaiting explicit user approval.

This proposal closes the remaining Phase P15 runtime gaps without creating a second database, queue, notification, or storage system. It amends the approved contracts in `plans/p15-public-api-proposal.md` and uses the bounded export callbacks approved in `plans/p17-scale-public-api-proposal.md`. Where a signature conflicts, this document takes precedence.

The only required Holo-JS host change is bounded streaming support in Holo Storage and its S3 driver. Holo Database already supplies transactions and after-commit callbacks, Holo Queue already supplies fixed registered jobs and configured queue selection, Holo Notifications already supplies database notifications, and Holo Security already supplies purpose-bound signed tokens.

Nothing in this document is an exported API until the user approves these exact names and signatures.

## 1. Durable immutable execution input

An operation must execute from a server-normalized input snapshot, never from a later browser request, mutable temporary upload, mutable builder, or mutable table state. The snapshot is persisted with the operation before the start response is returned.

```ts
export interface TransferArtifactDigest {
  readonly algorithm: 'sha256'
  readonly value: string
}

export interface TransferStoredArtifact {
  readonly contentType: string
  readonly digest: TransferArtifactDigest
  readonly disk: string
  readonly filename: string
  readonly path: string
  readonly size: number
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
```

`TransferOperationRecord` adds the immutable input and a definition revision:

```ts
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
  readonly progress: TransferOperationProgress
  readonly resourceId: string
  readonly revision: number
  readonly status: TransferOperationStatus
  readonly updatedAt: Date
}
```

`definitionRevision` is the lowercase SHA-256 digest of the compiled definition's canonical server metadata: panel ID, resource ID, definition ID, kind, format IDs, import column keys, export column IDs, chunk size, limits, storage configuration, and queue configuration. It contains no callbacks or secrets. A worker refuses to execute when the prepared definition with the matching revision is unavailable; it does not silently run a newer definition.

Starting an import resolves the allow-listed `sourceId` under the authenticated operation identity, then streams it once into a new operation-owned private artifact under an unpredictable operation directory. The write uses create-only semantics and records its byte count and digest. The temporary source is never used by the worker. Starting an export canonicalizes and freezes the allow-listed format, columns, selection, and table state after authorization. Actor, guard, provider, panel, resource, tenant, storage disk, queue, callbacks, model names, and query details are always derived on the server.

The existing `TransferStoredArtifact` shape without `digest` is replaced. These packages are unreleased, so no compatibility overload is retained.

## 2. Revisioned atomic outbox

Operation creation or transition and every resulting queue or completion event are committed in one Holo Database transaction. Queue and notification delivery happen only from the durable outbox.

```ts
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

export interface TransferOperationStore<
  TRecordId extends TableRecordIdentifier = TableRecordIdentifier,
> {
  create(
    operation: TransferOperationRecord<TRecordId>,
    outbox: readonly TransferOutboxRecord[],
  ): Promise<void>

  find(
    operationId: string,
  ): Promise<TransferOperationRecord<TRecordId> | null>

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

  cleanupEligible(
    before: Date,
    limit: number,
  ): Promise<readonly TransferOperationRecord<TRecordId>[]>

  delete(
    operationId: string,
    expectedRevision: number,
  ): Promise<boolean>
}
```

`create` and `compareAndSwap` are atomic. The database implementation enforces unique operation IDs, unique outbox IDs, and a unique `(operationId, operationRevision, event kind)` key. An empty outbox array is valid. All returned records are immutable snapshots.

`claimOutbox` accepts `limit` from 1 through 100 and `leaseMilliseconds` from 1,000 through 300,000. It atomically leases only due, unleased or expired records and returns no more than `limit`. Acknowledgement and release require the matching opaque lease ID and record revision. Release increments `attempt`, clears the lease, stores only a bounded safe code, and sets a future `availableAt`. Dispatch is at-least-once; consumers are idempotent by operation ID, operation revision, chunk, and event kind.

An operation cannot be deleted while an outbox record references it. Cleanup deletes private artifacts first, then revision-checks the operation and atomically deletes the operation and acknowledged outbox history. Failed artifact deletion leaves the operation available for a later cleanup attempt.

## 3. Queue lifecycle and completion notification

The queue envelope becomes revision-aware and advances to version 2:

```ts
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

export interface TransferQueueAdapter {
  enqueue(
    envelope: TransferQueueEnvelope,
    configuration: TransferQueueConfiguration,
  ): Promise<{ readonly jobId: string }>
}

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

The existing envelope version 1 is replaced. A worker loads the operation and prepared definition by server-derived panel and definition IDs, compares both revisions, recomputes actor/guard/provider/tenant context from the persisted identity, and re-runs panel access, tenant membership, Shield when installed, Holo policy, and transfer authorization before each chunk. A stale, duplicate, already-completed, cancelled, identity-mismatched, or revision-mismatched envelope performs no mutation and exposes no record existence to a browser.

Each successful chunk transaction atomically records monotonic progress and an outbox event for the next chunk. A retry atomically returns the operation to `queued` and records one later envelope with an incremented attempt. Exhausted retries atomically mark the operation `failed`, persist a sanitized failure, retain any bounded failure-row artifact, and create one failure-notification event. Completion atomically records the result artifact, cleanup deadline, final progress, and one completion-notification event. Cancellation is terminal and prevents later chunk transitions.

Notification outbox delivery calls `TransferCompletionNotifier` only after loading the current terminal operation. Completion and failure notifications use Holo Notifications' database channel by default, are scoped to the persisted actor and tenant, contain only the operation presentation and authorized panel URL, and use the outbox ID as their deduplication key. Notification errors are released for bounded retry and never roll back the completed transfer.

## 4. Bounded streaming storage

### Holo Panels

Whole-artifact reads are removed from the transfer runtime contract:

```ts
export interface TransferInputSource {
  readonly digest: TransferArtifactDigest
  readonly size: number
  chunks(options?: {
    readonly chunkBytes?: number
  }): AsyncIterable<Uint8Array>
}

export interface TransferArtifactWriter {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<TransferStoredArtifact>
  abort(): Promise<void>
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
    readonly purpose: 'failure-rows' | 'input' | 'result'
  }): Promise<TransferArtifactWriter>

  delete(
    artifacts: readonly TransferStoredArtifact[],
  ): Promise<void>
}
```

`TransferInputSource.bytes()`, `TransferStorageAdapter.read()`, and the `temporary` writer purpose are removed. `chunks()` defaults to 64 KiB and accepts 4 KiB through 1 MiB. Every yielded chunk is non-empty and no larger than the requested limit. The adapter verifies total size and SHA-256 digest while reading; mismatch throws a sanitized integrity error before mutation or download. Writers reject empty chunks, enforce configured operation byte limits incrementally, calculate the digest incrementally, and make the final path visible only on successful `close()`. `abort()` is idempotent and removes partial data.

Import formats inspect and read bounded rows from the chunk stream. CSV decoding carries at most the configured maximum row and cell bytes plus one storage chunk. XLSX import, when enabled, must use a bounded streaming parser; it cannot call a whole-file buffer fallback. Downloads stream the authorized artifact directly and preserve the approved private, no-store, content-disposition, content-length, content-type, and `nosniff` headers.

### Adjacent Holo-JS repository

`@holo-js/storage/runtime`, the static `Storage` facade, and `@holo-js/storage-s3` add:

```ts
export type StorageByteStream = AsyncIterable<Uint8Array>

export interface StorageStreamReadOptions {
  readonly chunkBytes?: number
}

export interface StorageStreamWriteOptions {
  readonly overwrite?: boolean
}

export interface StorageBackend {
  getItemStream?(
    key: string,
    options: StorageStreamReadOptions,
  ): Promise<StorageByteStream | null>

  setItemStream?(
    key: string,
    source: StorageByteStream,
    options: Required<StorageStreamWriteOptions>,
  ): Promise<void>

  // Existing backend methods are unchanged.
}

export interface StorageDisk {
  readStream(
    path: string,
    options?: StorageStreamReadOptions,
  ): Promise<StorageByteStream | null>

  writeStream(
    path: string,
    source: StorageByteStream,
    options?: StorageStreamWriteOptions,
  ): Promise<boolean>

  // Existing bounded and non-streaming methods are unchanged.
}

export const Storage: {
  readStream(
    path: string,
    options?: StorageStreamReadOptions,
  ): Promise<StorageByteStream | null>

  writeStream(
    path: string,
    source: StorageByteStream,
    options?: StorageStreamWriteOptions,
  ): Promise<boolean>

  // Existing facade methods are unchanged.
}
```

Read chunks default to 64 KiB and are restricted to 4 KiB through 1 MiB. `overwrite` defaults to `true` for general Holo compatibility; Panels always passes `false`. With `overwrite: false`, local storage uses an exclusive temporary file plus an atomic same-directory publish, and S3 uses a unique multipart upload followed by conditional create semantics. An existing destination causes `writeStream` to return `false`; it is never replaced. Failure or cancellation removes temporary files or aborts multipart uploads. Paths continue through the existing normalized disk boundary.

A configured backend without both streaming capabilities throws `StorageStreamingUnsupportedError`; Holo never buffers the complete stream as a fallback. Errors omit disk credentials, local roots, raw S3 responses, signed URLs, object keys, and stream contents. Existing `put`, `get`, and `getBytes` remain for bounded callers, but Panels transfer adapters never call them.

No Holo Database, Queue, Notifications, or Security public API change is required.

## 5. Exported Panels runtime and production adapters

The server-only `@holo-js/panels-core/transfers` entry exports these exact orchestration contracts:

```ts
export interface TransferPreparedDefinitions {
  importer(
    panelId: string,
    resourceId: string,
    definitionId: string,
    definitionRevision: string,
  ): ImporterDefinition<object, Readonly<Record<string, unknown>>, object, unknown> | null

  exporter(
    panelId: string,
    resourceId: string,
    definitionId: string,
    definitionRevision: string,
  ): ExporterDefinition<object, object, TableRecordIdentifier, object, unknown> | null
}

export interface TransferRuntimeOptions<TRequestScope> {
  readonly clock?: () => Date
  readonly definitions: TransferPreparedDefinitions
  readonly lifecycle: TransferOperationLifecycle<TRequestScope>
  readonly notifier: TransferCompletionNotifier<object, unknown>
  readonly queue: TransferQueueAdapter
  readonly storage: TransferStorageAdapter
  readonly uploads: TransferUploadResolver
}

export interface TransferRuntime<TRequestScope> {
  startImport(
    request: StartImportRequest,
    scope: TRequestScope,
  ): Promise<TransferOperationRecord>

  startExport(
    request: StartExportRequest<TableRecordIdentifier>,
    scope: TRequestScope,
  ): Promise<TransferOperationRecord>

  cancel(
    request: TransferOperationRequest,
    scope: TRequestScope,
  ): Promise<TransferOperationRecord>

  handle(
    envelope: TransferQueueEnvelope,
  ): Promise<void>

  dispatchOutbox(input?: {
    readonly limit?: number
  }): Promise<{ readonly dispatched: number, readonly inspected: number }>

  cleanup(input?: {
    readonly limit?: number
  }): Promise<{ readonly deleted: number, readonly inspected: number }>
}

export function createTransferRuntime<TRequestScope>(
  options: TransferRuntimeOptions<TRequestScope>,
): TransferRuntime<TRequestScope>
```

Production integrations are exported only from the server entry:

```ts
export interface HoloTransferStoreOptions {
  readonly connection?: string
  readonly operationsTable?: string
  readonly outboxTable?: string
}

export function createHoloTransferOperationStore(
  options?: HoloTransferStoreOptions,
): TransferOperationStore

export interface HoloTransferStorageOptions {
  readonly maximumChunkBytes?: number
}

export function createHoloTransferStorage(
  options?: HoloTransferStorageOptions,
): TransferStorageAdapter

export type HoloTransferQueueHandler = (
  envelope: TransferQueueEnvelope,
) => void | Promise<void>

export function defineHoloTransferQueueJob(
  handler: HoloTransferQueueHandler,
): DefinedQueueJobDefinition<TransferQueueEnvelope, void>

export class HoloTransferQueueAdapter implements TransferQueueAdapter {
  constructor(
    job: DefinedQueueJobDefinition<TransferQueueEnvelope, void>,
  )

  enqueue(
    envelope: TransferQueueEnvelope,
    configuration: TransferQueueConfiguration,
  ): Promise<{ readonly jobId: string }>
}

export interface HoloTransferNotificationOptions<TActor extends object> {
  readonly completed: (
    operation: TransferOperationRecord,
  ) => NotificationDefinition<TActor>

  readonly failed: (
    operation: TransferOperationRecord,
  ) => NotificationDefinition<TActor>
}

export function createHoloTransferCompletionNotifier<
  TActor extends object,
  TTenant,
>(
  options: HoloTransferNotificationOptions<TActor>,
): TransferCompletionNotifier<TActor, TTenant>
```

The store uses Holo Database and package-owned migrations for `panel_transfer_operations` and `panel_transfer_outbox` by default. Custom table names must pass the same static SQL-identifier allow list used by existing Panels database adapters; request input can never select them. The queue adapter uses one fixed application-registered job with Holo Queue retries disabled (`tries: 1`) because operation retries are persisted by Panels. The notification adapter calls Holo Notifications with `context.actor`; notification factories remain server callbacks and are never serialized.

Framework adapters retain their existing fixed Panels operation route and native cookies, redirects, and download responses. They resolve request scope, call the shared runtime, and do not implement transfer persistence or execution themselves.

## 6. Old and new usage

The current low-level sequence can lose a queue dispatch after operation persistence and before `enqueue`, and it reads an upload through a mutable reference:

```ts
const operation = await lifecycle.create({
  definitionId: 'posts',
  kind: 'import',
  resourceId: 'posts',
  total: inspection.rows,
}, requestScope)

const envelope = await lifecycle.envelope(operation.id, 0)
await queue.enqueue(envelope, importer.server.queue)
```

After approval, application setup composes one runtime. Starting work snapshots the input and commits the initial outbox record atomically:

```ts
async function handleTransfer(envelope: TransferQueueEnvelope): Promise<void> {
  await transfers.handle(envelope)
}

const transferJob = defineHoloTransferQueueJob(handleTransfer)

const transfers = createTransferRuntime({
  definitions: preparedTransfers,
  lifecycle: transferLifecycle,
  notifier: createHoloTransferCompletionNotifier({
    completed: operation => transferCompletedNotification(operation),
    failed: operation => transferFailedNotification(operation),
  }),
  queue: new HoloTransferQueueAdapter(transferJob),
  storage: createHoloTransferStorage(),
  uploads: transferUploads,
})

const operation = await transfers.startImport(request, requestScope)
await transfers.dispatchOutbox()
```

For storage, the old whole-buffer path:

```ts
const bytes = await Storage.disk('private').getBytes(path)
await Storage.disk('private').put(resultPath, bytes)
```

becomes bounded and create-only:

```ts
const source = await Storage.disk('private').readStream(path)
if (!source) throw new Error('Transfer source is unavailable')

const created = await Storage.disk('private').writeStream(
  resultPath,
  source,
  { overwrite: false },
)
```

Applications run `dispatchOutbox()` from one fixed scheduled command or worker loop and may run it concurrently across processes because leases and acknowledgements are atomic. Database queue execution remains the phase-gate configuration; alternative queue and storage implementations are proved through the same adapter contract tests.

## 7. Security, consistency, and acceptance behavior

- Every start, chunk, retry, cancellation, status read, download, and cleanup path derives panel, resource, guard, provider, actor, and tenant on the server and re-authorizes the operation.
- Import upload resolution and immutable snapshot creation happen only after access, tenant membership, Shield when enabled, Holo policy, importer policy, format, mapping, MIME, extension, size, digest, row, column, cell, and encoding validation.
- Export query construction applies authorization and tenant scopes before lookup, selection, relation loading, aggregation, option resolution, formatting, or counting. P17 batch resolvers remain the only export callback form.
- Operation input, progress, retry, artifact, failure-row, terminal status, and dispatch intent transitions are revision-checked and transactional. Duplicate workers cannot advance the same revision twice.
- Queue and notification delivery are at-least-once; operation transitions and notification identities make duplicates harmless. No callback, actor object, tenant object, model name, query, storage path, connection name, queue name, secret, stack trace, or raw driver error is accepted from or serialized to the browser.
- Streams, decoded rows, queued chunks, failure rows, outbox claims, retries, cleanup batches, downloads, and response presentations are bounded. There is no whole-file or unbounded-list fallback.
- Source, result, and failure-row artifacts remain private. Download grants remain purpose-, operation-, artifact-kind-, identity-, authorization-, and expiry-bound.
- The phase gate requires database queue plus private local streaming storage in all example applications, end-to-end completion and failure notifications, cancellation and retry races, process interruption between every transaction/dispatch boundary, immutable source replacement attempts, digest mismatch, malformed CSV and encoding, huge row/cell/file, duplicate row, partial completion, tenant revocation, authorization revocation, cleanup recovery, and alternative queue/storage adapter contract tests.

## 8. Migration and distribution

This is a pre-release breaking amendment. `TransferStoredArtifact`, `TransferInputSource`, `TransferStorageAdapter`, `TransferOperationRecord`, `TransferOperationStore`, and `TransferQueueEnvelope` are updated atomically; envelope version 1 and whole-buffer transfer methods are removed without shims.

Holo Panels owns its operation and outbox migrations through the already approved plugin migration contribution. Holo-JS owns only the Storage and S3 streaming implementation and its driver contract tests. Generated declarations, API reference, package export maps, examples, packed-package smoke fixtures, and the canonical implementation evidence must be regenerated only after implementation and all required validation pass.
