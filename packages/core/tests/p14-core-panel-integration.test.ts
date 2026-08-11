import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  definePanel,
  PanelRuntime,
  type HoloAuth,
  type PanelAuthorizationRequest,
  type PanelPlugin,
  type PanelTenantBootstrap,
} from '../src'

class Actor {
  declare readonly id: string
}

interface Tenant {
  readonly id: number
  readonly members: ReadonlySet<string>
  readonly name: string
  readonly slug: string
}

const signal = new AbortController().signal
const compatibility = {
  panels: { minimum: '0.0.0' },
  protocol: { minimum: '1.0' },
}

function auth(actor: Actor): HoloAuth<Actor> {
  return {
    guard: () => ({
      provider: async () => 'users',
      user: async () => actor,
    }),
  }
}

describe('P14 core panel integration', () => {
  it('installs approved server-only plugins with the final panel identity', async () => {
    let authorizedRequest: PanelAuthorizationRequest<Actor, number> | null = null
    const authorize = async (request: PanelAuthorizationRequest<Actor, number>): Promise<void> => {
      authorizedRequest = request
    }
    const install = vi.fn<PanelPlugin<Actor, number>['install']>(panel => ({
      authorizationLayer: { authorize, id: 'shield' },
      contributions: [],
      id: 'shield',
      permissionNamespace: panel.id,
    }))
    const plugin: PanelPlugin<Actor, number> = { compatibility, id: 'shield', install, packageName: '@holo-js/panels-shield' }
    const panel = definePanel('admin', Actor).plugin(plugin).guard('staff').compile()

    expect(install).toHaveBeenCalledWith({ guard: 'staff', id: 'admin' })
    expect(panel.server.plugins).toHaveLength(1)
    expect(panel.server.plugins[0]).toMatchObject({ id: 'shield', permissionNamespace: 'admin' })
    expect(JSON.stringify(panel.manifest)).not.toContain('shield')
    await panel.server.plugins[0]?.authorizationLayer?.authorize({
      actor: { id: 'actor-1' },
      guard: 'staff',
      panelId: 'admin',
      permission: 'admin.posts.view',
      signal,
      tenant: 42,
    })
    expect(authorizedRequest).toMatchObject({ permission: 'admin.posts.view', tenant: 42 })
  })

  it('rejects duplicate, malformed, and identity-changing plugin installations', () => {
    const valid: PanelPlugin<Actor> = {
      compatibility,
      id: 'audit',
      install: () => ({ authorizationLayer: null, contributions: [], id: 'audit', permissionNamespace: null }),
      packageName: '@acme/audit',
    }
    expect(() => definePanel('admin', Actor).plugin(valid).plugin(valid)).toThrow('already registered')
    expect(() => definePanel('admin', Actor).plugin({ ...valid, id: '../audit' })).toThrow('stable identifier')
    expect(() => definePanel('admin', Actor).plugin({
      compatibility,
      id: 'audit',
      install: () => ({ authorizationLayer: null, contributions: [], id: 'other', permissionNamespace: null }),
      packageName: '@acme/audit',
    }).compile()).toThrow('same ID')
  })

  it('serializes only authorized tenant presentations and retains callbacks server-side', async () => {
    const persisted = { value: 1 as number | null }
    const tenants = [
      { id: 1, members: new Set(['actor-1']), name: 'Acme', slug: 'acme' },
      { id: 2, members: new Set(['actor-2']), name: 'Secret', slug: 'secret' },
    ]
    const panel = definePanel('admin', { prototype: { id: '', } }).tenancy({
      authorize: (tenant, scope) => tenant.members.has(scope.actor.id),
      findMembershipById: (tenantId, scope) => tenants.find(tenant => tenant.id === tenantId && tenant.members.has(scope.actor.id)) ?? null,
      findMembershipByRouteKey: (routeKey, scope) => tenants.find(tenant => tenant.slug === routeKey && tenant.members.has(scope.actor.id)) ?? null,
      identify: tenant => tenant.id,
      memberships: (_request, scope) => ({ nextCursor: null, tenants: tenants.filter(tenant => tenant.members.has(scope.actor.id)) }),
      model: { prototype: { id: 0, members: new Set(['']), name: '', slug: '' }, secret: 'model-secret' },
      persistence: {
        clear: async () => {
          persisted.value = null
        },
        load: async () => persisted.value,
        save: async (_scope, tenantId) => {
          persisted.value = tenantId
        },
      },
      present: tenant => ({ avatarUrl: '/tenant.svg', description: `Workspace ${tenant.name}`, label: tenant.name }),
      routeKey: tenant => tenant.slug,
    }).presentActor(actor => ({ id: actor.id })).compile()

    expect(panel.manifest.tenancy).toMatchObject({ enabled: true, menu: true, switcher: true })
    expect(JSON.stringify(panel.manifest)).not.toContain('model-secret')
    const payload = (await new PanelRuntime(auth({ id: 'actor-1' }), [panel]).bootstrap(['admin'], signal))[0]
    expectTypeOf(payload?.tenancy).toEqualTypeOf<Readonly<PanelTenantBootstrap> | null | undefined>()
    expect(payload?.tenancy).toEqual({
      active: { avatarUrl: '/tenant.svg', description: 'Workspace Acme', label: 'Acme', routeKey: 'acme' },
      memberships: {
        memberships: [{ avatarUrl: '/tenant.svg', description: 'Workspace Acme', label: 'Acme', routeKey: 'acme' }],
        nextCursor: null,
      },
    })
    expect(JSON.stringify(payload)).not.toContain('Secret')
    await expect(panel.server.tenancy?.switch('secret', {
      actor: { id: 'actor-1' },
      guard: 'web',
      panelId: 'admin',
      provider: 'users',
      signal,
    })).rejects.toMatchObject({ failure: 'not-found' })
    expect(persisted.value).toBe(1)
  })

  it('clears stale active tenancy during panel bootstrap', async () => {
    const persisted = { value: 99 as number | null }
    const panel = definePanel('admin', { prototype: { id: '' } }).tenancy({
      authorize: () => true,
      findMembershipById: () => null,
      findMembershipByRouteKey: () => null,
      identify: (tenant: Tenant) => tenant.id,
      memberships: () => ({ nextCursor: null, tenants: [] }),
      model: { prototype: { id: 0, members: new Set(['']), name: '', slug: '' } },
      persistence: {
        clear: async () => {
          persisted.value = null
        },
        load: async () => persisted.value,
        save: async (_scope, tenantId) => {
          persisted.value = tenantId
        },
      },
      present: tenant => ({ label: tenant.name }),
      routeKey: tenant => tenant.slug,
    }).compile()

    const payload = (await new PanelRuntime(auth({ id: 'actor-1' }), [panel]).bootstrap(['admin'], signal))[0]
    expect(payload?.tenancy).toEqual({ active: null, memberships: { memberships: [], nextCursor: null } })
    expect(persisted.value).toBeNull()
  })

  it('rejects unsafe tenant presentation values before bootstrap serialization', async () => {
    const tenant = { id: 1, members: new Set(['actor-1']), name: 'Acme', slug: 'acme' }
    const panel = definePanel('admin', { prototype: { id: '' } }).tenancy({
      authorize: () => true,
      findMembershipById: tenantId => tenant.id === tenantId ? tenant : null,
      findMembershipByRouteKey: routeKey => tenant.slug === routeKey ? tenant : null,
      identify: value => value.id,
      memberships: () => ({ nextCursor: null, tenants: [tenant] }),
      model: { prototype: { id: 0, members: new Set(['']), name: '', slug: '' } },
      persistence: { clear: async () => undefined, load: async () => null, save: async () => undefined },
      present: () => ({ avatarUrl: 'javascript:alert(1)', label: 'Acme' }),
      routeKey: value => value.slug,
    }).compile()

    await expect(new PanelRuntime(auth({ id: 'actor-1' }), [panel]).bootstrap(['admin'], signal)).rejects.toThrow('absolute path or HTTPS URL')
  })
})
