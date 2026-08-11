import { holo, runWithNuxtRequest } from '@holo-js/adapter-nuxt/runtime'
import {
  PROTOCOL_VERSION,
  TransportDecodingError,
  decodeResponseEnvelope,
  toJsonValue,
  type Effect,
  type ErrorCategory,
  type CompiledPanelDefinition,
  type JsonObject,
  type JsonValue,
  type ResponseEnvelope,
} from '@holo-js/panels-vue'
import { csrfProtection } from '@holo-js/security/nuxt/server'
import {
  ActionExecutionError,
  AuthControllerError,
  decodeTransportServerRequest,
  executePanelPipeline,
  executePanelRoute,
  panelErrorNotificationEffect,
  executePanelAuthOperation,
  executePanelTenantOperation,
  PanelTenantOperationError,
  panelAuthOperationStatus,
  panelTenantOperationStatus,
  type PanelAuthOperation,
  type PanelAuthRuntime,
  type PanelTenantOperation,
  type HoloAuth,
} from '@holo-js/panels-vue/server'
import {
  createError,
  defineEventHandler,
  getMethod,
  getQuery,
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  getRouterParam,
  type EventHandler,
  type H3Event,
} from 'h3'
import type { CreateNuxtPanelRouteHandlerOptions, CreatePanelOperationHandlerOptions, NuxtPanelOperation, NuxtPanelOperationContext, NuxtPanelRuntime, NuxtPanelRuntimePanel } from './contracts'

export { createGeneratedNuxtPanelsRuntime } from './generated-runtime'
import { assertPanelId, normalizePanelLocation, toJsonObject } from './validation'

