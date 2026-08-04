import { createSvelteKitHoloHelpers, runWithSvelteKitRequestEvent } from '@holo-js/adapter-sveltekit'
import {
  decodeResponseEnvelope,
  normalizeTransportError,
  PROTOCOL_VERSION,
  TransportDecodingError,
  type Effect,
  type JsonValue,
  type ResponseEnvelope,
} from '@holo-js/panels-svelte'
import { error, redirect } from '@sveltejs/kit'
import { csrfProtection } from '@holo-js/security/sveltekit/server'
import {
  ActionExecutionError,
  AuthControllerError,
  decodeTransportServerRequest,
  executePanelAuthOperation,
  executePanelTenantOperation,
  PanelTenantOperationError,
  panelAuthOperationStatus,
  panelTenantOperationStatus,
  type PanelAuthOperation,
  type PanelAuthRuntime,
  type PanelTenantOperation,
} from '@holo-js/panels-svelte/server'
import type {
  CreatePanelOperationHandlerOptions,
  CreatePanelPageLoadOptions,
  PanelOperation,
  PanelOperationResult,
  PanelPageData,
  SvelteKitPanelEvent,
  SvelteKitPanelOperationHandler,
  SvelteKitPanelRegistry,
} from './contracts'

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const OPERATIONS = new Set<PanelOperation>(['action', 'bootstrap', 'form-submit', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload'])
const TENANT_OPERATIONS = new Set<PanelTenantOperation>(['profile-read', 'profile-update', 'register', 'switch'])
const MAX_REQUEST_BYTES = 1024 * 1024
const MAX_RESPONSE_BYTES = 4_194_304
const RESPONSE_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
const holo = createSvelteKitHoloHelpers()

interface SessionEffectGuard {
  readonly flash?: (key: string, value: unknown) => Promise<void>
  readonly take?: <TValue = unknown>(key: string) => Promise<TValue | undefined>
}

function sessionEffectKey(panelId: string): string {
  return `panels.effects.${panelId}`
}

function decodedSessionEffects(value: unknown): readonly Effect[] {
  if (!Array.isArray(value)) return Object.freeze([])
  try {
    return Object.freeze(decodeResponseEnvelope({
      data: null,
      effects: value,
      id: 'session-effects',
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
    }, 'session-effects').effects.filter(effect => effect.kind === 'toast'))
  } catch {
    return Object.freeze([])
  }
}

async function sessionGuard(name: string): Promise<SessionEffectGuard | undefined> {
  try {
    return (await holo.getAuth())?.guard(name) as SessionEffectGuard | undefined
  } catch {
    return undefined
  }
}

async function takeSessionEffects(guardName: string, panelId: string): Promise<readonly Effect[]> {
  const guard = await sessionGuard(guardName)
  if (!guard?.take) return Object.freeze([])
  try {
    return decodedSessionEffects(await guard.take(sessionEffectKey(panelId)))
  } catch {
    return Object.freeze([])
  }
}

async function flashRedirectToasts(guard: SessionEffectGuard | undefined, panelId: string, effects: readonly Effect[]): Promise<void> {
  if (!guard?.flash || !effects.some(effect => effect.kind === 'redirect')) return
  const toasts = effects.filter(effect => effect.kind === 'toast')
  if (toasts.length === 0) return
  try {
    await guard.flash(sessionEffectKey(panelId), toasts)
  } catch {
    return
  }
}

function assertPanelId(panelId: string): void {
  if (!PANEL_ID.test(panelId)) throw new Error(`Invalid panel ID "${panelId}"`)
}

function safeLocalPath(path: string, label: string): string {
  if (path !== path.trim() || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('?') || path.includes('#')) {
    throw new Error(`${label} must be a normalized local path`)
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    throw new Error(`${label} must not contain malformed escapes`)
  }
  if (decoded.includes('\\') || decoded.split('/').some(segment => segment === '.' || segment === '..')) throw new Error(`${label} must not contain traversal segments`)
  return path
}

function registryFor<TActor>(event: SvelteKitPanelEvent, configured: SvelteKitPanelRegistry<TActor> | undefined): SvelteKitPanelRegistry<TActor> {
  const registry = configured ?? event.locals.panels as SvelteKitPanelRegistry<TActor> | undefined
  if (!registry) throw new Error('Holo Panels registry is unavailable. Run `holo prepare` and expose the generated registry through event.locals.panels.')
  return registry
}

function requestSignal(request: Request): AbortSignal {
  return request.signal
}

function panelPath(event: SvelteKitPanelEvent, basePath: string): string {
  const raw = event.params.path ?? ''
  const segments = raw.split('/').filter(Boolean)
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || segment.includes('\\') || /%(?:2e|2f|5c)/iu.test(segment)) error(404, 'Panel page not found')
  }
  return segments.length === 0 ? basePath : `${basePath}/${segments.join('/')}`
}

