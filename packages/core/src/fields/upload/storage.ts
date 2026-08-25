import type { StorageDisk } from '@holo-js/storage/runtime'
import type { UploadStorageAdapter, UploadStorageListPage, UploadStorageListRequest } from './contracts'

export function createHoloUploadStorage(diskName: string): UploadStorageAdapter {
  let diskPromise: Promise<StorageDisk> | undefined
  const disk = async (): Promise<StorageDisk> => {
    diskPromise ??= import('@holo-js/storage/runtime').then(runtime => runtime.Storage.disk(diskName))
    return await diskPromise
  }
  return Object.freeze({
    async delete(path: string): Promise<void> {
      await (await disk()).delete(path)
    },
    async list(directory: string, request: UploadStorageListRequest): Promise<UploadStorageListPage> {
      return await (await disk()).listFiles(directory, request)
    },
    async getBytes(path: string): Promise<Uint8Array | null> {
      return await (await disk()).getBytes(path)
    },
    async getJson<TValue>(path: string): Promise<TValue | null> {
      return await (await disk()).json<TValue>(path)
    },
    async put(path: string, contents: Uint8Array): Promise<void> {
      if (!await (await disk()).put(path, contents)) throw new Error('Holo Storage rejected the temporary upload write')
    },
    async putJson(path: string, value: unknown): Promise<void> {
      if (!await (await disk()).putJson(path, value)) throw new Error('Holo Storage rejected the temporary upload metadata write')
    },
    async temporaryUrl(path: string, expiresInSeconds: number): Promise<string | null> {
      const storageDisk = await disk()
      return storageDisk.driver === 's3' ? storageDisk.temporaryUrl(path, { expiresIn: expiresInSeconds }) : null
    },
  })
}
