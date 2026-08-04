import { definePanel } from '@holo-js/panels-core'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { describe, expect, it, vi } from 'vitest'

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

vi.mock('@holo-js/security/nuxt/server', () => ({ csrfProtection: () => defineEventHandler(() => undefined) }))
vi.mock('@holo-js/adapter-nuxt/runtime', () => ({
  holo: { getApp: vi.fn(async () => ({})), getAuth: vi.fn(async () => authentication.auth) },
  runWithNuxtRequest: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))

const { createPanelAuthHandler, createPanelTenantHandler } = await import('../src/server')

const panel = definePanel('admin', { prototype: { id: '' } })
  .guard('admin')
  .auth({ login: true, logout: true, multiFactor: true })
  .compile()

function endpoint(): (request: Request) => Promise<Response> {
  const app = createApp()
  const router = createRouter()
  router.post('/:panelId/auth/:operation', createPanelAuthHandler({
    panelIds: ['admin'],
    runtime: { execute: async () => ({ data: null }), panels: { admin: { access: () => true, definition: panel, guard: 'admin' } } },
  }))
  app.use(router)
  return toWebHandler(app)
}

describe('Nuxt panel auth handler', () => {
  it('preserves secure Holo cookies and uses the compiled panel redirect', async () => {
    const response = await endpoint()(new Request('http://localhost/admin/auth/login', {
      body: JSON.stringify({ credentials: { email: 'ava@example.com', password: 'secret' } }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(response.headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Lax')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(authentication.guard.login).toHaveBeenCalledWith({ email: 'ava@example.com', password: 'secret' })
  })

  it('dispatches the inferred tenant profile page through the native GET boundary', async () => {
    const actor = { id: 'user-7' }
    const tenant = { id: 'tenant-a', members: new Set([actor.id]), name: 'Acme', slug: 'acme' }
    const tenantPanel = definePanel('admin', { prototype: actor }).guard('admin').tenancy({
      authorize: (value, scope) => value.members.has(scope.actor.id),
      findMembershipById: id => id === tenant.id ? tenant : null,
      findMembershipByRouteKey: routeKey => routeKey === tenant.slug ? tenant : null,
      identify: value => value.id,
      memberships: () => ({ nextCursor: null, tenants: [tenant] }),
      model: { prototype: { id: '', members: new Set(['']), name: '', slug: '' } },
      persistence: { clear: async () => {}, load: async () => tenant.id, save: async () => {} },
      present: value => ({ label: value.name }),
      profile: {
        read: value => ({ name: value.name }),
        validate: payload => {
          const name = payload !== null && typeof payload === 'object' ? Reflect.get(payload, 'name') : undefined
          if (typeof name !== 'string') throw new TypeError('invalid profile')
          return { name }
        },
        update: (value, values) => ({ ...value, name: values.name }),
      },
      routeKey: value => value.slug,
    }).compile()
    const app = createApp()
    const router = createRouter()
    router.get('/:panelId/tenant/:operation', createPanelTenantHandler({
      panelIds: ['admin'],
      runtime: { execute: async () => ({ data: null }), panels: { admin: { access: () => true, definition: tenantPanel, guard: 'admin' } } },
    }))
    app.use(router)

    const response = await toWebHandler(app)(new Request('http://localhost/admin/tenant/profile-read'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ profile: { name: 'Acme' } })
  })
})
