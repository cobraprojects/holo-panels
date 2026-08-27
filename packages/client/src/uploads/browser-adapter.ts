import {
  createRequestEnvelope,
  decodeResponseEnvelope,
  TRANSPORT_REQUEST_FIELD,
  type JsonObject,
  type StoredUploadDescriptor,
  type TemporaryUploadDescriptor,
  type UploadActorContext,
} from '@holo-js/panels-core'
import { HoloSecurityCsrfProvider } from '../transport/csrf'
import type { ClientCsrfProvider } from '../transport/csrf'
import type { ClientUploadFile, UploadClientAdapter } from './contracts'

export interface BrowserUploadAdapterOptions {
  readonly csrfProvider?: ClientCsrfProvider
  readonly endpoint: string
  readonly fieldId: string
  readonly intent: 'create' | 'edit'
  readonly panelId: string
  readonly recordId?: number | string | null
  readonly resourceId: string
}

function descriptor(value: unknown, tokenRequired: boolean): TemporaryUploadDescriptor | StoredUploadDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The upload server returned an invalid descriptor.')
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.size !== 'number' || (tokenRequired && typeof item.token !== 'string')) {
    throw new Error('The upload server returned an invalid descriptor.')
  }
  return item as unknown as TemporaryUploadDescriptor | StoredUploadDescriptor
}

async function sendUploadBody(endpoint: string, body: FormData, signal: AbortSignal, onProgress?: (progress: number) => void): Promise<unknown> {
  signal.throwIfAborted()
  if (!onProgress || typeof XMLHttpRequest === 'undefined') {
    const response = await fetch(endpoint, { body, credentials: 'same-origin', method: 'POST', signal })
    return await response.json() as unknown
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = (): void => request.abort()
    const cleanup = (): void => signal.removeEventListener('abort', abort)
    request.open('POST', endpoint)
    request.responseType = 'json'
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(0.99, event.loaded / event.total))
    }
    request.onload = () => {
      cleanup()
      resolve(request.response as unknown)
    }
    request.onerror = () => {
      cleanup()
      reject(new Error('The upload could not reach the server.'))
    }
    request.onabort = () => {
      cleanup()
      reject(new DOMException('The upload was cancelled.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    request.send(body)
  })
}

export function createBrowserUploadAdapter(options: BrowserUploadAdapterOptions): UploadClientAdapter {
  const csrf = options.csrfProvider ?? new HoloSecurityCsrfProvider()
  const sessionId = globalThis.crypto.randomUUID()
  const send = async (payload: JsonObject, signal: AbortSignal, contents?: Uint8Array, onProgress?: (progress: number) => void): Promise<unknown> => {
    const id = globalThis.crypto.randomUUID()
    const security = csrf.getField()
    if (!security) throw new Error('The CSRF token is unavailable.')
    const envelope = createRequestEnvelope({ id, operation: 'upload', panelId: options.panelId, payload: {
      ...payload,
      fieldId: options.fieldId,
      intent: options.intent,
      recordId: options.recordId ?? null,
      resourceId: options.resourceId,
      sessionId,
    } })
    const body = new FormData()
    body.set(TRANSPORT_REQUEST_FIELD, JSON.stringify(envelope))
    body.set(security.name, security.value)
    if (contents) body.set('contents', new Blob([new Uint8Array(contents).buffer]))
    const decoded = decodeResponseEnvelope(await sendUploadBody(options.endpoint, body, signal, onProgress), id)
    if (!decoded.ok) throw new Error(decoded.error.message)
    return decoded.data
  }
  return Object.freeze({
    async create(_context: UploadActorContext, file: Pick<ClientUploadFile, 'name' | 'size' | 'type'>, signal: AbortSignal): Promise<TemporaryUploadDescriptor> {
      return descriptor(await send({ action: 'create', declaredMimeType: file.type, name: file.name, size: file.size }, signal), true) as TemporaryUploadDescriptor
    },
    async delete(_context: UploadActorContext, id: string, token: string, signal: AbortSignal): Promise<void> {
      await send({ action: 'delete', id, token }, signal)
    },
    async deleteExisting(): Promise<void> {},
    async resolve(_context: UploadActorContext, id: string, token: string, signal: AbortSignal): Promise<StoredUploadDescriptor> {
      return descriptor(await send({ action: 'resolve', id, token }, signal), false) as StoredUploadDescriptor
    },
    async write(_context: UploadActorContext, upload: TemporaryUploadDescriptor, contents: Uint8Array, signal: AbortSignal, onProgress: (progress: number) => void): Promise<StoredUploadDescriptor> {
      onProgress(0)
      const stored = descriptor(await send({ action: 'write', id: upload.id, token: upload.token }, signal, contents, onProgress), false) as StoredUploadDescriptor
      onProgress(1)
      return stored
    },
  })
}
