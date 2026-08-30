import { createNextRequestContext, runWithNextRequest } from '@holo-js/adapter-next/runtime'
import { csrfProtection } from '@holo-js/security/next/server'
import {
  AuthControllerError,
  executePanelAuthOperation,
  executePanelTenantOperation,
  PanelTenantOperationError,
  panelAuthOperationStatus,
  panelTenantOperationStatus,
  requestedLocales,
  type PanelAuthRuntime,
  type PanelAuthOperation,
  type PanelTenantOperation,
} from '@holo-js/panels-react/server'
import { toJsonValue } from '@holo-js/panels-react'
import type {
  CreatePanelAuthRouteOptions,
  CreatePanelTenantRouteOptions,
  NextPanelsRuntime,
  NextRouteHandler,
} from './contracts'
import { nextPanelOperationInternals, NextPanelHttpError } from './operation'
import { nextPanelsRuntimeInternals, requireNextPanelsRuntime } from './runtime'

const AUTH_OPERATIONS = new Set<PanelAuthOperation>([
  'email-verification-resend',
  'email-verification-verify',
  'login',
  'logout',
  'mfa-challenge',
  'mfa-disable',
  'mfa-enrollment-begin',
  'mfa-enrollment-confirm',
  'mfa-recovery',
  'mfa-recovery-codes-regenerate',
  'mfa-status',
  'password-reset-request',
  'password-reset',
  'presentation',
  'profile-read',
  'profile-update',
  'registration',
])
const GET_AUTH_OPERATIONS = new Set<PanelAuthOperation>(['mfa-enrollment-begin', 'mfa-status', 'presentation', 'profile-read'])
const TENANT_AWARE_AUTH_OPERATIONS = new Set<PanelAuthOperation>(['profile-read', 'profile-update'])
const TENANT_OPERATIONS = new Set<PanelTenantOperation>(['profile-read', 'profile-update', 'register', 'switch'])
const JSON_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })

function allowedPanelIds(panelIds: readonly string[]): ReadonlySet<string> {
  const allowed = new Set(panelIds)
  if (allowed.size !== panelIds.length || panelIds.length === 0 || [...allowed].some(id => !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(id))) {
    throw new Error('Panel auth and tenant routes require unique stable panel IDs')
  }
  return allowed
}

async function runtimePanel(runtime: NextPanelsRuntime, panelId: string) {
  const definitions = await nextPanelsRuntimeInternals.definitions(runtime, panelId, 'panel')
  const panel = definitions.find(candidate => candidate.manifest.id === panelId)
  if (!panel) throw new NextPanelHttpError(404, 'Panel was not found')
  return panel as unknown as Parameters<typeof executePanelAuthOperation>[0]['panel']
}

async function payload(request: Request): Promise<unknown> {
  if (request.method === 'GET') return {}
  const bounded = await nextPanelOperationInternals.boundRequest(request)
  const contentType = bounded.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new NextPanelHttpError(400, 'Panel auth requests require application/json')
  try {
    return await bounded.json()
  } catch {
    throw new NextPanelHttpError(400, 'Panel auth request contains invalid JSON')
  }
}

function response(data: unknown, status: number, cookies: readonly string[] = [], redirectTo: string | null = null): Response {
  const headers = new Headers(JSON_HEADERS)
  if (redirectTo !== null) headers.set('location', redirectTo)
  const result = new Response(status === 204 ? null : JSON.stringify(toJsonValue(data)), { headers, status })
  for (const cookie of cookies) result.headers.append('set-cookie', cookie)
  return result
}

function failure(error: unknown): Response {
  if (error instanceof AuthControllerError) return response({ code: error.code, error: 'Panel authentication request failed.' }, panelAuthOperationStatus(error))
  if (error instanceof PanelTenantOperationError) return response({ error: 'Tenant was not found.' }, panelTenantOperationStatus(error))
  if (error instanceof NextPanelHttpError) return response({ error: error.status >= 500 ? 'Panel request failed.' : error.message }, error.status)
  return response({ error: 'Panel request failed.' }, 500)
}

async function resolvedAuth(runtime: NextPanelsRuntime) {
  const auth = typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
  return auth as unknown as PanelAuthRuntime<object>
}

