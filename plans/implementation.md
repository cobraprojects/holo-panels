# Holo Panels: Complete Implementation Plan

Status: approved implementation plan; P14-P17 public API proposals approved on 2026-07-29

Product name: Holo Panels

Primary install package: `@holo-js/panels`

Architecture: an official Holo plugin developed in its own workspace monorepo, analogous to Filament being developed separately from Laravel while using Laravel's application, CLI, ORM, auth, queues, notifications, and extension conventions.

Research baseline: Filament 5 documentation as published on 2026-07-27, plus the Holo-JS repository at `/Users/cobra/Code/holo-js` on the same date.

This file is self-contained. An implementation agent must not need the conversation that produced it. Work in this repository follows its local `AGENTS.md`; cross-repository work in Holo-JS also follows the Holo-JS repository instructions. When implementation would change a public API shown in this plan, stop and obtain user approval for the replacement API before editing.

## Implementation tracking

Checkboxes are the authoritative implementation record:

- Leave a checkbox unchecked until its implementation or verification is complete.
- Check an individual task only after its required diagnostics, typecheck, lint, and targeted behavior tests pass.
- Check acceptance criteria only after observing the stated behavior; completing the implementation tasks is not enough.
- Check a phase gate only after every task and acceptance criterion in that phase is checked and the phase-wide validation passes.
- Record evidence beside the checkbox or in the implementation pull request when a result is not obvious from the source.
- If a completed task later regresses, uncheck it until the regression is fixed and revalidated.

Master phase checklist:

- [x] P0: host capability and repository bootstrap
- [x] P1: protocol, builders, registries, and testing foundation
- [x] P2: discovery compiler and Holo CLI integration
- [x] P3: shared schema and resolver engine
- [x] P4: client state and transport engine
- [x] P5: UI tokens and renderer foundations
- [x] P6: forms
- [x] P7: tables
- [x] P8: infolists and actions
- [x] P9: resources, pages, CRUD, framework adapters, and panel shell
- [x] P10: relation managers
- [x] P11: navigation, clusters, and global search
- [ ] P12: widgets and dashboards
- [x] P13: notifications and database notifications
- [x] P14: Shield, auth pages, multi-factor authentication, and tenancy
- [x] P15: imports and exports
- [x] P16: extended parity and plugin ecosystem
- [ ] P17: documentation, hardening, and release

## 1. Objective

Build Holo Panels as a first-class, resource-driven administration and application-panel system for Holo-JS. It must provide the ease of Filament's panels, resources, forms, tables, relation managers, infolists, widgets, actions, notifications, database notifications, navigation, search, tenancy, and plugin ecosystem while remaining native to TypeScript and to Holo's supported frameworks:

- Next.js with React.
- Nuxt with Vue.
- SvelteKit with Svelte.

Holo Panels must reuse Holo services rather than replace them:

- `@holo-js/db` for models, queries, relations, pagination, transactions, and persistence.
- `@holo-js/forms` and `@holo-js/validation` for authoritative input validation.
- `@holo-js/auth` for guards, providers, sessions, current actors, and impersonation.
- `@holo-js/authorization` for abilities and record/class policies.
- `@holo-js/notifications` for email, database, broadcast, queued, and custom-channel notifications.
- `@holo-js/queue` for queued imports, exports, notifications, and long-running actions.
- `@holo-js/storage` and `@holo-js/media` for uploads, private exports, and media previews.
- `@holo-js/broadcast`, `@holo-js/realtime`, and the Flux framework packages for live updates.
- `@holo-js/security` for CSRF, throttling, request boundaries, and safe response behavior.
- `@holo-js/config`, `@holo-js/kernel`, `@holo-js/core`, and the framework adapters for ordinary Holo runtime integration.

Holo Panels is not a competing framework, ORM, router, auth system, notification system, or CLI.

## 2. Non-negotiable product decisions

These decisions are locked for the initial implementation. Changing one requires explicit user approval.

1. Holo Panels is maintained in a separate repository from Holo-JS.
2. Holo Panels is an official Holo plugin. Its commands are loaded into the existing `holo` executable through Holo's plugin contribution system.
3. Users install the umbrella package `@holo-js/panels`. They do not use a separate `panels` executable.
4. The Holo Panels repository is a workspace monorepo containing multiple independently testable and publishable packages. All packages release in lockstep with the umbrella package.
5. Application-facing APIs are fluent. Structural configuration is expressed through builders and chained methods, not large object literals.
6. Fluent methods accept typed resolvable values where meaningful: literals, `null`, translations, expressions, and callbacks.
7. Holo Panels owns a headless component protocol, state engines, accessibility expectations, design tokens, and framework renderers.
8. Holo Panels may use shadcn family source and headless primitives as implementation input, but shadcn is not the public resource API and consuming applications are not required to install or configure shadcn.
9. Framework routing remains owned by Next.js, Nuxt, or SvelteKit. Holo Panels installs thin framework-native route shells.
10. Discovery happens at prepare/build time and produces generated registries. Production runtime must not scan the filesystem.
11. Server callbacks, queries, authorization logic, secrets, and undisclosed record properties never enter the client manifest.
12. UI visibility is never an authorization boundary. Every operation is authorized again on the server.
13. Holo validation is authoritative. Browser validation and reactive state are convenience layers only.
14. A panel may use the same guard as another panel or a different guard. Panel access and permissions remain panel-specific.
15. Custom fields, columns, entries, filters, actions, widgets, pages, resources, renderers, and plugins use the same public registries as built-in features.
16. Built-in builders compile to immutable, versioned definitions. Renderers consume definitions, not mutable builders.
17. There will be no central component-type switch statement that must be edited whenever a plugin adds a type.
18. All public names, generated IDs, routes, permissions, and protocol fields are deterministic.

## 3. Distribution and repository boundary

### 3.1 User experience

The normal installation flow is:

```bash
npx holo plugin:add @holo-js/panels
npx holo panels:install
npx holo make:panel admin
npx holo make:resource Post --panel admin --generate
npx holo prepare
```

After `plugin:add`, Holo discovers Holo Panels CLI contributions. All later commands are ordinary `holo` commands.

The plugin installer detects the application's framework and installs exactly one framework adapter:

- Next.js: `@holo-js/panels-next` and its React renderer dependencies.
- Nuxt: `@holo-js/panels-nuxt` and its Vue renderer dependencies.
- SvelteKit: `@holo-js/panels-sveltekit` and its Svelte renderer dependencies.

The application normally imports resource, schema, table, action, panel, widget, and notification builders only from `@holo-js/panels`.

### 3.2 Holo-JS host changes

Holo-JS already supports plugin-contributed CLI commands, runtime boot modules, dependencies, config files, migrations, and custom runtime drivers/channels. Holo Panels must use those facilities.

One generic host extension is required unless Holo-JS gains an equivalent before implementation:

- Add a plugin project-preparation contribution that `holo prepare`, `holo dev`, and `holo build` invoke.
- The contribution must support a normal prepare run and an incremental watch run.
- The contribution must be generic and named for plugin discovery/project preparation, not hard-coded to Holo Panels.
- It must receive the project root, normalized Holo config, detected framework descriptor, generated-root path, and changed paths during hot preparation.
- It must return generated artifact metadata and framework-managed artifact requests without writing outside declared paths.
- Failures must identify the plugin, contribution module, and invalid artifact.

Proposed Holo plugin contribution shape:

```ts
defineHoloPlugin({
  id: 'panels',
  name: 'Holo Panels',
  contributes: {
    cli: {
      commands: './dist/commands.mjs',
    },
    runtime: {
      boot: './dist/runtime.mjs',
    },
    migrations: {
      publish: './dist/migrations.mjs',
    },
    project: {
      prepare: './dist/prepare.mjs',
    },
  },
})
```

The exact generic `project.prepare` host API must be proposed in the Holo-JS repository and approved before implementation because it extends the public Holo plugin manifest.

No other Holo-JS package should gain panel-specific behavior unless an external plugin cannot safely provide it.

## 4. Holo Panels workspace layout

The standalone Holo Panels repository must use the following layout:

```text
holo-panels/
├── package.json
├── bun.lock
├── tsconfig.json
├── eslint.config.mjs
├── vitest.workspace.ts
├── README.md
├── AGENTS.md
├── packages/
│   ├── panels/
│   ├── core/
│   ├── schemas/
│   ├── actions/
│   ├── forms/
│   ├── tables/
│   ├── infolists/
│   ├── notifications/
│   ├── resources/
│   ├── client/
│   ├── ui/
│   ├── react/
│   ├── vue/
│   ├── svelte/
│   ├── next/
│   ├── nuxt/
│   ├── sveltekit/
│   ├── cli/
│   ├── shield/
│   └── testing/
├── apps/
│   ├── example-next/
│   ├── example-nuxt/
│   ├── example-sveltekit/
│   └── docs/
├── scripts/
│   ├── validate-architecture.mjs
│   ├── validate-published-packages.mjs
│   ├── validate-parity-matrix.mjs
│   └── release.mjs
└── plans/
    └── implementation.md
```

The repository root package is private. Shared dependency versions live in the root `workspaces.catalog`. Holo package dependencies use compatible published versions during normal development and a documented local-link workflow when coordinated changes are required.

### 4.1 Workspace packages

| Directory | Package | Responsibility |
|---|---|---|
| `packages/panels` | `@holo-js/panels` | Umbrella package, public re-exports, Holo plugin manifest, runtime boot entry, normal user install target |
| `packages/core` | `@holo-js/panels-core` | Immutable protocol definitions, registries, resolvers, execution engines, and server contracts |
| `packages/schemas` | `@holo-js/panels-schemas` | Shared typed schema container and layout components used by forms, infolists, actions, pages, and tables |
| `packages/actions` | `@holo-js/panels-actions` | Reusable typed actions, action groups, built-in CRUD actions, modal schemas, and execution contracts |
| `packages/forms` | `@holo-js/panels-forms` | Typed form fields and field-specific fluent configuration |
| `packages/tables` | `@holo-js/panels-tables` | Typed tables, columns, filters, groups, summaries, record actions, header actions, and toolbar actions |
| `packages/infolists` | `@holo-js/panels-infolists` | Typed read-only entry schemas |
| `packages/notifications` | `@holo-js/panels-notifications` | Fluent notifications that accept the shared action contracts |
| `packages/resources` | `@holo-js/panels-resources` | Resource classes, CRUD page classes, relation managers, model inference, and runtime compilation |
| `packages/client` | `@holo-js/panels-client` | Framework-neutral form/table/page state engines, dependency graph, transport, cache, optimistic state, public client plugin contracts |
| `packages/ui` | `@holo-js/panels-ui` | Design tokens, icons, semantic CSS, accessibility contracts, component presentation contracts, no framework runtime |
| `packages/react` | `@holo-js/panels-react` | React renderers and React custom-component registration |
| `packages/vue` | `@holo-js/panels-vue` | Vue renderers and Vue custom-component registration |
| `packages/svelte` | `@holo-js/panels-svelte` | Svelte renderers and Svelte custom-component registration |
| `packages/next` | `@holo-js/panels-next` | Next.js route shells, request adapters, React server/client boundaries, navigation and error integration |
| `packages/nuxt` | `@holo-js/panels-nuxt` | Nuxt module, native pages/endpoints, Vue integration, route middleware and error integration |
| `packages/sveltekit` | `@holo-js/panels-sveltekit` | SvelteKit pages/endpoints/hooks, Svelte integration, redirects and error integration |
| `packages/cli` | `@holo-js/panels-cli` | Holo command contributions, discovery compiler, generators, installers, managed framework artifacts |
| `packages/shield` | `@holo-js/panels-shield` | RBAC persistence, permission discovery, generated policies, role/permission resources and panel plugin |
| `packages/testing` | `@holo-js/panels-testing` | Behavior-oriented resource/schema/table/action/widget/plugin test harnesses and renderer contract suites |

### 4.2 Dependency direction

The allowed dependency graph is:

```text
schemas ───────────────> core
forms ─────────────────> schemas/core
actions ───────────────> schemas/core
tables ────────────────> actions/schemas/core
infolists ─────────────> schemas/core
notifications ─────────> actions/core
resources ─────────────> actions/notifications/schemas/tables/core
panels umbrella ───────> public domain packages/core/cli/client/ui
renderers ─────────────> client/core/ui
framework adapters ────> matching renderer
shield/testing ────────> their declared core/client/renderer boundaries
```

Rules:

- `panels-core` must not depend on a UI framework package.
- Public resource composition must use the domain packages. The umbrella package must not expose a second resource, schema, table, form, infolist, action, relation-manager, or notification builder family.
- `panels-client` must not depend on React, Vue, Svelte, Next, Nuxt, or SvelteKit.
- Renderer packages must not contain database queries, authorization decisions, or persistence.
- Framework adapter packages may depend only on the matching renderer.
- `panels-ui` must not depend on any framework runtime.
- `panels-shield` must not be required by core; it is an optional plugin.
- `panels-cli` may inspect core definition markers but must not import framework runtime modules eagerly.
- The umbrella package must not cause all three framework adapters to be installed or bundled.
- A repository architecture test must reject workspace cycles, undeclared imports, and imports from non-exported subpaths.

### 4.3 Package exports

The umbrella package must expose stable subpaths:

```text
@holo-js/panels
@holo-js/panels/server
@holo-js/panels/client
@holo-js/panels/plugin
```

Normal definitions use the root export. Trusted request execution uses `/server`. Browser-safe helpers use `/client`. Plugin authors may use `/plugin`.

Framework-specific APIs are imported from their packages and are never re-exported through a conditional runtime guess.

## 5. Internal domain layout

`packages/core/src` must be organized by product domain:

```text
src/
├── protocol/
│   ├── version.ts
│   ├── values.ts
│   ├── nodes.ts
│   ├── messages.ts
│   ├── errors.ts
│   └── serialization.ts
├── builders/
│   ├── Builder.ts
│   ├── DefinitionWriter.ts
│   └── capabilities/
├── resolvers/
│   ├── contracts.ts
│   ├── literal.ts
│   ├── translation.ts
│   ├── expression.ts
│   ├── server.ts
│   └── dependency-tracking.ts
├── schemas/
│   ├── Schema.ts
│   ├── components/
│   └── layouts/
├── forms/
│   ├── Form.ts
│   ├── Field.ts
│   ├── fields/
│   ├── state-codecs/
│   └── option-sources/
├── infolists/
│   ├── Infolist.ts
│   ├── Entry.ts
│   └── entries/
├── tables/
│   ├── Table.ts
│   ├── Column.ts
│   ├── columns/
│   ├── filters/
│   ├── grouping/
│   └── summaries/
├── actions/
│   ├── Action.ts
│   ├── built-ins/
│   ├── modal.ts
│   └── execution.ts
├── resources/
│   ├── Resource.ts
│   ├── queries.ts
│   ├── persistence.ts
│   ├── authorization.ts
│   ├── search.ts
│   └── pages/
├── relations/
│   ├── RelationManager.ts
│   ├── capabilities.ts
│   └── operations/
├── panels/
│   ├── Panel.ts
│   ├── access.ts
│   ├── registry.ts
│   └── tenancy.ts
├── pages/
├── widgets/
├── navigation/
├── notifications/
├── imports/
├── exports/
├── plugins/
└── index.ts
```

Every feature directory owns its contracts, builder, normalization, execution logic, tests, and exports. Adding a field or column must not require editing unrelated feature implementations.

## 6. Application conventions

Each panel has a separate source root:

```text
server/
├── admin/
│   ├── AdminPanel.ts
│   ├── resources/
│   │   └── posts/
│   │       ├── PostResource.ts
│   │       ├── schemas/
│   │       │   ├── PostForm.ts
│   │       │   └── PostInfolist.ts
│   │       ├── tables/
│   │       │   └── PostsTable.ts
│   │       ├── pages/
│   │       │   ├── ListPosts.ts
│   │       │   ├── CreatePost.ts
│   │       │   ├── ViewPost.ts
│   │       │   └── EditPost.ts
│   │       ├── relation-managers/
│   │       │   └── CommentsRelationManager.ts
│   │       └── widgets/
│   │           └── PostStats.ts
│   ├── pages/
│   │   ├── Dashboard.ts
│   │   └── Settings.ts
│   ├── widgets/
│   ├── clusters/
│   ├── imports/
│   └── exports/
├── vendor/
│   ├── VendorPanel.ts
│   ├── resources/
│   ├── pages/
│   └── widgets/
└── panels-shared/
    ├── resources/
    ├── pages/
    └── widgets/
```

Panel roots are independent. A shared definition is registered explicitly in each panel that uses it.

The default panel file is fluent:

```ts
export default definePanel('admin')
  .default()
  .path('/admin')
  .guard('admin')
  .globalSearch()
  .databaseNotifications()
  .databaseNotificationsPolling('30s')
  .plugin(shield())
```

Holo discovers conventional resource, page, widget, and cluster directories relative to the panel file. Discovery methods accept explicit panel-relative directories for non-conventional layouts. Explicit `.resources()`, `.pages()`, `.widgets()`, and `.clusters()` registration remains supported.

### 6.1 Filament-shaped panel configuration parity

Every panel owns an independent configuration file such as `server/admin/AdminPanel.ts` or `server/cp/CpPanel.ts`. Generated registries may compile those files internally, but applications never maintain a central panel configuration or runtime-helper file.

The public panel builder preserves Filament 5 method names and chaining semantics wherever the behavior is framework-neutral. Laravel-, Blade-, Livewire-, or Vite-specific implementation types are replaced by Holo and renderer contracts without changing the observable panel capability.

- [x] Identity and routing: `default()`, `id()`, `path()`, `domain()`, `domains()`, `homeUrl()`, `routes()`, `authenticatedRoutes()`, `tenantRoutes()`, and `authenticatedTenantRoutes()`.
- [x] Authentication: `login()`, `registration()`, `passwordReset()`, `emailVerification()`, `emailChangeVerification()`, `profile()`, `simpleProfilePage()`, `authGuard()`, `authPasswordBroker()`, authentication route slug and prefix methods, `revealablePasswords()`, `multiFactorAuthentication()`, and `strictAuthorization()`.
- [x] Branding and appearance: `defaultAvatarProvider()`, `brandName()`, `brandLogo()`, `darkModeBrandLogo()`, `brandLogoHeight()`, `favicon()`, `colors()`, `darkMode()`, `defaultThemeMode()`, `themeSwitcher()`, `font()`, `monoFont()`, `serifFont()`, `theme()`, `viteTheme()`-equivalent compiled theme assets, and `icons()`.
- [x] Layout: `maxContentWidth()`, `simplePageMaxContentWidth()`, `subNavigationPosition()`, and `breadcrumbs()`.
- [x] Navigation: `navigation()`, `navigationGroups()`, `navigationItems()`, `collapsibleNavigationGroups()`, `sidebarCollapsibleOnDesktop()`, `sidebarFullyCollapsibleOnDesktop()`, `sidebarWidth()`, `collapsedSidebarWidth()`, `topNavigation()`, `topbar()`, sidebar and topbar component replacement, `userMenu()`, and `userMenuItems()`.
- [x] Components: `resources()`, `pages()`, `widgets()`, discovery for resources, pages, widgets, and clusters, configured registrations, resource create/edit redirects, and read-only relation-manager defaults.
- [x] Global search: `globalSearch()`, `globalSearchDebounce()`, `globalSearchKeyBindings()`, `globalSearchFieldSuffix()`, `globalSearchFieldKeyBindingSuffix()`, and `globalSearchResourceOptIn()` while resource record titles enable default participation.
- [x] Notifications: `databaseNotifications()`, lazy loading, placement, polling, component replacement, and `broadcasting()`.
- [x] Tenancy: `tenant()`, `tenantRoutePrefix()`, `tenantDomain()`, `tenantSwitcher()`, `searchableTenantMenu()`, `tenantMenu()`, `tenantMenuItems()`, `tenantProfile()`, `tenantRegistration()`, `tenantBillingProvider()`, `tenantBillingRouteSlug()`, `requiresTenantSubscription()`, and `resolveTenantUsing()`.
- [x] Runtime behavior: `bootUsing()`, `spa()`, `spaUrlExceptions()`, SPA prefetching, `unsavedChangesAlerts()`, `databaseTransactions()`, `middleware()`, `authMiddleware()`, `tenantMiddleware()`, and persistent middleware behavior.
- [x] Errors and extensibility: `errorNotifications()`, `registerErrorNotification()`, `hiddenErrorNotification()`, `disabledErrorNotification()`, `assets()`, `plugin()`, `plugins()`, and `renderHook()`.
- [x] A panel may omit login, registration, password reset, profile, or every built-in authentication page independently. A panel without a built-in login may use external authentication; guest access must be explicit and tested.
- [x] Every configuration family has immutable compilation tests, precise TypeScript inference tests, and identical observable Next, Nuxt, and SvelteKit acceptance behavior.

