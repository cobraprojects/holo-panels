import { validatedToastPresentation, type Effect } from '../protocol/effects'
import type { ErrorCategory, PanelsError, RequestEnvelope, ResponseEnvelope } from '../protocol/envelopes'
import { assertJsonSafe, toJsonValue } from '../protocol/serialization'
import { assertProtocolCompatible, PROTOCOL_VERSION } from '../protocol/version'
import type { JsonObject, JsonValue } from '../protocol/json'
import { IDEMPOTENCY_HEADER, TRANSPORT_REQUEST_FIELD } from './contracts'
import type { TransportDecodedRequest, TransportRequestOptions, TransportServerRequestLike } from './contracts'

const ERROR_CATEGORIES = new Set<ErrorCategory>([
  'authentication',
  'authorization',
  'conflict',
  'internal',
  'not-found',
  'protocol',
  'rate-limit',
  'validation',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TransportDecodingError(`Invalid ${label}.`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  if (typeof value === 'undefined') return undefined
  return requiredString(value, label)
}

function safeUrl(value: unknown, label: string): string {
  const url = requiredString(value, label)
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new TransportDecodingError(`Invalid ${label}.`)
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  throw new TransportDecodingError(`Invalid ${label}.`)
}

function decodeEffect(value: unknown): Readonly<Effect> {
  if (!isRecord(value) || typeof value.kind !== 'string') throw new TransportDecodingError('Invalid response effect.')
  switch (value.kind) {
    case 'close-modal':
      return Object.freeze({ kind: value.kind, ...(optionalString(value.id, 'modal effect ID') ? { id: value.id as string } : {}) })
    case 'download':
      return Object.freeze({ kind: value.kind, url: safeUrl(value.url, 'download URL'), ...(optionalString(value.filename, 'download filename') ? { filename: value.filename as string } : {}) })
    case 'focus':
      return Object.freeze({ kind: value.kind, componentId: requiredString(value.componentId, 'focus component ID') })
    case 'invalidate-table':
      return Object.freeze({ kind: value.kind, tableId: requiredString(value.tableId, 'table ID') })
    case 'redirect':
      if (typeof value.replace !== 'undefined' && typeof value.replace !== 'boolean') throw new TransportDecodingError('Invalid redirect replace flag.')
      return Object.freeze({ kind: value.kind, url: safeUrl(value.url, 'redirect URL'), ...(typeof value.newTab === 'boolean' ? { newTab: value.newTab } : {}), ...(typeof value.replace === 'boolean' ? { replace: value.replace } : {}) })
    case 'refresh':
      if (typeof value.target !== 'undefined' && value.target !== 'page' && value.target !== 'schema') throw new TransportDecodingError('Invalid refresh target.')
      return Object.freeze({ kind: value.kind, ...(value.target ? { target: value.target } : {}) })
    case 'toast': {
      if ('presentation' in value) {
        const presentation = validatedToastPresentation(value.presentation)
        if (!presentation) throw new TransportDecodingError('Invalid toast presentation.')
        return Object.freeze({ kind: value.kind, presentation })
      }
      if (!['danger', 'info', 'success', 'warning'].includes(String(value.level))) throw new TransportDecodingError('Invalid toast level.')
      if (typeof value.duration !== 'undefined' && (!Number.isInteger(value.duration) || (value.duration as number) < 0)) {
        throw new TransportDecodingError('Invalid toast duration.')
      }
      return Object.freeze({
        kind: value.kind,
        level: value.level as 'danger' | 'info' | 'success' | 'warning',
        message: requiredString(value.message, 'toast message'),
        ...(optionalString(value.title, 'toast title') ? { title: value.title as string } : {}),
        ...(typeof value.duration === 'number' ? { duration: value.duration } : {}),
      })
    }
    default:
      throw new TransportDecodingError(`Unsupported response effect: ${value.kind}.`)
  }
}

function decodeEffects(value: unknown): readonly Effect[] {
  if (!Array.isArray(value)) throw new TransportDecodingError('Invalid response effects.')
  return Object.freeze(value.map(decodeEffect))
}

function decodePanelsError(value: unknown): Readonly<PanelsError> {
  if (!isRecord(value) || !ERROR_CATEGORIES.has(value.category as ErrorCategory)) {
    throw new TransportDecodingError('Invalid transport error category.')
  }
  if (typeof value.retryable !== 'boolean') throw new TransportDecodingError('Invalid transport retry flag.')
  const details = typeof value.details === 'undefined' ? undefined : toJsonValue(value.details)
  if (typeof details !== 'undefined' && (!isRecord(details))) throw new TransportDecodingError('Invalid transport error details.')
  return Object.freeze({
    category: value.category as ErrorCategory,
    code: requiredString(value.code, 'transport error code'),
    message: requiredString(value.message, 'transport error message'),
    retryable: value.retryable,
    ...(details ? { details: details as JsonObject } : {}),
  })
}

export class TransportDecodingError extends Error {
  constructor(message: string) {
    super(`[Holo Panels] ${message}`)
    this.name = 'TransportDecodingError'
  }
}

export function createRequestEnvelope<TPayload extends JsonValue>(
  options: TransportRequestOptions<TPayload>,
): Readonly<RequestEnvelope<TPayload>> {
  const envelope: RequestEnvelope<TPayload> = {
    id: requiredString(options.id, 'request ID'),
    operation: requiredString(options.operation, 'operation'),
    panelId: requiredString(options.panelId, 'panel ID'),
    payload: options.payload,
    protocolVersion: PROTOCOL_VERSION,
  }
  assertJsonSafe(envelope)
  return Object.freeze(envelope)
}

export function decodeRequestEnvelope<TPayload extends JsonValue = JsonObject>(value: unknown): Readonly<RequestEnvelope<TPayload>> {
  if (!isRecord(value)) throw new TransportDecodingError('Invalid request envelope.')
  const protocolVersion = requiredString(value.protocolVersion, 'request protocol version')
  assertProtocolCompatible(protocolVersion)
  const payload = toJsonValue(value.payload)
  const envelope: RequestEnvelope<TPayload> = {
    id: requiredString(value.id, 'request ID'),
    operation: requiredString(value.operation, 'operation'),
    panelId: requiredString(value.panelId, 'panel ID'),
    payload: payload as TPayload,
    protocolVersion,
  }
  return Object.freeze(envelope)
}

export async function decodeTransportServerRequest<TPayload extends JsonValue = JsonObject>(
  request: TransportServerRequestLike,
): Promise<Readonly<TransportDecodedRequest<TPayload>>> {
  const fields = await request.formData()
  const encodedEnvelope = fields.get(TRANSPORT_REQUEST_FIELD)
  if (typeof encodedEnvelope !== 'string') throw new TransportDecodingError('Missing transport request form field.')
  let parsed: unknown
  try {
    parsed = JSON.parse(encodedEnvelope) as unknown
  } catch {
    throw new TransportDecodingError('Invalid transport request JSON.')
  }
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)?.trim() || undefined
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    throw new TransportDecodingError('Invalid idempotency key.')
  }
  return Object.freeze({
    envelope: decodeRequestEnvelope<TPayload>(parsed),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  })
}

export function decodeResponseEnvelope<TData extends JsonValue = JsonValue>(
  value: unknown,
  expectedRequestId?: string,
): Readonly<ResponseEnvelope<TData>> {
  if (!isRecord(value)) throw new TransportDecodingError('Invalid response envelope.')
  const protocolVersion = requiredString(value.protocolVersion, 'response protocol version')
  assertProtocolCompatible(protocolVersion)
  const id = requiredString(value.id, 'response ID')
  if (expectedRequestId && id !== expectedRequestId) throw new TransportDecodingError('Response ID does not match its request.')
  const effects = [...decodeEffects(value.effects)]
  if (value.ok === true) {
    return Object.freeze({
      data: toJsonValue(value.data) as TData,
      effects,
      id,
      ok: true,
      protocolVersion,
    })
  }
  if (value.ok === false) {
    return Object.freeze({
      effects,
      error: decodePanelsError(value.error),
      id,
      ok: false,
      protocolVersion,
    })
  }
  throw new TransportDecodingError('Invalid response outcome.')
}
