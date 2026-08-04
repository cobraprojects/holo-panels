import { defineJob, type DefinedQueueJobDefinition } from '@holo-js/queue'
import type {
  TransferQueueAdapter,
  TransferQueueConfiguration,
  TransferQueueEnvelope,
} from './contracts'

type HoloTransferQueuePayload = {
  readonly attempt: number
  readonly chunk: number
  readonly definitionId: string
  readonly definitionRevision: string
  readonly kind: 'export' | 'import'
  readonly operationId: string
  readonly operationRevision: number
  readonly panelId: string
  readonly version: 2
}

export type HoloTransferQueueHandler = (
  envelope: TransferQueueEnvelope,
) => void | Promise<void>

export function defineHoloTransferQueueJob(
  handler: HoloTransferQueueHandler,
): DefinedQueueJobDefinition<HoloTransferQueuePayload, void> {
  return defineJob<HoloTransferQueuePayload, void>({
    tries: 1,
    async handle(payload) {
      await handler(Object.freeze({ ...payload }))
    },
  })
}

export class HoloTransferQueueAdapter implements TransferQueueAdapter {
  constructor(
    private readonly job: DefinedQueueJobDefinition<HoloTransferQueuePayload, void>,
  ) {}

  async enqueue(
    envelope: TransferQueueEnvelope,
    configuration: TransferQueueConfiguration,
  ): Promise<{ readonly jobId: string }> {
    let pending = this.job.dispatch({ ...envelope })
    if (configuration.connection) pending = pending.onConnection(configuration.connection)
    if (configuration.queue) pending = pending.onQueue(configuration.queue)
    const delay = retryDelay(envelope.attempt, configuration.backoff)
    if (delay > 0) pending = pending.delay(delay)
    const result = await pending.dispatch()
    return Object.freeze({ jobId: result.jobId })
  }
}

function retryDelay(
  attempt: number,
  backoff: TransferQueueConfiguration['backoff'],
): number {
  if (attempt === 0 || typeof backoff === 'undefined') return 0
  if (typeof backoff === 'number') return backoff
  return backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0
}
