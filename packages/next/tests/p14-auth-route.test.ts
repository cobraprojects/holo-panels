import { describe, expect, it, vi } from 'vitest'
import { definePanel } from '@holo-js/panels-core'
import { createPanelAuthRoute, createPanelTenantRoute } from '../src/auth-route'

vi.mock('@holo-js/security/next/server', () => ({
  csrfProtection: () => (request: Request) => request.headers.get('x-csrf-token') === 'valid'
    ? undefined
    : new Response('CSRF token mismatch.', { status: 419 }),
}))

function fixture() {
  const actor = { id: 7 }
  const session = { cookies: ['panel_session=rotated; Path=/; Secure; HttpOnly; SameSite=Lax'], user: actor }
  const guard = {
    login: vi.fn(async () => session),
    logout: vi.fn(async () => ({ cookies: ['panel_session=; Path=/; Max-Age=0; Secure; HttpOnly'], guard: 'admin' })),
    provider: vi.fn(async () => 'admins'),
    refreshUser: vi.fn(async () => actor),
    user: vi.fn(async () => actor),
    multiFactor: {
      beginEnrollment: vi.fn(async () => ({ expiresAt: new Date('2026-08-01T00:00:00Z'), manualKey: 'SECRET', otpauthUri: 'otpauth://totp/Holo' })),
      challenge: vi.fn(async () => session),
      confirmEnrollment: vi.fn(async () => ({ recoveryCodes: ['recovery-code'] })),
      disable: vi.fn(async () => {}),
      recover: vi.fn(async () => session),
      regenerateRecoveryCodes: vi.fn(async () => ({ recoveryCodes: ['new-code'] })),
      status: vi.fn(async () => ({ enabled: true, recoveryCodesRemaining: 1 })),
    },
  }
  const auth = {
    guard: vi.fn(() => guard),
    requestPasswordReset: vi.fn(async () => {}),
    resetPassword: vi.fn(async () => actor),
    verification: { consume: vi.fn(async () => actor), resend: vi.fn(async () => ({})) },
  }
  const panel = definePanel('admin', { prototype: actor })
    .path('/admin')
    .guard('admin')
    .auth({ login: true, logout: true, multiFactor: true, passwordReset: { broker: 'admins' } })
    .compile()
  const runtime = {
    auth,
    registry: { 'admin:panel:admin': async () => panel },
    resolveServices: async () => ({ audit: true }),
    resolveTenant: vi.fn(async () => { throw new Error('Tenant could not be resolved') }),
  }
  return { guard, route: createPanelAuthRoute({ panelIds: ['admin'], runtime }), runtime }
}

