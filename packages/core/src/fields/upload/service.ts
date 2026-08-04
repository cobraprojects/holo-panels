import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type {
  CreateTemporaryUploadInput,
  DeleteTemporaryUploadInput,
  MediaAttachmentResult,
  MediaAttachmentTarget,
  ResolveTemporaryUploadInput,
  StoredUploadDescriptor,
  TemporaryUploadDescriptor,
  TemporaryUploadServiceOptions,
  UploadActorContext,
  UploadPolicy,
  UploadStorageAdapter,
  WriteTemporaryUploadInput,
} from './contracts'
import { defaultUploadMimeInspector, defineUploadPolicy, uploadExtension } from './policy'
import { createHoloUploadStorage } from './storage'

interface UploadMetadata {
  readonly actorId: string
  readonly dataPath: string
  readonly declaredMimeType: string
  readonly detectedMimeType?: string
  readonly expiresAt: string
  readonly extension: string
  readonly fieldId: string
  readonly id: string
  readonly metadataPath: string
  readonly name: string
  readonly panelId: string
  readonly resourceId: string
  readonly size: number
  readonly state: 'pending' | 'stored'
  readonly tenantId?: string
  readonly tokenHash: string
}

const identifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u

function normalizeIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!identifierPattern.test(normalized)) throw new Error(`Invalid upload ${label}`)
  return normalized
}

