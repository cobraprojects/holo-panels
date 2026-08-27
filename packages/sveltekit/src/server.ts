import { createSvelteKitHoloHelpers, runWithSvelteKitRequestEvent } from '@holo-js/adapter-sveltekit'
import {
  decodeResponseEnvelope,
  normalizeTransportError,
  PROTOCOL_VERSION,
  TransportDecodingError,
  type Effect,
  type CompiledPanelDefinition,
  type JsonValue,
  type ResponseEnvelope,
} from '@holo-js/panels-svelte/server'
import { error, redirect } from '@sveltejs/kit'
import { csrfProtection } from '@holo-js/security/sveltekit/server'
import {
  ActionExecutionError,
  AuthControllerError,
  decodeTransportServerRequest,
  executePanelAuthOperation,
  executePanelTenantOperation,
  bootPanel,
  panelErrorNotificationEffect,
  takePanelNotificationEffects,
  PanelTenantOperationError,
  panelAuthOperationStatus,
  panelTenantOperationStatus,
  resolvePanelRoute,
  type PanelAuthOperation,
  type PanelAuthRuntime,
  type PanelTenantOperation,
} from '@holo-js/panels-svelte/server'
import type {
  CreatePanelOperationHandlerOptions,
  CreatePanelPageLoadOptions,
  CreateSvelteKitPanelRouteOptions,
  PanelOperation,
  PanelOperationResult,
  PanelPageData,
  SvelteKitPanelEvent,
  SvelteKitPanelOperationHandler,
  SvelteKitPanelRouteHandler,
  SvelteKitPanelRegistry,
} from './contracts'
import { type InternalSvelteKitPanelRegistry, panelResolver } from './internal-registry'

export { createGeneratedSvelteKitPanelsRegistry } from './generated-registry'

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const OPERATIONS = new Set<PanelOperation>(['action', 'bootstrap', 'form-submit', 'global-search', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload'])
const TENANT_OPERATIONS = new Set<PanelTenantOperation>(['profile-read', 'profile-update', 'register', 'switch'])
const MAX_REQUEST_BYTES = 1024 * 1024
const MAX_UPLOAD_REQUEST_BYTES = 64 * 1024 * 1024
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
    }, 'session-effects').effects.filter((effect: Effect) => effect.kind === 'toast'))
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

