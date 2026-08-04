# P16 extended parity and plugin ecosystem public API amendment proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

This proposal closes the public-API gaps that remain in Phase P16. It supplements the already proposed `holo panels:publish-ui` contract in `plans/p16-cli-public-api-proposal.md`; it does not replace that proposal.

The proposal preserves these existing decisions:

- Holo Panels remains a separate official Holo plugin.
- Holo-JS continues to own routing, auth, authorization, storage, queues, notifications, security, and the `holo` executable.
- Builders and server callbacks never enter client manifests.
- Custom extensions use registries rather than central type switches.
- Framework adapters depend only on their matching renderer.
- Existing field, entry, column, filter, action, widget, page, resource, and panel APIs remain source-compatible except for the explicitly identified action-modal schema and minimal `PanelPlugin` contract corrections below.

## Phase P16 traceability

| Canonical P16 task | Public contract in this proposal |
|---|---|
| Remaining component-family parity | Client-safe schema transport, custom extension authoring, infolist additions, and action additions |
| Singular and nested resources | `ResourceBuilder.singular()` and `ResourceBuilder.nestedUnder()` |
| Configured resource/page variants | Existing `ResourceBuilder.configured()` plus `PageBuilder.configured()` |
| Scoped render slots | `PanelBuilder.slot()`, `ResourceBuilder.slot()`, `PageBuilder.slot()`, and schema-component slot overloads |
| Plugin assets and icons | `PanelPluginAsset`, `PanelPluginIcon`, safe package resolution, and generated manifests |
| Global defaults | `componentDefault()`, `definePanelsConfig()`, plugin defaults, and `PanelBuilder.defaults()` |
| UI publishing | Separately specified by `plans/p16-cli-public-api-proposal.md` |
| All custom extension examples | Common extension builders, renderer contribution contracts, and required examples |
| Currency/money sample plugin | `@holo-js/panels-plugin-money` contract |
| Compatibility and packed tests | Preparation rules and packed sample-plugin obligations |
| Parity matrix classification | No new runtime API; classification remains release data in the canonical parity artifact |

Already public built-in field, layout, column, filter, summary, entry, and action names are not duplicated here. Their missing behavior is implementation work under those stable names.

## Package exports

After approval, the following symbols are public.

`@holo-js/panels` and `@holo-js/panels-core` export all core authoring and definition types in this document. `@holo-js/panels/server` exports `toSchemaManifest`. Render-slot resolution, default application, and package asset validation are implementation details. `@holo-js/panels/plugin` exports the plugin, contribution, asset, icon, default, renderer, translation, permission, and generator-template contracts.

`@holo-js/panels/client` and `@holo-js/panels-client` retain their existing browser state, transport, effect, form, option, upload, action, entry, relation, navigation, search, notification, table, widget, and locale APIs and add the JSON-safe schema, render-slot, asset, icon, and renderer-reference manifests. They do not export builders, package paths, callbacks, server runtimes, server executors, server decoders, or server definitions.

Each renderer package exports its framework-specific renderer registration functions and renderer property types. Framework adapter packages expose only their existing page/operation entry points; the schema renderer registry is supplied through the adapter options described below.

### Conditional distribution boundaries

No new user import path or named export is introduced for this boundary. Package export maps add standard runtime conditions while preserving every existing `import` and `default` target:

- `@holo-js/panels-core` adds a `browser` root condition containing only the JSON values, protocol envelopes and codecs, client-safe errors, locale helpers, schema-manifest patching, notification presentation, option contracts, relation presentation, upload descriptors, and chart-model functions already consumed by `@holo-js/panels-client`. It contains no Holo model, database, filesystem, crypto, queue, storage, auth, authorization, or server-execution import.
- `@holo-js/panels-client` adds a `browser` root condition for its retained browser APIs and client-safe re-exports. Its existing default root remains available to non-browser consumers during the prerelease transition, but framework renderers resolve the browser condition.
- `@holo-js/panels-react` adds a `react-server` root condition containing only the server-safe Panels primitives used by the Next adapter. Its existing root remains the React renderer, and `@holo-js/panels-next/client` remains the explicit client-component entry.
- `@holo-js/panels-next` adds a `react-server` root condition containing its existing page, operation-route, runtime-registration, resolution, error, and contract exports. Its generated server page imports the existing `@holo-js/panels-next/client` entry for the client boundary.
- Vue, Svelte, Nuxt, and SvelteKit keep their existing import paths. Their browser graphs resolve the `browser` conditions above and therefore cannot include Node built-ins or server runtime modules.

