# P14-C panel auth pages public API proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

This proposal adds one panel-builder method. It does not add a client-selected guard, provider, or password broker, and it does not expose cookie or redirect handling from the framework adapters.

```ts
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
  readonly emailVerification?: boolean | PanelEmailVerificationPageConfiguration
  readonly login?: boolean | PanelLoginPageConfiguration
  readonly logout?: boolean | PanelLogoutPageConfiguration
  readonly multiFactor?: boolean | PanelMultiFactorPageConfiguration
  readonly passwordReset?: false | PanelPasswordResetPageConfiguration
  readonly profile?: false | PanelProfilePageConfiguration<
    TProfileValues,
    TProfileField,
    TActor,
    TTenant,
    TServices
  >
}

export class PanelBuilder<TActor = unknown> {
  auth<
    TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
    TProfileField extends Extract<keyof TProfileValues, string> = Extract<keyof TProfileValues, string>,
    TTenant = unknown,
    TServices = unknown,
  >(
    options: PanelAuthPageConfiguration<
      TProfileValues,
      TProfileField,
      TActor,
      TTenant,
      TServices
    >,
  ): this
}
```

## Exact behavior

- `panel.guard(...)` is the only source of the auth guard. No page request contains a guard or provider field.
- `passwordReset.broker` is compiled into server-only panel state. It is never included in a client manifest or accepted in an operation payload.
- `profile.fields` is the complete mutation allow-list. Unknown input fields reject the request before `update` runs. Panels never call a Holo provider adapter or model update method directly.
- `profile.update` is application-owned persistence. After it succeeds, Panels calls the selected Holo Auth guard's `refreshUser()` and re-runs panel access.
- Login delegates to `auth.guard(panel.guard).login(...)`. A pending Holo Auth MFA challenge does not produce an authenticated panel bootstrap.
- MFA enrollment, confirmation, challenge, recovery, disable, status, and recovery-code regeneration delegate only to `auth.guard(panel.guard).multiFactor`.
- Password reset request delegates to Holo Auth with the compiled broker. Password reset consumption delegates the opaque token to Holo Auth without accepting a broker from the client.
- Email verification resend passes the compiled guard to Holo Auth. Verification consumption delegates the opaque token to Holo Auth without accepting a guard or provider from the client.
- Successful login, MFA challenge, and MFA recovery re-run panel access. Denial logs out only the selected panel guard before returning a forbidden result.
- Same-guard panels naturally share the Holo session. Different-guard panels resolve independent Holo Auth guards. Logout affects only the selected panel guard.
- All configured paths and redirect destinations use the existing safe panel-route normalization and remain within the fixed panel path. For panel login, Holo Auth's pending MFA challenge is treated only as server state and the adapter redirects to the panel's compiled `challengePath`. Holo Auth's guard-global `challengeRoute` remains available to standalone Auth consumers but is not reused as a panel route.
- Controllers return framework-neutral outcomes. Next.js, Nuxt, and SvelteKit adapters retain responsibility for their native redirects, errors, cookie APIs, and Holo request context.

## Defaults

- `true` enables the page with panel-relative default paths.
- Login defaults to `login`; logout to `logout`; profile to `profile`; email verification to `verify-email`.
- Login and MFA success redirect to the panel root unless `redirectTo` is configured.
- Logout redirects to the panel login path unless `redirectTo` is configured.
- The MFA challenge defaults to `mfa-challenge`; enrollment defaults to `profile/mfa`; recovery codes default to `profile/mfa/recovery-codes`.
- Password reset has no boolean shorthand because its server-only broker mapping must be explicit.
- Profile has no boolean shorthand because an application-owned schema, values loader, field allow-list, and updater are mandatory.