function registryFor<TActor, TTenant>(event: SvelteKitPanelEvent, configured: SvelteKitPanelRegistry<TActor, TTenant> | undefined): SvelteKitPanelRegistry<TActor, TTenant> {
  const registry = configured ?? event.locals.panels as SvelteKitPanelRegistry<TActor, TTenant> | undefined
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

function translatePageError(cause: unknown, loginPath: string, destination: string): never {
  const code = errorCode(cause)
  if (code === 'unauthenticated') redirect(303, `${loginPath}?next=${encodeURIComponent(destination)}`)
  if (code === 'subscription-required' && typeof cause === 'object' && cause !== null && typeof Reflect.get(cause, 'billingPath') === 'string') {
    redirect(303, String(Reflect.get(cause, 'billingPath')))
  }
  if (code === 'panel-not-found') error(404, 'Panel not found')
  if (code === 'access-denied' || cause instanceof Error && cause.name === 'PageAccessError') error(403, 'Panel access denied')
  throw cause
}

async function configuredLoginPath<TActor, TTenant>(registry: SvelteKitPanelRegistry<TActor, TTenant>, panelId: string): Promise<string> {
  const internal = registry as InternalSvelteKitPanelRegistry<TActor, TTenant>
  const panel = internal[panelResolver]
    ? await internal[panelResolver](panelId)
    : registry.panels?.[panelId]
  return safeLocalPath(panel?.manifest.auth?.login?.path ?? '/login', 'Panel login paths')
}

function operationFrom(event: SvelteKitPanelEvent): PanelOperation {
  const value = event.params.operation
  if (!value || !OPERATIONS.has(value as PanelOperation)) error(404, 'Panel operation not found')
  return value as PanelOperation
}

function statusFor(cause: unknown): number {
  const code = errorCode(cause)
  const name = cause instanceof Error ? cause.name : ''
  if (code === 'unauthenticated') return 401
  if (code === 'panel-not-found') return 404
  if (code === 'access-denied') return 403
  if (code === 'subscription-required') return 402
  if (cause instanceof TransportDecodingError) return 400
  if (cause instanceof Error && cause.name === 'PanelNotificationAccessError') return 403
  if (cause instanceof Error && cause.name === 'PanelNotificationRequestError') return 400
  if (name === 'ResourceRecordNotFoundError' || name === 'RelationRecordNotFoundError') return 404
  if (name === 'ResourceInputError' || name === 'RelationInputError' || name === 'RelationPivotInputError' || name === 'RelationListPaginationError') return 422
  if (name === 'RelationOperationNotAllowedError') return 403
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

function errorEnvelope(id: string, cause: unknown, status: number, panel?: CompiledPanelDefinition<object>): Readonly<ResponseEnvelope> {
  const actionEffects = cause instanceof ActionExecutionError ? (cause as { readonly effects: readonly Effect[] }).effects : []
  const notification = panel && actionEffects.length === 0 ? panelErrorNotificationEffect(panel, status) : null
  const effects = notification ? [...actionEffects, notification] : actionEffects
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

  constructor(maximumBytes = MAX_REQUEST_BYTES) {
    super(`Panel request body exceeds ${maximumBytes} bytes`)
    this.name = 'PanelRequestSizeError'
  }
}

async function boundedBody(request: Request, maximumBytes = MAX_REQUEST_BYTES): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength && /^\d+$/u.test(declaredLength) && Number(declaredLength) > maximumBytes) throw new PanelRequestSizeError(maximumBytes)
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    length += result.value.byteLength
    if (length > maximumBytes) {
      await reader.cancel()
      throw new PanelRequestSizeError(maximumBytes)
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

export function createPanelPageLoad<TActor = unknown, TTenant = unknown>(options: CreatePanelPageLoadOptions<TActor, TTenant>): (event: SvelteKitPanelEvent) => Promise<PanelPageData> {
  assertPanelId(options.panelId)
  return event => runWithSvelteKitRequestEvent(event, async () => {
    const registry = registryFor(event, options.registry)
    try {
      const signal = requestSignal(event.request)
      const bootstraps = await registry.runtime.bootstrap([options.panelId], signal)
      const panel = bootstraps[0]
      if (!panel || panel.manifest.id !== options.panelId) error(404, 'Panel not found')
      const routing = panel.manifest.routing
      const hosts = routing ? [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])] : []
      if (hosts.length > 0 && !hosts.includes(event.url.hostname.toLowerCase())) error(404, 'Panel not found')
      const requestedPath = panelPath(event, panel.manifest.path)
      if (requestedPath === panel.manifest.tenancy?.billing?.path) {
        const billing = registry.panels?.[options.panelId]?.server.tenancy?.billing
        if (!billing) error(404, 'Tenant billing provider not found')
        const response = await registry.runtime.execute(options.panelId, 'bootstrap', signal, scope => {
          const action = billing.getRouteAction()
          if (typeof action !== 'function') throw new TypeError('Panel tenant billing providers must return a route action function')
          return action(event.request, scope)
        })
        const location = response.headers.get('location')
        if (location && response.status >= 300 && response.status < 400) redirect(response.status === 301 || response.status === 308 ? 308 : 303, location)
        error(response.ok ? 502 : response.status, 'Tenant billing providers must return a redirect response')
      }
      const resolved = await registry.runtime.execute(options.panelId, 'page-data', signal, async scope => ({
        effects: await takeSessionEffects(scope.guard, options.panelId),
        ...await (async () => {
          const input = {
            event,
            holo,
            panelId: options.panelId,
            parameters: routeParameters(event),
            path: requestedPath,
            scope,
            tenant: await registry.resolveTenant?.(event),
          }
          const page = await registry.resolvePage(input)
          const widgets = await registry.resolveWidgets?.({ ...input, page }) ?? { footer: [], header: [] }
          return { page, widgets }
        })(),
      }))
      return Object.freeze({ effects: resolved.effects, panel, page: resolved.page, widgets: resolved.widgets })
    } catch (cause) {
      const loginPath = errorCode(cause) === 'unauthenticated'
        ? await configuredLoginPath(registry, options.panelId)
        : '/login'
      return translatePageError(cause, loginPath, `${event.url.pathname}${event.url.search}`)
    }
  })
}

type DecodedPanelRequest = Awaited<ReturnType<typeof decodeTransportServerRequest<JsonValue>>>