The conditional entries are built and packed with the packages. Browser-condition smoke tests fail on any transitive `node:*`, filesystem, database, Holo server-runtime, or server-only Security import. React Server Component acceptance fails if a hook-bearing renderer module enters the server graph. These conditions change distribution only; they do not select a framework at runtime and do not weaken the rule that each adapter depends only on its matching renderer.

## Client-safe schema transport

The current `CompiledSchemaComponent.server.visibility` callback makes `CompiledSchema` a server definition. It must not be passed directly to a browser. The exact client manifest is:

```ts
export interface SchemaComponentManifest {
  readonly children: readonly SchemaComponentManifest[]
  readonly dynamicVisibility: boolean
  readonly extraAttributes: JsonObject
  readonly id: string
  readonly key: string
  readonly kind: SchemaComponentKind
  readonly layout: SchemaLayoutProperties
  readonly properties: SchemaComponentProperties
  readonly slots: SchemaRenderSlots
  readonly statePath?: string
  readonly type: string
  readonly visible: boolean
}

export interface SchemaManifest<TValues = Readonly<Record<string, unknown>>> {
  readonly components: readonly SchemaComponentManifest[]
  readonly id: string
  readonly kind: 'schema'
  readonly statePath?: SchemaPath<TValues>
}

export function toSchemaManifest<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  context: TContext,
): Promise<SchemaManifest<TValues>>
```

`toSchemaManifest` resolves each server visibility callback against the authorized server context, recursively copies the allow-listed manifest fields, freezes the result, validates it with `toJsonValue`, and rejects functions or unknown properties. `dynamicVisibility` remains true when a component has a server visibility resolver so later resolver patches can target it, while `visible` contains the resolved value. The function never serializes `server`, callbacks, source paths, or builder instances.

The page contracts become precise:

```ts
export interface ResolvedPageData<TData extends JsonObject> {
  readonly breadcrumbs: readonly PageBreadcrumb[]
  readonly data: TData
  readonly heading: string | null
  readonly manifest: PageManifest
  readonly schema: SchemaManifest | null
  readonly subheading: string | null
  readonly title: string
}
```

`PageManifest.schemaId` remains unchanged. `PageServerHandles.schema` remains a server-side `CompiledSchema` resolver. Page resolution calls `toSchemaManifest` after authorization and dynamic visibility resolution.

Action modal schemas are corrected from the current untyped `{ fields: JsonValue[] }` transport shape to the shared schema engine:

```ts
export interface ActionModalManifest extends JsonObject {
  readonly content: RenderSlotReference | null
  readonly description: string | null
  readonly footer: RenderSlotReference | null
  readonly heading: string | null
  readonly nestedActions: readonly string[]
  readonly schema: SchemaManifest<JsonObject> | null
  readonly slideOver: boolean
  readonly width: ActionModalWidth
}

export interface ActionDefinition<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
  // existing members remain unchanged
  readonly modal?: ActionModalOptions<ActionContext<TRecord, TActor, TTenant, TServices>>
}

export interface ActionManifest extends JsonObject {
  // existing members remain unchanged
  readonly modal: ActionModalManifest | null
}
```

The existing `ActionDefinition.schema`, `ActionManifest.schema`, and exported `ActionModalSchema` are removed in the same major prerelease change. There is no compatibility shim. `compileActionManifest` resolves the schema through the same safe schema-manifest compiler used by pages.

## Framework schema integration

The three renderer packages consume `SchemaManifest` from `@holo-js/panels-client`; they do not maintain structurally duplicated public schema types.

```ts
export interface SchemaContentRendererProps<TValues extends object = Record<string, unknown>> {
  readonly component: SchemaComponentManifest
  readonly panelId: string
  readonly schema: SchemaManifest<TValues>
}
```

React:

```ts
export interface ReactSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly renderContent?: (props: SchemaContentRendererProps<TValues>) => ReactNode
  readonly schema: SchemaManifest<TValues>
}
```

Vue:

```ts
export interface VueSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly renderContent?: (props: SchemaContentRendererProps<TValues>) => VNodeChild
  readonly schema: SchemaManifest<TValues>
}
```

Svelte:

```ts
export interface SvelteSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: SvelteComponentRegistry
  readonly renderContent?: Snippet<[SchemaContentRendererProps<TValues>]>
  readonly schema: SchemaManifest<TValues>
}
```

`ReactSchemaRenderer`, `VueSchemaRenderer`, and `SchemaRenderer.svelte` render page schemas, resource forms, resource infolists, custom filter schemas, and action modal schemas through these contracts. Field and entry leaves are selected by the containing schema definition, never inferred from a client-provided module or path.

Adapter registry options are additive only where a client component already accepts renderer state:

```ts
export interface NextPanelClientProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly payload: NextPanelPagePayload
  readonly registry?: ComponentRegistry
}

export interface PanelPageProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly page: NuxtPanelPage
  readonly registry?: ComponentRegistry
  readonly resolveResource?: (page: NuxtPanelPageData) => Component | Promise<Component>
}

export interface PanelPageProps {
  readonly data: PanelPageData
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly registry?: SvelteComponentRegistry
}
```

The two `PanelPageProps` declarations above belong to the Nuxt and SvelteKit packages respectively. The SvelteKit declaration already has this shape and is unchanged. Omitting `registry` creates the matching default registry. Generated framework artifacts import plugin and application renderer registrations into that registry before rendering. Missing renderers fail during `holo prepare`; runtime resolution retains a defensive `MissingRendererError` with type ID, panel ID, and requesting definition ID.

## Render slots and hooks

Existing schema-component `.before()`, `.after()`, `.above()`, and `.below()` methods remain unchanged. Existing `PageBuilder.slot()` remains valid and is generalized to accept an ordered reference.

```ts
export interface RenderSlotReference {
  readonly component: string
  readonly order?: number
  readonly properties?: JsonObject
}

export type PanelRenderSlot =
  | 'body-end'
  | 'body-start'
  | 'content-after'
  | 'content-before'
  | 'footer'
  | 'head-end'
  | 'head-start'
  | 'navigation-after'
  | 'navigation-before'
  | 'sidebar-after'
  | 'sidebar-before'
  | 'topbar-after'
  | 'topbar-before'
  | 'user-menu-after'
  | 'user-menu-before'

export type ResourceRenderSlot =
  | 'form-after'
  | 'form-before'
  | 'infolist-after'
  | 'infolist-before'
  | 'table-after'
  | 'table-before'

export type PageRenderSlot = PageLayoutSlot

export interface ScopedRenderSlotManifest extends JsonObject {
  readonly component: string
  readonly order: number
  readonly properties: JsonObject
  readonly source: 'application' | 'panel' | 'plugin' | 'resource' | 'page' | 'component'
}
```

Exact fluent methods:

```ts
PanelBuilder.slot(slot: PanelRenderSlot, reference: string | RenderSlotReference): this

ResourceBuilder.slot(slot: ResourceRenderSlot, reference: string | RenderSlotReference): this

PageBuilder.slot(slot: PageLayoutSlot, reference: string | RenderSlotReference): this

SchemaComponentBuilder.before(reference: string | RenderSlotReference): this
SchemaComponentBuilder.after(reference: string | RenderSlotReference): this
SchemaComponentBuilder.above(reference: string | RenderSlotReference): this
SchemaComponentBuilder.below(reference: string | RenderSlotReference): this
```

Repeated calls append; an exact duplicate from the same source is rejected. Resolution order is ascending `order`, then application, plugin registration order, panel, resource, page, component, then stable component name. Slots are named registered components only. Raw HTML, source strings, file paths, and executable callbacks are not accepted.

## Component defaults

Defaults are server-only builder transformations. They cannot inject client callbacks or change stable IDs, paths, model/query bindings, authorization, tenancy, or persistence.

```ts
export type DefaultableComponentKind =
  | 'action'
  | 'column'
  | 'entry'
  | 'field'
  | 'filter'
  | 'schema-component'
  | 'summary'
  | 'widget'

export interface ComponentDefault<TBuilder extends object = object> {
  readonly apply: (builder: TBuilder) => TBuilder
  readonly kind: DefaultableComponentKind
  readonly type: string
}

export function componentDefault<TBuilder extends object>(
  kind: DefaultableComponentKind,
  type: string,
  apply: (builder: TBuilder) => TBuilder,
): ComponentDefault<TBuilder>

export interface PanelsConfiguration {
  readonly defaults?: readonly ComponentDefault[]
}

export function definePanelsConfig(configuration: PanelsConfiguration): PanelsConfiguration

PanelBuilder.defaults(...defaults: readonly ComponentDefault[]): this
```