Evidence: revalidated on 2026-08-11 through immutable panel compilation and public type-inference suites, the exact 161-topic Filament 5 parity validator with no deferred rows, all package behavior suites, and the production Next, Nuxt, and SvelteKit browser matrix. Each example owns only its Filament-shaped panel provider and inferred resources; generated registries, framework routes, auth pages, tenancy handlers, and renderer wiring remain internal managed artifacts.

## 7. Fluent API and definition rules

### 7.1 Builder lifecycle

- A builder is mutable only while a definition module is evaluated.
- Every chain method returns `this` and preserves the concrete generic type.
- Registration calls compile builders to deeply frozen definitions.
- Runtime code receives only definitions.
- Definitions have `kind`, `type`, stable `id`, protocol version, common properties, type-specific properties, and server-only handles.
- Definitions must be serializable only through the library serializer; calling `JSON.stringify()` on a definition is not the security boundary.

### 7.2 Resolvable values

The conceptual type is:

```ts
type Resolvable<TValue, TContext> =
  | TValue
  | TranslationReference
  | ClientExpression<TValue>
  | ServerResolver<TValue, TContext>
  | ((context: TContext) => TValue | Promise<TValue>)
```

Rules:

- Omitted method: use the component default.
- `null`: suppress or clear the property only where the method documents `null` semantics.
- Literal: place a safe literal in the public manifest.
- Translation reference: resolve using the active locale without exposing server code.
- Client expression: execute immediately in the framework-neutral client engine.
- Raw callback: execute on the server by default.
- `serverResolver()` makes server execution explicit and may use auth, record, services, or database state.
- `clientResolver('registered-name')` references a browser-safe resolver registered through the client plugin registry.
- Arbitrary function source must never be serialized or evaluated with `eval`.
- Calls to `get()` record field dependencies. Server resolver patches are batched when a dependency changes.

Representative overloads:

```ts
label(value: string | null | TranslationReference): this
label(resolver: LabelResolver<TValues, TRecord, TActor>): this
visible(value?: boolean | VisibilityResolver<TContext>): this
disabled(value?: boolean | DisabledResolver<TContext>): this
```

### 7.3 Naming and IDs

- Panel IDs are explicit and globally unique within the application.
- Resource IDs default from model names but may be overridden.
- Component IDs are stable paths derived from their schema position and explicit key.
- Custom action, filter, widget, page, and plugin IDs are explicit.
- Generated permission keys use stable IDs, never localized labels.
- Changing a stable ID is treated as a migration and must not happen implicitly.

## 8. Shared schema and component architecture

Forms, infolists, action modals, filter forms, widget filters, and custom pages share a schema engine.

Universal schema component methods:

- `.key()`
- `.visible()`
- `.hidden()`
- `.columnSpan()`
- `.columnStart()`
- `.extraAttributes()`
- `.before()`
- `.after()`
- `.above()`
- `.below()`

Shared layouts:

- Grid.
- Section.
- Group.
- Fieldset.
- Tabs and Tab.
- Wizard and Step.
- Split.
- Callout.
- Empty state.
- Custom component.

Capabilities are composable internal modules, not one giant public base class. Examples include `HasLabel`, `HasPlaceholder`, `HasOptions`, `HasRelationship`, `CanSearch`, `CanSort`, `CanToggle`, `CanCopy`, `CanWrap`, `CanFormatState`, `CanOpenUrl`, `CanTriggerAction`, and `CanInlineEdit`.

Every capability owns:

- Its state definition.
- Fluent methods.
- normalization and invariant checks.
- public-manifest serialization.
- server resolution rules.
- renderer contract.
- behavior tests and type tests.

## 9. Forms and reactivity requirements

### 9.1 Form responsibilities

- Bind UI fields to an existing Holo form/validation schema.
- Infer field paths and values from the schema and model insert types.
- Hydrate Create defaults and Edit records.
- Track values, initial values, dirty, touched, errors, visible, disabled, read-only, and pending state.
- Dehydrate only allowed fields.
- Apply client conveniences without weakening server validation.
- Support create/edit/view/action/filter operations with precise contexts.

### 9.2 Common field methods

All form fields expose common label, helper text, hint, placeholder, default, visibility, disabled, read-only, required, dependency, debounce, layout, hydrate, dehydrate, and extra-attribute methods where the value type supports them.

Type-specific capabilities appear only on appropriate builders.

### 9.3 Initial form-field parity

Implement these field families:

- Text input, including email, URL, telephone, password, numeric, prefix, suffix, mask, autocomplete, length, datalist, and reveal behavior.
- Textarea.
- Checkbox.
- Toggle.
- Toggle buttons.
- Radio.
- Select and multiselect.
- Checkbox list.
- Date, time, and date-time picker.
- File and media upload.
- Hidden.
- Color picker.
- Key-value editor.
- Tags input.
- Slider.
- Markdown editor.
- Rich editor.
- Code editor.
- Repeater.
- Builder/block editor.
- Custom field.

### 9.4 Dependency graph

- Any resolver that reads `get('field')` records a dependency.
- `.dependsOn()` declares dependencies explicitly and is required for server callbacks whose dependencies cannot be observed through `get()`.
- Only affected nodes recompute.
- Dependency changes are batched.
- Cycles fail during development with a path describing the cycle.
- Async requests carry monotonically increasing request versions.
- Old requests are aborted where possible and ignored if they complete late.
- A field used as a dependency becomes reactive automatically.

### 9.5 Slug behavior

```ts
slug('slug')
  .from('title')
  .syncUntilTouched()
  .onCreate()
```

Default semantics:

- Generate locally while the source changes.
- Stop automatic changes after direct slug editing.
- Offer explicit regeneration.
- Do not alter an existing Edit value unless configured.
- Normalize or recompute on the server before persistence.
- Resolve uniqueness on the server and report validation errors on `slug`.

### 9.6 Dependent selects

```ts
select('country_id')
  .relationship('country', 'name')
  .searchable()

select('city_id')
  .relationship('city', 'name')
  .dependsOn('country_id')
  .optionsQuery(({ query, get }) => {
    return query.where('country_id', get('country_id'))
  })
  .searchable()
```

Required semantics:

- Disable the dependent field until required dependencies have values.
- Clear its value when dependencies change by default.
- Support `.preserveWhenDependencyChanges()` but revalidate preserved state.
- Support multiple dependencies.
- Search and paginate options on the server.
- Cache by panel, resource, field, dependencies, search, locale, tenant, and page.
- Cap page sizes and search input length.
- Authorize option access and apply tenant scopes.
- On submission, verify the selected value through the same constrained option query.
- Never accept a model, column, relation, or query directly from browser input.
- Hydrate Edit values only after their dependencies and authorized option labels are resolved.

## 10. Tables requirements

### 10.1 State and query behavior

- Server pagination, simple pagination, and cursor pagination where supported by the Holo query API.
- Per-page choices with safe maximums; `all` is opt-in and guarded.
- Global search, individual column search, configurable debounce, and URL persistence.
- Single and multi-column sorting.
- Filters, filter indicators, deferred/live filtering, and reset behavior.
- Column visibility, ordering, width, alignment, wrapping, and responsive layout.
- Row selection, select-all-current-page, and select-all-matching-query semantics.
- Record actions, header actions, toolbar actions, and bulk actions.
- Grouping and summaries.
- Empty and loading states.
- Relationship paths, counts, existence, and aggregates.
- Custom data sources through an explicit typed adapter.
- Every record resolution uses the authorized, tenant-scoped resource query.

### 10.2 Initial columns

- Text.
- Icon and boolean.
- Image.
- Color.
- Checkbox.
- Select inline editor.
- Toggle inline editor.
- Text input inline editor.
- Custom column.

Text formatting includes badge, date/time, relative time, number, money, Markdown, list, limit, words, line clamp, copy, icon, color, prefix, suffix, and tooltip capabilities.

### 10.3 Initial filters

- Boolean/custom filter.
- Select and relationship select filter.
- Ternary filter.
- Date range filter.
- Trashed filter.
- Custom schema filter.
- Advanced query builder with constrained, typed columns and operators.

### 10.4 Summaries and grouping

- Count, average, sum, range, min, max, and custom summaries.
- Page and whole-query summary modes.
- Group titles, descriptions, collapsibility, group sorting, and group summaries.
- Queries must avoid N+1 behavior and must use Holo aggregate primitives where available.

## 11. Infolists requirements

Infolists are read-only schemas used by View pages, action modals, widgets, and arbitrary pages.

Common entry methods include label, state, default, placeholder, visibility, inline label, tooltip, URL, action, layout, and extra content slots.

Initial entries:

- Text.
- Icon and boolean.
- Image.
- Color.
- Code.
- Key-value.
- Repeatable.
- Custom entry.

Entries support direct record fields, typed relation paths, JSON paths, computed state, translations, formatters, actions, and safe rich content. Raw untrusted HTML is never rendered without an explicit unsafe API and sanitizer policy.

## 12. Actions requirements

One action engine serves page, resource, table, infolist, notification, widget, and custom-component actions.

Common action capabilities:

- Label, icon, color, size, badge, tooltip, visibility, disabled state, and authorization.
- URL/navigation action or server execution action.
- Confirmation modal.
- Form/schema modal.
- Modal heading, description, content, footer content, width, slide-over mode, and nested modal actions.
- Success/failure notifications.
- Transaction boundary.
- Before/after hooks and input mutation.
- Rate limiting and idempotency key support for risky actions.
- Action groups.
- Bulk success/failure counts and individual record authorization.

Built-in actions:

- Create.
- Edit.
- View.
- Delete.
- Bulk delete.
- Restore.
- Bulk restore.
- Force delete.
- Bulk force delete.
- Replicate.
- Import.
- Export.
- Custom action.

Deleting, restoring, and force deleting must follow model soft-delete capabilities. Unsupported operations must not appear in the builder type or generated UI.

## 13. Resources and pages requirements

### 13.1 Resource composition

```ts
export default class PostResource extends Resource {
  protected static override model = Post
  static override recordTitleAttribute = this.attribute('title')
  static override navigationLabel = 'Posts'
  static override navigationIcon = 'document-text'

  static form = this.configureForm((schema, field) => schema.components([
    field.TextInput.make('title').required(),
  ]))

  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([
    TextEntry.make('title'),
  ]))

  static table = this.configureTable((table, component) => table
    .columns([
      component.TextColumn.make('title').searchable().sortable(),
    ])
    .recordActions([
      component.ViewAction.make(),
      component.EditAction.make(),
      component.DeleteAction.make(),
    ])
  )

  static getPages() {
    return {
      index: ListPosts.route('/'),
      create: CreatePost.route('/create'),
      view: ViewPost.route('/{record}'),
      edit: EditPost.route('/{record}/edit'),
    }
  }
}
```

The user-facing resource API follows Filament 5's class and package composition. `Schema`, `Action`, `Table`, `Notification`, form fields, infolist entries, resource pages, and relation managers are independent public package types. The same `Action` instance type can be mounted in pages, tables, notifications, schemas, and other action hosts. Relation managers configure the same `Table` and `Schema` classes as resources.

The protected static `model` property is the only model declaration on a resource. A relation manager declares only its protected static `relationship` property; its owner model and related record type come from the parent resource. Holo Panels generates resource and relation-manager registry augmentations under `.holo-js/generated/panels` during `holo prepare`, `holo build`, and the live `holo dev` watcher. Those bindings infer concrete fields, loaded relation paths, callback records, form values, action payloads, actor, tenant, and transfer fields. Each configuration callback receives one model-bound component object. Applications can keep the object intact, as in `field.TextInput.make('title')`, or destructure it, as in `({ TextInput }) => TextInput.make('title')`. User-facing resource code must not declare record aliases, pass generic arguments, annotate callbacks, or repeat migration columns to recover types. Bound fields, columns, entries, filters, actions, pages, and relation managers must provide autocomplete and reject invalid paths directly at their call sites.

Resources support:

- List, Create, Edit, View, and custom pages.
- Singular resources.
- Nested resources.
- Soft deletes.
- Record title and route key customization.
- Query modification and mandatory base scopes.
- Navigation metadata.
- Global search metadata.
- Resource sub-navigation.
- Page and widget registration.
- Lifecycle hooks around fill, validate, create, save, delete, and redirect.
- Explicit persistence replacement for domain-service workflows.
- Configured immutable variants so one resource can be registered more than once without mutation.

### 13.2 Pages

Pages support path, title, heading, subheading, breadcrumbs, navigation, authorization, header/footer actions, header/footer widgets, schemas, custom framework components, and layout slots.

Page routes are registered in deterministic order. Static routes outrank dynamic record routes. Route conflicts fail at prepare time.

## 14. Relation managers

Relation managers infer valid operations from Holo relation kinds:

| Relation kind | Default operations |
|---|---|
| belongs-to | select, associate, dissociate, create related record where allowed |
| has-one | view, create, edit, delete |
| has-many | list, view, create, edit, associate, dissociate, delete |
| belongs-to-many | list, attach, detach, create, edit related record, edit pivot fields |
| morph-one/morph-many | operations allowed by the concrete morph relation |
| morph-to-many/morphed-by-many | attach/detach/create/edit with morph and pivot integrity |
| through relations | read-only by default |

Required behavior:

- Owner record is present in every resolver and action context.
- Relation queries are owner-scoped before filters and record resolution.
- Relation manager visibility may be dynamic but is not an authorization boundary.
- Shared fields and columns may hide themselves for a relation manager context.
- Relation managers may render inline under Edit/View pages, in tabs, or as separate related-record pages.
- Pivot field validation and persistence are transactional.
- Attach and associate option queries are authorized and tenant-scoped.

## 15. Panel shell, navigation, and multiple panels

Panels support:

- Unique ID and path.
- Default panel.
- Guard and provider resolution through Holo Auth.
- Panel access callback/ability.
- Branding, logo, favicon, colors, typography, density, width, and dark mode.
- Sidebar or top navigation.
- Collapsible sidebar.
- Navigation groups, parent items, clusters, badges, and sorting.
- Breadcrumbs.
- User menu and panel switcher.
- Resource/page/widget/cluster discovery and explicit registration.
- Plugins, render slots, assets, middleware contributions, and SPA navigation mode where supported.
- Global search and keyboard shortcuts.
- Database notification placement.
- Tenant switcher.

Same-guard panels share the resolved Holo actor and session but perform independent panel-access, resource, page, widget, and permission checks. Different-guard panels resolve independent authenticated state through `auth.guard(panel.guard)` and may use different providers/models.

Every client cache key, API path, generated route, resource lookup, permission lookup, notification recipient, and tenant context includes the panel ID. A resource registered in two panels is represented by two immutable registrations rather than a mutated singleton.

## 16. Authorization and Holo Panels Shield

`@holo-js/panels-shield` provides a Filament Shield-like experience while composing with Holo Authorization.

### 16.1 Permission naming

Default permission keys:

```text
{namespace}.{resource}.{operation}
{namespace}.pages.{page}.{operation}
{namespace}.widgets.{widget}.view
```

The default namespace is the panel ID. Sharing permissions between panels requires setting the same namespace explicitly.

Standard resource operations include `viewAny`, `view`, `create`, `update`, `delete`, `deleteAny`, `restore`, `restoreAny`, `forceDelete`, `forceDeleteAny`, `replicate`, `reorder`, `import`, and `export`. Custom action permissions use their stable action ID.

### 16.2 Authorization order

Every operation must pass:

1. Panel access.
2. Tenant access when tenancy is enabled.
3. Shield role/permission evaluation when Shield is enabled.
4. Existing Holo class or record policy evaluation.
5. Operation-specific validation and invariant checks.

All required layers must allow the operation. UI visibility does not remove server checks.

A super-admin role bypasses Shield permission lookup by default but does not bypass panel access, tenant boundaries, or explicit domain policies. A full bypass requires a separate explicit unsafe option.

### 16.3 Storage and actor types

RBAC storage supports:

- Roles.
- Permissions.
- Role-permission assignments.
- Direct actor-permission assignments if enabled.
- Actor-role assignments.
- Multiple actor providers/models through an explicit actor type plus actor ID.
- Optional tenant/team scope.
- Unique indexes preventing duplicate assignments.
- Transactions for synchronization.

### 16.4 Shield commands

```bash
npx holo shield:setup
npx holo shield:diff
npx holo shield:sync
npx holo shield:make-role editor
npx holo shield:seed
```

`shield:diff` is non-mutating. `shield:sync` adds missing permissions. Removing stale permissions requires an explicit destructive flag and confirmation. Production command prohibition must be configurable.

Shield provides normal configurable Holo Panel resources for roles and permissions. Explicit user policies remain authoritative and are never overwritten silently.

## 17. Tenancy and authentication UI

Tenancy is independent of panels and guards.

- A panel declares a tenant model, tenant route key, membership resolver, access resolver, and query-scoping strategy.
- Tenant context is resolved and authorized for every panel request, including reactive option loads and action calls.
- Tenant-aware resource queries are scoped before listing, counts, global search, export, record resolution, and relation access.
- A cross-tenant guessed record ID returns 404.
- Shared/non-tenant resources must opt out explicitly.
- Tenant registration, profile, and switcher are optional page features.
- Tenant context participates in cache keys and queued job payloads.

Panel auth UI may provide login, logout, profile, password reset, email verification, and multi-factor pages by composing Holo Auth. Each panel uses its configured guard. Framework-native redirects remain in the matching framework adapter.

## 18. Widgets and dashboards

Widget families:

- Stats overview and individual stat definitions.
- Chart widget.
- Table widget.
- Custom component widget.

Widgets support heading, description, sort, column span, start column, lazy loading, polling, filters, authorization, cached server data, and custom error/empty states.

Dashboards are pages with a responsive widget grid. Multiple dashboards are supported. The first authorized dashboard by navigation order becomes the default landing page unless the panel specifies one.

Resource widgets may access the current record or the current table query state through typed contexts without receiving arbitrary client query objects.

## 19. Notifications and database notifications

Holo Panels consumes `@holo-js/notifications` storage and dispatch. It adds panel-specific presentation and client behavior.

Temporary panel toasts support title, body, status, icon, color, duration, persistent state, close control, and actions. Actions can mark a related database notification read/unread where applicable.

Database notification UI supports:

- Topbar or sidebar trigger.
- Unread badge.
- Paginated list.
- Mark one read/unread.
- Mark all read.
- Delete where authorized.
- Notification actions and URLs.
- Polling with configurable interval or disabled polling.
- Realtime invalidation using Holo Broadcast/Realtime/Flux.
- Panel/guard recipient isolation.
- Custom renderer by notification type.
- Safe plain text by default and explicit sanitized rich content.

The existing notification database payload remains generic. Holo Panels provides a versioned panel-presentation payload builder that returns data accepted by `NotificationDatabaseMessage`; it does not change the core notification storage schema merely for UI fields.

## 20. Global search

Global search spans authorized resources within the active panel.

- Resources opt in by specifying record title and searchable attributes.
- Typed relation paths are supported.
- Results include title, details, URL, image/icon, and optional actions.
- Results are grouped by resource and limited per resource.
- Queries are debounced, length-limited, tenant-scoped, panel-scoped, and authorized.
- Result URLs require an accessible View or Edit page.
- Search adapters may be extended by plugins.
- The browser never supplies arbitrary searchable columns.

## 21. Imports and exports

### 21.1 Imports

- CSV upload through Holo Storage.
- Header mapping UI.
- Typed import-column definitions.
- Required/optional mapping and examples.
- Per-row Holo validation.
- Relationship resolution.
- Create or update strategies.
- Chunked queued execution.
- Failure rows stored for authorized download.
- Progress and completion database notifications.
- Idempotency and duplicate handling.
- Configurable delimiter and header offset.
- Import policy and maximum row/file limits.

### 21.2 Exports

- Typed export-column definitions.
- Column selection UI.
- CSV and XLSX adapters.
- Relationship paths, aggregates, and computed state.
- Authorized, tenant-scoped source query.
- Selected-record and full-filtered-query modes.
- Chunked queued execution.
- Private storage by default.
- Signed, authorized, expiring download URLs.
- Progress and completion database notifications.
- File cleanup policy.
- CSV formula-injection mitigation enabled by default for untrusted text.
- Maximum rows and chunk size.

