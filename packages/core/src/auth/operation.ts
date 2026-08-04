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
  | 'profile-read'
  | 'profile-update'

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

export async function executePanelAuthOperation<TActor, TTenant, TServices>(
  options: ExecutePanelAuthOperationOptions<TActor, TTenant, TServices>,
): Promise<PanelAuthOperationOutcome> {
  const controller = createPanelAuthController(options)
  const input = inputObject(options.payload)

  switch (options.operation) {
    case 'login': {
      const exact = exactInput(input, ['credentials'])
      const result = await controller.login(credentials(exact.credentials), options.signal)
      return redirectOutcome(result.cookies, result.status === 'multi-factor-challenge'
        ? { expiresAt: result.expiresAt.toISOString(), recoveryAllowed: result.recoveryAllowed, status: result.status }
        : { status: result.status }, result.redirectTo)
    }
    case 'logout': {
      exactInput(input, [])
      const result = await controller.logout()
      return redirectOutcome(result.cookies, { guard: result.guard }, result.redirectTo)
    }
    case 'profile-read':
      exactInput(input, [])
      return outcome(await controller.profileValues(options.signal))
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
      const exact = exactInput(input, ['code'])
      const result = await controller.challengeMultiFactor(scalar(exact, 'code'), options.signal)
      return redirectOutcome(result.cookies, { status: result.status }, result.redirectTo)
    }
    case 'mfa-recovery': {
      const exact = exactInput(input, ['code'])
      const result = await controller.recoverMultiFactor(scalar(exact, 'code'), options.signal)
      return redirectOutcome(result.cookies, { status: result.status }, result.redirectTo)
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
  if (error.code === 'auth-unavailable' || error.code === 'multi-factor-unavailable' || error.code === 'password-reset-unavailable' || error.code === 'profile-unavailable') return 404
  return 422
}
