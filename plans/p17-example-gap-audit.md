# P17 example and browser-journey gap audit

Audit date: 2026-07-28

Scope: the four P17-B requirements in `plans/implementation.md` lines 2203-2206. This document records evidence and remaining work only. It does not mark the canonical checklist.

## Result

P17-B is not complete. The repository has useful, equivalent Post-focused framework fixtures and substantial framework-neutral acceptance coverage, but it does not yet contain complete blog/admin applications, the required domain breadth, real-browser critical journeys, or packed-artifact acceptance of the completed applications.

| Requirement | Status | Evidence | Exact remaining gap |
| --- | --- | --- | --- |
| Equivalent blog/admin apps for Next, Nuxt, and SvelteKit | Partial | All three apps have an Admin panel, one Post model/resource, List/Create/View/Edit pages, a panel route, and an operation route. `packages/testing/tests/p9-example-phase-gate.test.ts` executes Post CRUD, policy denial, validation, and tenant isolation through all three exported runtimes. | There is no blog-facing application or public blog journey. The admin domain stops at Post. Equivalence currently means scaffold and Post fixture parity, not a complete equivalent product. `scripts/validate-example-parity.mjs` compares each app with its generated Holo scaffold; it does not compare domain behavior or feature inventory across the three apps. |
| Cover Post, Category, Tag, Comment, User/Admin, media, roles, notifications, widgets, tenant-scoped records, import, and export | Partial | Post and the `tenantId` scope exist in each app's only model. Each app has notification configuration and a notifications migration. Shared synthetic journeys exercise Comment/Tag relation-manager presentation, upload UI state, roles/policy states, notifications, widgets, and an Export-labelled table action. | Category is a Post string, not a Category model/resource. There are no Tag, Comment, User/Admin, media/attachment, role/permission, widget/dashboard, import, or export definitions in any example app. The relation, media, notification, and widget acceptance fixtures construct test models independently of the example applications. There is no example import/export execution or downloadable artifact. Notifications are wired at the operation/configuration layer but have no complete in-app seeded inbox journey. |
| Playwright or framework-appropriate browser journeys for critical behavior | Missing | Renderer acceptance uses React/Vue SSR, happy-dom mounting, or Svelte SSR loaded through a Vite middleware server. The P9 phase gate calls adapter runtimes and page resolvers directly. These are valuable component/server acceptance layers. | No Playwright dependency, configuration, browser script, or browser spec exists. No test launches a built/dev Next, Nuxt, or SvelteKit app in a browser. Consequently there is no evidence for navigation and hydration in a real browser, login/session behavior, form submission through the actual network route, upload interaction, tenant switching/isolation through the UI, relation mutations, import/export download, notification interaction, or browser accessibility/focus behavior. |
| Pack and install release artifacts into clean fixtures instead of workspace aliases only | Partial infrastructure, missing P17 acceptance | `scripts/p0c-packed-acceptance.mjs` packs local Holo Panels and Holo-JS packages, installs them into temporary clean framework fixtures, activates the plugin, runs prepare/install/uninstall, checks ownership, and validates generated artifacts. The root `validate` command runs it. | The three maintained example apps still depend on `workspace:*`. The packed fixtures validate installation, generation, imports, and typechecking, but do not install and run the completed P17 blog/admin app or execute its browser journeys. P14-P16/P17 feature packages and behavior therefore are not yet proven from tarballs in a clean consumer. Registry-prerelease installation is separately a P17-D requirement and is not evidence for this local packed criterion yet. |

## Current coverage inventory

### What is genuinely implemented in each example

- A framework-native catch-all panel page and fixed operation endpoint.
- An Admin panel using the `web` guard and an allow-listed actor presentation.
- A tenant-scoped Post model with `title`, `slug`, `category`, `city`, and guarded `tenantId`.
- Post List/Create/View/Edit definitions and resource form/table metadata.
- Post CRUD and denial/validation paths exercised through the exported adapter runtime or registry.
- Notification configuration, database migration, and operation routing.

The model evidence is identical at `apps/example-next/server/models/Post.ts`, `apps/example-nuxt/server/models/Post.ts`, and `apps/example-sveltekit/server/models/Post.ts`: each file defines only the `posts` table. A repository-wide file inventory under the three apps finds no other model.

### What the shared acceptance layer proves

- Forms: slug reactivity, dependent options, repeaters, upload state, error remapping, and deterministic SSR.
- Tables: search, filters, sorting, pagination, visibility, selection, inline editing, grouping, and summaries through DOM-oriented renderer drivers.
- Infolists/actions: entry rendering, confirmation, modal input, deduplication, denial, and success behavior.
- Relations: synthetic Post/Comment and Post/Tag manager presentation and core executor behavior.
- Navigation/search, widgets, and notifications: framework renderer parity and client/runtime behavior.

