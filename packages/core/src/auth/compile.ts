import type {
  CompiledPanelAuth,
  CompiledPanelProfileServer,
  PanelAuthContext,
  PanelAuthPageConfiguration,
  PanelAuthPathManifest,
  PanelEmailVerificationPageConfiguration,
  PanelLoginPageConfiguration,
  PanelLogoutPageConfiguration,
  PanelMultiFactorManifest,
  PanelMultiFactorPageConfiguration,
  PanelPasswordResetManifest,
} from './contracts'

type RouteNormalizer = (value: string, label: string) => string

const PROFILE_FIELD = /^[a-z][a-zA-Z0-9_]*$/u

interface CompilePanelAuthOptions {
  readonly panelPath: string
  readonly route: RouteNormalizer
}

function pathManifest<TConfiguration extends { readonly path?: string, readonly redirectTo?: string }>(
  configuration: TConfiguration | null,
  defaultPath: string,
  defaultRedirect: string,
  route: RouteNormalizer,
  label: string,
): PanelAuthPathManifest | null {
  if (configuration === null) return null
  return Object.freeze({
    path: route(configuration.path ?? defaultPath, `${label} path`),
    redirectTo: route(configuration.redirectTo ?? defaultRedirect, `${label} redirect`),
  })
}

function compileMultiFactor(
  configuration: Readonly<Partial<PanelMultiFactorPageConfiguration>> | null,
  panelPath: string,
  route: RouteNormalizer,
): PanelMultiFactorManifest | null {
  if (configuration === null) return null
  return Object.freeze({
    challengePath: route(configuration.challengePath ?? 'mfa-challenge', 'Panel MFA challenge path'),
    enrollmentPath: route(configuration.enrollmentPath ?? 'profile/mfa', 'Panel MFA enrollment path'),
    recoveryCodesPath: route(configuration.recoveryCodesPath ?? 'profile/mfa/recovery-codes', 'Panel MFA recovery codes path'),
    redirectTo: route(configuration.redirectTo ?? panelPath, 'Panel MFA redirect'),
  })
}

function compilePasswordReset(
  configuration: false | Readonly<{ readonly broker: string, readonly requestPath?: string, readonly resetPath?: string, readonly redirectTo?: string }> | undefined,
  panelPath: string,
  route: RouteNormalizer,
): { readonly manifest: PanelPasswordResetManifest | null, readonly broker: string | null } {
  if (!configuration) return { broker: null, manifest: null }
  const broker = configuration.broker.trim()
  if (!broker) throw new Error('Panel password reset requires a broker')
  return {
    broker,
    manifest: Object.freeze({
      requestPath: route(configuration.requestPath ?? 'forgot-password', 'Panel password reset request path'),
      resetPath: route(configuration.resetPath ?? 'reset-password', 'Panel password reset path'),
      redirectTo: route(configuration.redirectTo ?? panelPath, 'Panel password reset redirect'),
    }),
  }
}

function profileFields(fields: readonly string[]): readonly string[] {
  if (fields.length === 0 || fields.some(field => !PROFILE_FIELD.test(field)) || new Set(fields).size !== fields.length) {
    throw new Error('Panel profile fields require unique stable field names')
  }
  return Object.freeze([...fields])
}

export function compilePanelAuth<
  TProfileValues extends Readonly<Record<string, unknown>>,
  TProfileField extends Extract<keyof TProfileValues, string>,
  TActor,
  TTenant,
  TServices,
>(
  configuration: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices>,
  options: CompilePanelAuthOptions,
): CompiledPanelAuth<TActor> {
  const login: PanelLoginPageConfiguration | null = configuration.login
    ? configuration.login === true ? {} : configuration.login
    : null
  const logout: PanelLogoutPageConfiguration | null = configuration.logout
    ? configuration.logout === true ? {} : configuration.logout
    : null
  const emailVerification: PanelEmailVerificationPageConfiguration | null = configuration.emailVerification
    ? configuration.emailVerification === true ? {} : configuration.emailVerification
    : null
  const multiFactor: PanelMultiFactorPageConfiguration | null = configuration.multiFactor
    ? configuration.multiFactor === true ? {} : configuration.multiFactor
    : null
  const passwordReset = compilePasswordReset(configuration.passwordReset, options.panelPath, options.route)
  const profileConfiguration = configuration.profile || null
  const profile = profileConfiguration === null
    ? null
    : Object.freeze({ path: options.route(profileConfiguration.path ?? 'profile', 'Panel profile path') })
  const serverProfile: CompiledPanelProfileServer<TActor> | null = profileConfiguration === null
    ? null
    : {
        fields: profileFields(profileConfiguration.fields),
        schema: profileConfiguration.schema as CompiledPanelProfileServer<TActor>['schema'],
        values: context => profileConfiguration.values(context as PanelAuthContext<TActor, TTenant, TServices>),
        update: (context, input) => profileConfiguration.update(
          context as PanelAuthContext<TActor, TTenant, TServices>,
          input as Readonly<Pick<TProfileValues, TProfileField>>,
        ),
      }
  return Object.freeze({
    manifest: Object.freeze({
      emailVerification: pathManifest(emailVerification, 'verify-email', options.panelPath, options.route, 'Panel email verification'),
      login: pathManifest(login, 'login', options.panelPath, options.route, 'Panel login'),
      logout: pathManifest(
        logout,
        'logout',
        login === null ? options.panelPath : login.path ?? 'login',
        options.route,
        'Panel logout',
      ),
      multiFactor: compileMultiFactor(multiFactor, options.panelPath, options.route),
      passwordReset: passwordReset.manifest,
      profile,
    }),
    server: Object.freeze({ passwordBroker: passwordReset.broker, profile: serverProfile === null ? null : Object.freeze(serverProfile) }),
  })
}
