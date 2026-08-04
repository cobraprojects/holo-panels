import { describe, expect, expectTypeOf, it } from 'vitest'
import type { PanelAuthenticatedScope } from '../src/panels/contracts'
import { compilePanelTenancy } from '../src/tenancy/compiled'
import type { PanelActiveTenantPersistence } from '../src/tenancy/contracts'
import { bindPanelTenantContext, panelTenantNotificationScope } from '../src/tenancy/propagation'
import { PanelTenancyRuntime, PanelTenantResolutionError } from '../src/tenancy/runtime'

interface Actor {
  readonly id: string
}

interface Tenant {
  readonly id: string
  readonly members: ReadonlySet<string>
  readonly slug: string
}

function scope(actorId = 'actor-1', panelId = 'admin', guard = 'web'): PanelAuthenticatedScope<Actor> {
  return {
    actor: { id: actorId },
    guard,
    panelId,
    provider: 'users',
    signal: new AbortController().signal,
  }
}

function tenancy(
  tenants: Tenant[],
  persisted: { value: string | null } = { value: null },
  deniedTenantIds: ReadonlySet<string> = new Set(),
) {
  const persistence: PanelActiveTenantPersistence<Actor, string> = {
    clear: async () => {
      persisted.value = null
    },
    load: async () => persisted.value,
    save: async (_scope, tenantId) => {
      persisted.value = tenantId
    },
  }
  const options = {
    authorize: (tenant: Tenant, currentScope: PanelAuthenticatedScope<Actor>) => tenant.members.has(currentScope.actor.id) && !deniedTenantIds.has(tenant.id),
    findMembershipById: (tenantId: string, currentScope: PanelAuthenticatedScope<Actor>) => tenants.find(tenant => tenant.id === tenantId && tenant.members.has(currentScope.actor.id)) ?? null,
    findMembershipByRouteKey: (routeKey: string, currentScope: PanelAuthenticatedScope<Actor>) => tenants.find(tenant => tenant.slug === routeKey && tenant.members.has(currentScope.actor.id)) ?? null,
    identify: (tenant: Tenant) => tenant.id,
    memberships: (_request: Parameters<PanelTenancyRuntime<Actor, Tenant, string, Readonly<{ name: string }>>['memberships']>[0], currentScope: PanelAuthenticatedScope<Actor>) => ({
      nextCursor: null,
      tenants: tenants.filter(tenant => tenant.members.has(currentScope.actor.id)),
    }),
    model: { name: 'Tenant' },
    persistence,
    present: (tenant: Tenant) => ({ label: tenant.slug }),
    resourceTenantColumn: 'tenantId',
    routeKey: (tenant: Tenant) => tenant.slug,
  } as const
  return {
    compiled: compilePanelTenancy(options),
    persisted,
    runtime: new PanelTenancyRuntime(options),
  }
}

function expectResolutionFailure(error: unknown, failure: PanelTenantResolutionError['failure']): boolean {
  expect(error).toBeInstanceOf(PanelTenantResolutionError)
  expect((error as PanelTenantResolutionError).failure).toBe(failure)
  expect((error as Error).message).toBe('Tenant could not be resolved')
  return true
}

