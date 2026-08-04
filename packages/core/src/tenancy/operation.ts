import type { CompiledPanelDefinition, PanelAuthenticatedScope } from '../panels/contracts'
import type { JsonValue } from '../protocol/json'
import type { PanelTenantIdentity } from './contracts'
import { PanelTenantResolutionError } from './runtime'

export type PanelTenantOperationFailure
  = 'access-denied'
    | 'invalid-context'
    | 'not-found'

export class PanelTenantOperationError extends Error {
  constructor(readonly failure: PanelTenantOperationFailure) {
    super('Tenant could not be resolved')
    this.name = 'PanelTenantOperationError'
  }
}

export interface ExecutePanelTenantSwitchOptions<TActor> {
  readonly panel: CompiledPanelDefinition<TActor>
  readonly payload: unknown
  readonly scope: PanelAuthenticatedScope<TActor>
}

export interface PanelTenantSwitchResult {
  readonly tenant: PanelTenantIdentity
}

export type PanelTenantOperation = 'profile-read' | 'profile-update' | 'register' | 'switch'

export interface ExecutePanelTenantOperationOptions<TActor> extends ExecutePanelTenantSwitchOptions<TActor> {
  readonly operation: PanelTenantOperation
}

export type PanelTenantOperationResult = Readonly<{
  readonly data: JsonValue
  readonly status: 200 | 201
}>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function routeKey(payload: unknown): string {
  if (!isRecord(payload)
    || Object.keys(payload).length !== 1
    || typeof payload.routeKey !== 'string'
    || payload.routeKey.length === 0
    || payload.routeKey.length > 512) {
    throw new PanelTenantOperationError('not-found')
  }
  return payload.routeKey
}

function assertScope<TActor>(
  panel: CompiledPanelDefinition<TActor>,
  scope: PanelAuthenticatedScope<TActor>,
): void {
  if (scope.panelId !== panel.manifest.id || scope.guard !== panel.guard) {
    throw new PanelTenantOperationError('invalid-context')
  }
}

export async function executePanelTenantSwitch<TActor>(
  options: ExecutePanelTenantSwitchOptions<TActor>,
): Promise<PanelTenantSwitchResult> {
  assertScope(options.panel, options.scope)
  const tenancy = options.panel.server.tenancy
  if (!tenancy || options.panel.manifest.tenancy === null) {
    throw new PanelTenantOperationError('not-found')
  }
  try {
    return Object.freeze({ tenant: await tenancy.switch(routeKey(options.payload), options.scope) })
  } catch (error) {
    if (error instanceof PanelTenantResolutionError) {
      throw new PanelTenantOperationError(error.failure)
    }
    throw error
  }
}

export async function executePanelTenantOperation<TActor>(
  options: ExecutePanelTenantOperationOptions<TActor>,
): Promise<PanelTenantOperationResult> {
  assertScope(options.panel, options.scope)
  const tenancy = options.panel.server.tenancy
  if (!tenancy || options.panel.manifest.tenancy === null) throw new PanelTenantOperationError('not-found')
  try {
    if (options.operation === 'switch') {
      const result = await executePanelTenantSwitch(options)
      return Object.freeze({ data: { tenant: { id: result.tenant.id, routeKey: result.tenant.routeKey } }, status: 200 })
    }
    if (options.operation === 'profile-read') {
      if (!isRecord(options.payload) || Object.keys(options.payload).length !== 0 || !tenancy.profileRead) {
        throw new PanelTenantOperationError('not-found')
      }
      return Object.freeze({ data: { profile: await tenancy.profileRead(options.scope) }, status: 200 })
    }
    if (options.operation === 'profile-update') {
      if (!tenancy.profileUpdate) throw new PanelTenantOperationError('not-found')
      return Object.freeze({ data: { profile: await tenancy.profileUpdate(options.payload, options.scope) }, status: 200 })
    }
    if (!tenancy.register) throw new PanelTenantOperationError('not-found')
    const tenant = await tenancy.register(options.payload, options.scope)
    return Object.freeze({ data: { tenant: { id: tenant.id, routeKey: tenant.routeKey } }, status: 201 })
  } catch (error) {
    if (error instanceof PanelTenantResolutionError) throw new PanelTenantOperationError(error.failure)
    throw error
  }
}

export function panelTenantOperationStatus(error: PanelTenantOperationError): 403 | 404 {
  return error.failure === 'not-found' ? 404 : 403
}
