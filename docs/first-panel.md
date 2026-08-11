# Create your first panel

Complete [Install Holo Panels](installation.md) first. This guide creates a panel declaration and a minimal dashboard page, then identifies the application-owned runtime work required by each framework.

## Generate the panel declaration

From the application root, run:

```sh
holo make:panel admin --path /admin --guard web --default
```

This creates `server/admin/AdminPanel.ts` and runs `holo prepare`. The generated declaration is equivalent to:

```ts
import { definePanel } from '@holo-js/panels'

export default definePanel('admin')
  .default()
  .path('/admin')
  .guard('web')
  .discoverResources()
  .discoverPages()
  .discoverWidgets()
  .discoverClusters()
```

Use the name of a guard that is already configured by Holo Auth. Panel page and operation requests are authenticated and authorized on the server; hiding navigation or controls is not authorization.

Panel IDs use lower-kebab-case. A project with more than one panel should pass `--panel` explicitly to later generators.

## Add a dashboard page

Run:

```sh
holo make:page Dashboard --panel admin
```

The command creates `server/admin/pages/Dashboard.ts`. The generic page generator uses `/dashboard` by default, so set the complete panel route explicitly:

```ts
import { definePage } from '@holo-js/panels'

export default definePage('dashboard')
  .path('/admin')
  .title('Dashboard')
  .heading('Dashboard')
  .navigation({ label: 'Dashboard', sort: 0 })
```

Then refresh discovery:

```sh
holo prepare
```

The page has no custom body, loader, actions, or widgets yet. It is useful as the smallest discoverable page and runtime smoke test.

## Supply the server binding

Preparation owns route shells and generated discovery metadata, but it does not generate application authentication, authorization, tenancy, database behavior, or mutation handlers. The application must export the binding expected by its generated route.

### Next.js

Provide `server/panels/runtime.ts` with a named `panelsRuntime` export satisfying `NextPanelsRuntime` from `@holo-js/panels-next`.

The runtime supplies:

- a Holo-compatible `auth` object or async auth factory;
- a server registry, normally backed by `.holo-js/generated/panels/server-registry.ts`;
- optional locale, services, and tenant resolution; and
- an `execute` handler before forms, actions, tables, options, uploads, or other operations are enabled.

The current example shows the complete binding split between [the stable runtime export](../apps/example-next/server/panels/runtime.ts) and [the application runtime implementation](../apps/example-next/server/admin/runtime.ts).

After preparation, the managed page uses the public `createPanelPage` export from `@holo-js/panels-next`, and the managed endpoint uses `createPanelOperationRoute` from the same package.

### Nuxt

Provide `server/panels/runtime.ts` with a named `panelsRuntime` export satisfying `NuxtPanelRuntime` from `@holo-js/panels-nuxt`.

Unlike the Next runtime contract, the Nuxt runtime declares an allow-listed `panels` record containing each panel's guard and access callback, plus an `execute` function for page data and enabled operations.

The current example shows [the stable runtime export](../apps/example-nuxt/server/panels/runtime.ts) and [the application runtime implementation](../apps/example-nuxt/server/admin/runtime.ts).

After preparation, the managed Vue page uses `PanelPage` and `usePanelPage` from `@holo-js/panels-nuxt`, and the managed endpoint uses `createPanelOperationHandler`.

### SvelteKit

Provide `src/lib/server/panels/registry.ts` with a named `panelsRegistry` export satisfying `SvelteKitPanelRegistry` from `@holo-js/panels-sveltekit`.

The registry supplies:

- a `PanelRuntime`-compatible runtime;
- a `resolvePage` function that returns authorized server-resolved page data; and
- an allow-listed operation-handler map for each enabled operation.

The current example shows [the stable registry export](../apps/example-sveltekit/src/lib/server/panels/registry.ts) and [the application registry implementation](../apps/example-sveltekit/server/admin/registry.ts).

After preparation, the managed page load uses `createPanelPageLoad`, the managed Svelte page renders `PanelPage`, and the managed endpoint uses `createPanelOperationHandler`, all from `@holo-js/panels-sveltekit`.

## Check generated routes

For the `admin` panel at `/admin`, successful preparation requests these framework-specific files:

```text
Next.js
  app/admin/[[...panelsPath]]/page.tsx
  app/holo/panels/[panelId]/[operation]/route.ts

Nuxt
  pages/admin/[[...panelsPath]].vue
  server/routes/holo/panels/[panelId]/[operation].ts

SvelteKit
  src/routes/admin/[...path]/+page.server.ts
  src/routes/admin/[...path]/+page.svelte
  src/routes/holo/panels/[panelId]/[operation]/+server.ts
```

Do not edit a managed route to add business logic. Put runtime behavior in the application-owned binding. If the expected route already exists and is unmanaged, preparation refuses to overwrite it and reports a manual integration snippet.

## Run the application

Start the app through its existing Holo development command:

```sh
holo dev
```

Open `/admin`. Expected server outcomes are:

- an authenticated actor accepted by the panel guard sees the dashboard page;
- an unauthenticated request follows the adapter's login/error behavior; and
- an authenticated actor rejected by panel access receives a server-side denial.

If the route reports that the runtime or registry is unavailable, verify the exact named export and path in the server-binding section. If it reports that no page exists, rerun `holo prepare` and confirm the page path is `/admin`.

## Generate a model-backed resource

When a Holo model already exists and `holo prepare` has produced model/table metadata, you can generate form and table descriptors from that metadata:

```sh
holo make:resource Post --panel admin --generate
```

This creates `server/admin/resources/posts/PostResource.ts` and relation-manager definitions found in model metadata. Add `--split` to place form and table descriptors in separate schema/table files.

Without `--generate`, the resource generator creates safe placeholder `name` form and table fields for you to edit. Existing targets are never overwritten unless `--force` names each exact generated project-relative file.

A generated resource definition does not create application authorization, tenant scopes, page loaders, persistence operation routing, or the adapter runtime handlers. Add those server concerns explicitly. The framework examples contain complete Post resource journeys:

- [Next.js Post resource](../apps/example-next/server/admin/resources/posts/PostResource.ts)
- [Nuxt Post resource](../apps/example-nuxt/server/admin/resources/posts/PostResource.ts)
- [SvelteKit Post resource](../apps/example-sveltekit/server/admin/resources/posts/PostResource.ts)

Keep tenant and authorization scopes ahead of record lookup, relationship resolution, search, aggregation, import, export, and option resolution.

## Current command boundary

The currently implemented setup commands are `holo panels:install`, `holo panels:uninstall`, and the `holo make:*` generators exported by the Panels CLI package. Features described only in pending API proposals are intentionally not part of this guide.
