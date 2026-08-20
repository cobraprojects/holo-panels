# Package reference

This reference describes the package entrypoints that are currently published. The `exports` maps in each package manifest define the supported import paths; generated declaration files describe the API available from those paths. Files under `dist` that are not present in an `exports` map are plugin internals, not public subpaths.

Use the generated [searchable API reference](api-reference.md) to find every public symbol by package entrypoint. Regenerate it after building with `bun scripts/generate-api-reference.ts`, or verify it with `bun scripts/generate-api-reference.ts --check`.

## Installation entrypoint

Applications install and activate the umbrella package with the existing Holo CLI:

```bash
npx holo plugin:add @holo-js/panels
npx holo panels:install
```

The umbrella Holo plugin contributes the Holo security dependency, its command module, runtime boot module, migration publisher, and project preparer internally. Holo scaffolds missing security configuration while adding the plugin. The root package, `@holo-js/panels/server`, `@holo-js/panels/plugin`, and `@holo-js/panels/package.json` are public imports.

## Published packages and subpaths

| Package | Public subpaths | Purpose |
|---|---|---|
| `@holo-js/panels` | `.`, `./server`, `./plugin`, `./package.json` | Application-facing definitions, explicit server definitions, selected core/client APIs, and the Holo plugin definition. |
| `@holo-js/panels-core` | `.`, `./server`, `./transfers` | Framework-neutral builders, immutable definitions, protocols, server execution contracts, registries, and domain services; its root export has a browser-safe condition. |
| `@holo-js/panels-schemas` | `.` | Shared typed schemas and layout components. |
| `@holo-js/panels-actions` | `.` | Reusable actions, action groups, CRUD actions, modal schemas, and execution contracts. |
| `@holo-js/panels-forms` | `.` | Typed form fields used by schemas, resources, pages, actions, and table filters. |
| `@holo-js/panels-tables` | `.` | Typed tables, columns, filters, groups, summaries, and table action positions. |
| `@holo-js/panels-infolists` | `.` | Typed read-only entries and infolist schemas. |
| `@holo-js/panels-notifications` | `.` | Fluent notifications with shared actions and delivery methods. |
| `@holo-js/panels-resources` | `.` | Model-bound resource classes, inferred CRUD pages, relation managers, and package component scopes. |
| `@holo-js/panels-client` | `.` | Framework-neutral client stores, transport, effects, options, uploads, navigation, relations, notifications, and widgets; its root export has a browser-safe condition. |
| `@holo-js/panels-ui` | `.`, `./style.css` | Design tokens, icons, accessibility/conformance data, and shared semantic CSS. |
| `@holo-js/panels-react` | `.`, `./server`, `./style.css` | React primitives and renderers for fields, tables, actions, entries, relations, navigation, widgets, and notifications. |
| `@holo-js/panels-vue` | `.`, `./server`, `./style.css` | Vue primitives and renderers for fields, tables, actions, entries, relations, navigation, widgets, and notifications. |
| `@holo-js/panels-svelte` | `.`, `./server`, `./style.css` | Svelte primitives and renderers for fields, tables, actions, entries, relations, navigation, widgets, and notifications. |
| `@holo-js/panels-next` | `.`, `./client`, `./server` | Next.js server/runtime helpers and the explicit browser-safe client entrypoint. |
| `@holo-js/panels-nuxt` | `.`, `./server` | Nuxt page composition, operation handling, and panel page state helpers. |
| `@holo-js/panels-sveltekit` | `.`, `./server` | SvelteKit page loading, operation handling, registry contracts, and `PanelPage`. |
| `@holo-js/panels-cli` | `.` | Holo command contributions, discovery compilation, generators, and framework-artifact planning. |
| `@holo-js/panels-shield` | `.`, `./plugin`, `./package.json` | Shield repositories, evaluator, permission generation, authorization composition, and its optional Holo plugin definition. |
| `@holo-js/panels-plugin-money` | `.`, `./react`, `./vue`, `./svelte`, `./money.css` | Sample currency field and money column plugin with all three renderers and its stylesheet. |
| `@holo-js/panels-testing` | `.`, `./react`, `./vue`, `./svelte` | Framework-neutral acceptance journeys and renderer-foundation assertions. The three framework subpaths currently have empty declarations and expose no utilities. |