Import/export execution records use polymorphic actor identity so different panel guards/providers work correctly.

## 22. UI implementation strategy

Holo Panels owns the UI behavior and published packages.

- Use shadcn/ui, shadcn-vue, and shadcn-svelte as design and source references where licensing permits.
- Adapt implementations behind Holo renderer contracts.
- Do not expose shadcn component types in resource definitions.
- Do not require an application's own shadcn setup.
- Ship compiled semantic CSS and CSS custom properties from `@holo-js/panels-ui`.
- Keep colors, spacing, radius, typography, density, shadows, focus rings, and motion in design tokens.
- Use framework-appropriate accessible headless primitives behind internal adapters.
- Maintain functional parity across renderers through shared contract tests.
- Accept small framework-native implementation differences when observable behavior and accessibility remain equal.

Customization levels:

1. Panel theme tokens.
2. Component defaults/configuration callbacks.
3. Render slots/hooks.
4. Named custom component registration.
5. Per-type renderer replacement.
6. Full custom page.
7. `holo panels:publish-ui` copies framework source into the application and records that the application now owns it.

Published source is never overwritten automatically. A later sync command must show a diff and require confirmation.

## 23. Custom components and plugin extension

Custom type definitions must be possible without editing core.

A custom field package provides:

- Stable type ID.
- Fluent builder extending the appropriate base/capabilities.
- State type and codec.
- Manifest property schema.
- Optional server option/validation hooks.
- One or more framework renderers.
- Optional translations, icons, assets, tests, and generator templates.

Equivalent contracts exist for columns, entries, filters, actions, widgets, pages, and resources.

Renderer registries reject duplicate type IDs unless an explicit panel-scoped override API is used. Missing renderers fail during prepare/build, not after a user opens the page.

Reusable Holo Panels plugins may contribute:

- Resources.
- Pages.
- Widgets.
- Clusters/navigation.
- Fields, entries, columns, filters, summaries, and actions.
- Renderers.
- Translation catalogs.
- Icons and assets.
- Migrations.
- CLI commands.
- Permission subjects.

Panel plugins are fluent and immutable after panel compilation.

## 24. Discovery and generated artifacts

Holo Panels preparation generates under the application's existing `.holo-js/generated` root:

```text
.holo-js/generated/panels/
├── panels.ts
├── server-registry.ts
├── client-manifest.ts
├── client-components.ts
├── resources.ts
├── pages.ts
├── widgets.ts
├── clusters.ts
├── navigation.ts
├── permissions.ts
├── resource-type-bindings.d.ts
├── resource-type-checks.ts
├── types.d.ts
├── framework-artifacts.json
└── registry.json
```

Generated files start with the existing Holo generated-file header and are covered by generated ESLint validation.

Discovery rules:

- Supported definition files are TypeScript and JavaScript module variants supported by Holo discovery.
- Ignore declaration files, tests, coverage, build output, dot directories, and files without the matching definition marker.
- Default exports are preferred; named exports are supported only when uniquely marked.
- Sort by normalized project-relative path before import or output.
- Reject duplicate IDs, routes, permission keys, component keys, and default panels.
- Record source path and export name for diagnostics.
- Import server definitions lazily.
- Generate type augmentation for panel/resource/page/widget/plugin registries.
- Generate a client-safe manifest containing no functions or server-only data.
- Incremental prepare invalidates only definitions affected by changed files plus aggregate registries.
- Deleting or renaming a source removes stale generated entries.

## 25. Framework routing and transport

`holo panels:install` creates thin framework-native route shells and endpoint handlers. Managed files carry an ownership header. The installer refuses to overwrite an unmanaged file and prints the required manual integration.

Transport characteristics:

- One versioned internal endpoint namespace per framework under `/holo/panels/{panelId}`.
- Operations include bootstrap, page data, table data, form submit, options, resolver patches, action execute, notifications, global search, import, and export.
- Request schemas are strict and length/size limited.
- The server resolves panel/resource/component/action IDs from its generated registry.
- Client input never selects modules or source paths.
- CSRF applies to mutations.
- All responses use a versioned envelope and safe structured errors.
- Redirect effects are returned as typed effects and executed with native framework navigation.
- Cookie side effects remain in Holo auth/framework integration.
- Idempotency tokens protect retryable mutations.
- Abort signals propagate to option/search/read queries.
- Streaming may be added later without changing operation semantics.

Each framework adapter must preserve SSR, hydration, native error handling, native redirects, and browser history behavior.

## 26. Security requirements

Every implementation task must account for:

- Authentication at the selected panel guard.
- Panel access.
- Tenant access and query scope.
- Class or record policy.
- Shield permission when enabled.
- CSRF on mutations.
- Rate limits on auth, search, options, imports, exports, and sensitive custom actions.
- Strict request parsing and allow-listed fields.
- Mass-assignment safety.
- Output selection so hidden model attributes do not reach the browser.
- IDOR prevention through scoped record resolution.
- File upload MIME, extension, size, path, and storage validation.
- Private export storage and authorized downloads.
- XSS-safe text rendering and sanitization for explicit rich content.
- No `eval`, dynamic source evaluation, or serialization of raw callbacks.
- CSV formula-injection mitigation.
- Safe external URLs and rel attributes.
- Plugin type/asset path validation.
- Audit-friendly action context and error logging without secrets.

## 27. Performance requirements

- No runtime filesystem discovery.
- Lazy-load panel pages, resource definitions, widgets, and custom renderers.
- Avoid N+1 relationship loads through query planning.
- Paginate all unbounded data sources.
- Debounce search and server resolvers.
- Batch resolver patches.
- Cache static manifests by build version.
- Cache options only within correct panel/actor/tenant/locale scope.
- Abort or ignore stale requests.
- Virtualization is optional for the initial release but must be possible without changing table definitions.
- Polling defaults must be conservative; realtime invalidation should be preferred when configured.
- Import/export work is chunked and queued.

## 28. Commands and generators

All commands are contributed to the existing Holo CLI:

```text
holo panels:install
holo panels:uninstall
holo panels:prepare
holo panels:publish-ui
holo make:panel
holo make:resource
holo make:page
holo make:resource-page
holo make:relation-manager
holo make:form-field
holo make:infolist-entry
holo make:table-column
holo make:filter
holo make:action
holo make:widget
holo make:cluster
holo make:importer
holo make:exporter
holo shield:setup
holo shield:diff
holo shield:sync
holo shield:make-role
holo shield:seed
```

Generators must:

- Detect panel and framework.
- Use framework/project naming conventions.
- Generate fluent APIs.
- Generate readable source with no comments.
- Refuse ambiguous model or panel choices in non-interactive mode.
- Support `--force` only for explicit target files and show destructive scope.
- Support `--generate` from Holo model/schema metadata.
- Preserve user files and unrelated changes.
- Run preparation after successful generation.
- Be covered by fixture and published-package smoke tests.

## 29. Testing and quality gates

Each workspace package has unit tests, behavior tests, type tests, and package export tests as appropriate. Vitest invocations use `--reporter=json`.

Required layers:

- Builder behavior and invariant tests.
- Concrete type inference tests for fields, records, relations, paths, contexts, scopes, and custom components.
- Protocol round-trip and version tests.
- Server/client leakage tests.
- Discovery fixtures for add/change/delete/duplicate/invalid modules.
- State engine tests for dirty/touched/errors/dependencies/races/cancellation.
- Renderer contract tests for observable behavior and accessibility.
- Framework acceptance tests for Next, Nuxt, and SvelteKit.
- Authorization and tenant-boundary tests.
- Database notification read/unread/realtime tests.
- Import/export security and recovery tests.
- Plugin installation from packed artifacts.
- Public package smoke tests.
- Example-app user journeys.

After every executable code task, run the diagnostics, targeted typecheck, ESLint with `--fix` on changed files, and targeted behavior tests. At each phase gate, run full workspace typecheck, lint, package tests, architecture validation, packed-package smoke tests, and the affected example application typechecks.

Documentation-only changes validate wording, references, commands, and current APIs without running executable checks unless coupled to code.

## 30. Parallel execution rules

Agents may work in parallel only when the phase table permits it and their owned paths do not overlap.

Coordination rules:

1. One integration agent owns root `package.json`, lockfiles, shared tsconfig, ESLint config, workspace catalogs, root barrels, generated registry format, and release metadata.
2. Feature agents own complete domain directories rather than scattered shared files.
3. Renderer agents own exactly one framework renderer package.
4. Framework adapter agents own exactly one framework adapter package and its example app.
5. No two agents edit the same barrel file. Feature agents report required exports to the integration agent.
6. No agent changes a public API to simplify its subtask.
7. A task is complete only after its stated tests pass and its acceptance evidence is recorded.
8. A dependent phase cannot begin merely because code exists; the prerequisite phase gate must pass.
9. Integration happens at the end of each wave, followed by the full wave gate.
10. If a shared contract is insufficient, stop the affected lanes, propose the exact contract change, and update this plan after approval.

## 31. Phase dependency graph

```text
P0 Host capability and repository bootstrap
 └─ P1 Protocol, builders, registries, and testing foundation
     ├─ P2 Discovery compiler and Holo CLI integration
     ├─ P3 Shared schema and resolver engine
     ├─ P4 Client state and transport engine
     └─ P5 UI tokens and renderer foundations
         ├─ P6 Forms
         ├─ P7 Tables
         └─ P8 Infolists and actions
             └─ P9 Resources, pages, CRUD, and panel shell
                 ├─ P10 Relation managers
                 ├─ P11 Navigation, clusters, and global search
                 ├─ P12 Widgets and dashboards
                 └─ P13 Notifications and database notifications
                     ├─ P14 Shield, auth pages, and tenancy
                     ├─ P15 Imports and exports
                     └─ P16 Extended component parity and plugin ecosystem
                         └─ P17 Documentation, hardening, and release
```

P2, P3, P4, and P5 can run in parallel after P1. P6, P7, and most of P8 can run in parallel after their shared prerequisites. P10 through P13 can run in parallel after P9. P14 and P15 can run in parallel after their direct prerequisites. Framework renderer and adapter lanes run in parallel throughout phases that explicitly list them.

## 32. Phase P0: host capability and repository bootstrap

Objective: create the external Holo Panels workspace and add only the generic Holo plugin capability required for automatic preparation.

Prerequisites: none.

Parallel lanes: P0-A and P0-B may run in parallel in separate repositories. P0-C begins after both.

### P0-A: Holo-JS generic plugin preparation contribution

Owned paths: Holo-JS `packages/kernel`, `packages/cli`, `packages/core`, related tests, and plugin documentation.

Tasks:

- [x] Propose and obtain approval for the exact public `project.prepare` plugin contribution types.
- [x] Add the contribution types to `@holo-js/kernel` without importing feature packages into kernel.
- [x] Normalize and validate the contribution in `@holo-js/cli`.
- [x] Load preparation modules using the existing package-boundary and path-containment protections.
- [x] Invoke contributors from normal prepare, hot prepare, dev startup, build startup, and explicit `holo prepare`.
- [x] Define deterministic contributor order using plugin registration order and reject duplicate generated artifact ownership.
- [x] Pass changed paths for hot preparation and allow a contributor to request a full refresh.
- [x] Let contributors declare generated files under `.holo-js/generated/{plugin-id}` and managed framework artifacts under explicit app-relative paths.
- [x] Prevent absolute paths, `..` escapes, undeclared writes, and writes outside the project.
- [x] Add tests for missing modules, invalid exports, path escapes, contributor failure, deterministic ordering, hot updates, deleted files, and conflicting artifact claims.
- [x] Update Holo plugin documentation and published-package smoke fixtures.

Acceptance criteria:

- [x] A fixture plugin installed through `holo plugin:add` contributes a CLI command and generated prepare artifact.
- [x] `holo prepare`, `holo dev`, and `holo build` invoke the plugin contributor.
- [x] The contribution can be used by a non-panel fixture, proving the host API is generic.
- [x] Existing projects without such plugins produce byte-equivalent existing registries except for intentional metadata version changes.
- [x] Holo-JS mandatory diagnostics, typecheck, lint, tests, architecture validation, and smoke checks pass.

### P0-B: Holo Panels repository bootstrap

Owned paths: new Holo Panels repository root, workspace package skeletons, scripts, CI, and repository documentation.

Tasks:

- [x] Create the standalone repository and root workspace catalog.
- [x] Add every package directory listed in section 4 with minimal valid package manifests, tsconfigs, tsup configs, source entrypoints, and Vitest configs.
- [x] Set Holo packages as peer dependencies where the application must supply them and ordinary dependencies where Holo Panels owns them.
- [x] Add lockstep versioning and release scripts.
- [x] Add architecture validation covering dependency cycles, package boundaries, undeclared imports, public subpath exports, and renderer/framework mismatches.
- [x] Add packed-package smoke infrastructure that installs tarballs into temporary fixture apps.
- [x] Generate standalone Next, Nuxt, and SvelteKit fixtures with the supported `holo new` command in temporary empty directories, then import them through a deterministic workspace-adaptation step that preserves Holo-owned scaffold files and rewrites only package identity, dependency versions, scripts, and workspace links.
- [x] Add a parity test that compares each adapted example against fresh `holo new` output and fails when Holo-owned scaffold files or framework wiring drift.
- [x] Add an `AGENTS.md` containing the Holo-JS quality, typing, security, and validation principles needed by the external repository.
- [x] Add contribution and security-reporting documentation.

Acceptance criteria:

- [x] Every package builds and publishes a loadable empty entrypoint.
- [x] Architecture validation proves the intended package graph has no cycle.
- [x] Packed umbrella and adapter packages install into their matching empty fixture.
- [x] Root typecheck, lint, and empty tests pass.

### P0-C: umbrella plugin installation proof

Owned paths: Holo Panels `packages/panels`, `packages/cli`, fixture apps, and integration tests.

Tasks:

- [x] Add the `holo.plugin` package manifest entry to `@holo-js/panels`.
- [x] Export a Holo plugin definition contributing commands, runtime boot, migrations, and project preparation.
- [x] Add a minimal `holo panels:install` command.
- [x] Detect the Holo framework descriptor and package manager through supported Holo CLI context.
- [x] Install only the matching framework adapter package.
- [x] Add the umbrella package to application Holo plugin configuration without duplicating entries.
- [x] Make repeated installation idempotent.
- [x] Add an uninstall command that removes only managed artifacts and configuration owned by Holo Panels; it must not delete application resources or published UI.

Acceptance criteria:

- [x] Installing `@holo-js/panels` makes `holo panels:install` visible in the existing Holo CLI.
- [x] Next installs only Next/React dependencies, Nuxt only Nuxt/Vue dependencies, and SvelteKit only SvelteKit/Svelte dependencies.
- [x] A second install reports no changes.
- [x] Uninstall preserves user-authored panel/resource files and reports them.

- [x] **P0 phase gate:** complete P0-A, P0-B, and P0-C; run both repositories' full validation and a packed cross-repository integration fixture.

## 33. Phase P1: protocol, builders, registries, and testing foundation

Objective: establish stable contracts that all later lanes can extend without modifying central dispatch code.

Prerequisites: P0.

Parallel lanes: P1-A, P1-B, and P1-C may run in parallel after the integration agent creates the initial exports. P1-D integrates them.

### P1-A: versioned protocol

Owned paths: `packages/core/src/protocol` and protocol tests.

Tasks:

- [x] Define protocol version rules and compatibility errors.
- [x] Define JSON-safe primitive, array, and object value types without leaking `any` or unjustified `unknown` through public APIs.
- [x] Define discriminated node contracts for panels, pages, resources, schemas, layouts, fields, entries, tables, columns, filters, summaries, actions, widgets, navigation, notifications, imports, and exports.
- [x] Separate public node properties, server handles, and client registry references.
- [x] Define request/response envelopes and structured error categories.
- [x] Define typed effects for redirect, toast, close modal, refresh, invalidate table, download, and focus.
- [x] Define serialization that rejects functions, symbols, class instances, unsupported values, and unsafe URLs in public manifests.
- [x] Define source-location metadata for development errors without exposing local paths in production payloads.
- [x] Add property-based round-trip tests for supported values and rejection tests for unsupported values.

Acceptance criteria:

- [x] A protocol fixture serializes identically on repeated runs.
- [x] A fixture containing a callback or model instance cannot enter the client manifest.
- [x] Compatibility failure messages include expected and actual versions.

Evidence: `@holo-js/panels-core` typecheck, ESLint fix pass, 15 protocol tests with property-based values, core build, and architecture validation passed on 2026-07-27.

### P1-B: fluent builder foundation

Owned paths: `packages/core/src/builders` and builder tests.

Tasks:

- [x] Implement the construction-only builder base and definition writer.
- [x] Ensure chain methods return concrete `this` types.
- [x] Implement explicit `compile()`/internal finalization and deep freezing.
- [x] Implement stable key and ID assignment.
- [x] Implement capability composition without a god base class.
- [x] Implement invariant registration so each capability can validate its own state.
- [x] Reject using a finalized builder again if mutation would change a registered definition.
- [x] Add precise type tests proving subclass-specific methods remain available after common methods.
- [x] Add tests proving unrelated methods do not appear on incompatible component types.

Acceptance criteria:

- [x] A custom builder inherits common methods and retains its own methods after every chain call.
- [x] Definitions are immutable after compilation.
- [x] Invalid capability combinations fail before server startup.

Evidence: `@holo-js/panels-core` typecheck, ESLint fix pass, 6 builder behavior/type tests, core build, and architecture validation passed on 2026-07-27.

### P1-C: extension registries and test harness seed

Owned paths: `packages/core/src/plugins`, `packages/testing/src/contracts`, and related tests.

Tasks:

- [x] Define registries for schema components, fields, entries, columns, filters, summaries, actions, widgets, pages, and resource extensions.
- [x] Define stable type IDs and namespace rules.
- [x] Reject duplicate registrations except through explicit panel-scoped renderer overrides.
- [x] Define missing-renderer diagnostics.
- [x] Define plugin compatibility ranges against protocol and Holo Panels versions.
- [x] Seed testing helpers that assert definition kind, state round-trip, common capabilities, manifest safety, and renderer availability.

Acceptance criteria:

- [x] A fixture plugin adds a custom field and column without editing core registries.
- [x] Duplicate and incompatible registrations fail deterministically.
- [x] Test helpers expose precise custom state types.

Evidence: core and testing package typechecks, ESLint fix pass, 7 registry/compatibility tests, 3 testing-helper tests, both package builds, and architecture validation passed on 2026-07-27.

### P1-D: public exports and architecture integration

Owned paths: package barrels, manifests, root architecture tests, and umbrella re-exports.

Tasks:

- [x] Export approved contracts from `@holo-js/panels-core`.
- [x] Re-export application-facing builders from `@holo-js/panels`.
- [x] Keep internal writer/normalizer modules unexported.
- [x] Add public API extraction or declaration fixtures to detect accidental surface changes.
- [x] Add package-boundary rules for all later domains.

- [x] **P1 phase gate:** protocol, builder, registry, type, architecture, and packed export tests pass.

Evidence: frozen install; all 13 workspace typechecks and builds; full ESLint, Vitest, architecture, and three-framework example parity; declaration-surface fixtures; packed install/import/typecheck smoke tests; and packed P0-C lifecycle acceptance for Next, Nuxt, and SvelteKit passed on 2026-07-27.

## 34. Phase P2: discovery compiler and Holo CLI integration

Objective: make panels and their contents discoverable through normal Holo preparation and generation workflows.

Prerequisites: P1.

Parallel lanes: P2-A compiler, P2-B generators, and P2-C framework artifact planning may run in parallel after definition markers are stable.

### P2-A: discovery compiler

Owned paths: `packages/cli/src/discovery`, `packages/cli/src/generated`, fixtures, and tests.

Tasks:

- [x] Define markers/type guards for every discoverable definition.
- [x] Discover panel entry files from conventional roots and optional configured paths.
- [x] Resolve panel-relative resource/page/widget/cluster directories.
- [x] Discover nested resource pages, relation managers, and resource widgets.
- [x] Capture project-relative path, export name, stable ID, panel ID, and definition kind.
- [x] Generate lazy server imports and client-safe manifests.
- [x] Generate registry type augmentation and autocomplete metadata.
- [x] Validate duplicate IDs, routes, permissions, defaults, component keys, and navigation keys.
- [x] Implement incremental invalidation for add/change/delete/rename.
- [x] Produce actionable source-located errors.
- [x] Add fixtures for TypeScript/JavaScript extensions, default/named exports, ignored files, missing exports, duplicates, deletion, and deterministic sorting.

