import type { PanelNotificationScope } from '../notifications/contracts'
import type { PanelAuthenticatedScope } from '../panels/contracts'
import type { PanelTenantExecutionContext, PanelTenantIdentifier } from './contracts'

type ReservedTenantContextKeys
  = 'actor'
    | 'cacheKey'
    | 'guard'
    | 'panelId'
    | 'provider'
    | 'scopeTenantQuery'
    | 'signal'
    | 'tenant'
    | 'tenantBindings'
    | 'tenantId'
    | 'tenantRouteKey'

type TenantContextExtension<TExtension extends object> = TExtension & {
  readonly [TKey in ReservedTenantContextKeys]?: never
}

export type BoundPanelTenantContext<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  TExtension extends object,
> = Readonly<PanelAuthenticatedScope<TActor> & PanelTenantExecutionContext<TTenant, TTenantId> & TExtension>

export function bindPanelTenantContext<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  const TExtension extends object,
>(
  context: PanelTenantExecutionContext<TTenant, TTenantId>,
  scope: PanelAuthenticatedScope<TActor>,
  extension: TenantContextExtension<TExtension>,
): BoundPanelTenantContext<TActor, TTenant, TTenantId, TExtension> {
  if (context.guard !== scope.guard || context.panelId !== scope.panelId || context.signal !== scope.signal) {
    throw new TypeError('Tenant and authenticated scopes must belong to the same request')
  }
  return Object.freeze({ ...extension, ...scope, ...context }) as BoundPanelTenantContext<TActor, TTenant, TTenantId, TExtension>
}

export function panelTenantNotificationScope<TTenant, TTenantId extends PanelTenantIdentifier>(
  context: PanelTenantExecutionContext<TTenant, TTenantId>,
  actorId: PanelTenantIdentifier,
): Readonly<PanelNotificationScope> {
  return Object.freeze({
    actorId,
    guard: context.guard,
    panelId: context.panelId,
    tenantId: context.tenantId,
  })
}