The manifest and declaration evidence for this table is linked in the package sections below.

## Umbrella package

### `@holo-js/panels`

The root entrypoint is the normal application import. It re-exports the public domain packages so an application can use the same schema, action, table, notification, and resource types everywhere.

```ts
import {
  ListRecords,
  Notification,
  RelationManager,
  Resource,
  definePanel,
} from '@holo-js/panels'
```

`@holo-js/panels/server` exports server-only definitions without client stores. `@holo-js/panels/plugin` exports the Holo plugin definition and plugin-registry compatibility contracts. `@holo-js/panels/package.json` exposes package metadata for Holo plugin discovery.

Evidence: [manifest](../packages/panels/package.json), [root declarations](../packages/panels/dist/index.d.ts), [server declarations](../packages/panels/dist/server.d.ts), [plugin declarations](../packages/panels/dist/plugin.d.ts).

The generated `commands`, `runtime`, `migrations`, and `prepare` modules are deliberately not package exports. Holo loads them through the plugin definition.

## Framework-neutral packages

### Public composition packages

`@holo-js/panels-schemas` owns `Schema` and the layout components shared across public features. `@holo-js/panels-forms`, `@holo-js/panels-infolists`, and `@holo-js/panels-tables` add typed fields, entries, columns, filters, groups, and summaries without creating separate schema systems.

`@holo-js/panels-actions` owns the single action contract. The same `Action` can be mounted as a resource-page action, table record/header/toolbar action, modal action, or notification action. Built-in actions include create, view, edit, delete, replicate, restore, force-delete, import, export, and their supported bulk forms.

`@holo-js/panels-notifications` exposes `Notification.make()`, status helpers, duration and persistence configuration, shared actions, and delivery methods. `@holo-js/panels-resources` exposes `Resource`, CRUD page classes, and `RelationManager`. A resource declares `protected static override model = Post`; a relation manager declares `protected static override relationship = 'comments'`. Generated registry augmentations infer fields, relation paths, callbacks, actions, schemas, and tables without user-written generic arguments, record aliases, or duplicated migration columns. Relation managers configure the normal `Schema` and `Table` classes.

Evidence: [schemas](../packages/schemas/package.json), [actions](../packages/actions/package.json), [forms](../packages/forms/package.json), [tables](../packages/tables/package.json), [infolists](../packages/infolists/package.json), [notifications](../packages/notifications/package.json), [resources](../packages/resources/package.json).

### `@holo-js/panels-core`

Use the root entrypoint for low-level framework-neutral work: protocol envelopes and JSON types, fluent schema/field/table/action/page/panel/resource/relation/widget builders, authorization and persistence contracts, registries, translations, server resolution, query execution, notifications, and tenancy contracts.

Most applications should prefer `@holo-js/panels`; plugin authors and framework integrations may need the core package directly.

Evidence: [manifest](../packages/core/package.json), [root declarations](../packages/core/dist/index.d.ts), [server declarations](../packages/core/dist/server.d.ts), [transfer declarations](../packages/core/dist/transfers.d.ts).

### `@holo-js/panels-client`

The root entrypoint exposes shared client behavior without a UI runtime. Implemented areas include `FormStore`, `SchemaStateStore`, `TableStateStore`, `ClientActionStore`, option and upload stores, locale state, effects, transport adapters, navigation/search, relation state, notification stores, and widget state.

Evidence: [manifest](../packages/client/package.json), [declarations](../packages/client/dist/index.d.ts).

### `@holo-js/panels-ui`

