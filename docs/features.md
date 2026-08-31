# Features and framework integration

This page is a status reference for the APIs exported by the current Holo Panels packages. It is intentionally conservative: “available” means the API is exported from a package entrypoint and its behavior has repository tests. “Partial” means useful public pieces exist but the complete feature journey is not yet connected. “Internal” means source and tests exist but the module is not exported. “Pending” means the release plan requires the feature but the supported API is not present.

For package and subpath details, see the [package reference](package-reference.md). For security boundaries and deployment requirements, see the [security model](security.md) and [threat model](threat-model.md).

## Feature status

| Area | Status | Current supported surface | Important limitation |
|---|---|---|---|
| Panels and shell | Available | `definePanel`, `PanelRuntime`, `PanelShellStore`, branding/navigation/theme, auth/MFA, tenancy, defaults, and render slots | Native framework handlers remain responsible for fixed route integration and secure cookie effects. |
| Resources and CRUD | Available | `Resource`, `ListRecords`, `CreateRecord`, `ViewRecord`, `EditRecord`, `RelationManager`, and `ResourceExecutor` | Application supplies Holo model, validation, persistence, policies, and runtime registration. |
| Schemas and layouts | Available | `Schema`, public React/Vue/Svelte schema renderers, layouts, custom components, traversal, patches, and scoped slots | Server callbacks remain outside compiled client manifests. |
| Forms | Available | Typed field builders, `FormStore`, reactive dependencies, validation/error state, uploads | Server validation remains authoritative. |
| Dependent options | Available | `OptionStore`, option identities/cache keys, searchable/preloaded/dependent choice-field definitions | Application option transports must authorize and tenant-scope queries. |
| Tables | Available | Columns, filters, grouping, summaries, `TableQueryExecutor`, `TableStateStore` | Custom query hooks must preserve scopes and bounds. |
| Infolists | Available | Text, icon, boolean, image, color, code, key-value, repeatable, and custom entries, shared schema leaves, layouts, slots, visibility, and safe rich content | Application-defined rich-content renderers remain trusted code and require their own sanitizer policy. |
| Actions | Available | Source-inferred built-in/view/custom actions, groups, `ActionEngine`, `ClientActionStore`, complete modal/slide-over presentation, lifecycle hooks, notifications, and rate limiting | Application-defined handlers remain responsible for domain invariants and durable external side effects. |
| Relation managers | Available | `RelationManager`, the shared `Table`, `Schema`, and `Action` APIs, plus scoped attach/detach/associate/dissociate/create/edit/view/delete execution | Application persistence and policy callbacks remain required. |
| Pages | Available | Built-in/custom pages, extension renderers, configured variants, singular resources, and nested resources | Every loader and operation still requires server authorization. |
| Navigation and clusters | Available | Navigation seed/resolution, clusters, responsive shell/navigation stores | Visibility is not authorization. |
| Global search | Available | Server search definitions/engine and `GlobalSearchStore` | Every search resource needs policy and tenant scopes. |
| Widgets and dashboards | Available | Stats/chart/table/custom widgets, dashboards, filters, grid/polling client state | Data callbacks execute on the server and require authorization. |
| Toast notifications | Available | `panelNotification`, `PanelNotification`, `ClientToastStore`, transport effects | Delivery integrations remain application/Holo Notifications concerns. |
| Database notifications | Available | `PanelNotificationInbox`, `executePanelDatabaseNotificationOperation`, `ClientNotificationInboxStore`, realtime adapter | Recipient and tenant resolvers must derive identity from authenticated scope. |
| Shield | Available | Evaluator/composition, Holo DB and in-memory repositories, Role/Permission resources, migration lifecycle, and installed CLI commands | Shield remains optional and applications choose where to install its authorization layer. |
| Tenancy | Available | Inferred tenant definitions, registration/profile operations, switcher transport/UI, automatic resource scope, queued context, and cache identity | `.shared()` is the explicit resource opt-out; application callbacks must not bypass the trusted context. |
| Imports | Available | Inferred importer/column builders, bounded CSV/mapping execution, durable Holo DB lifecycle/outbox, Holo Queue dispatch, private Holo Storage, retries/cancellation/progress, notifications, and mounted framework controls | Applications configure mapping, persistence, validation, authorization, retention, and worker operations. |
| Exports | Available | Inferred exporter/column builders, scoped planning, CSV/XLSX adapters, durable chunk workers, private artifacts, signed downloads, cleanup, notifications, and mounted framework controls | Applications configure columns, authorization, private storage, retention, and worker operations. |
| Styling and icons | Available | Styles, tokens, namespaced icons, plugin asset publication, global defaults, and conflict-safe `panels:publish-ui` synchronization | Published UI is application-owned after uninstall and synchronization refuses local conflicts. |
| Plugins and custom components | Available extension system | All custom definition families, public framework registries, compatibility checks, assets/icons/translations/permissions/defaults/slots, the packed money plugin, and an independently packed all-family plugin example | Plugins and custom renderers are trusted executable code and are not sandboxed. |
| Testing | Available | `@holo-js/panels-testing` root helpers and repository contract/acceptance suites | Framework-specific testing subpaths currently export no utilities. |
| Deployment and upgrades | Validated prerelease process | Prepare/build/install/validation guidance, migration and upgrade procedures, and clean registry lifecycle coverage | Production deployments remain responsible for their configured infrastructure and application policies. |

