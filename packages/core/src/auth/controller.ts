import type { CompiledPanelProfileServer, PanelAuthContext } from './contracts'
import type { CompiledPanelDefinition } from '../panels/contracts'

type Awaitable<TValue> = TValue | Promise<TValue>

interface AuthSession<TActor> {
  readonly cookies: readonly string[]
  readonly multiFactorChallenge?: {
    readonly expiresAt: Date
    readonly recoveryAllowed: boolean
    readonly route: string
  }
  readonly user: TActor
}

interface MultiFactorFacade<TActor> {
  beginEnrollment(): Promise<{ readonly expiresAt: Date, readonly manualKey: string, readonly otpauthUri: string }>
  challenge(input: { readonly code: string }): Promise<AuthSession<TActor>>
  confirmEnrollment(input: { readonly code: string }): Promise<{ readonly recoveryCodes: readonly string[] }>
  disable(input: { readonly method: 'recovery' | 'totp', readonly code: string }): Promise<void>
  recover(input: { readonly code: string }): Promise<AuthSession<TActor>>
  regenerateRecoveryCodes(input: { readonly method: 'recovery' | 'totp', readonly code: string }): Promise<{ readonly recoveryCodes: readonly string[] }>
  status(): Promise<{ readonly enabled: boolean, readonly recoveryCodesRemaining: number }>
}

interface SessionGuard<TActor> {
  readonly multiFactor: MultiFactorFacade<TActor>
  login(credentials: Readonly<Record<string, unknown>>): Promise<AuthSession<TActor>>
  logout(): Promise<{ readonly cookies: readonly string[], readonly guard: string }>
  provider(): Promise<string | null>
  refreshUser(): Promise<TActor | null>
  user(): Promise<TActor | null>
}

export interface PanelAuthRuntime<TActor> {
  guard(name: string): SessionGuard<TActor>
  requestPasswordReset(input: { readonly email: string }, options: { readonly broker: string }): Promise<void>
  resetPassword(input: { readonly password: string, readonly passwordConfirmation: string, readonly token: string }): Promise<TActor>
  verification: {
    consume(token: string): Promise<TActor>
    resend(options: { readonly guard: string }): Promise<unknown>
  }
}

interface AuthControllerOptions<TActor, TTenant, TServices> {
  readonly access: (context: Readonly<{
    actor: TActor
    guard: string
    panelId: string
    provider: string | null
    signal: AbortSignal
  }>) => Awaitable<boolean>
  readonly auth: PanelAuthRuntime<TActor>
  readonly guard: string
  readonly panelId: string
  readonly passwordBroker: string | null
  readonly profile?: CompiledPanelProfileServer<TActor>
  readonly routes: {
    readonly loginRedirect: string
    readonly logoutRedirect: string
    readonly multiFactorChallenge: string | null
    readonly multiFactorRedirect: string
  }
  readonly services: TServices
  readonly tenant: TTenant
}

type AuthControllerErrorCode = 'access-denied' | 'auth-unavailable' | 'multi-factor-unavailable' | 'password-reset-unavailable' | 'profile-input-invalid' | 'profile-unavailable' | 'unauthenticated'

export type PanelAuthSessionOutcome<TActor> = Readonly<{
  actor: TActor
  cookies: readonly string[]
  redirectTo: string
  status: 'authenticated'
}> | Readonly<{
  cookies: readonly string[]
  expiresAt: Date
  recoveryAllowed: boolean
  redirectTo: string
  status: 'multi-factor-challenge'
}>

export interface PanelAuthLogoutOutcome {
  readonly cookies: readonly string[]
  readonly guard: string
  readonly redirectTo: string
}

export class AuthControllerError extends Error {
  constructor(readonly code: AuthControllerErrorCode, message: string) {
    super(message)
    this.name = 'AuthControllerError'
  }
}

const PROFILE_FIELD = /^[a-z][a-zA-Z0-9_]*$/u

function profileFields(fields: readonly string[]): readonly string[] {
  if (fields.length === 0 || fields.some(field => !PROFILE_FIELD.test(field)) || new Set(fields).size !== fields.length) {
    throw new Error('Panel profile fields require unique stable field names')
  }
  return Object.freeze([...fields])
}

function isMultiFactorReauthenticationRequired(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && error.code === 'multi_factor_reauthentication_required'
}