function request(operation: string, body: unknown, csrf = 'valid'): Request {
  return new Request(`https://example.test/admin/auth/${operation}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    method: 'POST',
  })
}

describe('Next panel auth route', () => {
  it('uses a fixed compiled panel, preserves secure cookies, and emits a native 303', async () => {
    const { guard, route, runtime } = fixture()
    const response = await route.POST(request('login', { credentials: { email: 'ava@example.com', password: 'secret' } }), {
      params: Promise.resolve({ operation: 'login', panelId: 'admin' }),
    })

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(response.headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Lax')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(guard.login).toHaveBeenCalledWith({ email: 'ava@example.com', password: 'secret' })
    expect(runtime.resolveTenant).not.toHaveBeenCalled()
  })

  it('applies CSRF before Auth and rejects client-selected configuration', async () => {
    const { guard, route } = fixture()
    const context = { params: Promise.resolve({ operation: 'login', panelId: 'admin' }) }

    expect((await route.POST(request('login', { credentials: { email: 'ava@example.com' } }, 'invalid'), context)).status).toBe(419)
    expect((await route.POST(request('login', { credentials: { email: 'ava@example.com' }, guard: 'web' }), context)).status).toBe(422)
    expect(guard.login).not.toHaveBeenCalled()
  })

  it('allows only read-only auth operations through GET', async () => {
    const { route } = fixture()
    const login = await route.GET(new Request('https://example.test/admin/auth/login'), {
      params: Promise.resolve({ operation: 'login', panelId: 'admin' }),
    })
    const status = await route.GET(new Request('https://example.test/admin/auth/mfa-status'), {
      params: Promise.resolve({ operation: 'mfa-status', panelId: 'admin' }),
    })

    expect(login.status).toBe(405)
    expect(status.status).toBe(200)
    await expect(status.json()).resolves.toEqual({ enabled: true, recoveryCodesRemaining: 1 })
  })
})

describe('Next panel tenant route', () => {
  it('switches only an authorized membership from exact server-bound input', async () => {
    const saved: string[] = []
    const actor = { id: 7 }
    const tenants = [{ id: 'tenant-a', members: new Set([7]), name: 'Acme', slug: 'acme' }]
    const panel = definePanel('admin', { prototype: actor })
      .guard('admin')
      .tenancy({
        authorize: (tenant, scope) => tenant.members.has(scope.actor.id),
        findMembershipById: async (id, scope) => tenants.find(tenant => tenant.id === id && tenant.members.has(scope.actor.id)) ?? null,
        findMembershipByRouteKey: async (routeKey, scope) => tenants.find(tenant => tenant.slug === routeKey && tenant.members.has(scope.actor.id)) ?? null,
        identify: tenant => tenant.id,
        memberships: async (_request, scope) => ({ nextCursor: null, tenants: tenants.filter(tenant => tenant.members.has(scope.actor.id)) }),
        model: { prototype: { id: '', members: new Set([0]), name: '', slug: '' } },
        persistence: { clear: async () => {}, load: async () => saved.at(-1) ?? null, save: async (_scope, id) => { saved.push(id) } },
        present: tenant => ({ label: tenant.name }),
        profile: {
          read: tenant => ({ name: tenant.name }),
          validate: payload => {
            const name = payload !== null && typeof payload === 'object' ? Reflect.get(payload, 'name') : undefined
            if (typeof name !== 'string') throw new TypeError('invalid profile')
            return { name }
          },
          update: (tenant, values) => {
            tenant.name = values.name
            return tenant
          },
        },
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
      })
      .compile()
    const guard = {
      login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
      provider: async () => 'admins', user: async () => actor,
      multiFactor: { beginEnrollment: vi.fn(), challenge: vi.fn(), confirmEnrollment: vi.fn(), disable: vi.fn(), recover: vi.fn(), regenerateRecoveryCodes: vi.fn(), status: vi.fn() },
    }
    const runtime = {
      auth: { guard: () => guard, requestPasswordReset: vi.fn(), resetPassword: vi.fn(), verification: { consume: vi.fn(), resend: vi.fn() } },
      registry: { 'admin:panel:admin': async () => panel },
    }
    const route = createPanelTenantRoute({ panelIds: ['admin'], runtime })
    const context = { params: Promise.resolve({ operation: 'switch', panelId: 'admin' }) }
    const tenantRequest = (body: unknown) => new Request('https://example.test/admin/tenant/switch', {
      body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-csrf-token': 'valid' }, method: 'POST',
    })

    const switched = await route.POST(tenantRequest({ routeKey: 'acme' }), context)
    expect(switched.status).toBe(200)
    await expect(switched.json()).resolves.toEqual({ tenant: { id: 'tenant-a', routeKey: 'acme' } })
    expect(saved).toEqual(['tenant-a'])
    expect((await route.POST(tenantRequest({ routeKey: 'acme', tenantId: 'attacker' }), context)).status).toBe(404)

    const registered = await route.POST(tenantRequest({ name: 'Beta', slug: 'beta' }), { params: Promise.resolve({ operation: 'register', panelId: 'admin' }) })
    expect(registered.status).toBe(201)
    await expect(registered.json()).resolves.toEqual({ tenant: { id: 'tenant-2', routeKey: 'beta' } })

    const profile = await route.GET(new Request('https://example.test/admin/tenant/profile-read'), { params: Promise.resolve({ operation: 'profile-read', panelId: 'admin' }) })
    expect(profile.status).toBe(200)
    await expect(profile.json()).resolves.toEqual({ profile: { name: 'Beta' } })

    const updated = await route.POST(tenantRequest({ name: 'Beta Inc.' }), { params: Promise.resolve({ operation: 'profile-update', panelId: 'admin' }) })
    expect(updated.status).toBe(200)
    await expect(updated.json()).resolves.toEqual({ profile: { name: 'Beta Inc.' } })
  })
})
