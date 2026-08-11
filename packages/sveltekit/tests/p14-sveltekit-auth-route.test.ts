import { definePanel } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import type { SvelteKitPanelEvent, SvelteKitPanelRegistry } from '../src/contracts'

const authentication = vi.hoisted(() => {
  const actor = { id: 'user-7' }
  const session = { cookies: ['panel_session=rotated; Path=/; Secure; HttpOnly; SameSite=Lax'], user: actor }
  const guard = {
    login: vi.fn(async () => session),
    logout: vi.fn(async () => ({ cookies: [], guard: 'admin' })),
    provider: vi.fn(async () => 'admins'),
    refreshUser: vi.fn(async () => actor),
    user: vi.fn(async () => actor),
    multiFactor: {
      beginEnrollment: vi.fn(async () => ({ expiresAt: new Date('2026-08-01T00:00:00Z'), manualKey: 'SECRET', otpauthUri: 'otpauth://totp/Holo' })),
      challenge: vi.fn(async () => session),
      confirmEnrollment: vi.fn(async () => ({ recoveryCodes: [] })),
      disable: vi.fn(async () => {}),
      recover: vi.fn(async () => session),
      regenerateRecoveryCodes: vi.fn(async () => ({ recoveryCodes: [] })),
      status: vi.fn(async () => ({ enabled: true, recoveryCodesRemaining: 1 })),
    },
  }
  return {
    auth: {
      guard: vi.fn(() => guard),
      requestPasswordReset: vi.fn(async () => {}),
      resetPassword: vi.fn(async () => actor),
      verification: { consume: vi.fn(async () => actor), resend: vi.fn(async () => ({})) },
    },
    guard,
  }
})

vi.mock('@holo-js/adapter-sveltekit', () => ({
  createSvelteKitHoloHelpers: () => ({ getAuth: async () => authentication.auth }),
  runWithSvelteKitRequestEvent: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))
vi.mock('@holo-js/security/sveltekit/server', () => ({
  csrfProtection: () => async ({ resolve }: { readonly resolve: () => Promise<Response> }) => resolve(),
}))
vi.mock('@sveltejs/kit', () => ({
  error: (status: number, message: string) => { throw Object.assign(new Error(message), { status }) },
  redirect: (status: number, location: string) => { throw Object.assign(new Error('Redirect'), { location, status }) },
}))

const { createPanelAuthHandler, createPanelTenantHandler } = await import('../src/server')

const panel = definePanel('admin', { prototype: { id: '' } })
  .guard('admin')
  .auth({ login: true, logout: true, multiFactor: true })
  .compile()

const registry: SvelteKitPanelRegistry<{ readonly id: string }> = {
  panels: { admin: panel },
  resolvePage: async () => { throw new Error('not used') },
  resolveTenant: async () => { throw new Error('Tenant could not be resolved') },
  runtime: {
    bootstrap: async () => [],
    execute: async (_panelId, _operation, _signal, handler) => handler({ actor: { id: 'user-7' }, guard: 'admin', panelId: 'admin', provider: 'admins', signal: new AbortController().signal }),
  },
}

function event(request: Request, operation = 'login'): SvelteKitPanelEvent {
  return {
    cookies: { get: () => undefined, set: () => {} },
    locals: {},
    params: { operation, panelId: 'admin' },
    request,
    url: new URL(request.url),
  }
}

describe('SvelteKit panel auth handler', () => {
  it('preserves secure Holo cookies and emits the compiled native redirect', async () => {
    const handler = createPanelAuthHandler({ panelIds: ['admin'], registry })
    const response = await handler.POST(event(new Request('http://localhost/admin/auth/login', {
      body: JSON.stringify({ credentials: { email: 'ava@example.com', password: 'secret' } }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(response.headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Lax')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(authentication.guard.login).toHaveBeenCalledWith({ email: 'ava@example.com', password: 'secret' })
  })

  it('dispatches inferred tenant registration through the native POST boundary', async () => {
    const actor = { id: 'user-7' }
    const tenants = [{ id: 'tenant-a', members: new Set([actor.id]), name: 'Acme', slug: 'acme' }]
    let active = tenants[0]?.id ?? null
    const tenantPanel = definePanel('admin', { prototype: actor }).guard('admin').tenancy({
      authorize: (tenant, scope) => tenant.members.has(scope.actor.id),
      findMembershipById: (id, scope) => tenants.find(tenant => tenant.id === id && tenant.members.has(scope.actor.id)) ?? null,
      findMembershipByRouteKey: (routeKey, scope) => tenants.find(tenant => tenant.slug === routeKey && tenant.members.has(scope.actor.id)) ?? null,
      identify: tenant => tenant.id,
      memberships: (_request, scope) => ({ nextCursor: null, tenants: tenants.filter(tenant => tenant.members.has(scope.actor.id)) }),
      model: { prototype: { id: '', members: new Set(['']), name: '', slug: '' } },
      persistence: { clear: async () => { active = null }, load: async () => active, save: async (_scope, id) => { active = id } },
      present: tenant => ({ label: tenant.name }),
      registration: {
        validate: payload => {
          if (payload === null || typeof payload !== 'object') throw new TypeError('invalid registration')
          const name = Reflect.get(payload, 'name')
          const slug = Reflect.get(payload, 'slug')
          if (typeof name !== 'string' || typeof slug !== 'string') throw new TypeError('invalid registration')
          return { name, slug }
        },
        create: (values, scope) => {
          const tenant = { id: `tenant-${tenants.length + 1}`, members: new Set([scope.actor.id]), name: values.name, slug: values.slug }
          tenants.push(tenant)
          return tenant
        },
      },
      routeKey: tenant => tenant.slug,
    }).compile()
    const tenantRegistry = { ...registry, panels: { admin: tenantPanel } }
    const handler = createPanelTenantHandler({ panelIds: ['admin'], registry: tenantRegistry })
    const tenantEvent = event(new Request('http://localhost/admin/tenant/register', {
      body: JSON.stringify({ name: 'Beta', slug: 'beta' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }), 'register')

    const response = await handler.POST(tenantEvent)
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ tenant: { id: 'tenant-2', routeKey: 'beta' } })
  })
})