function routeParameters(event: SvelteKitPanelEvent): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(Object.entries(event.params).flatMap(([key, value]) => value === undefined || key === 'path' ? [] : [[key, value]])))
}

function errorCode(cause: unknown): string | undefined {
  return typeof cause === 'object' && cause !== null && typeof Reflect.get(cause, 'code') === 'string'
    ? String(Reflect.get(cause, 'code'))
    : undefined
}

function translatePageError(cause: unknown, loginPath: string): never {
  const code = errorCode(cause)
  if (code === 'unauthenticated') redirect(303, loginPath)
  if (code === 'panel-not-found') error(404, 'Panel not found')
  if (code === 'access-denied' || cause instanceof Error && cause.name === 'PageAccessError') error(403, 'Panel access denied')
  throw cause
}

function operationFrom(event: SvelteKitPanelEvent): PanelOperation {
  const value = event.params.operation
  if (!value || !OPERATIONS.has(value as PanelOperation)) error(404, 'Panel operation not found')
  return value as PanelOperation
}

function statusFor(cause: unknown): number {
  const code = errorCode(cause)
  if (code === 'unauthenticated') return 401
  if (code === 'panel-not-found') return 404
  if (code === 'access-denied') return 403
  if (cause instanceof TransportDecodingError) return 400
  if (cause instanceof Error && cause.name === 'PanelNotificationAccessError') return 403
  if (cause instanceof Error && cause.name === 'PanelNotificationRequestError') return 400
  if (typeof cause === 'object' && cause !== null) {
    const status = Reflect.get(cause, 'status') ?? Reflect.get(cause, 'statusCode')
    if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) return status
  }
  return 500
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? 'unavailable-request-id'
}

function successEnvelope(id: string, data: JsonValue, effects: readonly Effect[]): Readonly<ResponseEnvelope> {
  return decodeResponseEnvelope({ data, effects, id, ok: true, protocolVersion: PROTOCOL_VERSION }, id)
}

function errorEnvelope(id: string, cause: unknown, status: number): Readonly<ResponseEnvelope> {
  const effects = cause instanceof ActionExecutionError ? cause.effects : []
  return decodeResponseEnvelope({ effects, error: normalizeTransportError(cause, status), id, ok: false, protocolVersion: PROTOCOL_VERSION }, id)
}

function responseFromBytes(bytes: Uint8Array<ArrayBuffer>, status: number): Response {
  return new Response(bytes, { status, headers: RESPONSE_HEADERS })
}

function encodedEnvelope(envelope: Readonly<ResponseEnvelope>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(envelope))
}

function oversizedResponse(id: string): Response {
  const envelope = decodeResponseEnvelope({
    effects: [],
    error: {
      category: 'internal',
      code: 'response_too_large',
      message: 'Panel operation response exceeded the server limit.',
      retryable: false,
    },
    id,
    ok: false,
    protocolVersion: PROTOCOL_VERSION,
  }, id)
  const bytes = encodedEnvelope(envelope)
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('Panel operation response limit error exceeded the server limit')
  return responseFromBytes(bytes, 500)
}

function envelopeResponse(envelope: Readonly<ResponseEnvelope>, status: number): Response {
  const bytes = encodedEnvelope(envelope)
  return bytes.byteLength > MAX_RESPONSE_BYTES
    ? oversizedResponse(envelope.id)
    : responseFromBytes(bytes, status)
}

class PanelRequestSizeError extends Error {
  readonly status = 413

