import type { TemporaryUploadDescriptor, UploadPolicy } from '@holo-js/panels-core'
import type {
  ClientUploadFile,
  ClientUploadItem,
  ExistingMediaItem,
  UploadStoreListener,
  UploadStoreOptions,
  UploadStoreState,
} from './contracts'

interface QueuedUpload {
  readonly controller: AbortController
  readonly file: ClientUploadFile
  readonly localId: string
}

function normalizedExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index + 1).toLowerCase()
}

function validateClientFile(file: ClientUploadFile, policy: UploadPolicy): void {
  if (!policy.acceptedExtensions.includes(normalizedExtension(file.name))) throw new Error('File extension is not allowed')
  if (!policy.acceptedMimeTypes.includes(file.type.toLowerCase())) throw new Error('File type is not allowed')
  if (file.size < 1 || file.size > policy.maximumSize) throw new Error('File size exceeds the configured limit')
}

function existingItem(item: ExistingMediaItem): ClientUploadItem {
  return Object.freeze({
    error: null,
    id: item.id,
    mimeType: item.mimeType,
    name: item.name,
    ...(item.previewUrl ? { previewUrl: item.previewUrl } : {}),
    progress: 1,
    size: item.size,
    status: 'existing',
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Upload failed'
}

export class UploadStore {
  #active = 0
  readonly #adapter: UploadStoreOptions['adapter']
  readonly #context: UploadStoreOptions['context']
  readonly #controllers = new Map<string, AbortController>()
  readonly #listeners = new Set<UploadStoreListener>()
  readonly #maximumConcurrency: number
  readonly #policy: UploadPolicy
  readonly #queue: QueuedUpload[] = []
  #sequence = 0
  #state: UploadStoreState

  constructor(options: UploadStoreOptions) {
    const maximumConcurrency = options.maximumConcurrency ?? 3
    if (!Number.isSafeInteger(maximumConcurrency) || maximumConcurrency < 1 || maximumConcurrency > 10) {
      throw new Error('Upload concurrency must be an integer from 1 to 10')
    }
    this.#adapter = options.adapter
    this.#context = Object.freeze({ ...options.context })
    this.#maximumConcurrency = maximumConcurrency
    this.#policy = options.policy
    this.#state = Object.freeze({
      items: Object.freeze((options.existing ?? []).map(existingItem)),
      pending: 0,
      version: 0,
    })
  }

  get state(): UploadStoreState {
    return this.#state
  }

  subscribe(listener: UploadStoreListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  add(files: readonly ClientUploadFile[]): readonly string[] {
    if (this.#state.items.length + files.length > this.#policy.maximumFiles) {
      throw new Error('File count exceeds the configured limit')
    }
    const queued = files.map(file => {
      validateClientFile(file, this.#policy)
      const localId = `pending-${++this.#sequence}`
      return { controller: new AbortController(), file, localId }
    })
    const items = queued.map(({ file, localId }): ClientUploadItem => Object.freeze({
      error: null,
      id: localId,
      mimeType: file.type.toLowerCase(),
      name: file.name,
      progress: 0,
      size: file.size,
      status: 'pending',
    }))
    this.#queue.push(...queued)
    for (const item of queued) this.#controllers.set(item.localId, item.controller)
    this.publish([...this.#state.items, ...items])
    this.drain()
    return Object.freeze(queued.map(item => item.localId))
  }

  async remove(id: string): Promise<void> {
    this.#controllers.get(id)?.abort()
    this.#controllers.delete(id)
    const queuedIndex = this.#queue.findIndex(item => item.localId === id)
    if (queuedIndex >= 0) this.#queue.splice(queuedIndex, 1)
    const item = this.#state.items.find(candidate => candidate.id === id)
    if (!item) return
    if (item.token && (item.status === 'stored' || item.status === 'uploading')) {
      const controller = new AbortController()
      await this.#adapter.delete(this.#context, item.id, item.token, controller.signal)
    } else if (item.status === 'existing') {
      const controller = new AbortController()
      await this.#adapter.deleteExisting(this.#context, item.id, controller.signal)
    }
    this.publish(this.#state.items.filter(candidate => candidate.id !== id))
  }

  reorder(from: number, to: number): void {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
      || from < 0 || to < 0 || from >= this.#state.items.length || to >= this.#state.items.length) {
      throw new Error('Upload reorder indexes are out of range')
    }
    if (from === to) return
    const items = [...this.#state.items]
    const [item] = items.splice(from, 1)
    if (!item) return
    items.splice(to, 0, item)
    this.publish(items)
  }

  reset(existing: readonly ExistingMediaItem[] = []): void {
    for (const controller of this.#controllers.values()) controller.abort()
    this.#controllers.clear()
    this.#queue.splice(0)
    this.publish(existing.map(existingItem))
  }

  private drain(): void {
    while (this.#active < this.#maximumConcurrency) {
      const queued = this.#queue.shift()
      if (!queued) return
      this.#active += 1
      void this.upload(queued).finally(() => {
        this.#active -= 1
        this.drain()
      })
    }
  }

  private publish(items: readonly ClientUploadItem[]): void {
    this.#state = Object.freeze({
      items: Object.freeze([...items]),
      pending: items.filter(item => item.status === 'pending' || item.status === 'uploading').length,
      version: this.#state.version + 1,
    })
    for (const listener of this.#listeners) listener(this.#state)
  }

  private replace(id: string, update: (item: ClientUploadItem) => ClientUploadItem): void {
    this.publish(this.#state.items.map(item => item.id === id ? Object.freeze(update(item)) : item))
  }

  private async upload(queued: QueuedUpload): Promise<void> {
    let activeId = queued.localId
    try {
      const descriptor = await this.#adapter.create(this.#context, queued.file, queued.controller.signal)
      this.replace(queued.localId, item => ({
        ...item,
        id: descriptor.id,
        sessionId: descriptor.sessionId,
        status: 'uploading',
        token: descriptor.token,
      }))
      this.#controllers.delete(queued.localId)
      this.#controllers.set(descriptor.id, queued.controller)
      activeId = descriptor.id
      const contents = new Uint8Array(await queued.file.arrayBuffer())
      const stored = await this.#adapter.write(
        this.#context,
        descriptor,
        contents,
        queued.controller.signal,
        progress => this.replace(descriptor.id, item => ({ ...item, progress: Math.max(0, Math.min(1, progress)) })),
      )
      this.replace(descriptor.id, item => ({
        ...item,
        ...(stored.previewUrl ? { previewUrl: stored.previewUrl } : {}),
        progress: 1,
        status: 'stored',
      }))
    } catch (error) {
      if (queued.controller.signal.aborted) return
      if (this.#state.items.some(item => item.id === activeId)) {
        this.replace(activeId, item => ({ ...item, error: errorMessage(error), status: 'failed' }))
      }
    }
  }
}

export function createUploadStore(options: UploadStoreOptions): UploadStore {
  return new UploadStore(options)
}

export function uploadDescriptorKey(descriptor: TemporaryUploadDescriptor): string {
  return `${descriptor.panelId}:${descriptor.resourceId}:${descriptor.fieldId}:${descriptor.id}`
}
