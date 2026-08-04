import { describe, expect, it, vi } from 'vitest'
import { createPanelAuthController, PanelAuthController } from '../src/auth/controller'
import { definePanel } from '../src/panels/panel'
import { defineSchema } from '../src/schemas/builder'

class Actor {
  declare readonly id: number
  declare readonly name: string
}

function fixture(options: { readonly access?: boolean } = {}) {
  let actor: { readonly id: number, readonly name: string } | null = { id: 7, name: 'Ava' }
  const session: {
    readonly cookies: readonly string[]
    readonly multiFactorChallenge?: { readonly expiresAt: Date, readonly recoveryAllowed: boolean, readonly route: string }
    readonly user: { readonly id: number, readonly name: string }
  } = { cookies: ['session=rotated'], user: actor }
  const guard = {
    login: vi.fn(async () => session),
    logout: vi.fn(async () => ({ cookies: ['session=; Max-Age=0'], guard: 'admin' })),
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
    resetPassword: vi.fn(async () => actor!),
    verification: {
      consume: vi.fn(async () => actor!),
      resend: vi.fn(async () => ({})),
    },
  }
  const update = vi.fn(async (_context: object, input: Readonly<Record<string, unknown>>) => {
    actor = { id: 7, name: String(input.name) }
  })
  const access = vi.fn(async () => options.access ?? true)
  const controller = new PanelAuthController({
    access,
    auth,
    guard: 'admin',
    panelId: 'admin',
    passwordBroker: 'admins',
    profile: {
      fields: ['name'],
      schema: defineSchema('profile').compile(),
      update,
      values: async context => ({ name: context.actor.name }),
    },
    routes: {
      loginRedirect: '/admin',
      logoutRedirect: '/admin/login',
      multiFactorChallenge: '/admin/mfa-challenge',
      multiFactorRedirect: '/admin',
    },
    services: { audit: true },
    tenant: { id: 'tenant-1' },
  })
  return { access, auth, controller, guard, update }
}

describe('internal panel auth controller', () => {
  it('binds guard and password broker on the server and never accepts them from page input', async () => {
    const { auth, controller, guard } = fixture()
    const signal = new AbortController().signal

    await expect(controller.login({ email: 'ava@example.com', password: 'secret' }, signal)).resolves.toMatchObject({ actor: { id: 7 }, redirectTo: '/admin', status: 'authenticated' })
    await controller.requestPasswordReset('ava@example.com')
    await controller.resendEmailVerification()
    await controller.logout()

    expect(auth.guard).toHaveBeenCalledWith('admin')
    expect(auth.requestPasswordReset).toHaveBeenCalledWith({ email: 'ava@example.com' }, { broker: 'admins' })
    expect(auth.verification.resend).toHaveBeenCalledWith({ guard: 'admin' })
    expect(guard.logout).toHaveBeenCalledOnce()
  })

  it('rejects profile mass assignment and delegates only allow-listed input to application code', async () => {
    const { controller, update } = fixture()
    const signal = new AbortController().signal

    await expect(controller.updateProfile({ name: 'Mira', role: 'owner' }, signal)).rejects.toMatchObject({ code: 'profile-input-invalid' })
    expect(update).not.toHaveBeenCalled()
    await expect(controller.updateProfile({ name: 'Mira' }, signal)).resolves.toEqual({ id: 7, name: 'Mira' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      guard: 'admin',
      panelId: 'admin',
      provider: 'admins',
      services: { audit: true },
      tenant: { id: 'tenant-1' },
    }), { name: 'Mira' })
    await expect(controller.profileValues(signal)).resolves.toEqual({ name: 'Mira' })
  })

  it('logs out the selected guard when panel access is denied after authentication', async () => {
    const { controller, guard } = fixture({ access: false })

    await expect(controller.login({ email: 'ava@example.com', password: 'secret' }, new AbortController().signal)).rejects.toMatchObject({ code: 'access-denied' })
    expect(guard.logout).toHaveBeenCalledOnce()
  })

  it('defers panel access until MFA succeeds and delegates recovery to Holo Auth', async () => {
    const { access, controller, guard } = fixture()
    guard.login.mockResolvedValueOnce({
      cookies: ['session=pending'],
      multiFactorChallenge: { expiresAt: new Date('2026-08-01T00:00:00Z'), recoveryAllowed: true, route: '/mfa-challenge' },
      user: { id: 7, name: 'Ava' },
    })
    const signal = new AbortController().signal

    const outcome = await controller.login({ email: 'ava@example.com', password: 'secret' }, signal)
    expect(outcome).toMatchObject({
      redirectTo: '/admin/mfa-challenge',
      status: 'multi-factor-challenge',
    })
    expect(outcome).not.toHaveProperty('route')
    expect(outcome).not.toHaveProperty('user')
    expect(access).not.toHaveBeenCalled()
    await controller.recoverMultiFactor('recovery-code', signal)
    expect(guard.multiFactor.recover).toHaveBeenCalledWith({ code: 'recovery-code' })
    expect(access).toHaveBeenCalledOnce()
  })

  it('requires a fresh panel login when Holo Auth rejects MFA enrollment freshness', async () => {
    const { controller, guard } = fixture()
    guard.multiFactor.beginEnrollment.mockRejectedValueOnce(Object.assign(
      new Error('Recent authentication is required to enroll multi-factor authentication.'),
      { code: 'multi_factor_reauthentication_required' },
    ))

    await expect(controller.beginMultiFactorEnrollment()).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'Recent authentication is required to enroll multi-factor authentication',
    })
  })

  it('creates a controller from compiled panel server state without client-selected auth configuration', async () => {
    const { auth } = fixture()
    const panel = definePanel('admin', Actor)
      .guard('admin')
      .auth({ login: true, logout: true, multiFactor: true, passwordReset: { broker: 'admins' } })
      .compile()
    const controller = createPanelAuthController({ auth, panel, services: {}, tenant: null })

    await expect(controller.login({ email: 'ava@example.com' }, new AbortController().signal)).resolves.toMatchObject({
      redirectTo: '/admin',
      status: 'authenticated',
    })
    expect(auth.guard).toHaveBeenCalledWith('admin')
  })
})
