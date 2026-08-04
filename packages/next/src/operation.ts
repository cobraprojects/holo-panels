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
} from '@holo-js/panels-react/server'
import type {
  CreatePanelOperationRouteOptions,
  NextPanelOperationResult,
  NextPanelRouteContext,
} from './contracts'
import { nextPanelsRuntimeInternals, requireNextPanelsRuntime } from './runtime'

const OPERATIONS = new Set<PanelOperation>(['action', 'bootstrap', 'form-submit', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload'])
const MAX_REQUEST_BYTES = 1_048_576
const MAX_RESPONSE_BYTES = 4_194_304
const RESPONSE_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })

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

function failure(id: string, error: unknown, explicitStatus?: number): Response {
  const status = explicitStatus ?? statusFor(error)
  const normalizedError = normalizeTransportError(error, status)
  const envelope: ResponseEnvelope = {
    effects: error instanceof ActionExecutionError ? [...error.effects] : [],
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
  if (error instanceof NextPanelHttpError) return error.status
  if (error instanceof PanelNotificationRequestError) return 400
  if (error instanceof PanelNotificationAccessError) return 403
  if (error instanceof TransportDecodingError) return 400
  if (error instanceof PanelRuntimeError) {
    if (error.code === 'unauthenticated') return 401
    if (error.code === 'access-denied') return 403
    if (error.code === 'panel-not-found') return 404
  }
  return undefined
}

function operation(value: string): PanelOperation {
  if (!OPERATIONS.has(value as PanelOperation)) throw new NextPanelHttpError(404, 'Panel operation was not found')
  return value as PanelOperation
}

async function boundRequest(request: Request): Promise<Request> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) throw new NextPanelHttpError(413, 'Panel operation request is too large')
  if (!request.body) throw new TransportDecodingError('Missing transport request body.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > MAX_REQUEST_BYTES) {
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

async function handle(request: Request, context: NextPanelRouteContext, options: CreatePanelOperationRouteOptions): Promise<Response> {
  let requestId = requestIdFromFailure(request)
  try {
    if (request.method !== 'POST') throw new NextPanelHttpError(405, 'Panel operation routes require POST')
    const parameters = await context.params
    if (!options.panelIds.includes(parameters.panelId)) throw new NextPanelHttpError(404, 'Panel was not found')
    const selectedOperation = operation(parameters.operation)
    request = await boundRequest(request)
    const nextContext = createNextRequestContext(request)
    return await runWithNextRequest(nextContext, async () => {
      const csrfResponse = await csrfProtection()(request.clone())
      if (csrfResponse) return failure(requestId, new NextPanelHttpError(csrfResponse.status, 'Panel request security validation failed'), csrfResponse.status)
      const decoded = await decodeRequest(request.clone())
      requestId = decoded.envelope.id
      if (decoded.envelope.panelId !== parameters.panelId || decoded.envelope.operation !== selectedOperation) {
        throw new NextPanelHttpError(400, 'Panel request envelope does not match its fixed route')
      }
      const runtime = requireNextPanelsRuntime(options.runtime)
      const panelEntries = await nextPanelsRuntimeInternals.definitions(runtime, parameters.panelId, 'panel')
      const panel = panelEntries.find(candidate => candidate.manifest.id === parameters.panelId)
      if (!panel) throw new NextPanelHttpError(404, 'Panel was not found')
      const auth = typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
      const panelRuntime = new PanelRuntime(auth, [panel])
      if (selectedOperation === 'bootstrap') {
        return success(requestId, { data: toJsonValue((await panelRuntime.bootstrap([parameters.panelId], request.signal))[0]) }).response
      }
      if (!runtime.execute) throw new NextPanelHttpError(501, `Panel operation "${selectedOperation}" has no registered executor`)
      return panelRuntime.execute(parameters.panelId, selectedOperation, request.signal, async scope => {
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
            tenant: await runtime.resolveTenant?.(request),
          },
        })
        const succeeded = success(requestId, result)
        await flashRedirectToasts(auth.guard(panel.guard), parameters.panelId, succeeded.effects)
        return succeeded.response
      })
    })
  } catch (error) {
    return failure(requestId, error)
  }
}

export function createPanelOperationRoute(options: CreatePanelOperationRouteOptions) {
  const uniqueIds = new Set(options.panelIds)
  if (uniqueIds.size !== options.panelIds.length || [...uniqueIds].some(id => !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(id))) {
    throw new Error('Panel operation routes require unique stable panel IDs')
  }
  return Object.freeze({
    GET: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
    POST: (request: Request, context: NextPanelRouteContext) => handle(request, context, options),
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
