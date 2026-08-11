export type UploadOperation = 'create' | 'delete' | 'finalize' | 'preview' | 'write'

export interface UploadPolicy {
  readonly acceptedExtensions: readonly string[]
  readonly acceptedMimeTypes: readonly string[]
  readonly conversions?: readonly string[]
  readonly directory: string
  readonly disk: string
  readonly expiresInSeconds: number
  readonly imageOnly: boolean
  readonly maximumFiles: number
  readonly maximumSize: number
  readonly private: boolean
}

export interface UploadActorContext {
  readonly actorId: string
  readonly fieldId: string
  readonly panelId: string
  readonly resourceId: string
  readonly tenantId?: string
}

export interface TemporaryUploadDescriptor {
  readonly declaredMimeType: string
  readonly expiresAt: string
  readonly extension: string
  readonly fieldId: string
  readonly id: string
  readonly name: string
  readonly panelId: string
  readonly resourceId: string
  readonly size: number
  readonly state: 'pending' | 'stored'
  readonly tenantId?: string
  readonly token: string
}

export interface StoredUploadDescriptor extends Omit<TemporaryUploadDescriptor, 'state' | 'token'> {
  readonly detectedMimeType: string
  readonly previewUrl?: string
  readonly state: 'stored'
}

export interface FinalizedUploadResult {
  readonly disk: string
  readonly mimeType: string
  readonly name: string
  readonly path: string
  readonly size: number
}

export interface UploadAuthorizationRequest extends UploadActorContext {
  readonly operation: UploadOperation
  readonly uploadId?: string
}

export type UploadAuthorizer = (request: UploadAuthorizationRequest) => boolean | Promise<boolean>

export interface UploadStorageListRequest {
  readonly cursor: string | null
  readonly limit: number
}

export interface UploadStorageListPage {
  readonly nextCursor: string | null
  readonly paths: readonly string[]
}

export interface UploadStorageAdapter {
  delete(path: string): Promise<void>
  getBytes(path: string): Promise<Uint8Array | null>
  getJson<TValue>(path: string): Promise<TValue | null>
  list(directory: string, request: UploadStorageListRequest): Promise<UploadStorageListPage>
  put(path: string, contents: Uint8Array): Promise<void>
  putJson(path: string, value: unknown): Promise<void>
  temporaryUrl(path: string, expiresInSeconds: number): Promise<string>
}

export interface UploadMimeInspector {
  inspect(contents: Uint8Array, fileName: string): string
}

export interface TemporaryUploadServiceOptions {
  readonly authorize: UploadAuthorizer
  readonly createId?: () => string
  readonly createToken?: () => string
  readonly inspectMime?: UploadMimeInspector
  readonly now?: () => Date
  readonly policy: UploadPolicy
  readonly storage?: UploadStorageAdapter
}

export interface CreateTemporaryUploadInput extends UploadActorContext {
  readonly declaredMimeType: string
  readonly name: string
  readonly size: number
}

export interface WriteTemporaryUploadInput extends UploadActorContext {
  readonly contents: Uint8Array
  readonly id: string
  readonly token: string
}

export type UploadEndpointBody =
  | { readonly action: 'create', readonly declaredMimeType: string, readonly name: string, readonly size: number }
  | { readonly action: 'delete', readonly id: string, readonly token: string }
  | { readonly action: 'resolve', readonly id: string, readonly token: string }
  | { readonly action: 'write', readonly contents: Uint8Array, readonly id: string, readonly token: string }

export interface UploadEndpointRequest {
  readonly body: UploadEndpointBody
  readonly context: UploadActorContext
  readonly csrfVerified: boolean
}

export type UploadEndpointResponse = TemporaryUploadDescriptor | StoredUploadDescriptor | { readonly deleted: true }

export interface ResolveTemporaryUploadInput extends UploadActorContext {
  readonly id: string
  readonly token: string
}

export interface DeleteTemporaryUploadInput extends UploadActorContext {
  readonly id: string
  readonly token: string
}

export interface MediaAttachmentResult {
  readonly id: string
  readonly url?: string
  readonly urls: Readonly<Record<string, string>>
}

export interface MediaAttachmentBuilder {
  usingFileName(fileName: string): MediaAttachmentBuilder
  toMediaCollection(collectionName?: string): Promise<{
    readonly data: { readonly uuid: string, getUrl(conversion?: string): string | null } | null
    readonly error: { readonly message: string } | null
  }>
}

export interface MediaAttachmentTarget {
  addMedia(source: { readonly contents: Uint8Array, readonly fileName: string, readonly mimeType: string }): MediaAttachmentBuilder
}
