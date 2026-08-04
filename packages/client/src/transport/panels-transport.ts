import {
  createRequestEnvelope,
  decodeResponseEnvelope,
  IDEMPOTENCY_HEADER,
  normalizeTransportError,
  PanelsTransportError,
  TRANSPORT_REQUEST_FIELD,
  TransportDecodingError,
  type TransportOperation,
} from '@holo-js/panels-core'
import type { ErrorCategory, PanelsError, ResponseEnvelope } from '@holo-js/panels-core'
import type { JsonValue } from '@holo-js/panels-core'
import type { TransportAdapter, TransportHttpRequest, TransportHttpResponse } from './adapter'
import { type ClientCsrfProvider, HoloSecurityCsrfProvider } from './csrf'

export type TransportRetryPolicy = {
  readonly delayMs: number
  readonly maxAttempts: number
}

export type PanelsTransportOptions = {
  readonly adapter: TransportAdapter
  readonly csrfProvider?: ClientCsrfProvider
  readonly createId?: () => string
  readonly retry?: Partial<TransportRetryPolicy>
  readonly wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}

export type ExecuteTransportOptions<TPayload extends JsonValue> = {
  readonly endpoint: string
  readonly idempotencyKey?: string
  readonly panelId: string
  readonly payload: TPayload
  readonly signal?: AbortSignal
}

const DEFAULT_RETRY: TransportRetryPolicy = Object.freeze({ delayMs: 50, maxAttempts: 3 })
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/

function defaultId(): string {
  const runtime = globalThis as typeof globalThis & { readonly crypto?: { randomUUID?(): string } }
  const id = runtime.crypto?.randomUUID?.()
  if (!id) throw new Error('[Holo Panels] Secure random UUID generation is unavailable.')
  return id
}

function abortError(): Error {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function defaultWait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError())
  return new Promise((resolvePromise, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolvePromise()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function encodeField(name: string, value: string): string {
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
}

function protocolError(message: string): Readonly<PanelsError> {
  return Object.freeze({
    category: 'protocol' as ErrorCategory,
    code: 'invalid_response',
    message,
    retryable: false,
  })
}

function validateIdempotencyKey(value: string): string {
  if (!IDEMPOTENCY_PATTERN.test(value)) {
    throw new Error('[Holo Panels] Idempotency keys must be 16-128 safe ASCII characters.')
  }
  return value
}

function validateEndpoint(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    throw new Error('[Holo Panels] Transport endpoints must be root-relative same-origin paths.')
  }
  return value
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export class PanelsTransport {
  readonly #adapter: TransportAdapter
  readonly #createId: () => string
  readonly #csrfProvider: ClientCsrfProvider
  readonly #retry: TransportRetryPolicy
  readonly #wait: (delayMs: number, signal?: AbortSignal) => Promise<void>

  constructor(options: PanelsTransportOptions) {
    const maxAttempts = options.retry?.maxAttempts ?? DEFAULT_RETRY.maxAttempts
    const delayMs = options.retry?.delayMs ?? DEFAULT_RETRY.delayMs
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('[Holo Panels] Retry attempts must be between 1 and 10.')
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 30_000) throw new Error('[Holo Panels] Retry delay must be between 0 and 30000 milliseconds.')
    this.#adapter = options.adapter
    this.#createId = options.createId ?? defaultId
    this.#csrfProvider = options.csrfProvider ?? new HoloSecurityCsrfProvider()
    this.#retry = Object.freeze({ delayMs, maxAttempts })
    this.#wait = options.wait ?? defaultWait
  }

  async execute<TPayload extends JsonValue, TData extends JsonValue>(
    operation: TransportOperation<TPayload, TData>,
    options: ExecuteTransportOptions<TPayload>,
  ): Promise<Readonly<ResponseEnvelope<TData>>> {
    if (options.signal?.aborted) throw abortError()
    const endpoint = validateEndpoint(options.endpoint)
    const id = this.#createId()
    const envelope = createRequestEnvelope({
      id,
      operation: operation.name,
      panelId: options.panelId,
      payload: options.payload,
    })
    const csrf = this.#csrfProvider.getField()
    if (!csrf) {
      throw new PanelsTransportError(Object.freeze({
        category: 'authorization',
        code: 'csrf_token_missing',
        message: 'The CSRF token is unavailable.',
        retryable: false,
      }))
    }
    if (options.idempotencyKey && (operation.kind !== 'mutation' || !operation.supportsIdempotency)) {
      throw new Error('[Holo Panels] This operation does not support idempotency keys.')
    }
    const idempotencyKey = operation.kind === 'mutation' && operation.supportsIdempotency
      ? validateIdempotencyKey(options.idempotencyKey ?? `${id}:mutation`)
      : undefined
    const headers = Object.freeze({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...(idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}),
    })
    const body = `${encodeField(TRANSPORT_REQUEST_FIELD, JSON.stringify(envelope))}&${encodeField(csrf.name, csrf.value)}`
    const request: TransportHttpRequest = Object.freeze({
      body,
      credentials: 'same-origin',
      headers,
      method: 'POST',
      signal: options.signal,
      url: endpoint,
    })

    for (let attempt = 1; attempt <= this.#retry.maxAttempts; attempt += 1) {
      let response: TransportHttpResponse
      try {
        response = await this.#adapter.send(request)
      } catch (error) {
        if (isAbortError(error) || options.signal?.aborted) throw error
        if (operation.kind === 'read' && attempt < this.#retry.maxAttempts) {
          await this.#wait(this.#retry.delayMs, options.signal)
          continue
        }
        throw new PanelsTransportError(normalizeTransportError(error))
      }

      let decoded: Readonly<ResponseEnvelope<TData>>
      try {
        decoded = decodeResponseEnvelope<TData>(response.body, id)
      } catch (error) {
        if (!(error instanceof TransportDecodingError)) throw error
        if (operation.kind === 'read' && shouldRetryStatus(response.status) && attempt < this.#retry.maxAttempts) {
          await this.#wait(this.#retry.delayMs, options.signal)
          continue
        }
        if (response.status >= 400) throw new PanelsTransportError(normalizeTransportError(response.body, response.status))
        throw new PanelsTransportError(protocolError(error.message))
      }
      if (response.status >= 400 && decoded.ok) {
        throw new PanelsTransportError(normalizeTransportError(response.body, response.status))
      }
      if (!decoded.ok && decoded.error.retryable && operation.kind === 'read' && attempt < this.#retry.maxAttempts) {
        await this.#wait(this.#retry.delayMs, options.signal)
        continue
      }
      return decoded
    }
    throw new PanelsTransportError(normalizeTransportError(undefined))
  }
}
