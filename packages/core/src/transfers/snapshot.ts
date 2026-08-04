import type {
  TransferOperationIdentity,
  TransferStorageAdapter,
  TransferStoredArtifact,
  TransferUploadResolver,
} from './contracts'

export async function snapshotTransferUpload(input: {
  readonly contentType: string
  readonly disk: string
  readonly filename: string
  readonly identity: TransferOperationIdentity
  readonly maximumBytes: number
  readonly operationId: string
  readonly sourceId: string
  readonly storage: TransferStorageAdapter
  readonly uploads: TransferUploadResolver
}): Promise<TransferStoredArtifact> {
  if (!Number.isSafeInteger(input.maximumBytes) || input.maximumBytes < 1) throw new TransferSnapshotError('invalid_limit')
  const uploaded = await input.uploads.resolve(input.sourceId, input.identity)
  if (!uploaded || uploaded.size > input.maximumBytes) throw new TransferSnapshotError('source_unavailable')
  const source = await input.storage.source(uploaded)
  if (!source || source.size !== uploaded.size || source.digest.value !== uploaded.digest.value) throw new TransferSnapshotError('source_unavailable')
  const writer = await input.storage.writer({ contentType: input.contentType, disk: input.disk, filename: input.filename, operationId: input.operationId, purpose: 'input' })
  let written = 0
  try {
    for await (const chunk of source.chunks()) {
      written += chunk.byteLength
      if (written > input.maximumBytes) throw new TransferSnapshotError('source_too_large')
      await writer.write(chunk)
    }
    const artifact = await writer.close()
    if (artifact.size !== uploaded.size || artifact.digest.value !== uploaded.digest.value) throw new TransferSnapshotError('integrity_mismatch')
    return artifact
  } catch (error) {
    await writer.abort()
    throw error
  }
}

export class TransferSnapshotError extends Error {
  constructor(readonly code: string) {
    super('[Holo Panels] Transfer source snapshot failed.')
    this.name = 'TransferSnapshotError'
  }
}
