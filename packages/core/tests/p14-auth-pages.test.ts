import { describe, expect, expectTypeOf, it } from 'vitest'
import { definePanel, type PanelBuilder } from '../src/panels/panel'
import { defineSchema } from '../src/schemas/builder'
import type { PanelAuthContext } from '../src/auth/contracts'

class Actor {
  declare readonly id: number
  declare readonly name: string
}

class ProfileValues implements Readonly<Record<string, unknown>> {
  readonly [key: string]: unknown
  declare readonly email: string
  declare readonly name: string
}

class Tenant {
  declare readonly id: string
}

class Services {
  declare readonly audit: boolean
}

class ProfileContext implements PanelAuthContext<Actor, Tenant, Services> {
  declare readonly actor: Actor
  declare readonly guard: string
  declare readonly panelId: string
  declare readonly provider: string | null
  declare readonly services: Services
  declare readonly signal: AbortSignal
  declare readonly tenant: Tenant
}

function profileSchema() {
  return defineSchema('profile', ProfileValues, ProfileContext).compile()
}

describe('panel auth page compilation', () => {
  it('preserves the concrete panel builder and applies panel-relative defaults', () => {
    const panel = definePanel('admin', Actor).path('control').auth({
      emailVerification: true,
      login: true,
      logout: true,
      multiFactor: true,
      passwordReset: { broker: 'users' },
    })
    const definition = panel.compile()

    expectTypeOf(panel).toEqualTypeOf<PanelBuilder<Actor>>()
    expect(definition.manifest.auth).toEqual({
      emailChangeVerification: null,
      emailVerification: { path: '/control/verify-email', redirectTo: '/control', verificationPath: '/control/email/verify' },
      login: { path: '/control/login', redirectTo: '/control' },
      logout: { path: '/control/logout', redirectTo: '/control/login' },
      multiFactor: {
        challengePath: '/control/mfa-challenge',
        enrollmentPath: '/control/profile/mfa',
        recoveryCodesPath: '/control/profile/mfa/recovery-codes',
        redirectTo: '/control',
      },
      passwordReset: {
        requestPath: '/control/forgot-password',
        resetPath: '/control/reset-password',
        redirectTo: '/control',
      },
      profile: null,
      registration: null,
      revealablePasswords: true,
    })
    expect(definition.server.auth?.passwordBroker).toBe('users')
    expect(JSON.stringify(definition.manifest)).not.toContain('users')
  })

  it('normalizes custom routes against the final panel path and rejects escapes', () => {
    const definition = definePanel('admin')
      .auth({
        login: { path: 'sign-in', redirectTo: 'dashboard' },
        logout: true,
        multiFactor: { challengePath: 'challenge', redirectTo: 'dashboard' },
      })
      .path('back-office')
      .compile()

    expect(definition.manifest.auth?.login).toEqual({ path: '/back-office/sign-in', redirectTo: '/back-office/dashboard' })
    expect(definition.manifest.auth?.logout?.redirectTo).toBe('/back-office/sign-in')
    expect(definition.manifest.auth?.multiFactor?.challengePath).toBe('/back-office/challenge')
    expect(() => definePanel('unsafe').auth({ login: { path: '../vendor' } }).compile()).toThrow('safe panel route')
    expect(() => definePanel('unsafe').auth({ login: { redirectTo: '/vendor' } }).compile()).toThrow('fixed panel path')
  })

  it('keeps profile schema and callbacks in server state with typed context and field allow-list', () => {
    const schema = profileSchema()
    const definition = definePanel('admin', Actor).auth({ services: Services, tenant: Tenant }, {
      profile: {
        fields: ['name'],
        schema,
        update: async (context, input) => {
          expectTypeOf(context.actor).toEqualTypeOf<Actor>()
          expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
          expectTypeOf(context.services).toEqualTypeOf<Services>()
          expectTypeOf(input).toEqualTypeOf<Readonly<Pick<ProfileValues, 'name'>>>()
        },
        values: async context => {
          expectTypeOf(context.actor).toEqualTypeOf<Actor>()
          expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
          expectTypeOf(context.services).toEqualTypeOf<Services>()
          return { email: `${context.actor.id}@example.com`, name: context.actor.name }
        },
      },
    }).compile()

    expect(definition.manifest.auth?.profile).toEqual({ path: '/admin/profile' })
    expect(definition.server.auth?.profile?.fields).toEqual(['name'])
    expect(definition.server.auth?.profile?.schema).toBe(schema)
    expect(JSON.stringify(definition.manifest.auth)).not.toContain('components')
    expect(JSON.stringify(definition.manifest.auth)).not.toContain('fields')
    expect(() => definePanel('duplicate', Actor).auth({ login: true }).auth({ logout: true })).toThrow('already configured')
  })

  it('rejects invalid server-only profile and password broker configuration', () => {
    expect(() => definePanel('admin', Actor).auth({ services: Services, tenant: Tenant }, {
      profile: {
        fields: [],
        schema: profileSchema(),
        update: async () => {},
        values: async () => ({ email: '', name: '' }),
      },
    }).compile()).toThrow('unique stable field names')
    expect(() => definePanel('admin').auth({ passwordReset: { broker: ' ' } }).compile()).toThrow('requires a broker')
  })
})
