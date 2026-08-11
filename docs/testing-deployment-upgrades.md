# Testing, deployment, and upgrades

This guide documents the validation and operational behavior implemented by the current repository. It does not treat pending phase proposals as released commands or deployment features.

## Repository requirements

The root package requires Node.js `^20.19.0 || >=22.12.0` and pins the workspace package manager to Bun `1.3.9`. Use the committed lockfile for reproducible repository validation:

```sh
bun install --frozen-lockfile
```

Local cross-repository validation expects Holo-JS beside Holo Panels unless `HOLO_PANELS_HOLO_JS_ROOT` points to a different checkout:

```text
Code/
├── holo-js/
└── holo-panels/
```

The release candidate accepts every stable Holo-JS version at or above `0.3.9` through the `>=0.3.9` dependency floor. Holo-JS `0.3.9` was never published, so minimum-version packed compatibility starts with published Holo-JS `0.3.10` at commit `15ac56ba94d19b6735d9bc607ef56087ae11a243`. Published `0.1.0-next.0` lifecycle evidence uses Holo-JS `0.3.11` at commit `0d074287272b769cda83fe4886c2127c96c9c529`; current CI and release-candidate validation use Holo-JS `0.3.12` source at commit `7ef254423dcfb3a1e06d9a74b4169f87eb8c0e64`. The workflows pin an immutable host revision for reproducible validation, not as an installation ceiling.

## Test layers

The repository uses several distinct layers because each catches a different class of failure.

### Unit and behavior tests

Package-local Vitest suites cover builders, protocol validation, security boundaries, server execution, client stores, renderer behavior, adapter endpoints, CLI filesystem behavior, and failure handling. Every package test script uses non-watch mode and JSON reporting:

```text
vitest --run --passWithNoTests --reporter=json
```

Run one package through the workspace filter, for example:

```sh
bun run --filter '@holo-js/panels-core' test
bun run --filter '@holo-js/panels-cli' test
```

### Contract tests

`packages/testing/tests/contracts.test.ts` validates shared definition and renderer-registration contracts. Renderer packages also contain framework-specific contract suites for semantic markup, accessibility, hydration, keyboard behavior, error containment, and safe custom renderer resolution.

The published `@holo-js/panels-testing` package exposes its framework-neutral helpers from its root. Renderer-specific helpers use the implemented `@holo-js/panels-testing/react`, `/vue`, and `/svelte` export subpaths, with matching renderers and framework runtimes as optional peers.

### Cross-framework acceptance tests

`packages/testing/tests/` runs shared journeys against fixtures from all three example applications. Current journeys cover forms, tables, infolists and actions, panels and resources, relation managers, navigation and search, widgets, and notifications.

The framework fixtures live at:

- `apps/example-next/tests/`
- `apps/example-nuxt/tests/`
- `apps/example-sveltekit/tests/`

Run the complete shared acceptance package with:

```sh
bun run --filter '@holo-js/panels-testing' test
```

### Architecture and package-policy tests

The root architecture command runs four checked-in validators:

```sh
bun run test:architecture
```

It verifies package dependency boundaries, the approved dependency policy, the Holo-JS CI compatibility pin, publish metadata, and the absence of forbidden cross-framework imports or unresolved published dependency ranges.

Example scaffold parity is a separate check:

```sh
bun run test:example-parity
```

It creates fresh Holo framework scaffolds from the adjacent Holo-JS checkout, applies the checked-in Panels example overlay, and reports drift in committed example files. Generated/build directories, storage, dependency directories, lockfiles, and local environment files are excluded from that comparison.

### Packed-package tests

There are two packed validation paths.

```sh
node scripts/validate-published-packages.mjs --require-build --pack
```

This command:

- verifies every package is publishable MIT-licensed ESM with a built root export;
- rejects undeclared files, tests, coverage output, source maps, and dependency directories in release tarballs while allowing explicitly published UI source templates;
- verifies every declared export target exists inside its tarball and every packed internal or Holo dependency range is resolved;
- requires one lockstep version across all Holo Panels packages;
- packs every package and installs the tarballs with Bun's isolated linker;
- installs and imports the complete tarball set from an independent non-workspace consumer using only file-tarball overrides for the unpublished lockstep family;
- imports all package roots from a clean consumer;
- installs and typechecks the Next.js, Nuxt, and SvelteKit example consumers;
- proves each framework consumer receives only its matching adapter and renderer family;
- imports the testing root and renderer subpaths under their supported optional-peer combinations; and
- verifies minimum and optional Holo peer isolation.

The complete clean plugin lifecycle is:

```sh
bun run test:p0c
```

`scripts/p0c-packed-acceptance.mjs` packs Holo Panels and the required Holo-JS packages, creates clean Next.js, Nuxt, and SvelteKit applications, installs from tarballs without source-directory symlinks, activates the plugin, prepares generated artifacts, installs the matching adapter, generates a panel and resource, and typechecks the generated result. It also proves a second install is byte-for-byte idempotent and that uninstall removes only its owned adapter while preserving plugin activation and application source.