Acceptance criteria:

- [x] `holo prepare` generates the artifact tree in section 24.
- [x] Hot prepare updates only affected files and removes stale registry entries.
- [x] Production runtime can start with source directories absent and generated artifacts present.

Evidence: strict CLI and umbrella typechecks, ESLint fix pass, 17 discovery/loader tests, preparer integration tests, and CLI/umbrella builds passed on 2026-07-27.

### P2-B: generators

Owned paths: `packages/cli/src/commands`, `packages/cli/src/generators`, templates, and tests.

Tasks:

- [x] Implement `make:panel` with panel path, guard, and default-panel options.
- [x] Implement `make:resource` compact and split layouts.
- [x] Implement `--generate` using Holo model/table metadata.
- [x] Implement page, resource-page, relation-manager, widget, cluster, importer, exporter, custom field, entry, column, filter, and action generators.
- [x] Generate framework custom-renderer files only for the detected framework.
- [x] Validate names and exact target paths before writes.
- [x] Refuse overwrites unless `--force` names an exact file target.
- [x] Run preparation after writes and roll back only newly created files when generation itself fails.
- [x] Add snapshot/fixture tests for all three frameworks and compact/split resource modes.

Acceptance criteria:

- [x] Generated code follows single quotes, no semicolons, inline type imports, trailing commas, and no comments.
- [x] Generated resources typecheck with concrete model field and relation inference.
- [x] Re-running a generator without `--force` preserves existing files.

Evidence: strict CLI typecheck, ESLint fix pass, 22 generator behavior/snapshot/type tests, concrete model metadata fixtures, and the full 87-test CLI suite passed on 2026-07-27.

### P2-C: managed framework artifact planner

Owned paths: `packages/cli/src/framework`, adapter artifact contracts, and tests.

Tasks:

- [x] Define artifact templates for panel page catch-alls and internal operation endpoints in each framework.
- [x] Record checksums and ownership metadata.
- [x] Refuse to overwrite unmanaged files.
- [x] Update managed files only when the old checksum matches.
- [x] Print manual integration snippets when automatic placement conflicts.
- [x] Include every discovered panel path and reject cross-panel path overlap.

Evidence: strict CLI and umbrella typechecks, ESLint fix pass, managed-artifact preparer integration tests, and checksum/conflict behavior passed on 2026-07-27. Revalidated on 2026-08-11: Nuxt resolves `rootDir`, `srcDir`, `dir.pages`, and `serverDir`; Next selects the framework-supported root `app` or `src/app`; SvelteKit resolves `kit.files.routes` from the project configuration. Nuxt parent auth pages use `index.vue` whenever a managed descendant exists, preventing profile and nested MFA route conflicts. All frameworks reject paths outside the project where applicable. Panel configuration owns the managed login path and generates isolated login pages plus ordinary, auth, and tenant endpoints inside each resolved framework route root. Thirty planner behaviors, the directory-resolution behaviors, all three production builds and application typechecks, configured-login redirects, and all 60 production-browser journeys passed.

- [x] **P2 phase gate:** install a packed plugin into three fixture apps, generate one panel/resource each, run `holo prepare`, and typecheck the generated artifacts.

Evidence: packed Holo Panels and Holo-JS packages installed into fresh Next, Nuxt, and SvelteKit fixtures; each fixture installed its matching adapter, generated an Admin panel and Post resource from a real Holo model, ran repeated `holo prepare`, produced panel/resource registry entries, and passed strict generated-artifact typechecking on 2026-07-27. Full workspace typecheck, ESLint, Vitest, architecture and dependency validation, all package builds, packed package import/typecheck smoke tests, and example application parity also passed.

## 35. Phase P3: shared schema and resolver engine

Objective: build the reusable declarative UI foundation for forms, infolists, filters, modals, widgets, and pages.

Prerequisites: P1.

Parallel lanes: P3-A schema layouts, P3-B resolvers, and P3-C translations can run in parallel.

### P3-A: schemas and layouts

Owned paths: `packages/core/src/schemas` and schema tests.

Tasks:

- [x] Implement `defineSchema()` and schema compilation.
- [x] Implement grid, section, group, fieldset, tabs, wizard, split, callout, empty state, and custom components.
- [x] Implement responsive column counts, spans, starts, ordering, collapsing, and persistence where applicable.
- [x] Implement nested schema paths and stable component keys.
- [x] Implement before/after/above/below render slots as named component references, not raw HTML.
- [x] Add schema traversal and targeted node-patch helpers.
- [x] Add type and behavior tests for nesting, dynamic visibility, duplicate keys, responsive layout, and custom components.

Evidence: strict core typecheck, ESLint fix pass, and 8 schema behavior/type tests covering all layouts, nesting, visibility isolation, responsive properties, named slots, custom components, deterministic compilation, traversal, immutable patches, and invalid state passed on 2026-07-27.

### P3-B: resolvers and dependency tracking

Owned paths: `packages/core/src/resolvers` and tests.

Tasks:

- [x] Implement literal, null, translation, client expression, named client resolver, raw server callback, and explicit server resolver types.
- [x] Implement typed resolver contexts for form, entry, column, action, widget, page, panel, and notification domains.
- [x] Implement `get()` field access with concrete path-value inference.
- [x] Record dynamic dependencies during resolver evaluation.
- [x] Merge explicit and observed dependencies.
- [x] Produce batched server resolver patches.
- [x] Detect cycles and report the complete dependency path.
- [x] Ensure server resolver errors produce safe component errors without exposing stacks in production.
- [x] Add race, branch-dependency, cycle, async, and batching tests.

Evidence: strict core typecheck, ESLint fix pass, and 9 resolver tests covering precise path inference, branch-observed dependencies, explicit dependency merging, async batching, stale races, complete cycle paths, JSON boundaries, and stack-free safe errors passed on 2026-07-27.

### P3-C: translations

Owned paths: translation contracts in core, client locale contracts, default catalogs, and tests.

Tasks:

- [x] Implement `trans()` references with typed replacement values.
- [x] Define panel locale resolution and fallback order.
- [x] Support application and plugin catalogs with deterministic override priority.
- [x] Ensure stable IDs and permission keys never use translated text.
- [x] Add pluralization and RTL metadata required by renderers.
- [x] Add missing-key development diagnostics and production fallback behavior.

Evidence: strict core/client typechecks, ESLint fix pass, core declaration build, and 8 translation/locale tests covering typed replacements, deterministic catalog priority, requested/actor/panel/application fallback, English and Arabic pluralization, RTL metadata, stable-key rejection, and missing-key behavior passed on 2026-07-27.

- [x] **P3 phase gate:** render a framework-neutral schema fixture, change dependent values, apply local and server patches, switch locale, and verify deterministic definitions.

Evidence: the framework-neutral P3 client acceptance fixture compiled equal schema definitions repeatedly, preserved the original during local patching, observed dependency changes across versioned server batches, applied server visibility patches, switched locale with fallback metadata, and remained deterministic. Full workspace validation, all package builds, architecture/dependency checks, packed lifecycle and package smoke tests, and three-example parity passed on 2026-07-27.

## 36. Phase P4: client state and transport engine

Objective: implement framework-neutral state machines and secure communication contracts.

Prerequisites: P1. P4 consumes stable resolver contracts from P3 before its gate.

Parallel lanes: P4-A form/schema state, P4-B table state, and P4-C transport may run in parallel.

### P4-A: schema/form state engine

Owned paths: `packages/client/src/schema`, `packages/client/src/forms`, and tests.

Tasks:

- [x] #16 Holo-JS prerequisite: share the existing Holo Forms client state through its internal client entry point and support collection validation without item constraints. Implemented in Holo-JS commit `f8877ac093672514be59d2cf7fe4431352eaadfe`, covering `packages/forms` and `packages/validation`. Evidence on 2026-08-27: 148 Forms, Validation, and Nuxt form tests passed, typecheck and ESLint passed, and five changed files had zero language-server diagnostics. Standards and spec reviews found no unresolved issues.
- [x] #16 review corrections: preserve bound Holo validation hints for custom and choice fields, support collection validation without item constraints, and distinguish upload descriptors from native files. Existing suites now cover these cases and rich-text constraints. Both independent review axes report zero unresolved findings.
- [x] #16 integration: resource, action-modal, and relation forms use Holo state, validate on submit, revalidate invalid fields during correction, preserve field and form-wide errors, and use Panel notifications for other outcomes. Final evidence on 2026-08-27: 1,245 workspace tests, 15 browser checks across Next/Nuxt/SvelteKit, all package and example typechecks, diagnostics, lint, architecture checks, builds, and packed installation checks passed. Browser checks cover control geometry and focus, notifications, interrupted submissions, and resource/relation journeys. See [#16](https://github.com/cobraprojects/holo-panels/issues/16).

Publish the Forms and Validation changes from Holo-JS commit `f8877ac093672514be59d2cf7fe4431352eaadfe` before releasing the dependent Panels packages. Packed checks use that local host implementation, not a published registry release.

- [x] Track values, initial values, dirty paths, touched paths, errors, visibility, disabled, read-only, and pending state.
- [x] Apply atomic updates and batch dependency recomputation.
- [x] Implement reset, reset-field, set, get, validate-request, submit, and server-patch transitions.
- [x] Implement stale request cancellation/versioning.
- [x] Implement focus-first-error metadata.
- [x] Preserve framework-independent object identity rules so adapters can expose idiomatic reactivity.
- [x] Add behavior tests for nested values, arrays/repeaters, conditional fields, races, reset, and server errors.

Evidence: strict client typecheck, ESLint fix pass, declaration build, and 10 focused form/schema-state tests covering nested values, repeaters, atomic dependency batching, request races, reset behavior, server errors, focus metadata, and identity preservation passed on 2026-07-27.

### P4-B: table state engine

Owned paths: `packages/client/src/tables` and tests.

Tasks:

- [x] Track pagination, search, sort, filters, grouping, visible columns, selected record IDs, loading, errors, and query version.
- [x] Serialize state to canonical query parameters with panel/table namespaces.
- [x] Support deferred and live filters.
- [x] Define selection semantics for page and all-matching modes.
- [x] Apply data responses without allowing stale responses to replace new state.
- [x] Add tests for multiple tables on one page and back/forward history restoration.

Evidence: strict client typecheck, ESLint fix pass, declaration build, and 7 focused table-state tests covering canonical namespaced parameters, live/deferred filters, page/all-matching selection, stale responses, multiple tables, and history restoration passed on 2026-07-27.

### P4-C: transport

Owned paths: `packages/client/src/transport`, core server transport contracts, and tests.

Tasks:

- [x] Implement versioned request construction and response decoding.
- [x] Implement CSRF token integration through Holo Security client facilities.
- [x] Implement abort propagation, retry policy for safe reads, and idempotency keys for supported mutations.
- [x] Implement typed effects.
- [x] Implement normalized safe errors matching Holo framework adapter behavior.
- [x] Add fake transport and deterministic request recorder for tests.
- [x] Reject protocol version mismatch before applying state.

Evidence: strict core/client typechecks, ESLint fix pass, declaration builds, and 14 focused transport tests covering versioned codecs, CSRF integration, aborts, safe-read retry, mutation idempotency, typed effects, normalized errors, deterministic recording, and protocol mismatch rejection passed on 2026-07-27.

- [x] **P4 phase gate:** framework-neutral acceptance fixture performs schema bootstrap, reactive patch, table query, mutation, redirect effect, and error recovery.

Evidence: the framework-neutral P4 acceptance fixture completed schema bootstrap, a reactive form dependency patch, transport-backed table query, idempotent mutation, redirect effect, and retry-based error recovery. Full workspace validation, all package builds, architecture/dependency checks, packed lifecycle and package smoke tests, and three-example parity passed on 2026-07-27.

## 37. Phase P5: UI tokens and renderer foundations

Objective: establish an accessible Holo Panels visual system and equal renderer contracts.

Prerequisites: P1. The state binding portion requires P4.

Parallel lanes: P5-A UI system, P5-B React, P5-C Vue, and P5-D Svelte run in parallel with separate ownership.

### P5-A: UI system

Owned paths: `packages/ui`.

Tasks:

- [x] Audit shadcn family licenses and record attribution obligations.
- [x] Define semantic design tokens and default light/dark themes.
- [x] Implement framework-neutral icon names and icon registration contracts.
- [x] Compile the shared shadcn token theme and framework component utilities for the panel shell, forms, tables, overlays, navigation, notifications, and loading states.
- [x] Define accessibility behavior for focus traps, keyboard navigation, labels/descriptions, error association, live regions, dialogs, comboboxes, tabs, menus, and data tables.
- [x] Ensure consuming applications do not need Tailwind configuration.
- [x] Define canonical shadcn component states and screenshot/reference states.

Evidence: the UI package passed strict typecheck, ESLint fix, focused tests, declarations/CSS build, runtime import, and packed-artifact checks. Holo Panels owns an isolated Tailwind v4 build with an `hp` prefix, no preflight, and no application source scanning; consuming applications need no Tailwind or shadcn setup. `holo panels:theme:build` and the development watcher compile optional application panel styles into the generated Panels theme artifact. The source-owned React, Vue, and Svelte component boundaries compose Radix UI, Reka UI, and Bits UI primitives with Lucide icons. Stable `hp-*` classes remain available for user overrides.

### P5-B: React renderer foundation

Owned paths: `packages/react`.

- [x] Implement the React component registry.
- [x] Bind shared client stores to idiomatic React reactivity without changing semantics.
- [x] Check in and compose the canonical shadcn/ui React components used by the panel, including buttons, badges, avatars, inputs, dropdowns, dialogs, sheets, tabs, cards, tables, pagination, Sonner toasts, and error containment.
- [x] Implement named React component registration and panel-scoped overrides.
- [x] Import shared Holo Panels CSS through the documented React adapter entry.
- [x] Run the shared renderer contract tests against React.
- [x] Add React accessibility and hydration tests.

Evidence: strict React typecheck, ESLint fix, declarations/CSS build, and renderer tests cover registry scope/diagnostics, `useSyncExternalStore` bindings, canonical shadcn component slots, accessibility, keyboard behavior, error containment, SSR, and genuine `hydrateRoot` hydration.

### P5-C: Vue renderer foundation

Owned paths: `packages/vue`.

- [x] Implement the Vue component registry.
- [x] Bind shared client stores to idiomatic Vue reactivity without changing semantics.
- [x] Check in and compose the canonical shadcn-vue components used by the panel, including buttons, badges, avatars, inputs, dropdowns, dialogs, sheets, tabs, cards, tables, pagination, Vue Sonner toasts, and error containment.
- [x] Implement named Vue component registration and panel-scoped overrides.
- [x] Import shared Holo Panels CSS through the documented Vue adapter entry.
- [x] Run the shared renderer contract tests against Vue.
- [x] Add Vue accessibility and hydration tests.

Evidence: strict Vue typecheck, ESLint fix, declarations/CSS build, and renderer tests cover registry scope/diagnostics, effect-scoped shared-store reactivity, canonical shadcn-vue component slots, accessibility, keyboard behavior, error containment, SSR, and genuine hydration.

### P5-D: Svelte renderer foundation

Owned paths: `packages/svelte`.

- [x] Implement the Svelte component registry.
- [x] Bind shared client stores to idiomatic Svelte reactivity without changing semantics.
- [x] Check in and compose the canonical shadcn-svelte components used by the panel, including buttons, badges, avatars, inputs, dropdowns, dialogs, sheets, tabs, cards, tables, pagination, Svelte Sonner toasts, and error containment.
- [x] Implement named Svelte component registration and panel-scoped overrides.
- [x] Import shared Holo Panels CSS through the documented Svelte adapter entry.
- [x] Run the shared renderer contract tests against Svelte.
- [x] Add Svelte accessibility and hydration tests.

Evidence: Svelte check reports 0 errors and 0 warnings; ESLint, declarations/CSS builds, and renderer tests cover registry scope/source diagnostics, readable store semantics, canonical shadcn-svelte component slots, accessibility, keyboard behavior, Sheet rendering, independently compiled SSR, and genuine client hydration.

Acceptance criteria:

- [x] All three renderers pass the same observable contract suite.
- [x] Keyboard-only navigation works for the shell fixture.
- [x] SSR markup hydrates without mismatch.
- [x] Missing component registrations fail with source-located development diagnostics.

- [x] **P5 phase gate:** compare shell fixtures across all frameworks, run accessibility checks, and verify no renderer imports server packages.

Evidence: framework tests verify canonical shadcn `data-slot` output, keyboard interaction, focus restoration, source-located missing-registration failures, mismatch-free SSR hydration, isolated `hp:` Tailwind styling, generated authentication composition, and full admin behavior across React, Vue, and Svelte. The shared acceptance journeys cover tables, actions, notifications, relation managers, navigation, and widgets in all three production examples.

Ticket #8 remediation evidence on 2026-08-26: the built Next.js, Nuxt, and SvelteKit browser journey verified the official shadcn-family mobile Sheet in every renderer, stable Holo composition classes, identical 200 ms motion, trapped and restored focus, Escape dismissal, the reduced-motion override, and shared light and dark control geometry. Isolated theme tests cover application-source exclusion and registered extension compilation. Render-hook and UI-publishing suites cover the approved extension locations and conflict-safe optional source publishing.

## 38. Phase P6: forms

Objective: deliver production-capable form authoring, state, validation, relationships, uploads, and custom field extension.

Prerequisites: P3, P4-A, and P5.

Parallel lanes: P6-A field core, P6-B choice/dependent fields, P6-C rich/collection fields, P6-D uploads, and three renderer lanes may work in parallel after common Field contracts land.

### P6-A: field core and basic fields

Owned paths: core form base, text/textarea/checkbox/toggle/radio/date/hidden/slider/color fields and tests.

Tasks:

- [x] Implement common field capabilities and typed form paths.
- [x] Bind fields to existing Holo form schemas.
- [x] Derive required/client hints without replacing server validation.
- [x] Implement hydration, dehydration, defaults, visibility, disabled/read-only, errors, hints, and layout.
- [x] Implement slug as a reusable text-field specialization with local transform and server normalization hooks.
- [x] Add concrete inference tests for every field state.

Evidence: strict core typecheck, ESLint fix, declaration build, and 9 focused tests passed for public Holo form-schema binding, precise nested/optional/array/file paths, composable field capabilities, client hints, presentation/hydration/dehydration behavior, all basic fields, and slug local/server normalization on 2026-07-27.

### P6-B: selects and dependent options

Owned paths: select, multiselect, checkbox-list, toggle-buttons, option-source server code, client option cache, and tests.

Tasks:

- [x] Implement static, resolver, relationship, and custom option sources.
- [x] Implement search, pagination, preload, multiple selection, create option, edit option, and selected-label hydration.
- [x] Implement dependency invalidation and default clearing.
- [x] Implement `optionsQuery()` server execution and `constrainedBy()` shorthand.
- [x] Reuse constrained resolution on submission.
- [x] Add authorization, tenancy, maximum-size, stale-result, and malicious-ID tests.

Evidence: strict core/client typechecks, ESLint fix, declaration builds, and 12 focused tests passed for all option sources, scoped relationship queries, dependency clear/preserve semantics, cache dimensions, selected-label hydration, create/edit, submission revalidation, request limits, stale races, authorization, tenancy, and malicious IDs on 2026-07-27.

### P6-C: rich and collection fields

Owned paths: tags, key-value, code, Markdown, rich editor, repeater, builder, and tests.

Tasks:

- [x] Implement typed nested state and stable item keys.
- [x] Implement add/delete/clone/reorder/collapse for repeaters/builders.
- [x] Implement block schemas and per-block validation.
- [x] Implement safe rich text/Markdown serialization and sanitization boundaries.
- [x] Implement editor adapter contracts so applications may replace editors.
- [x] Add nested error, reorder, hydration, and XSS tests.

Evidence: strict core/client typechecks, ESLint fix, declaration builds, 7 core tests, and 5 client tests passed for tags, key-value, code, Markdown, rich editor, repeater/builder state, stable keys, structural operations, nested errors, block validation, explicit sanitization, XSS-safe serialization, hydration, and replaceable editor adapters on 2026-07-27.

### P6-D: files and media

Owned paths: upload field core/server/client, Holo Storage/Media integration, and tests.