Application defaults are exported from the project-root `panels.config.ts` default export. Plugin defaults are contributed by the plugin API below. Precedence is application, then plugin registration order, then panel, then the component's own fluent calls. Each layer receives the immutable result of the preceding layer. A default callback must return the same concrete builder subtype. Defaults are applied once before compilation; applying defaults to an already compiled builder fails.

## Panel plugin contribution API

The existing minimal `PanelPlugin`/`PanelPluginInstallation` contract is extended without changing `PanelBuilder.plugin(plugin)`.

```ts
export interface PanelPackageModuleContribution {
  readonly exportName: string
  readonly id: string
  readonly module: `./${string}`
}

export type PanelPluginContributionDefinition =
  | { readonly definition: DiscoverableDefinition<'cluster'>, readonly kind: 'cluster' }
  | { readonly definition: DiscoverableDefinition<'page'>, readonly kind: 'page' }
  | { readonly definition: DiscoverableDefinition<'resource'>, readonly kind: 'resource' }
  | { readonly definition: DiscoverableDefinition<'widget'>, readonly kind: 'widget' }
  | { readonly kind: 'extension', readonly registration: ExtensionRegistration }
  | { readonly kind: 'renderer', readonly registration: PanelRendererRegistration }
  | { readonly kind: 'translation', readonly registration: PanelTranslationContribution }
  | { readonly kind: 'icon', readonly registration: PanelPluginIcon }
  | { readonly kind: 'asset', readonly registration: PanelPluginAsset }
  | { readonly default: ComponentDefault, readonly kind: 'default' }
  | { readonly kind: 'permission-subject', readonly subject: PanelPermissionSubject }
  | { readonly kind: 'generator-template', readonly template: PanelGeneratorTemplate }
  | { readonly command: PanelPackageModuleContribution, readonly kind: 'cli-command' }
  | { readonly kind: 'migration', readonly migration: PanelPackageModuleContribution }

export type PanelPluginContribution = PanelPluginContributionDefinition['kind']

export interface PanelPluginInstallation<TActor, TTenant = unknown> {
  readonly authorizationLayer: PanelAuthorizationLayer<TActor, TTenant> | null
  readonly contributions: readonly PanelPluginContributionDefinition[]
  readonly id: string
  readonly permissionNamespace: string | null
}

export interface PanelPlugin<TActor, TTenant = unknown> {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
  install(panel: { readonly guard: string, readonly id: string }): PanelPluginInstallation<TActor, TTenant>
}
```

`packageName` is a valid unscoped or scoped npm package name and must equal the package from which discovery imported the plugin. This binds package-relative assets and generated imports to a verified package boundary.

The public immutable plugin builder is:

```ts
export function definePanelPlugin<TActor = unknown, TTenant = unknown>(options: {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
}): PanelPluginBuilder<TActor, TTenant>

export class PanelPluginBuilder<TActor = unknown, TTenant = unknown>
  implements PanelPlugin<TActor, TTenant> {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string

  authorization(layer: PanelAuthorizationLayer<TActor, TTenant>): this
  permissionNamespace(namespace: string | null): this
  resources(...definitions: readonly DiscoverableDefinition<'resource'>[]): this
  pages(...definitions: readonly CompiledPageDefinition<JsonObject, TActor, TTenant, unknown>[]): this
  widgets(...definitions: readonly CompiledWidgetDefinition<JsonValue, TActor, TTenant, unknown>[]): this
  clusters(...definitions: readonly DiscoverableDefinition<'cluster'>[]): this
  extension(registration: ExtensionRegistration): this
  renderer(registration: PanelRendererRegistration): this
  translation(registration: PanelTranslationContribution): this
  icon(registration: PanelPluginIcon): this
  asset(registration: PanelPluginAsset): this
  defaults(...defaults: readonly ComponentDefault[]): this
  permissionSubject(subject: PanelPermissionSubject): this
  generatorTemplate(template: PanelGeneratorTemplate): this
  cliCommand(command: PanelPackageModuleContribution): this
  migration(migration: PanelPackageModuleContribution): this
  install(panel: { readonly guard: string, readonly id: string }): PanelPluginInstallation<TActor, TTenant>
}
```