The root entrypoint exposes theme tokens, icon registration, shell primitive names, keyboard/accessibility patterns, and component conformance fixtures. Import `@holo-js/panels-ui/style.css` for the published framework-neutral stylesheet. Use the [panel theming contract](theming.md) instead of copying or forking that stylesheet.

Evidence: [manifest](../packages/ui/package.json), [declarations](../packages/ui/dist/index.d.ts).

## Renderer packages

### `@holo-js/panels-react`

The root entrypoint exposes React shell primitives, component registries, store bindings, and the implemented field, table, action, entry, relation, navigation/search, widget, and notification renderers. Import `@holo-js/panels-react/style.css` for React renderer styles.

Evidence: [manifest](../packages/react/package.json), [declarations](../packages/react/dist/index.d.ts).

### `@holo-js/panels-vue`

The root entrypoint exposes Vue shell primitives, `ComponentRegistry`, store bindings, and the implemented field, table, action, entry, relation, navigation/search, widget, and notification renderers. Import `@holo-js/panels-vue/style.css` for Vue renderer styles.

Evidence: [manifest](../packages/vue/package.json), [declarations](../packages/vue/dist/index.d.ts).

### `@holo-js/panels-svelte`

The root entrypoint exposes Svelte shell components, `SvelteComponentRegistry`, source adapters, and the implemented field, table, action, entry, relation, navigation/search, widget, and notification renderers. Import `@holo-js/panels-svelte/style.css` for Svelte renderer styles.

Evidence: [manifest](../packages/svelte/package.json), [declarations](../packages/svelte/dist/index.d.ts).

## Framework adapters

### `@holo-js/panels-next`

The root entrypoint contains Next.js runtime registration, page resolution, page creation, operation-route creation, error types, and the client components. Browser code may use the narrower `@holo-js/panels-next/client` entrypoint for `NextPanelClient` and `NextPanelResourcePage`.

Evidence: [manifest](../packages/next/package.json), [root declarations](../packages/next/dist/index.d.ts), [client declarations](../packages/next/dist/client.d.ts), [server declarations](../packages/next/dist/server.d.ts).

### `@holo-js/panels-nuxt`

The root entrypoint exposes `PanelPage`, `usePanelPage`, and associated Nuxt panel/runtime contracts. `@holo-js/panels-nuxt/server` exposes the server operation handler.

Evidence: [manifest](../packages/nuxt/package.json), [root declarations](../packages/nuxt/dist/index.d.ts), [server declarations](../packages/nuxt/dist/server.d.ts).

### `@holo-js/panels-sveltekit`

The root entrypoint exposes `PanelPage`, `createPanelPageLoad`, and associated SvelteKit event, registry, runtime, page, and operation contracts. `@holo-js/panels-sveltekit/server` exposes the server operation handler.

Evidence: [manifest](../packages/sveltekit/package.json), [root declarations](../packages/sveltekit/dist/index.d.ts), [server declarations](../packages/sveltekit/dist/server.d.ts).

## Tooling and optional packages

### `@holo-js/panels-cli`

This package exports the command contribution array, discovery compiler, generated-registry parsing/rendering, and framework-artifact planning utilities. It contributes commands to the existing `holo` executable; it does not provide another executable.

Currently contributed commands are:

| Command | Usage |
|---|---|
| `panels:install` | `holo panels:install` |
| `panels:uninstall` | `holo panels:uninstall` |
| `make:panel` | `holo make:panel <panel> [--path /admin] [--guard admin] [--default]` |
| `make:resource` | `holo make:resource <Model> [--panel admin] [--split] [--generate]` |
| `make:page` | `holo make:page <Name> [--panel admin]` |
| `make:resource-page` | `holo make:resource-page <Name> --resource <Resource> [--panel admin]` |
| `make:relation-manager` | `holo make:relation-manager <Name> --resource <Resource> [--panel admin]` |
| `make:form-field` | `holo make:form-field <Name> [--panel admin]` |
| `make:infolist-entry` | `holo make:infolist-entry <Name> [--panel admin]` |
| `make:table-column` | `holo make:table-column <Name> [--panel admin]` |
| `make:filter` | `holo make:filter <Name> [--panel admin]` |
| `make:action` | `holo make:action <Name> [--panel admin]` |
| `make:widget` | `holo make:widget <Name> [--panel admin]` |
| `make:cluster` | `holo make:cluster <Name> [--panel admin]` |
| `make:importer` | `holo make:importer <Name> [--panel admin]` |
| `make:exporter` | `holo make:exporter <Name> [--panel admin]` |