Tasks:

- [x] Implement temporary upload handshake through framework endpoints.
- [x] Enforce extension, MIME, size, count, disk, directory, and authorization rules on the server.
- [x] Support image previews, reorder, remove, existing media hydration, conversions, and private preview URLs.
- [x] Clean abandoned temporary uploads through a documented policy/job.
- [x] Add path traversal, spoofed MIME, oversized payload, unauthorized delete, and concurrent upload tests.
- [x] #17 regression repair: restore immediate slug generation without overwriting manual edits, bind upload state to resource forms, reconcile finalized files with concurrent edits and resets, and cancel upload work and remove orphan toasts without disposing the active effect session.

Evidence: strict core/client typechecks, ESLint fix, declaration builds, and 10 focused tests passed for CSRF-gated endpoint handshakes, public Holo Storage/Media integration, upload field binding, previews/reorder/remove/existing hydration/conversion URLs, cleanup jobs, traversal, MIME spoofing, payload limits, unauthorized/cross-tenant deletion, and concurrent count enforcement on 2026-07-27.

#17 evidence on 2026-08-27: 1,261 workspace tests and six browser journeys passed across Next, Nuxt, and SvelteKit. The journeys cover create/edit slug behavior, upload validation, progress, cancellation, pointer and keyboard removal, replacement, repeat saves, and navigation during upload. All package and example typechecks, changed-file diagnostics, ESLint, architecture checks, builds, packed-package smoke tests, and packed installation checks passed. Standards and spec reviews have no unresolved findings. See [#17](https://github.com/cobraprojects/holo-panels/issues/17).

### P6-E: React field renderers

- [x] Implement React renderers for every P6 field using shared state, option, query, validation, and security logic.
- [x] Add React field behavior, accessibility, hydration, and custom-field contract tests.

Evidence: React renderers cover every P6 field family through shared FormStore, OptionStore, CollectionStore, EditorAdapterRegistry, UploadStore, and component-registry contracts. Strict typecheck, ESLint fix, 7 focused tests, all 22 React tests, SSR hydration checks, and the declaration/package build passed on 2026-07-27.

### P6-F: Vue field renderers

- [x] Implement Vue renderers for every P6 field using shared state, option, query, validation, and security logic.
- [x] Add Vue field behavior, accessibility, hydration, and custom-field contract tests.

Evidence: Vue renderers cover every P6 field family through the same shared stores and registry contracts, including dependent options, collections, editors, uploads, accessible state, custom fields, and deterministic hydration. Strict typecheck, ESLint fix, 8 focused tests, all 14 Vue tests, and the declaration/package build passed on 2026-07-27.

### P6-G: Svelte field renderers

- [x] Implement Svelte renderers for every P6 field using shared state, option, query, validation, and security logic.
- [x] Add Svelte field behavior, accessibility, hydration, and custom-field contract tests.

Evidence: Svelte renderers cover every P6 field family through the same shared store, registry, editor, and upload contracts, with accessible state and independently compiled SSR hydration. Svelte diagnostics reported 0 errors and 0 warnings; ESLint fix, 4 focused tests, all 12 Svelte tests, and the integrated declaration/package build passed on 2026-07-27.

- [x] **P6 phase gate:** the same Create/Edit form acceptance scenario runs in all three example apps, including slug generation, country/city dependent selects, nested repeater validation, and image upload.

Evidence: one shared staged Create/Edit journey rendered six real exported fields through the Next/React, Nuxt/Vue, and SvelteKit/Svelte example fixtures and observed generated slugs, dependent city loading and clearing, nested repeater error remapping, upload progress/previews/reorder/removal, accessible markup, and deterministic SSR. All example typechecks and the full workspace validation, builds, architecture checks, packed lifecycle, and package smoke suite passed on 2026-07-27.

#18 completion evidence on 2026-08-29: every parent-spec field and custom field uses the shared registries; responsive grid, flex, fieldset, section, tabs, wizard, callout, and empty-state layouts preserve nested state and breakpoint fallbacks; field actions retain the shared Action contract; and typed live, blur, and debounce updates drive dependent options, schemas, lifecycle hooks, and relationship fields without reprocessing server patches. The CI and release workflows enforce `NODE_OPTIONS=--max-old-space-size=8192`. With that heap setting, `bun run validate` passed strict diagnostics, ESLint, all 1,277 workspace tests, architecture and dependency validation, package builds, packed lifecycle checks, and independent consumer smoke tests; `bun run test:e2e` passed all 105 browser tests across Next, Nuxt, and SvelteKit. The final standards, security, and specification reviews reported no actionable findings. See [#18](https://github.com/cobraprojects/holo-panels/issues/18).

## 39. Phase P7: tables

Objective: deliver scalable typed tables with secure server queries and framework-equal interaction.

Prerequisites: P3, P4-B, and P5.

Parallel lanes: P7-A query/state, P7-B columns, P7-C filters, P7-D grouping/summaries, and renderer lanes.

### P7-A: table query execution

Owned paths: core table/query server modules and tests.

Tasks:

- [x] Compile table state to Holo query builder calls using allow-listed definitions.
- [x] Implement pagination modes, search, sort, filters, eager loads, selection query, and total counts.
- [x] Apply mandatory resource/tenant scopes before user state.
- [x] Plan relationship columns and aggregates without N+1 loads.
- [x] Resolve row actions against the same scoped query.
- [x] Add injection, invalid path, stale record, cross-tenant, and large-page tests.

Evidence: strict core typecheck, ESLint fix, declaration build, and 5 focused tests passed for public Holo query compatibility, mandatory scope order, all pagination/count modes, bound search, sort/filter/eager/aggregate planning, selection and row-action scoping, injection/invalid paths, stale/cross-tenant records, and size limits on 2026-07-27.

### P7-B: columns

Owned paths: column base/capabilities, built-in columns, and tests.

Tasks:

- [x] Implement common column methods and precise record paths.
- [x] Implement text, icon/boolean, image, color, checkbox, select, toggle, text-input, and custom columns.
- [x] Implement text formatters, relations, counts, existence, aggregates, tooltips, URLs, copy, and actions.
- [x] Implement secure inline edit through normal action/validation/authorization execution.
- [x] Add state/formatter/type tests for every column.

Evidence: strict core typecheck, ESLint fix, declaration build, and 10 focused tests passed for precise record/relation paths, every built-in/custom column, formatter and aggregate capabilities, callback-safe manifests, and allow-listed inline edits delegated through the action boundary on 2026-07-27.

### P7-C: filters

Owned paths: built-in filters, filter schema integration, query builder filter, and tests.

Tasks:

- [x] Implement boolean, select, relation, ternary, date range, trashed, and custom filters.
- [x] Implement filter indicators and remove-one/remove-all behavior.
- [x] Implement deferred/live modes and layouts.
- [x] Implement constrained advanced query-builder operators per supported column type.
- [x] Keep authorization/tenant scope outside removable filters.

Evidence: strict core typecheck, ESLint fix, declaration build, and 8 focused tests passed for every filter family, active indicators, reset/removal, live/deferred state, typed advanced operators, callback-free manifests, invalid input/injection rejection, and resource/tenant scope ordering outside user-removable filters on 2026-07-27.

### P7-D: grouping and summaries

Owned paths: grouping, summary definitions/execution, and tests.

Tasks:

- [x] Implement grouping state, titles, descriptions, collapsibility, ordering, and URL persistence.
- [x] Implement count, sum, average, min, max, range, and custom summaries.
- [x] Distinguish page and full-query summaries.
- [x] Add database-driver behavior tests where aggregate SQL differs.

Evidence: strict core typecheck, ESLint fix, declaration build, and 7 focused tests passed for typed/callback-safe grouping, canonical bounded URL state, page grouping without per-record queries, all summary kinds, separate page/full-query execution, Holo aggregate adapters, single-request grouped aggregates, and SQLite/MySQL/PostgreSQL normalization on 2026-07-27.

### P7-E: React table renderer

- [x] Implement the React table layout, responsive behavior, column manager, filters, selection, pagination, actions, groups, summaries, loading states, empty states, and keyboard behavior.
- [x] Add React table accessibility and shared renderer-contract tests.

Evidence: the React renderer exercises semantic responsive layout, shared TableStateStore state, live/deferred filters, visibility, pagination, both selection modes, compiled actions and inline edits, groups/summaries, state views, keyboard operation, sanitized errors, and deterministic SSR hydration. Strict typecheck, ESLint fix, 7 focused tests, all 22 React tests, and the declaration/package build passed on 2026-07-27.

### P7-F: Vue table renderer

- [x] Implement the Vue table layout, responsive behavior, column manager, filters, selection, pagination, actions, groups, summaries, loading states, empty states, and keyboard behavior.
- [x] Add Vue table accessibility and shared renderer-contract tests.

Evidence: the Vue renderer exercises the complete shared table state and interaction contract, both selection modes, allow-listed inline editing, responsive semantics, accessible keyboard behavior, sanitized state views, groups/summaries, and deterministic SSR hydration. Strict typecheck, ESLint fix, 7 focused tests, all 21 Vue tests, isolated declarations, and the integrated declaration/package build passed on 2026-07-27.

### P7-G: Svelte table renderer

- [x] Implement the Svelte table layout, responsive behavior, column manager, filters, selection, pagination, actions, groups, summaries, loading states, empty states, and keyboard behavior.
- [x] Add Svelte table accessibility and shared renderer-contract tests.

Evidence: the Svelte renderer exercises the complete shared table state and interaction contract, allow-listed inline editing, responsive semantics, accessible keyboard behavior, sanitized state views, groups/summaries, and independently compiled SSR hydration. Svelte diagnostics reported 0 errors and 0 warnings; ESLint fix, 7 focused tests, all 19 Svelte tests, isolated ESM, and integrated declaration/package builds passed on 2026-07-27.

- [x] **P7 phase gate:** identical table acceptance journeys pass for all frameworks with search, relationship filter, sort, pagination, column toggle, selection, bulk action, inline edit, group, and summary.

Ticket #14 follow-up validated on 2026-08-27 in commit `11d4f1a`: keyboard focus now reaches the actual shadcn scroll container in all three renderers, and Nuxt preserves generated select-filter options. Both defects were reproduced in the shared built-application journey before their fixes. The expanded journey proves deferred filters, column visibility, sorting, page size, delayed loading, empty results, and mobile keyboard scrolling together. All 1,223 package tests and 96 browser journeys passed, along with workspace and example typechecks, language-service and Vue/Svelte diagnostics, ESLint, architecture and dependency validation, all package and example builds, conditional exports, packed installation lifecycles, and independent packed consumers. ESLint used an 8 GB heap and excluded transient Playwright output. Desktop-light and mobile-dark table screenshots were inspected for each example. Standards review and Spec review each reported zero findings against `9746c70`.

Ticket #14 revalidated on 2026-08-27: all three renderers use compact, bordered shadcn tables with subdued headers, badges, row menus, and shared loading, empty, and error bodies. Nuxt applies its server-loaded records after initializing the query, so filtered pages start ready. Language-service diagnostics, Vue/Svelte diagnostics, workspace typecheck, ESLint, all 1,155 workspace tests, architecture and dependency checks, package builds, conditional exports, packed installation lifecycles for all three frameworks, and 21-package publish validation passed. The built examples passed all 90 browser journeys; six focused table and query-hydration checks also passed after the final toolbar styling change. Desktop-light and mobile-dark screenshots were inspected for each example. Full lint required an 8 GB Node heap; the configured lint rules were unchanged.

Evidence: one identical DOM-driven journey mounted the exported React, Vue, and Svelte table renderers through their example fixtures and observed search, deferred relationship filtering, sorting, pagination, column visibility, page/all-matching selection, bulk action payloads, allow-listed versioned inline edits, group collapse, group/table summaries, accessible semantics, and stable SSR. All example typechecks and the full workspace validation, builds, architecture checks, packed lifecycle, and package smoke suite passed on 2026-07-27.

## 40. Phase P8: infolists and actions

Objective: complete the shared read-only display and operation systems needed by resources and custom pages.

Prerequisites: P3, P4-C, and P5. P8-A and P8-B run in parallel.

### P8-A: infolists

Owned paths: core infolist/entries, client entry support, renderer entry directories, and tests partitioned by framework.

Tasks:

- [x] Implement entry base and common capabilities.
- [x] Implement text, icon/boolean, image, color, code, key-value, repeatable, and custom entries.
- [x] Support field, relation, JSON, computed, default, and placeholder state.
- [x] Implement safe formatting, copy, URL, tooltip, inline labels, and actions.
- [x] Add custom-entry generator and registry contract tests.

Evidence: typed core entry builders, callback-free manifests, client hydration/state and renderer registries, all built-in/custom renderers, safe formatting and URL/copy handling, generated `app:entry:<name>` entries, stale/nullable hydration protection, and compiler-to-renderer capability contracts passed focused and full core/client/CLI/React/Vue/Svelte suites on 2026-07-27.

### P8-B: actions

Owned paths: core/client action engine, built-ins except import/export, modal integration, and tests.

Tasks:

- [x] Implement action state/resolvers and typed contexts.
- [x] Implement page, record, bulk, notification, and nested modal action mounting.
- [x] Holo-JS prerequisite for ticket #12: support a validated notification ID filter through the existing recipient-scoped notification query and database store. Implemented in Holo-JS commit `24578d12`; six-file language-service diagnostics, both package typechecks/builds, ESLint, 52 notification tests, and 291 core tests passed. SQLite tests observe matching-ID lookup and denial for other recipients, tenants, and missing IDs. Application notification declarations do not change. Panels validation uses this local host build; distribution still requires a Holo release containing the commit.
- [x] Implement confirmation and schema modals.
- [x] Implement create, edit, view, delete, restore, force-delete, replicate, and custom actions.
- [x] Implement authorization, transactions, lifecycle, input mutation, idempotency, effects, and notifications.
- [x] Implement bulk individual authorization and partial-result reporting.
- [x] Ticket #15: persistent row, page, group, and query selections with exclusions and additions; server-enforced selection limits; secure bulk execution; deselection, chunking, identifier-only callbacks, and Panel notifications.

Ticket #15 API decisions: table selection supports `selectCurrentPageOnly()`, `selectGroupsOnly()`, and `maxSelectableRecords(n)`. Bulk actions support `deselectRecordsAfterCompletion()`, `chunkSelectedRecords(n)`, and `fetchSelectedRecords(false)`. Custom callbacks receive a selection once, or once per configured chunk. Identifier-only callbacks receive `selectedRecordIds`, an empty `selectedRecords` array, and a null `record`. Holo model policies remain authoritative; authorization lookups are bounded to 250 records per batch rather than retaining all selected models. These decisions do not introduce a new authorization or database service.

Ticket #15 evidence on 2026-08-27: all 21 package builds and typechecks, 33-file TypeScript language-service diagnostics, Svelte diagnostics, ESLint, 1,237 tests across 442 suites, architecture and dependency checks, declaration fixtures, conditional exports, and all three example builds and typechecks passed. All 99 production-browser journeys passed before review; the six affected selection and grouped-action journeys passed again on fresh builds after review fixes. Real SQLite/Holo policy tests exclude other tenants and view-denied IDs from query selections. Regression tests cover page-limit reinstatement, subclass fluent methods, row/bulk action ID collisions, and a 2,000-ID result remaining below 200 KB. Standards and Spec reviews against `9a99047` have no remaining findings. Initial implementation commit: `f70736c`; review corrections accompany this evidence.
- [x] Add double-submit, stale-record, denial, rollback, nested-modal, and partial-bulk tests.

Evidence: the shared action engine and client store passed authorization, tenant-scoped and request-bound idempotency, record/bulk cardinality, transactional lifecycle/effect/notification, stale, denial, rollback, nested-modal, double-submit, and partial-bulk behavior tests; callback-free size-bounded manifests and accessible React/Vue/Svelte action renderers passed strict checks and builds on 2026-07-27.

- [x] **P8 phase gate:** infolist/action contract fixtures and cross-framework modal/action acceptance pass.

Ticket #12 revalidated this gate on 2026-08-27. Presentation callbacks receive optional partial input, while authorization and execution retain complete submitted input. Generated page actions resolve presentation for the requesting actor and preserve static configuration. The user approved `TextEntry.make('status').action(publishAction)` and `defineStatsWidget('overview').actions([publishAction])`. Generated Next, Nuxt, and SvelteKit hosts now register and render these actions through the shared engine and client store. Custom list-header actions also render and dispatch with a page mount and no record IDs.

Registration preserves concrete callback inference at authoring and keeps executable definitions on the server. The internal heterogeneous registry adapts trusted application definitions to a common execution contract; it is not a decoder for client-supplied callbacks or contexts. Widget retries retain execution state by compiled widget, panel, provider, actor identity, and tenant identity. Actors or tenants without an identifiable model primary key or `id` retain object-identity cache behavior. Each request reauthorizes the widget and action, including cached replays. Generated widget and resource actions evaluate installed permission layers. Discovery distinguishes owned permission declarations from shared permission references, including resource-owned widgets; duplicate declarations still fail preparation.

Ticket #12's final integration resolves table presentation against authorized records, registers form action getters, runs navigation through the action engine, and applies configured relation actions through the shared renderer. Page, row, bulk, form, entry, widget, inbox, toast, and relation hosts share confirmation, schema input, nested dialogs, loading, error, completion, and disposal behavior. Explicit confirmation overrides remain effective. Omitted actions have no registered execution path; the legacy direct-delete bypass is removed.

`Notification.make().actions([PostResource.retry]).send()` remains one application call. Discovered resource-owned static actions acquire durable owner references automatically. Inbox actions reload current definitions, while executable toasts carry Holo Security-signed, expiring references bound to the actor, tenant, panel, and notification. Both paths reauthorize the action and its registered modal ancestors on every request, including cached retries. Request-only closures are not serialized or promised to survive a process restart.

Regression tests cover callback input and record contexts, default mutation permissions, ancestor denial, all-matching bulk selection with route-key exclusions, relation owner context, schema Select serialization, nested notification attachment, foreign and tampered toast references, replay deduplication, URL-effect failure, modal cancellation, and stale client requests. Generated Next, Nuxt, and SvelteKit hosts receive the same action manifests and component registries. Nuxt page watchers now stop with their owning scope so navigation cannot leave a stale page request active.

Final ticket #12 validation passed on 2026-08-27: language-service diagnostics for all 112 changed TypeScript files; zero-error, zero-warning Svelte checks; all package and example typechecks; full ESLint; all 1,218 workspace tests; architecture, dependency, declaration, generated API, conditional-export, publish-metadata, and example-parity checks; all 21 package builds; all three example builds; packed installation lifecycles and independent packed consumer checks. All 90 browser journeys passed, including generated CRUD, relation mutations, cross-tenant rejection, action failure feedback, SPA navigation, interrupted submissions, and authentication. The focused CRUD/relation journey also passed separately on all three frameworks. Standards and spec reviews have no remaining findings. This validation uses Holo-JS prerequisite `24578d12` locally; a published Holo release containing that commit is still required for distribution.

Evidence: one identical acceptance journey mounted the exported React, Vue, and Svelte entry/action renderers through the three example fixtures and observed built-in infolist parity, entry actions, confirmation and schema input, in-flight deduplication, active-only nested dialogs, Escape handling, denial alerts, successful record execution, deterministic SSR, and clean disposal. Full workspace typecheck, ESLint, JSON Vitest suites, architecture/example parity, all package builds, packed lifecycle, 13-package install/import smoke tests, and packed Next/Nuxt/SvelteKit consumer typechecks passed on 2026-07-27.

## 41. Phase P9: resources, pages, CRUD, framework adapters, and panel shell

Objective: assemble the first end-to-end useful Holo Panel.

Prerequisites: P2 through P8.

Parallel lanes: P9-A resources, P9-B pages/panel shell, and P9-C/D/E framework adapters may run in parallel after route/transport contracts freeze.

### P9-A: resources and CRUD execution

Owned paths: `packages/core/src/resources`, resource tests, and example Post resources.

Tasks:

- [x] Implement resource fluent builder and model inference.
- [x] Implement record title, slug, route key, navigation, global-search seed metadata, form, infolist, table, page, relation, and widget composition.
- [x] Implement authorized/scoped base resource query.
- [x] Implement default create/update/delete persistence using Holo models and transactions.
- [x] Implement lifecycle hooks and complete persistence replacement.
- [x] Implement soft-delete-aware behavior.
- [x] Implement immutable configured resource variants.
- [x] Treat absent Holo model policies as unrestricted resource access while preserving panel access, tenant scope, Shield checks when installed, and all explicit policy decisions. Revalidated on 2026-08-09 through no-policy resource execution, explicit-policy denial suites, and every generated resource route in all three production examples.
- [x] Add class/record policy, hidden attribute, mass assignment, and lifecycle rollback tests.

