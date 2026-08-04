import { describe, expect, it, vi } from 'vitest'
import type { TransferOperationIdentity, TransferStoredArtifact } from '../src/transfers/contracts'
import { snapshotTransferUpload } from '../src/transfers/snapshot'

const digest = Object.freeze({ algorithm: 'sha256' as const, value: 'a'.repeat(64) })
const uploaded: TransferStoredArtifact = Object.freeze({ contentType: 'text/csv', digest, disk: 'private', filename: 'upload.csv', path: 'temporary/upload.csv', size: 3 })
const identity: TransferOperationIdentity = Object.freeze({ actor: { type: 'number' as const, value: 1 }, guard: 'admin', panelId: 'admin', provider: null, tenant: { type: 'string' as const, value: 'tenant-a' } })

describe('P15 immutable import source snapshots', () => {
  it('copies the authorized source once into an operation-owned artifact', async () => {
    const written: Uint8Array[] = []
    const result = Object.freeze({ ...uploaded, filename: 'input.csv', path: 'transfers/operation-1/input/value.csv' })
    const close = vi.fn(() => Promise.resolve(result))
    const abort = vi.fn(() => Promise.resolve())
    const artifact = await snapshotTransferUpload({
      contentType: 'text/csv', disk: 'private', filename: 'input.csv', identity, maximumBytes: 10, operationId: 'operation-1', sourceId: 'upload-1',
      storage: {
        visibility: 'private', delete: () => Promise.resolve(),
        source: () => Promise.resolve({ digest, size: 3, chunks: async function * () { yield new Uint8Array([1, 2]); yield new Uint8Array([3]) } }),
        writer: () => Promise.resolve({ abort, close, write: chunk => { written.push(chunk); return Promise.resolve() } }),
      },
      uploads: { resolve: (_sourceId, current) => Promise.resolve(current === identity ? uploaded : null) },
    })
    expect(artifact).toBe(result)
    expect(written.map(chunk => [...chunk])).toEqual([[1, 2], [3]])
    expect(close).toHaveBeenCalledOnce()
    expect(abort).not.toHaveBeenCalled()
  })

  it('aborts and rejects replacement or integrity mismatches', async () => {
    const abort = vi.fn(() => Promise.resolve())
    await expect(snapshotTransferUpload({
      contentType: 'text/csv', disk: 'private', filename: 'input.csv', identity, maximumBytes: 10, operationId: 'operation-1', sourceId: 'upload-1',
      storage: {
        visibility: 'private', delete: () => Promise.resolve(),
        source: () => Promise.resolve({ digest, size: 3, chunks: async function * () { yield new Uint8Array([1, 2, 3]) } }),
        writer: () => Promise.resolve({ abort, close: () => Promise.resolve({ ...uploaded, digest: { algorithm: 'sha256', value: 'b'.repeat(64) } }), write: () => Promise.resolve() }),
      },
      uploads: { resolve: () => Promise.resolve(uploaded) },
    })).rejects.toMatchObject({ code: 'integrity_mismatch' })
    expect(abort).toHaveBeenCalledOnce()
  })
})
