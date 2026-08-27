import { DISCOVERY_MARKER } from '../discovery/types'
import { collectInfolistActions } from './infolist-actions'
import type { ClientManifestValue, DiscoverableBuilder, DiscoveryDirectories } from '../discovery/types'
import { actionPermissionReferences, createResourceActionComposer, type ResourceActionComposer } from '../actions'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import type { JsonObject } from '../protocol/json'
import type {
  CompiledNestedResource,
  NestedResourceOptions,
  ResourceAttribute,
  ResourceAttributes,
  ResourceCompositionTypes,
  ResourceDefinition,
  ResourceExecutionContext,
  ResourceGlobalSearch,
  ResourceLifecycle,
  ResourceInput,
  ResourceModel,
  ResourceNavigation,
  ResourcePersistence,
  ResourceParentReference,
  ResourceQuery,
  ResourceRecord,
  ResourceRecordFor,
  ResourceModelDefinition,
  ResourceValidation,
  SingularResourceOptions,
} from './contracts'

interface ResourceBuilderState<TModel, TRecord, TQuery, TInput extends Readonly<Record<string, unknown>>, TActor extends object, TTenant, TSoftDeletes extends boolean> {
  readonly actions: readonly ResourceActionDefinition[]
  readonly baseQuery: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery
  readonly createBindings?: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>
  readonly discover?: Readonly<DiscoveryDirectories>
  readonly form?: object
  readonly globalSearch?: ResourceGlobalSearch<TRecord>
  readonly id: string
  readonly infolist?: object
  readonly lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>
  readonly model: TModel
  readonly navigation: ResourceNavigation
  readonly nested: CompiledNestedResource<ResourceRecord, TRecord, TQuery, TActor, TTenant> | null
  readonly pages: readonly object[]
  readonly persistence?: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>
  readonly recordTitle: ResourceAttribute<TRecord>
  readonly readOnly: boolean
  readonly relations: readonly object[]
  readonly routeKey: ResourceAttribute<TRecord>
  readonly shared: boolean
  readonly singular: SingularResourceOptions<TRecord, TQuery, TActor, TTenant> | null
  readonly slug: string
  readonly softDeletes: TSoftDeletes
  readonly table?: object
  readonly tenantScope?: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery
  readonly validation?: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>
  readonly widgets: readonly object[]
  readonly writableAttributes: readonly ResourceAttribute<TRecord>[]
}

type CompactValueKind = 'boolean' | 'date-time' | 'number' | 'text'

interface CompactComponentDescriptor<TKey extends string = string, TValueKind extends CompactValueKind = CompactValueKind> {
  readonly key: TKey
  readonly valueKind: TValueKind
}

interface ResourceRecordComposition<TRecord> {
  readonly resourceRecordType: TRecord
}

interface ResourceActionDefinition {
  readonly id: string
  readonly kind: string
  readonly mount?: 'bulk' | 'modal' | 'notification' | 'page' | 'record'
  readonly source?: string
}

type ContextTypeCompatible<TActual, TExpected> = unknown extends TActual ? true : TActual extends TExpected ? true : false

type CheckedResourceComposition<TRecord, TActor, TTenant, TComposition, TRecordMode extends 'ignore' | 'owner' | 'record'> =
  TComposition extends { readonly resourceCompositionTypes: ResourceCompositionTypes<infer TCompositionRecord, infer TCompositionActor, infer TCompositionTenant, infer _TServices> }
    ? ContextTypeCompatible<TCompositionActor, TActor> extends true
      ? ContextTypeCompatible<TCompositionTenant, TTenant> extends true
        ? TRecordMode extends 'ignore' ? TComposition
          : TRecordMode extends 'owner'
            ? TRecord extends TCompositionRecord ? TComposition : never
            : TRecord extends TCompositionRecord ? TComposition : never
        : never
      : never
    : TRecordMode extends 'owner'
      ? TComposition extends { readonly kind: 'relation-manager', readonly resourceRecordType: infer TCompositionRecord }
        ? TRecord extends TCompositionRecord ? TComposition : never
        : never
    : never

type CheckedResourceCompositions<TRecord, TActor, TTenant, TCompositions extends readonly object[], TRecordMode extends 'ignore' | 'owner' | 'record'> = {
  readonly [TIndex in keyof TCompositions]: CheckedResourceComposition<TRecord, TActor, TTenant, TCompositions[TIndex], TRecordMode>
}

