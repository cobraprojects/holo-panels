import { describe, expect, it, vi } from 'vitest'
import { definePanel } from '../src/panels/panel'
import type { CompiledPanelDefinition, PanelAuthenticatedScope } from '../src/panels/contracts'
import {
  executePanelTenantOperation,
  executePanelTenantSwitch,
  PanelTenantOperationError,
  panelTenantOperationStatus,
} from '../src/tenancy/operation'
import { PanelTenantResolutionError } from '../src/tenancy/runtime'

interface Actor {
  readonly id: string
}

const scope: PanelAuthenticatedScope<Actor> = {
  actor: { id: 'actor-1' },
  guard: 'web',
  panelId: 'admin',
  provider: 'users',
  signal: new AbortController().signal,
}

function panel(switchTenant = vi.fn(async (value: string) => ({ id: 'tenant-1', routeKey: value }))): CompiledPanelDefinition<Actor> {
  return {
    discover: { pages: 'pages', resources: 'resources', widgets: 'widgets' },
    guard: 'web',
    kind: 'panel',
    manifest: {
      auth: null,
      branding: { favicon: null, logo: null, name: 'Admin' },
      databaseNotifications: null,
      default: true,
    globalSearch: false,
    locales: { allowed: ['en', 'ar'], fallback: 'en' },
      id: 'admin',
      navigation: [],
      navigationMode: 'sidebar',
      path: '/admin',
      sidebarCollapsible: true,
      slots: {},
      tenancy: { enabled: true },
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
      userMenu: [],
    },
    server: {
      access: () => true,
      defaults: [],
      plugins: [],
      presentActor: () => ({}),
      registered: [],
      tenancy: {
        active: async () => null,
        activeContext: async () => ({
          ...scope,
          cacheKey: 'admin:web:string:tenant-1',
          scopeTenantQuery: query => query,
          tenant: {},
          tenantBindings: { tenant_id: 'tenant-1' },
          tenantId: 'tenant-1',
          tenantRouteKey: 'acme',
        }),
        bootstrap: async () => ({ active: null, memberships: { memberships: [], nextCursor: null } }),
        clear: async () => undefined,
        memberships: async () => ({ memberships: [], nextCursor: null }),
        queuedContext: async () => ({ guard: 'web', panelId: 'admin', tenantId: 'tenant-1', tenantIdType: 'string', version: 1 }),
        queuedContextValue: async () => ({
          ...scope,
          cacheKey: 'admin:web:string:tenant-1',
          scopeTenantQuery: query => query,
          tenant: {},
          tenantBindings: { tenant_id: 'tenant-1' },
          tenantId: 'tenant-1',
          tenantRouteKey: 'acme',
        }),
        resolveQueued: async () => ({ id: 'tenant-1', routeKey: 'acme' }),
        resolveQueuedValue: async () => ({}),
        resolveRoute: async value => ({ id: 'tenant-1', routeKey: value }),
        switch: switchTenant,
      },
    },
  }
}

