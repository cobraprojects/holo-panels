import type {
  StoredUploadDescriptor,
  TemporaryUploadDescriptor,
  UploadActorContext,
  UploadPolicy,
} from '@holo-js/panels-core'

export type ClientUploadStatus = 'existing' | 'failed' | 'pending' | 'stored' | 'uploading'

export interface ClientUploadFile {
  readonly name: string
  readonly size: number
  readonly type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface ClientUploadItem {
  readonly error: string | null
  readonly id: string
  readonly mimeType: string
  readonly name: string
  readonly previewUrl?: string
  readonly progress: number
  readonly size: number
  readonly status: ClientUploadStatus
  readonly token?: string
}

export interface ExistingMediaItem {
  readonly id: string
  readonly mimeType: string
  readonly name: string
  readonly previewUrl?: string
  readonly size: number
}

export interface UploadClientAdapter {
  create(
    context: UploadActorContext,
    file: Pick<ClientUploadFile, 'name' | 'size' | 'type'>,
    signal: AbortSignal,
  ): Promise<TemporaryUploadDescriptor>
  delete(context: UploadActorContext, id: string, token: string, signal: AbortSignal): Promise<void>
  deleteExisting(context: UploadActorContext, id: string, signal: AbortSignal): Promise<void>
  resolve(context: UploadActorContext, id: string, token: string, signal: AbortSignal): Promise<StoredUploadDescriptor>
  write(
    context: UploadActorContext,
    upload: TemporaryUploadDescriptor,
    contents: Uint8Array,
    signal: AbortSignal,
    onProgress: (progress: number) => void,
  ): Promise<StoredUploadDescriptor>
}

export interface UploadStoreOptions {
  readonly adapter: UploadClientAdapter
  readonly context: UploadActorContext
  readonly existing?: readonly ExistingMediaItem[]
  readonly maximumConcurrency?: number
  readonly policy: UploadPolicy
}

export interface UploadStoreState {
  readonly items: readonly ClientUploadItem[]
  readonly pending: number
  readonly version: number
}

export type UploadStoreListener = (state: UploadStoreState) => void