These fixtures import the framework renderers and shared journey models. They do not load the complete example application in a browser, so they cannot satisfy the P17 browser requirement by themselves.

## Required implementation slices

### 1. Shared product contract

Define one framework-neutral example inventory before implementing framework copies:

- Public blog: post index, category/tag filtering, post detail, media rendering, and comments.
- Admin: Post, Category, Tag, Comment, User/Admin, role/permission administration, media management, notification inbox, widgets/dashboard, tenant switch and tenant-scoped records, CSV import, and private CSV export/download.
- Seed identities: at least super-admin, tenant admin, editor, and denied user across two tenants.
- Seed records: enough cross-tenant and cross-role data to prove isolation and authorization.
- Critical browser journey matrix with the same observable assertions for all three frameworks.

This contract must use only approved and exported P14-P16 APIs. Auth pages, Shield administration, import/export builders, schema transport, and any other pending public surface must not be invented inside examples.

### 2. Complete each framework application

For each app, add real models, migrations, resources, pages, widgets, seed/bootstrap support, and framework UI wiring for the shared inventory. A Category string or synthetic relation fixture does not count as a domain entity. All server operations must traverse the normal panel runtime and HTTP endpoint.

### 3. Real-browser journey layer

Add Playwright as one root-owned test layer and run the same behavior matrix against built or production-like instances of each app. At minimum cover:

1. Authenticate and reach the authorized panel; verify a denied identity cannot.
2. Navigate/search and complete Post create, edit, view, and delete.
3. Use dependent selects and media upload, then verify persisted rendering.
4. Attach/detach tags and create/moderate a comment.
5. Switch tenant and prove records, options, widgets, notifications, imports, and exports do not cross tenants.
6. Assign or change a role and observe the resulting authorization boundary after session refresh.
7. Import a bounded CSV, observe progress/failures/idempotent retry, and verify created records.
8. Export selected/filtered records and download through the authorized expiring route.
9. Read/delete a notification and verify polling or realtime invalidation without duplication.
10. Exercise keyboard navigation, modal focus/escape behavior, form errors, and a small automated accessibility check.

### 4. Packed clean-consumer acceptance

Extend packed validation after the complete apps and browser suite exist:

- Pack every released Holo Panels workspace package.
- Create three temporary apps from clean Holo framework fixtures.
- Install only tarball paths for Holo Panels packages; assert no `workspace:*`, repository symlink, or source import remains.
- Install/generate the shared example domain through supported commands and copied app-owned definitions.
- Build each fixture and run the critical browser smoke subset against the packed installation.
- Keep the existing P0-C install/uninstall lifecycle as a faster, separate layer.

## Safe parallel work partitioning

Parallel work is safe only after the required P14-P16 public APIs are approved, exported, and validated. Until then, agents may prepare app-owned models/migrations or tests for already-public APIs, but must not create substitute APIs.

| Lane | Exclusive ownership | Deliverable | Dependencies and merge rule |
| --- | --- | --- | --- |
| Next application | `apps/example-next/**` only | Complete Next blog/admin implementation and app-local fixture helpers. | Starts after the shared inventory is frozen. Must not edit root manifests, shared test packages, public barrels, or another app. |
| Nuxt application | `apps/example-nuxt/**` only | Equivalent Nuxt implementation using the same IDs, seed data, and observable behavior. | Same constraints; framework-specific wiring may differ, product behavior may not. |
| SvelteKit application | `apps/example-sveltekit/**` only | Equivalent SvelteKit implementation using the same IDs, seed data, and observable behavior. | Same constraints; owns Svelte fixture components under this app. |
| Browser and packed acceptance | New `tests/e2e/**`, new Playwright configuration, and packed-acceptance script files only | Shared journey helpers, per-framework projects/web servers, packed smoke subset, and coverage report. | May begin journey design in parallel, but executable assertions wait for stable app routes/seed contract. Root `package.json`, `bun.lock`, CI, and shared scripts are integration-owner files and must be changed serially after app lanes land. |

One serial integration owner should then:

1. add the root dependency/scripts and regenerate the lockfile;
2. reconcile shared identifiers and seed data without editing framework behavior opportunistically;
3. run all three app typechecks/builds and the browser matrix;
4. run packed clean-fixture builds and browser smoke tests;
5. record evidence in `plans/implementation.md` only after every stated behavior has been observed.

## Completion evidence required before checking P17-B

- A file inventory showing every required domain entity/capability in all three apps.
- Strict typecheck, lint, production build, and targeted app tests for each framework.
- Playwright JSON/JUnit results showing the agreed critical matrix passed for Next, Nuxt, and SvelteKit.
- Screenshots/traces retained for failed CI journeys, with no secrets in artifacts.
- Packed-fixture logs proving tarball installation, absence of workspace/source resolution, successful builds, and critical browser smoke passes.
- A final equivalence assertion based on shared behavior and identifiers, not scaffold file presence alone.