## Panels

Create a panel with `definePanel` from `@holo-js/panels`. The fluent [`PanelBuilder`](../packages/core/src/panels/panel.ts) compiles an immutable client manifest and keeps access, actor projection, notification, tenancy, and plugin callbacks on the server definition.

```ts
import { definePanel } from '@holo-js/panels'

export default definePanel('admin')
  .path('/admin')
  .guard('admin')
  .access(({ actor }) => actor !== null)
  .presentActor(actor => ({ id: actor.id, name: actor.name }))
```

The exact methods above are present in the current builder. `presentActor` is a browser disclosure allow-list; do not return a model wholesale. Multiple-panel and guard behavior is covered in [Multiple panels and guards](multiple-panels-and-guards.md).

Available panel behavior includes stable IDs and paths, default-panel selection, branding, theme/dark-mode declarations, navigation modes, user-menu declarations, database-notification configuration, plugin installation, tenancy configuration, per-operation authentication, and panel-specific access.

Authentication and tenancy are compiled server-only capabilities. Login/logout, password reset, email verification, profile, MFA enrollment/challenge/recovery/disable, tenant registration/profile, and tenant switching dispatch through fixed native Next, Nuxt, and SvelteKit handlers. Holo Auth remains authoritative for guard sessions, secure cookies, password brokers, and MFA state.

## Resources, CRUD, and pages

Resources extend [`Resource`](../packages/resources/src/index.ts) and identify their Holo model with `protected static override model = Post`. Relation managers extend `RelationManager` and identify only the parent model relation with `protected static override relationship = 'comments'`. Holo Panels generates the resource-to-model and relation-manager bindings under `.holo-js/generated/panels`, so fields, loaded relation paths, callback records, form values, actions, and table state are inferred without record aliases, generic arguments, callback annotations, or duplicate model columns.

Forms, infolists, tables, and actions use model-bound component callbacks. For example, `this.configureForm((schema, field) => ...)` exposes `field.TextInput.make('title')`, while `this.configureTable((table, { TextColumn, EditAction }) => ...)` supports destructuring the same bound object. Both styles autocomplete only the current model and reject invalid paths at the call site. Static `form`, `infolist`, `table`, `getPages()`, `getRelations()`, and `getWidgets()` hooks compose the independent public packages. The lower-level [`ResourceExecutor`](../packages/core/src/resources/executor.ts) provides Holo policy calls, authoritative validation, scoped lookup, transactions, lifecycle hooks, and hidden-field removal.

Resource page classes exported from `@holo-js/panels` are:

- `ListRecords`
- `CreateRecord`
- `ViewRecord`
- `EditRecord`
- `ManageRecords`
- `ManageRelatedRecords`
- `Page`

Pages register deterministic routes with `PageClass.route(path)` and expose typed header/footer actions and widgets. `preparePageRoutes` checks route conflicts.

The [Next](../apps/example-next/server/admin/resources/posts/PostResource.ts), [Nuxt](../apps/example-nuxt/server/admin/resources/posts/PostResource.ts), and [SvelteKit](../apps/example-sveltekit/server/admin/resources/posts/PostResource.ts) examples exercise the same completed P17 product contract, including tenant-scoped resources, authentication and MFA, relations, widgets, notifications, imports, exports, and public blog behavior.

