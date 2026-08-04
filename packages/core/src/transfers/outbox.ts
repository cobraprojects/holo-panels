import type { TableRecordIdentifier } from '../tables/query/contracts'
import type {
  TransferCompletionNotifier,
  TransferExecutionContext,
  TransferOperationRecord,
  TransferOperationStore,
  TransferOutboxRecord,
  TransferQueueAdapter,
} from './contracts'

export interface TransferOutboxDispatcherOptions<
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  readonly clock?: () => Date
  readonly leaseMilliseconds?: number
  readonly notifier: TransferCompletionNotifier<TActor, TTenant>
  readonly queue: TransferQueueAdapter
  readonly resolveContext: (
    operation: TransferOperationRecord<TRecordId>,
    signal: AbortSignal,
  ) => Promise<TransferExecutionContext<TActor, TTenant> | null>
  readonly retryDelayMilliseconds?: (attempt: number) => number
  readonly store: TransferOperationStore<TRecordId>
}

export interface TransferOutboxDispatchResult {
  readonly dispatched: number
  readonly inspected: number
}

export class TransferOutboxDispatcher<
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  readonly #options: TransferOutboxDispatcherOptions<TRecordId, TActor, TTenant> & {
    readonly clock: () => Date
    readonly leaseMilliseconds: number
    readonly retryDelayMilliseconds: (attempt: number) => number
  }

  constructor(options: TransferOutboxDispatcherOptions<TRecordId, TActor, TTenant>) {
    const leaseMilliseconds = options.leaseMilliseconds ?? 30_000
    if (!Number.isSafeInteger(leaseMilliseconds) || leaseMilliseconds < 1_000 || leaseMilliseconds > 300_000) {
      throw new Error('[Holo Panels] Transfer outbox lease must be between 1,000 and 300,000 milliseconds.')
    }
    this.#options = {
      ...options,
      clock: options.clock ?? (() => new Date()),
      leaseMilliseconds,
      retryDelayMilliseconds: options.retryDelayMilliseconds ?? (attempt => Math.min(300_000, 1_000 * (2 ** Math.min(attempt, 8)))),
    }
  }

  async run(limit = 25): Promise<TransferOutboxDispatchResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('[Holo Panels] Transfer outbox limit must be between 1 and 100.')
    const lease = await this.#options.store.claimOutbox({
      availableBefore: this.#options.clock(),
      leaseMilliseconds: this.#options.leaseMilliseconds,
      limit,
    })
    let dispatched = 0
    for (const record of lease.records) {
      try {
        if (await this.dispatch(record)) dispatched += 1
        await this.#options.store.acknowledgeOutbox({ expectedRevision: record.revision, leaseId: lease.leaseId, outboxId: record.id })
      } catch (error) {
        await this.#options.store.releaseOutbox({
          expectedRevision: record.revision,
          failure: {
            retryAt: new Date(this.#options.clock().getTime() + this.#options.retryDelayMilliseconds(record.attempt + 1)),
            sanitizedCode: safeFailureCode(error),
          },
          leaseId: lease.leaseId,
          outboxId: record.id,
        })
      }
    }
    return Object.freeze({ dispatched, inspected: lease.records.length })
  }

  private async dispatch(record: TransferOutboxRecord): Promise<boolean> {
    if (record.event.kind === 'queue') {
      await this.#options.queue.enqueue(record.event.envelope, record.event.configuration)
      return true
    }
    const operation = await this.#options.store.find(record.operationId)
    if (!operation || operation.revision !== record.operationRevision || operation.status !== record.event.status) return false
    const context = await this.#options.resolveContext(operation, new AbortController().signal)
    if (!context) return false
    await this.#options.notifier[record.event.status](operation, context, record.id)
    return true
  }
}

function safeFailureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = Reflect.get(error, 'code')
    if (typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/u.test(code)) return code
  }
  return 'dispatch_failed'
}