const OPERATIONS = new Set<NuxtPanelOperation>(['action', 'bootstrap', 'form-submit', 'global-search', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload'])
const GET_OPERATIONS = new Set<NuxtPanelOperation>(['bootstrap', 'page-data'])
const TENANT_OPERATIONS = new Set<PanelTenantOperation>(['profile-read', 'profile-update', 'register', 'switch'])
const MAX_REQUEST_BYTES = 1_048_576
const MAX_UPLOAD_REQUEST_BYTES = 67_108_864
const MAX_RESPONSE_BYTES = 4_194_304
const RESPONSE_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
const RAW_BODY = Symbol.for('h3RawBody')

interface AuthenticatedGuard {
  readonly flash?: (key: string, value: unknown) => Promise<void>
  readonly provider?: () => Promise<string | null>
  readonly refreshUser?: () => Promise<unknown | null>
  readonly take?: <TValue = unknown>(key: string) => Promise<TValue | undefined>
  readonly user: () => Promise<unknown | null>
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

async function takeSessionEffects(guard: AuthenticatedGuard, panelId: string): Promise<readonly Effect[]> {
  if (!guard.take) return Object.freeze([])
  try {
    return decodedSessionEffects(await guard.take(sessionEffectKey(panelId)))
  } catch {
    return Object.freeze([])
  }
}

async function flashRedirectToasts(guard: AuthenticatedGuard, panelId: string, effects: readonly Effect[]): Promise<void> {
  if (!effects.some(effect => effect.kind === 'redirect')) return
  const toasts = effects.filter(effect => effect.kind === 'toast')
  if (toasts.length === 0 || !guard.flash) return
  try {
    await guard.flash(sessionEffectKey(panelId), toasts)
  } catch {
    return
  }
}

function operationFromEvent(event: H3Event): NuxtPanelOperation {
  const operation = getRouterParam(event, 'operation')
  if (!operation || !OPERATIONS.has(operation as NuxtPanelOperation)) throw createError({ statusCode: 404, statusMessage: 'Panel operation not found' })
  return operation as NuxtPanelOperation
}

function panelFromEvent(event: H3Event, allowed: ReadonlySet<string>): string {
  const panelId = getRouterParam(event, 'panelId')
  if (!panelId || !allowed.has(panelId)) throw createError({ statusCode: 404, statusMessage: 'Panel not found' })
  return panelId
}

function requestSignal(event: H3Event): AbortSignal {
  const request = (event as H3Event & { readonly web?: { readonly request?: Request } }).web?.request
  return request?.signal ?? new AbortController().signal
}

function requestHeader(event: H3Event, name: string): string | undefined {
  return getRequestHeader(event, name) ?? (event as H3Event & { readonly web?: { readonly request?: Request } }).web?.request?.headers.get(name) ?? undefined
}

function requestId(event: H3Event): string {
  const supplied = requestHeader(event, 'x-request-id')?.trim()
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/u.test(supplied) ? supplied : crypto.randomUUID()
}

function errorDetails(cause: unknown): { readonly category: ErrorCategory, readonly code: string, readonly message: string, readonly retryable: boolean, readonly status: number } {
  const name = cause instanceof Error ? cause.name : ''
  if (cause instanceof TransportDecodingError) return { category: 'protocol', code: 'invalid_request', message: cause.message, retryable: false, status: 400 }
  if (cause && typeof cause === 'object' && 'statusCode' in cause && typeof cause.statusCode === 'number') {
    const status = cause.statusCode
    if (status === 401) return { category: 'authentication', code: 'unauthenticated', message: 'Authentication is required.', retryable: false, status }
    if (status === 403 || status === 419) return { category: 'authorization', code: status === 419 ? 'csrf_token_mismatch' : 'access_denied', message: status === 419 ? 'CSRF token mismatch.' : 'Panel access was denied.', retryable: false, status }
    if (status === 404) return { category: 'not-found', code: 'not_found', message: 'Panel operation not found.', retryable: false, status }
    if (status === 413 || status === 422) return { category: 'validation', code: status === 413 ? 'payload_too_large' : 'validation_failed', message: status === 413 ? 'Panel operation payload is too large.' : 'Panel input is invalid.', retryable: false, status }
    if (status === 429) return { category: 'rate-limit', code: 'rate_limited', message: 'Too many requests.', retryable: true, status }
    if (status >= 500) return { category: 'internal', code: 'operation_unavailable', message: 'Panel operation is unavailable.', retryable: true, status }
  }
  if (name === 'PanelRuntimeError') {
    const code = (cause as Error & { readonly code?: string }).code
    if (code === 'unauthenticated') return { category: 'authentication', code, message: 'Authentication is required.', retryable: false, status: 401 }
    if (code === 'panel-not-found') return { category: 'not-found', code, message: 'Panel not found.', retryable: false, status: 404 }
    if (code === 'subscription-required') return { category: 'authorization', code, message: 'An active tenant subscription is required.', retryable: false, status: 402 }
    return { category: 'authorization', code: code ?? 'access-denied', message: 'Panel access was denied.', retryable: false, status: 403 }
  }
  if (name === 'PageAccessError') return { category: 'authorization', code: 'page_access_denied', message: 'Page access was denied.', retryable: false, status: 403 }
  if (name === 'ResourceRecordNotFoundError') return { category: 'not-found', code: 'record_not_found', message: 'Record not found.', retryable: false, status: 404 }
  if (name === 'ResourceInputError') return { category: 'validation', code: 'invalid_resource_input', message: cause instanceof Error ? cause.message : 'Resource input is invalid.', retryable: false, status: 422 }
  if (name === 'RelationRecordNotFoundError') return { category: 'not-found', code: 'relation_record_not_found', message: 'Related record not found.', retryable: false, status: 404 }
  if (name === 'RelationInputError' || name === 'RelationPivotInputError' || name === 'RelationListPaginationError') return { category: 'validation', code: 'invalid_relation_input', message: 'Relation input is invalid.', retryable: false, status: 422 }
  if (name === 'RelationOperationNotAllowedError') return { category: 'authorization', code: 'relation_operation_denied', message: 'Relation operation is not allowed.', retryable: false, status: 403 }
  if (name === 'PanelNotificationAccessError') return { category: 'authorization', code: 'notification_access_denied', message: 'Notification access was denied.', retryable: false, status: 403 }
  if (name === 'PanelNotificationRequestError') return { category: 'validation', code: 'invalid_notification_request', message: 'Notification input is invalid.', retryable: false, status: 400 }
  return { category: 'internal', code: 'operation_failed', message: 'Panel operation failed.', retryable: true, status: 500 }
}

function errorEnvelope(id: string, cause: unknown, panel?: CompiledPanelDefinition<object>): { readonly response: Readonly<ResponseEnvelope>, readonly status: number } {
  const error = errorDetails(cause)
  let effects: readonly Effect[] = Object.freeze([])
  if (cause instanceof ActionExecutionError) {
    try {
      const validated = decodeResponseEnvelope({
        data: null,
        effects: cause.effects,
        id,
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
      }, id)
      effects = validated.effects
    } catch {
      effects = Object.freeze([])
    }
  }
  const notification = panel && effects.length === 0 ? panelErrorNotificationEffect(panel, error.status) : null
  if (notification) effects = Object.freeze([...effects, notification])
  return {
    response: Object.freeze({
      effects: [...effects],
      error: Object.freeze({ category: error.category, code: error.code, message: error.message, retryable: error.retryable }),
      id,
      ok: false,
      protocolVersion: PROTOCOL_VERSION,
    }),
    status: error.status,
  }
}

function successEnvelope(id: string, data: JsonValue, effects: readonly Effect[]): Readonly<ResponseEnvelope> {
  return decodeResponseEnvelope({ data, effects: [...effects], id, ok: true, protocolVersion: PROTOCOL_VERSION }, id)
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

function dataResponse(id: string, data: JsonValue): Response {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  return bytes.byteLength > MAX_RESPONSE_BYTES
    ? oversizedResponse(id)
    : responseFromBytes(bytes, 200)
}

async function transportRequest(event: H3Event, body: Uint8Array): ReturnType<typeof decodeTransportServerRequest<JsonObject>> {
  const contentType = requestHeader(event, 'content-type')
  if (!contentType) throw new TransportDecodingError('Panel operation requests require a content type.')
  const requestBody = new Uint8Array(body.byteLength)
  requestBody.set(body)
  return await decodeTransportServerRequest<JsonObject>({
    formData: async () => await new Response(requestBody.buffer, { headers: { 'content-type': contentType } }).formData(),
    headers: { get: name => requestHeader(event, name) ?? null },
  })
}

async function boundedRequestBody(event: H3Event, maximumBytes = MAX_REQUEST_BYTES): Promise<Uint8Array> {
  const declared = requestHeader(event, 'content-length')
  if (declared !== undefined) {
    const length = Number(declared)
    if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) throw createError({ statusCode: 413, statusMessage: 'Panel operation payload is too large' })
  }
  const cachedBody = Reflect.get(event, '_requestBody') as unknown
  if (cachedBody instanceof Uint8Array) {
    if (cachedBody.byteLength > maximumBytes) throw createError({ statusCode: 413, statusMessage: 'Panel operation payload is too large' })
    return cachedBody
  }
  const chunks: Uint8Array[] = []
  let size = 0
  const stream = cachedBody && typeof cachedBody === 'object' && 'getReader' in cachedBody
    ? cachedBody as ReadableStream<Uint8Array>
    : (event as H3Event & { readonly web?: { readonly request?: Request } }).web?.request?.body
  if (stream) {
    const reader = stream.getReader()
    while (true) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > maximumBytes) {
        await reader.cancel()
        throw createError({ statusCode: 413, statusMessage: 'Panel operation payload is too large' })
      }
      chunks.push(item.value)
    }
  } else {
    const requestWithBody = event.node.req as typeof event.node.req & { readonly body?: unknown, readonly rawBody?: unknown, readonly [RAW_BODY]?: unknown }
    const existing = requestWithBody[RAW_BODY] ?? requestWithBody.rawBody ?? requestWithBody.body
    if (existing !== undefined && (Buffer.isBuffer(existing) || typeof existing === 'string' || existing instanceof URLSearchParams)) {
      const body = Buffer.isBuffer(existing) ? existing : Buffer.from(existing.toString())
      if (body.byteLength > maximumBytes) throw createError({ statusCode: 413, statusMessage: 'Panel operation payload is too large' })
      Reflect.set(event, '_requestBody', body)
      return body
    }
    for await (const value of event.node.req) {
      const chunk = typeof value === 'string' ? Buffer.from(value) : value as Uint8Array
      size += chunk.byteLength
      if (size > maximumBytes) throw createError({ statusCode: 413, statusMessage: 'Panel operation payload is too large' })
      chunks.push(chunk)
    }
  }
  const body = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
  Reflect.set(event, '_requestBody', body)
  return body
}

async function authorizedContext<TActor, TTenant, TResult>(
  event: H3Event,
  operation: NuxtPanelOperation,
  panelId: string,
  options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>,
): Promise<{ readonly actor: TActor, readonly definition?: CompiledPanelDefinition<TActor>, readonly guard: AuthenticatedGuard, readonly provider: string | null, readonly signal: AbortSignal }> {
  const panel = await runtimePanel(options.runtime, panelId)
  if (!panel) throw Object.assign(new Error('Panel not found'), { code: 'panel-not-found', name: 'PanelRuntimeError' })
  const routing = panel.definition?.manifest.routing
  const hosts = routing ? [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])] : []
  if (hosts.length > 0 && !hosts.includes(getRequestURL(event).hostname.toLowerCase())) {
    throw Object.assign(new Error('Panel not found'), { code: 'panel-not-found', name: 'PanelRuntimeError' })
  }
  const auth = await holo.getAuth()
  if (!auth) throw Object.assign(new Error('Authentication is required'), { code: 'unauthenticated', name: 'PanelRuntimeError' })
  const guard = auth.guard(panel.guard) as AuthenticatedGuard
  const [actor, provider] = await Promise.all([guard.refreshUser?.() ?? guard.user(), guard.provider?.() ?? null])
  if (actor === null) throw Object.assign(new Error('Authentication is required'), { code: 'unauthenticated', name: 'PanelRuntimeError' })
  const signal = requestSignal(event)
  if (!await panel.access({ actor: actor as TActor, operation, panelId, signal })) throw Object.assign(new Error('Panel access was denied'), { code: 'access-denied', name: 'PanelRuntimeError' })
  return { actor: actor as TActor, ...(panel.definition ? { definition: panel.definition } : {}), guard, provider, signal }
}

