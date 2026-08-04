# P15 remaining durability API proposal

Status: implemented after explicit user approval on 2026-07-29 in Holo Panels and the adjacent Holo-JS Notifications package.

The approved P15 completion amendment cannot satisfy two of its own acceptance requirements with its declared contracts. This proposal contains the minimum additional API needed. It does not change authoring builders and does not require users to provide generic arguments.

## 1. Holo Notifications durable deduplication

Holo Notifications currently generates every database notification ID with `randomUUID()`. A transfer dispatcher can therefore crash after the database notification commits and before its outbox acknowledgement commits, then create a duplicate on retry.

Add the following server API to `@holo-js/notifications`:

```ts
export interface NotificationDispatchOptions {
  readonly afterCommit?: boolean
  readonly deduplicationKey?: string
}

export interface PendingNotificationDispatch<TResult> {
  deduplicate(key: string): this
  dispatch(): Promise<TResult>
}
```

`deduplicate()` accepts 1 through 200 printable ASCII characters. It is valid only when every resolved channel is `database`; mixed or non-database delivery fails before sending. The database channel stores the key as the notification record ID. Inserting the same key again for the same notifiable type and ID and notification type returns the already-delivered result. A collision with different ownership or type fails closed. The key is never placed in notification payload data, logs, browser manifests, or errors.

The Panels notifier calls:

```ts
await notify(context.actor, definition)
  .deduplicate(outboxId)
  .dispatch()
```

No user type annotations are needed: the actor type continues to be inferred from the supplied notification factory.

## 2. Holo Panels resumable export parts

Create-only streaming writers cannot resume a CSV or XLSX artifact after process interruption. Holo Panels therefore persists bounded, format-neutral result parts and assembles the selected format only after all query chunks commit.

Add:

```ts
export interface TransferResultPart {
  readonly artifact: TransferStoredArtifact
  readonly chunk: number
  readonly rows: number
}

export interface TransferOperationRecord<
  TRecordId extends TableRecordIdentifier = TableRecordIdentifier,
> {
  readonly parts: readonly TransferResultPart[]
  // Existing fields remain unchanged.
}
```

`TransferOperationLifecycle.progress()` is replaced by an inferred discriminated input:

```ts
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

progress(
  operationId: string,
  transition: TransferProgressTransition,
): Promise<TransferOperationRecord>
```

Each export worker writes one operation-owned private intermediate part containing a bounded canonical sequence of typed scalar cells, then atomically appends that part and the next queue event with the operation CAS. A duplicate or stale worker loses the CAS and deletes its unused part. Parts must be contiguous, unique by chunk, individually digest-verified, and bounded by the definition chunk size and export column count.

After the last data chunk, one revision-bound finalization envelope streams the persisted parts in order through the selected CSV or XLSX format adapter into the create-only result writer. It never buffers the complete export. Completion atomically stores the final artifact and notification intent. Cleanup deletes input, result, failure-row, and intermediate part artifacts before deleting the operation.

The runtime derives `TRecord`, `TRecordId`, `TActor`, and `TTenant` from the supplied prepared exporter definitions. Applications do not name these types or pass generic arguments.

## Acceptance additions

- A crash before or after every part write, CAS, queue dispatch, notification delivery, and outbox acknowledgement converges without duplicate mutations, parts, or notifications.
- CSV and XLSX assembly resumes from persisted parts and never reads a whole part or result into memory.
- Stale parts, digest mismatches, non-contiguous chunks, tenant revocation, and authorization revocation fail closed and remain cleanup-eligible.
- Compile-time fixtures prove importer/exporter callback context and record, ID, actor, tenant, and value types are inferred from resource and prepared definitions without explicit generics.