async function authTenant(runtime: NextPanelsRuntime, operation: PanelAuthOperation, request: Request): Promise<unknown> {
  if (!TENANT_AWARE_AUTH_OPERATIONS.has(operation)) return undefined
  return runtime.resolveTenant?.(request)
}

async function protectMutation(request: Request): Promise<Response | null> {
  if (request.method !== 'POST') return null
  const csrfResponse = await csrfProtection()(request.clone())
  return csrfResponse ? response({ error: 'Panel request security validation failed.' }, csrfResponse.status) : null
}

export function createPanelAuthRoute(options: CreatePanelAuthRouteOptions): { readonly GET: NextRouteHandler, readonly POST: NextRouteHandler } {
  const allowed = allowedPanelIds(options.panelIds)
  const handle: NextRouteHandler = async (request, context) => {
    try {
      if (request.method !== 'GET' && request.method !== 'POST') throw new NextPanelHttpError(405, 'Method Not Allowed')
      const parameters = await context.params
      if (!allowed.has(parameters.panelId)) throw new NextPanelHttpError(404, 'Panel was not found')
      if (!AUTH_OPERATIONS.has(parameters.operation as PanelAuthOperation)) throw new NextPanelHttpError(404, 'Panel authentication operation was not found')
      const operation = parameters.operation as PanelAuthOperation
      if (request.method === 'GET' && !GET_AUTH_OPERATIONS.has(operation)) throw new NextPanelHttpError(405, 'Method Not Allowed')
      const securityFailure = await protectMutation(request)
      if (securityFailure) return securityFailure
      const nextContext = createNextRequestContext(request)
      return await runWithNextRequest(nextContext, async () => {
        const runtime = requireNextPanelsRuntime(options.runtime)
        const outcome = await executePanelAuthOperation({
          auth: await resolvedAuth(runtime),
          operation,
          panel: await runtimePanel(runtime, parameters.panelId),
          payload: await payload(request),
          requestedLocale: await runtime.resolveLocale?.(request) ?? requestedLocales(request.headers.get('accept-language'))[0],
          services: await runtime.resolveServices?.(request),
          signal: request.signal,
          tenant: await authTenant(runtime, operation, request),
        })
        return response(outcome.data, outcome.status, outcome.cookies, outcome.redirectTo)
      })
    } catch (error) {
      return failure(error)
    }
  }
  return Object.freeze({ GET: handle, POST: handle })
}

export function createPanelTenantRoute(options: CreatePanelTenantRouteOptions): { readonly GET: NextRouteHandler, readonly POST: NextRouteHandler } {
  const allowed = allowedPanelIds(options.panelIds)
  const handle: NextRouteHandler = async (request, context) => {
    try {
      if (request.method !== 'GET' && request.method !== 'POST') throw new NextPanelHttpError(405, 'Method Not Allowed')
      const parameters = await context.params
      if (!allowed.has(parameters.panelId)) throw new NextPanelHttpError(404, 'Panel was not found')
      if (!TENANT_OPERATIONS.has(parameters.operation as PanelTenantOperation)) throw new NextPanelHttpError(404, 'Panel tenant operation was not found')
      const operation = parameters.operation as PanelTenantOperation
      if (request.method === 'GET' && operation !== 'profile-read') throw new NextPanelHttpError(405, 'Method Not Allowed')
      const securityFailure = await protectMutation(request)
      if (securityFailure) return securityFailure
      return await runWithNextRequest(createNextRequestContext(request), async () => {
        const runtime = requireNextPanelsRuntime(options.runtime)
        const panel = await runtimePanel(runtime, parameters.panelId)
        const auth = await resolvedAuth(runtime)
        const guard = auth.guard(panel.guard)
        const actor = await guard.user()
        if (actor === null) throw new NextPanelHttpError(403, 'Panel tenant context is invalid')
        const provider = await guard.provider()
        const scope = Object.freeze({ actor, guard: panel.guard, panelId: parameters.panelId, provider, signal: request.signal })
        if (!await panel.server.access({ ...scope, operation: 'bootstrap' })) throw new PanelTenantOperationError('not-found')
        const result = await executePanelTenantOperation({ operation, panel, payload: await payload(request), scope })
        return response(result.data, result.status)
      })
    } catch (error) {
      return failure(error)
    }
  }
  return Object.freeze({ GET: handle, POST: handle })
}
