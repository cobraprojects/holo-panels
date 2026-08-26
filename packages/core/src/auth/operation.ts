import { AuthControllerError, createPanelAuthController, type PanelAuthRuntime } from './controller'
import type { CompiledPanelDefinition } from '../panels/contracts'
import type { JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'

export type PanelAuthOperation =
  | 'email-verification-resend'
  | 'email-verification-verify'
  | 'login'
  | 'logout'
  | 'mfa-challenge'
  | 'mfa-disable'
  | 'mfa-enrollment-begin'
  | 'mfa-enrollment-confirm'
  | 'mfa-recovery'
  | 'mfa-recovery-codes-regenerate'
  | 'mfa-status'
  | 'password-reset-request'
  | 'password-reset'
  | 'presentation'
  | 'profile-read'
  | 'profile-update'
  | 'registration'

export interface ExecutePanelAuthOperationOptions<TActor, TTenant, TServices> {
  readonly auth: PanelAuthRuntime<TActor>
  readonly operation: PanelAuthOperation
  readonly panel: CompiledPanelDefinition<TActor>
  readonly payload: unknown
  readonly services: TServices
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export type PanelAuthOperationOutcome = Readonly<{
  readonly cookies: readonly string[]
  readonly data: JsonValue
  readonly redirectTo: string | null
  readonly status: 200 | 204 | 303
}>

export interface PanelAuthPresentation {
  readonly appearance: Readonly<{
    readonly colors: Readonly<Record<string, string>>
    readonly density: 'comfortable' | 'compact'
    readonly fontFamily: string | null
    readonly monoFontFamily: string | null
    readonly serifFontFamily: string | null
    readonly tokens: Readonly<Record<string, string>>
  }>
  readonly brandName: string
  readonly forgotPasswordPath: string | null
  readonly loginPath: string | null
  readonly registrationPath: string | null
  readonly simplePageMaxContentWidth: string
  readonly theme: 'dark' | 'light' | 'system'
}

type Input = Readonly<Record<string, unknown>>

const MAX_SCALAR_LENGTH = 4096
const MAX_CREDENTIAL_FIELDS = 32

function inputObject(value: unknown): Input {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new AuthControllerError('profile-input-invalid', 'Panel authentication input must be an object')
  }
  return value as Input
}

function exactInput(value: unknown, fields: readonly string[]): Input {
  const input = inputObject(value)
  const keys = Object.keys(input)
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) {
    throw new AuthControllerError('profile-input-invalid', 'Panel authentication input contains unsupported fields')
  }
  return input
}

function scalar(input: Input, field: string): string {
  const value = input[field]
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SCALAR_LENGTH) {
    throw new AuthControllerError('profile-input-invalid', `Panel authentication field "${field}" is invalid`)
  }
  return value
}

function credentials(value: unknown): Readonly<Record<string, unknown>> {
  const input = inputObject(value)
  const entries = Object.entries(input)
  if (entries.length === 0 || entries.length > MAX_CREDENTIAL_FIELDS) {
    throw new AuthControllerError('profile-input-invalid', 'Panel login credentials are invalid')
  }
  for (const [field, credential] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(field)) throw new AuthControllerError('profile-input-invalid', 'Panel login credential names are invalid')
    if (typeof credential === 'string' && credential.length <= MAX_SCALAR_LENGTH) continue
    if (typeof credential === 'boolean' || typeof credential === 'number' && Number.isFinite(credential)) continue
    throw new AuthControllerError('profile-input-invalid', `Panel login credential "${field}" is invalid`)
  }
  return Object.freeze({ ...input })
}

function loginInput(value: unknown): Readonly<{ readonly credentials: Readonly<Record<string, unknown>>, readonly destination: string | null }> {
  const input = inputObject(value)
  const keys = Object.keys(input)
  if (!keys.includes('credentials') || keys.some(key => key !== 'credentials' && key !== 'destination')) {
    throw new AuthControllerError('profile-input-invalid', 'Panel authentication input contains unsupported fields')
  }
  const destination = input.destination
  if (destination !== undefined && typeof destination !== 'string') {
    throw new AuthControllerError('profile-input-invalid', 'Panel login destination is invalid')
  }
  return Object.freeze({ credentials: credentials(input.credentials), destination: destination ?? null })
}