async function executeOperation<TActor, TTenant>(event: SvelteKitPanelEvent, options: CreatePanelOperationHandlerOptions<TActor, TTenant>, method: 'GET' | 'POST', decoded: DecodedPanelRequest | undefined, decodingError: unknown): Promise<Response> {
  return runWithSvelteKitRequestEvent(event, async () => {
    let guard: SessionEffectGuard | undefined
    let panelId: string | undefined
    let configuredPanel: CompiledPanelDefinition<object> | undefined
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
      const registeredPanel = registry.panels?.[panelId]
      configuredPanel = registeredPanel as CompiledPanelDefinition<object> | undefined
      const routing = registeredPanel?.manifest.routing
      const hosts = routing ? [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])] : []
      if (hosts.length > 0 && !hosts.includes(event.url.hostname.toLowerCase())) throw Object.assign(new Error('Panel not found'), { status: 404 })
      const handler = registry.operations?.[operation]
      if (!handler) throw Object.assign(new Error('Panel operation not found'), { status: 404 })
      const result: PanelOperationResult = await registry.runtime.execute(panelId, operation, requestSignal(event.request), async scope => {
        guard = await sessionGuard(scope.guard)
        const result = await handler({
          event,
          holo,
          ...(decoded.idempotencyKey ? { idempotencyKey: decoded.idempotencyKey } : {}),
          operation,
          panelId: panelId!,
          payload: decoded.envelope.payload,
          scope,
          tenant: await registry.resolveTenant?.(event),
        })
        return { ...result, effects: [...(result.effects ?? []), ...takePanelNotificationEffects()] }
      })
      const status = result.status ?? 200
      if (!Number.isInteger(status) || status < 200 || status > 299 || status === 204 || status === 205) throw new Error('Panel operation success statuses must support a JSON response body')
      const response = successEnvelope(id, result.data, result.effects ?? [])
      const serialized = envelopeResponse(response, status)
      if (serialized.status < 300) await flashRedirectToasts(guard, panelId, response.effects)
      return serialized
    } catch (cause) {
      const status = statusFor(cause)
      const response = errorEnvelope(id, cause, status, configuredPanel)
      if (panelId) await flashRedirectToasts(guard, panelId, response.effects)
      return envelopeResponse(response, status)
    }
  })
}