interface CompilableResourceAction {
  compile(): ResourceActionDefinition
}

type CompactDescriptorValue<TValueKind extends CompactValueKind> =
  TValueKind extends 'boolean' ? boolean
    : TValueKind extends 'number' ? number
      : TValueKind extends 'date-time' ? Date
        : string

type CheckedCompactDescriptor<TRecord, TDescriptor> =
  TDescriptor extends CompactComponentDescriptor<infer TKey, infer TValueKind>
    ? TKey extends ResourceAttribute<TRecord>
      ? NonNullable<ResourceAttributes<TRecord>[TKey]> extends CompactDescriptorValue<TValueKind> ? TDescriptor : never
      : never
    : never

type CheckedCompactComposition<TRecord, TComposition> =
  TComposition extends readonly CompactComponentDescriptor[]
    ? { readonly [TIndex in keyof TComposition]: CheckedCompactDescriptor<TRecord, TComposition[TIndex]> }
    : TComposition

type CheckedRecordComposition<TRecord, TComposition> =
  TComposition extends ResourceRecordComposition<infer TCompositionRecord>
    ? TCompositionRecord extends TRecord
      ? TComposition
      : TCompositionRecord extends Partial<ResourceAttributes<TRecord>> ? TComposition : never
    : never

type CheckedRecordCompositions<TRecord, TCompositions extends readonly ResourceRecordComposition<object>[]> = {
  readonly [TIndex in keyof TCompositions]: CheckedRecordComposition<TRecord, TCompositions[TIndex]>
}

function slugify(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').replaceAll('_', '-').toLowerCase()
}

function pluralize(value: string): string {
  if (value.endsWith('s')) return value
  if (value.endsWith('y') && !/[aeiou]y$/u.test(value)) return value.slice(0, -1) + 'ies'
  return value + 's'
}

function assertIdentifier(value: string, subject: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) throw new Error(`[Holo Panels] Invalid ${subject} "${value}".`)
}

function normalizeDiscoveryPath(path: string): string {
  const normalized = path.trim().replace(/^\.\//u, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('[Holo Panels] Resource discovery directories must be resource-relative.')
  }
  return normalized
}

function compileResourceComposition(value: object | undefined): object | undefined {
  if (!value || !('compile' in value) || typeof value.compile !== 'function') return value
  const compiled: unknown = value.compile()
  if (typeof compiled !== 'object' || compiled === null) throw new TypeError('[Holo Panels] Resource compositions must compile to objects.')
  return compiled
}

function widgetPermissionReferences(widgets: readonly object[]): readonly string[] {
  return widgets.flatMap((widget) => {
    const compiled = compileResourceComposition(widget)
    if (!compiled) return []
    const manifest = Reflect.get(compiled, 'manifest')
    const server = Reflect.get(compiled, 'server')
    const id = manifest && typeof manifest === 'object' ? Reflect.get(manifest, 'id') : undefined
    const actions = server && typeof server === 'object' ? Reflect.get(server, 'actions') : undefined
    return typeof id === 'string' ? [`widgets.${id}.view`, ...(Array.isArray(actions) ? actions.map(action => `actions.${Reflect.get(action, 'id')}.view`) : [])] : []
  })
}

function protectedAttributes(model: { readonly definition: ResourceModelDefinition }): ReadonlySet<string> {
  return new Set([...(model.definition.guarded ?? []), ...(model.definition.hidden ?? [])])
}

function assertExposedAttribute(model: { readonly definition: ResourceModelDefinition }, attribute: string, subject: string): void {
  const hidden = model.definition.hidden ?? []
  if (hidden.includes('*') || hidden.includes(attribute)) {
    throw new Error(`[Holo Panels] Hidden attribute "${attribute}" cannot be used as ${subject}.`)
  }
}

function assertWritableAttributes(model: { readonly definition: ResourceModelDefinition }, attributes: readonly string[]): void {
  const guarded = model.definition.guarded ?? []
  const hidden = model.definition.hidden ?? []
  const protectedSet = protectedAttributes(model)
  for (const attribute of attributes) {
    if (guarded.includes('*') || hidden.includes('*') || protectedSet.has(attribute)) {
      throw new Error(`[Holo Panels] Guarded or hidden attribute "${attribute}" cannot be writable.`)
    }
  }
}