All methods return the concrete `this` type but become immutable after the first installation. Duplicate contribution IDs within a plugin fail immediately. Cross-plugin conflicts fail during preparation with both package names and source locations.

## Assets and icons

```ts
export type PanelAssetKind = 'font' | 'script' | 'style'

export interface PanelPluginAsset {
  readonly id: string
  readonly kind: PanelAssetKind
  readonly load: 'eager' | 'lazy'
  readonly source: `./${string}`
}

export interface PanelAssetManifest extends JsonObject {
  readonly id: string
  readonly kind: PanelAssetKind
  readonly load: 'eager' | 'lazy'
  readonly publicPath: string
}

export interface PanelPluginIcon {
  readonly definition: PanelIconDefinition
  readonly id: string
}
```

Asset sources are resolved from the verified plugin package root using real paths. Absolute paths, URL schemes, backslashes, empty segments, dot segments, encoded separators, symlink escapes, files outside the package, unsupported extensions, source maps, and files larger than the configured limit are rejected. Styles accept `.css`; scripts accept `.js` or `.mjs`; fonts accept `.woff` or `.woff2`. Preparation fingerprints and copies assets into the framework-managed public artifact root. Only the generated `publicPath` enters the client manifest.

Plugin icon names are rewritten to `{pluginId}.{iconId}` unless the definition already uses that exact name. Core icon replacement is prohibited through plugin contribution. Applications may intentionally replace an icon only through the existing `PanelIconRegistry.register(definition, { replace: true })` API.

## Renderer contributions

Renderer modules are static package-relative imports selected at preparation time, never browser-selected paths.

```ts
export type PanelRendererFramework = 'react' | 'svelte' | 'vue'

export interface PanelRendererRegistration {
  readonly exportName: string
  readonly framework: PanelRendererFramework
  readonly module: `./${string}`
  readonly typeId: ExtensionTypeId
}

export function rendererRegistryName(kind: RegistryKind, typeId: ExtensionTypeId): string
```

`rendererRegistryName` returns `${kind}.${typeId.replaceAll(':', '.')}`. Generated client component modules import only the renderer matching the detected framework. A plugin may omit frameworks it does not support, but preparation fails when an installed panel uses an extension without a renderer for its selected framework.

Each framework receives one common registration function. Existing specialized helpers, including `registerReactEntryRenderer`, `registerReactSchemaRenderer`, `registerVueEntryRenderer`, `registerVueWidgetRenderer`, `registerSvelteEntryRenderer`, and `registerSvelteWidgetRenderer`, remain and delegate to the same naming rule.

```ts
export function registerReactExtensionRenderer<TProps extends object>(
  registry: ComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: ComponentType<TProps>,
  source?: string,
): ComponentRegistry

export function registerVueExtensionRenderer(
  registry: ComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: Component,
  source?: string,
): ComponentRegistry

export function registerSvelteExtensionRenderer<TProps extends Record<string, unknown>>(
  registry: SvelteComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: Component<TProps>,
  source?: string,
): SvelteComponentRegistry
```

The corresponding specialized renderer prop types are exported and contain the client manifest, current panel ID, state-store or execute callback appropriate to the extension kind, and no server handles.

## Custom extension authoring

Existing `createExtensionTypeId(namespace, kind, name)` remains the only type-ID constructor. The literal shape remains `{namespace}:{kind}:{name}`.

Fields gain the missing public builder:

```ts
export interface CustomFieldDefinition<
  TValue,
  TProperties extends JsonObject,
  TContext,
> {
  readonly codec: {
    decode(value: JsonValue): TValue
    encode(value: TValue): JsonValue
  }
  readonly properties: TProperties
  readonly resolveOptions?: (context: TContext) => JsonValue | Promise<JsonValue>
  readonly validate?: (value: TValue, context: TContext) => void | Promise<void>
}

export class CustomFieldBuilder<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TType extends ExtensionTypeId<'field'>,
  TProperties extends JsonObject,
  TRecord = unknown,
> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
  properties(value: TProperties): this
}

export function customField<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TType extends ExtensionTypeId<'field'>,
  TProperties extends JsonObject,
  TContext,
>(
  binding: BoundFormField<TValues, TPath>,
  typeId: TType,
  definition: CustomFieldDefinition<TValue, TProperties, TContext>,
): CustomFieldBuilder<TValues, TPath, TValue, TType, TProperties>

export interface BasicFieldFactory<TSchema extends FormSchema> {
  custom<
    TPath extends FormFieldPath<InferFormData<TSchema>>,
    TValue,
    TType extends ExtensionTypeId<'field'>,
    TProperties extends JsonObject,
    TContext,
  >(
    path: TPath,
    typeId: TType,
    definition: CustomFieldDefinition<TValue, TProperties, TContext>,
  ): CustomFieldBuilder<InferFormData<TSchema>, TPath, TValue, TType, TProperties>
}
```

