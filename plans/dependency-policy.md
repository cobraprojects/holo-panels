# Holo Panels Dependency Placement Policy

Status: approved and applied for P0-B

Validated against:

- Published Holo-JS workspace catalog and package manifests at version `0.3.10` on 2026-08-03.
- Holo Panels workspace catalog and package responsibilities on 2026-07-27.
- `plans/implementation.md`, especially the package graph and P0-B.

The user approved this policy exactly as proposed on 2026-07-27. It governs package manifests, lockfiles, and the published dependency surface from P0-B onward.

## 1. Placement rules

1. A package declares only dependencies it imports directly in source, generated runtime code, or its public type declarations.
2. Another Holo Panels workspace package is an ordinary `dependencies` entry using `workspace:*` in source manifests. Release tooling must resolve it to the exact lockstep release version, not a caret range.
3. An external `@holo-js/*` package is a peer dependency because the application owns the Holo runtime and must not receive a shadow Holo service container, registry, auth runtime, or framework adapter.
4. A Holo peer is required only when the package's baseline exported behavior imports and needs it. A feature-gated Holo integration is an optional peer and must be marked in `peerDependenciesMeta`.
5. React, Vue, Svelte, Next.js, Nuxt, and SvelteKit are host-owned required peers only in the renderer or adapter that directly integrates them.
6. A required or optional peer is repeated in `devDependencies` only when that package needs it to build, typecheck, or test locally. This does not make it an ordinary runtime dependency.
7. Build, lint, test, fixture, type, and package tooling belongs in root or package `devDependencies`; it must never be published as a runtime dependency merely to satisfy local tests.
8. A third-party runtime library is an ordinary dependency of the smallest package that owns its implementation. For example, a React-only accessible primitive belongs in `panels-react`, not `panels-ui`, `panels-core`, or the umbrella package.
9. A driver or optional capability is never added transitively for convenience. Storage drivers, queue drivers, Redis, database drivers, mail transports, chart engines, editors, and upload processors remain absent until a package directly owns an approved integration.
10. The umbrella package must not depend on Shield, any renderer, any framework adapter, any framework runtime, or optional Holo services. `holo panels:install` selects exactly one adapter for the application.
11. `panels-core`, `panels-client`, and `panels-ui` must remain free of React, Vue, Svelte, Next.js, Nuxt, and SvelteKit dependencies.
12. Framework adapters may have one ordinary Holo Panels renderer dependency. Holo framework adapters and framework runtimes remain peers.
13. An optional peer must be accessed only from a feature-specific path or guarded integration boundary. A baseline package import must not fail when an optional peer is absent.
14. Type-only imports still require a dependency declaration when their types appear in emitted declarations.

## 2. Version policy

### 2.1 Holo-JS peers

- The release compatibility floor is `>=0.3.9`, accepting every later stable Holo-JS release without a Panels peer-range edit.
- Holo Panels source manifests use `"catalog:"`; packed manifests must contain the resolved `>=0.3.9` range.
- All Holo peers in one release use the same compatibility floor. Do not mix caret, exact, and inconsistent minimum ranges.
- A future Holo minor or major range is adopted only after packed compatibility fixtures pass against the minimum and newest supported versions.
- Cross-repository local development must use the documented pack/link workflow. Never place `workspace:*`, `file:`, `link:`, or an absolute path in a published Holo peer range.

### 2.2 Holo Panels packages

- Repository manifests use `workspace:*` for internal ordinary dependencies.
- Published internal ranges are exact and equal to the package being released, for example `"@holo-js/panels-core": "0.1.0"` in a `0.1.0` release.
- All Holo Panels packages release in lockstep. Publishing must fail if an internal dependency resolves to a different version.
- Optional Holo Panels integrations, such as renderer-specific helpers exposed by `panels-testing`, use exact-version optional peers in packed manifests.

### 2.3 Framework peers

Use the current Holo workspace compatibility baselines until framework contract testing approves a wider or newer range:

| Package | Initial range |
|---|---|
| `next` | `^16.2.4` |
| `react` | `^19.2.6` |
| `react-dom` | `^19.2.6` |
| `nuxt` | `^4.4.4` |
| `vue` | `^3.5.13` |
| `@sveltejs/kit` | `^2.59.1` |
| `svelte` | `^5.55.5` |

