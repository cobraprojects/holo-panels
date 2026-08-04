import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ExporterBuilder } from '../src/transfers/builders'
import type { ExportQueryAdapter, TransferArtifactWriter, TransferInputSource, TransferStorageAdapter, TransferStoredArtifact } from '../src/transfers/contracts'
import { csvExportFormat, xlsxExportFormat } from '../src/transfers/formats'
import { TransferOperationLifecycle } from '../src/transfers/lifecycle'
import { finalizeTransferExportParts, persistTransferExportPart, readTransferResultParts, writeTransferResultPart } from '../src/transfers/parts'
import { transferDefinitionRevision } from '../src/transfers/revision'
import { MemoryTransferStore } from './helpers/transfer-store'

interface Actor { readonly id: number }
interface Tenant { readonly id: string }
interface Row { readonly id: number, readonly name: string }
interface Query { readonly rows: readonly Row[] }

const context = Object.freeze({ actor: { id: 1 }, guard: 'admin', panelId: 'admin', provider: null, resourceId: 'users', signal: new AbortController().signal, tenant: { id: 'tenant-a' } })

class MemoryStorage implements TransferStorageAdapter {
  readonly visibility = 'private' as const
  readonly artifacts = new Map<string, Uint8Array>()
  readonly deleted: string[] = []
  aborted = 0
  failNextWrite = false
  maximumReadChunk = 0
  maximumWriteChunk = 0
  sequence = 0

  delete(artifacts: readonly TransferStoredArtifact[]): Promise<void> {
    for (const artifact of artifacts) {
      this.artifacts.delete(artifact.path)
      this.deleted.push(artifact.path)
    }
    return Promise.resolve()
  }

  source(artifact: TransferStoredArtifact): Promise<TransferInputSource | null> {
    const bytes = this.artifacts.get(artifact.path)
    if (!bytes) return Promise.resolve(null)
    const trackRead = (length: number) => { this.maximumReadChunk = Math.max(this.maximumReadChunk, length) }
    return Promise.resolve(Object.freeze({
      digest: artifact.digest,
      size: artifact.size,
      async * chunks() {
        const digest = createHash('sha256')
        let size = 0
        for (let offset = 0; offset < bytes.length; offset += 7) {
          const chunk = bytes.slice(offset, offset + 7)
          trackRead(chunk.length)
          digest.update(chunk)
          size += chunk.length
          yield chunk
        }
        if (size !== artifact.size || digest.digest('hex') !== artifact.digest.value) throw new Error('integrity_mismatch')
      },
    }))
  }

  writer(input: { readonly contentType: string, readonly disk: string, readonly filename: string, readonly operationId: string, readonly purpose: 'failure-rows' | 'input' | 'part' | 'result' }): Promise<TransferArtifactWriter> {
    const chunks: Uint8Array[] = []
    const path = `transfers/${input.operationId}/${input.purpose}/${++this.sequence}`
    let closed = false
    return Promise.resolve({
      abort: () => { this.aborted += 1; closed = true; this.artifacts.delete(path); return Promise.resolve() },
      close: () => {
        if (closed) return Promise.reject(new Error('closed'))
        closed = true
        const bytes = Uint8Array.from(chunks.flatMap(chunk => [...chunk]))
        this.artifacts.set(path, bytes)
        return Promise.resolve(Object.freeze({
          contentType: input.contentType,
          digest: Object.freeze({ algorithm: 'sha256' as const, value: createHash('sha256').update(bytes).digest('hex') }),
          disk: input.disk,
          filename: input.filename,
          path,
          size: bytes.length,
        }))
      },
      write: (chunk) => {
        if (this.failNextWrite) {
          this.failNextWrite = false
          return Promise.reject(new Error('simulated_crash'))
        }
        this.maximumWriteChunk = Math.max(this.maximumWriteChunk, chunk.length)
        chunks.push(Uint8Array.from(chunk))
        return Promise.resolve()
      },
    })
  }
}

function query(): ExportQueryAdapter<Query, Row, number, Actor, Tenant> {
  return {
    primaryKey: 'id', applyAggregates: value => value, applyAuthorizationScope: value => value, applyRelations: value => value,
    applySelection: value => value, applyTableState: value => value, applyTenantScope: value => value, authorize: () => true,
    count: value => Promise.resolve(value.rows.length), createQuery: () => ({ rows: [] }), fetchChunk: () => Promise.resolve([]), orderBy: value => value,
  }
}

function exporter(format: 'csv' | 'xlsx', authorize = true) {
  const builder = new ExporterBuilder<Query, Row, number, Actor, Tenant>('users', 'users')
    .column('id', 'id', column => column.label('ID'))
    .column('name', 'name', column => column.label('Name'))
    .query(query())
    .chunkSize(2)
    .maxRows(10)
    .authorize(() => authorize)
  return format === 'csv'
    ? builder.format(csvExportFormat(), {}).compile()
    : builder.format(xlsxExportFormat(), {}).compile()
}

function harness(format: 'csv' | 'xlsx' = 'csv') {
  let sequence = 0
  const definition = exporter(format)
  const store = new MemoryTransferStore<number>()
  const lifecycle = new TransferOperationLifecycle({
    authorizeCancellation: () => true, authorizeDownload: () => true, identifyActor: () => 1, identifyGuard: () => 'admin', identifyPanel: () => 'admin',
    identifyProvider: () => null, identifyTenant: () => 'tenant-a', makeId: () => `id-${++sequence}`, maxChunkRetries: 2, retentionMilliseconds: 1000,
    signDownload: () => 'token', store, verifyDownload: () => null,
  })
  const create = () => lifecycle.create({
    definitionId: 'users', definitionRevision: transferDefinitionRevision(definition), input: { columnIds: ['id', 'name'], formatId: format, kind: 'export', selection: { mode: 'all-matching', excludedRecordIds: [] }, tableState: { pagination: 'page' } },
    kind: 'export', queue: {}, resourceId: 'users', total: 2,
  }, {})
  return { create, definition, lifecycle, store }
}