  constructor() {
    super('Panel request body exceeds 1 MiB')
    this.name = 'PanelRequestSizeError'
  }
}

async function boundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_REQUEST_BYTES) throw new PanelRequestSizeError()
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    length += result.value.byteLength
    if (length > MAX_REQUEST_BYTES) {
      await reader.cancel()
      throw new PanelRequestSizeError()
    }
    chunks.push(result.value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function requestWithBody(request: Request, body: Uint8Array): Request {
  return new Request(request, { body: body.byteLength > 0 ? body.buffer as ArrayBuffer : undefined })
}

export function createPanelPageLoad<TActor = unknown>(options: CreatePanelPageLoadOptions<TActor>): (event: SvelteKitPanelEvent) => Promise<PanelPageData> {
  assertPanelId(options.panelId)
  const loginPath = safeLocalPath(options.loginPath ?? '/login', 'Panel login paths')
  return event => runWithSvelteKitRequestEvent(event, async () => {
    try {
      const registry = registryFor(event, options.registry)
      const signal = requestSignal(event.request)
      const bootstraps = await registry.runtime.bootstrap([options.panelId], signal)
      const panel = bootstraps[0]
      if (!panel || panel.manifest.id !== options.panelId) error(404, 'Panel not found')
      const resolved = await registry.runtime.execute(options.panelId, 'page-data', signal, async scope => ({
        effects: await takeSessionEffects(scope.guard, options.panelId),
        page: await registry.resolvePage({
          event,
          holo,
          panelId: options.panelId,
          parameters: routeParameters(event),
          path: panelPath(event, panel.manifest.path),
          scope,
        }),
      }))
      return Object.freeze({ effects: resolved.effects, panel, page: resolved.page })
    } catch (cause) {
      return translatePageError(cause, loginPath)
    }
  })
}

type DecodedPanelRequest = Awaited<ReturnType<typeof decodeTransportServerRequest<JsonValue>>>

async function executeOperation<TActor>(event: SvelteKitPanelEvent, options: CreatePanelOperationHandlerOptions<TActor>, method: 'GET' | 'POST', decoded: DecodedPanelRequest | undefined, decodingError: unknown): Promise<Response> {
  return runWithSvelteKitRequestEvent(event, async () => {
    let guard: SessionEffectGuard | undefined
    let panelId: string | undefined
    let id = requestId()
    try {
      if (method !== 'POST') return envelopeResponse(errorEnvelope(id, new Error('Panel transport operations require POST'), 405), 405)
      if (decodingError) throw decodingError
      if (!decoded) throw new TransportDecodingError('Missing transport request envelope.')
      id = decoded.envelope.id
      panelId = event.params.panelId
      if (!panelId || !options.panelIds.includes(panelId) || decoded.envelope.panelId !== panelId) throw Object.assign(new Error('Panel transport panel mismatch'), { status: 404 })
      const operation = operationFrom(event)
      if (decoded.envelope.operation !== operation) throw new TransportDecodingError('Request operation does not match its route.')
      const registry = registryFor(event, options.registry)
      const handler = registry.operations?.[operation]
      if (!handler) throw Object.assign(new Error('Panel operation not found'), { status: 404 })
      const result: PanelOperationResult = await registry.runtime.execute(panelId, operation, requestSignal(event.request), async scope => {
        guard = await sessionGuard(scope.guard)
        return handler({
          event,
          holo,
          ...(decoded.idempotencyKey ? { idempotencyKey: decoded.idempotencyKey } : {}),
          operation,
          panelId: panelId!,
          payload: decoded.envelope.payload,
          scope,
        })
      })
      const status = result.status ?? 200
      if (!Number.isInteger(status) || status < 200 || status > 299 || status === 204 || status === 205) throw new Error('Panel operation success statuses must support a JSON response body')
      const response = successEnvelope(id, result.data, result.effects ?? [])
      const serialized = envelopeResponse(response, status)
      if (serialized.status < 300) await flashRedirectToasts(guard, panelId, response.effects)
      return serialized
    } catch (cause) {
      const status = statusFor(cause)
      const response = errorEnvelope(id, cause, status)
      if (panelId) await flashRedirectToasts(guard, panelId, response.effects)
      return envelopeResponse(response, status)
    }
  })
}

export function createPanelOperationHandler<TActor = unknown>(options: CreatePanelOperationHandlerOptions<TActor>): SvelteKitPanelOperationHandler {
  if (options.panelIds.length === 0) throw new Error('Panel operation routes require at least one panel ID')
  for (const panelId of options.panelIds) assertPanelId(panelId)
  if (new Set(options.panelIds).size !== options.panelIds.length) throw new Error('Panel operation route IDs must be unique')
  const fixedOptions = Object.freeze({ ...options, panelIds: Object.freeze([...options.panelIds]) })
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    let body: Uint8Array
    try {
      body = method === 'POST' ? await boundedBody(event.request) : new Uint8Array()
    } catch (cause) {
      const status = statusFor(cause)
      return envelopeResponse(errorEnvelope(requestId(), cause, status), status)
    }
    const boundedEvent = method === 'POST' ? { ...event, request: requestWithBody(event.request, body) } : event
    const response = await csrf({
      event: boundedEvent,
      resolve: async () => {
        if (method !== 'POST') return executeOperation(boundedEvent, fixedOptions, method, undefined, undefined)
        const decodedEvent = { ...boundedEvent, request: requestWithBody(event.request, body) }
        try {
          const decoded = await decodeTransportServerRequest<JsonValue>(decodedEvent.request)
          return executeOperation(decodedEvent, fixedOptions, method, decoded, undefined)
        } catch (cause) {
          return executeOperation(decodedEvent, fixedOptions, method, undefined, cause)
        }
      },
    })
    if (response.status < 400 || response.headers.get('content-type')?.toLowerCase().includes('application/json')) return response
    return envelopeResponse(errorEnvelope(requestId(), Object.assign(new Error('Panel request rejected'), { status: response.status }), response.status), response.status)
  }
  return Object.freeze({ GET: handle('GET'), POST: handle('POST') })
}