Source manifests use `"catalog:"`; packed manifests contain these resolved ranges. Required framework peers are not marked optional.

## 3. Approved target mapping

The tables describe the maximum approved dependency location. A dependency is added only when a direct import or emitted public type requires it.

### 3.1 `@holo-js/panels`

| Field | Package | Required | Reason |
|---|---|---:|---|
| `dependencies` | `@holo-js/panels-core` | yes | Root, server, and plugin-author re-exports |
| `dependencies` | `@holo-js/panels-client` | yes | Browser-safe `/client` re-exports |
| `dependencies` | `@holo-js/panels-cli` | yes | Plugin-contributed commands and prepare entry |
| `peerDependencies` | `@holo-js/kernel` | yes | Holo plugin definition and runtime contribution contract |

No optional peers. Do not add Shield, a renderer, an adapter, or a framework runtime.

### 3.2 `@holo-js/panels-core`

Required Holo peers:

| Package | Ownership reason |
|---|---|
| `@holo-js/core` | Holo runtime and service integration contracts |
| `@holo-js/config` | Panel configuration integration |
| `@holo-js/db` | Resource models, queries, relations, pagination, and transactions |
| `@holo-js/forms` | Authoritative Holo form schema integration |
| `@holo-js/validation` | Server validation and emitted validation contracts |
| `@holo-js/auth` | Panel guard, provider, session, and actor resolution |
| `@holo-js/authorization` | Class and record policies |
| `@holo-js/security` | CSRF, throttling, and secure operation boundaries |

Optional Holo peers, all marked `{ "optional": true }` in `peerDependenciesMeta`:

| Package | Feature gate |
|---|---|
| `@holo-js/notifications` | Temporary/database notification integration |
| `@holo-js/queue` | Queued actions, imports, exports, and notifications |
| `@holo-js/storage` | Upload and private export storage |
| `@holo-js/media` | Model media collections and conversions |
| `@holo-js/broadcast` | Broadcast notification invalidation |
| `@holo-js/realtime` | Realtime panel data integration |
| `@holo-js/flux` | Framework-neutral live client protocol integration |

Do not add storage drivers, queue drivers, database drivers, mail packages, framework adapters, or framework runtimes. Core exposes capability errors when a configured optional integration is unavailable.

### 3.3 `@holo-js/panels-client`

| Field | Package | Required | Reason |
|---|---|---:|---|
| `dependencies` | `@holo-js/panels-core` | yes | Shared protocol and public client contracts |
| `peerDependencies` | `@holo-js/security` | yes | Holo CSRF client integration used by the baseline transport |
| `peerDependencies` | `@holo-js/forms` | yes | Shared Holo Forms values, dirty state, errors, and submission ownership |

No framework peers and no optional service peers. Realtime transport extensions stay in core service integration or a future approved integration package; the neutral client must not acquire a framework dependency.

### 3.4 `@holo-js/panels-ui`

No Holo, framework, or Holo Panels runtime dependency is required initially. It owns design tokens, semantic CSS, icons, and presentation contracts.

An eventual framework-neutral icon or CSS build library may be an ordinary dependency only if its runtime output is actually imported. Build-only processors are dev dependencies.

### 3.5 Renderer packages

All three renderers have these ordinary dependencies:

- `@holo-js/panels-client` using `workspace:*`.
- `@holo-js/panels-ui` using `workspace:*`.

`@holo-js/panels-react` additionally depends on `@holo-js/panels-core` using `workspace:*` for its approved `react-server` entrypoint. The browser renderer continues to consume client-safe contracts through the conditional export graph, and the server entry remains hook-free.

The renderer-owned shadcn source boundary uses ordinary implementation dependencies only in the matching renderer: `radix-ui` and `lucide-react` for React, `reka-ui` and `lucide-vue-next` for Vue, and `bits-ui` and `lucide-svelte` for Svelte. Framework adapters remain dependent only on their matching renderer; their generated shells use internal source-owned icons so published UI does not require undeclared application dependencies.

Required peers:

| Renderer | Required peers |
|---|---|
| `@holo-js/panels-react` | `react`, `react-dom` |
| `@holo-js/panels-vue` | `vue` |
| `@holo-js/panels-svelte` | `svelte` |

Each renderer repeats its peers in dev dependencies for local build and contract tests. Framework-specific headless primitives are ordinary dependencies of that renderer only after the exact library and public bundling behavior are approved.

### 3.6 Framework adapter packages

| Adapter | Ordinary dependency | Required peers |
|---|---|---|
| `@holo-js/panels-next` | `@holo-js/panels-react` | `@holo-js/adapter-next`, `next`, `react`, `react-dom` |
| `@holo-js/panels-nuxt` | `@holo-js/panels-vue` | `@holo-js/adapter-nuxt`, `nuxt`, `vue` |
| `@holo-js/panels-sveltekit` | `@holo-js/panels-svelte` | `@holo-js/adapter-sveltekit`, `@sveltejs/kit`, `svelte` |

Adapters repeat required peers in dev dependencies. They must consume auth, security, storage, forms, and realtime behavior through the matching Holo adapter or Panels contracts unless they directly import an approved public subpath. A direct import requires a separate dependency-policy review; do not predeclare every Holo service on every adapter.

### 3.7 `@holo-js/panels-cli`

| Field | Package | Required | Reason |
|---|---|---:|---|
| `dependencies` | `@holo-js/panels-core` | yes | Definition markers and compilation contracts |
| `peerDependencies` | `@holo-js/kernel` | yes | Plugin command and project-preparation contracts |

Do not add `@holo-js/cli` unless the approved plugin API requires a direct public import. The Holo CLI supplies command context to the plugin. Do not add DB, storage, framework adapters, or framework runtimes merely for detection; use the normalized Holo project context.

### 3.8 `@holo-js/panels-plugin-money`

| Field | Package | Required | Reason |
|---|---|---:|---|
| `dependencies` | `@holo-js/panels-core` | yes | Public custom-field, custom-column, and panel-plugin authoring contracts |
| `peerDependencies` | `@holo-js/panels-react` | yes | React renderer subpath contract |
| `peerDependencies` | `@holo-js/panels-vue` | yes | Vue renderer subpath contract |
| `peerDependencies` | `@holo-js/panels-svelte` | yes | Svelte renderer subpath contract |
| `peerDependencies` | `react`, `vue`, `svelte` | yes | Matching framework component runtimes |

The sample plugin keeps renderer packages as peers so its root authoring entry does not install framework implementations. Its renderer modules remain isolated behind `./react`, `./vue`, and `./svelte` exports.

### 3.9 `@holo-js/panels-shield`

| Field | Package | Required | Reason |
|---|---|---:|---|
| `dependencies` | `@holo-js/panels-core` | yes | Panel plugin, resources, actions, and permission subjects |
| `peerDependencies` | `@holo-js/db` | yes | RBAC persistence and transactions |
| `peerDependencies` | `@holo-js/auth` | yes | Polymorphic actor identity and guard integration |
| `peerDependencies` | `@holo-js/authorization` | yes | Composition with Holo policies and abilities |
| `peerDependencies` | `@holo-js/kernel` | yes | Existing Holo plugin and application-command contracts |

No optional peers initially. Shield must not be a dependency of core or the umbrella package. Database drivers remain application-owned.

### 3.10 `@holo-js/panels-testing`

Ordinary dependencies:

- `@holo-js/panels-core` using `workspace:*`.
- `@holo-js/panels-client` using `workspace:*`.

Optional exact-version peers, each marked `{ "optional": true }`:

- `@holo-js/panels-react`.
- `@holo-js/panels-vue`.
- `@holo-js/panels-svelte`.
- `react` and `react-dom`.
- `vue`.
- `svelte`.

All optional peers are dev dependencies for the repository's full renderer contract suite. Renderer helpers must be exposed through renderer-specific subpaths so importing the base testing package works without any UI framework installed. Next, Nuxt, SvelteKit, Holo adapters, browser automation, and database drivers belong in example or fixture dev dependencies, not this published testing package.

## 4. Root catalog additions

Before implementing any integration, the Holo Panels root catalog may add only the following approved version keys:

```text
@holo-js/adapter-next       >=0.3.9
@holo-js/adapter-nuxt       >=0.3.9
@holo-js/adapter-sveltekit  >=0.3.9
@holo-js/auth               >=0.3.9
@holo-js/authorization      >=0.3.9
@holo-js/broadcast          >=0.3.9
@holo-js/config             >=0.3.9
@holo-js/db                 >=0.3.9
@holo-js/flux               >=0.3.9
@holo-js/forms              >=0.3.9
@holo-js/media              >=0.3.9
@holo-js/notifications      >=0.3.9
@holo-js/queue              >=0.3.9
@holo-js/realtime           >=0.3.9
@holo-js/security           >=0.3.9
@holo-js/storage            >=0.3.9
@holo-js/validation         >=0.3.9
react-test-renderer         ^19.2.6
@types/react-test-renderer  ^19.1.0
```

`@holo-js/core`, `@holo-js/kernel`, and all framework/runtime versions listed in section 2.3 already exist in the Holo Panels catalog with matching Holo-JS values. Add a catalog key only in the same change that adds a package declaration which uses it. Do not copy the entire Holo-JS catalog.

## 5. Required automated policy checks

P0-B dependency validation must fail when any of these conditions occurs:

- A published package uses `catalog:`, `workspace:*`, `file:`, `link:`, or an absolute dependency path after packing.
- An internal Holo Panels dependency does not resolve to the exact lockstep package version.
- Cross-repository `@holo-js/*` is placed in ordinary dependencies.
- A required runtime or Holo adapter peer is marked optional.
- An optional peer lacks matching `peerDependenciesMeta` with `optional: true`.
- `peerDependenciesMeta` names a package absent from `peerDependencies`.
- A package imports a dependency absent from its own manifest.
- A package declares a runtime dependency it does not import, excluding the umbrella's plugin entry modules and documented generated imports.
- Core, client, or UI declares a framework dependency.
- A renderer declares another framework or renderer.
- An adapter declares an ordinary internal dependency other than its matching renderer.
- Shield appears in core or umbrella dependencies.
- The umbrella package installs a renderer, adapter, or framework runtime.
- The base testing entry imports an optional renderer or framework eagerly.
- Packed installation of one adapter pulls another framework family.

Required fixtures:

- Pack and install the umbrella alone in a minimal Holo application.
- Pack and install each adapter with only its matching Holo adapter and framework.
- Import the base testing package without a UI framework.
- Import each testing renderer subpath with its matching optional peers.
- Exercise core once with no optional Holo services configured.
- Exercise each optional Holo integration with the peer absent and assert an actionable capability error.
- Exercise each optional integration with the minimum compatible peer installed.
- Validate minimum and current-compatible Holo versions before widening a release range.

P0 applicability: before an optional integration has an approved public API or executable implementation, its fixture proves that core imports safely with the peer absent and that the minimum peer can be installed independently. The actionable missing-capability error becomes a mandatory phase gate in the phase that implements that integration. P0 must not invent a premature public API solely to manufacture that error path.

## 6. Explicit approval checklist

No manifest work may begin until the user approves this exact checklist:

- [x] Approve all cross-repository Holo packages as peers rather than ordinary dependencies.
- [x] Approve required core peers: Core, Config, DB, Forms, Validation, Auth, Authorization, and Security.
- [x] Approve optional core peers: Notifications, Queue, Storage, Media, Broadcast, Realtime, and Flux.
- [x] Approve framework renderer peers and matching adapter peers.
- [x] Approve exact lockstep published versions for internal Holo Panels dependencies.
- [x] Approve the initial Holo compatibility line, since superseded by the current `>=0.3.9` compatibility floor.
- [x] Approve renderer packages as optional peers of `panels-testing` rather than ordinary dependencies.
- [x] Approve adding only the catalog keys listed in section 4, on demand.
- [x] Approve implementation of dependency-policy validation and packed-install fixtures.

After approval, the integration agent may update catalogs and manifests in one isolated task, run diagnostics for changed scripts, full typecheck, ESLint with `--fix`, dependency-policy tests, architecture validation, builds, and packed-package smoke tests, then check the corresponding P0-B task only when all evidence passes.
