import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { executePanelAuthOperation, panelAuthOperationStatus } from '../src/auth/operation'
import { AuthControllerError } from '../src/auth/controller'
import { definePanel } from '../src/panels/panel'
import type { JsonValue } from '../src/protocol/json'

function fixture() {
  const actor = { id: 7, name: 'Ava' }
  const session = { cookies: ['panel_session=rotated; Secure; HttpOnly; SameSite=Lax'], user: actor }
  const guard = {
    login: vi.fn(async () => session),
    logout: vi.fn(async () => ({ cookies: ['panel_session=; Max-Age=0; Secure; HttpOnly'], guard: 'admin' })),
    provider: vi.fn(async () => 'admins'),
    refreshUser: vi.fn(async () => actor),
    register: vi.fn(async () => actor),
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
    verification: {
      consume: vi.fn(async () => actor),
      resend: vi.fn(async () => ({})),
    },
  }
  const panel = definePanel('admin', { prototype: actor })
    .guard('admin')
    .auth({ login: true, logout: true, multiFactor: true, passwordReset: { broker: 'admins' }, registration: true })
    .compile()
  const common = {
    auth,
    panel,
    services: { audit: true },
    signal: new AbortController().signal,
    tenant: { id: 'tenant-a' },
  }
  return { auth, common, guard }
}

describe('panel auth operation dispatcher', () => {
  it('infers actor, tenant, and service types from supplied runtime inputs', async () => {
    const { common } = fixture()
    const result = executePanelAuthOperation({ ...common, operation: 'mfa-status', payload: {} })

    expectTypeOf(result).toEqualTypeOf<Promise<Readonly<{
      readonly cookies: readonly string[]
      readonly data: JsonValue
      readonly redirectTo: string | null
      readonly status: 200 | 204 | 303
    }>>>()
    await expect(result).resolves.toMatchObject({ data: { enabled: true, recoveryCodesRemaining: 1 }, status: 200 })
  })

  it('returns untouched secure cookies and a server-compiled redirect', async () => {
    const { common, guard } = fixture()
    const result = await executePanelAuthOperation({
      ...common,
      operation: 'login',
      payload: { credentials: { email: 'ava@example.com', password: 'secret' } },
    })

    expect(result).toEqual({
      cookies: ['panel_session=rotated; Secure; HttpOnly; SameSite=Lax'],
      data: { status: 'authenticated' },
      redirectTo: '/admin',
      status: 303,
    })
    expect(guard.login).toHaveBeenCalledWith({ email: 'ava@example.com', password: 'secret' })
  })

  it('registers through the configured Holo guard and redirects inside the panel', async () => {
    const { common, guard } = fixture()
    const result = await executePanelAuthOperation({
      ...common,
      operation: 'registration',
      payload: { credentials: { email: 'new@example.com', password: 'secret', passwordConfirmation: 'secret' } },
    })

    expect(guard.register).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secret', passwordConfirmation: 'secret' })
    expect(result).toEqual({ cookies: [], data: { status: 'registered' }, redirectTo: '/admin', status: 303 })
  })

  it('rejects client-selected configuration and oversized scalar input before Auth callbacks', async () => {
    const { common, guard } = fixture()

    await expect(executePanelAuthOperation({
      ...common,
      operation: 'login',
      payload: { credentials: { email: 'ava@example.com' }, guard: 'web' },
    })).rejects.toMatchObject({ code: 'profile-input-invalid' })
    await expect(executePanelAuthOperation({
      ...common,
      operation: 'mfa-challenge',
      payload: { code: 'x'.repeat(4097) },
    })).rejects.toMatchObject({ code: 'profile-input-invalid' })
    expect(guard.login).not.toHaveBeenCalled()
    expect(guard.multiFactor.challenge).not.toHaveBeenCalled()
  })

  it('serializes MFA enrollment dates without exposing class instances', async () => {
    const { common } = fixture()

    await expect(executePanelAuthOperation({
      ...common,
      operation: 'mfa-enrollment-begin',
      payload: {},
    })).resolves.toMatchObject({
      data: { expiresAt: '2026-08-01T00:00:00.000Z', manualKey: 'SECRET' },
    })
  })

  it('maps controller errors to fixed HTTP status classes', () => {
    expect(panelAuthOperationStatus(new AuthControllerError('unauthenticated', ''))).toBe(401)
    expect(panelAuthOperationStatus(new AuthControllerError('access-denied', ''))).toBe(403)
    expect(panelAuthOperationStatus(new AuthControllerError('auth-unavailable', ''))).toBe(404)
    expect(panelAuthOperationStatus(new AuthControllerError('profile-input-invalid', ''))).toBe(422)
  })
})