Evidence: the resource builder, typed Holo model inputs, tenant-scoped executor, trusted create bindings, lifecycle and persistence replacement, soft-delete capability manifest, configured variants, and three tenant-safe example Post resources passed strict core/umbrella/example typechecks, ESM and declaration builds, ESLint, and 11 JSON-reported resource behavior tests on 2026-07-27.

### P9-B: pages and panel shell

Owned paths: core pages/panels, client panel shell state, shared navigation seed, and tests.

Tasks:

- [x] Implement List, Create, Edit, View, custom, singular, and related-record page definitions.
- [x] Implement page data loaders, headers, breadcrumbs, actions, widgets, schemas, and custom component body.
- [x] Implement panel bootstrap, active route, branding, theme, sidebar/topbar, user menu, responsive state, and error pages. Revalidated on 2026-08-09: the generated Next, Nuxt, and SvelteKit shells render isolated panel themes, branding, icons, user menus, sidebar/topbar state, desktop collapse, mobile drawers, and safe unknown-route pages in production-browser acceptance.
- [x] Resolve fixed panel guard and panel-access policy on every operation.
- [x] Add same-guard and different-guard panel bootstrap tests.

Evidence: callback-free recursive page projection, safe route preparation, fail-closed actor presentation, fixed-guard panel runtime, normalized panel-relative navigation, and traversal-resistant shell state passed strict core/client typechecks, ESLint, ESM and declaration builds, 10 core page/panel tests, and 13 client shell tests with JSON reporting on 2026-07-27.

### P9-C: Next adapter

Owned paths: `packages/next`, `apps/example-next`, and tests.

Tasks:

- [x] Implement generated optional catch-all panel page shells and operation route handlers.
- [x] Implement server auth request accessors, CSRF, cookies, redirects, not-found, and error translation through Next primitives.
- [x] Implement React server/client boundaries and lazy resource rendering.
- [x] Add SSR, hydration, navigation, mutation, and multiple-panel acceptance tests.

Evidence: the Next adapter uses fixed generated registry IDs, raw request bounds before CSRF and envelope decoding, Holo auth/request services, native redirects/not-found/errors, a generic manifest-driven React resource renderer, real tenant-scoped Post read/write execution, and browser transport through the actual example route/runtime. Generated shells import the app-owned `server/panels/runtime.ts` `panelsRuntime` export, and their strict typecheck and server execution are covered by the 92-test CLI suite. Strict adapter/example/testing typechecks, ESLint, 9 JSON-reported adapter tests, the shared P9 gate, declarations/build, and packed consumer validation passed on 2026-07-27.

### P9-D: Nuxt adapter

Owned paths: `packages/nuxt`, `apps/example-nuxt`, and tests.

Tasks:

- [x] Implement generated optional catch-all panel pages and operation server routes.
- [x] Implement server auth request accessors, CSRF, cookies, redirects, not-found, and error translation through Nuxt and H3 primitives.
- [x] Implement Vue renderer integration and lazy resource rendering.
- [x] Add SSR, hydration, navigation, mutation, and multiple-panel acceptance tests.

Evidence: the Nuxt adapter uses fixed panel/runtime IDs, raw request bounds before CSRF and envelope decoding, Holo auth and H3 primitives, safe native error translation, and generic JSON-safe resource schemas with initial dependent options and List/View/Edit navigation. Generated shells import the app-owned `server/panels/runtime.ts` `panelsRuntime` export, and their strict typecheck and server execution are covered by the 92-test CLI suite. Strict adapter/example typechecks, ESLint, 8 JSON-reported adapter tests, direct Nuxt production build, the shared P9 gate, package build, and packed consumer validation passed on 2026-07-27.

### P9-E: SvelteKit adapter

Owned paths: `packages/sveltekit`, `apps/example-sveltekit`, and tests.

Tasks:

- [x] Implement generated optional catch-all panel pages, page loads/actions, endpoints, and hooks.
- [x] Implement server auth request accessors, CSRF, cookies, redirects, not-found, and error translation through SvelteKit primitives.
- [x] Implement Svelte renderer integration and lazy resource rendering.
- [x] Add SSR, hydration, navigation, mutation, and multiple-panel acceptance tests.

Evidence: the SvelteKit adapter uses fixed registry IDs, strict resource/action allow-lists, raw request bounds before CSRF and envelope decoding, Holo request/auth integration, native errors/redirects, and a generic JSON-safe Svelte resource renderer with schema-driven Create/View/Edit navigation. Generated page and endpoint shells import the app-owned `src/lib/server/panels/registry.ts` `panelsRegistry` export; the app hook supplies canonical Holo request context, while the operation endpoint owns CSRF enforcement. Generated shells pass strict typechecking and server execution in the 92-test CLI suite. Adapter and example Svelte diagnostics reported 0 errors/warnings; ESLint, 13 JSON-reported adapter tests, direct SvelteKit production build, the shared P9 gate, package build, and packed consumer validation passed on 2026-07-27.

- [x] **P9 phase gate:** each example app has a generated Admin panel with Post List/Create/View/Edit/Delete, optional policies, filters, slug reactivity, category/city dependent selects, and error handling. Revalidated on 2026-08-09 through the shared generated-app CRUD journey, exhaustive List/Create/View/Edit coverage for all eight example resources, 57 production-browser checks, and the complete workspace validation gate.

- [x] Ticket #19: `make:resource --simple` emits one `ManageRecords` page, generated Next.js, Nuxt, and SvelteKit resources typecheck, manage pages load the record table as page content, and create, view, edit, and delete use shared accessible modals without navigation. Completed 2026-08-29 in commits `aed5df2`, `4b32943`, `50a9904`, `7f62dea`, and `8dfbd0f`. Validation passed all 21 package builds and typechecks, ESLint, 1,280 workspace tests, 33 architecture tests, dependency, publish, conditional-export, example-parity, packed-package, and independent-consumer checks. The final targeted boundary suite passed 19 tests, and the built-application Playwright journey passed create/view/edit/delete modal success, validation failure, close/reopen, submission, navigation-state, and Panel-notification behavior in Next.js, Nuxt, and SvelteKit (3/3). Final Standards review reported zero hard violations and final Spec review reported zero missing requirements, extra scope, or ambiguities.

Evidence: the three conventional framework entrypoints load app-owned panel runtimes or registries and pass the shared real Post lifecycle acceptance suite, including tenant isolation, policies, validation, filters, slug reactivity, dependent category/city options, CRUD, navigation, and error handling. Frozen installation, full workspace typecheck, ESLint, JSON Vitest suites, architecture and dependency validation, example parity, all package builds, packed lifecycle, 13-package installation/import smoke tests, isolated Next/Nuxt/SvelteKit consumer typechecks, and public API declaration validation passed on 2026-07-27.

## 42. Phase P10: relation managers

Objective: manage every supported Holo relation with correct UI, typing, persistence, and authorization.

Prerequisites: P9.

Parallel lanes: relation groups may be divided into singular, one-to-many, many-to-many, morph, and renderer tasks after the base relation manager contract lands.

Tasks:

- [x] Implement relation-manager builder with typed owner and related records.
- [x] Map Holo relation metadata to allowed operations.
- [x] Implement belongs-to, has-one, has-many, belongs-to-many, morph, and through behavior from section 14.
- [x] Implement attach/associate option sources using P6 constrained selection.
- [x] Implement pivot fields and transactional updates.
- [x] Implement inline panels, tabs, grouped tabs, visibility, badges, and standalone related-record pages.
- [x] Implement nested authorization and tenant scope.
- [x] Generate relation managers from discovered model relations.
- [x] Add acceptance tests for create, attach, detach, associate, dissociate, pivot edit, denial, wrong owner, wrong tenant, and read-only through relations.

Evidence: the framework-neutral relation builder preserves owner, related-record, input, pivot, actor, tenant, query, and option-value types; derives safe defaults for every Holo relation kind; re-authorizes owner and related records; scopes owner before tenant and authorization; reuses constrained P6 option selection; and executes allow-listed record and pivot mutations transactionally. `make:resource --generate` now emits deterministic relation-manager definitions from injected or canonical Holo model metadata, including string and callback relation targets, in compact and split modes. Core and CLI typechecks, ESLint fix on all touched executable files, 8 focused relation tests, 22 focused generator tests, all 176 core tests, the complete CLI suite, package declaration builds, generated-resource typechecks, and public API fixture validation passed on 2026-07-27.

Revalidation on 2026-08-11: generated Post relation managers expose create/edit/view/delete, constrained associate/dissociate, attach/detach, and inferred numeric pivot editing in the real Next, Nuxt, and SvelteKit admin routes. The shared production-browser journey passed all positive and hostile route cases, including persisted pivot values, zero-mutation read-only View behavior, wrong-owner rejection, and wrong-tenant owner/related-record rejection. Lower-level relation-kind and read-only-through coverage passes in the focused core suite, and the complete workspace-wide gate is green.

Ticket #20 closure audit on 2026-08-29: relation managers use the shared table state and React, Vue, and Svelte renderers for search, filters, sorting, pagination, explicit and all-matching selection, row actions, and bulk actions. Server execution scopes every table query and bulk mutation by owner, tenant, authorization, and allow-listed relation metadata. The final gate passed 1,294 tests across 444 workspace suites, architecture and package validation, builds, packed-package and independent-consumer checks, and six built-application Playwright cases across Next.js, Nuxt, and SvelteKit covering the positive lifecycle, notifications, read-only viewing, wrong-owner rejection, and wrong-tenant owner and related-record rejection.

- [x] **P10 phase gate:** Post/Comments has-many and Post/Tags belongs-to-many journeys pass in all example apps; lower-level tests cover remaining relation kinds. Revalidated on 2026-08-09 through the production-browser relation lifecycle and hostile owner/tenant cases, focused relation-kind suites, and the complete workspace validation gate.

Evidence: one shared relation-manager presentation model validates deterministic IDs, safe local standalone URLs, unique columns and records, visibility, badges, inline sections, tabs, grouped tabs, and standalone related-record links. React, Vue, and Svelte render the same semantic tables, tab lists, tab panels, operation allow-lists, empty states, badges, and page navigation. The shared example journey renders Post/Comments has-many and Post/Tags belongs-to-many through Next, Nuxt, and SvelteKit with deterministic SSR, then executes create, associate, dissociate, attach, pivot edit, detach, denial, wrong-owner, wrong-tenant, and read-only-through behavior through the core relation executor. Focused client and phase-gate tests, all affected package and example typechecks, zero-warning Svelte diagnostics, ESLint, full workspace tests and builds, architecture/dependency/publish validation, example parity, packed lifecycle tests for all frameworks, 13-package packed installation/import smoke tests, and isolated consumer typechecks passed on 2026-07-27.

## 43. Phase P11: navigation, clusters, and global search

Objective: complete panel information architecture and authorized cross-resource discovery.

Prerequisites: P9.

Parallel lanes: navigation/clusters and global search can run in parallel.

### P11-A: navigation and clusters

- [x] Implement generated resource/page/dashboard navigation.
- [x] Implement groups, parents, clusters, badges, sorting, active state, collapsibility, and panel switcher. Revalidated on 2026-08-09 through the real generated-shell group, active-state, badge, hierarchy, collapse, and responsive journeys plus the shared React, Vue, and Svelte navigation renderer acceptance for clusters and panel switching.
- [x] Implement resource sub-navigation and configured resource/page variants.
- [x] Implement top navigation and sidebar modes. Revalidated on 2026-08-09: Next/React, Nuxt/Vue, and SvelteKit/Svelte render compiled topbar navigation without a sidebar, while production-browser acceptance covers the responsive collapsible sidebar and mobile drawer in all three generated apps.
- [x] Add collision, unauthorized-item, responsive, and keyboard tests.

### P11-B: global search

- [x] Implement resource opt-in, typed searchable attributes, result title/details/URL/icon/image/actions, limits, order, debounce, and keyboard shortcut.
- [x] Apply panel, guard, policy, and tenant boundaries.
- [x] Search relation paths without N+1 queries.
- [x] Add stale request, search-length, unauthorized resource, inaccessible result page, and multiple-panel isolation tests.

- [x] **P11 phase gate:** navigation and global search acceptance pass in all renderers and framework apps. Revalidated on 2026-08-09 through renderer acceptance, tenant-scoped generated-shell search, responsive navigation, and the complete workspace and production-browser gates.

Evidence: core navigation resolution deterministically compiles authorized resource, page, dashboard, configured variant, parent, group, cluster, badge, active-route, panel-switcher, sidebar, and topbar state while rejecting collisions, cycles, unknown hierarchy, cross-panel destinations, and denied ancestor chains. Global search preserves typed record and relation paths, scopes guard/panel/tenant/policy before lookup, batches relation loading, projects only allow-listed result fields/actions, bounds terms/results, rejects unsafe pages, and isolates panels. Reactive client stores cover responsive collapse, keyboard navigation, debouncing, cancellation, stale responses, and shortcuts. React, Vue, and Svelte render the same accessible navigation, panel switcher, combobox, listbox, result details, icons/images, and actions. The shared Next, Nuxt, and SvelteKit journey observed deterministic SSR, hierarchy/variant navigation, group and cluster collapse, keyboard routing, panel switching, and populated search results. Focused core/client/phase-gate tests, all affected package and example typechecks, zero-warning Svelte diagnostics, ESLint, full workspace tests and builds, architecture/dependency/publish validation, example parity, packed lifecycle tests for all frameworks, 13-package packed installation/import smoke tests, and isolated consumer typechecks passed on 2026-07-27.

Ticket #11 remediation evidence on 2026-08-26: the three framework shells place the tenant switcher above grouped sidebar navigation and account controls in the footer, retain an icon rail on desktop, use the shadcn Sheet on mobile, restore focus after dismissal, keep breadcrumbs and titles opposite page actions, and apply the panel content-width variable to the shared page container. Generated runtimes now remove unauthorized discovered pages and their descendants before serializing navigation. Shared SPA interception leaves fragments, downloads, modified clicks, new browsing contexts, and cross-origin destinations to the browser. Six production-browser checks passed across Next.js, Nuxt, and SvelteKit for responsive navigation and same-document routing. Full workspace typecheck, 21-package tests, architecture checks, dependency policy, parity, publish metadata, and example parity also passed.

Ticket #21 closure audit on 2026-08-30: panels expose fluent locale allow-list and default-locale configuration, and the shared resolver applies the request override, authenticated Holo actor locale, and panel fallback consistently. Bootstrap, page, authentication-presentation, and independent operation responses carry the resolved locale and direction. The Next.js, Nuxt, and SvelteKit auth journeys, shared shell chrome, global search, action confirmations and groups, notification inboxes, document metadata, logical sidebars, sheets, tables, and directional icons use the same typed English and Arabic catalogs and render in LTR and RTL. Missing application translations fall back to English without exposing translation keys. The final gate passed strict typechecking and builds for all 21 packages, ESLint with an expanded Node heap, 1,314 tests across 445 workspace suites, 33 architecture tests, dependency and publish validation, conditional-export isolation, three packed framework lifecycles, packed independent-consumer typechecks, public API validation, and a shared Arabic authentication and shell browser journey in all three frameworks.

## 44. Phase P12: widgets and dashboards

Objective: deliver discoverable, filterable, authorized dashboards and resource widgets.

Prerequisites: P9; table widgets require P7.

Parallel lanes: stats, charts, table/custom widgets, dashboards, and renderer tasks can run in parallel after the widget base lands.

Tasks:

- [x] Implement widget base with visibility, authorization, layout, lazy load, polling, and errors.
- [x] Implement stats widgets with value, description, trend, chart sparkline, icon, color, progress, and URL/action.
- [x] Implement chart data protocol and an accessible chart renderer abstraction.
- [x] Select a chart implementation per renderer behind the shared contract; document bundle and accessibility tradeoffs.
- [ ] Implement table widgets by composing the table engine. Ticket #23 found that generated applications do not bind the shared table renderer to table widgets. Browser revalidation is required.
- [x] Implement custom component widgets.
- [x] Implement widget filters and persisted filter state.
- [x] Implement multiple dashboards and default authorized dashboard selection.
- [x] Implement resource page header/footer widgets with record/table context. Revalidated on 2026-08-31: generated Next, Nuxt, and SvelteKit pages pass the active list query and authorized current record into resource-widget context in production-browser acceptance.
- [x] Add polling cancellation, unauthorized widget, filtered data, responsive grid, and cross-framework tests.

- [ ] **P12 phase gate:** stats, chart, table, and custom widgets render on dashboard and resource pages across all frameworks. Reopened for ticket #23 because generated application table widgets lack a renderer binding. The earlier dashboard-filter and resource-widget journeys did not cover this behavior.

Ticket #22 revalidation on 2026-08-31 corrected fresh widget loading, shared dashboard filters, Holo session persistence, stat progress, chart geometry, and renderer parity. Server tests cover authorization on refresh, protected filter fields and dependent callbacks, required defaults, hostile reset requests, tenant/session isolation, current-record/table context, and callback exclusion. Browser journeys observe filter apply/reset/session restoration, multiple dashboards, and resource context in all three frameworks. Standards and specification reviews passed. Validation passed with 1,332 workspace tests, 117 production-browser journeys, zero-error language-service diagnostics on 66 changed TypeScript files, full package and example typechecks, zero-warning Svelte diagnostics, ESLint, architecture/dependency/public API checks, 21 package builds, conditional exports, packed-package smoke and consumer typechecks, and packed lifecycle acceptance for Next, Nuxt, and SvelteKit. Browser server logs still contain an unrelated Vue Sonner SSR `requestAnimationFrame` error from unchanged notification code; all journeys pass.

Ticket #23 work on 2026-08-31 adds internal resource-table bindings, shared table state and renderers, page/widget authorization for table requests, and registered Custom widget extension lookup. The Table widget authoring API, generator output, example definitions, and new Table/Custom browser journeys remain incomplete pending application-facing API approval. The ticket and P12 gate remain open. Existing dashboard-filter and resource-context journeys pass in all three built applications, but do not establish Table/Custom widget acceptance.

Historical evidence: widget and dashboard builders now compile immutable client manifests, retain authorization, visibility, data, and dashboard access callbacks exclusively on the server, and participate in deterministic prepare-time discovery. The client store provides allow-listed persisted filters, lazy activation, stale-request cancellation, polling lifecycle cancellation, safe error state, and responsive grid placement. React, Vue, and Svelte render stats, dependency-free line, area, bar, and pie SVG charts with accessible data tables, composed table widgets, registry-backed custom widgets, loading/error/unauthorized states, sorted responsive dashboards, and resource header/footer placements. The chart implementation and accessibility/bundle tradeoff is recorded in `packages/ui/WIDGET_CHARTS.md`. Focused core, client, umbrella, and renderer suites, a shared Next/Nuxt/SvelteKit phase-gate journey, all workspace typechecks and zero-warning Svelte diagnostics, ESLint, all workspace tests, public API declaration validation, architecture/dependency/publish validation, example parity, all package builds, 13-package packed installation/import smoke tests, isolated consumer typechecks, and packed lifecycle acceptance for all three frameworks passed on 2026-07-27.

## 45. Phase P13: notifications and database notifications

Objective: add consistent panel feedback and persistent notification inboxes using Holo Notifications.

Prerequisites: P9; realtime mode requires configured Holo Broadcast/Realtime/Flux.

Parallel lanes: temporary toasts and database notification UI/runtime may run in parallel.

### P13-A: temporary notifications

- [x] Implement fluent panel notification presentation builder.
- [x] Implement status, title, body, icon, color, duration, persistent, close, and actions. Ticket #13 revalidated the shared actions from #12 on 2026-08-27. Notification and icon colors now affect all three renderers, and `Notification.iconColor()` survives toast and database delivery. Component and built-browser tests observe the rendered colors.
- [x] Integrate action success/failure notifications and session/response effects.
- [x] Implement client-originated safe notifications with no trusted server action execution.
- [x] Add accessibility live-region, queue, duplicate, persistent, and action tests.

### P13-B: database notifications