const AUTH_OPERATIONS = new Set<PanelAuthOperation>([
  'email-verification-resend', 'email-verification-verify', 'login', 'logout', 'mfa-challenge', 'mfa-disable',
  'mfa-enrollment-begin', 'mfa-enrollment-confirm', 'mfa-recovery', 'mfa-recovery-codes-regenerate', 'mfa-status',
  'password-reset-request', 'password-reset', 'profile-read', 'profile-update',
])
const GET_AUTH_OPERATIONS = new Set<PanelAuthOperation>(['mfa-enrollment-begin', 'mfa-status', 'profile-read'])

function nativeResponse(data: unknown, status: number, cookies: readonly string[] = [], location: string | null = null): Response {
  const headers = new Headers(RESPONSE_HEADERS)
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  if (location !== null) headers.set('location', location)
  return new Response(status === 204 ? null : JSON.stringify(data), { headers, status })
}

function nativeFailure(cause: unknown): Response {
  if (cause instanceof AuthControllerError) return nativeResponse({ error: 'Panel authentication request failed.' }, panelAuthOperationStatus(cause))
  if (cause instanceof PanelTenantOperationError) return nativeResponse({ error: 'Tenant was not found.' }, panelTenantOperationStatus(cause))
  const status = statusFor(cause)
  return nativeResponse({ error: status >= 500 ? 'Panel request failed.' : 'Panel request was rejected.' }, status)
}

function nativePanel<TActor>(event: SvelteKitPanelEvent, options: CreatePanelOperationHandlerOptions<TActor>) {
  const panelId = event.params.panelId
  if (!panelId || !options.panelIds.includes(panelId)) throw Object.assign(new Error('Panel not found'), { status: 404 })
  const registry = registryFor(event, options.registry)
  const panel = registry.panels?.[panelId]
  if (!panel || panel.manifest.id !== panelId) throw Object.assign(new Error('Panel not found'), { status: 404 })
  return { panel: panel as unknown as Parameters<typeof executePanelAuthOperation>[0]['panel'], panelId, registry }
}

function nativeAuthOperation(event: SvelteKitPanelEvent): PanelAuthOperation {
  const operation = event.params.operation
  if (!operation || !AUTH_OPERATIONS.has(operation as PanelAuthOperation)) throw Object.assign(new Error('Panel authentication operation not found'), { status: 404 })
  return operation as PanelAuthOperation
}