function safeFileName(value: string): string {
  const normalized = value.trim().normalize('NFKC')
  if (!normalized || normalized.length > 255 || normalized.includes('/') || normalized.includes('\\') || normalized.includes('\0')) {
    throw new Error('Invalid upload file name')
  }
  return normalized
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function scopeKey(context: UploadActorContext): string {
  return [context.panelId, context.resourceId, context.fieldId, context.tenantId ?? '-', context.actorId].join(':')
}

function sameScope(metadata: UploadMetadata, context: UploadActorContext): boolean {
  return metadata.actorId === context.actorId
    && metadata.fieldId === context.fieldId
    && metadata.panelId === context.panelId
    && metadata.resourceId === context.resourceId
    && metadata.tenantId === context.tenantId
}

function publicDescriptor(metadata: UploadMetadata, token: string): TemporaryUploadDescriptor {
  return Object.freeze({
    declaredMimeType: metadata.declaredMimeType,
    expiresAt: metadata.expiresAt,
    extension: metadata.extension,
    fieldId: metadata.fieldId,
    id: metadata.id,
    name: metadata.name,
    panelId: metadata.panelId,
    resourceId: metadata.resourceId,
    size: metadata.size,
    state: metadata.state,
    ...(metadata.tenantId ? { tenantId: metadata.tenantId } : {}),
    token,
  })
}

export class TemporaryUploadService {
  readonly #authorize: TemporaryUploadServiceOptions['authorize']
  readonly #createId: () => string
  readonly #createToken: () => string
  readonly #inspectMime: NonNullable<TemporaryUploadServiceOptions['inspectMime']>
  readonly #locks = new Map<string, Promise<void>>()
  readonly #now: () => Date
  readonly #policy: UploadPolicy
  readonly #storage: UploadStorageAdapter

  constructor(options: TemporaryUploadServiceOptions) {
    this.#policy = defineUploadPolicy(options.policy)
    this.#authorize = options.authorize
    this.#createId = options.createId ?? randomUUID
    this.#createToken = options.createToken ?? (() => randomBytes(32).toString('base64url'))
    this.#inspectMime = options.inspectMime ?? defaultUploadMimeInspector
    this.#now = options.now ?? (() => new Date())
    this.#storage = options.storage ?? createHoloUploadStorage(this.#policy.disk)
  }

  async create(input: CreateTemporaryUploadInput): Promise<TemporaryUploadDescriptor> {
    this.assertContext(input)
    await this.authorize({ ...input, operation: 'create' })
    const name = safeFileName(input.name)
    const extension = uploadExtension(name)
    const declaredMimeType = input.declaredMimeType.trim().toLowerCase()
    if (!this.#policy.acceptedExtensions.includes(extension)) throw new Error('Upload extension is not allowed')
    if (!this.#policy.acceptedMimeTypes.includes(declaredMimeType)) throw new Error('Upload MIME type is not allowed')
    if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > this.#policy.maximumSize) {
      throw new Error('Upload size exceeds the configured limit')
    }
    return await this.withLock(scopeKey(input), async () => {
      const active = await this.activeUploads(input)
      if (active.length >= this.#policy.maximumFiles) throw new Error('Upload count exceeds the configured limit')
      const id = normalizeIdentifier(this.#createId(), 'ID')
      const token = this.#createToken()
      if (token.length < 32) throw new Error('Upload token generator returned an unsafe token')
      const paths = this.paths(id, extension)
      const expiresAt = new Date(this.#now().getTime() + this.#policy.expiresInSeconds * 1000).toISOString()
      const metadata: UploadMetadata = Object.freeze({
        actorId: input.actorId,
        dataPath: paths.data,
        declaredMimeType,
        expiresAt,
        extension,
        fieldId: input.fieldId,
        id,
        metadataPath: paths.metadata,
        name,
        panelId: input.panelId,
        resourceId: input.resourceId,
        size: input.size,
        state: 'pending',
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        tokenHash: hashToken(token),
      })
      await this.#storage.putJson(metadata.metadataPath, metadata)
      return publicDescriptor(metadata, token)
    })
  }

  async write(input: WriteTemporaryUploadInput): Promise<StoredUploadDescriptor> {
    this.assertContext(input)
    await this.authorize({ ...input, operation: 'write', uploadId: input.id })
    return await this.withLock(input.id, async () => {
      const metadata = await this.requireMetadata(input.id)
      this.assertAccess(metadata, input)
      if (metadata.state !== 'pending') throw new Error('Temporary upload is already stored')
      if (input.contents.byteLength !== metadata.size || input.contents.byteLength > this.#policy.maximumSize) {
        throw new Error('Uploaded content size does not match the authorized size')
      }
      const detectedMimeType = this.#inspectMime.inspect(input.contents, metadata.name).toLowerCase()
      if (detectedMimeType !== metadata.declaredMimeType || !this.#policy.acceptedMimeTypes.includes(detectedMimeType)) {
        throw new Error('Uploaded content MIME type does not match its declaration')
      }
      if (this.#policy.imageOnly && !detectedMimeType.startsWith('image/')) throw new Error('Uploaded content is not an image')
      await this.#storage.put(metadata.dataPath, input.contents)
      const stored: UploadMetadata = Object.freeze({ ...metadata, detectedMimeType, state: 'stored' })
      await this.#storage.putJson(metadata.metadataPath, stored)
      return await this.storedDescriptor(stored)
    })
  }

  async resolve(input: ResolveTemporaryUploadInput): Promise<StoredUploadDescriptor> {
    this.assertContext(input)
    await this.authorize({ ...input, operation: 'preview', uploadId: input.id })
    const metadata = await this.requireMetadata(input.id)
    this.assertAccess(metadata, input)
    if (metadata.state !== 'stored') throw new Error('Temporary upload has not been stored')
    return await this.storedDescriptor(metadata)
  }

  async delete(input: DeleteTemporaryUploadInput): Promise<void> {
    this.assertContext(input)
    await this.authorize({ ...input, operation: 'delete', uploadId: input.id })
    await this.withLock(input.id, async () => {
      const metadata = await this.requireMetadata(input.id)
      this.assertAccess(metadata, input)
      await Promise.all([
        this.#storage.delete(metadata.dataPath),
        this.#storage.delete(metadata.metadataPath),
      ])
    })
  }

  async attachToMedia(
    input: ResolveTemporaryUploadInput,
    target: MediaAttachmentTarget,
    collection = 'default',
  ): Promise<MediaAttachmentResult> {
    this.assertContext(input)
    await this.authorize({ ...input, operation: 'finalize', uploadId: input.id })
    return await this.withLock(input.id, async () => {
      const metadata = await this.requireMetadata(input.id)
      this.assertAccess(metadata, input)
      if (metadata.state !== 'stored' || !metadata.detectedMimeType) throw new Error('Temporary upload has not been stored')
      const contents = await this.#storage.getBytes(metadata.dataPath)
      if (!contents) throw new Error('Temporary upload contents are missing')
      const result = await target.addMedia({
        contents,
        fileName: metadata.name,
        mimeType: metadata.detectedMimeType,
      }).usingFileName(metadata.name).toMediaCollection(collection)
      if (!result.data || result.error) throw new Error(result.error?.message ?? 'Holo Media rejected the upload')
      const originalUrl = result.data.getUrl()
      const conversionUrls = (this.#policy.conversions ?? []).flatMap(conversion => {
        const value = result.data?.getUrl(conversion)
        return value ? [[conversion, value] as const] : []
      })
      const urls = Object.freeze(Object.fromEntries([
        ...(originalUrl ? [['original', originalUrl] as const] : []),
        ...conversionUrls,
      ]))
      const preferredConversion = this.#policy.conversions?.[0]
      const url = preferredConversion ? urls[preferredConversion] : originalUrl ?? undefined
      await Promise.all([
        this.#storage.delete(metadata.dataPath),
        this.#storage.delete(metadata.metadataPath),
      ])
      return Object.freeze({ id: result.data.uuid, ...(url ? { url } : {}), urls })
    })
  }

  async cleanupExpired(): Promise<number> {
    let removed = 0
    for await (const files of this.storagePages()) {
      for (const file of files.filter(path => path.endsWith('.json'))) {
        const metadata = await this.#storage.getJson<UploadMetadata>(file)
        if (!metadata || Date.parse(metadata.expiresAt) > this.#now().getTime()) continue
        await Promise.all([this.#storage.delete(metadata.dataPath), this.#storage.delete(metadata.metadataPath)])
        removed += 1
      }
    }
    return removed
  }

  private async activeUploads(context: UploadActorContext): Promise<readonly UploadMetadata[]> {
    const active: UploadMetadata[] = []
    for await (const files of this.storagePages()) {
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const metadata = await this.#storage.getJson<UploadMetadata>(file)
        if (metadata && sameScope(metadata, context) && Date.parse(metadata.expiresAt) > this.#now().getTime()) {
          active.push(metadata)
          if (active.length >= this.#policy.maximumFiles) return active
        }
      }
    }
    return active
  }

  private async *storagePages(): AsyncGenerator<readonly string[]> {
    const directory = this.metadataDirectory()
    const seenCursors = new Set<string>()
    const seenPaths = new Set<string>()
    let cursor: string | null = null
    do {
      const page = await this.#storage.list(directory, { cursor, limit: 100 })
      if (page === null || Array.isArray(page) || typeof page !== 'object' || !Array.isArray(page.paths) || page.paths.length > 100) {
        throw new UploadStoragePaginationError()
      }
      if (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.nextCursor.length === 0 || new TextEncoder().encode(page.nextCursor).byteLength > 2_048 || page.nextCursor === cursor || seenCursors.has(page.nextCursor))) {
        throw new UploadStoragePaginationError()
      }
      const pagePaths = new Set<string>()
      for (const path of page.paths) {
        if (typeof path !== 'string' || !path.startsWith(`${directory}/`) || path.includes('\\') || path.split('/').some(segment => segment === '.' || segment === '..') || [...path].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127) || pagePaths.has(path) || seenPaths.has(path)) {
          throw new UploadStoragePaginationError()
        }
        pagePaths.add(path)
      }
      for (const path of pagePaths) seenPaths.add(path)
      yield Object.freeze([...pagePaths])
      cursor = page.nextCursor
      if (cursor !== null) seenCursors.add(cursor)
    } while (cursor !== null)
  }

  private assertAccess(metadata: UploadMetadata, input: ResolveTemporaryUploadInput): void {
    if (!sameScope(metadata, input)) throw new Error('Temporary upload is not accessible in this scope')
    if (Date.parse(metadata.expiresAt) <= this.#now().getTime()) throw new Error('Temporary upload has expired')
    if (!tokenMatches(input.token, metadata.tokenHash)) throw new Error('Temporary upload token is invalid')
  }

  private assertContext(context: UploadActorContext): void {
    normalizeIdentifier(context.actorId, 'actor ID')
    normalizeIdentifier(context.fieldId, 'field ID')
    normalizeIdentifier(context.panelId, 'panel ID')
    normalizeIdentifier(context.resourceId, 'resource ID')
    if (context.tenantId) normalizeIdentifier(context.tenantId, 'tenant ID')
  }

  private async authorize(request: Parameters<TemporaryUploadServiceOptions['authorize']>[0]): Promise<void> {
    if (!await this.#authorize(request)) throw new Error('Temporary upload operation is not authorized')
  }

  private metadataDirectory(): string {
    return `${this.#policy.directory}/temporary`
  }

  private paths(id: string, extension: string): { readonly data: string, readonly metadata: string } {
    return {
      data: `${this.metadataDirectory()}/${id}.${extension}`,
      metadata: `${this.metadataDirectory()}/${id}.json`,
    }
  }

  private async requireMetadata(id: string): Promise<UploadMetadata> {
    normalizeIdentifier(id, 'ID')
    const metadataPath = `${this.metadataDirectory()}/${id}.json`
    const metadata = await this.#storage.getJson<UploadMetadata>(metadataPath)
    if (!metadata || metadata.id !== id || metadata.metadataPath !== metadataPath) throw new Error('Temporary upload metadata is invalid')
    return metadata
  }

  private async storedDescriptor(metadata: UploadMetadata): Promise<StoredUploadDescriptor> {
    if (!metadata.detectedMimeType) throw new Error('Temporary upload metadata is incomplete')
    const previewUrl = await this.#storage.temporaryUrl(metadata.dataPath, Math.min(this.#policy.expiresInSeconds, 900))
    return Object.freeze({
      declaredMimeType: metadata.declaredMimeType,
      detectedMimeType: metadata.detectedMimeType,
      expiresAt: metadata.expiresAt,
      extension: metadata.extension,
      fieldId: metadata.fieldId,
      id: metadata.id,
      name: metadata.name,
      panelId: metadata.panelId,
      resourceId: metadata.resourceId,
      size: metadata.size,
      state: 'stored',
      ...(metadata.tenantId ? { tenantId: metadata.tenantId } : {}),
      previewUrl,
    })
  }

  private async withLock<TResult>(key: string, operation: () => Promise<TResult>): Promise<TResult> {
    const previous = this.#locks.get(key) ?? Promise.resolve()
    let release = (): void => undefined
    const current = new Promise<void>(resolve => { release = resolve })
    const queued = previous.then(() => current)
    this.#locks.set(key, queued)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.#locks.get(key) === queued) this.#locks.delete(key)
    }
  }
}

export class UploadStoragePaginationError extends Error {
  constructor() {
    super('Temporary upload storage returned an invalid page')
    this.name = 'UploadStoragePaginationError'
  }
}

export function createTemporaryUploadService(options: TemporaryUploadServiceOptions): TemporaryUploadService {
  return new TemporaryUploadService(options)
}

export const PANELS_CLEAN_TEMPORARY_UPLOADS_JOB = 'panels:uploads:cleanup'

export async function runTemporaryUploadCleanupJob(service: TemporaryUploadService): Promise<{ readonly removed: number }> {
  return Object.freeze({ removed: await service.cleanupExpired() })
}