export class PanelAuthController<TActor, TTenant = unknown, TServices = unknown> {
  readonly #access: AuthControllerOptions<TActor, TTenant, TServices>['access']
  readonly #auth: PanelAuthRuntime<TActor>
  readonly #guard: SessionGuard<TActor>
  readonly #guardName: string
  readonly #panelId: string
  readonly #passwordBroker: string | null
  readonly #profile: CompiledPanelProfileServer<TActor> | undefined
  readonly #routes: AuthControllerOptions<TActor, TTenant, TServices>['routes']
  readonly #services: TServices
  readonly #tenant: TTenant

  constructor(options: AuthControllerOptions<TActor, TTenant, TServices>) {
    this.#access = options.access
    this.#auth = options.auth
    this.#guardName = options.guard
    this.#guard = options.auth.guard(options.guard)
    this.#panelId = options.panelId
    this.#passwordBroker = options.passwordBroker
    this.#services = options.services
    this.#tenant = options.tenant
    this.#profile = options.profile
      ? Object.freeze({ ...options.profile, fields: profileFields(options.profile.fields) })
      : undefined
    this.#routes = Object.freeze({ ...options.routes })
  }

  async login(credentials: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<PanelAuthSessionOutcome<TActor>> {
    const session = await this.#guard.login(credentials)
    if (session.multiFactorChallenge) {
      if (this.#routes.multiFactorChallenge === null) {
        throw new AuthControllerError('multi-factor-unavailable', 'Panel MFA challenge is not configured')
      }
      return Object.freeze({
        cookies: session.cookies,
        expiresAt: session.multiFactorChallenge.expiresAt,
        recoveryAllowed: session.multiFactorChallenge.recoveryAllowed,
        redirectTo: this.#routes.multiFactorChallenge,
        status: 'multi-factor-challenge' as const,
      })
    }
    await this.#authorizeSession(session, signal)
    return this.#authenticatedOutcome(session, this.#routes.loginRedirect)
  }

  async logout(): Promise<PanelAuthLogoutOutcome> {
    const outcome = await this.#guard.logout()
    return Object.freeze({ ...outcome, redirectTo: this.#routes.logoutRedirect })
  }

  async profile(): Promise<TActor> {
    const actor = await this.#guard.user()
    if (actor === null) throw new AuthControllerError('unauthenticated', 'Authentication is required to view a panel profile')
    return actor
  }

  async profileValues(signal: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
    const profile = this.#profile
    if (!profile) throw new AuthControllerError('profile-unavailable', 'Panel profiles are not configured')
    const actor = await this.profile()
    const context = await this.#profileContext(actor, signal)
    return profile.values(context)
  }

  async updateProfile(input: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<TActor> {
    const profile = this.#profile
    if (!profile) throw new AuthControllerError('profile-unavailable', 'Panel profile updates are not configured')
    const actor = await this.profile()
    const entries = Object.entries(input)
    if (entries.some(([field]) => !profile.fields.includes(field))) {
      throw new AuthControllerError('profile-input-invalid', 'Panel profile input contains a field that is not allowed')
    }
    const context = await this.#profileContext(actor, signal)
    await profile.update(context, Object.freeze(Object.fromEntries(entries)))
    const refreshed = await this.#guard.refreshUser()
    if (refreshed === null) throw new AuthControllerError('unauthenticated', 'Authentication ended while updating the panel profile')
    await this.#authorize(refreshed, context.provider, signal)
    return refreshed
  }

  requestPasswordReset(email: string): Promise<void> {
    if (this.#passwordBroker === null) {
      throw new AuthControllerError('password-reset-unavailable', 'Panel password reset is not configured')
    }
    return this.#auth.requestPasswordReset({ email }, { broker: this.#passwordBroker })
  }

  resetPassword(input: { readonly password: string, readonly passwordConfirmation: string, readonly token: string }): Promise<TActor> {
    return this.#auth.resetPassword(input)
  }

  resendEmailVerification(): Promise<unknown> {
    return this.#auth.verification.resend({ guard: this.#guardName })
  }

  verifyEmail(token: string): Promise<TActor> {
    return this.#auth.verification.consume(token)
  }

  multiFactorStatus(): Promise<{ readonly enabled: boolean, readonly recoveryCodesRemaining: number }> {
    return this.#guard.multiFactor.status()
  }

  async beginMultiFactorEnrollment(): Promise<{ readonly expiresAt: Date, readonly manualKey: string, readonly otpauthUri: string }> {
    try {
      return await this.#guard.multiFactor.beginEnrollment()
    } catch (error) {
      if (isMultiFactorReauthenticationRequired(error)) {
        throw new AuthControllerError('unauthenticated', 'Recent authentication is required to enroll multi-factor authentication')
      }
      throw error
    }
  }

  confirmMultiFactorEnrollment(code: string): Promise<{ readonly recoveryCodes: readonly string[] }> {
    return this.#guard.multiFactor.confirmEnrollment({ code })
  }

  async challengeMultiFactor(code: string, signal: AbortSignal): Promise<PanelAuthSessionOutcome<TActor>> {
    const session = await this.#guard.multiFactor.challenge({ code })
    await this.#authorizeSession(session, signal)
    return this.#authenticatedOutcome(session, this.#routes.multiFactorRedirect)
  }

  async recoverMultiFactor(code: string, signal: AbortSignal): Promise<PanelAuthSessionOutcome<TActor>> {
    const session = await this.#guard.multiFactor.recover({ code })
    await this.#authorizeSession(session, signal)
    return this.#authenticatedOutcome(session, this.#routes.multiFactorRedirect)
  }

  disableMultiFactor(input: { readonly method: 'recovery' | 'totp', readonly code: string }): Promise<void> {
    return this.#guard.multiFactor.disable(input)
  }

  regenerateMultiFactorRecoveryCodes(input: { readonly method: 'recovery' | 'totp', readonly code: string }): Promise<{ readonly recoveryCodes: readonly string[] }> {
    return this.#guard.multiFactor.regenerateRecoveryCodes(input)
  }

  async #authorizeSession(session: AuthSession<TActor>, signal: AbortSignal): Promise<void> {
    const provider = await this.#guard.provider()
    try {
      await this.#authorize(session.user, provider, signal)
    } catch (error) {
      await this.#guard.logout()
      throw error
    }
  }

  async #authorize(actor: TActor, provider: string | null, signal: AbortSignal): Promise<void> {
    const allowed = await this.#access(Object.freeze({ actor, guard: this.#guardName, panelId: this.#panelId, provider, signal }))
    if (!allowed) throw new AuthControllerError('access-denied', `Access to panel "${this.#panelId}" was denied after authentication`)
  }

  #authenticatedOutcome(session: AuthSession<TActor>, redirectTo: string): PanelAuthSessionOutcome<TActor> {
    return Object.freeze({ actor: session.user, cookies: session.cookies, redirectTo, status: 'authenticated' as const })
  }

  async #profileContext(actor: TActor, signal: AbortSignal): Promise<PanelAuthContext<TActor, unknown, unknown>> {
    return Object.freeze({
      actor,
      guard: this.#guardName,
      panelId: this.#panelId,
      provider: await this.#guard.provider(),
      services: this.#services,
      signal,
      tenant: this.#tenant,
    })
  }
}