Columns retain `columnsFor<TRecord>().custom(typeId, path, configuration)`. Entries retain `defineEntry` and `customEntryFrom`. Filters gain a registry-backed form alongside the existing built-in `customFilter`:

```ts
export interface ExtensionFilterOptions<TValue extends JsonValue, TContext> {
  readonly defaultValue: TValue
  readonly encode: FilterEncoder<TValue, TContext>
  readonly properties?: JsonObject
  readonly targets: Readonly<Record<string, TableQueryFilterDefinition>>
}

export function extensionFilter<
  TValue extends JsonValue,
  TType extends ExtensionTypeId<'filter'>,
  TContext = unknown,
>(
  id: string,
  typeId: TType,
  options: ExtensionFilterOptions<TValue, TContext>,
): ExtensionFilterBuilder<TValue, TType, TContext>
```

Actions retain `createCustomAction`, widgets retain `defineCustomWidget`, and pages retain `defineCustomPage`. Registry-rendered variants use these additive overloads and methods:

```ts
export function createCustomAction<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices> & {
    readonly type?: ExtensionTypeId<'action'>
  },
): ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>

export function defineCustomWidget<TActor = unknown, TTenant = unknown, TServices = unknown>(
  id: string,
): WidgetBuilder<CustomWidgetData, TActor, TTenant, TServices>

export function defineCustomWidget<TActor = unknown, TTenant = unknown, TServices = unknown>(
  id: string,
  type: ExtensionTypeId<'widget'>,
): WidgetBuilder<CustomWidgetData, TActor, TTenant, TServices>

PageBuilder.renderer(type: ExtensionTypeId<'page'>, properties?: JsonObject): this
```

Omitting a custom action/widget type or omitting `PageBuilder.renderer()` keeps the built-in generic renderer. `defineCustomPage(id)` retains its existing signature; its second argument is not repurposed. Plugin examples must use the extension-specific type so the missing-renderer checks are exercised.

## Infolist parity additions

Every `EntryBuilder` gains:

```ts
visible(value?: boolean | EntryResolver<TRecord, TValue, boolean>): this
hidden(value?: boolean | EntryResolver<TRecord, TValue, boolean>): this
columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this
columnStart(value: ResponsiveValue<number>): this
extraAttributes(value: Readonly<Record<string, unknown>>): this
before(reference: string | RenderSlotReference): this
after(reference: string | RenderSlotReference): this
above(reference: string | RenderSlotReference): this
below(reference: string | RenderSlotReference): this
```

`EntryManifest` gains `visible`, `dynamicVisibility`, `layout`, `extraAttributes`, and `slots`. Callback visibility remains in `EntryServerHandles` and is resolved before transport.

Safe rich content is explicit:

```ts
TextEntry.markdown(value?: boolean): this
TextEntry.richText(sanitizer: string): this
```

`markdown()` produces sanitized semantic output with raw HTML disabled. `richText()` requires a registered server sanitizer and transports only sanitized structured content. No `unsafeHtml()` API is introduced.

## Action parity additions

Actions gain the following optional definition fields and exact client manifest fields:

```ts
export type ActionSize = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'
export type ActionModalWidth = 'small' | 'medium' | 'large' | 'extra-large' | 'screen'

export interface ActionModalOptions<TContext> {
  readonly content?: RenderSlotReference
  readonly description?: ActionResolvable<TContext, string | null>
  readonly footer?: RenderSlotReference
  readonly heading?: ActionResolvable<TContext, string | null>
  readonly nestedActions?: readonly string[]
  readonly schema?: CompiledSchema<JsonObject, TContext>
  readonly slideOver?: boolean
  readonly width?: ActionModalWidth
}

export interface ActionRateLimit<TContext> {
  readonly key: (context: TContext) => string | Promise<string>
  readonly limit: number
  readonly windowMilliseconds: number
}

export interface ActionPresentationDefinition<TRecord, TActor, TTenant, TServices> {
  readonly badge?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly color?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly icon?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly modal?: ActionModalOptions<ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly rateLimit?: ActionRateLimit<ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly size?: ActionSize
  readonly tooltip?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly type?: ExtensionTypeId<'action'>
}

export interface ActionPresentationManifest extends JsonObject {
  readonly badge: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly modal: ActionModalManifest | null
  readonly size: ActionSize
  readonly tooltip: string | null
  readonly type: string
}
```

`ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>` extends `ActionPresentationDefinition<TRecord, TActor, TTenant, TServices>`. `ActionManifest` extends `ActionPresentationManifest`; all existing members remain unchanged except the modal/schema correction already specified above.

Idempotency remains mandatory for retryable mutation requests. Rate limits execute after authentication, panel/tenant access, and authorization but before transaction start or handler execution.

Action groups are definitions, not a new action kind:

```ts
export interface ActionGroupManifest extends JsonObject {
  readonly actions: readonly string[]
  readonly color: string | null
  readonly icon: string | null
  readonly id: string
  readonly label: string | null
}

export interface ActionGroupItem {
  readonly id: string
}

export function actionGroup(id: string, ...actions: readonly ActionGroupItem[]): ActionGroupBuilder

export class ActionGroupBuilder {
  label(value: string | null): this
  icon(value: string | null): this
  color(value: string | null): this
  compile(): ActionGroupManifest
}
```

Groups reference existing stable action IDs and do not weaken individual action authorization.

## Singular, nested, and configured registrations

The existing immutable `ResourceBuilder.configured(id, configure)` remains the resource variant API. Page variants gain the same semantics:

```ts
PageBuilder.configured(
  id: string,
  configure: (page: PageBuilder<TData, TActor, TTenant, TServices>) => PageBuilder<TData, TActor, TTenant, TServices>,
): PageBuilder<TData, TActor, TTenant, TServices>
```

The callback receives an immutable clone with the new ID and must return that variant. It cannot mutate or reuse the original compiled definition. Each configured resource/page registration has its own route, component IDs, navigation key, permission namespace, cache key, and source diagnostic.

Singular resources use a server resolver and omit a client record ID:

```ts
export interface SingularResourceOptions<TRecord, TQuery, TActor extends object, TTenant> {
  readonly resolve: (
    query: TQuery,
    context: ResourceExecutionContext<TActor, TTenant>,
  ) => Promise<TRecord | null>
}

ResourceBuilder.singular(
  options: SingularResourceOptions<TRecord, TQuery, TActor, TTenant>,
): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>
```

List and create pages are rejected for a singular resource. View/edit/delete operations resolve through `resolve` after base, tenant, Shield, and policy scopes. A missing record is 404.

Nested resources require a typed parent definition and a mandatory child scope:

```ts
export interface ResourceParentReference<TParentRecord extends ResourceRecord> {
  readonly id: string
  readonly routeKey: ResourceAttribute<TParentRecord>
}

export interface NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor extends object, TTenant> {
  readonly parameter?: string
  readonly relationship: string
  readonly scope: (
    query: TQuery,
    parent: TParentRecord,
    context: ResourceExecutionContext<TActor, TTenant>,
  ) => TQuery
}

ResourceBuilder.nestedUnder<TParentRecord extends ResourceRecord>(
  parent: ResourceParentReference<TParentRecord>,
  options: NestedResourceOptions<
    TParentRecord,
    TRecord,
    TQuery,
    TActor,
    TTenant
  >,
): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>
```

`parameter` defaults to the parent resource ID with `-record` suffix. Parent resolution is delegated to the prepared parent resource registry; browser input cannot choose the parent resource, relationship, query, or route key. The parent is authorized and tenant-scoped before `scope` is applied. Every child record lookup, relation lookup, aggregate, action, import, export, and global-search URL uses the nested scope. Guessed parent/child combinations return 404.

`singular()` and `nestedUnder()` are mutually exclusive in the initial release.

## Translation, permission, and generator-template contributions