describe('P14-D tenant security runtime', () => {
  it('returns the same not-found result for guessed, malformed, and unauthorized route keys', async () => {
    const { runtime } = tenancy([
      { id: 'tenant-1', members: new Set(['actor-1']), slug: 'acme' },
      { id: 'tenant-2', members: new Set(['actor-2']), slug: 'secret' },
      { id: 'tenant-3', members: new Set(['actor-1']), slug: 'suspended' },
    ], { value: null }, new Set(['tenant-3']))

    await expect(runtime.switch('missing', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
    await expect(runtime.switch('../secret', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
    await expect(runtime.switch('secret', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
    await expect(runtime.switch('suspended', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
  })

  it('rechecks membership and access after membership revocation', async () => {
    const members = new Set(['actor-1'])
    const { runtime } = tenancy([{ id: 'tenant-1', members, slug: 'acme' }])
    expect((await runtime.switch('acme', scope())).id).toBe('tenant-1')

    members.delete('actor-1')

    await expect(runtime.switch('acme', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
  })

  it('clears a stale active tenant instead of treating persistence as authorization', async () => {
    const members = new Set(['actor-1'])
    const persisted = { value: 'tenant-1' }
    const { runtime } = tenancy([{ id: 'tenant-1', members, slug: 'acme' }], persisted)
    expect((await runtime.active(scope()))?.id).toBe('tenant-1')

    members.clear()

    await expect(runtime.active(scope())).resolves.toBeNull()
    expect(persisted.value).toBeNull()
  })

  it('persists only a tenant selected from current authorized memberships', async () => {
    const persisted = { value: null as string | null }
    const { runtime } = tenancy([
      { id: 'tenant-1', members: new Set(['actor-1']), slug: 'acme' },
      { id: 'tenant-2', members: new Set(['actor-2']), slug: 'secret' },
    ], persisted)

    await expect(runtime.switch('secret', scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'not-found'))
    expect(persisted.value).toBeNull()
    await expect(runtime.switch('acme', scope())).resolves.toMatchObject({ id: 'tenant-1' })
    expect(persisted.value).toBe('tenant-1')
  })

  it('binds queued contexts to panel, guard, identifier type, and current membership', async () => {
    const members = new Set(['actor-1'])
    const { runtime } = tenancy([{ id: '1', members, slug: 'acme' }])
    const queued = await runtime.queuedContext('1', scope())

    await expect(runtime.resolveQueued(queued, scope('actor-1', 'vendor'))).rejects.toSatisfy(error => expectResolutionFailure(error, 'invalid-context'))
    await expect(runtime.resolveQueued(queued, scope('actor-1', 'admin', 'admin'))).rejects.toSatisfy(error => expectResolutionFailure(error, 'invalid-context'))
    await expect(runtime.resolveQueued({ ...queued, tenantIdType: 'number' }, scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'invalid-context'))

    members.clear()

    await expect(runtime.resolveQueued(queued, scope())).rejects.toSatisfy(error => expectResolutionFailure(error, 'access-denied'))
  })

  it('infers an active tenant execution context and automatically scopes resources and caches', async () => {
    const persisted = { value: 'tenant-1' }
    const tenant = { id: 'tenant-1', members: new Set(['actor-1']), slug: 'acme' }
    const { compiled } = tenancy([tenant], persisted)
    const context = await compiled.activeContext(scope())
    const where = { column: '', value: '' }
    const query = {
      where(column: string, _operator: '=', value: string) {
        where.column = column
        where.value = value
        return this
      },
    }

    expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
    expectTypeOf(context.tenantId).toEqualTypeOf<string>()
    expect(context.tenant).toBe(tenant)
    expect(context.cacheKey).toBe('admin:web:string:tenant-1')
    expect(context.tenantBindings).toEqual({ tenantId: 'tenant-1' })
    expect(context.scopeTenantQuery(query)).toBe(query)
    expect(where).toEqual({ column: 'tenantId', value: 'tenant-1' })
  })

  it('propagates the trusted tenant into operation-specific contexts without manual generic types', async () => {
    const tenant = { id: 'tenant-1', members: new Set(['actor-1']), slug: 'acme' }
    const { compiled } = tenancy([tenant], { value: 'tenant-1' })
    const authenticated = scope()
    const active = await compiled.activeContext(authenticated)
    const propagated = bindPanelTenantContext(active, authenticated, {
      locale: 'en' as const,
      mount: 'page' as const,
      panelPath: '/admin' as const,
      services: { audit: true as const },
    })

    expectTypeOf(propagated.tenant).toEqualTypeOf<Tenant>()
    expectTypeOf(propagated.locale).toEqualTypeOf<'en'>()
    expectTypeOf(propagated.services.audit).toEqualTypeOf<true>()
    expect(propagated).toMatchObject({
      cacheKey: 'admin:web:string:tenant-1',
      guard: 'web',
      panelId: 'admin',
      tenant,
      tenantId: 'tenant-1',
    })
    expect(panelTenantNotificationScope(active, 'actor-1')).toEqual({
      actorId: 'actor-1',
      guard: 'web',
      panelId: 'admin',
      tenantId: 'tenant-1',
    })
  })

  it('rejects duplicate identities and route keys before exposing memberships', async () => {
    const sharedMembers = new Set(['actor-1'])
    const duplicateId = tenancy([
      { id: 'tenant-1', members: sharedMembers, slug: 'acme' },
      { id: 'tenant-1', members: sharedMembers, slug: 'other' },
    ]).runtime
    const duplicateRoute = tenancy([
      { id: 'tenant-1', members: sharedMembers, slug: 'acme' },
      { id: 'tenant-2', members: sharedMembers, slug: 'acme' },
    ]).runtime

    await expect(duplicateId.memberships({}, scope())).rejects.toThrow('unique identifiers')
    await expect(duplicateRoute.memberships({}, scope())).rejects.toThrow('unique route keys')
  })
})