`test:p0c` requires the adjacent Holo-JS packages and CLI to be built. The script uses `HOLO_PANELS_HOLO_JS_ROOT` and `HOLO_PANELS_BUN_EXECUTABLE` when those environment variables are set.

## Exact validation commands

For an ordinary change, run the smallest relevant package suite while iterating. Before a repository-wide handoff, run:

```sh
bun run typecheck
bun run lint
bun run test
bun run build
```

The commands mean:

- `typecheck`: run each `@holo-js/panels*` package typecheck sequentially;
- `lint`: run ESLint across the repository without mutation;
- `test`: run architecture validation, example parity, and every package Vitest suite sequentially; and
- `build`: build every published Holo Panels package sequentially.

The full local release-equivalent gate is:

```sh
bun run validate
```

It runs the four commands above, the packed P0-C lifecycle, and the built packed-package smoke suite. It therefore needs the compatible adjacent Holo-JS checkout and its built packages.

If exported core or umbrella declarations intentionally change, also run:

```sh
node scripts/validate-public-api.mjs
```

This builds `@holo-js/panels-core` and `@holo-js/panels`, then compares their declarations with `tests/fixtures/public-api/panels-core.d.ts` and `tests/fixtures/public-api/panels.d.ts`. Do not use its `--update` mode until the public API change has been explicitly approved and reviewed.

CI currently runs the P0-B subset against the pinned Holo-JS checkout: frozen installs, Holo-JS builds, Holo Panels typecheck, lint, tests, builds, and packed publish validation. The workflow intentionally does not claim the local P0-C gate.

## Clean installation verification

For an application release candidate, validate installation from an empty dependency directory rather than relying on workspace links or a warm package-manager cache:

1. Use the application's committed lockfile and frozen-install option.
2. Confirm installed `@holo-js/panels` and the matching adapter have the same exact version.
3. Confirm only one Panels adapter family is installed.
4. Run `holo prepare`, fail on discovery or ownership corruption, and review every managed-route conflict or manual-integration warning.
5. Run the application's typecheck and `holo build`.
6. Exercise authenticated allowed, authenticated denied, unauthenticated, page-load, and enabled mutation paths against the production build.

Repository maintainers should use the two packed commands above for stronger isolation. They verify tarball contents, package identities, public imports, optional peers, generated files, command discovery, adapter selection, and uninstall behavior without resolving packages through source-directory symlinks.

## Generated artifact workflow

Holo Panels generates metadata below `.holo-js/generated/panels/`. The repository `.gitignore` excludes `.holo-js/`, so every clean checkout and deployment build must regenerate it:

```sh
holo prepare
```

The generated tree contains the server registry, client manifests, resource/page/widget/cluster indexes, navigation and permission seeds, declaration augmentation, registry JSON, and framework-artifact ownership. Treat the complete directory as derived output and never edit it.

Framework-native panel pages and operation endpoints are managed application files outside `.holo-js/`. Their first line contains `@holo-panels-managed` and a SHA-256 checksum. Preparation:

- creates a missing managed file;
- leaves a current managed file unchanged;
- updates a previously managed file only when its ownership record and current body checksum still match; and
- refuses an unmanaged or locally modified destination and prints the complete manual integration snippet.

Do not remove the ownership header, place business logic in a managed route, or overwrite a conflict during deployment. Put application behavior in the runtime/registry bindings documented in [Create your first panel](first-panel.md).

The current ownership record is itself generated below the ignored `.holo-js/` tree. Consequently, a clean checkout that contains previously committed route files but no generated ownership record does not silently re-adopt those files, even when their headers look valid. Preparation reports them as unmanaged and prints the expected source. Review that output and preserve the existing routes unless you deliberately reconcile them; there is currently no command that force-adopts a route or bypasses this safety stop.

## Deployment requirements

### Environment and configuration

The example app configs read these current Holo environment values:

- `APP_ENV`: set to `production` for a production deployment;
- `APP_KEY`: provide a deployment secret through the environment or secret manager;
- `APP_URL`: set the canonical externally reachable application URL;
- `APP_DEBUG`: disable production debug output;
- `DB_URL`: point to the intended durable database; and
- `REDIS_URL`, or `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, and `REDIS_DB`, when the application enables Redis-backed behavior.

Do not commit environment files, application keys, database credentials, Redis credentials, session secrets, or provider tokens. `.env` is excluded from example-parity regeneration and should remain deployment-managed.

The current Panels plugin exports an empty migration list. Application models and enabled Holo services still own their required migrations. Review and apply those through the application's established Holo deployment workflow before sending traffic; do not assume installing Panels creates application tables.

### Authentication and authorization

Every configured panel guard must exist in the deployed Holo Auth runtime. Runtime/registry bindings must resolve the actor, provider, tenant, and services from the active request and must enforce panel access before page data or operations execute.

Re-authorize class, record, relation, action, bulk, notification, and tenant boundaries on the server. UI visibility is never authorization. Apply tenant and authorization scopes before record lookup, relation lookup, search, aggregation, and reactive option resolution.

### HTTP and process security

Use the managed operation endpoints from the matching adapter. Current Next.js, Nuxt, and SvelteKit handlers enforce Holo CSRF protection, fixed allow-listed panel IDs and operation names, normalized error envelopes, no-store responses, and a 1 MiB request-body limit. Do not replace them with an unbounded generic proxy.

Terminate TLS at a trusted boundary, configure the framework's trusted proxy and secure-cookie behavior for the deployment topology, and ensure the canonical `APP_URL` matches the public origin used by CSRF and redirects. Keep application debug output disabled so stack traces, source paths, and server errors do not enter production payloads.

Deploy only the matching framework adapter. Optional database, Redis, queue, storage, notifications, media, broadcast, and realtime drivers remain application-owned and should be installed and configured only when the application enables those capabilities.

## Lockstep versions and releases

All publishable Holo Panels packages release in lockstep. Repository manifests use `workspace:*` internally; packed manifests must resolve internal dependencies and optional renderer peers to the exact release version. Holo service and framework runtimes remain peer dependencies on the approved compatibility ranges.

The publish validator fails mixed Holo Panels versions, unresolved `workspace:`, `catalog:`, `file:`, or `link:` specifications, unexpected framework families, and invalid required/optional peer placement. The approved dependency and compatibility rules are recorded in [the dependency policy](../plans/dependency-policy.md).

Maintainers set one version across every package with:

```sh
bun run version-packages 1.0.0
```

Before selecting a release version or using registry credentials, rehearse the exact package order and publish payloads locally:

```sh
node scripts/release.mjs --dry-run
```

The dry run executes the built packed-package validator and then runs `bun publish --dry-run` for every package in dependency order. It does not publish or change registry state. It uses the `next` distribution tag for semantic prerelease versions and `latest` for stable versions. The placeholder workspace version `0.0.0` is accepted only for this rehearsal; the publishing mode rejects it.

Publishing is CI-only and requires the explicit release script path:

```sh
CI=true bun run release
```

The release script runs `bun run validate` before publishing packages in dependency order. This is a maintainer workflow, not an application upgrade command.

Tarball installation proves release-artifact integrity but is not evidence that registry publication succeeded. After an approved prerelease is published, create a new application outside this repository, install the exact prerelease version from the configured registry without `file:`, `link:`, workspace overrides, or a warm lockfile, and repeat the clean-install and framework acceptance checks. That external registry installation remains a required release gate until it has been observed.

Run the registry-backed lifecycle gate after publication:

```bash
bun run test:registry-release
```

The command bootstraps the compatible published Holo CLI, creates fresh Next.js, Nuxt, and SvelteKit applications, installs the exact Holo Panels prerelease from npm, rejects local dependency references and symlinks, and exercises plugin activation, preparation, panel and resource generation, adapter selection, Shield commands, idempotent installation, and safe uninstall.

## Safe application upgrades

The current installer does not automatically migrate an existing ownership record across Holo Panels versions. Use this sequence to preserve a clean, reviewable boundary:

1. On the currently installed version, run `holo panels:uninstall`.
2. Confirm it removed only the adapter dependency it still owned and `.holo-js/panels/install.json`.
3. Update `@holo-js/panels` with the application's package manager and perform a frozen clean install from the reviewed lockfile.
4. Run `holo panels:install` to install the matching adapter at the new exact umbrella version and create fresh ownership state.
5. Run `holo prepare` and review every managed-route change or conflict.
6. Run the application typecheck, tests, and production build before deployment.

If the adapter dependency was present before `panels:install`, or its specifier was changed afterward, uninstall preserves it instead of claiming or deleting it. Resolve its version deliberately so the adapter and umbrella remain lockstep.

Never delete `.holo-js/panels/install.json` merely to bypass validation, and never force-replace a locally modified managed route. An invalid ownership record is a stop condition because the CLI can no longer prove what it owns.

## Safe uninstall

Run:

```sh
holo panels:uninstall
```

The command removes an adapter only when the ownership manifest says Panels added it and the dependency still has the recorded exact specifier. It removes the install ownership file after a successful operation. It preserves:

- `@holo-js/panels` plugin activation;
- panel, page, resource, renderer, and other application source;
- user-authored or modified dependencies; and
- generated or application-owned files outside the install ownership record.

Dependency removal is transactional around package manifest, lockfile, and ownership snapshots. On package-manager failure the command attempts to restore the original files and dependency installation. A recovery failure is reported explicitly.

Remove the plugin activation separately through Holo's plugin workflow only after deciding which panel source, runtime bindings, managed routes, migrations, and data must remain.

For vulnerability reporting and repository security boundaries, follow [SECURITY.md](../SECURITY.md).