Singular resources reject list/create behavior and resolve one scoped authorized record. Nested resources resolve and authorize the parent before applying mandatory child scope. Immutable configured page/resource variants can be registered repeatedly without mutating their base definitions.

## Schemas and layout

The public schema entrypoint provides `Schema` plus layout components such as `Section`, `Grid`, `Fieldset`, `Tabs`, `Tab`, `Wizard`, and `WizardStep`.

- `section`, `grid`, `fieldset`, `group`, and `split`
- `tabs` and `tab`
- `wizard` and `step`
- `callout` and `emptyState`
- `customComponent`

Builders preserve typed state paths, responsive columns/spans, collapse state, labels, visibility, stable IDs/keys, render-slot references, and immutable compiled definitions. Traversal and patch utilities include `traverseSchema`, `findSchemaComponent`, `evaluateSchemaVisibility`, `patchSchemaNode`, and `applySchemaNodePatches`.

React, Vue, and Svelte export their general schema renderers from package roots. They consume public compiled manifests and cover layout, visibility, accessibility, responsiveness, persistence, ordered scoped slots, and custom registries. Action modal schemas use the same renderer boundary.

## Forms, reactivity, and dependent selects

### Field families

Public form classes in [`@holo-js/panels-forms`](../packages/forms/src/index.ts) are exported by `@holo-js/panels` and cover:

- text input, textarea, checkbox, toggle, radio, date/time, hidden, slider, color, and slug;
- select, multiselect, checkbox list, and toggle buttons;
- key-value, tags, repeater, rich editor, Markdown editor, and builder blocks;
- temporary upload and media field definitions.

Inside a resource, fields come from the model-bound component object: `this.configureForm((schema, field) => schema.components([field.TextInput.make('title')]))`. The callback can also destructure constructors such as `{ TextInput, Select }`. Invalid paths and incompatible value types fail during typechecking, fluent methods preserve the concrete field subtype, and callbacks retain the concrete record and field value types. The application writes no model type argument.

### Client state

`FormStore` in `@holo-js/panels-client` owns typed values, dirty/touched state, errors, focus metadata, dependency execution, arrays, optimistic versions, reset, and server patches. `SchemaStateStore` handles client schema state. Client dependencies improve interaction but never replace server validation or authorization.

Dependent choice fields use `OptionStore`, `OptionCache`, `createOptionIdentity`, and `createOptionCacheKey`. An option identity includes panel, field, actor/authorization scope, tenant, locale, search, dependencies, and pagination inputs supplied by the integration. The server transport must scope before relation lookup and must accept only the configured option resolver.

### Resolver boundary

The resolver APIs intentionally distinguish execution locations:

| API | Runs where | May contain |
|---|---|---|
| `literal(value)` | No callback; serialized value | JSON-safe public presentation only |
| `nullResolver()` | No callback; serialized null | No server state |
| `clientExpression(expression)` | Browser | Declarative expression over allowed client state |
| `clientResolver(name, dependencies)` | Browser registry | A stable registry name and declared dependencies |
| `serverResolver(callback, dependencies)` | Server | Actor, tenant, services, records, queries, and secrets as needed |