```ts
export interface PanelTranslationContribution {
  readonly catalog: Readonly<Record<string, string>>
  readonly locale: string
  readonly namespace: string
}

export interface PanelPermissionSubject {
  readonly id: string
  readonly operations: readonly string[]
  readonly subject: 'action' | 'page' | 'resource' | 'widget'
}

export interface PanelGeneratorTemplate {
  readonly exportName: string
  readonly generator: 'action' | 'column' | 'entry' | 'field' | 'filter' | 'page' | 'resource' | 'widget'
  readonly module: `./${string}`
}
```

Translations use deterministic application-over-plugin precedence and cannot replace another plugin namespace. Permission subjects are discovery metadata only; server authorization remains mandatory. Generator templates are imported only by the CLI from the verified plugin package and may write only through the existing managed generator boundary.

## Required sample plugin

Phase P16 publishes the workspace fixture package `@holo-js/panels-plugin-money`. Its exact public exports are:

```ts
export const moneyPlugin: PanelPlugin

export interface CurrencyFieldProperties extends JsonObject {
  readonly currency: string
  readonly minorUnits: number
}

export interface MoneyColumnProperties extends JsonObject {
  readonly currency: string
  readonly locale: string | null
}

export function currencyField<TValues, TPath extends FormFieldPathFor<TValues, number>>(
  binding: BoundFormField<TValues, TPath>,
  currency: string,
): CustomFieldBuilder<
  TValues,
  TPath,
  number,
  ExtensionTypeId<'field'>,
  CurrencyFieldProperties
>

export function moneyColumn<TRecord, TPath extends RecordPathFor<TRecord, number>>(
  columns: ColumnFactory<TRecord>,
  path: TPath,
  currency: string,
): CustomColumn<TRecord, TPath, ExtensionTypeId<'column'>>
```

`columnsFor(Post)` infers `TRecord` from the supplied model constructor and is the required public form for application code. Passing the resulting factory into `moneyColumn()` preserves the exact record and path types without a manual generic. The legacy type-only `columnsFor<TRecord>()` overload remains temporarily for internal prerelease tests but is not documented or generated for users.

The package exports `./react`, `./vue`, and `./svelte` renderer subpaths and registers the exact IDs `holo.money:field:currency` and `holo.money:column:money`. It contributes translations, an icon, a stylesheet asset, component defaults, and renderer metadata. It has no dependency on Holo Panels internals and passes the public plugin contract suite from its packed tarball in all three clean framework fixtures.

The remaining required examples live under `examples/plugins/` and cover custom field, column, entry, filter, action, widget, page, and a full panel plugin. They import only published public subpaths and are compiled in packed-package tests.

## Preparation and compatibility rules

Preparation performs these checks before generating a client registry:

1. Validate plugin compatibility against the protocol and Holo Panels package version.
2. Verify the discovered package name and every package-relative module or asset path.
3. Register extension definitions and reject duplicate type IDs.
4. Apply application, plugin, and panel defaults, then compile local definitions.
5. Resolve configured variants and singular/nested route ordering.
6. Collect render slots, translations, icons, permissions, and framework-specific renderers.
7. Fail for missing renderers in the detected framework.
8. Emit client-safe schema, asset, icon, slot, and renderer manifests with no callbacks or local paths.

Plugin assets, renderer modules, migrations, and CLI commands remain separate contribution categories. A panel plugin cannot cause a browser to import a module named by client input. A plugin cannot replace core authorization, tenant scoping, Holo policy checks, invariant checks, upload rules, or private-download rules.

## Explicitly deferred or unchanged

- The UI publishing and synchronization command is governed exclusively by `plans/p16-cli-public-api-proposal.md`.
- The P15 import/export builders remain governed by `plans/p15-public-api-proposal.md`; P16 only supplies action/render/plugin integration for them.
- Existing built-in fields, columns, filters, layouts, summaries, entries, and renderers retain their public names. P16 completes missing observable behavior and parity tests without renaming them.
- No Holo-JS public API change is required by this proposal. Static plugin package files are discovered through the already approved Holo project-preparation contribution and existing Holo plugin metadata.
- Arbitrary raw HTML rendering, runtime package-path selection, runtime filesystem discovery, global authorization bypass, and renderer `eval` are not proposed.

## Approval boundary

Approval of this document authorizes implementation and export of exactly the APIs and behavior above. It does not approve additional public names, compatibility shims, new Holo-JS APIs, or changes to the canonical Phase P16 checklist before validation evidence exists.