export function createPanelOperationHandler<TActor = unknown, TTenant = unknown>(options: CreatePanelOperationHandlerOptions<TActor, TTenant>): SvelteKitPanelOperationHandler {
  if (options.panelIds.length === 0) throw new Error('Panel operation routes require at least one panel ID')
  for (const panelId of options.panelIds) assertPanelId(panelId)
  if (new Set(options.panelIds).size !== options.panelIds.length) throw new Error('Panel operation route IDs must be unique')
  const fixedOptions = Object.freeze({ ...options, panelIds: Object.freeze([...options.panelIds]) })
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    let body: Uint8Array
    try {
      body = method === 'POST' ? await boundedBody(event.request, event.params.operation === 'upload' ? MAX_UPLOAD_REQUEST_BYTES : MAX_REQUEST_BYTES) : new Uint8Array()
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
          const decoded = await decodeTransportServerRequest<JsonValue>(decodedEvent.request.clone())
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

export function createGeneratedSvelteKitPanelRoute<TActor, TTenant>(options: CreateSvelteKitPanelRouteOptions<TActor, TTenant>): SvelteKitPanelRouteHandler {
  assertPanelId(options.panelId)
  const csrf = csrfProtection()
  const handle = async (event: SvelteKitPanelEvent): Promise<Response> => runWithSvelteKitRequestEvent(event, async () => {
    try {
      const registry = registryFor(event, options.registry)
      const internal = registry as InternalSvelteKitPanelRegistry<TActor, TTenant>
      const panel = registry.panels?.[options.panelId] ?? await internal[panelResolver]?.(options.panelId)
      if (!panel) throw Object.assign(new Error('Panel not found'), { status: 404 })
      const resolved = resolvePanelRoute(panel, event.request)
      if (!resolved) throw Object.assign(new Error('Panel custom route not found'), { status: 404 })
      const execute = async (): Promise<Response> => {
        if (resolved.definition.scope === 'public' || resolved.definition.scope === 'tenant') {
          await bootPanel(panel)
          return await resolved.definition.handler(event.request)
        }
        return await registry.runtime.execute(options.panelId, 'route', event.request.signal, async scope => {
          if (resolved.definition.scope === 'authenticated-tenant') {
            const tenantKey = resolved.parameters.tenant
            if (!tenantKey || !panel.server.tenancy) throw Object.assign(new Error('Tenant not found'), { status: 404 })
            await panel.server.tenancy.resolveRoute(tenantKey, scope)
          }
          return await resolved.definition.handler(event.request)
        })
      }
      if (event.request.method === 'GET') return await execute()
      return await csrf({ event, resolve: execute })
    } catch (cause) {
      return nativeFailure(cause)
    }
  })
  return Object.freeze({ DELETE: handle, GET: handle, PATCH: handle, POST: handle, PUT: handle })
}

const AUTH_OPERATIONS = new Set<PanelAuthOperation>([
  'email-verification-resend', 'email-verification-verify', 'login', 'logout', 'mfa-challenge', 'mfa-disable',
  'mfa-enrollment-begin', 'mfa-enrollment-confirm', 'mfa-recovery', 'mfa-recovery-codes-regenerate', 'mfa-status',
  'password-reset-request', 'password-reset', 'presentation', 'profile-read', 'profile-update', 'registration',
])
const GET_AUTH_OPERATIONS = new Set<PanelAuthOperation>(['mfa-enrollment-begin', 'mfa-status', 'presentation', 'profile-read'])

function nativeResponse(data: unknown, status: number, cookies: readonly string[] = [], location: string | null = null): Response {
  const headers = new Headers(RESPONSE_HEADERS)
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  if (location !== null) headers.set('location', location)
  return new Response(status === 204 ? null : JSON.stringify(data), { headers, status })
}

function nativeFailure(cause: unknown): Response {
  if (cause instanceof AuthControllerError) return nativeResponse({ code: cause.code, error: 'Panel authentication request failed.' }, panelAuthOperationStatus(cause))
  if (cause instanceof PanelTenantOperationError) return nativeResponse({ error: 'Tenant was not found.' }, panelTenantOperationStatus(cause))
  const status = statusFor(cause)
  return nativeResponse({ error: status >= 500 ? 'Panel request failed.' : 'Panel request was rejected.' }, status)
}

async function nativePanel<TActor, TTenant>(event: SvelteKitPanelEvent, options: CreatePanelOperationHandlerOptions<TActor, TTenant>) {
  const panelId = event.params.panelId
  if (!panelId || !options.panelIds.includes(panelId)) throw Object.assign(new Error('Panel not found'), { status: 404 })
  const registry = registryFor(event, options.registry) as InternalSvelteKitPanelRegistry<TActor, TTenant>
  const panel = registry.panels?.[panelId] ?? await registry[panelResolver]?.(panelId)
  if (!panel || panel.manifest.id !== panelId) throw Object.assign(new Error('Panel not found'), { status: 404 })
  const routing = panel.manifest.routing
  const hosts = routing ? [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])] : []
  if (hosts.length > 0 && !hosts.includes(event.url.hostname.toLowerCase())) throw Object.assign(new Error('Panel not found'), { status: 404 })
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

function validateNativeOptions<TActor, TTenant>(options: CreatePanelOperationHandlerOptions<TActor, TTenant>): void {
  if (options.panelIds.length === 0) throw new Error('Panel auth and tenant routes require at least one panel ID')
  for (const panelId of options.panelIds) assertPanelId(panelId)
  if (new Set(options.panelIds).size !== options.panelIds.length) throw new Error('Panel auth and tenant route IDs must be unique')
}

export function createPanelAuthHandler<TActor = unknown, TTenant = unknown>(options: CreatePanelOperationHandlerOptions<TActor, TTenant>): SvelteKitPanelOperationHandler {
  validateNativeOptions(options)
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    const execute = async (): Promise<Response> => runWithSvelteKitRequestEvent(event, async () => {
      try {
        const operation = nativeAuthOperation(event)
        if (method === 'GET' && !GET_AUTH_OPERATIONS.has(operation)) return nativeResponse({ error: 'Method Not Allowed' }, 405)
        const { panel, registry } = await nativePanel(event, options)
        const auth = await holo.getAuth() as unknown as PanelAuthRuntime<object> | undefined
        if (!auth) return nativeResponse({ error: 'Authentication is unavailable' }, 401)
        const outcome = await executePanelAuthOperation({
          auth,
          operation,
          panel,
          payload: await nativePayload(event.request, method),
          services: Object.freeze({ event, holo }),
          signal: requestSignal(event.request),
          tenant: operation === 'profile-read' || operation === 'profile-update'
            ? await registry.resolveTenant?.(event)
            : undefined,
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

export function createPanelTenantHandler<TActor = unknown, TTenant = unknown>(options: CreatePanelOperationHandlerOptions<TActor, TTenant>): SvelteKitPanelOperationHandler {
  validateNativeOptions(options)
  const csrf = csrfProtection()
  const handle = (method: 'GET' | 'POST') => async (event: SvelteKitPanelEvent): Promise<Response> => {
    const execute = async (): Promise<Response> => runWithSvelteKitRequestEvent(event, async () => {
      try {
        const operation = event.params.operation
        if (!TENANT_OPERATIONS.has(operation as PanelTenantOperation)) return nativeResponse({ error: 'Panel tenant operation was not found' }, 404)
        if (method === 'GET' && operation !== 'profile-read') return nativeResponse({ error: 'Method Not Allowed' }, 405)
        const { panel } = await nativePanel(event, options)
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
