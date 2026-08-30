import { createNextRequestContext, runWithNextRequest } from '@holo-js/adapter-next/runtime'
import { csrfProtection } from '@holo-js/security/next/server'
import {
  decodeResponseEnvelope,
  normalizeTransportError,
  PROTOCOL_VERSION,
  toJsonValue,
  TRANSPORT_REQUEST_FIELD,
  TransportDecodingError,
  type JsonObject,
  type CompiledPanelDefinition,
  type Effect,
  type PanelOperation,
  type ResponseEnvelope,
} from '@holo-js/panels-react'
import {
  ActionExecutionError,
  PanelNotificationAccessError,
  PanelNotificationRequestError,
  PanelRuntime,
  PanelRuntimeError,
  decodeTransportServerRequest,
  executePanelRoute,
  panelErrorNotificationEffect,
  takePanelNotificationEffects,
} from '@holo-js/panels-react/server'
import type {
  CreatePanelOperationRouteOptions,
  NextPanelOperationResult,
  NextPanelRouteContext,
  NextPanelsRuntime,
} from './contracts'
import { nextPanelsRuntimeInternals, requireNextPanelsRuntime } from './runtime'

const OPERATIONS = new Set<PanelOperation>(['action', 'bootstrap', 'form-submit', 'global-search', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload'])
const MAX_REQUEST_BYTES = 1_048_576
const MAX_UPLOAD_REQUEST_BYTES = 67_108_864
const MAX_RESPONSE_BYTES = 4_194_304
const RESPONSE_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })

type NextTenantScopedQuery<TQuery> = TQuery & {
  where(column: string, operator: '=', value: number | string): NextTenantScopedQuery<TQuery>
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

function success(id: string, result: NextPanelOperationResult): { readonly effects: readonly Effect[], readonly response: Response } {
  const status = result.status ?? 200
  if (!Number.isInteger(status) || status < 200 || status > 299) throw new NextPanelHttpError(500, 'Panel operation returned an invalid success status')
  const data = toJsonValue(result.data ?? null)
  const envelope: ResponseEnvelope = {
    data,
    effects: [...(result.effects ?? [])],
    id,
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
  }
  const validated = decodeResponseEnvelope(envelope, id)
  const response = envelopeResponse(validated, status)
  return { effects: response.status === 500 ? [] : validated.effects, response }
}

function sessionEffectKey(panelId: string): string {
  return `panels.effects.${panelId}`
}

async function flashRedirectToasts(
  guard: { readonly flash?: (key: string, value: unknown) => Promise<void> },
  panelId: string,
  effects: readonly Effect[],
): Promise<void> {
  if (!effects.some(effect => effect.kind === 'redirect')) return
  const toasts = effects.filter(effect => effect.kind === 'toast')
  if (toasts.length === 0) return
  if (!('flash' in guard) || typeof guard.flash !== 'function') return
  try {
    await guard.flash(sessionEffectKey(panelId), toasts)
  } catch {
    return
  }
}

function failure(id: string, error: unknown, explicitStatus?: number, panel?: CompiledPanelDefinition<object>): Response {
  const status = explicitStatus ?? statusFor(error)
  const normalizedError = normalizeTransportError(error, status)
  const actionEffects = error instanceof ActionExecutionError ? [...error.effects] : []
  const notification = panel && actionEffects.length === 0 ? panelErrorNotificationEffect(panel, status ?? 500) : null
  const envelope: ResponseEnvelope = {
    effects: notification ? [...actionEffects, notification] : actionEffects,
    error: normalizedError,
    id,
    ok: false,
    protocolVersion: PROTOCOL_VERSION,
  }
  try {
    return envelopeResponse(decodeResponseEnvelope(envelope, id), status ?? 500)
  } catch {
    return envelopeResponse({ ...envelope, effects: [] }, status ?? 500)
  }
}

function statusFor(error: unknown): number | undefined {
  if (error instanceof ActionExecutionError) return error.status
  const name = error instanceof Error ? error.name : ''
  if (name === 'ValidationException') return 422
  if (error instanceof NextPanelHttpError) return error.status
  if (error instanceof PanelNotificationRequestError) return 400
  if (error instanceof PanelNotificationAccessError) return 403
  if (error instanceof TransportDecodingError) return 400
  if (error instanceof PanelRuntimeError) {
    if (error.code === 'unauthenticated') return 401
    if (error.code === 'access-denied') return 403
    if (error.code === 'panel-not-found') return 404
  }
  if (name === 'ResourceRecordNotFoundError' || name === 'RelationRecordNotFoundError') return 404
  if (name === 'ResourceInputError' || name === 'RelationInputError' || name === 'RelationPivotInputError' || name === 'RelationListPaginationError') return 422
  if (name === 'RelationOperationNotAllowedError') return 403
  return undefined
}

function operation(value: string): PanelOperation {
  if (!OPERATIONS.has(value as PanelOperation)) throw new NextPanelHttpError(404, 'Panel operation was not found')
  return value as PanelOperation
}

async function boundRequest(request: Request, maximumBytes = MAX_REQUEST_BYTES): Promise<Request> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new NextPanelHttpError(413, 'Panel operation request is too large')
  if (!request.body) throw new TransportDecodingError('Missing transport request body.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > maximumBytes) {
      await reader.cancel()
      throw new NextPanelHttpError(413, 'Panel operation request is too large')
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Request(request.url, { body: bytes, headers: request.headers, method: request.method, signal: request.signal })
}

async function decodeRequest(request: Request) {
  const formData = await request.formData()
  const encoded = formData.get(TRANSPORT_REQUEST_FIELD)
  if (typeof encoded === 'string' && new TextEncoder().encode(encoded).byteLength > MAX_REQUEST_BYTES) {
    throw new NextPanelHttpError(413, 'Panel operation request is too large')
  }
  return decodeTransportServerRequest<JsonObject>({ headers: request.headers, formData: async () => formData })
}

function requestIdFromFailure(request: Request): string {
  return request.headers.get('x-request-id')?.trim().slice(0, 128) || 'invalid-request'
}

async function handle<TRuntime>(request: Request, context: NextPanelRouteContext, options: CreatePanelOperationRouteOptions<TRuntime>): Promise<Response> {
  let requestId = requestIdFromFailure(request)
  let configuredPanel: CompiledPanelDefinition<object> | undefined
  try {
    const parameters = await context.params
    if (!options.panelIds.includes(parameters.panelId)) throw new NextPanelHttpError(404, 'Panel was not found')
    if (parameters.operation === 'custom-route') {
      const runtime = requireNextPanelsRuntime(options.runtime as NextPanelsRuntime | undefined)
      const panelEntries = await nextPanelsRuntimeInternals.definitions(runtime, parameters.panelId, 'panel')
      const discoveredPanel = panelEntries.find(candidate => candidate.manifest.id === parameters.panelId)
      if (!discoveredPanel) throw new NextPanelHttpError(404, 'Panel was not found')
      configuredPanel = discoveredPanel
      const pages = await nextPanelsRuntimeInternals.definitions(runtime, parameters.panelId, 'page')
      const panel = nextPanelsRuntimeInternals.panelWithDiscoveredNavigation(discoveredPanel, pages)
      const rewrittenUrl = new URL(request.url)
      const panelRoute = rewrittenUrl.searchParams.get('panelRoute')
      if (!panelRoute?.startsWith('/')) throw new NextPanelHttpError(400, 'Panel custom routes require their generated source path')
      rewrittenUrl.pathname = panelRoute
      rewrittenUrl.searchParams.delete('panelRoute')
      const routedRequest = new Request(rewrittenUrl, request)
      const nextContext = createNextRequestContext(routedRequest)
      return await runWithNextRequest(nextContext, async () => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const csrfResponse = await csrfProtection()(routedRequest.clone())
          if (csrfResponse) return csrfResponse
        }
        const auth = typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
        const response = await executePanelRoute(panel, auth, routedRequest)
        if (!response) throw new NextPanelHttpError(404, 'Panel custom route was not found')
        return response
      })
    }
    if (request.method !== 'POST') throw new NextPanelHttpError(405, 'Panel operation routes require POST')
    const selectedOperation = operation(parameters.operation)
    request = await boundRequest(request, selectedOperation === 'upload' ? MAX_UPLOAD_REQUEST_BYTES : MAX_REQUEST_BYTES)
    const nextContext = createNextRequestContext(request)
    return await runWithNextRequest(nextContext, async () => {
      const csrfResponse = await csrfProtection()(request.clone())
      if (csrfResponse) return failure(requestId, new NextPanelHttpError(csrfResponse.status, 'Panel request security validation failed'), csrfResponse.status)
      const decoded = await decodeRequest(request.clone())
      requestId = decoded.envelope.id
      if (decoded.envelope.panelId !== parameters.panelId || decoded.envelope.operation !== selectedOperation) {
        throw new NextPanelHttpError(400, 'Panel request envelope does not match its fixed route')
      }
      const runtime = requireNextPanelsRuntime(options.runtime as NextPanelsRuntime | undefined)
      const panelEntries = await nextPanelsRuntimeInternals.definitions(runtime, parameters.panelId, 'panel')
      const discoveredPanel = panelEntries.find(candidate => candidate.manifest.id === parameters.panelId)
      if (!discoveredPanel) throw new NextPanelHttpError(404, 'Panel was not found')
      configuredPanel = discoveredPanel
      if (!nextPanelsRuntimeInternals.panelAcceptsHost(discoveredPanel, request)) throw new NextPanelHttpError(404, 'Panel was not found')
      const pages = await nextPanelsRuntimeInternals.definitions(runtime, parameters.panelId, 'page')
      const panel = nextPanelsRuntimeInternals.panelWithDiscoveredNavigation(discoveredPanel, pages)
      const auth = typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
      const panelRuntime = new PanelRuntime(auth, [panel])
      if (selectedOperation === 'bootstrap') {
        const locale = await runtime.resolveLocale?.(request) ?? request.headers.get('accept-language')?.split(',')[0]?.trim() ?? 'en'
        return success(requestId, { data: toJsonValue((await panelRuntime.bootstrap([parameters.panelId], request.signal, locale))[0]) }).response
      }
      if (!runtime.execute) throw new NextPanelHttpError(501, `Panel operation "${selectedOperation}" has no registered executor`)
      return panelRuntime.execute(parameters.panelId, selectedOperation, request.signal, async scope => {
        const tenantContext = runtime.resolveTenant || !panel.server.tenancy ? undefined : await panel.server.tenancy.activeContext(scope)
        const result = await runtime.execute!({
          operation: selectedOperation,
          panelId: parameters.panelId,
          payload: decoded.envelope.payload,
          request,
          scope: {
            actor: scope.actor,
            locale: await runtime.resolveLocale?.(request) ?? 'en',
            panelId: parameters.panelId,
            parameters: {},
            provider: scope.provider,
            request,
            services: await runtime.resolveServices?.(request),
            signal: request.signal,
            tenant: runtime.resolveTenant ? await runtime.resolveTenant(request) : tenantContext?.tenantId,
            ...(tenantContext ? {
              scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenantContext.scopeTenantQuery(query as NextTenantScopedQuery<TQuery>) as TQuery,
              tenantBindings: tenantContext.tenantBindings,
            } : {}),
          },
        })
        const succeeded = success(requestId, { ...result, effects: [...(result.effects ?? []), ...takePanelNotificationEffects()] })
        await flashRedirectToasts(auth.guard(panel.guard), parameters.panelId, succeeded.effects)
        return succeeded.response
      })
    })
  } catch (error) {
    return failure(requestId, error, undefined, configuredPanel)
  }
}

export function createPanelOperationRoute<TRuntime>(options: CreatePanelOperationRouteOptions<TRuntime>) {
  const uniqueIds = new Set(options.panelIds)
  if (uniqueIds.size !== options.panelIds.length || [...uniqueIds].some(id => !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(id))) {
    throw new Error('Panel operation routes require unique stable panel IDs')
  }
  return Object.freeze({
    DELETE: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
    GET: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
    PATCH: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
    POST: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
    PUT: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
  })
}

export class NextPanelHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'NextPanelHttpError'
  }
}

export const nextPanelOperationInternals = {
  MAX_REQUEST_BYTES,
  boundRequest,
  decodeRequest,
}
