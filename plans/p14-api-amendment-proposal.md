# P14 public API amendment proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

## Shield administration

The approved Shield authorization repository intentionally exposes only actor grant reads and transactional assignment writes. P14-B setup, diff, sync, role, seed, and normal Role/Permission resources additionally require server-only administration reads and stale-permission deletion.

```ts
export interface ShieldPermissionAdministrationSnapshot {
  readonly permissions: readonly ShieldPermission[]
  readonly roles: readonly ShieldRole[]
}

export interface ShieldAdministrationWriter extends ShieldAssignmentWriter {
  deletePermissions(permissionIds: readonly string[]): Promise<void>
}

export interface ShieldAdministrationRepository extends ShieldRepository {
  loadAdministration(): Promise<ShieldPermissionAdministrationSnapshot>
  transaction<TResult>(
    operation: (writer: ShieldAdministrationWriter) => Promise<TResult>,
  ): Promise<TResult>
}
```

The administration boundary remains server-only. `diff` is non-mutating. `sync` adds missing permissions and removes stale permissions only when both `--remove-stale` and `--confirm` are present. `setup`, `sync`, `make-role`, and `seed` reject production unless the application explicitly enables production Shield mutations. All writes remain transactional and trigger post-commit cache invalidation.

The Holo database implementation adds this factory after the administration contract is approved:

```ts
export function createHoloShieldRepository(
  connectionName?: string,
): ShieldAdministrationRepository
```

## Optional Shield package distribution

Shield remains optional by registering as its own Holo plugin rather than becoming an umbrella-package dependency.

Exact `package.json` additions:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "default": "./dist/index.mjs"
    },
    "./plugin": {
      "types": "./dist/holo-plugin.d.ts",
      "import": "./dist/holo-plugin.mjs",
      "default": "./dist/holo-plugin.mjs"
    },
    "./package.json": "./package.json"
  },
  "holo": {
    "plugin": "./dist/holo-plugin.mjs"
  }
}
```

`@holo-js/kernel` becomes a peer dependency. Build entries are `src/index.ts`, `src/holo-plugin.ts`, `src/holo-commands.ts`, and `src/migrations.ts`.

Exact Holo plugin declaration:

```ts
export const plugin = defineHoloPlugin({
  id: 'panels-shield',
  name: 'Holo Panels Shield',
  description: 'Role and permission management for Holo Panels',
  contributes: {
    cli: { commands: './dist/holo-commands.mjs' },
    migrations: { publish: './dist/migrations.mjs' },
  },
} as const)

export default plugin
```

The command module exports the five approved `shield:*` command definitions through the existing Holo CLI command contract:

```ts
export const commands = Object.freeze([
  shieldSetupCommand,
  shieldDiffCommand,
  shieldSyncCommand,
  shieldMakeRoleCommand,
  shieldSeedCommand,
] as const)

export default commands
```

The migration module uses Holo DB's existing `MigrationDefinition` type:

```ts
export const migrations = Object.freeze([
  createPanelShieldTables,
] satisfies readonly MigrationDefinition[])

export default migrations
```

Holo currently records `contributes.migrations.publish` but does not execute it. The approved host change makes every `holo migrate:*` command import each installed plugin's package-relative publisher module, accept its named `migrations` export or default export, and merge the definitions into the existing migration registry. Plugin-published migrations must have explicit stable names. Invalid modules, duplicate names across application and plugin migrations, unsafe contribution paths, or malformed definitions fail before a database connection mutates. Application migrations and plugin migrations use the same status, rollback, transaction, and pretend-mode machinery. This activates the existing manifest field; it does not introduce a second migration system.

## Tenant switch execution

```ts
export type PanelTenantOperationFailure
  = 'access-denied'
    | 'invalid-context'
    | 'not-found'

export class PanelTenantOperationError extends Error {
  readonly failure: PanelTenantOperationFailure
}

export interface ExecutePanelTenantSwitchOptions<TActor> {
  readonly panel: CompiledPanelDefinition<TActor>
  readonly payload: unknown
  readonly scope: PanelAuthenticatedScope<TActor>
}

export interface PanelTenantSwitchResult {
  readonly tenant: PanelTenantIdentity
}

export function executePanelTenantSwitch<TActor>(
  options: ExecutePanelTenantSwitchOptions<TActor>,
): Promise<PanelTenantSwitchResult>

export function panelTenantOperationStatus(
  error: PanelTenantOperationError,
): 403 | 404
```

The executor accepts only `{ routeKey: string }` from untrusted input. Client tenant IDs, actor identity, guard, panel, model, and persistence fields are ignored. Missing tenancy, malformed or unsafe route keys, unknown tenants, non-membership, and access denial are indistinguishable `not-found` failures after current membership and access are recomputed. Typed queued-context access or context failures map to 403. Unexpected callbacks and persistence failures remain server errors. Adapters retain native response and redirect behavior.