function panelLoginDestination(value: string | null, panelPath: string): string | null {
  if (value === null) return null
  const candidate = value.trim()
  const path = candidate.split('?', 1)[0] ?? ''
  if (!candidate || candidate.length > MAX_SCALAR_LENGTH || !candidate.startsWith('/') || path.includes('//') || candidate.includes('\\') || candidate.includes('#')) {
    throw new AuthControllerError('profile-input-invalid', 'Panel login destination is invalid')
  }
  if ([...candidate].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127) || /%(?:2e|2f|5c)/iu.test(candidate)) {
    throw new AuthControllerError('profile-input-invalid', 'Panel login destination is invalid')
  }
  const destination = new URL(candidate, 'https://holo.invalid')
  if (destination.origin !== 'https://holo.invalid') throw new AuthControllerError('profile-input-invalid', 'Panel login destination is invalid')
  if (panelPath !== '/' && destination.pathname !== panelPath && !destination.pathname.startsWith(`${panelPath}/`)) {
    throw new AuthControllerError('profile-input-invalid', 'Panel login destination must remain inside the fixed panel path')
  }
  return `${destination.pathname}${destination.search}`
}

function sessionInput(value: unknown): Readonly<{ readonly code: string, readonly destination: string | null }> {
  const input = inputObject(value)
  const keys = Object.keys(input)
  if (!keys.includes('code') || keys.some(key => key !== 'code' && key !== 'destination')) {
    throw new AuthControllerError('profile-input-invalid', 'Panel authentication input contains unsupported fields')
  }
  const destination = input.destination
  if (destination !== undefined && typeof destination !== 'string') {
    throw new AuthControllerError('profile-input-invalid', 'Panel login destination is invalid')
  }
  return Object.freeze({ code: scalar(input, 'code'), destination: destination ?? null })
}

function method(input: Input): 'recovery' | 'totp' {
  const value = input.method
  if (value !== 'recovery' && value !== 'totp') throw new AuthControllerError('profile-input-invalid', 'Panel MFA method is invalid')
  return value
}

function outcome(data: unknown, status: 200 | 204 = 200): PanelAuthOperationOutcome {
  return Object.freeze({ cookies: Object.freeze([]), data: status === 204 ? null : toJsonValue(data), redirectTo: null, status })
}

function redirectOutcome(cookies: readonly string[], data: unknown, redirectTo: string): PanelAuthOperationOutcome {
  return Object.freeze({ cookies: Object.freeze([...cookies]), data: toJsonValue(data), redirectTo, status: 303 })
}

export function panelAuthPresentation<TActor>(panel: CompiledPanelDefinition<TActor>): PanelAuthPresentation {
  return Object.freeze({
    appearance: Object.freeze({
      colors: Object.freeze({ ...panel.manifest.theme.colors }) as Readonly<Record<string, string>>,
      density: panel.manifest.theme.density,
      fontFamily: panel.manifest.theme.fontFamily,
      monoFontFamily: panel.manifest.theme.monoFontFamily ?? null,
      serifFontFamily: panel.manifest.theme.serifFontFamily ?? null,
      tokens: Object.freeze({ ...panel.manifest.theme.tokens }) as Readonly<Record<string, string>>,
    }),
    brandName: panel.manifest.branding.name,
    forgotPasswordPath: panel.manifest.auth?.passwordReset?.requestPath ?? null,
    loginPath: panel.manifest.auth?.login?.path ?? null,
    registrationPath: panel.manifest.auth?.registration?.path ?? null,
    simplePageMaxContentWidth: panel.manifest.layout?.simplePageMaxContentWidth ?? 'lg',
    theme: panel.manifest.theme.darkMode,
  })
}