Evidence: [manifest](../packages/cli/package.json), [declarations](../packages/cli/dist/index.d.ts).

### `@holo-js/panels-shield`

The root entrypoint currently exposes:

- `shield(...)`, the panel plugin that composes actor and tenant resolvers with Shield evaluation;
- `createShieldEvaluator(...)` and authorization errors;
- `composeShieldAuthorization(...)`;
- deterministic permission-key generation;
- in-memory and Holo DB administration repositories, migrations, assignment operations, and public read/write contracts.

`@holo-js/panels-shield/plugin` exposes the optional Holo plugin declaration; `@holo-js/panels-shield/package.json` exposes discovery metadata.

Evidence: [manifest](../packages/shield/package.json), [declarations](../packages/shield/dist/index.d.ts), [plugin declarations](../packages/shield/dist/holo-plugin.d.ts).

### `@holo-js/panels-plugin-money`

The root entrypoint exports `moneyPlugin`, `currencyField`, `moneyColumn`, and their typed properties. Framework packages register the matching renderer from `/react`, `/vue`, or `/svelte`, and applications import `/money.css` for the sample presentation. The plugin contributes translation, icon, stylesheet asset, default, compatibility, and renderer metadata without modifying Panels core.

Evidence: [manifest](../packages/plugin-money/package.json), [root declarations](../packages/plugin-money/dist/index.d.ts), [React declarations](../packages/plugin-money/dist/react.d.ts), [Vue declarations](../packages/plugin-money/dist/vue.d.ts), [Svelte declarations](../packages/plugin-money/dist/svelte.d.ts).

### `@holo-js/panels-testing`

The root entrypoint exposes framework-neutral renderer-foundation checks, manifest/definition assertions, state round trips, and relation, navigation/search, and widget acceptance journeys.

The exported `@holo-js/panels-testing/react`, `@holo-js/panels-testing/vue`, and `@holo-js/panels-testing/svelte` subpaths currently produce empty declarations. They are valid import paths but have no public functions or types yet.

Evidence: [manifest](../packages/testing/package.json), [root declarations](../packages/testing/dist/index.d.ts), [React declarations](../packages/testing/dist/react.d.ts), [Vue declarations](../packages/testing/dist/vue.d.ts), [Svelte declarations](../packages/testing/dist/svelte.d.ts).

## Completed P14-P16 surfaces

Shield commands execute through the Holo application-command runtime using generated panel permissions and application Shield configuration. Role and Permission resources use the ordinary resource and renderer contracts. Panel authentication, Holo Auth MFA, tenant registration/profile/switching, and secure framework-native dispatch are available through the public panel and adapter APIs.

Imports and exports include durable revisioned jobs, atomic outbox transitions, bounded queue workers, private streaming Holo Storage artifacts, progress and cancellation, completion notifications, authorized expiring downloads, and end-to-end framework acceptance.

Plugin preparation resolves contributed assets and renderer registrations, applies deterministic default precedence, and supports nested resources through trusted parent execution context. These surfaces are public only through the package exports documented above; internal filesystem paths remain unsupported.

## Import-path rule

Use only the subpaths listed in this document and in a package's `exports` map. An emitted file such as `dist/commands.mjs`, `dist/runtime.mjs`, `dist/migrations.mjs`, or `dist/prepare.mjs` is not public merely because it exists in a packed package.