async function executeGet<TActor, TTenant, TResult>(
  event: H3Event,
  operation: NuxtPanelOperation,
  panelId: string,
  options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>,
): Promise<JsonValue | Response> {
  const input = toJsonObject(getQuery(event))
  const normalizedInput = operation === 'page-data' && typeof input.path === 'string'
    ? Object.freeze({ ...input, path: normalizePanelLocation(input.path) })
    : input
  const scope = await authorizedContext(event, operation, panelId, options)
  const configuredPanel = await runtimePanel(options.runtime, panelId)
  const billing = configuredPanel?.definition?.server.tenancy?.billing
  const billingPath = configuredPanel?.definition?.manifest.tenancy?.billing?.path
  if (operation === 'page-data' && typeof normalizedInput.path === 'string' && normalizedInput.path === billingPath && billing) {
    const action = billing.getRouteAction()
    if (typeof action !== 'function') throw new TypeError('Panel tenant billing providers must return a route action function')
    const headers = new Headers(Object.entries(getRequestHeaders(event)).flatMap(([name, value]) => value === undefined ? [] : [[name, value] as [string, string]]))
    const request = (event as H3Event & { readonly web?: { readonly request?: Request } }).web?.request
      ?? new Request(getRequestURL(event), { headers })
    return action(request, {
      actor: scope.actor,
      guard: configuredPanel.guard,
      panelId,
      provider: scope.provider,
      signal: scope.signal,
    })
  }
  const execute = async () => options.runtime.execute({
    actor: scope.actor,
    event,
    getApp: () => holo.getApp(),
    getAuth: () => holo.getAuth(),
    input: normalizedInput,
    operation,
    panelId,
    provider: scope.provider,
    requestId: requestId(event),
    signal: scope.signal,
    tenant: await options.runtime.resolveTenant?.(event),
  })
  const result = scope.definition
    ? await executePanelPipeline(scope.definition, { actor: scope.actor, guard: scope.definition.guard, panelId, provider: scope.provider, signal: scope.signal }, operation, execute, { initial: true })
    : await execute()
  const data = toJsonValue(result.data)
  if (operation !== 'page-data' || !data || typeof data !== 'object' || Array.isArray(data)) return data
  const effects = await takeSessionEffects(scope.guard, panelId)
  return Object.freeze({ ...data, effects: toJsonValue(effects) })
}

