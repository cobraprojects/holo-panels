import { randomUUID } from 'node:crypto'
import { DB, TableQueryBuilder, type DatabaseContext } from '@holo-js/db'
import type { TableRecordIdentifier } from '../tables/query/contracts'
import type {
  TransferOperationRecord,
  TransferOperationStore,
  TransferOutboxRecord,
} from './contracts'

export interface HoloTransferStoreOptions {
  readonly connection?: string
  readonly operationsTable?: string
  readonly outboxTable?: string
}

interface OperationRow extends Record<string, unknown> { readonly payload: string }
interface OutboxRow extends Record<string, unknown> { readonly payload: string }

export function createHoloTransferOperationStore<TRecordId extends TableRecordIdentifier = TableRecordIdentifier>(options: HoloTransferStoreOptions = {}): TransferOperationStore<TRecordId> {
  const operationsTable = sqlIdentifier(options.operationsTable ?? 'panel_transfer_operations')
  const outboxTable = sqlIdentifier(options.outboxTable ?? 'panel_transfer_outbox')
  const context = (): DatabaseContext => DB.connection(options.connection)
  const transaction = <TResult>(operation: (database: DatabaseContext) => Promise<TResult>): Promise<TResult> => options.connection
    ? DB.writeTransaction(operation, options.connection)
    : DB.writeTransaction(operation)
  const store: TransferOperationStore<TRecordId> = {
    create(operation, outbox) {
      return transaction(async database => {
        await table(database, operationsTable).insert(operationRow(operation))
        if (outbox.length > 0) await table(database, outboxTable).insert(outbox.map(outboxRow))
      })
    },
    async find(operationId) {
      const row = await table(context(), operationsTable).where('id', operationId).first<OperationRow>()
      return row ? decode<TransferOperationRecord<TRecordId>>(row.payload) : null
    },
    compareAndSwap(operationId, expectedRevision, operation, outbox) {
      return transaction(async database => {
        const result = await table(database, operationsTable).where('id', operationId).where('revision', expectedRevision).update(operationRow(operation))
        if (result.affectedRows !== 1) return false
        if (outbox.length > 0) await table(database, outboxTable).insert(outbox.map(outboxRow))
        return true
      })
    },
    claimOutbox(input) {
      claimBounds(input.limit, input.leaseMilliseconds)
      return transaction(async database => {
        const now = input.availableBefore
        const candidates = await table(database, outboxTable).where('available_at', '<=', now).orderBy('available_at').limit(input.limit * 2).lockForUpdate().get<OutboxRow>()
        const records = candidates.map(row => decode<TransferOutboxRecord>(row.payload)).filter(record => !record.leaseExpiresAt || record.leaseExpiresAt <= now).slice(0, input.limit)
        const leaseId = randomUUID()
        const leased: TransferOutboxRecord[] = []
        for (const record of records) {
          const updated = freezeOutbox({ ...record, leaseExpiresAt: new Date(now.getTime() + input.leaseMilliseconds), revision: record.revision + 1, updatedAt: now })
          const result = await table(database, outboxTable).where('id', record.id).where('revision', record.revision).update({ ...outboxRow(updated), lease_id: leaseId })
          if (result.affectedRows === 1) leased.push(updated)
        }
        return Object.freeze({ leaseId, records: Object.freeze(leased) })
      })
    },
    acknowledgeOutbox(input) {
      return transaction(async database => {
        const result = await table(database, outboxTable).where('id', input.outboxId).where('revision', input.expectedRevision).where('lease_id', input.leaseId).delete()
        return result.affectedRows === 1
      })
    },
    releaseOutbox(input) {
      if (!/^[a-z][a-z0-9_]{0,63}$/u.test(input.failure.sanitizedCode)) throw new Error('[Holo Panels] Transfer outbox failure code is invalid.')
      return transaction(async database => {
        const row = await table(database, outboxTable).where('id', input.outboxId).where('revision', input.expectedRevision).where('lease_id', input.leaseId).lockForUpdate().first<OutboxRow>()
        if (!row) return false
        const record = decode<TransferOutboxRecord>(row.payload)
        const updated = freezeOutbox({ ...record, attempt: record.attempt + 1, availableAt: input.failure.retryAt, leaseExpiresAt: null, revision: record.revision + 1, updatedAt: input.failure.retryAt })
        const result = await table(database, outboxTable).where('id', input.outboxId).where('revision', input.expectedRevision).where('lease_id', input.leaseId).update({ ...outboxRow(updated), failure_code: input.failure.sanitizedCode, lease_id: null })
        return result.affectedRows === 1
      })
    },
    async cleanupEligible(before, limit) {
      const rows = await table(context(), operationsTable).where('cleanup_after', '<=', before).orderBy('cleanup_after').limit(limit).get<OperationRow>()
      const operations = rows.map(row => decode<TransferOperationRecord<TRecordId>>(row.payload))
      const eligible: TransferOperationRecord<TRecordId>[] = []
      for (const operation of operations) {
        const reference = await table(context(), outboxTable).where('operation_id', operation.id).first<OutboxRow>()
        if (!reference) eligible.push(operation)
      }
      return Object.freeze(eligible)
    },
    async delete(operationId, expectedRevision) {
      const result = await table(context(), operationsTable).where('id', operationId).where('revision', expectedRevision).delete()
      return result.affectedRows === 1
    },
  }
  return Object.freeze(store)
}

function table(context: DatabaseContext, name: string): TableQueryBuilder<string> { return new TableQueryBuilder(name, context) }
function sqlIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) throw new Error('[Holo Panels] Transfer table name is invalid.')
  return value
}
function claimBounds(limit: number, lease: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(lease) || lease < 1_000 || lease > 300_000) throw new Error('[Holo Panels] Transfer outbox claim bounds are invalid.')
}
function operationRow(operation: TransferOperationRecord): Readonly<Record<string, unknown>> {
  return { cleanup_after: operation.cleanupAfter, id: operation.id, payload: encode(operation), revision: operation.revision, status: operation.status, updated_at: operation.updatedAt }
}
function outboxRow(record: TransferOutboxRecord): Readonly<Record<string, unknown>> {
  return { attempt: record.attempt, available_at: record.availableAt, event_kind: record.event.kind, id: record.id, lease_expires_at: record.leaseExpiresAt, operation_id: record.operationId, operation_revision: record.operationRevision, payload: encode(record), revision: record.revision, updated_at: record.updatedAt }
}
function encode(value: unknown): string { return JSON.stringify(value) }
function decode<TValue>(value: string): TValue { return reviveDates(JSON.parse(value) as unknown) as TValue }
function reviveDates(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(item => reviveDates(item)))
  if (typeof value !== 'object' || value === null) {
    return typeof value === 'string' && /(?:At|After|availableAt|leaseExpiresAt)$/u.test(key) ? new Date(value) : value
  }
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, reviveDates(child, childKey)])))
}
function freezeOutbox(record: TransferOutboxRecord): TransferOutboxRecord { return Object.freeze({ ...record, availableAt: new Date(record.availableAt), createdAt: new Date(record.createdAt), leaseExpiresAt: record.leaseExpiresAt ? new Date(record.leaseExpiresAt) : null, updatedAt: new Date(record.updatedAt) }) }