function inferWritableAttributes<TRecord>(model: { readonly definition: ResourceModel<never, never>['definition'] }): readonly ResourceAttribute<TRecord>[] {
  const guarded = model.definition.guarded ?? []
  if (guarded.includes('*') || (model.definition.hidden ?? []).includes('*')) return []
  const protectedSet = protectedAttributes(model)
  const fillable = model.definition.fillable ?? []
  const columns = Object.keys(model.definition.table?.columns ?? {})
  const candidates = fillable.includes('*') ? columns : fillable
  return candidates.filter(attribute => !protectedSet.has(attribute) && attribute !== '*') as ResourceAttribute<TRecord>[]
}

function cloneState<TState extends object>(state: TState, patch: Partial<TState>): TState {
  return { ...state, ...patch }
}

function pageType(page: object): unknown {
  const manifest = Reflect.get(page, 'manifest')
  if (typeof manifest === 'object' && manifest !== null) return Reflect.get(manifest, 'pageType')
  return Reflect.get(page, 'pageType')
}

function assertSingularPages(pages: readonly object[]): void {
  if (pages.some(page => pageType(page) === 'list' || pageType(page) === 'create')) {
    throw new Error('[Holo Panels] Singular resources cannot register list or create pages.')
  }
}

export class ResourceBuilder<
  TModel extends { readonly definition: ResourceModelDefinition },
  TRecord extends ResourceRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>> = ResourceInput<TRecord>,
  TActor extends object = object,
  TTenant = unknown,
  TSoftDeletes extends boolean = boolean,