export function createPanelOperationHandler<TActor, TTenant, TResult>(options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>): EventHandler {
  if (!options.panelIds.length) throw new Error('Nuxt panel operation handlers require at least one panel ID')
  const allowed = new Set(options.panelIds)
  if (allowed.size !== options.panelIds.length) throw new Error('Nuxt panel operation handler IDs must be unique')
  for (const panelId of allowed) assertPanelId(panelId)
  const runtimePanelIds = options.runtime.registry
    ? Object.keys(options.runtime.registry).flatMap(key => {
        const match = /^([^:]+):panel:[^:]+$/u.exec(key)
        return match?.[1] ? [match[1]] : []
      })
    : Object.keys(options.runtime.panels)
  if (runtimePanelIds.some(panelId => !allowed.has(panelId)) || [...allowed].some(panelId => !runtimePanelIds.includes(panelId))) {
    throw new Error('Nuxt panel runtime IDs must exactly match the generated panel allow-list')
  }
  const protect = csrfProtection()
  return defineEventHandler(event => runWithNuxtRequest(event, async () => {
    const method = getMethod(event).toUpperCase()
    if (method !== 'GET' && method !== 'POST') throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
    const operation = operationFromEvent(event)
    const panelId = panelFromEvent(event, allowed)
    if (method === 'GET') {
      if (!GET_OPERATIONS.has(operation)) throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      await protect(event)
      const id = requestId(event)
      let configuredPanel: CompiledPanelDefinition<object> | undefined
      try {
        configuredPanel = (await runtimePanel(options.runtime, panelId))?.definition as CompiledPanelDefinition<object> | undefined
        const result = await executeGet(event, operation, panelId, options)
        return result instanceof Response ? result : dataResponse(id, result)
      } catch (cause) {
        const failure = errorEnvelope(id, cause, configuredPanel)
        return envelopeResponse(failure.response, failure.status)
      }
    }

    let guard: AuthenticatedGuard | undefined
    let configuredPanel: CompiledPanelDefinition<object> | undefined
    let id = requestId(event)
    try {
      const body = await boundedRequestBody(event, operation === 'upload' ? MAX_UPLOAD_REQUEST_BYTES : MAX_REQUEST_BYTES)
      await protect(event)
      const decoded = await transportRequest(event, body)
      id = decoded.envelope.id
      if (decoded.envelope.panelId !== panelId || decoded.envelope.operation !== operation) {
        throw new TransportDecodingError('Request envelope does not match the fixed operation route.')
      }
      const scope = await authorizedContext(event, operation, panelId, options)
      guard = scope.guard
      configuredPanel = scope.definition as CompiledPanelDefinition<object> | undefined
      const context: NuxtPanelOperationContext<TActor, TTenant> = {
        actor: scope.actor,
        event,
        getApp: () => holo.getApp(),
        getAuth: () => holo.getAuth(),
        input: decoded.envelope.payload,
        ...(decoded.idempotencyKey ? { idempotencyKey: decoded.idempotencyKey } : {}),
        operation,
        panelId,
        provider: scope.provider,
        requestId: id,
        signal: scope.signal,
        tenant: await options.runtime.resolveTenant?.(event),
      }
      const result = scope.definition
        ? await executePanelPipeline(scope.definition, { actor: scope.actor, guard: scope.definition.guard, panelId, provider: scope.provider, signal: scope.signal }, operation, () => options.runtime.execute(context))
        : await options.runtime.execute(context)
      const data = toJsonValue(result.data)
      const response = successEnvelope(id, data, result.effects ?? [])
      const serialized = envelopeResponse(response, result.status ?? 200)
      if (serialized.status < 300) await flashRedirectToasts(scope.guard, panelId, response.effects)
      return serialized
    } catch (cause) {
      const failure = errorEnvelope(id, cause, configuredPanel)
      const serialized = envelopeResponse(failure.response, failure.status)
      if (guard && serialized.status === failure.status) await flashRedirectToasts(guard, panelId, failure.response.effects)
      return serialized
    }
  }))
}

