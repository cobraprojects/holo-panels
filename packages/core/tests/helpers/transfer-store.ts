import type { TableRecordIdentifier } from '../../src/tables/query/contracts'
import type {
  TransferOperationRecord,
  TransferOperationStore,
  TransferOutboxLease,
  TransferOutboxRecord,
} from '../../src/transfers/contracts'

export class MemoryTransferStore<TRecordId extends TableRecordIdentifier = TableRecordIdentifier> implements TransferOperationStore<TRecordId> {
  readonly operations = new Map<string, TransferOperationRecord<TRecordId>>()
  readonly outbox = new Map<string, TransferOutboxRecord>()
  private leaseSequence = 0

  async create(operation: TransferOperationRecord<TRecordId>, outbox: readonly TransferOutboxRecord[]): Promise<void> {
    if (this.operations.has(operation.id) || outbox.some(record => this.outbox.has(record.id))) throw new Error('duplicate')
    this.operations.set(operation.id, operation)
    for (const record of outbox) this.outbox.set(record.id, record)
  }

  find(operationId: string): Promise<TransferOperationRecord<TRecordId> | null> {
    return Promise.resolve(this.operations.get(operationId) ?? null)
  }

  async compareAndSwap(operationId: string, expectedRevision: number, operation: TransferOperationRecord<TRecordId>, outbox: readonly TransferOutboxRecord[]): Promise<boolean> {
    if (this.operations.get(operationId)?.revision !== expectedRevision || outbox.some(record => this.outbox.has(record.id))) return false
    this.operations.set(operationId, operation)
    for (const record of outbox) this.outbox.set(record.id, record)
    return true
  }

  claimOutbox(input: { readonly availableBefore: Date, readonly leaseMilliseconds: number, readonly limit: number }): Promise<TransferOutboxLease> {
    if (input.limit < 1 || input.limit > 100 || input.leaseMilliseconds < 1_000 || input.leaseMilliseconds > 300_000) throw new Error('invalid claim')
    const leaseId = `lease-${++this.leaseSequence}`
    const records = [...this.outbox.values()].filter(record => record.availableAt <= input.availableBefore && (!record.leaseExpiresAt || record.leaseExpiresAt <= input.availableBefore)).slice(0, input.limit).map(record => {
      const leased = Object.freeze({ ...record, leaseExpiresAt: new Date(input.availableBefore.getTime() + input.leaseMilliseconds) })
      this.outbox.set(record.id, leased)
      return leased
    })
    return Promise.resolve(Object.freeze({ leaseId, records: Object.freeze(records) }))
  }

  acknowledgeOutbox(input: { readonly leaseId: string, readonly outboxId: string, readonly expectedRevision: number }): Promise<boolean> {
    const record = this.outbox.get(input.outboxId)
    if (!record || record.revision !== input.expectedRevision || !input.leaseId.startsWith('lease-')) return Promise.resolve(false)
    this.outbox.delete(input.outboxId)
    return Promise.resolve(true)
  }

  releaseOutbox(input: { readonly expectedRevision: number, readonly failure: { readonly retryAt: Date, readonly sanitizedCode: string }, readonly leaseId: string, readonly outboxId: string }): Promise<boolean> {
    const record = this.outbox.get(input.outboxId)
    if (!record || record.revision !== input.expectedRevision || !input.leaseId.startsWith('lease-')) return Promise.resolve(false)
    this.outbox.set(record.id, Object.freeze({ ...record, attempt: record.attempt + 1, availableAt: new Date(input.failure.retryAt), leaseExpiresAt: null, revision: record.revision + 1, updatedAt: new Date(input.failure.retryAt) }))
    return Promise.resolve(true)
  }

  cleanupEligible(before: Date, limit: number): Promise<readonly TransferOperationRecord<TRecordId>[]> {
    return Promise.resolve([...this.operations.values()].filter(operation => operation.cleanupAfter && operation.cleanupAfter <= before && ![...this.outbox.values()].some(record => record.operationId === operation.id)).slice(0, limit))
  }

  delete(operationId: string, expectedRevision: number): Promise<boolean> {
    if (this.operations.get(operationId)?.revision !== expectedRevision || [...this.outbox.values()].some(record => record.operationId === operationId)) return Promise.resolve(false)
    this.operations.delete(operationId)
    return Promise.resolve(true)
  }
}
