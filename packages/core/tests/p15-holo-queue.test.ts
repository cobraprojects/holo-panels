import {
  configureQueueRuntime,
  registerQueueJob,
  resetQueueRegistry,
  resetQueueRuntime,
} from '@holo-js/queue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  defineHoloTransferQueueJob,
  HoloTransferQueueAdapter,
} from '../src/transfers/holo-queue'
import type { TransferQueueEnvelope } from '../src/transfers/contracts'

const envelope: TransferQueueEnvelope = Object.freeze({
  attempt: 0,
  chunk: 3,
  definitionId: 'users',
  definitionRevision: 'a'.repeat(64),
  kind: 'export',
  operationId: 'transfer-1',
  operationRevision: 4,
  panelId: 'admin',
  version: 2,
})

afterEach(() => {
  resetQueueRegistry()
  resetQueueRuntime()
})

describe('P15 Holo Queue integration', () => {
  it('dispatches the fixed versioned envelope through configured Holo Queue connection and queue', async () => {
    const received: TransferQueueEnvelope[] = []
    const job = defineHoloTransferQueueJob(payload => {
      received.push(payload)
    })
    registerQueueJob(job, { name: 'holo-panels.transfer' })
    configureQueueRuntime({
      config: {
        default: 'default',
        connections: {
          default: { driver: 'sync', queue: 'default' },
          transfers: { driver: 'sync', queue: 'transfers' },
        },
      },
    })

    const result = await new HoloTransferQueueAdapter(job).enqueue(envelope, {
      connection: 'transfers',
      queue: 'bulk',
    })

    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/u)
    expect(received).toEqual([envelope])
    expect(received[0]).not.toHaveProperty('actor')
    expect(received[0]).not.toHaveProperty('tenant')
  })

  it('fails closed when the selected connection is not configured', async () => {
    const job = defineHoloTransferQueueJob(() => undefined)
    registerQueueJob(job, { name: 'holo-panels.transfer' })
    configureQueueRuntime({
      config: {
        default: 'default',
        connections: { default: { driver: 'sync' } },
      },
    })

    await expect(new HoloTransferQueueAdapter(job).enqueue(envelope, {
      connection: 'missing',
    })).rejects.toThrow('is not configured')
  })
})