- [x] Define the versioned presentation payload embedded in existing Holo database notification data.
- [x] Implement panel recipient resolution from guard/provider actor.
- [x] Implement paginated list, unread count, mark read/unread/all, delete, actions, placement, and custom type renderers.
- [x] Implement polling and disable polling.
- [x] Implement realtime invalidation using existing notification broadcast and Flux facilities.
- [x] Apply panel/guard/tenant isolation and authorization to every operation.
- [x] Add multiple-guard, stale unread count, reconnect, poll/realtime duplication, denial, and custom-renderer tests.

Evidence: the immutable presentation builder, versioned Holo-compatible payload, safe client toast queue, panel-shell configuration, action success/failure effects, one-time guard-scoped redirect toast handoff, polling lifecycle, simultaneous polling/realtime invalidation, React/Vue/Svelte renderers and placement triggers, namespaced custom notification renderers, framework-neutral umbrella exports, production Holo store and Flux adapters, and security/behavior suites pass. The approved server-only `databaseNotificationInbox(...)` API resolves recipient, tenant, and realtime identity exclusively from authenticated scope and authorizes every operation; callbacks remain outside serialized manifests, hostile client scope fields are ignored, mutations fail atomically for foreign IDs, and realtime channels are withheld unless list access is authorized. Next, Nuxt, and SvelteKit register the same production notification executor on their fixed operation routes, and the example applications include Holo Notifications configuration and database migrations. Layered acceptance uses the adjacent Holo-JS production SQLite store without an injected Panels store, verifies admin/vendor and tenant isolation plus read/unread/delete and poll-style refresh, exercises each framework HTTP route, and separately verifies queued delivery, polling/realtime coexistence, invalidation coalescing, reconnect behavior, navigation, and duplicate prevention. Adjacent Holo-JS changes provide validated paginated notification queries, atomic scoped mutations, portable JSON-null matching, atomic file/database/Redis session flash/take, and request-scoped auth guard flash/take. Full Holo-JS validation for the affected host work and the complete Holo Panels `bun run validate` gate passed locally on 2026-07-28, including zero-warning framework typechecks, ESLint, all package tests, architecture/dependency/publish checks, example parity, all builds, packed lifecycle acceptance across all three frameworks, 13-package packed install/import smoke tests, isolated consumer checks, and packed fixture typechecks.

- [x] **P13 phase gate:** a queued database notification appears through polling and realtime, can be acted on/read/deleted, and remains isolated between admin and vendor guards. Revalidated for #13 on 2026-08-27, using the shared Action engine completed in #12.

Ticket #13 evidence: `packages/testing/tests/p13-holo-notification-runtime.test.ts` observes queued Holo delivery, polling/realtime coexistence, deduplication, read/unread/delete, and recipient/guard/tenant isolation through the real runtime. `packages/panels/tests/notification-actions.test.ts` verifies signed nested toast actions after a JSON roundtrip, parent authorization revocation, confirmation, duplicate submission prevention, and dismissal. React, Vue, and Svelte component tests distinguish loading, failed, and empty inbox states and observe notification/icon colors. Built-browser tests in `tests/e2e/admin-journeys.spec.ts` verify sanitized failures, keyboard opening and focus restoration, visible icons, custom/status colors, and RTL borders across Next, Nuxt, and SvelteKit. Implementation commits are `1e3f705` and `15b3a02`.

Final ticket #13 validation passed on 2026-08-27: language-service diagnostics for all 14 changed TypeScript files; zero-error, zero-warning Svelte checks; all package and example typechecks; full ESLint; all 1,223 workspace tests; 33 tooling tests; architecture, dependency, declaration, generated API, conditional-export, publish-metadata, and example-parity checks. All 21 package builds, all three example builds, and all 96 browser tests passed. Packed installation lifecycles passed for all three frameworks, along with installation/import checks for all 21 packages, independent consumer typechecks, and third-party plugin checks. The validation components ran separately; full ESLint required an 8 GB Node heap. Standards and spec reviews have no remaining findings. Validation uses Holo-JS prerequisite `24578d12` locally; distribution still requires a published Holo release containing that commit.

## 46. Phase P14: Shield, auth pages, multi-factor authentication, and tenancy

Objective: provide easy permission administration and secure multi-panel/tenant identity features.

Prerequisites: P9, P10 for relation-aware role UI, P11 for navigation, and P13 for auth/security notifications where needed.

Parallel lanes: P14-A Shield storage/evaluator, P14-B Shield UI/commands, P14-C auth pages/MFA, and P14-D tenancy may run in parallel after shared actor identity types land.

### P14-A: Shield storage and evaluation

- [x] Define migrations/models for roles, permissions, assignments, actor types, and optional tenant scope.
- [x] Implement permission-key generation from prepared panel manifests.
- [x] Implement role, direct permission, wildcard policy if approved, and super-admin evaluation.
- [x] Compose checks in the exact order from section 16.
- [x] Add cache invalidation after assignment changes.
- [x] Add multiple actor model, same actor/different panel namespace, tenant scope, explicit policy, and super-admin-boundary tests.

Evidence: Shield now provides Holo database migrations/models and transactional in-memory/database repositories for roles, permissions, role/direct assignments, actor types, and optional tenant scope. Deterministic prepared-definition permission generation, opt-in direct grants, role grants, Shield-only super-admin evaluation, ordered panel/tenant/Shield/policy/invariant composition, and post-commit cache invalidation are covered by the 24-test Shield suite. Strict Shield typecheck, ESLint, and the complete Shield JSON-reported suite passed on 2026-07-29.

### P14-B: Shield commands and resources

- [x] Activate installed plugin migration publishers through Holo-JS's existing migration registry and lifecycle. Evidence: adjacent Holo-JS CLI integration validates contribution paths and definitions, rejects duplicate names before connecting, and passes real plugin migration execution/rollback plus affected CLI/Core builds and typechecks on 2026-07-29.
- [x] Implement setup, diff, sync, role, and seed commands.
- [x] Implement safe stale-permission reporting/removal.
- [x] Implement Role and Permission resources as configurable normal resources. Evidence: inference-first factories accept a compiled panel and infer actor/tenant callback types, return standard configurable Resource builders, server-bind role tenant/ID fields, scope role queries by authenticated tenant, invalidate repository assignments on save/delete, and expose permissions through the new server-enforced read-only resource capability. Shield resource, referential-integrity, strict typecheck, and build validation passed on 2026-07-29.
- [x] Implement page/widget/custom action permission discovery.
- [x] Add production command prohibition.
- [x] Add packed CLI integration and UI acceptance tests.

Evidence: Shield's five installed Holo commands now use the approved application-command runtime, execute only the named Shield migration, consume the validated prepared registry, report deterministic missing/stale/unchanged keys, require both stale-removal flags, seed only validated application configuration, and reject production mutations unless explicitly enabled. Prepared action/page/resource/widget permission extraction, immutable inference-preserving configuration, command operation, runtime-boundary, production, and distribution suites passed with strict Shield typecheck and build on 2026-07-29. The packed lifecycle installed Shield in clean Next, Nuxt, and SvelteKit fixtures, ran setup, observed generated default permissions through diff, synchronized them, and observed an empty post-sync diff; configurable Role and Permission resources rendered as standard tables through React, Vue, and Svelte.

### P14-C: auth pages and MFA

- [x] Provide the approved Holo Auth session-guard MFA capabilities required by Panels. Evidence: adjacent Holo-JS Auth implementation and focused Auth/Security host validation passed as part of 313/313 affected host tests on 2026-07-29. Panels now contributes the Holo security dependency, and the Holo plugin installer automatically applies its canonical idempotent security scaffold with rollback protection, so panel MFA has no separate manual security setup step.
- [x] Compose panel login/logout/profile/password reset/email verification with Holo Auth.
- [x] Add panel-access denial behavior after authentication.
- [x] Implement MFA enrollment, challenge, recovery codes, and disable flows only through Holo Auth capabilities; if Holo Auth lacks required primitives, propose them separately before editing Holo-JS.
- [x] Use native redirects and secure cookie effects through framework adapters. Evidence: fixed Next, Nuxt, and SvelteKit auth handlers execute the framework-neutral allow-listed dispatcher inside native request contexts, apply CSRF and byte ceilings, preserve Holo Set-Cookie values and attributes, return compiled panel-local 303 redirects, and passed 14 focused core/adapter auth and tenancy tests plus all affected adapter typechecks and builds on 2026-07-29.
- [x] Add same-guard SSO, different-guard isolation, session fixation, logout-one-guard, MFA recovery, and authorization tests. Evidence: the guard-isolation suite verifies same-guard session reuse, different-guard separation, one-guard logout, pending-to-authenticated cookie revision, secure cookie propagation, MFA recovery, and post-authentication panel denial without clearing another guard; it passes with the controller suite and adjacent Holo Auth session-rotation validation on 2026-07-29.

Evidence: the approved server-only panel auth compiler and controller bind the panel guard and password broker, delegate login/logout/profile refresh/password reset/email verification and every MFA operation to Holo Auth, reject profile mass assignment, defer panel access until MFA completes, and log out only the selected guard after post-authentication denial. The compilation/controller and guard-isolation suites cover same-guard SSO, different-guard isolation, logout-one-guard behavior, rotated secure-cookie outcomes, MFA recovery, and post-authentication denial. Native Next, Nuxt, and SvelteKit handlers dispatch only compiled allow-listed operations, enforce request-method, CSRF, and payload boundaries, preserve secure Holo cookies, and use panel-local redirects; the combined P14 Core and Shield gate suite passed 71/71 on 2026-07-29.

### P14-D: tenancy

- [x] Implement tenant definition, membership list, access check, route key, switcher, registration/profile pages, and active tenant persistence.
- [x] Apply automatic resource scoping and explicit opt-out.
- [x] Propagate tenant identity into options, actions, global search, notifications, jobs, imports, exports, and caches.
- [x] Add guessed-ID, switched-tenant stale cache, queued-job tenant, shared resource, and membership revocation tests.

Evidence: compiled tenancy now derives a trusted execution context from the active or queued tenant while preserving the concrete actor, tenant, identifier, and extension types without caller-declared generics. The context automatically scopes unshared resource queries, server-binds tenant ownership during create, supplies a panel/guard/type/tenant cache dimension, and can be bound to action, search, import, export, and service contexts without widening inferred values. `.shared()` remains the explicit resource opt-out, missing tenant execution scope fails closed, notification scope derives from the trusted context, and option operations reject stale or substituted tenant cache identities. The framework-neutral panel shell validates tenant bootstrap, switches only an allow-listed membership through a fixed transport, and rotates its cache identity after a switch; React, Vue, and Svelte export native switcher controls. Registration and profile validators infer their values, publish fixed panel-local page paths without serializing callbacks, re-authorize membership after mutations, and dispatch through native Next, Nuxt, and SvelteKit GET/POST boundaries. Tenant records infer from the configured model prototype, so new public acceptance configurations use no generic arguments or callback annotations. Core/client/native tenancy acceptance passed 41/41, and the real option, action, global-search, database-notification, queued-tenant, import, export, and cache suites passed 45/45 on 2026-07-29.

- [x] **P14 phase gate:** role permissions can be managed in the panel; same/different guard scenarios pass; tenant isolation tests pass across CRUD, relations, search, notifications, and background work. Evidence: Role and Permission resources render through React, Vue, and Svelte; the packed Shield command lifecycle passes in clean Next, Nuxt, and SvelteKit fixtures; same/different-guard auth, MFA, and panel-access scenarios pass; and actual tenant-aware engines cover CRUD, options, actions, global search, notifications, queued work, imports, exports, and cache rotation. The P14 gate suites passed 71/71, 45/45, and 47/47, Shield passed 35/35, all package builds and the final workspace typecheck passed on 2026-07-29. Public panel/auth/tenancy usage derives actor, tenant, services, profile values, and allow-listed update fields from runtime sources without generic arguments or callback annotations.

## 47. Phase P15: imports and exports

Objective: implement safe queued bulk data transfer integrated with tables, actions, storage, queues, and notifications.

Prerequisites: P7, P8-B, P9, P13, and Holo Queue/Storage configuration.

Parallel lanes: import and export can run in parallel after shared operation-record and actor identity contracts land.

### P15-A: imports

- [x] Add fresh queued actor resolution to Holo Auth. Evidence: adjacent Holo-JS `AuthBaseGuardFacade.findUserById()` delegates through the configured provider and passed affected Auth builds, typechecks, lint, and focused tests on 2026-07-29.
- [x] Implement importer/column builders and generator.
- [x] Implement CSV parsing with delimiter/header offset and strict limits.
- [x] Implement column mapping form and required mapping rules.
- [x] Implement per-row validation, relationship resolution, create/update hooks, transactions, and idempotency.
- [x] Implement queued chunks, retries, progress, cancellation policy, failure-row storage, and completion notification. Evidence: revisioned queue envelopes, atomic CAS/outbox transitions, bounded retries, monotonic progress, cancellation reauthorization, private failure artifacts, terminal intents, and database-only deduplicated Holo notification delivery converge across worker/outbox retries. Focused transfer suites plus the Holo notifier convergence test passed 58/58 on 2026-07-29; affected Holo Notifications/Core and Panels Core builds passed.
- [x] Add malformed CSV, encoding, huge row, validation failure, duplicate, tenant, authorization, retry, and partial completion tests. Evidence: bounded streaming CSV rejects invalid UTF-8, malformed quoting, duplicate headers, width, byte/cell/column/row limits, and invalid delimiters; row execution covers validation rollback, tenant-first relationship/mutation scope, duplicate idempotency, retry release, sanitized failures, and continuation after failed rows. The focused P15 suite passed 58/58 on 2026-07-29.

### P15-B: exports

- [x] Add framework-neutral purpose-bound expiring signed route tokens to Holo Security. Evidence: adjacent Holo-JS `createSignedToken()`/`verifySignedToken()` use constant-time verification and passed affected Security builds, typechecks, lint, and focused tests on 2026-07-29.
- [x] Implement exporter/column builders and generator.
- [x] Implement selected columns, computed state, relations, aggregates, formats, options, query override, and visible-table-column defaults.
- [x] Apply authorized tenant-scoped queries before chunking.
- [x] Implement CSV and XLSX writers behind format adapters.
- [x] Escape formula-capable untrusted text by default.
- [x] Store files privately and serve through signed authorized downloads.
- [x] Implement queued chunks, retries, progress, cleanup, and completion notification. Evidence: export workers persist contiguous bounded typed-cell parts, CAS progress with the next queue intent, delete stale candidates, stream digest-verified parts into CSV/XLSX finalization, clean intermediate/private artifacts, and deliver a deduplicated database notification before acknowledging its outbox intent. Focused P15 suites passed 58/58 and affected Holo/Panel builds passed on 2026-07-29.
- [x] Add cross-tenant, unauthorized download, formula injection, maximum rows, expired link, retry, and cleanup tests. Evidence: authorization/tenant scope runs before query creation and lookup; purpose-bound downloads reject actor substitution and expiry; CSV/XLSX escape hostile formula-capable text; maximum rows fail before chunk reads; retry/CAS races converge; digest/revision failures fail closed; and cleanup removes artifacts before deleting the operation. Focused P15 suites passed 58/58 on 2026-07-29.

Evidence: approved importer/exporter and typed column builders preserve concrete subtypes, compile once, lock after compilation, infer resource-bound record/input/actor/tenant types, and are generated with explicit resource bindings. CSV import carries strict UTF-8, quoting, row, and cell state across bounded storage chunks; mapping and row execution enforce required allow-listed columns, tenant authorization, relationship resolution, validation, transactional create/update hooks, idempotency, and sanitized failures. Export planning applies authorization and tenant scopes before table state, selection, query override, count, and deterministic chunks; it supports computed state, relations, aggregates, options, visible-column defaults, CSV formula escaping, and typed XLSX output. The durable lifecycle persists immutable digest-bound execution input with deterministic definition revisions, revision-2 queue envelopes, atomic CAS/outbox transitions, bounded retries/progress/cleanup, terminal notification intents, cancellation reauthorization, and purpose-bound downloads. Export workers persist contiguous bounded canonical typed-cell parts, delete stale CAS candidates, digest-verify and stream parts into CSV or incremental XLSX ZIP finalization without whole-result buffering, bind finalization to the exact definition/resource/identity context, and clean every intermediate artifact. Production integration includes package-owned Holo Database operation/outbox migrations and leased store, fixed-job Holo Queue dispatch, private create-only Holo Storage streaming with incremental SHA-256 verification, immutable upload copying, bounded outbox dispatch/release, revision-checked artifact cleanup, and durable Holo Notifications deduplication through `notify(actor, definition).deduplicate(outboxId).dispatch()`. Strict core and umbrella typechecks/builds, ESLint, all 58 focused P15 tests, 6/6 plugin migration tests, and affected adjacent Holo Notifications/Core validation passed on 2026-07-29. End-to-end example journeys and the phase gate remain open; the exact host contract is recorded in `plans/p15-remaining-durability-proposal.md`.

- [x] **P15 phase gate:** import and export journeys complete in all example apps using database queue and private local storage; driver contract tests cover alternative storage/queue implementations. Evidence: inferred Next, Nuxt, and SvelteKit fixtures execute durable import/export journeys with database Holo Queue, private streaming local Holo Storage, tenant-scoped mutation/query, resumable parts and finalization, and deduplicated terminal Holo Notifications. The P15 Core suite passed 61/61, all three framework journeys passed 3/3, alternative queue/storage driver contracts passed 2/2, affected builds and lint passed, and the final workspace typecheck passed on 2026-07-29.

## 48. Phase P16: extended parity and plugin ecosystem

Objective: close the enumerated Filament parity matrix and prove third-party extension quality.

Prerequisites: relevant feature foundations through P15.

Parallel lanes: component families, render hooks/assets/themes, custom plugins, and advanced resource/table features may run in parallel with strict directory ownership.

Tasks:

- [x] Complete every form field, infolist entry, table column, filter, layout, summary, and action listed in sections 9 through 12. Revalidated on 2026-08-09: behavior-oriented Core and React/Vue/Svelte renderer suites cover the complete built-in families, generated apps exercise real CRUD, table, relation, action, search, widget, tenant, and MFA workflows, and the exact 161-topic Filament 5 parity validator reports no deferred rows.
- [x] Implement singular and nested resource edge cases. Evidence: singular resources resolve only after base/tenant/authorization scopes and reject list/create pages; nested resources infer the parent record from a supplied parent resource builder, resolve and authorize the trusted parent before applying the mandatory child scope, scope child lookup/mutation, verify parents before create, return 404 for missing/unauthorized combinations, and remain mutually exclusive with singular resources. Strict Core typecheck, ESLint, declaration build, and 3/3 focused nested executor tests passed on 2026-07-29.
- [x] Implement configured resource/page variants registered multiple times. Evidence: immutable configured resources and pages preserve the original definition while deriving independent IDs, slugs/routes, component identities, and discovery contributions; one plugin can register base and configured variants into multiple panels without shared installation mutation. Focused plugin-authoring JSON Vitest passed 7/7 and Core declaration build passed on 2026-07-29.
- [x] Implement Filament 5 render hooks registered on panels, with optional resource/page scopes, plus component render slots. Evidence: the public constants match the nondeprecated Filament 5 panel, table, action, and widget hook identifiers. Panel hooks accept named JSON-safe renderer references, order them deterministically, and serialize no callbacks or local paths. Prepare/build/dev discover framework renderer registries and generate the application registry in `.holo-js`; React, Vue, and Svelte mount the hooks at the matching shell, page, table, action-modal, widget, and relation-manager boundaries. The former page/resource `.slot()` APIs and their contracts were removed.
- [x] Implement plugin asset and icon registration with safe package-relative resolution. Evidence: preparation resolves only public package exports, rejects traversal, symlink escape, special/unbounded/unsupported assets, fingerprints bounded package-owned assets, namespaces icons, and emits client-safe managed artifacts without callbacks or local paths. Focused preparation/plugin suites passed 8/8 and the packed money plugin generated its fingerprinted stylesheet and icon in clean Next, Nuxt, and SvelteKit fixtures on 2026-07-29.
- [x] Implement global per-type defaults with panel/app/plugin precedence and local override. Evidence: discovery loads `panels.config.{ts,mts,js,mjs}`, captures application, ordered plugin-registration, and panel defaults while evaluating definitions, and applies matching defaults exactly once before local fluent mutations or compilation across actions, fields, columns, entries, filters, summaries, schema components, and widgets. Concrete subtypes and contextual callback types remain inferred without user generics, overlapping scopes fail closed, and focused Core/CLI suites passed 24/24 with strict typechecks, ESLint, builds, and architecture validation on 2026-07-29.
- [x] Implement UI publishing and safe diff-based synchronization. Evidence: `holo panels:publish-ui [--confirm]` publishes fixed framework snapshots, validates exact package/application manifests and checksums, previews deterministic unified diffs, applies clean-only atomic add/change/delete synchronization with rollback, refuses traversal/symlink/special-file/UTF-8/NUL/size/conflict violations, and preserves published UI on uninstall. Strict CLI typecheck, ESLint, 68 focused tests including 13/13 publish tests, source/prepack validation, CLI build/declarations, built-command smoke, tarball asset verification, and the regenerated shared API reference passed on 2026-07-29.
- [x] Implement custom field, column, entry, filter, action, widget, page, and full panel-plugin examples. Evidence: `examples/plugins` implements all eight requested public extension families, preserves inferred model and action-context types without explicit generics or callback annotations, registers matching renderer contracts, and passes its typecheck, JSON Vitest contract suite, declaration build, tarball installation, root/renderer/CSS import, and plugin-installation smoke checks in an isolated consumer.
- [x] Publish a sample currency field/money column plugin with all three renderers. Evidence: the workspace package `@holo-js/panels-plugin-money` exports typed currency-field and money-column builders, React/Vue/Svelte renderer subpaths, stylesheet, translation, icon, compatibility, renderer, asset, and default metadata. Strict typecheck, ESLint, 3/3 contract tests, four-entry build/import smoke, tarball contents, 14-package metadata validation, and the full packed workspace validation pass on 2026-07-29.
- [x] Add plugin compatibility, missing renderer, duplicate type, assets, translation, permission, and packed installation tests. Evidence: preparation tests reject incompatible versions, absent framework renderers, private renderer modules, duplicate/conflicting contributions, and escaping assets while verifying translations and permission metadata; the packed `@holo-js/panels-plugin-money` installs from tarballs, generates branded renderer registries plus asset/translation/icon metadata, and typechecks in clean Next, Nuxt, and SvelteKit fixtures. Focused preparation tests passed 8/8 and the three-framework packed lifecycle passed on 2026-07-29.
- [x] Update the parity matrix so every official Filament 5 documentation topic is marked implemented, intentionally different, deferred, or not applicable with rationale. Evidence: `docs/filament-5-parity.md` classifies all 161 pages in the official Filament 5 index with an exact URL-set check, rationale, and source/test evidence.