async function queueEnvelope(store: MemoryTransferStore<number>, revision: number) {
  const event = [...store.outbox.values()].find(record => record.operationRevision === revision && record.event.kind === 'queue')?.event
  if (!event || event.kind !== 'queue') throw new Error('queue event unavailable')
  return event.envelope
}

describe('P15 resumable export parts', () => {
  it('atomically persists one bounded contiguous part and deletes a stale worker result', async () => {
    const { create, lifecycle, store } = harness()
    const storage = new MemoryStorage()
    await create()
    await lifecycle.claim(await queueEnvelope(store, 0))
    const options = { chunk: 0, chunkSize: 2, columnCount: 2, completed: 1, disk: 'private', lifecycle, next: { chunk: 1, configuration: {} }, operationId: 'id-1', rows: [[1, 'Ada']] as const, storage }
    const results = await Promise.allSettled([persistTransferExportPart(options), persistTransferExportPart(options)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect((await lifecycle.get('id-1')).parts).toHaveLength(1)
    expect(storage.deleted).toHaveLength(1)
  })

  it('rejects non-contiguous, oversized, and malformed part transitions', async () => {
    const { create, lifecycle, store } = harness()
    const storage = new MemoryStorage()
    await create()
    await lifecycle.claim(await queueEnvelope(store, 0))
    await expect(writeTransferResultPart({ chunk: 0, chunkSize: 1, columnCount: 2, disk: 'private', operationId: 'id-1', rows: [[1, 'Ada'], [2, 'Lin']], storage })).rejects.toMatchObject({ code: 'invalid_part' })
    const part = await writeTransferResultPart({ chunk: 1, chunkSize: 2, columnCount: 2, disk: 'private', operationId: 'id-1', rows: [[1, 'Ada']], storage })
    await expect(lifecycle.progress('id-1', { completed: 1, kind: 'export', next: { chunk: 2, configuration: {} }, part })).rejects.toMatchObject({ code: 'invalid_progress' })
  })

  it('converges after interruption during a part write without persisting a partial part', async () => {
    const { create, lifecycle, store } = harness()
    const storage = new MemoryStorage()
    await create()
    await lifecycle.claim(await queueEnvelope(store, 0))
    storage.failNextWrite = true
    const options = { chunk: 0, chunkSize: 2, columnCount: 2, completed: 2, disk: 'private', lifecycle, next: { chunk: 1, configuration: {} }, operationId: 'id-1', rows: [[1, 'Ada'], [2, 'Lin']] as const, storage }
    await expect(persistTransferExportPart(options)).rejects.toThrow('simulated_crash')
    expect(storage.artifacts.size).toBe(0)
    expect(storage.aborted).toBe(1)
    await expect(persistTransferExportPart(options)).resolves.toMatchObject({ parts: [{ chunk: 0, rows: 2 }] })
  })

  it.each(['csv', 'xlsx'] as const)('streams digest-verified parts into a final %s artifact', async (format) => {
    const { create, definition, lifecycle, store } = harness(format)
    const storage = new MemoryStorage()
    await create()
    await lifecycle.claim(await queueEnvelope(store, 0))
    const advanced = await persistTransferExportPart({ chunk: 0, chunkSize: 2, columnCount: 2, completed: 2, disk: 'private', lifecycle, next: { chunk: 1, configuration: {} }, operationId: 'id-1', rows: [[1, 'Ada'], [2, new Date('2026-07-29T00:00:00.000Z')]], storage })
    const claimed = await lifecycle.claim(await queueEnvelope(store, advanced.revision))
    const completed = await finalizeTransferExportParts({ context, definition, lifecycle, operation: claimed, storage })
    expect(completed).toMatchObject({ artifact: { contentType: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, status: 'completed' })
    expect(storage.maximumReadChunk).toBeLessThanOrEqual(7)
    expect(storage.maximumWriteChunk).toBeLessThanOrEqual(65_536)
  })

  it('fails closed for digest mismatch, authorization revocation, and incomplete parts', async () => {
    const { create, lifecycle, store } = harness()
    const storage = new MemoryStorage()
    await create()
    await lifecycle.claim(await queueEnvelope(store, 0))
    const advanced = await persistTransferExportPart({ chunk: 0, chunkSize: 2, columnCount: 2, completed: 2, disk: 'private', lifecycle, next: { chunk: 1, configuration: {} }, operationId: 'id-1', rows: [[1, 'Ada'], [2, 'Lin']], storage })
    const claimed = await lifecycle.claim(await queueEnvelope(store, advanced.revision))
    await expect(finalizeTransferExportParts({ context, definition: exporter('csv', false), lifecycle, operation: claimed, storage })).rejects.toMatchObject({ code: 'authorization_revoked' })
    const artifact = claimed.parts[0]!.artifact
    storage.artifacts.set(artifact.path, encoder.encode('tampered\n'))
    await expect(finalizeTransferExportParts({ context, definition: exporter('csv'), lifecycle, operation: claimed, storage })).rejects.toBeTruthy()
    await expect(readTransferResultParts(storage, [], 2, 2)[Symbol.asyncIterator]().next()).resolves.toEqual({ done: true, value: undefined })
  })
})

const encoder = new TextEncoder()