export async function executePanelAuthOperation<TActor, TTenant, TServices>(
  options: ExecutePanelAuthOperationOptions<TActor, TTenant, TServices>,
): Promise<PanelAuthOperationOutcome> {
  const input = inputObject(options.payload)

  if (options.operation === 'presentation') {
    exactInput(input, [])
    return outcome(panelAuthPresentation(options.panel))
  }

  const controller = createPanelAuthController(options)

  switch (options.operation) {
    case 'login': {
      const login = loginInput(input)
      const destination = panelLoginDestination(login.destination, options.panel.manifest.path)
      const result = await controller.login(login.credentials, options.signal)
      const redirectTo = result.status === 'authenticated' && destination
        ? destination
        : result.status === 'multi-factor-challenge' && destination
          ? `${result.redirectTo}?next=${encodeURIComponent(destination)}`
          : result.redirectTo
      return redirectOutcome(result.cookies, result.status === 'multi-factor-challenge'
        ? { expiresAt: result.expiresAt.toISOString(), recoveryAllowed: result.recoveryAllowed, status: result.status }
        : { status: result.status }, redirectTo)
    }
    case 'logout': {
      exactInput(input, [])
      const result = await controller.logout()
      return redirectOutcome(result.cookies, { guard: result.guard }, result.redirectTo)
    }
    case 'registration': {
      const exact = exactInput(input, ['credentials'])
      await controller.register(credentials(exact.credentials))
      return redirectOutcome([], { status: 'registered' }, options.panel.manifest.auth?.registration?.redirectTo ?? options.panel.manifest.path)
    }
    case 'profile-read':
      exactInput(input, [])
      return outcome(await controller.profilePage(options.signal))
    case 'profile-update': {
      const exact = exactInput(input, ['values'])
      await controller.updateProfile(inputObject(exact.values), options.signal)
      return outcome(null)
    }
    case 'password-reset-request': {
      const exact = exactInput(input, ['email'])
      await controller.requestPasswordReset(scalar(exact, 'email'))
      return outcome(null, 204)
    }
    case 'password-reset': {
      const exact = exactInput(input, ['password', 'passwordConfirmation', 'token'])
      await controller.resetPassword({
        password: scalar(exact, 'password'),
        passwordConfirmation: scalar(exact, 'passwordConfirmation'),
        token: scalar(exact, 'token'),
      })
      return outcome(null, 204)
    }
    case 'email-verification-resend':
      exactInput(input, [])
      await controller.resendEmailVerification()
      return outcome(null, 204)
    case 'email-verification-verify': {
      const exact = exactInput(input, ['token'])
      await controller.verifyEmail(scalar(exact, 'token'))
      return outcome(null, 204)
    }
    case 'mfa-status':
      exactInput(input, [])
      return outcome(await controller.multiFactorStatus())
    case 'mfa-enrollment-begin': {
      exactInput(input, [])
      const result = await controller.beginMultiFactorEnrollment()
      return outcome({ ...result, expiresAt: result.expiresAt.toISOString() })
    }
    case 'mfa-enrollment-confirm': {
      const exact = exactInput(input, ['code'])
      return outcome(await controller.confirmMultiFactorEnrollment(scalar(exact, 'code')))
    }
    case 'mfa-challenge': {
      const session = sessionInput(input)
      const destination = panelLoginDestination(session.destination, options.panel.manifest.path)
      const result = await controller.challengeMultiFactor(session.code, options.signal)
      return redirectOutcome(result.cookies, { status: result.status }, destination ?? result.redirectTo)
    }
    case 'mfa-recovery': {
      const session = sessionInput(input)
      const destination = panelLoginDestination(session.destination, options.panel.manifest.path)
      const result = await controller.recoverMultiFactor(session.code, options.signal)
      return redirectOutcome(result.cookies, { status: result.status }, destination ?? result.redirectTo)
    }
    case 'mfa-disable': {
      const exact = exactInput(input, ['code', 'method'])
      await controller.disableMultiFactor({ code: scalar(exact, 'code'), method: method(exact) })
      return outcome(null, 204)
    }
    case 'mfa-recovery-codes-regenerate': {
      const exact = exactInput(input, ['code', 'method'])
      return outcome(await controller.regenerateMultiFactorRecoveryCodes({ code: scalar(exact, 'code'), method: method(exact) }))
    }
  }
}

export function panelAuthOperationStatus(error: AuthControllerError): 401 | 403 | 404 | 422 {
  if (error.code === 'unauthenticated') return 401
  if (error.code === 'access-denied') return 403
  if (error.code === 'auth-unavailable' || error.code === 'multi-factor-unavailable' || error.code === 'password-reset-unavailable' || error.code === 'profile-unavailable' || error.code === 'registration-unavailable') return 404
  return 422
}
