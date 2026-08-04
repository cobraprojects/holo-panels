import { describe, expect, it } from 'vitest'
import { TransferCleanupWorker } from '../src/transfers/cleanup'
import type { TransferArtifactWriter, TransferInputSource, TransferStorageAdapter, TransferStoredArtifact } from '../src/transfers/contracts'
import { TransferOperationLifecycle } from '../src/transfers/lifecycle'
import { MemoryTransferStore } from './helpers/transfer-store'

class CleanupStorage implements TransferStorageAdapter {
  readonly visibility = 'private' as const
  readonly deleted: TransferStoredArtifact[][] = []
  source(_artifact: TransferStoredArtifact): Promise<TransferInputSource | null> { return Promise.resolve(null) }
  writer(_input: { readonly contentType: string, readonly disk: string, readonly filename: string, readonly operationId: string, readonly purpose: 'failure-rows' | 'input' | 'part' | 'result' }): Promise<TransferArtifactWriter> { return Promise.reject(new Error('unused')) }
  delete(artifacts: readonly TransferStoredArtifact[]): Promise<void> { this.deleted.push([...artifacts]); return Promise.resolve() }
}

const digest = Object.freeze({ algorithm: 'sha256' as const, value: 'a'.repeat(64) })
const resultArtifact = Object.freeze({ contentType: 'text/csv', digest, disk: 'private', filename: 'result.csv', path: 'transfers/transfer-1/result.csv', size: 100 })

describe('P15 transfer cleanup', () => {
  it('deletes private artifacts before revision-checked operation deletion after outbox delivery', async () => {
    let now = new Date('2026-07-29T10:00:00.000Z')
    let sequence = 0
    const store = new MemoryTransferStore()
    const lifecycle = new TransferOperationLifecycle({
      authorizeCancellation: () => true, authorizeDownload: () => true, clock: () => now,
      identifyActor: () => 1, identifyGuard: () => 'admin', identifyPanel: () => 'admin', identifyProvider: () => 'users', identifyTenant: () => 'tenant-a',
      makeId: () => `id-${++sequence}`, maxChunkRetries: 2, retentionMilliseconds: 60_000, signDownload: () => 'token', store, verifyDownload: () => null,
    })
    const operation = await lifecycle.create({
      definitionId: 'users', definitionRevision: 'b'.repeat(64), input: { columnIds: ['id'], formatId: 'csv', kind: 'export', selection: { mode: 'all-matching', excludedRecordIds: [] }, tableState: { pagination: 'page' } },
      kind: 'export', queue: {}, resourceId: 'users', total: 1,
    }, {})
    const failureArtifact = Object.freeze({ ...resultArtifact, filename: 'failures.csv', path: 'transfers/transfer-1/failures.csv' })
    const partArtifact = Object.freeze({ ...resultArtifact, contentType: 'application/vnd.holo-panels.transfer-part+jsonl', filename: 'chunk-0.jsonl', path: 'transfers/transfer-1/part/chunk-0.jsonl' })
    const firstQueue = [...store.outbox.values()].find(record => record.event.kind === 'queue')?.event
    if (!firstQueue || firstQueue.kind !== 'queue') throw new Error('expected queue event')
    await lifecycle.claim(firstQueue.envelope)
    await lifecycle.progress(operation.id, { completed: 1, kind: 'export', next: { chunk: 1, configuration: {} }, part: { artifact: partArtifact, chunk: 0, rows: 1 } })
    await lifecycle.complete(operation.id, resultArtifact, { artifact: failureArtifact, count: 1 })
    store.outbox.clear()
    now = new Date('2026-07-29T10:01:00.000Z')
    const storage = new CleanupStorage()
    await expect(new TransferCleanupWorker(lifecycle, storage).run(10, now)).resolves.toEqual({ deleted: 1, inspected: 1 })
    expect(storage.deleted).toEqual([[resultArtifact, failureArtifact, partArtifact]])
    await expect(lifecycle.get(operation.id)).rejects.toMatchObject({ code: 'unknown_operation' })
  })
})