export const nuxtPanelServerInternals = Object.freeze({ authorizedContext, boundedRequestBody, errorDetails, operationFromEvent, panelFromEvent, transportRequest })

const AUTH_OPERATIONS = new Set<PanelAuthOperation>([
  'email-verification-resend', 'email-verification-verify', 'login', 'logout', 'mfa-challenge', 'mfa-disable',
  'mfa-enrollment-begin', 'mfa-enrollment-confirm', 'mfa-recovery', 'mfa-recovery-codes-regenerate', 'mfa-status',
  'password-reset-request', 'password-reset', 'profile-read', 'profile-update', 'registration',
])
const GET_AUTH_OPERATIONS = new Set<PanelAuthOperation>(['mfa-enrollment-begin', 'mfa-status', 'profile-read'])

function nativeResponse(data: unknown, status: number, cookies: readonly string[] = [], location: string | null = null): Response {
  const headers = new Headers(RESPONSE_HEADERS)
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  if (location !== null) headers.set('location', location)
  return new Response(status === 204 ? null : JSON.stringify(toJsonValue(data)), { headers, status })
}

function nativeFailure(cause: unknown): Response {
  if (cause instanceof AuthControllerError) return nativeResponse({ error: 'Panel authentication request failed.' }, panelAuthOperationStatus(cause))
  if (cause instanceof PanelTenantOperationError) return nativeResponse({ error: 'Tenant was not found.' }, panelTenantOperationStatus(cause))
  const details = errorDetails(cause)
  return nativeResponse({ error: details.status >= 500 ? 'Panel request failed.' : details.message }, details.status)
}

