import { describe, expect, it, vi } from 'vitest'
import { PanelAuthController, type PanelAuthRuntime } from '../src/auth/controller'

interface Actor {
  readonly id: string
  readonly name: string
}

interface GuardState {
  actor: Actor | null
  challenge: boolean
  cookieRevision: number
}

function authFixture() {
  const states = new Map<string, GuardState>()
  const access = vi.fn(async ({ actor, panelId }: { readonly actor: Actor, readonly panelId: string }) => {
    return !(panelId === 'restricted' && actor.id === 'denied')
  })

  function state(name: string): GuardState {
    const existing = states.get(name)
    if (existing) return existing
    const created: GuardState = { actor: null, challenge: false, cookieRevision: 0 }
    states.set(name, created)
    return created
  }

  function session(name: string, actor: Actor) {
    const current = state(name)
    current.actor = actor
    current.cookieRevision += 1
    return {
      cookies: [`${name}_session=revision-${current.cookieRevision}; HttpOnly; Secure; SameSite=Lax`],
      user: actor,
    }
  }

  const auth: PanelAuthRuntime<Actor> = {
    guard(name) {
      const current = state(name)
      return {
        async login(credentials) {
          const actor = { id: String(credentials.id), name: String(credentials.name ?? credentials.id) }
          if (credentials.mfa === true) {
            current.actor = actor
            current.challenge = true
            current.cookieRevision += 1
            return {
              cookies: [`${name}_session=pending-${current.cookieRevision}; HttpOnly; Secure; SameSite=Lax`],
              multiFactorChallenge: {
                expiresAt: new Date('2026-08-01T00:00:00Z'),
                recoveryAllowed: true,
                route: '/auth/mfa',
              },
              user: actor,
            }
          }
          return session(name, actor)
        },
        async logout() {
          current.actor = null
          current.challenge = false
          return {
            cookies: [`${name}_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0`],
            guard: name,
          }
        },
        multiFactor: {
          async beginEnrollment() {
            return { expiresAt: new Date('2026-08-01T00:00:00Z'), manualKey: 'secret', otpauthUri: 'otpauth://totp/Holo' }
          },
          async challenge() {
            if (!current.actor || !current.challenge) throw new Error('MFA challenge is unavailable')
            current.challenge = false
            return session(name, current.actor)
          },
          async confirmEnrollment() {
            return { recoveryCodes: ['recovery-code'] }
          },
          async disable() {},
          async recover() {
            if (!current.actor || !current.challenge) throw new Error('MFA recovery is unavailable')
            current.challenge = false
            return session(name, current.actor)
          },
          async regenerateRecoveryCodes() {
            return { recoveryCodes: ['new-recovery-code'] }
          },
          async status() {
            return { enabled: true, recoveryCodesRemaining: 1 }
          },
        },
        async provider() {
          return `${name}-users`
        },
        async refreshUser() {
          return current.actor
        },
        async user() {
          return current.challenge ? null : current.actor
        },
      }
    },
    async requestPasswordReset() {},
    async resetPassword() {
      return { id: 'reset', name: 'Reset User' }
    },
    verification: {
      async consume() {
        return { id: 'verified', name: 'Verified User' }
      },
      async resend() {},
    },
  }

  function controller(panelId: string, guard: string): PanelAuthController<Actor> {
    return new PanelAuthController({
      access,
      auth,
      guard,
      panelId,
      passwordBroker: null,
      routes: {
        loginRedirect: `/${panelId}`,
        logoutRedirect: `/${panelId}/login`,
        multiFactorChallenge: `/${panelId}/mfa-challenge`,
        multiFactorRedirect: `/${panelId}`,
      },
      services: undefined,
      tenant: undefined,
    })
  }

  return { access, controller }
}

describe('panel auth guard isolation', () => {
  it('shares authentication between same-guard panels while retaining the authenticating panel identity', async () => {
    const { access, controller } = authFixture()
    const admin = controller('admin', 'staff')
    const operations = controller('operations', 'staff')
    const signal = new AbortController().signal

    await admin.login({ id: 'actor-1', name: 'Ava' }, signal)

    await expect(operations.profile()).resolves.toEqual({ id: 'actor-1', name: 'Ava' })
    expect(access).toHaveBeenCalledWith(expect.objectContaining({ guard: 'staff', panelId: 'admin' }))
  })

  it('isolates different guards and logs out only the selected guard', async () => {
    const { controller } = authFixture()
    const admin = controller('admin', 'staff')
    const vendor = controller('vendor', 'vendors')
    const signal = new AbortController().signal

    await admin.login({ id: 'admin-1' }, signal)
    await vendor.login({ id: 'vendor-1' }, signal)
    await admin.logout()

    await expect(admin.profile()).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(vendor.profile()).resolves.toEqual({ id: 'vendor-1', name: 'vendor-1' })
  })

  it('propagates rotated secure cookies through login, MFA recovery, and logout outcomes', async () => {
    const { access, controller } = authFixture()
    const admin = controller('admin', 'staff')
    const signal = new AbortController().signal

    const pending = await admin.login({ id: 'actor-1', mfa: true }, signal)
    expect(pending).toMatchObject({ redirectTo: '/admin/mfa-challenge', status: 'multi-factor-challenge' })
    expect(pending.cookies).toEqual(['staff_session=pending-1; HttpOnly; Secure; SameSite=Lax'])
    expect(access).not.toHaveBeenCalled()

    const authenticated = await admin.recoverMultiFactor('recovery-code', signal)
    expect(authenticated).toMatchObject({ redirectTo: '/admin', status: 'authenticated' })
    expect(authenticated.cookies).toEqual(['staff_session=revision-2; HttpOnly; Secure; SameSite=Lax'])
    expect(access).toHaveBeenCalledOnce()

    await expect(admin.logout()).resolves.toEqual({
      cookies: ['staff_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0'],
      guard: 'staff',
      redirectTo: '/admin/login',
    })
  })

  it('clears only the denied panel guard after post-authentication authorization fails', async () => {
    const { controller } = authFixture()
    const restricted = controller('restricted', 'staff')
    const vendor = controller('vendor', 'vendors')
    const signal = new AbortController().signal

    await vendor.login({ id: 'vendor-1' }, signal)
    await expect(restricted.login({ id: 'denied' }, signal)).rejects.toMatchObject({ code: 'access-denied' })

    await expect(restricted.profile()).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(vendor.profile()).resolves.toEqual({ id: 'vendor-1', name: 'vendor-1' })
  })
})
