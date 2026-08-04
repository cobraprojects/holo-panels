import type {
  TransferOperationRecord,
  TransferStorageAdapter,
  TransferStoredArtifact,
} from './contracts'
import type { TransferOperationLifecycle } from './lifecycle'

export interface TransferCleanupResult {
  readonly deleted: number
  readonly inspected: number
}

export class TransferCleanupWorker<TRequestScope> {
  constructor(
    private readonly lifecycle: TransferOperationLifecycle<TRequestScope>,
    private readonly storage: TransferStorageAdapter,
  ) {}

  async run(limit: number, at?: Date): Promise<TransferCleanupResult> {
    const operations = await this.lifecycle.cleanupEligible(limit, at)
    let deleted = 0
    for (const operation of operations) {
      await this.storage.delete(artifacts(operation))
      if (await this.lifecycle.delete(operation.id, operation.revision)) deleted += 1
    }
    return Object.freeze({ deleted, inspected: operations.length })
  }
}

function artifacts(operation: TransferOperationRecord): readonly TransferStoredArtifact[] {
  return Object.freeze([
    ...(operation.artifact ? [operation.artifact] : []),
    ...(operation.failureRows ? [operation.failureRows.artifact] : []),
    ...operation.parts.map(part => part.artifact),
  ])
}
