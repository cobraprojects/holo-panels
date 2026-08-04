import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  TransferArtifactWriter,
  TransferInputSource,
  TransferQueueAdapter,
  TransferQueueConfiguration,
  TransferQueueEnvelope,
  TransferStorageAdapter,
  TransferStoredArtifact,
} from '../src/transfers/contracts'

const envelope: TransferQueueEnvelope = Object.freeze({
  attempt: 1,
  chunk: 2,
  definitionId: 'posts',
  definitionRevision: 'a'.repeat(64),
  kind: 'export',
  operationId: 'operation-1',
  operationRevision: 3,
  panelId: 'admin',
  version: 2,
})

class AlternativeQueueDriver implements TransferQueueAdapter {
  readonly jobs: { readonly configuration: TransferQueueConfiguration, readonly envelope: TransferQueueEnvelope }[] = []

  enqueue(current: TransferQueueEnvelope, configuration: TransferQueueConfiguration): Promise<{ readonly jobId: string }> {
    this.jobs.push(Object.freeze({ configuration: Object.freeze({ ...configuration }), envelope: Object.freeze({ ...current }) }))
    return Promise.resolve({ jobId: `alternative-${this.jobs.length}` })
  }
}

class AlternativeStorageDriver implements TransferStorageAdapter {
  readonly visibility = 'private' as const
  readonly artifacts = new Map<string, Uint8Array>()
  #sequence = 0

  delete(artifacts: readonly TransferStoredArtifact[]): Promise<void> {
    for (const artifact of artifacts) this.artifacts.delete(artifact.path)
    return Promise.resolve()
  }

  source(artifact: TransferStoredArtifact): Promise<TransferInputSource | null> {
    const bytes = this.artifacts.get(artifact.path)
    if (!bytes) return Promise.resolve(null)
    return Promise.resolve(Object.freeze({
      digest: artifact.digest,
      size: artifact.size,
      async * chunks(options: { readonly chunkBytes?: number } = {}) {
        const chunkBytes = options.chunkBytes ?? 4096
        for (let offset = 0; offset < bytes.length; offset += chunkBytes) yield bytes.slice(offset, offset + chunkBytes)
      },
    }))
  }

  writer(input: {
    readonly contentType: string
    readonly disk: string
    readonly filename: string
    readonly operationId: string
    readonly purpose: 'failure-rows' | 'input' | 'part' | 'result'
  }): Promise<TransferArtifactWriter> {
    const chunks: Uint8Array[] = []
    const path = `alternative/${input.operationId}/${input.purpose}/${++this.#sequence}`
    let closed = false
    return Promise.resolve({
      abort: () => {
        closed = true
        this.artifacts.delete(path)
        return Promise.resolve()
      },
      close: () => {
        if (closed) return Promise.reject(new Error('Alternative writer is closed'))
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
        if (closed || chunk.byteLength === 0) return Promise.reject(new Error('Alternative write is invalid'))
        chunks.push(Uint8Array.from(chunk))
        return Promise.resolve()
      },
    })
  }
}

async function queueDriverContract(driver: AlternativeQueueDriver): Promise<void> {
  await expect(driver.enqueue(envelope, { connection: 'alternative', queue: 'bulk' })).resolves.toEqual({ jobId: 'alternative-1' })
  expect(driver.jobs).toEqual([{ configuration: { connection: 'alternative', queue: 'bulk' }, envelope }])
  expect(JSON.stringify(driver.jobs)).not.toContain('actor')
  expect(JSON.stringify(driver.jobs)).not.toContain('tenant')
}

async function storageDriverContract(driver: AlternativeStorageDriver): Promise<void> {
  const writer = await driver.writer({ contentType: 'text/csv', disk: 'remote-private', filename: 'result.csv', operationId: 'operation-1', purpose: 'result' })
  await writer.write(new TextEncoder().encode('ID,Name\r\n'))
  await writer.write(new TextEncoder().encode('1,Ada\r\n'))
  const artifact = await writer.close()
  const source = await driver.source(artifact)
  const chunks: Uint8Array[] = []
  for await (const chunk of source?.chunks({ chunkBytes: 4 }) ?? []) chunks.push(chunk)
  expect(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(chunk => [...chunk])))).toBe('ID,Name\r\n1,Ada\r\n')
  expect(artifact).toMatchObject({ disk: 'remote-private', size: 16 })
  await driver.delete([artifact])
  await expect(driver.source(artifact)).resolves.toBeNull()
}

describe('P15 alternative transfer driver contracts', () => {
  it('accepts an alternative durable queue implementation without changing the transfer envelope', async () => {
    await queueDriverContract(new AlternativeQueueDriver())
  })

  it('accepts an alternative private streaming storage implementation', async () => {
    await storageDriverContract(new AlternativeStorageDriver())
  })
})
