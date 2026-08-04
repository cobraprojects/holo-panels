import { toJsonValue } from '../protocol/serialization'
import type { PanelAuthenticatedScope } from '../panels/contracts'
import type {
  CompiledPanelTenancy,
  PanelQueuedTenantContext,
  PanelTenancyOptions,
  PanelTenantBootstrap,
  PanelTenantExecutionContext,
  PanelTenantIdentifier,
  PanelTenantPresentation,
  PanelTenantPresentationPage,
  PanelTenantPresentationInput,
  PanelTenantScopedQuery,
} from './contracts'
import { PanelTenancyRuntime, PanelTenantResolutionError } from './runtime'

const HTTPS_URL = /^https:\/\//iu
const RESOURCE_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/u

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
}

function optionalText(value: string | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 500 || hasControlCharacter(normalized)) {
    throw new TypeError(`${label} must be bounded printable text`)
  }
  return normalized
}

function avatarUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const candidate = value.trim()
  if (!candidate || candidate.length > 2_048 || candidate.includes('\\') || hasControlCharacter(candidate) || candidate.startsWith('//')) {
    throw new TypeError('Tenant avatar URLs must be safe URLs')
  }
  if (candidate.startsWith('/')) {
    if (candidate.includes('..') || /%(?:2e|2f|5c)/iu.test(candidate)) throw new TypeError('Tenant avatar URLs must be safe URLs')
    return candidate
  }
  if (!HTTPS_URL.test(candidate)) throw new TypeError('Tenant avatar URLs must use an absolute path or HTTPS URL')
  const url = new URL(candidate)
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError('Tenant avatar URLs must be credential-free HTTPS URLs')
  return candidate
}

function presentation(input: PanelTenantPresentationInput, routeKey: string): Readonly<PanelTenantPresentation> {
  const label = optionalText(input.label, 'Tenant labels')
  if (label === null) throw new TypeError('Tenant labels must be bounded printable text')
  const value: PanelTenantPresentation = {
    avatarUrl: avatarUrl(input.avatarUrl),
    description: optionalText(input.description, 'Tenant descriptions'),
    label,
    routeKey,
  }
  toJsonValue(value)
  return Object.freeze(value)
}

export function compilePanelTenancy<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  TModel,
  TRegistrationValues extends Readonly<Record<string, unknown>>,
  TProfileValues extends Readonly<Record<string, unknown>>,
>(options: PanelTenancyOptions<TActor, TTenant, TTenantId, TModel, TRegistrationValues, TProfileValues>): CompiledPanelTenancy<TActor, TTenant, TTenantId> {
  const runtime = new PanelTenancyRuntime(options)
  const resourceTenantColumn = options.resourceTenantColumn ?? 'tenant_id'
  if (!RESOURCE_COLUMN.test(resourceTenantColumn)) throw new TypeError('Tenant resource columns require a safe attribute name')

  function executionContext(
    resolved: Readonly<{ id: TTenantId, routeKey: string, tenant: TTenant }>,
    scope: PanelAuthenticatedScope<TActor>,
  ): PanelTenantExecutionContext<TTenant, TTenantId> {
    const identity = `${typeof resolved.id}:${String(resolved.id)}`
    return Object.freeze({
      cacheKey: `${scope.panelId}:${scope.guard}:${identity}`,
      guard: scope.guard,
      panelId: scope.panelId,
      provider: scope.provider,
      signal: scope.signal,
      tenant: resolved.tenant,
      tenantBindings: Object.freeze({ [resourceTenantColumn]: resolved.id }),
      tenantId: resolved.id,
      tenantRouteKey: resolved.routeKey,
      scopeTenantQuery: <TQuery extends PanelTenantScopedQuery<TQuery>>(query: TQuery): TQuery => query.where(resourceTenantColumn, '=', resolved.id),
    })
  }

  async function present(
    membership: Readonly<{ routeKey: string, tenant: TTenant }>,
    scope: Parameters<CompiledPanelTenancy<TActor>['bootstrap']>[0],
  ): Promise<PanelTenantPresentation> {
    return presentation(await options.present(membership.tenant, scope), membership.routeKey)
  }

  const compiled: CompiledPanelTenancy<TActor, TTenant, TTenantId> = {
    active: async scope => {
      const active = await runtime.active(scope)
      return active === null ? null : Object.freeze({ id: active.id, routeKey: active.routeKey })
    },
    activeContext: async scope => {
      const active = await runtime.active(scope)
      if (active === null) throw new PanelTenantResolutionError('access-denied')
      return executionContext(active, scope)
    },
    bootstrap: async scope => {
      const resolved = await runtime.bootstrap(scope)
      const memberships = await Promise.all(resolved.memberships.map(membership => present(membership, scope)))
      const active = resolved.active === null
        ? null
        : memberships.find(membership => membership.routeKey === resolved.active?.routeKey) ?? null
      return {
        active,
        memberships: {
          memberships,
          nextCursor: resolved.nextCursor,
        },
      } satisfies Readonly<PanelTenantBootstrap>
    },
    clear: scope => runtime.clear(scope),
    memberships: async (request, scope): Promise<PanelTenantPresentationPage> => {
      const resolved = await runtime.memberships(request, scope)
      const memberships = await Promise.all(resolved.tenants.map(membership => present(membership, scope)))
      return { memberships, nextCursor: resolved.nextCursor }
    },
    queuedContext: (tenantId, scope): Promise<Readonly<PanelQueuedTenantContext>> => runtime.queuedContext(tenantId, scope),
    resolveQueued: async (payload, scope) => {
      const tenant = await runtime.resolveQueued(payload, scope)
      return Object.freeze({ id: tenant.id, routeKey: tenant.routeKey })
    },
    resolveQueuedValue: async (payload, scope) => (await runtime.resolveQueued(payload, scope)).tenant,
    queuedContextValue: async (payload, scope) => executionContext(
      await runtime.resolveQueued(payload, scope),
      scope,
    ),
    switch: async (routeKey, scope) => {
      const tenant = await runtime.switch(routeKey, scope)
      return Object.freeze({ id: tenant.id, routeKey: tenant.routeKey })
    },
    ...(options.profile ? {
      profilePath: options.profile.path ?? 'tenant/profile',
      profileRead: async (scope: Parameters<NonNullable<CompiledPanelTenancy<TActor>['profileRead']>>[0]) => {
        const value = toJsonValue(await runtime.profileRead(scope))
        if (value === null || Array.isArray(value) || typeof value !== 'object') throw new TypeError('Tenant profiles must be JSON objects')
        return value
      },
      profileUpdate: async (payload: unknown, scope: Parameters<NonNullable<CompiledPanelTenancy<TActor>['profileUpdate']>>[1]) => {
        const value = toJsonValue(await runtime.profileUpdate(payload, scope))
        if (value === null || Array.isArray(value) || typeof value !== 'object') throw new TypeError('Tenant profiles must be JSON objects')
        return value
      },
    } : {}),
    ...(options.registration ? {
      registrationPath: options.registration.path ?? 'tenant/register',
      register: async (payload: unknown, scope: Parameters<NonNullable<CompiledPanelTenancy<TActor>['register']>>[1]) => {
        const tenant = await runtime.register(payload, scope)
        return Object.freeze({ id: tenant.id, routeKey: tenant.routeKey })
      },
    } : {}),
  }
  return Object.freeze(compiled)
}
