import { DISCOVERY_MARKER } from '../discovery/types'
import type { ClientManifestValue, DiscoverableBuilder, DiscoveryDirectories } from '../discovery/types'
import { appendScopedRenderSlot, type ResourceRenderSlot, type ScopedRenderSlots } from '../panels/render-slots'
import type { RenderSlotReference } from '../schemas/contracts'
import type { OptionalRuntimeTypeValue, RuntimeTypeSource } from '../inference/type-source'
import type {
  CompiledNestedResource,
  NestedResourceOptions,
  ResourceAttribute,
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
  readonly slots: ScopedRenderSlots<ResourceRenderSlot>
  readonly table?: object
  readonly tenantScope?: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery
  readonly validation?: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>
  readonly widgets: readonly object[]
  readonly writableAttributes: readonly ResourceAttribute<TRecord>[]
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
      slots: {},
      widgets: [],
      writableAttributes: inferWritableAttributes<TRecord>(model),
    }
  }

  get id(): string {
    return this.#state.id
  }

  baseQuery(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ baseQuery: scope })
  }

  configured(id: string, configure: (resource: ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>) => ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    const normalized = id.trim()
    assertIdentifier(normalized, 'configured resource variant ID')
    const configured = configure(this.with({ id: normalized }))
    if (configured.id !== normalized) throw new Error('[Holo Panels] Configured resource callbacks must return the configured variant.')
    return configured
  }

  form<TForm extends object>(form: TForm): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ form })
  }

  globalSearch(metadata: ResourceGlobalSearch<TRecord>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    if (metadata.attributes.length === 0) throw new Error('[Holo Panels] Global search requires at least one searchable attribute.')
    if (metadata.limit !== undefined && (!Number.isSafeInteger(metadata.limit) || metadata.limit < 1 || metadata.limit > 100)) {
      throw new Error('[Holo Panels] Global search limits must be integers from 1 to 100.')
    }
    assertExposedAttribute(this.#state.model, metadata.title, 'the global search title')
    for (const attribute of metadata.attributes) assertExposedAttribute(this.#state.model, attribute, 'a global search attribute')
    for (const attribute of metadata.details ?? []) assertExposedAttribute(this.#state.model, attribute, 'a global search detail')
    return this.with({ globalSearch: { ...metadata, attributes: [...metadata.attributes], details: metadata.details ? [...metadata.details] : undefined } })
  }

  infolist<TInfolist extends object>(infolist: TInfolist): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ infolist })
  }

  createBindings(bindings: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ createBindings: bindings })
  }

  discoverPages(path = 'pages'): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.withDiscovery('pages', path)
  }

  discoverRelationManagers(path = 'relation-managers'): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.withDiscovery('relationManagers', path)
  }

  discoverWidgets(path = 'widgets'): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.withDiscovery('widgets', path)
  }

  lifecycle(lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ lifecycle })
  }

  navigation(navigation: ResourceNavigation): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ navigation: { ...navigation } })
  }

  navigationIcon(icon: string): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ navigation: { ...this.#state.navigation, icon } })
  }

  navigationLabel(label: string): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ navigation: { ...this.#state.navigation, label } })
  }

  pages(...pages: readonly object[]): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    if (this.#state.singular !== null) assertSingularPages(pages)
    return this.with({ pages: [...this.#state.pages, ...pages] })
  }

  singular(
    options: SingularResourceOptions<TRecord, TQuery, TActor, TTenant>,
  ): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
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
  ): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>

  nestedUnder<TParentRecord extends ResourceRecord>(
    parent: ResourceParentReference<TParentRecord>,
    options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>,
  ): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>

  nestedUnder<TParentRecord extends ResourceRecord>(
    parent: ResourceParentReference<TParentRecord> | {
      readonly id: string
      compile(): { readonly routeKey: string }
    },
    options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>,
  ): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
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

  slot(
    slot: ResourceRenderSlot,
    reference: string | RenderSlotReference,
  ): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ slots: appendScopedRenderSlot(this.#state.slots, slot, reference, 'resource') })
  }

  persistence(persistence: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ persistence })
  }

  recordTitle<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    assertExposedAttribute(this.#state.model, attribute, 'the record title')
    return this.with({ recordTitle: attribute })
  }

  readOnly(): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ readOnly: true, writableAttributes: [] })
  }

  relations(...relations: readonly object[]): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ relations: [...this.#state.relations, ...relations] })
  }

  routeKey<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    assertExposedAttribute(this.#state.model, attribute, 'the route key')
    return this.with({ routeKey: attribute })
  }

  shared(value = true): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ shared: value, tenantScope: value ? undefined : this.#state.tenantScope })
  }

  slug(slug: string): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error(`[Holo Panels] Invalid resource slug "${slug}".`)
    return this.with({ slug })
  }

  table<TTable extends object>(table: TTable): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ table })
  }

  tenantScope(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>
  tenantScope<TNextTenant>(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TNextTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>
  tenantScope<TNextTenant>(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TNextTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes> {
    const state = this.#state as unknown as ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>
    return new ResourceBuilder(this.#state.model, cloneState(state, { shared: false, tenantScope: scope }))
  }

  validation(validation: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ validation })
  }

  widgets(...widgets: readonly object[]): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ widgets: [...this.#state.widgets, ...widgets] })
  }

  writableAttributes<const TAttributes extends readonly ResourceAttribute<TRecord>[]>(attributes: TAttributes): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
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
    return Object.freeze({
      ...this.#state,
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

  private with(patch: Partial<ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>>): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return new ResourceBuilder(this.#state.model, cloneState(this.#state, patch))
  }

  private withDiscovery(key: keyof DiscoveryDirectories, path: string): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes> {
    return this.with({ discover: { ...this.#state.discover, [key]: normalizeDiscoveryPath(path) } })
  }
}

type InferredSoftDeletes<TModel extends { readonly definition: { readonly softDeletes: boolean } }> = TModel['definition']['softDeletes'] extends true ? true : false

type InferredRecord<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = Awaited<ReturnType<TModel['create']>>
type InferredQuery<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = ReturnType<TModel['query']>

export interface ResourceContextTypeSources<
  TActorSource extends { readonly prototype: object } | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
> {
  readonly actor?: TActorSource
  readonly tenant?: TTenantSource
}

type ResourceActorValue<TActorSource extends { readonly prototype: object } | undefined> =
  TActorSource extends { readonly prototype: infer TActor extends object } ? TActor : object

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
    TActorSource extends { readonly prototype: object } | undefined = undefined,
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