function authOperationFromEvent(event: H3Event): PanelAuthOperation {
  const operation = getRouterParam(event, 'operation')
  if (!operation || !AUTH_OPERATIONS.has(operation as PanelAuthOperation)) throw createError({ statusCode: 404, statusMessage: 'Panel authentication operation not found' })
  return operation as PanelAuthOperation
}

async function runtimePanel<TActor, TTenant, TResult>(runtime: NuxtPanelRuntime<TActor, TTenant, TResult>, panelId: string): Promise<NuxtPanelRuntimePanel<TActor> | undefined> {
  const configured = runtime.panels[panelId]
  if (configured) return configured
  const loader = runtime.registry?.[`${panelId}:panel:${panelId}`]
  if (!loader) return undefined
  const loaded = await loader()
  const definition = 'compile' in loaded && typeof loaded.compile === 'function' ? loaded.compile() : loaded
  if (!definition || typeof definition !== 'object' || Reflect.get(definition, 'kind') !== 'panel') return undefined
  const compiled = definition as CompiledPanelDefinition<TActor>
  return Object.freeze({
    access: (context: { readonly actor: TActor, readonly operation: NuxtPanelOperation, readonly panelId: string, readonly signal: AbortSignal }) => compiled.server.access({ actor: context.actor, guard: compiled.guard, operation: context.operation, panelId, provider: null, signal: context.signal }),
    definition: compiled,
    guard: compiled.guard,
  })
}

async function compiledPanel<TActor, TTenant, TResult>(event: H3Event, options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>, panelId: string) {
  const definition = (await runtimePanel(options.runtime, panelId))?.definition
  if (!definition || definition.manifest.id !== panelId) throw createError({ statusCode: 404, statusMessage: 'Panel not found' })
  const routing = definition.manifest.routing
  const hosts = routing ? [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])] : []
  if (hosts.length > 0 && !hosts.includes(getRequestURL(event).hostname.toLowerCase())) throw createError({ statusCode: 404, statusMessage: 'Panel not found' })
  return definition as unknown as Parameters<typeof executePanelAuthOperation>[0]['panel']
}