async function nativePayload(request: Request, method: 'GET' | 'POST'): Promise<unknown> {
  if (method === 'GET') return {}
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw Object.assign(new Error('Panel auth requests require application/json'), { status: 400 })
  }
  try {
    const body = await boundedBody(request)
    return JSON.parse(new TextDecoder().decode(body)) as unknown
  } catch (cause) {
    if (cause instanceof PanelRequestSizeError) throw cause
    throw Object.assign(new Error('Panel auth request contains invalid JSON'), { status: 400 })
  }
}

function validateNativeOptions<TActor>(options: CreatePanelOperationHandlerOptions<TActor>): void {
  if (options.panelIds.length === 0) throw new Error('Panel auth and tenant routes require at least one panel ID')
  for (const panelId of options.panelIds) assertPanelId(panelId)
  if (new Set(options.panelIds).size !== options.panelIds.length) throw new Error('Panel auth and tenant route IDs must be unique')
}

export function createPanelAuthHandler<TActor = unknown>(options: CreatePanelOperationHandlerOptions<TActor>): SvelteKitPanelOperationHandler {
  validateNativeOptions(options)
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    const execute = async (): Promise<Response> => runWithSvelteKitRequestEvent(event, async () => {
      try {
        const operation = nativeAuthOperation(event)
        if (method === 'GET' && !GET_AUTH_OPERATIONS.has(operation)) return nativeResponse({ error: 'Method Not Allowed' }, 405)
        const { panel, registry } = nativePanel(event, options)
        const auth = await holo.getAuth() as unknown as PanelAuthRuntime<object> | undefined
        if (!auth) return nativeResponse({ error: 'Authentication is unavailable' }, 401)
        const outcome = await executePanelAuthOperation({
          auth,
          operation,
          panel,
          payload: await nativePayload(event.request, method),
          services: Object.freeze({ event, holo }),
          signal: requestSignal(event.request),
          tenant: await registry.resolveTenant?.(event),
        })
        return nativeResponse(outcome.data, outcome.status, outcome.cookies, outcome.redirectTo)
      } catch (cause) {
        return nativeFailure(cause)
      }
    })
    if (method === 'GET') return execute()
    return csrf({ event, resolve: execute })
  }
  return Object.freeze({ GET: handle('GET'), POST: handle('POST') })
}

export function createPanelTenantHandler<TActor = unknown>(options: CreatePanelOperationHandlerOptions<TActor>): SvelteKitPanelOperationHandler {
  validateNativeOptions(options)
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    const execute = async (): Promise<Response> => runWithSvelteKitRequestEvent(event, async () => {
      try {
        const operation = event.params.operation
        if (!TENANT_OPERATIONS.has(operation as PanelTenantOperation)) return nativeResponse({ error: 'Panel tenant operation was not found' }, 404)
        if (method === 'GET' && operation !== 'profile-read') return nativeResponse({ error: 'Method Not Allowed' }, 405)
        const { panel } = nativePanel(event, options)
        const auth = await holo.getAuth() as unknown as PanelAuthRuntime<object> | undefined
        if (!auth) return nativeResponse({ error: 'Panel tenant context is invalid' }, 403)
        const guard = auth.guard(panel.guard)
        const actor = await guard.user()
        if (actor === null) return nativeResponse({ error: 'Panel tenant context is invalid' }, 403)
        const scope = Object.freeze({ actor, guard: panel.guard, panelId: panel.manifest.id, provider: await guard.provider(), signal: requestSignal(event.request) })
        if (!await panel.server.access({ ...scope, operation: 'bootstrap' })) throw new PanelTenantOperationError('not-found')
        const result = await executePanelTenantOperation({ operation: operation as PanelTenantOperation, panel, payload: await nativePayload(event.request, method), scope })
        return nativeResponse(result.data, result.status)
      } catch (cause) {
        return nativeFailure(cause)
      }
    })
    return method === 'GET' ? execute() : csrf({ event, resolve: execute })
  }
  return Object.freeze({ GET: handle('GET'), POST: handle('POST') })
}
