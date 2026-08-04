import { createHash, randomUUID } from 'node:crypto'
import type { StorageDisk } from '@holo-js/storage/runtime'
import type {
  TransferArtifactWriter,
  TransferInputSource,
  TransferStorageAdapter,
  TransferStoredArtifact,
} from './contracts'

export interface HoloTransferStorageOptions {
  readonly maximumChunkBytes?: number
}

export function createHoloTransferStorage(options: HoloTransferStorageOptions = {}): TransferStorageAdapter {
  const maximumChunkBytes = options.maximumChunkBytes ?? 1_048_576
  if (!Number.isSafeInteger(maximumChunkBytes) || maximumChunkBytes < 4_096 || maximumChunkBytes > 1_048_576) {
    throw new Error('[Holo Panels] Transfer storage chunk limit must be between 4 KiB and 1 MiB.')
  }
  const adapter: TransferStorageAdapter = {
    visibility: 'private' as const,
    async source(artifact) {
      const { Storage } = await import('@holo-js/storage/runtime')
      const disk = Storage.disk(artifact.disk)
      if (disk.visibility !== 'private') throw new TransferStorageError('invalid_visibility')
      if (!await disk.exists(artifact.path)) return null
      const source: TransferInputSource = Object.freeze({
        digest: artifact.digest,
        size: artifact.size,
        async * chunks(readOptions: { readonly chunkBytes?: number } = {}) {
          const chunkBytes = readOptions.chunkBytes ?? 65_536
          if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 4_096 || chunkBytes > maximumChunkBytes) throw new TransferStorageError('invalid_chunk_size')
          const stream = await disk.readStream(artifact.path, { chunkBytes })
          if (!stream) throw new TransferStorageError('source_unavailable')
          const digest = createHash('sha256')
          let size = 0
          for await (const chunk of stream) {
            if (chunk.byteLength === 0 || chunk.byteLength > chunkBytes) throw new TransferStorageError('invalid_storage_chunk')
            size += chunk.byteLength
            if (size > artifact.size) throw new TransferStorageError('integrity_mismatch')
            digest.update(chunk)
            yield chunk
          }
          if (size !== artifact.size || digest.digest('hex') !== artifact.digest.value) throw new TransferStorageError('integrity_mismatch')
        },
      })
      return source
    },
    async writer(input) {
      if (!/^[a-z0-9][a-z0-9._:-]{0,199}$/iu.test(input.operationId)) throw new TransferStorageError('invalid_operation')
      const { Storage } = await import('@holo-js/storage/runtime')
      const disk = Storage.disk(input.disk)
      if (disk.visibility !== 'private') throw new TransferStorageError('invalid_visibility')
      const extension = extensionFrom(input.filename)
      const path = `transfers/${input.operationId}/${input.purpose}/${randomUUID()}${extension}`
      return new HoloTransferArtifactWriter(disk, path, input.contentType, input.filename, maximumChunkBytes)
    },
    async delete(artifacts) {
      const { Storage } = await import('@holo-js/storage/runtime')
      for (const [diskName, paths] of byDisk(artifacts)) await Storage.disk(diskName).delete([...paths])
    },
  }
  return Object.freeze(adapter)
}

export class TransferStorageError extends Error {
  constructor(readonly code: string) {
    super('[Holo Panels] Transfer storage operation failed.')
    this.name = 'TransferStorageError'
  }
}

interface PendingChunk {
  readonly bytes: Uint8Array
  readonly consumed: () => void
}

class HoloTransferArtifactWriter implements TransferArtifactWriter {
  readonly #contentType: string
  readonly #disk: StorageDisk
  readonly #filename: string
  readonly #hash = createHash('sha256')
  readonly #maximumChunkBytes: number
  readonly #path: string
  readonly #pending: PendingChunk[] = []
  readonly #writeResult: Promise<boolean>
  #closed = false
  #size = 0
  #wake: (() => void) | null = null

  constructor(disk: StorageDisk, path: string, contentType: string, filename: string, maximumChunkBytes: number) {
    this.#disk = disk
    this.#path = path
    this.#contentType = contentType
    this.#filename = filename
    this.#maximumChunkBytes = maximumChunkBytes
    this.#writeResult = disk.writeStream(path, this.stream(), { overwrite: false })
  }

  async write(chunk: Uint8Array): Promise<void> {
    if (this.#closed || chunk.byteLength === 0 || chunk.byteLength > this.#maximumChunkBytes) throw new TransferStorageError('invalid_write')
    const bytes = Uint8Array.from(chunk)
    this.#size += bytes.byteLength
    this.#hash.update(bytes)
    await new Promise<void>((resolve) => {
      this.#pending.push({ bytes, consumed: resolve })
      this.#wake?.()
      this.#wake = null
    })
  }

  async close(): Promise<TransferStoredArtifact> {
    if (this.#closed) throw new TransferStorageError('invalid_write')
    this.#closed = true
    this.#wake?.()
    this.#wake = null
    if (!await this.#writeResult) throw new TransferStorageError('destination_exists')
    return Object.freeze({
      contentType: this.#contentType,
      digest: Object.freeze({ algorithm: 'sha256' as const, value: this.#hash.digest('hex') }),
      disk: this.#disk.name,
      filename: this.#filename,
      path: this.#path,
      size: this.#size,
    })
  }

  async abort(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true
      this.#wake?.()
      this.#wake = null
    }
    try { await this.#writeResult } catch { this.#closed = true }
    await this.#disk.delete(this.#path)
  }

  private async * stream(): AsyncIterable<Uint8Array> {
    while (!this.#closed || this.#pending.length > 0) {
      const next = this.#pending.shift()
      if (next) {
        yield next.bytes
        next.consumed()
        continue
      }
      await new Promise<void>(resolve => { this.#wake = resolve })
    }
  }
}

function extensionFrom(filename: string): string {
  if (!filename || filename.length > 255 || /[/\\\0]/u.test(filename)) throw new TransferStorageError('invalid_filename')
  const index = filename.lastIndexOf('.')
  return index <= 0 ? '' : filename.slice(index).toLowerCase()
}

function byDisk(artifacts: readonly TransferStoredArtifact[]): ReadonlyMap<string, readonly string[]> {
  const grouped = new Map<string, string[]>()
  for (const artifact of artifacts) grouped.set(artifact.disk, [...(grouped.get(artifact.disk) ?? []), artifact.path])
  return grouped
}