export function createPanelAuthController<TActor, TTenant = unknown, TServices = unknown>(options: Readonly<{
  auth: PanelAuthRuntime<TActor>
  panel: CompiledPanelDefinition<TActor>
  services: TServices
  tenant: TTenant
}>): PanelAuthController<TActor, TTenant, TServices> {
  const manifest = options.panel.manifest.auth
  const server = options.panel.server.auth
  if (manifest === null || !server) throw new AuthControllerError('auth-unavailable', 'Panel authentication pages are not configured')
  return new PanelAuthController({
    access: context => options.panel.server.access({ ...context, operation: 'bootstrap' }),
    auth: options.auth,
    guard: options.panel.guard,
    panelId: options.panel.manifest.id,
    passwordBroker: server.passwordBroker,
    profile: server.profile ?? undefined,
    routes: {
      loginRedirect: manifest.login?.redirectTo ?? options.panel.manifest.path,
      logoutRedirect: manifest.logout?.redirectTo ?? manifest.login?.path ?? options.panel.manifest.path,
      multiFactorChallenge: manifest.multiFactor?.challengePath ?? null,
      multiFactorRedirect: manifest.multiFactor?.redirectTo ?? options.panel.manifest.path,
    },
    services: options.services,
    tenant: options.tenant,
  })
}
