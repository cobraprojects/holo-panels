# P14 completion public API amendment proposal

Status: approved by the user on 2026-07-29. Implementation remains tracked only in the canonical checklist.

## Scope and ownership

Holo Panels remains a separate plugin repository. Holo-JS gains only the command-host capability needed by any application command to use the already-existing runtime and migration system. Prepared panel metadata, Shield policy, Shield seeds, Shield resources, auth dispatch, tenant dispatch, and framework routes remain in Holo Panels packages.

## Holo-JS app-command host amendment

Package: `@holo-js/cli`.

```ts
import type { HoloRuntime } from '@holo-js/core'

export interface HoloAppCommandMigrationOptions {
  readonly names: readonly string[]
  readonly pretend?: boolean
}

export interface HoloAppCommandRuntime {
  readonly holo: HoloRuntime
  migrate(options: HoloAppCommandMigrationOptions): Promise<readonly string[]>
}

export interface CommandExecutionContext {
  readonly projectRoot: string
  readonly cwd: string
  readonly args: readonly string[]
  readonly flags: Readonly<Record<string, CommandFlagValue>>
  loadProject(): Promise<LoadedProjectConfig>
  withRuntime<TResult>(
    operation: (runtime: HoloAppCommandRuntime) => TResult | Promise<TResult>,
  ): Promise<TResult>
}
```

`withRuntime` initializes the existing Holo runtime once, passes the same runtime used by first-party commands, and always shuts it down in `finally`. Nested calls reuse the active same-project runtime and never initialize a second runtime. `migrate` loads application and installed-plugin migration publishers through the existing validated registry, rejects unknown or duplicate names before connecting, and runs only exact allow-listed names through the existing status, transaction, and pretend machinery. It does not accept paths, modules, or migration objects from an app command.

Shield setup calls:

```ts
await context.withRuntime(runtime => runtime.migrate({
  names: ['2026_07_28_000001_create_panel_shield_tables'],
}))
```

No new database, configuration, or migration runtime is introduced.

## Shield prepared metadata and command configuration

Package: `@holo-js/panels-shield`.

```ts
export interface ShieldPreparedRegistryDefinition {
  readonly id: string
  readonly kind: 'action' | 'page' | 'resource' | 'widget'
  readonly panelId: string
  readonly permissionKeys: readonly string[]
}

export interface ShieldPreparedRegistry {
  readonly version: 1
  readonly definitions: readonly ShieldPreparedRegistryDefinition[]
}

export interface ShieldCommandConfiguration {
  readonly allowProductionMutations?: boolean
  readonly connection?: string
  readonly seeds?: readonly ShieldRoleSeed[]
}

export function defineShieldCommandConfiguration(
  configuration: ShieldCommandConfiguration,
): Readonly<ShieldCommandConfiguration>

export function permissionKeysFromPreparedRegistry(
  registry: ShieldPreparedRegistry,
): readonly string[]
```

Application file `config/panels-shield.ts`:

```ts
import { defineShieldCommandConfiguration } from '@holo-js/panels-shield'

export default defineShieldCommandConfiguration({
  allowProductionMutations: false,
  connection: 'default',
  seeds: [],
})
```

Defaults are `allowProductionMutations: false`, the Holo default database connection, and no seeds. Commands load `.holo-js/generated/panels/registry.json` through the existing `@holo-js/panels-cli` loader. The loader output is validated and converted to the structural registry above. Resource, page, widget, plugin `permission-subject`, and custom-action keys must already be present in prepared metadata; runtime commands never import a client-selected module or infer a source path.

Exact command behavior:

- `shield:setup` applies only the named Shield migration.
- `shield:diff` is read-only and works in production.
- `shield:sync` adds missing keys. Stale removal requires both `--remove-stale` and `--confirm`.
- `shield:make-role <id>` creates a non-super-admin, global role whose initial display name equals its ID.
- `shield:seed` applies only validated `config/panels-shield.ts` seeds.
- `setup`, `sync`, `make-role`, and `seed` reject when `app.env === 'production'` unless `allowProductionMutations === true`. Enabling production mutations never removes the stale-removal double confirmation.

## Configurable normal Shield resources

Package: `@holo-js/panels-shield`.

```ts
import type { ResourceBuilder } from '@holo-js/panels'

export interface ShieldResourceContext<TActor extends object, TTenant> {
  readonly actor: TActor | null
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface ShieldResourceOptions<TActor extends object, TTenant> {
  readonly repository: ShieldAdministrationRepository
  readonly tenantId: (
    context: ShieldResourceContext<TActor, TTenant>,
  ) => ShieldTenantId | Promise<ShieldTenantId>
}

export type ShieldRoleResourceBuilder<TActor extends object, TTenant> = ResourceBuilder<
  typeof shieldRoleModel,
  ResourceRecordFor<typeof shieldRoleModel>,
  ReturnType<typeof shieldRoleModel.query>,
  ResourceInput<ResourceRecordFor<typeof shieldRoleModel>>,
  TActor,
  TTenant,
  false
>

export type ShieldPermissionResourceBuilder<TActor extends object, TTenant> = ResourceBuilder<
  typeof shieldPermissionModel,
  ResourceRecordFor<typeof shieldPermissionModel>,
  ReturnType<typeof shieldPermissionModel.query>,
  ResourceInput<ResourceRecordFor<typeof shieldPermissionModel>>,
  TActor,
  TTenant,
  false
>

export function shieldRoleResource<TActor extends object, TTenant>(
  options: ShieldResourceOptions<TActor, TTenant>,
): ShieldRoleResourceBuilder<TActor, TTenant>

export function shieldPermissionResource<TActor extends object, TTenant>(
  options: ShieldResourceOptions<TActor, TTenant>,
): ShieldPermissionResourceBuilder<TActor, TTenant>
```