async function nativePayload(event: H3Event, method: string): Promise<unknown> {
  if (method === 'GET') return {}
  if (requestHeader(event, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw createError({ statusCode: 400, statusMessage: 'Panel auth requests require application/json' })
  }
  try {
    return JSON.parse(new TextDecoder().decode(await boundedRequestBody(event))) as unknown
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Panel auth request contains invalid JSON' })
  }
}

function validateNativeOptions<TActor, TTenant, TResult>(options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>): ReadonlySet<string> {
  if (!options.panelIds.length) throw new Error('Nuxt panel auth and tenant handlers require at least one panel ID')
  const allowed = new Set(options.panelIds)
  if (allowed.size !== options.panelIds.length) throw new Error('Nuxt panel auth and tenant handler IDs must be unique')
  for (const panelId of allowed) assertPanelId(panelId)
  return allowed
}

export function createPanelAuthHandler<TActor, TTenant, TResult>(options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>): EventHandler {
  const allowed = validateNativeOptions(options)
  const protect = csrfProtection()
  return defineEventHandler(event => runWithNuxtRequest(event, async () => {
    try {
      const method = getMethod(event).toUpperCase()
      if (method !== 'GET' && method !== 'POST') throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      const operation = authOperationFromEvent(event)
      if (method === 'GET' && !GET_AUTH_OPERATIONS.has(operation)) throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      const panelId = panelFromEvent(event, allowed)
      const input = await nativePayload(event, method)
      if (method === 'POST') await protect(event)
      const auth = await holo.getAuth() as unknown as PanelAuthRuntime<object> | undefined
      if (!auth) throw createError({ statusCode: 401, statusMessage: 'Authentication is unavailable' })
      const outcome = await executePanelAuthOperation({
        auth,
        operation,
        panel: await compiledPanel(event, options, panelId),
        payload: input,
        services: Object.freeze({ event, getApp: () => holo.getApp(), getAuth: () => holo.getAuth() }),
        signal: requestSignal(event),
        tenant: operation === 'profile-read' || operation === 'profile-update'
          ? await options.runtime.resolveTenant?.(event)
          : undefined,
      })
      return nativeResponse(outcome.data, outcome.status, outcome.cookies, outcome.redirectTo)
    } catch (cause) {
      return nativeFailure(cause)
    }
  }))
}

export function createPanelTenantHandler<TActor, TTenant, TResult>(options: CreatePanelOperationHandlerOptions<TActor, TTenant, TResult>): EventHandler {
  const allowed = validateNativeOptions(options)
  const protect = csrfProtection()
  return defineEventHandler(event => runWithNuxtRequest(event, async () => {
    try {
      const method = getMethod(event).toUpperCase()
      if (method !== 'GET' && method !== 'POST') throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      const operation = getRouterParam(event, 'operation')
      if (!TENANT_OPERATIONS.has(operation as PanelTenantOperation)) throw createError({ statusCode: 404, statusMessage: 'Panel tenant operation was not found' })
      if (method === 'GET' && operation !== 'profile-read') throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      const panelId = panelFromEvent(event, allowed)
      const input = await nativePayload(event, method)
      if (method === 'POST') await protect(event)
      const panel = await compiledPanel(event, options, panelId)
      const auth = await holo.getAuth() as unknown as PanelAuthRuntime<object> | undefined
      if (!auth) throw createError({ statusCode: 403, statusMessage: 'Panel tenant context is invalid' })
      const guard = auth.guard(panel.guard)
      const actor = await guard.user()
      if (actor === null) throw createError({ statusCode: 403, statusMessage: 'Panel tenant context is invalid' })
      const scope = Object.freeze({ actor, guard: panel.guard, panelId, provider: await guard.provider(), signal: requestSignal(event) })
      if (!await panel.server.access({ ...scope, operation: 'bootstrap' })) throw new PanelTenantOperationError('not-found')
      const result = await executePanelTenantOperation({ operation: operation as PanelTenantOperation, panel, payload: input, scope })
      return nativeResponse(result.data, result.status)
    } catch (cause) {
      return nativeFailure(cause)
    }
  }))
}

export function createGeneratedNuxtPanelRouteHandler<TActor, TTenant, TResult>(options: CreateNuxtPanelRouteHandlerOptions<TActor, TTenant, TResult>): EventHandler {
  assertPanelId(options.panelId)
  const protect = csrfProtection()
  return defineEventHandler(event => runWithNuxtRequest(event, async () => {
    try {
      const method = getMethod(event).toUpperCase()
      if (!['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].includes(method)) throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
      if (method !== 'GET') await protect(event)
      const webRequest = (event as H3Event & { readonly web?: { readonly request?: Request } }).web?.request
      const headers = new Headers()
      for (const [name, value] of Object.entries(getRequestHeaders(event))) {
        if (typeof value === 'string') headers.set(name, value)
      }
      const body = method === 'GET' ? undefined : await boundedRequestBody(event)
      const requestBody = body ? new Uint8Array(body.byteLength) : undefined
      if (requestBody && body) requestBody.set(body)
      const request = webRequest ?? new Request(getRequestURL(event), { ...(requestBody ? { body: requestBody.buffer } : {}), headers, method })
      const panel = await compiledPanel(event, { panelIds: [options.panelId], runtime: options.runtime }, options.panelId)
      const auth = await holo.getAuth() as unknown as HoloAuth<TActor> | undefined
      if (!auth) throw createError({ statusCode: 401, statusMessage: 'Authentication is unavailable' })
      const response = await executePanelRoute(panel as CompiledPanelDefinition<TActor>, auth, request)
      if (!response) throw createError({ statusCode: 404, statusMessage: 'Panel custom route not found' })
      return response
    } catch (cause) {
      return nativeFailure(cause)
    }
  }))
}