describe('panel tenant switch operation', () => {
  it('derives identity from the fixed panel and authenticated scope', async () => {
    const switchTenant = vi.fn(async (value: string) => ({ id: 'tenant-1', routeKey: value }))
    const result = await executePanelTenantSwitch({
      panel: panel(switchTenant),
      payload: { routeKey: 'acme' },
      scope,
    })

    expect(result).toEqual({ tenant: { id: 'tenant-1', routeKey: 'acme' } })
    expect(switchTenant).toHaveBeenCalledWith('acme', scope)
  })

  it('maps absent, malformed, unknown, and denied tenants to the same not-found boundary', async () => {
    const missingTenancy = panel()
    const withoutTenancy: CompiledPanelDefinition<Actor> = {
      ...missingTenancy,
      manifest: { ...missingTenancy.manifest, tenancy: null },
      server: { ...missingTenancy.server, tenancy: undefined },
    }
    await expect(executePanelTenantSwitch({ panel: withoutTenancy, payload: { routeKey: 'acme' }, scope }))
      .rejects.toMatchObject({ failure: 'not-found' })
    await expect(executePanelTenantSwitch({ panel: panel(), payload: { routeKey: 1 }, scope }))
      .rejects.toMatchObject({ failure: 'not-found' })
    await expect(executePanelTenantSwitch({ panel: panel(), payload: { guard: 'other', routeKey: 'acme' }, scope }))
      .rejects.toMatchObject({ failure: 'not-found' })

    const denied = panel(vi.fn(async () => {
      throw new PanelTenantResolutionError('not-found')
    }))
    await expect(executePanelTenantSwitch({ panel: denied, payload: { routeKey: 'secret' }, scope }))
      .rejects.toMatchObject({ failure: 'not-found' })
  })

  it('rejects substituted panel or guard context and maps operation status safely', async () => {
    await expect(executePanelTenantSwitch({ panel: panel(), payload: { routeKey: 'acme' }, scope: { ...scope, panelId: 'other' } }))
      .rejects.toMatchObject({ failure: 'invalid-context' })
    expect(panelTenantOperationStatus(new PanelTenantOperationError('invalid-context'))).toBe(403)
    expect(panelTenantOperationStatus(new PanelTenantOperationError('access-denied'))).toBe(403)
    expect(panelTenantOperationStatus(new PanelTenantOperationError('not-found'))).toBe(404)
  })

  it('does not hide unexpected callback or persistence failures', async () => {
    const failure = new Error('database unavailable')
    const broken = panel(vi.fn(async () => {
      throw failure
    }))
    await expect(executePanelTenantSwitch({ panel: broken, payload: { routeKey: 'acme' }, scope })).rejects.toBe(failure)
  })

  it('registers and updates tenant profiles with value-inferred validated inputs', async () => {
    const tenants: Array<{ id: string, members: Set<string>, name: string, slug: string }> = []
    let active: string | null = null
    const configured = definePanel('admin', { prototype: { id: '' } }).tenancy({
      authorize: (tenant, currentScope) => tenant.members.has(currentScope.actor.id),
      findMembershipById: (id, currentScope) => tenants.find(tenant => tenant.id === id && tenant.members.has(currentScope.actor.id)) ?? null,
      findMembershipByRouteKey: (routeKey, currentScope) => tenants.find(tenant => tenant.slug === routeKey && tenant.members.has(currentScope.actor.id)) ?? null,
      identify: tenant => tenant.id,
      memberships: (_request, currentScope) => ({ nextCursor: null, tenants: tenants.filter(tenant => tenant.members.has(currentScope.actor.id)) }),
      model: { prototype: { id: '', members: new Set(['']), name: '', slug: '' } },
      persistence: {
        clear: async () => { active = null },
        load: async () => active,
        save: async (_currentScope, id) => { active = id },
      },
      present: tenant => ({ label: tenant.name }),
      profile: {
        read: tenant => ({ name: tenant.name }),
        update: (tenant, values) => {
          tenant.name = values.name
          return tenant
        },
        validate: payload => {
          if (payload === null || typeof payload !== 'object' || Object.keys(payload).length !== 1) throw new TypeError('invalid profile')
          const name = Reflect.get(payload, 'name')
          if (typeof name !== 'string') throw new TypeError('invalid profile')
          return { name }
        },
      },
      registration: {
        validate: payload => {
          if (payload === null || typeof payload !== 'object' || Object.keys(payload).sort().join(',') !== 'name,slug') throw new TypeError('invalid registration')
          const name = Reflect.get(payload, 'name')
          const slug = Reflect.get(payload, 'slug')
          if (typeof name !== 'string' || typeof slug !== 'string') throw new TypeError('invalid registration')
          return { name, slug }
        },
        create: (values, currentScope) => {
          const tenant = { id: `tenant-${tenants.length + 1}`, members: new Set([currentScope.actor.id]), name: values.name, slug: values.slug }
          tenants.push(tenant)
          return tenant
        },
      },
      routeKey: tenant => tenant.slug,
    }).compile()
    const inferredScope = { actor: { id: 'actor-1' }, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }

    expect(configured.manifest.tenancy).toMatchObject({
      enabled: true,
      profile: { path: '/admin/tenant/profile' },
      registration: { path: '/admin/tenant/register' },
    })
    await expect(executePanelTenantOperation({ operation: 'register', panel: configured, payload: { name: 'Acme', slug: 'acme' }, scope: inferredScope })).resolves.toEqual({ data: { tenant: { id: 'tenant-1', routeKey: 'acme' } }, status: 201 })
    await expect(executePanelTenantOperation({ operation: 'profile-read', panel: configured, payload: {}, scope: inferredScope })).resolves.toEqual({ data: { profile: { name: 'Acme' } }, status: 200 })
    await expect(executePanelTenantOperation({ operation: 'profile-update', panel: configured, payload: { name: 'Acme Inc.' }, scope: inferredScope })).resolves.toEqual({ data: { profile: { name: 'Acme Inc.' } }, status: 200 })
    await expect(executePanelTenantOperation({ operation: 'register', panel: configured, payload: { name: 'Injected', slug: 'bad', tenantId: 'foreign' }, scope: inferredScope })).rejects.toThrow('invalid registration')
  })
})