`shieldRoleModel` and `shieldPermissionModel` are exported server-only from the same package so the aliases above are usable without importing package internals.

Both factories return the standard resource builder, so callers configure labels, navigation, pages, tables, forms, slots, and actions with existing resource APIs. The role resource exposes name, super-admin, role permissions, and actor assignments; tenant identity is server-bound through `tenantId` and is never writable client input. The permission resource is read-only: keys are created or removed only by confirmed Shield synchronization. Repository referential integrity, tenant checks, panel access, Shield permission, Holo class/record policy, and operation invariants are rechecked for every mutation. Configuration cannot make tenant columns writable, permit permission-key editing, or bypass server authorization.

## Framework-neutral auth operation dispatch

Package: `@holo-js/panels-core/server`.

```ts
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

export function executePanelAuthOperation<TActor, TTenant, TServices>(
  options: ExecutePanelAuthOperationOptions<TActor, TTenant, TServices>,
): Promise<PanelAuthOperationOutcome>

export function panelAuthOperationStatus(error: AuthControllerError): 401 | 403 | 404 | 422
```

Each operation has a fixed payload allow-list: login `{ credentials }`; profile update `{ values }`; password-reset request `{ email }`; password reset `{ token, password, passwordConfirmation }`; verification verify `{ token }`; MFA challenge/recovery/enrollment confirmation `{ code }`; MFA disable/recovery-code regeneration `{ method, code }`; all other operations accept `{}`. Unknown fields, invalid shapes, oversized scalar values, and unconfigured operations reject before controller callbacks. The dispatcher never accepts a guard, provider, broker, panel ID, redirect, tenant ID, module, or model from the payload.

## Native adapter routes

The adapters add dedicated fixed routes instead of widening the existing `PanelOperation` transport union.

```ts
// @holo-js/panels-next/server
export type NextRouteHandler = (
  request: Request,
  context: NextPanelRouteContext,
) => Promise<Response>

export interface CreatePanelAuthRouteOptions extends CreatePanelOperationRouteOptions {}
export interface CreatePanelTenantRouteOptions extends CreatePanelOperationRouteOptions {}
export function createPanelAuthRoute(options: CreatePanelAuthRouteOptions): {
  readonly GET: NextRouteHandler
  readonly POST: NextRouteHandler
}
export function createPanelTenantRoute(options: CreatePanelTenantRouteOptions): {
  readonly POST: NextRouteHandler
}

// @holo-js/panels-nuxt/server
export function createPanelAuthHandler(
  options: CreatePanelOperationHandlerOptions,
): EventHandler
export function createPanelTenantHandler(
  options: CreatePanelOperationHandlerOptions,
): EventHandler

// @holo-js/panels-sveltekit/server
export function createPanelAuthHandler<TActor = unknown>(
  options: CreatePanelOperationHandlerOptions<TActor>,
): SvelteKitPanelOperationHandler
export function createPanelTenantHandler<TActor = unknown>(
  options: CreatePanelOperationHandlerOptions<TActor>,
): Pick<SvelteKitPanelOperationHandler, 'POST'>
```

Generated routes are fixed as `/{panelPath}/auth/{operation}` and `/{panelPath}/tenant/switch`; route parameters select only an allow-listed compiled panel and operation. Auth routes execute inside each framework's existing Holo request context, append every returned Holo cookie using the framework-native response API without parsing or weakening its attributes, and issue a native `303` only to the compiled normalized panel-local destination. Tenant routes decode only `{ routeKey: string }`, obtain actor/guard/provider from the authenticated server context, call `executePanelTenantSwitch`, and return `{ tenant }`; 404 hides malformed, unknown, revoked, and unauthorized memberships, while invalid authenticated context maps to 403. All mutation routes use the existing CSRF middleware, request/response byte ceilings, no-store headers, and normalized production errors.

## Old and new usage

Before this amendment, Shield commands could only validate arguments and then fail because `CommandExecutionContext` had no runtime boundary. Auth and tenant behavior could be called from core manually, but every application had to invent cookie, redirect, CSRF, route, and error wiring.

After approval and implementation:

```ts
// unchanged panel declaration
export default definePanel('admin')
  .guard('admin')
  .auth({ login: true, logout: true, multiFactor: true })
  .plugin(shield({ repository, actor, tenant }))

// optional standard resources
export const RoleResource = shieldRoleResource({ repository, tenantId })
  .navigationLabel('Roles')

export const PermissionResource = shieldPermissionResource({ repository, tenantId })
  .navigationLabel('Permissions')
```

Applications use generated framework route files; they do not handle raw session cookies or choose redirect destinations themselves. Existing manual controller and tenant-executor usage remains valid.

## Required acceptance before checklist completion

Approval authorizes implementation in both repositories. Completion still requires Holo-JS command-context type/runtime tests, selected plugin-migration execution and cleanup tests, Shield packed CLI tests in development and production, prepared action/page/resource/widget permission tests, resource authorization and tenant-isolation tests, and native Next/Nuxt/SvelteKit login/MFA/logout/cookie/redirect/CSRF plus tenant-switch acceptance tests.
