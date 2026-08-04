import { describe, expect, it, vi } from 'vitest'
import type { TransferOperationRecord } from '../src/transfers/contracts'
import { TransferOperationLifecycle } from '../src/transfers/lifecycle'
import { TransferOutboxDispatcher } from '../src/transfers/outbox'
import { MemoryTransferStore } from './helpers/transfer-store'

const now = new Date('2026-07-29T10:00:00.000Z')
const source = Object.freeze({ contentType: 'text/csv', digest: { algorithm: 'sha256' as const, value: 'a'.repeat(64) }, disk: 'private', filename: 'input.csv', path: 'input.csv', size: 10 })

function setup() {
  let sequence = 0
  const store = new MemoryTransferStore()
  const lifecycle = new TransferOperationLifecycle<object>({
    authorizeCancellation: () => true, authorizeDownload: () => true, clock: () => now,
    identifyActor: () => 1, identifyGuard: () => 'admin', identifyPanel: () => 'admin', identifyProvider: () => null, identifyTenant: () => 'tenant-a',
    makeId: () => `id-${++sequence}`, maxChunkRetries: 2, retentionMilliseconds: 1_000, signDownload: () => 'token', store, verifyDownload: () => null,
  })
  const enqueue = vi.fn(() => Promise.resolve({ jobId: 'job-1' }))
  const completed = vi.fn(() => Promise.resolve())
  const failed = vi.fn(() => Promise.resolve())
  const dispatcher = new TransferOutboxDispatcher({
    clock: () => now,
    notifier: { completed, failed },
    queue: { enqueue },
    resolveContext: (operation: TransferOperationRecord) => Promise.resolve({ actor: { id: 1 }, guard: operation.identity.guard, panelId: operation.identity.panelId, provider: operation.identity.provider, resourceId: operation.resourceId, signal: new AbortController().signal, tenant: { id: 'tenant-a' } }),
    store,
  })
  return { completed, dispatcher, enqueue, failed, lifecycle, store }
}

describe('P15 transfer outbox dispatch', () => {
  it('dispatches and acknowledges an atomic queue intent', async () => {
    const { dispatcher, enqueue, lifecycle, store } = setup()
    await lifecycle.create({ definitionId: 'users', definitionRevision: 'b'.repeat(64), input: { formatId: 'csv', kind: 'import', mappings: [], source }, kind: 'import', queue: { connection: 'database' }, resourceId: 'users', total: 1 }, {})
    await expect(dispatcher.run()).resolves.toEqual({ dispatched: 1, inspected: 1 })
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }), { connection: 'database' })
    expect(store.outbox.size).toBe(0)
  })

  it('releases failures with bounded retry and never exposes driver errors', async () => {
    const { dispatcher, enqueue, lifecycle, store } = setup()
    enqueue.mockRejectedValueOnce(new Error('password at /srv/app'))
    await lifecycle.create({ definitionId: 'users', definitionRevision: 'b'.repeat(64), input: { formatId: 'csv', kind: 'import', mappings: [], source }, kind: 'import', queue: {}, resourceId: 'users', total: 1 }, {})
    await expect(dispatcher.run()).resolves.toEqual({ dispatched: 0, inspected: 1 })
    expect([...store.outbox.values()][0]).toMatchObject({ attempt: 1, leaseExpiresAt: null, revision: 1 })
    expect(JSON.stringify([...store.outbox.values()])).not.toContain('/srv')
  })

  it('delivers a terminal notification with the outbox id as deduplication key', async () => {
    const { completed, dispatcher, lifecycle, store } = setup()
    const operation = await lifecycle.create({ definitionId: 'users', definitionRevision: 'b'.repeat(64), input: { formatId: 'csv', kind: 'import', mappings: [], source }, kind: 'import', queue: {}, resourceId: 'users', total: 0 }, {})
    store.outbox.clear()
    await lifecycle.complete(operation.id, null)
    const outboxId = [...store.outbox.keys()][0]!
    await dispatcher.run()
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }), expect.objectContaining({ actor: { id: 1 }, tenant: { id: 'tenant-a' } }), outboxId)
  })

  it('acknowledges stale terminal events without notifying', async () => {
    const { completed, dispatcher, lifecycle, store } = setup()
    const operation = await lifecycle.create({ definitionId: 'users', definitionRevision: 'b'.repeat(64), input: { formatId: 'csv', kind: 'import', mappings: [], source }, kind: 'import', queue: {}, resourceId: 'users', total: 0 }, {})
    store.outbox.clear()
    await lifecycle.complete(operation.id, null)
    const terminal = store.operations.get(operation.id)!
    store.operations.set(operation.id, Object.freeze({ ...terminal, revision: terminal.revision + 1 }))
    await expect(dispatcher.run()).resolves.toEqual({ dispatched: 0, inspected: 1 })
    expect(completed).not.toHaveBeenCalled()
    expect(store.outbox.size).toBe(0)
  })
})