`ServerResolverBatcher` batches explicit server resolver requests and returns JSON-safe patches. Server callbacks are retained in server handles and must never be copied into manifests. Client resolvers are trusted application code but receive only browser-visible state. See [`resolvers`](../packages/core/src/resolvers) and the boundary discussion in the [Security model](security.md#trust-boundaries).

## Tables

The public table surface has four layers:

1. Column builders: text, icon, image, color, boolean, checkbox, toggle, select, text input, and custom columns.
2. Filter builders: boolean, select, relationship select, ternary, date range, trashed, custom schema, and advanced query filters.
3. Query execution: pagination, sorting, filters, relationship search, aggregates, authorization scope, tenant scope, and bounded selection.
4. Client state: `TableStateStore`, URL query serialization/restoration, selection, grouping, polling, filter mode, and stale-request cancellation.

Tables place the shared action contract through `recordActions()`, `headerActions()`, `toolbarActions()`, and `emptyStateActions()`. Grouping and summaries expose `Group`, `GroupingState`, `Summarizer`, page summaries, full-query summaries, and driver-normalized aggregates. Inline-editable columns use configured action execution rather than direct client persistence.

Renderer packages expose their framework table renderers and extension registries from their roots. Custom columns and extension filters use the same generated registry pipeline as built-ins; the packed money plugin proves a custom column in all three renderer families.

## Infolists

Infolist entry classes exported from `@holo-js/panels` include `TextEntry`, `IconEntry`, `ImageEntry`, `ColorEntry`, `CodeEntry`, `KeyValueEntry`, and `RepeatableEntry`. They compose in the same `Schema<TRecord>` used by resource forms and action modals.

Entry resolution supports direct record paths, relation paths, formatted scalar/JSON presentation, copying, actions, safe URL handling, responsive layout, attributes, ordered slots, visibility, safe Markdown, and sanitizer-bound rich content. Entry, filter, and widget leaves compose through the shared schema tree, and every renderer resolves custom entries through the same generated registry contract.

## Actions

`this.action(({ Action }) => Action.make('publish'))` creates a resource action with its record, input, actor, tenant, services, and modal field types inferred from the resource model. `PostResource.actions(({ CreateAction }) => [CreateAction.make()])` creates page actions. The component object passed to `configureTable` exposes the same constructors for `recordActions`, `headerActions`, `toolbarActions`, and `emptyStateActions`. The same action instance can be injected into pages, tables, notifications, and action modals. Create, view, edit, delete, restore, force-delete, replicate, import, export, bulk actions, and action groups use that contract. `ClientActionStore` handles mounting, form collection, confirmation, submission phases, failure, and success in the browser.

Server execution validates the mounted action, bounds bulk record IDs, reauthorizes, validates modal data, checks record versions, uses configured transactions, and returns a bounded effect set. A hidden or disabled action is not an authorization decision.

React, Vue, and Svelte render grouped triggers and complete modal or slide-over presentations, including headings, descriptions, widths, ordered slots, nested actions, focus behavior, and Escape handling. Rate limiting runs after authorization and before transactions and action lifecycle execution. A source-inferred custom action packaging example is available in [`examples/plugins`](../examples/plugins/custom-action.ts).

### Bulk selection and execution

Table selections persist across pages and filter views. Selecting all matching records captures the current query; exclusions remove records from that selection, and administrators can add records from another view. The server resolves the captured query inside the resource and tenant scopes. Selections are limited to 10,000 records per execution.

Use `selectCurrentPageOnly()`, `selectGroupsOnly()`, or `maxSelectableRecords(n)` on the table to restrict selection. Generated resource operations enforce these restrictions on the server as well as in the table controls.

Custom bulk callbacks run once per selection, or once per chunk when `chunkSelectedRecords(n)` is configured. Chunk sizes must be between 1 and 1,000. Each callback receives only records that passed authorization and version checks. The execution response includes each chunk's callback result on its first successful item, with per-record statuses for every item. This avoids repeating large results for every selected ID. `deselectRecordsAfterCompletion()` clears selection after complete success; partial failures preserve it for correction or retry.

`fetchSelectedRecords(false)` passes authorized identifiers through `context.selectedRecordIds`, with an empty `selectedRecords` array and a null `record`. The callback can use those IDs with existing Holo services. Authorization lookups use batches of at most 250 records, which are discarded instead of retaining the whole selection. Holo record policies still require model instances, so this option reduces retained memory but does not eliminate policy-related model loading. Built-in record operations retain their model validation and lifecycle behavior and use bounded batches in this mode. Application callbacks must preserve tenant scopes, domain validation, and mutation policies when executing their own queries.

## Relation managers

Relation managers extend `RelationManager`, declare `protected static override relationship = 'comments'`, and configure the normal schema and table through `this.configureForm(...)`, `this.configureInfolist(...)`, and `this.configureTable(...)`. The owner and related record types are generated from the parent resource and its Holo relation, so application code writes no generic arguments. The server `RelationManagerExecutor` supports:

- `attach`, `detach`, `associate`, and `dissociate`;
- related record `create`, `view`, `edit`, and `delete`;
- pivot-field allow-lists and validation;
- searchable related options;
- owner, tenant, and authorization scopes before related lookup;
- inline, page, tabs, and grouped-tabs presentation metadata.

The application supplies relation persistence, query scopes, validation, transactions, and operation authorization. Client relation state and framework renderers are public through `@holo-js/panels-client` and the matching renderer package.

## Navigation, clusters, and search

`defineCluster` is the umbrella discovery marker. Panel/page/resource navigation compiles into deterministic groups, clusters, ordering, badges, icons, active state, and panel-switch entries. `NavigationStore` implements responsive open/collapse/focus behavior and rejects unknown panel switch IDs.

Global search exposes the framework-neutral `GlobalSearchStore` and core server search engine/contracts. Server search uses fixed registered resources, authorizes panel/resource/result/page access, applies tenant and policy scopes before query execution, bounds the term and result counts, and restricts result URLs to the panel.

Search result visibility in the browser does not grant page or record access; destination resolution must authorize again.

## Widgets and dashboards

Public builders include:

- `defineStatsWidget`
- `defineChartWidget`
- `defineTableWidget`
- `defineCustomWidget`
- resource variants of each widget
- `defineDashboard`

Widgets have server visibility, authorization, and data callbacks. The client `WidgetStore` handles loading, polling, errors, hidden/unauthorized states, and filters; `WidgetFilterPersistence` stores filter state; `resolveWidgetGrid` creates responsive placement. Charts have accessible tabular fallbacks through `createAccessibleChartModel` and `renderAccessibleChart`.

Stats accept optional `progress: { value, max }`. Values must be finite, with a positive maximum and a value between zero and the maximum. Renderers show a labeled native progress indicator alongside the stat icon, trend, and sparkline.

Dashboards are discovered as pages. Use `.filtersForm(new Schema().components([...]).compile())` for shared form controls and `.persistFiltersInSession()` to save validated filters in the authenticated Holo session. Saved values are scoped by actor, panel, tenant, and dashboard. Reset removes that scope's saved values and restores schema defaults. A widget's local filters override dashboard filters with the same name. See the [Metrics dashboard](../apps/example-next/server/admin/pages/MetricsDashboard.ts) and its [filtered publishing widget](../apps/example-next/server/admin/widgets/FilteredPublishing.ts).

Lazy loading, filter changes, retries, and polling fetch fresh data through the existing `page-data` operation. Each request rechecks page, widget, tenant, and resource access. Widgets receive the authorized current record or normalized parent-table state when placed on resource pages. Server failures clear widget data and display the configured error state without exception details.

## Notifications

`Notification.make()` builds a fluent notification with status, title, body, duration, persistence, icon/color, shared actions, and `send()`, `sendToDatabase()`, or `broadcast()` delivery methods. `PanelNotification` integrates with Holo Notifications delivery, and toast effects are consumed by `ClientToastStore`.

Database notifications use `databaseNotificationPayload`, `PanelNotificationInbox`, `holoNotificationStore`, and `executePanelDatabaseNotificationOperation`. The client exposes `ClientNotificationInboxStore`, `createPanelNotificationTransport`, and `fluxNotificationRealtime`. Records are scoped by recipient, guard, panel, tenant, and payload version; mutations enumerate visible IDs before applying changes.

The application owns recipient/tenant identity callbacks, Holo notification/database/broadcast configuration, retention, and realtime subscription authorization.

## Shield and permissions

The public `@holo-js/panels-shield` surface supports:

- `shield(...)` panel plugin construction;
- `createShieldEvaluator(...)`;
- `composeShieldAuthorization(...)`;
- deterministic permission generation;
- `createInMemoryShieldRepository()` and `createHoloShieldRepository()`;
- configurable Shield Role and Permission resources;
- installed setup, diff, sync, role, and seed commands;
- public evaluation and assignment contracts.

Shield is optional. Core does not depend on it. The intended authorization order is panel access, tenant access, Shield permission when enabled, Holo class/record policy, then operation invariant.

Shield migrations are distributed through the installed Holo plugin lifecycle. Role and Permission administration uses standard resources, and installed authorization layers compose with panel access, tenant access, Holo policy, and operation invariants. Shield remains optional; core does not depend on it.

## Tenancy

The panel builder exports inference-first `.tenancy(options)`. Its runtime validates tenant IDs, memberships, route keys, active persistence, registration/profile values, bootstrap presentation, and versioned queued context. The panel shell and React, Vue, and Svelte switchers accept only allow-listed memberships and rotate cache identity after a switch.

Trusted tenant context automatically scopes unshared resources and propagates through options, actions, global search, notifications, jobs, imports, exports, and caches. `.shared()` is the explicit resource opt-out. Tenant scope is still authorization-sensitive server state, never client authority.

## Imports and exports

`defineImporter` and `defineExporter` are inference-first public builders, also generated by `holo make:importer` and `holo make:exporter`. Resource-bound definitions infer record, input, actor, and tenant types without caller-declared generics.

The public transfer runtime covers bounded streaming CSV, import mapping and row execution, scoped export planning, CSV/XLSX adapters, formula neutralization, durable Holo Database operation/outbox state, fixed Holo Queue jobs, private streaming Holo Storage artifacts, retries, cancellation, progress, cleanup, authorized expiring downloads, and deduplicated Holo Notifications completion delivery.

Next, Nuxt, and SvelteKit execute the same database-queue/private-storage import and export acceptance journey, and alternative queue/storage adapters pass the public driver contracts.

## Styling, icons, and custom renderers

Import the common design layer and exactly one renderer stylesheet:

```ts
import '@holo-js/panels-ui/style.css'
import '@holo-js/panels-react/style.css'
```

Replace the renderer stylesheet with `@holo-js/panels-vue/style.css` or `@holo-js/panels-svelte/style.css` for the matching framework. The UI package exports design tokens, accessibility/conformance contracts, semantic shell primitive names, `PanelIconRegistry`, and `definePanelIcon` without a framework runtime.

React exports its component registry, Vue exports `ComponentRegistry`, and Svelte exports `SvelteComponentRegistry`. Custom components and built-ins resolve through registries rather than a central renderer type switch.

Public render slots, plugin asset/icon publication, global per-type defaults, and safe diff-based UI publishing are implemented. The packed money plugin proves three-renderer installation, and the independent all-extension-family example builds, packs, installs, and imports without modifying Holo Panels core.

## Framework wiring differences

Framework routing remains owned by Next.js, Nuxt, or SvelteKit. `holo panels:install` and `holo prepare` plan the thin framework-native files, while each application supplies its generated/runtime registry.

### Next.js

Use `createPanelPage` for the catch-all App Router page and `createPanelOperationRoute` for the fixed operation route:

```tsx
// app/admin/[[...panelsPath]]/page.tsx
import { createPanelPage } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

export default createPanelPage({ panelId: 'admin', runtime: panelsRuntime })
```

```ts
// app/holo/panels/[panelId]/[operation]/route.ts
import { createPanelOperationRoute } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: panelsRuntime })

export const GET = route.GET
export const POST = route.POST
```

The exact repository fixtures are the [Next page](../apps/example-next/app/admin/[[...panelsPath]]/page.tsx) and [Next operation route](../apps/example-next/app/holo/panels/[panelId]/[operation]/route.ts). Browser-only code may import `NextPanelClient` and `NextPanelResourcePage` from `@holo-js/panels-next/client`.

### Nuxt

Use `usePanelPage` and `PanelPage` in the catch-all Vue page, and export `createPanelOperationHandler` from the Nitro server route:

```vue
<!-- pages/admin/[[...panelsPath]].vue -->
<script setup lang="ts">
import { PanelPage, usePanelPage } from '@holo-js/panels-nuxt'

const panelPage = await usePanelPage({ panelId: 'admin' })
</script>

<template>
  <PanelPage :page="panelPage" />
</template>
```

```ts
// server/routes/holo/panels/[panelId]/[operation].ts
import { createPanelOperationHandler } from '@holo-js/panels-nuxt'
import { panelsRuntime } from '../../../../panels/runtime'

export default createPanelOperationHandler({ panelIds: ['admin'], runtime: panelsRuntime })
```

The exact fixtures are the [Nuxt page](../apps/example-nuxt/app/pages/admin/[[...panelsPath]].vue) and [Nuxt operation handler](../apps/example-nuxt/server/routes/holo/panels/[panelId]/[operation].ts).

### SvelteKit

Use `createPanelPageLoad` in the server load, `PanelPage` in the Svelte page, and `createPanelOperationHandler` in the operation endpoint:

```ts
// src/routes/admin/[...path]/+page.server.ts
import { createPanelPageLoad } from '@holo-js/panels-sveltekit'
import { panelsRegistry } from '$lib/server/panels/registry'

export const load = createPanelPageLoad({ panelId: 'admin', registry: panelsRegistry })
```

```svelte
<!-- src/routes/admin/[...path]/+page.svelte -->
<script lang="ts">
  import { PanelPage } from '@holo-js/panels-sveltekit'

  let { data } = $props()
</script>

<PanelPage {data} />
```

```ts
// src/routes/holo/panels/[panelId]/[operation]/+server.ts
import { createPanelOperationHandler } from '@holo-js/panels-sveltekit'
import { panelsRegistry } from '$lib/server/panels/registry'

const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: panelsRegistry })

export const GET = handler.GET
export const POST = handler.POST
```

The exact fixtures are the [SvelteKit load](../apps/example-sveltekit/src/routes/admin/[...path]/+page.server.ts), [SvelteKit page](../apps/example-sveltekit/src/routes/admin/[...path]/+page.svelte), and [SvelteKit endpoint](../apps/example-sveltekit/src/routes/holo/panels/[panelId]/[operation]/+server.ts).

### Shared framework rules

- Register only fixed panel IDs and fixed generated definitions.
- Keep route shells thin; authorization, queries, and persistence belong in the server runtime.
- Import exactly one framework adapter/renderer family.
- Preserve the generated operation route so route and envelope identifiers are compared.
- Preserve Holo Security CSRF verification and request-size limits.
- Do not expose a server registry, callback, Holo model, query, or secret through a client module.

## API index

This compact index points to currently exported symbols. The generated declarations remain authoritative for generic parameters and overloads.

| API | Package | Purpose |
|---|---|---|
| `ActionEngine` | core | Authorized action execution |
| `ClientActionStore` | client/renderers | Browser action lifecycle |
| `ClientNotificationInboxStore` | umbrella/client/renderers | Database-notification client state |
| `ClientToastStore` | umbrella/client/renderers | Toast state and effects |
| `ExtensionRegistry` | core | Custom type and renderer registration |
| `FormStore` | client/renderers | Framework-neutral form state |
| `GlobalSearchStore` | client | Search request/client state |
| `NavigationStore` | client | Responsive navigation state |
| `OptionStore` | client/renderers | Dependent/searchable options |
| `PanelNotificationInbox` | umbrella/core | Scoped database-notification server access |
| `PanelRuntime` | umbrella/core/client/renderers | Guard and panel access boundary |
| `PanelShellStore` | umbrella/client/renderers | Shared panel shell state |
| `PanelPage` | Nuxt/SvelteKit adapters | Framework page renderer |
| `PanelsTransport` | client/renderers | Versioned same-origin transport |
| `RelationManagerExecutor` | core | Scoped relation operations |
| `ResourceExecutor` | umbrella/core | Resource CRUD execution |
| `ServerResolverBatcher` | core | Batched server-only resolver execution |
| `TableQueryExecutor` | core | Scoped table query execution |
| `TableStateStore` | client/renderers | Table query/selection state |
| `UploadStore` | client | Temporary upload client lifecycle |
| `WidgetStore` | umbrella/client | Widget loading and polling |
| `composeShieldAuthorization` | Shield | Ordered authorization composition |
| `createPanelOperationHandler` | Nuxt/SvelteKit adapters | Fixed framework operation endpoint |
| `createPanelOperationRoute` | Next adapter | Fixed Next operation route |
| `createPanelPage` | Next adapter | Next catch-all page |
| `createPanelPageLoad` | SvelteKit adapter | SvelteKit server load |
| `definePanel` | umbrella/core | Panel builder |
| `Resource` | umbrella/resources | Model-derived resource class |
| `Schema` | umbrella/schemas | Typed shared schema |
| `Table` | umbrella/tables | Typed table and action positions |
| `Action` | umbrella/actions | Reusable action contract |
| `Notification` | umbrella/notifications | Fluent notification and delivery API |
| `shield` | Shield | Optional panel plugin |
| `usePanelPage` | Nuxt adapter | Nuxt page resolution composable |

## Testing, deployment, and upgrades

Use `@holo-js/panels-testing` for its currently exported framework-neutral assertions and acceptance journeys. Its `/react`, `/vue`, and `/svelte` subpaths are reserved public paths with empty declarations today; do not import helpers from them yet.

The complete validation, packed-package, deployment, rollback, and upgrade workflow is in [Testing, deployment, and upgrades](testing-deployment-upgrades.md). Installation and first setup are in [Installation](installation.md) and [Build your first panel](first-panel.md).

## Explicitly unavailable APIs

Framework-specific helpers are not currently exported from the reserved `@holo-js/panels-testing/react`, `/vue`, and `/svelte` subpaths. Use the framework-neutral testing helpers from the package root and the public renderer APIs. Files that are not present in package export maps remain internal even when build output exists for them.