> implements DiscoverableBuilder<'resource'> {
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'resource' as const
  readonly #state: ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>

  constructor(model: TModel, state?: ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>) {
    const modelName = model.definition.name
    const id = pluralize(slugify(modelName))
    this.#state = state ?? {
      actions: [],
      baseQuery: query => query,
      id,
      lifecycle: {},
      model,
      navigation: {},
      nested: null,
      pages: [],
      recordTitle: model.definition.primaryKey as ResourceAttribute<TRecord>,
      readOnly: false,
      relations: [],
      routeKey: model.definition.primaryKey as ResourceAttribute<TRecord>,
      shared: false,
      singular: null,
      slug: id,
      softDeletes: model.definition.softDeletes as TSoftDeletes,
      widgets: [],
      writableAttributes: inferWritableAttributes<TRecord>(model),
    }
  }

  get id(): string {
    return this.#state.id
  }

  actions(
    configure: (actions: ResourceActionComposer<TRecord, TInput & JsonObject, TActor, TTenant, unknown>) => readonly CompilableResourceAction[],
  ): this {
    const definitions = configure(createResourceActionComposer()).map(action => action.compile())
    return this.with({ actions: [...this.#state.actions, ...definitions] })
  }

  baseQuery(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): this {
    return this.with({ baseQuery: scope })
  }

  configured(id: string, configure: (resource: this) => this): this {
    const normalized = id.trim()
    assertIdentifier(normalized, 'configured resource variant ID')
    const configured = configure(this.with({ id: normalized }))
    if (configured.id !== normalized) throw new Error('[Holo Panels] Configured resource callbacks must return the configured variant.')
    return configured
  }

  form<const TForm extends readonly CompactComponentDescriptor[]>(
    form: TForm,
    ..._validation: TForm extends CheckedCompactComposition<TRecord, TForm> ? [] : [error: never]
  ): this
  form<TForm extends ResourceRecordComposition<object>>(form: CheckedRecordComposition<TRecord, TForm>): this
  form<const TFields extends readonly ResourceRecordComposition<object>[]>(
    form: TFields extends CheckedRecordCompositions<TRecord, TFields> ? TFields : CheckedRecordCompositions<TRecord, TFields>,
  ): this
  form(form: object): this {
    return this.with({ form })
  }

  globalSearch(metadata: ResourceGlobalSearch<TRecord>): this {
    if (metadata.attributes.length === 0) throw new Error('[Holo Panels] Global search requires at least one searchable attribute.')
    if (metadata.limit !== undefined && (!Number.isSafeInteger(metadata.limit) || metadata.limit < 1 || metadata.limit > 100)) {
      throw new Error('[Holo Panels] Global search limits must be integers from 1 to 100.')
    }
    assertExposedAttribute(this.#state.model, metadata.title, 'the global search title')
    for (const attribute of metadata.attributes) assertExposedAttribute(this.#state.model, attribute, 'a global search attribute')
    for (const attribute of metadata.details ?? []) assertExposedAttribute(this.#state.model, attribute, 'a global search detail')
    return this.with({ globalSearch: { ...metadata, attributes: [...metadata.attributes], details: metadata.details ? [...metadata.details] : undefined } })
  }

  infolist<TInfolist extends ResourceRecordComposition<object>>(infolist: CheckedRecordComposition<TRecord, TInfolist>): this
  infolist<const TEntries extends readonly ResourceRecordComposition<object>[]>(
    infolist: TEntries extends CheckedRecordCompositions<TRecord, TEntries> ? TEntries : CheckedRecordCompositions<TRecord, TEntries>,
  ): this
  infolist(infolist: object): this {
    return this.with({ infolist })
  }

  createBindings(bindings: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>): this {
    return this.with({ createBindings: bindings })
  }

  discoverPages(path = 'pages'): this {
    return this.withDiscovery('pages', path)
  }

  discoverRelationManagers(path = 'relation-managers'): this {
    return this.withDiscovery('relationManagers', path)
  }

  discoverWidgets(path = 'widgets'): this {
    return this.withDiscovery('widgets', path)
  }

  lifecycle(lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>): this {
    return this.with({ lifecycle })
  }

  navigation(navigation: ResourceNavigation): this {
    return this.with({ navigation: { ...navigation } })
  }

  navigationIcon(icon: string): this {
    return this.with({ navigation: { ...this.#state.navigation, icon } })
  }

  navigationLabel(label: string): this {
    return this.with({ navigation: { ...this.#state.navigation, label } })
  }

  pages<const TPages extends readonly object[]>(
    ...pages: TPages extends CheckedResourceCompositions<TRecord, TActor, TTenant, TPages, 'ignore'> ? TPages : CheckedResourceCompositions<TRecord, TActor, TTenant, TPages, 'ignore'>
  ): this {
    if (this.#state.singular !== null) assertSingularPages(pages)
    return this.with({ pages: [...this.#state.pages, ...pages] })
  }

  singular(
    options: SingularResourceOptions<TRecord, TQuery, TActor, TTenant>,
  ): this {
    if (this.#state.nested !== null) throw new Error('[Holo Panels] Singular and nested resources are mutually exclusive.')
    if (typeof options.resolve !== 'function') throw new TypeError('[Holo Panels] Singular resources require a resolver.')
    assertSingularPages(this.#state.pages)
    return this.with({ singular: Object.freeze({ resolve: options.resolve }) })
  }

  nestedUnder<
    TParentModel extends { readonly definition: ResourceModelDefinition },
    TParentRecord extends ResourceRecord,
    TParentQuery,
    TParentInput extends Readonly<Record<string, unknown>>,
    TParentActor extends object,
    TParentTenant,
    TParentSoftDeletes extends boolean,
  >(
    parent: ResourceBuilder<TParentModel, TParentRecord, TParentQuery, TParentInput, TParentActor, TParentTenant, TParentSoftDeletes>,
    options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>,
  ): this

  nestedUnder<TParentRecord extends ResourceRecord>(
    parent: ResourceParentReference<TParentRecord>,
    options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>,
  ): this

  nestedUnder<TParentRecord extends ResourceRecord>(
    parent: ResourceParentReference<TParentRecord> | {
      readonly id: string
      compile(): { readonly routeKey: string }
    },
    options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>,
  ): this {
    if (this.#state.singular !== null) throw new Error('[Holo Panels] Singular and nested resources are mutually exclusive.')
    const parentReference = 'compile' in parent
      ? { id: parent.id, routeKey: parent.compile().routeKey as ResourceAttribute<TParentRecord> }
      : parent
    assertIdentifier(parentReference.id, 'parent resource ID')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(options.relationship)) {
      throw new Error('[Holo Panels] Nested resource relationships require a stable relation name.')
    }
    if (typeof options.scope !== 'function') throw new TypeError('[Holo Panels] Nested resources require a child scope.')
    const parameter = options.parameter ?? `${parentReference.id}-record`
    assertIdentifier(parameter, 'nested resource parameter')
    const nested: CompiledNestedResource<TParentRecord, TRecord, TQuery, TActor, TTenant> = Object.freeze({
      options: Object.freeze({ ...options, parameter }),
      parent: Object.freeze({ ...parentReference }),
    })
    return this.with({ nested: nested as CompiledNestedResource<ResourceRecord, TRecord, TQuery, TActor, TTenant> })
  }

  persistence(persistence: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>): this {
    return this.with({ persistence })
  }

  recordTitle<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): this {
    assertExposedAttribute(this.#state.model, attribute, 'the record title')
    return this.with({ recordTitle: attribute })
  }

  readOnly(): this {
    return this.with({ readOnly: true, writableAttributes: [] })
  }

  relations<const TRelations extends readonly object[]>(
    ...relations: TRelations extends CheckedResourceCompositions<TRecord, TActor, TTenant, TRelations, 'owner'> ? TRelations : CheckedResourceCompositions<TRecord, TActor, TTenant, TRelations, 'owner'>
  ): this {
    return this.with({ relations: [...this.#state.relations, ...relations] })
  }

  routeKey<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): this {
    assertExposedAttribute(this.#state.model, attribute, 'the route key')
    return this.with({ routeKey: attribute })
  }

  shared(value = true): this {
    return this.with({ shared: value, tenantScope: value ? undefined : this.#state.tenantScope })
  }

  slug(slug: string): this {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error(`[Holo Panels] Invalid resource slug "${slug}".`)
    return this.with({ slug })
  }

  table<const TTable extends readonly CompactComponentDescriptor[]>(
    table: TTable,
    ..._validation: TTable extends CheckedCompactComposition<TRecord, TTable> ? [] : [error: never]
  ): this
  table<TTable extends ResourceRecordComposition<object>>(table: CheckedRecordComposition<TRecord, TTable>): this
  table<const TColumns extends readonly ResourceRecordComposition<object>[]>(
    table: TColumns extends CheckedRecordCompositions<TRecord, TColumns> ? TColumns : CheckedRecordCompositions<TRecord, TColumns>,
  ): this
  table(table: object): this {
    return this.with({ table })
  }

  tenantScope(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): this
  tenantScope<TNextTenant>(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TNextTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>
  tenantScope<TNextTenant>(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TNextTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes> {
    const state = this.#state as unknown as ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>
    const Builder = this.constructor as new (
      model: TModel,
      nextState: ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>,
    ) => ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>
    return new Builder(this.#state.model, cloneState(state, { shared: false, tenantScope: scope }))
  }

  validation(validation: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>): this {
    return this.with({ validation })
  }

  widgets<const TWidgets extends readonly object[]>(
    ...widgets: TWidgets extends CheckedResourceCompositions<TRecord, TActor, TTenant, TWidgets, 'record'> ? TWidgets : CheckedResourceCompositions<TRecord, TActor, TTenant, TWidgets, 'record'>
  ): this {
    return this.with({ widgets: [...this.#state.widgets, ...widgets] })
  }

  writableAttributes<const TAttributes extends readonly ResourceAttribute<TRecord>[]>(attributes: TAttributes): this {
    assertWritableAttributes(this.#state.model, attributes)
    return this.with({ readOnly: false, writableAttributes: [...attributes] })
  }

  compile(): ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    assertIdentifier(this.id, 'resource ID')
    if (!this.#state.readOnly && this.#state.writableAttributes.length === 0) {
      throw new Error(`[Holo Panels] Resource "${this.id}" must allow-list writable attributes.`)
    }
    assertWritableAttributes(this.#state.model, this.#state.writableAttributes)
    assertExposedAttribute(this.#state.model, this.#state.recordTitle, 'the record title')
    assertExposedAttribute(this.#state.model, this.#state.routeKey, 'the route key')
    const capabilities = Object.freeze({ delete: !this.#state.readOnly, forceDelete: this.#state.softDeletes, restore: this.#state.softDeletes })
    const componentKeys = [
      ...(this.#state.form ? [`${this.id}.form`] : []),
      ...(this.#state.infolist ? [`${this.id}.infolist`] : []),
      ...(this.#state.table ? [`${this.id}.table`] : []),
    ]
    const navigation = Object.freeze(Object.fromEntries(
      Object.entries(this.#state.navigation).filter((entry): entry is [string, ClientManifestValue] => entry[1] !== undefined),
    ))
    const client = Object.freeze({
      capabilities,
      globalSearch: this.#state.globalSearch ? true : false,
      navigation,
      recordTitle: this.#state.recordTitle,
      routeKey: this.#state.routeKey,
      slug: this.#state.slug,
      softDeletes: this.#state.softDeletes,
    })
    const form = compileResourceComposition(this.#state.form)
    const infolist = compileResourceComposition(this.#state.infolist)
    const table = compileResourceComposition(this.#state.table)
    const actions = Object.freeze([...this.#state.actions, ...collectInfolistActions<TRecord>(this.#state.infolist)])
    return Object.freeze({
      ...this.#state,
      ...(form ? { form } : {}),
      ...(infolist ? { infolist } : {}),
      ...(table ? { table } : {}),
      actions,
      permissionReferences: [...new Set([...actionPermissionReferences(actions), ...widgetPermissionReferences(this.#state.widgets)])],
      capabilities,
      client,
      componentKeys: Object.freeze(componentKeys),
      discoveryMarker: DISCOVERY_MARKER,
      lifecycle: Object.freeze({ ...this.#state.lifecycle }),
      kind: 'resource',
      navigation: this.#state.navigation,
      pages: Object.freeze([...this.#state.pages]),
      relations: Object.freeze([...this.#state.relations]),
      widgets: Object.freeze([...this.#state.widgets]),
      writableAttributes: Object.freeze([...this.#state.writableAttributes]),
    })
  }

  compileDiscoveryDefinition(): ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.compile()
  }

  private with(patch: Partial<ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>>): this {
    const Builder = this.constructor as new (
      model: TModel,
      state: ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>,
    ) => this
    return new Builder(this.#state.model, cloneState(this.#state, patch))
  }

  private withDiscovery(key: keyof DiscoveryDirectories, path: string): this {
    return this.with({ discover: { ...this.#state.discover, [key]: normalizeDiscoveryPath(path) } })
  }
}

type InferredSoftDeletes<TModel extends { readonly definition: { readonly softDeletes: boolean } }> = TModel['definition']['softDeletes'] extends true ? true : false

type InferredRecord<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = Awaited<ReturnType<TModel['create']>>
type InferredQuery<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = ReturnType<TModel['query']>

export interface ResourceContextTypeSources<
  TActorSource extends RecordTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
> {
  readonly actor?: TActorSource
  readonly tenant?: TTenantSource
}

type ResourceActorValue<TActorSource extends RecordTypeSource | undefined> =
  TActorSource extends RecordTypeSource ? Extract<RuntimeTypeValue<TActorSource>, object> : object

type PublicResourceRecord<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> =
  [ResourceRecordFor<TModel>] extends [never]
    ? InferredRecord<TModel>
    : Extract<ResourceRecordFor<TModel>, ResourceRecord>

type PublicResourceModel<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = ResourceModel<
  PublicResourceRecord<TModel>,
  InferredQuery<TModel>
>

export type InferredResourceBuilder<
  TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>,
  TActor extends object = object,
  TTenant = unknown,
> = ResourceBuilder<
  PublicResourceModel<TModel>,
  PublicResourceRecord<TModel>,
  InferredQuery<TModel>,
  ResourceInput<PublicResourceRecord<TModel>>,
  TActor,
  TTenant,
  InferredSoftDeletes<TModel>
>

type ResourceFactory = {
  <
    TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>,
    TActorSource extends RecordTypeSource | undefined = undefined,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
  >(
    model: TModel,
    sources: ResourceContextTypeSources<TActorSource, TTenantSource>,
  ): InferredResourceBuilder<TModel, ResourceActorValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>>
  <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>>(model: TModel): InferredResourceBuilder<TModel>
}

function createResource<
  TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>,
  TActor extends object = object,
  TTenant = unknown,
>(model: TModel): InferredResourceBuilder<TModel, TActor, TTenant> {
  return new ResourceBuilder<
    PublicResourceModel<TModel>,
    PublicResourceRecord<TModel>,
    InferredQuery<TModel>,
    ResourceInput<PublicResourceRecord<TModel>>,
    TActor,
    TTenant,
    InferredSoftDeletes<TModel>
  >(model as unknown as PublicResourceModel<TModel>)
}

export const defineResource: ResourceFactory = createResource