- [x] **P16 phase gate:** no parity item is unclassified; third-party sample plugin installs without changes to Holo Panels core and passes the public contract suite. Revalidated on 2026-08-09 through the 161-topic matrix, packed third-party plugin install/import/typecheck, public inference contracts, and complete workspace validation.

## 49. Phase P17: documentation, hardening, and release

Objective: make Holo Panels safe to adopt and maintain as an official Holo product.

Prerequisites: all release-target features.

Parallel lanes: documentation, security/performance audit, examples, and release tooling may run in parallel. Final release gate is serial.

### P17-A: documentation

- [x] Publish installation and first-panel guides. Evidence: `docs/installation.md` and `docs/first-panel.md` have validated paths, commands, and framework examples.
- [x] Document every package and public subpath. Evidence: `docs/package-reference.md` covers all 21 packages and 46 public entries/conditional targets against built declarations.
- [x] Document panels, resources, schemas, forms, reactivity, dependent selects, tables, infolists, actions, relation managers, pages, widgets, notifications, search, Shield, tenancy, imports, exports, styling, plugins, custom components, testing, deployment, and upgrades. Evidence: `docs/features.md`, `docs/security.md`, and `docs/testing-deployment-upgrades.md` distinguish available, partial, internal, and pending behavior.
- [x] Include Next, Nuxt, and SvelteKit examples where framework wiring differs. Evidence: `docs/first-panel.md`, `docs/features.md`, and `docs/multiple-panels-and-guards.md` link the validated framework fixtures.
- [x] Document server/client resolver boundaries and security implications. Evidence: `docs/features.md`, `docs/security.md`, and `docs/threat-model.md` document projection, serialization, transport, and trust boundaries.
- [x] Document multiple panels using same and different guards. Evidence: `docs/multiple-panels-and-guards.md` covers same-guard reuse and different-guard isolation against current tests.
- [x] Generate searchable API references and a feature parity page. Evidence: `scripts/generate-api-reference.ts` deterministically indexes 21 packages, 46 public entries, 39 declaration entrypoints, and 3,264 exports into `docs/api-reference.md`; `docs/filament-5-parity.md` classifies every official Filament 5 topic.
- [x] Validate every referenced command, file path, and API against built packages. Evidence: documentation link checks pass, package APIs were checked against generated declarations, and documented commands match root/package scripts.

### P17-B: examples and acceptance

- [x] Complete equivalent blog/admin apps for all three frameworks. Revalidated on 2026-08-11: the three production builds expose the same compiled navigation structure, user menu, isolated panel theme, resource widget context, CRUD, relation, tenant, search, and MFA behavior through their generated framework entrypoints. Revalidated on 2026-08-26: all three fixtures include the Holo Storage scaffold, and adjacent Holo-JS commit `e09cf778` generates type-safe Next and SvelteKit storage routes that validate normalized storage configuration before use.
- [x] Cover Post, Category, Tag, Comment, User/Admin, media, roles, notifications, widgets, tenant-scoped records, import, and export. Evidence: the three framework fixtures and their shared P17 acceptance contracts cover all listed domains, including Post/Comment and Post/Tag relation behavior, tenant-owned content, Role and membership management, media fields, database notifications, dashboard widgets, and durable transfer workflows; the focused domain/transfer suite passed 23/23 on 2026-07-29.
- [x] Add Playwright or framework-appropriate browser journeys for critical user behavior. Revalidated on 2026-08-11: 60 production-browser journeys pass across Next, Nuxt, and SvelteKit, including the styled root admin page, computed isolated themes, responsive navigation, user menu navigation, safe 404s, tenant-scoped search and widgets, hostile relation routes, complete relation CRUD/pivot behavior, public blog isolation, tenant switching, and the full MFA enrollment, recovery challenge, and disable lifecycle. Revalidated on 2026-08-26: 72 behavior journeys passed after fresh builds of all 21 packages and the three example applications, covering portal ownership, modal semantics, authentication and CSRF, panel navigation, search and widgets, tenant isolation, hostile relation routes, CRUD, uploads, and MFA. The obsolete screenshot suite was removed because visual styling acceptance is deferred until the planned redesign.
- [x] Pack and install release artifacts into clean fixtures rather than testing workspace aliases only. Revalidated on 2026-08-11: the protected source release dry-run packed all 14 Holo Panels packages at `0.1.0-next.1` with exact internal ranges and `>=0.3.9` Holo peers, installed the tarballs into independent non-workspace and isolated optional-peer consumers, typechecked clean Next, Nuxt, and SvelteKit fixtures, installed the packed third-party plugin example, rejected non-release content, passed every packed P0-C lifecycle, simulated all 14 npm publications with the `next` tag, and restored source manifest dependency ranges after packing. Revalidated on 2026-08-26: all 21 package tarballs passed standalone imports, public inference checks, clean optional-peer consumers, plugin installation, isolated framework consumer typechecks, and the packed P0-C lifecycle for Next, Nuxt, and SvelteKit.

### P17-C: security and performance audit

- [x] Threat-model panel bootstrap, every transport operation, uploads, exports, plugins, rich content, tenancy, permissions, and background jobs. Evidence: `docs/threat-model.md` links 64 source/test targets and distinguishes implemented from pending controls.
- [x] Audit client manifests for secrets and hidden attributes. Evidence: 20 focused suites and 72 tests verify callback, secret, hidden-attribute, error, and local-path exclusion from client projections.
- [x] Benchmark panel bootstrap, 100k-row table pagination/search, option search, global search, widget dashboard, and notification polling. Evidence: `benchmarks/p17-performance.ts` runs seven deterministic workloads over 100k records, 1k notifications, and 24 widgets and emits versioned JSON timing/checksum results; `benchmarks/README.md` records the method and baseline.
- [x] Fix N+1 queries and unbounded payloads. Evidence: relation record listing and tenant memberships use validated cursor pages with direct scoped lookups; global-search result authorization and relation loading operate once per bounded batch; export computed, option, and format resolvers operate once per bounded chunk and fail closed on cardinality mismatches; upload cleanup traverses bounded Holo Storage pages; and Next, Nuxt, and SvelteKit enforce 1 MiB request and 4 MiB serialized response ceilings. Focused core, client, and package-configured framework suites passed 73/73 tests on 2026-07-29, alongside the conditional-export graph check.
  - [x] Replace Holo Storage and S3 unbounded file enumeration with validated cursor pagination. Evidence: adjacent Holo-JS Storage/Core/S3 implementations remove `files()`, add bounded local/public scanning and one-request S3 ListObjectsV2 pagination, and pass 113/113 runtime/storage tests plus all affected builds and typechecks on 2026-07-29.
- [x] Run dependency license and vulnerability review. Evidence: `bun audit --json` reports no advisories after patched root overrides; the installed dependency license scan found permissive licenses, dynamically distributed LGPL libvips, and verified zigpty's omitted manifest license from its MIT license file.
- [x] Document security reporting and supported-version policy. Evidence: `SECURITY.md` defines private reporting, scope, response stages, the current unreleased support state, Holo-JS compatibility, backports, EOL, and coordinated disclosure.

### P17-D: release

- [x] Verify lockstep versions and peer compatibility with supported Holo-JS versions. Revalidated on 2026-08-11: all 14 Holo Panels candidates and lockfile workspace entries are `0.1.0-next.1`; every Holo dependency and peer consistently uses `>=0.3.9`, accepting every later stable Holo-JS release without per-version Panels edits. Holo-JS `0.3.9` was never published, so executable minimum-version validation begins at published `0.3.10`; dependency policies, resolved release manifests, clean tarball consumers, isolated optional-peer consumers, and compatibility-floor tests pass.
- [x] Run full typecheck, lint, tests, coverage diagnostics, architecture checks, package builds, packed smoke tests, and example acceptance. Revalidated on 2026-08-11: all 21 package builds/typechecks and 412 behavior suites with 1,036 tests, ESLint, architecture and dependency policies, conditional exports, exact 161-topic parity with no deferred rows, coverage diagnostics, packed P0-C lifecycles, packed independent/framework/plugin consumers, three production builds, 60 browser journeys, and API-reference freshness passed. Revalidated on 2026-08-26: strict typechecks and builds passed for all 21 packages, ESLint passed, 423 suites with 1,073 tests passed, and architecture, dependency, conditional-export, parity, publish-metadata, packed-consumer, P0-C, three-example build, and 72-journey browser gates passed. Visual snapshot and styling-matrix acceptance remain deferred.
- [x] Publish prerelease packages and test installation from the registry. Evidence: the protected npm release published all 14 Holo Panels packages at `0.1.0-next.0` with the `next` tag on 2026-08-04. The adjacent Holo-JS resolver fix was published across the 46-package lockstep `0.3.11` release from commit `0d074287272b769cda83fe4886c2127c96c9c529`, with 46 matching Git tags and registry versions. `bun run test:registry-release` then bootstrapped the published Holo CLI and exact Panels prerelease into clean, non-workspace Next, Nuxt, and SvelteKit applications and passed plugin activation, preparation, panel/resource generation, adapter selection, Shield, idempotency, and safe uninstall for all three frameworks.
- [x] Publish migration/upgrade guide and changelog. Evidence: `docs/testing-deployment-upgrades.md` documents clean installation, generated artifacts, deployment, lockstep releases, safe upgrades, migrations, and uninstall; `CHANGELOG.md` records the published `0.1.0-next.0` package family, compatibility evidence, and registry acceptance.
- [x] Release `@holo-js/panels` and its workspace family. Evidence: GitHub release run `30908409841` published all 14 public packages at `0.1.0-next.0` with the `next` tag; registry verification observed every version and tag, the staged queue was empty, and the subsequent three-framework registry lifecycle passed.

- [ ] **P17 final gate:** a new Holo app can install the published plugin, create a panel and generated resource exclusively with `holo` commands, run all three supported frameworks, and pass the documented security and behavior acceptance suite.

Current evidence on 2026-08-11: the complete `0.1.0-next.1` protected dry-run and local-tarball lifecycle pass for all three frameworks. The registry lifecycle correctly remains open because npm still serves `0.1.0-next.0`, which predates fingerprinted plugin stylesheet generation. Publishing `0.1.0-next.1` and rerunning `bun run test:registry-release` are the only remaining phase-gate actions.

## 50. Feature parity inventory

The parity tracker must contain an entry for every category below. The tracker is release data, not marketing prose.

### Actions

- Overview, modals, grouping, create, edit, view, delete, force-delete, restore, replicate, import, and export.

### Schema and layout

- Overview, layouts, sections, tabs, wizards, callouts, empty states, prime/shared components, custom components, and standalone rendering.

### Forms

- Overview, validation integration, builder, checkbox, checkbox list, code editor, color picker, custom fields, date/time picker, file upload, hidden, key-value, Markdown editor, radio, repeater, rich editor, select, slider, tags, text input, textarea, toggle, and toggle buttons.

### Infolists

- Overview, text, icon, image, color, code, key-value, repeatable, custom entries, and standalone rendering.

### Tables

- Overview, layout, custom data, empty state, grouping, summaries, actions; text, icon, image, color, checkbox, select, toggle, text-input and custom columns; basic, select, ternary, custom, layout, and query-builder filters.

### Resources

- Overview, list, create, edit, view, delete, relationships, nesting, singular resources, widgets, custom pages, global search, and maintainable file separation.

### Panels and navigation

- Panel configuration, navigation overview, custom pages, user menu, clusters, multiple dashboards, multiple panels, styling, colors, icons, CSS hooks, assets, and render hooks.

### Users and security

- Panel access, guards/providers, profile, multi-factor authentication, multi-tenancy, resource policies, Shield roles/permissions, CSRF, throttling, and secure serialization.

### Notifications

- Temporary notifications, actions, database notifications, broadcast/realtime updates, polling, read/unread, and standalone rendering.

### Widgets

- Overview, stats, charts, tables, custom widgets, filters, polling, resource widgets, and multiple dashboards.

### Plugins and customization

- Panel plugins, standalone component plugins, configurable resources/pages, custom fields/entries/columns/filters/actions/widgets, assets, icons, translations, themes, and published UI.

### Testing and operations

- Resource, schema, table, action, notification, widget, plugin, framework acceptance, deployment, optimization, generated-file, upgrade, and version-support testing/documentation.

## 51. Definition of done

Holo Panels is complete for its first stable release only when all of the following are true:

- [x] The product installs as an external Holo plugin through `holo plugin:add`. Evidence: the packed Next, Nuxt, and SvelteKit lifecycle activates the packed plugin through the real Holo CLI and loads its boot, migration, preparation, and command contributions.
- [x] All Holo Panels commands run through the existing `holo` CLI. Evidence: command inventory and packed installation/Shield lifecycle tests execute contributed Panels commands through `holo`; no competing executable is shipped.
- [x] `holo prepare`, `holo dev`, and `holo build` automatically run Holo Panels discovery. Evidence: the Holo host lifecycle fixture proves all three hooks and packed Panels acceptance invokes the loadable preparation contribution through `holo prepare`.
- [x] Users normally install only `@holo-js/panels`; the installer selects the correct adapter. Evidence: framework detection installs exactly one matching adapter at the umbrella version in clean Next, Nuxt, and SvelteKit fixtures and preserves install/uninstall idempotency.
- [x] Resource/form/table/relation/infolist/widget APIs are fluent and precisely inferred. Evidence: the consumer-style full inference contract derives auth/tenancy, Holo model resource and nested relation scope, form/schema, columns/filters/summaries/advanced filters, infolist, action/resolver, importer/exporter, page/widget/dashboard, plugin authorization, and custom-field types from runtime values without factory generics or callback annotations; focused inference suites passed 28/28 with Core/Panels typechecks and declaration builds on 2026-07-29.
- [x] Static, null, translated, client expression, and callback-resolved properties work with documented server/client semantics. Evidence: resolver, translation, locale, callback-exclusion, dependency, stale-response, cycle, and safe-error suites observe each supported value form.
- [x] Slug and dependent-select reactivity behave correctly and are server-validated. Evidence: field, option-service/store, shared form acceptance, and P9 example suites observe slug generation/editing, dependent clearing/loading, authorized lookup, and invalid submission rejection.
- [x] Multiple panels work with the same or different guards. Evidence: panel and P14 auth isolation suites cover same-guard reuse, different-guard separation, logout isolation, and panel access denial.
- [x] Shield composes with Holo policies and tenant boundaries. Evidence: Shield suites observe the panel, tenant, Shield, Holo policy, and invariant order plus tenant/actor isolation and the Shield-only super-admin boundary.
- [x] Holo notifications, database notifications, queues, storage, media, broadcast, and realtime are reused. Evidence: P13/P15 production-boundary suites use the Holo packages for database/realtime notification delivery, queue execution, private streaming storage, uploads/media, and durable completion.
- [x] Auto discovery is deterministic and production uses generated registries. Evidence: compiler tests prove deterministic output and load generated registries after source definition directories are removed; packed preparation exercises the production registry path.
- [x] React, Vue, and Svelte renderers pass the shared behavior/accessibility contracts. Evidence: shared shell, form, table, infolist/action, relation, navigation, widget, notification, filter, accessibility, and hydration suites pass across all three renderer families.
- [x] Custom component and plugin examples add types without modifying core. Evidence: the independently packed catalog plugin contributes typed field, column, entry, filter, action, widget, and page extensions plus renderers through public registries and installs without modifying Holo Panels core.
- [x] All parity items are classified and all stable-release items are implemented. Evidence: all 161 rows in `docs/filament-5-parity.md` are classified with implementation or intentional-boundary evidence, no row remains deferred, and all relative evidence links resolve.
- [x] All code quality, security, package, framework, and acceptance gates pass. Evidence: the full Holo Panels validation, protected standalone CI run `30905353031`, protected 14-package release run `30908409841`, published-registry verification, and clean Next, Nuxt, and SvelteKit registry lifecycle all passed; the required Holo-JS `0.3.11` host release passed its full typecheck, lint, build, 28-minute workspace/acceptance test chain, packed-package smoke, and scaffold journeys before publication.

## 52. Reference sources

- Filament 5 complete documentation index: <https://filamentphp.com/docs/llms.txt>
- Filament resources: <https://filamentphp.com/docs/5.x/resources/overview>
- Filament relation managers: <https://filamentphp.com/docs/5.x/resources/managing-relationships>
- Filament schemas: <https://filamentphp.com/docs/5.x/schemas/overview>
- Filament forms: <https://filamentphp.com/docs/5.x/forms/overview>
- Filament tables: <https://filamentphp.com/docs/5.x/tables/overview>
- Filament infolists: <https://filamentphp.com/docs/5.x/infolists/overview>
- Filament widgets: <https://filamentphp.com/docs/5.x/widgets/overview>
- Filament database notifications: <https://filamentphp.com/docs/5.x/notifications/database-notifications>
- Filament global search: <https://filamentphp.com/docs/5.x/resources/global-search>
- Filament tenancy: <https://filamentphp.com/docs/5.x/users/tenancy>
- Filament plugins: <https://filamentphp.com/docs/5.x/plugins/getting-started>
- Filament Shield: <https://filamentphp.com/plugins/bezhansalleh-shield>
- shadcn/ui principles and registry: <https://ui.shadcn.com/docs> and <https://ui.shadcn.com/docs/registry/getting-started>
- shadcn-vue principles: <https://www.shadcn-vue.com/docs/introduction>
- Holo-JS plugin contracts: `/Users/cobra/Code/holo-js/packages/kernel/src/plugins.ts`
- Holo-JS plugin CLI loading: `/Users/cobra/Code/holo-js/packages/cli/src/project/plugins.ts`
- Holo-JS discovery and generated registry: `/Users/cobra/Code/holo-js/packages/cli/src/project/registry.ts`
- Holo-JS models and relations: `/Users/cobra/Code/holo-js/packages/db/src/model`
- Holo-JS form schemas: `/Users/cobra/Code/holo-js/packages/forms/src/schema.ts`
- Holo-JS authorization: `/Users/cobra/Code/holo-js/packages/authorization/src`
- Holo-JS notifications: `/Users/cobra/Code/holo-js/packages/notifications/src`
