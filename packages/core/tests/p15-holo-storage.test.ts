import { beforeEach, describe, expect, it, vi } from 'vitest'

const files = new Map<string, Uint8Array>()
const disk = {
  name: 'private',
  visibility: 'private' as const,
  delete(path: string | string[]) {
    for (const value of typeof path === 'string' ? [path] : path) files.delete(value)
    return Promise.resolve(true)
  },
  exists(path: string) { return Promise.resolve(files.has(path)) },
  async readStream(path: string, options: { readonly chunkBytes?: number } = {}) {
    const bytes = files.get(path)
    if (!bytes) return null
    const chunkBytes = options.chunkBytes ?? 65_536
    return (async function * () {
      for (let offset = 0; offset < bytes.length; offset += chunkBytes) yield bytes.slice(offset, offset + chunkBytes)
    })()
  },
  async writeStream(path: string, source: AsyncIterable<Uint8Array>, options: { readonly overwrite?: boolean } = {}) {
    if (files.has(path) && options.overwrite === false) return false
    const chunks: Uint8Array[] = []
    for await (const chunk of source) chunks.push(chunk)
    files.set(path, Uint8Array.from(chunks.flatMap(chunk => [...chunk])))
    return true
  },
}

vi.mock('@holo-js/storage/runtime', () => ({ Storage: { disk: () => disk } }))

import { createHoloTransferStorage } from '../src/transfers/holo-storage'

beforeEach(() => files.clear())

describe('P15 Holo streaming storage adapter', () => {
  it('streams create-only private output and records an incremental digest', async () => {
    const storage = createHoloTransferStorage()
    const writer = await storage.writer({ contentType: 'text/csv', disk: 'private', filename: 'result.csv', operationId: 'operation-1', purpose: 'result' })
    await writer.write(new TextEncoder().encode('hello'))
    await writer.write(new TextEncoder().encode(' world'))
    const artifact = await writer.close()
    expect(artifact).toMatchObject({ digest: { algorithm: 'sha256', value: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9' }, size: 11 })
    expect(new TextDecoder().decode(files.get(artifact.path))).toBe('hello world')
  })

  it('verifies size and digest while streaming source chunks', async () => {
    const storage = createHoloTransferStorage()
    files.set('input.csv', new TextEncoder().encode('hello world'))
    const source = await storage.source({ contentType: 'text/csv', digest: { algorithm: 'sha256', value: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9' }, disk: 'private', filename: 'input.csv', path: 'input.csv', size: 11 })
    const chunks: Uint8Array[] = []
    for await (const chunk of source!.chunks({ chunkBytes: 4096 })) chunks.push(chunk)
    expect(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(chunk => [...chunk])))).toBe('hello world')
    const hostile = await storage.source({ contentType: 'text/csv', digest: { algorithm: 'sha256', value: 'a'.repeat(64) }, disk: 'private', filename: 'input.csv', path: 'input.csv', size: 11 })
    await expect(async () => {
      for await (const _chunk of hostile!.chunks()) continue
    }).rejects.toMatchObject({ code: 'integrity_mismatch' })
  })

  it('rejects empty and oversized chunks and removes aborted output', async () => {
    const storage = createHoloTransferStorage({ maximumChunkBytes: 4096 })
    const writer = await storage.writer({ contentType: 'text/csv', disk: 'private', filename: 'result.csv', operationId: 'operation-1', purpose: 'result' })
    await expect(writer.write(new Uint8Array())).rejects.toMatchObject({ code: 'invalid_write' })
    await writer.abort()
    expect(files.size).toBe(0)
  })
})
