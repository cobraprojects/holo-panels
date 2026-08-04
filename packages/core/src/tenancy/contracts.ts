import type { PanelAuthenticatedScope } from '../panels/contracts'
import type { JsonObject } from '../protocol/json'

export type PanelTenantIdentifier = number | string

export interface PanelActiveTenantPersistence<TActor, TTenantId extends PanelTenantIdentifier> {
  clear(scope: PanelAuthenticatedScope<TActor>): Promise<void>
  load(scope: PanelAuthenticatedScope<TActor>): Promise<TTenantId | null>
  save(scope: PanelAuthenticatedScope<TActor>, tenantId: TTenantId): Promise<void>
}

export interface PanelTenantPresentationInput {
  readonly avatarUrl?: string | null
  readonly description?: string | null
  readonly label: string
}

export interface PanelTenantMembershipRequest {
  readonly cursor: string | null
  readonly limit: number
  readonly search: string
}

export interface PanelTenantMembershipPage<TTenant> {
  readonly nextCursor: string | null
  readonly tenants: readonly TTenant[]
}

export interface PanelTenantRegistrationOptions<TActor, TTenant, TValues extends Readonly<Record<string, unknown>>> {
  readonly create: (values: NoInfer<TValues>, scope: PanelAuthenticatedScope<TActor>) => TTenant | Promise<TTenant>
  readonly path?: string
  readonly validate: (payload: unknown, scope: PanelAuthenticatedScope<TActor>) => TValues | Promise<TValues>
}

export interface PanelTenantProfileOptions<TActor, TTenant, TValues extends Readonly<Record<string, unknown>>> {
  readonly path?: string
  readonly read: (tenant: TTenant, scope: PanelAuthenticatedScope<TActor>) => TValues | Promise<TValues>
  readonly update: (tenant: TTenant, values: NoInfer<TValues>, scope: PanelAuthenticatedScope<TActor>) => TTenant | Promise<TTenant>
  readonly validate: (payload: unknown, tenant: TTenant, scope: PanelAuthenticatedScope<TActor>) => TValues | Promise<TValues>
}

export interface PanelTenancyOptions<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  TModel,
  TRegistrationValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
  TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
> {
  readonly authorize: (
    tenant: TTenant,
    scope: PanelAuthenticatedScope<TActor>,
  ) => boolean | Promise<boolean>
  readonly identify: (tenant: TTenant) => TTenantId
  readonly findMembershipById: (
    tenantId: TTenantId,
    scope: PanelAuthenticatedScope<TActor>,
  ) => TTenant | null | Promise<TTenant | null>
  readonly findMembershipByRouteKey: (
    routeKey: string,
    scope: PanelAuthenticatedScope<TActor>,
  ) => TTenant | null | Promise<TTenant | null>
  readonly membershipPageSize?: number
  readonly memberships: (
    request: PanelTenantMembershipRequest,
    scope: PanelAuthenticatedScope<TActor>,
  ) => PanelTenantMembershipPage<TTenant> | Promise<PanelTenantMembershipPage<TTenant>>
  readonly model: TModel
  readonly persistence: PanelActiveTenantPersistence<TActor, TTenantId>
  readonly present: (
    tenant: TTenant,
    scope: PanelAuthenticatedScope<TActor>,
  ) => PanelTenantPresentationInput | Promise<PanelTenantPresentationInput>
  readonly profile?: PanelTenantProfileOptions<TActor, TTenant, TProfileValues>
  readonly registration?: PanelTenantRegistrationOptions<TActor, TTenant, TRegistrationValues>
  readonly resourceTenantColumn?: string
  readonly routeKey: (tenant: TTenant) => string
}

export interface PanelResolvedTenant<TTenant, TTenantId extends PanelTenantIdentifier> {
  readonly id: TTenantId
  readonly routeKey: string
  readonly tenant: TTenant
}

export interface PanelQueuedTenantContext {
  readonly guard: string
  readonly panelId: string
  readonly tenantId: PanelTenantIdentifier
  readonly tenantIdType: 'number' | 'string'
  readonly version: 1
}

export interface PanelTenancyManifest {
  readonly enabled: true
  readonly profile?: { readonly path: string }
  readonly registration?: { readonly path: string }
}

export interface PanelTenantPresentation extends JsonObject {
  avatarUrl: string | null
  description: string | null
  label: string
  routeKey: string
}

export interface PanelTenantPresentationPage extends JsonObject {
  memberships: PanelTenantPresentation[]
  nextCursor: string | null
}

export interface PanelTenantBootstrap {
  readonly active: PanelTenantPresentation | null
  readonly memberships: PanelTenantPresentationPage
}

export interface PanelTenantIdentity {
  readonly id: PanelTenantIdentifier
  readonly routeKey: string
}

export interface PanelTenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: PanelTenantIdentifier): TQuery
}

export interface PanelTenantExecutionContext<TTenant, TTenantId extends PanelTenantIdentifier> {
  readonly cacheKey: string
  readonly guard: string
  readonly panelId: string
  readonly provider: string | null
  readonly signal: AbortSignal
  readonly tenant: TTenant
  readonly tenantBindings: Readonly<Record<string, TTenantId>>
  readonly tenantId: TTenantId
  readonly tenantRouteKey: string
  scopeTenantQuery<TQuery extends PanelTenantScopedQuery<TQuery>>(query: TQuery): TQuery
}

export interface CompiledPanelTenancy<
  TActor,
  TTenant = unknown,
  TTenantId extends PanelTenantIdentifier = PanelTenantIdentifier,
> {
  active(scope: PanelAuthenticatedScope<TActor>): Promise<PanelTenantIdentity | null>
  activeContext(
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantExecutionContext<TTenant, TTenantId>>
  bootstrap(scope: PanelAuthenticatedScope<TActor>): Promise<PanelTenantBootstrap>
  clear(scope: PanelAuthenticatedScope<TActor>): Promise<void>
  memberships(
    request: Partial<PanelTenantMembershipRequest>,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantPresentationPage>
  readonly profileRead?: (scope: PanelAuthenticatedScope<TActor>) => Promise<JsonObject>
  readonly profilePath?: string
  readonly profileUpdate?: (payload: unknown, scope: PanelAuthenticatedScope<TActor>) => Promise<JsonObject>
  queuedContext(
    tenantId: PanelTenantIdentifier,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelQueuedTenantContext>
  resolveQueued(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
  resolveQueuedValue(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<TTenant>
  readonly register?: (payload: unknown, scope: PanelAuthenticatedScope<TActor>) => Promise<PanelTenantIdentity>
  readonly registrationPath?: string
  queuedContextValue(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantExecutionContext<TTenant, TTenantId>>
  switch(
    routeKey: string,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
}
