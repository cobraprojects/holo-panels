import { describe, expect, it, vi } from 'vitest'
import type { PanelAuthenticatedScope } from '../src/panels/contracts'
import { PanelTenancyRuntime } from '../src/tenancy/runtime'

interface Actor {
  readonly id: string
}

interface Tenant {
  readonly id: string
  readonly slug: string
}

const tenant: Tenant = { id: 'tenant-1', slug: 'acme' }
const scope: PanelAuthenticatedScope<Actor> = {
  actor: { id: 'actor-1' },
  guard: 'web',
  panelId: 'admin',
  provider: 'users',
  signal: new AbortController().signal,
}

function runtime(overrides: Partial<ConstructorParameters<typeof PanelTenancyRuntime<Actor, Tenant, string, object>>[0]> = {}) {
  return new PanelTenancyRuntime<Actor, Tenant, string, object>({
    authorize: () => true,
    findMembershipById: tenantId => tenantId === tenant.id ? tenant : null,
    findMembershipByRouteKey: routeKey => routeKey === tenant.slug ? tenant : null,
    identify: value => value.id,
    memberships: () => ({ nextCursor: null, tenants: [tenant] }),
    model: {},
    persistence: {
      clear: async () => undefined,
      load: async () => null,
      save: async () => undefined,
    },
    present: value => ({ label: value.slug }),
    routeKey: value => value.slug,
    ...overrides,
  })
}

describe('bounded tenant membership resolution', () => {
  it('normalizes a bounded searchable page request', async () => {
    const memberships = vi.fn(() => ({ nextCursor: 'cursor-2', tenants: [tenant] }))
    const result = await runtime({ membershipPageSize: 40, memberships }).memberships({ search: '  Acme   team  ' }, scope)

    expect(memberships).toHaveBeenCalledWith({ cursor: null, limit: 40, search: 'Acme team' }, scope)
    expect(result).toEqual({ nextCursor: 'cursor-2', tenants: [{ id: 'tenant-1', routeKey: 'acme', tenant }] })
  })

  it('rejects overproduction, repeated cursors, and unsafe input', async () => {
    const overproducing = runtime({
      memberships: () => ({ nextCursor: null, tenants: [tenant, tenant] }),
    })
    await expect(overproducing.memberships({ limit: 1 }, scope)).rejects.toThrow('bounded page')

    const repeated = runtime({
      memberships: request => ({ nextCursor: request.cursor, tenants: [] }),
    })
    await expect(repeated.memberships({ cursor: 'same' }, scope)).rejects.toThrow('must advance')
    await expect(runtime().memberships({ limit: 101 }, scope)).rejects.toThrow('from 1 through 100')
    await expect(runtime().memberships({ search: 'x'.repeat(201) }, scope)).rejects.toThrow('cannot exceed 200')
  })

  it('uses direct scoped lookup for switching and rejects substituted tenants', async () => {
    const memberships = vi.fn(() => ({ nextCursor: null, tenants: [tenant] }))
    const findMembershipByRouteKey = vi.fn(() => tenant)
    await expect(runtime({ findMembershipByRouteKey, memberships }).switch('acme', scope)).resolves.toMatchObject({ id: 'tenant-1' })
    expect(findMembershipByRouteKey).toHaveBeenCalledWith('acme', scope)
    expect(memberships).not.toHaveBeenCalled()

    const substituted = runtime({
      findMembershipByRouteKey: () => ({ id: 'tenant-2', slug: 'other' }),
    })
    await expect(substituted.switch('acme', scope)).rejects.toMatchObject({ failure: 'not-found' })
  })
})
