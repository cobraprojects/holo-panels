import type { CompiledSchema } from '../schemas/contracts'

export interface PanelAuthContext<TActor, TTenant, TServices> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly provider: string | null
  readonly services: TServices
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface PanelLoginPageConfiguration {
  readonly path?: string
  readonly redirectTo?: string
}

export interface PanelLogoutPageConfiguration {
  readonly path?: string
  readonly redirectTo?: string
}

export interface PanelPasswordResetPageConfiguration {
  readonly broker: string
  readonly requestPath?: string
  readonly resetPath?: string
  readonly redirectTo?: string
}

export interface PanelEmailVerificationPageConfiguration {
  readonly path?: string
  readonly redirectTo?: string
  readonly verificationPath?: string
}

export interface PanelEmailChangeVerificationPageConfiguration {
  readonly path?: string
  readonly redirectTo?: string
}

export interface PanelRegistrationPageConfiguration {
  readonly path?: string
  readonly redirectTo?: string
}

export interface PanelMultiFactorPageConfiguration {
  readonly challengePath?: string
  readonly enrollmentPath?: string
  readonly recoveryCodesPath?: string
  readonly redirectTo?: string
}

export interface PanelProfilePageConfiguration<
  TValues extends Readonly<Record<string, unknown>>,
  TField extends Extract<keyof TValues, string>,
  TActor,
  TTenant,
  TServices,
> {
  readonly fields: readonly TField[]
  readonly path?: string
  readonly schema: CompiledSchema<TValues, PanelAuthContext<TActor, TTenant, TServices>>
  values(
    context: PanelAuthContext<TActor, TTenant, TServices>,
  ): TValues | Promise<TValues>
  update(
    context: PanelAuthContext<TActor, TTenant, TServices>,
    input: Readonly<Pick<TValues, TField>>,
  ): void | Promise<void>
}

export interface PanelAuthPageConfiguration<
  TProfileValues extends Readonly<Record<string, unknown>>,
  TProfileField extends Extract<keyof TProfileValues, string>,
  TActor,
  TTenant,
  TServices,
> {
  readonly emailChangeVerification?: boolean | PanelEmailChangeVerificationPageConfiguration
  readonly emailVerification?: boolean | PanelEmailVerificationPageConfiguration
  readonly login?: boolean | PanelLoginPageConfiguration
  readonly logout?: boolean | PanelLogoutPageConfiguration
  readonly multiFactor?: boolean | PanelMultiFactorPageConfiguration
  readonly passwordReset?: false | PanelPasswordResetPageConfiguration
  readonly registration?: boolean | PanelRegistrationPageConfiguration
  readonly revealablePasswords?: boolean
  readonly profile?: boolean | PanelProfilePageConfiguration<
    TProfileValues,
    TProfileField,
    TActor,
    TTenant,
    TServices
  >
}

export interface PanelAuthPathManifest {
  readonly path: string
  readonly redirectTo: string
}

export interface PanelPasswordResetManifest {
  readonly requestPath: string
  readonly resetPath: string
  readonly redirectTo: string
}

export interface PanelEmailVerificationManifest extends PanelAuthPathManifest {
  readonly verificationPath: string
}

export interface PanelMultiFactorManifest {
  readonly challengePath: string
  readonly enrollmentPath: string
  readonly recoveryCodesPath: string
  readonly redirectTo: string
}

export interface PanelProfileManifest {
  readonly path: string
}

export interface PanelAuthManifest {
  readonly emailChangeVerification: PanelAuthPathManifest | null
  readonly emailVerification: PanelEmailVerificationManifest | null
  readonly login: PanelAuthPathManifest | null
  readonly logout: PanelAuthPathManifest | null
  readonly multiFactor: PanelMultiFactorManifest | null
  readonly passwordReset: PanelPasswordResetManifest | null
  readonly profile: PanelProfileManifest | null
  readonly registration: PanelAuthPathManifest | null
  readonly revealablePasswords?: boolean
}

export interface CompiledPanelProfileServer<TActor> {
  readonly fields: readonly string[]
  readonly schema: CompiledSchema<Readonly<Record<string, unknown>>, PanelAuthContext<TActor, unknown, unknown>>
  update(
    context: PanelAuthContext<TActor, unknown, unknown>,
    input: Readonly<Record<string, unknown>>,
  ): void | Promise<void>
  values(
    context: PanelAuthContext<TActor, unknown, unknown>,
  ): Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>
}

export interface CompiledPanelAuthServer<TActor> {
  readonly passwordBroker: string | null
  readonly profile: CompiledPanelProfileServer<TActor> | null
}

export interface CompiledPanelAuth<TActor> {
  readonly manifest: PanelAuthManifest
  readonly server: CompiledPanelAuthServer<TActor>
}
