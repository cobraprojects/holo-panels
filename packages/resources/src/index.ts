import {
  createActionFactory,
  CreateAction,
  EditAction,
  type ActionFactory,
  type ActionContract,
} from '@holo-js/panels-actions'
import {
  DISCOVERY_MARKER,
  bindResourceActionOwner,
  actionPermissionReferences,
  resourceNotificationPermissionReferences,
  defineExporter as defineCoreExporter,
  defineImporter as defineCoreImporter,
  type DefaultPanelActor,
  type DefaultPanelTenant,
  type ExporterBuilder,
  type ImporterBuilder,
  defineResource,
  type ResourceExecutionContext,
  type ResourceInput,
  type ResourceQuery,
  type ResourceRecord,
  type PanelRelationValue,
  type RecordPath,
  type TableRecordIdentifier,
} from '@holo-js/panels-core'
import { createFieldFactory, type FieldFactory } from '@holo-js/panels-forms'
import { createEntryFactory, type EntryFactory } from '@holo-js/panels-infolists'
import type { Notification } from '@holo-js/panels-notifications'
import { createLayoutFactory, Schema, type LayoutFactory } from '@holo-js/panels-schemas'
import {
  createColumnFactory,
  createFilterFactory,
  Table,
  type ColumnFactory,
  type FilterFactory,
} from '@holo-js/panels-tables'

export interface ResourceModelSource<TRecord extends ResourceRecord = ResourceRecord> {
  create(...parameters: never[]): TRecord | Promise<TRecord>
  readonly definition: {
    readonly name: string
    readonly primaryKey: string
    readonly relations?: Readonly<Record<string, unknown>>
    readonly softDeletes: boolean
    readonly table?: { readonly columns?: Readonly<Record<string, { readonly kind?: string }>> }
  }
  query(): ResourceQuery<unknown, TRecord>
}

type PreviousDepth = [never, 0, 1, 2, 3, 4]
type Flatten<TValue> = { [TKey in keyof TValue]: TValue[TKey] }
type CreatedModelFor<TModel> = TModel extends { create(...parameters: never[]): infer TRecord } ? Awaited<TRecord> : never
type ModelRecordFor<TModel> = CreatedModelFor<TModel> extends { toJSON(): infer TRecord }
  ? TRecord
  : CreatedModelFor<TModel>
type ModelRelationsFor<TModel> = TModel extends { readonly definition: { readonly relations?: infer TRelations } } ? NonNullable<TRelations> : object
type RelatedRecord<TRelation, TDepth extends number> = TRelation extends { readonly related: () => infer TModel }
  ? ResourceRecordFromModel<TModel, TDepth>
  : never
type RelatedValue<TRelation, TDepth extends number> = PanelRelationValue<
  TRelation extends { readonly kind: 'belongsToMany' | 'hasMany' | 'hasManyThrough' | 'morphMany' | 'morphedByMany' | 'morphToMany' }
    ? readonly RelatedRecord<TRelation, TDepth>[]
    : TRelation extends { readonly kind: 'morphTo' }
      ? object | null
      : RelatedRecord<TRelation, TDepth> | null
>
type RelationValues<TRelations, TDepth extends number> = TDepth extends 0
  ? object
  : TRelations extends object
    ? string extends keyof TRelations
      ? object
      : { readonly [TName in keyof TRelations & string]: RelatedValue<TRelations[TName], PreviousDepth[TDepth]> }
    : object
type ResourceRecordFromModel<TModel, TDepth extends number = 3> = Flatten<
  Omit<ModelRecordFor<TModel>, keyof RelationValues<ModelRelationsFor<TModel>, TDepth>>
  & RelationValues<ModelRelationsFor<TModel>, TDepth>
>

export type ResourceRecordFor<TModel extends ResourceModelSource> = ResourceRecordFromModel<TModel>
export type ResourceFormInput<TModel extends ResourceModelSource> = ResourceInput<ResourceRecordFor<TModel>>
export type ResourceConfigurationContext<TActor extends object = object, TTenant = unknown> = ResourceExecutionContext<TActor, TTenant>
export type ResourceRelationName<TModel extends ResourceModelSource> = keyof ModelRelationsFor<TModel> & string
export type ResourceRelationRecordFor<
  TModel extends ResourceModelSource,
  TRelation extends ResourceRelationName<TModel>,
> = RelatedRecord<ModelRelationsFor<TModel>[TRelation], 3>

export type SchemaConfiguration<TRecord extends object, TFactory = undefined> = (
  schema: Schema<TRecord, TRecord, TFactory>,
  components: TFactory,
) => Schema<TRecord, TRecord, TFactory>
export type ResourceFormFactory<TRecord extends object> = FieldFactory<TRecord> & LayoutFactory<TRecord>
export type ResourceInfolistFactory<TRecord extends object> = EntryFactory<TRecord> & LayoutFactory<TRecord>
export type ResourceActionFactory<TRecord extends object> = ResourceFormFactory<TRecord> & ActionFactory<
  TRecord,
  ResourceInput<TRecord>,
  DefaultPanelActor,
  DefaultPanelTenant,
  object,
  ResourceFormFactory<TRecord>
>
export type ResourceTable<TRecord extends object> = Table<TRecord>
export type ResourceTableFactory<TRecord extends object> = ColumnFactory<TRecord> & FilterFactory<TRecord> & ResourceActionFactory<TRecord>
export type ResourceFormFactoryFor<TResource extends ResourceClass> = ResourceFormFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>
export type ResourceTableFactoryFor<TResource extends ResourceClass> = ResourceTableFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>
export type TableConfiguration<TRecord extends object> = (
  table: ResourceTable<TRecord>,
  components: ResourceTableFactory<TRecord>,
) => ResourceTable<TRecord>
export type ResourceSchemaConfiguration<TRecord extends object, TFactory> = (
  schema: Schema<TRecord, TRecord, TFactory>,
  components: TFactory,
) => Schema<TRecord, TRecord, TFactory>
export type ResourceTableConfiguration<TRecord extends object> = (
  table: ResourceTable<TRecord>,
  components: ResourceTableFactory<TRecord>,
) => ResourceTable<TRecord>
export type ResourceCreateBindings = (
  context: ResourceExecutionContext<DefaultPanelActor, DefaultPanelTenant>,
) => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>
export type ResourceQueryScope = (
  query: ResourceQuery<unknown, ResourceRecord>,
  context: ResourceExecutionContext<DefaultPanelActor, DefaultPanelTenant>,
) => ResourceQuery<unknown, ResourceRecord>
export type ResourceCreateBindingsConfiguration<TRecord extends object, TActor extends object, TTenant> = (
  context: ResourceExecutionContext<TActor, TTenant>,
) => Readonly<Partial<ResourceInput<TRecord>>> | Promise<Readonly<Partial<ResourceInput<TRecord>>>>
export type ResourceQueryConfiguration<
  TModel extends ResourceModelSource,
  TActor extends object,
  TTenant,
> = (
  query: ReturnType<TModel['query']>,
  context: ResourceExecutionContext<TActor, TTenant>,
) => ReturnType<TModel['query']>

function resourceFormFactory<TRecord extends object>(): ResourceFormFactory<TRecord> {
  return Object.freeze({ ...createFieldFactory<TRecord>(), ...createLayoutFactory<TRecord>() })
}

function resourceInfolistFactory<TRecord extends object>(): ResourceInfolistFactory<TRecord> {
  return Object.freeze({ ...createEntryFactory<TRecord>(), ...createLayoutFactory<TRecord>() })
}

function resourceActionFactory<TRecord extends object>(): ResourceActionFactory<TRecord> {
  const formFactory = resourceFormFactory<TRecord>()
  return Object.freeze({
    ...formFactory,
    ...createActionFactory<TRecord, ResourceInput<TRecord>, DefaultPanelActor, DefaultPanelTenant, object, ResourceFormFactory<TRecord>>(formFactory),
  })
}

function resourceTableFactory<TRecord extends object>(): ResourceTableFactory<TRecord> {
  return Object.freeze({
    ...resourceActionFactory<TRecord>(),
    ...createColumnFactory<TRecord>(),
    ...createFilterFactory<TRecord>(),
  })
}

declare const resourceTypeRegistryMarker: unique symbol
declare const relationManagerTypeRegistryMarker: unique symbol

export interface ResourceTypeRegistry {
  readonly [resourceTypeRegistryMarker]?: never
}

export interface RelationManagerTypeRegistry {
  readonly [relationManagerTypeRegistryMarker]?: never
}

interface ResourceTypeRegistration {
  readonly model: ResourceModelSource
  readonly resource: ResourceClass
}

interface RelationManagerTypeRegistration {
  readonly manager: RelationManagerClass
  readonly ownerModel: ResourceModelSource
  readonly relationship: string
}

type RegistryValue<TRegistry> = TRegistry[keyof TRegistry]
type ResourceRegistrationFor<TResource extends ResourceClass> = RegistryValue<ResourceTypeRegistry> extends infer TRegistration
  ? TRegistration extends ResourceTypeRegistration
    ? TResource extends TRegistration['resource'] ? TRegistration : never
    : never
  : never
type RelationManagerRegistrationFor<TManager extends RelationManagerClass> = RegistryValue<RelationManagerTypeRegistry> extends infer TRegistration
  ? TRegistration extends RelationManagerTypeRegistration
    ? TManager extends TRegistration['manager'] ? TRegistration : never
    : never
  : never
type RegisteredResourceModel<TResource extends ResourceClass> = [ResourceRegistrationFor<TResource>] extends [never]
  ? ResourceModelSource
  : ResourceRegistrationFor<TResource>['model']
type RegisteredRelationOwnerModel<TManager extends RelationManagerClass> = [RelationManagerRegistrationFor<TManager>] extends [never]
  ? ResourceModelSource
  : RelationManagerRegistrationFor<TManager>['ownerModel']
type RegisteredRelationName<TManager extends RelationManagerClass> = [RelationManagerRegistrationFor<TManager>] extends [never]
  ? string
  : RelationManagerRegistrationFor<TManager>['relationship'] & ResourceRelationName<RegisteredRelationOwnerModel<TManager>>
type RegisteredRelationRecord<TManager extends RelationManagerClass> = ResourceRelationRecordFor<
  RegisteredRelationOwnerModel<TManager>,
  RegisteredRelationName<TManager>
>
type RegisteredModelRecord<TResource extends ResourceClass> = CreatedModelFor<RegisteredResourceModel<TResource>>
type RegisteredResourceQuery<TResource extends ResourceClass> = ReturnType<RegisteredResourceModel<TResource>['query']>
type RegisteredResourceIdentifier<TResource extends ResourceClass> = RegisteredResourceModel<TResource>['definition']['primaryKey'] extends infer TPrimaryKey
  ? TPrimaryKey extends keyof RegisteredModelRecord<TResource>
    ? Extract<RegisteredModelRecord<TResource>[TPrimaryKey], TableRecordIdentifier>
    : TableRecordIdentifier
  : TableRecordIdentifier

export interface ResourcePageRegistration<TRecord extends object = object> {
  readonly actions: Readonly<{ readonly footer: readonly ActionContract<TRecord>[], readonly form?: readonly ActionContract<TRecord>[], readonly header: readonly ActionContract<TRecord>[] }>
  readonly page: ResourcePageConstructor<TRecord>
  readonly pageType: ResourcePageType
  readonly path: string
  readonly widgets?: Readonly<{ readonly footer: readonly object[], readonly header: readonly object[] }>
}

export type ResourcePageType = 'create' | 'edit' | 'list' | 'manage' | 'manage-related' | 'view'

export interface ResourcePageConstructor<TRecord extends object = object> {
  new (): ResourcePage<TRecord>
  readonly pageType: ResourcePageType
  route(path: string): ResourcePageRegistration<TRecord>
}

export interface ResourceClass {
  compile(): CompiledResourceDefinition
  getSlug(): string
}

export interface RelationManagerClass {
  compile(): object
}

export interface CompiledResourceDefinition extends Readonly<Record<string, unknown>> {
  readonly createBindings?: (context: ResourceExecutionContext<object, unknown>) => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>
  readonly id: string
  readonly tenantScope?: (query: ResourceQuery<unknown, ResourceRecord>, context: ResourceExecutionContext<object, unknown>) => ResourceQuery<unknown, ResourceRecord>
}

export abstract class ResourcePage<TRecord extends object = object> {
  static readonly pageType: ResourcePageType
  static get resource(): ResourceClass { throw new Error('Resource pages must declare their resource') }

  static route<TRecord extends object>(this: { new (): ResourcePage<TRecord>, readonly pageType: ResourcePageType }, path: string): ResourcePageRegistration<TRecord> {
    const page = new this()
    return Object.freeze({
      actions: Object.freeze({
        footer: Object.freeze([...page.getFooterActions()]),
        form: Object.freeze([...page.getFormActions()]),
        header: Object.freeze([...page.getHeaderActions()]),
      }),
      page: this as ResourcePageConstructor<TRecord>,
      pageType: this.pageType,
      path,
      widgets: Object.freeze({ footer: Object.freeze([...page.getFooterWidgets()]), header: Object.freeze([...page.getHeaderWidgets()]) }),
    })
  }

  protected getFooterActions(): readonly ActionContract<TRecord>[] { return [] }
  protected getFormActions(): readonly ActionContract<TRecord>[] { return [] }
  protected getHeaderActions(): readonly ActionContract<TRecord>[] { return [] }
  protected actions(configure: (action: ActionFactory<TRecord>) => readonly ActionContract<TRecord>[]): readonly ActionContract<TRecord>[] {
    return configure(createActionFactory<TRecord>())
  }
  protected getFooterWidgets(): readonly object[] { return [] }
  protected getHeaderWidgets(): readonly object[] { return [] }
  protected getHeading(): string | null { return null }
  protected getSubheading(): string | null { return null }
}

export abstract class ListRecords<TRecord extends object = object> extends ResourcePage<TRecord> {
  static override readonly pageType: ResourcePageType = 'list'
  protected getTableContentGrid(): Readonly<Record<string, number>> | null { return null }
  protected getTabs(): Readonly<Record<string, object>> { return {} }
}

export abstract class CreateRecord<TRecord extends object = object, TData extends object = TRecord> extends ResourcePage<TRecord> {
  static override readonly pageType = 'create' as const
  protected getCreatedNotification(): Notification | null { return null }
  protected getCreatedNotificationTitle(): string | null { return null }
  protected getCreateFormAction(): ActionContract<TRecord> | null { return CreateAction.make<TRecord>() }
  protected getCreateAnotherFormAction(): ActionContract<TRecord> | null { return null }
  protected getRedirectUrl(): string | null { return null }
  protected handleRecordCreation(_data: TData): TRecord | Promise<TRecord> { throw new Error('Resource creation is handled by the Holo Panels resource executor') }
  protected mutateFormDataBeforeCreate(data: TData): TData | Promise<TData> { return data }
  protected override getFormActions(): readonly ActionContract<TRecord>[] {
    return [...formAction(this.getCreateFormAction(), 'submit'), ...formAction(this.getCreateAnotherFormAction(), 'create-another')]
  }
}

export abstract class EditRecord<TRecord extends object = object, TData extends object = TRecord> extends ResourcePage<TRecord> {
  static override readonly pageType = 'edit' as const
  protected getCancelFormAction(): ActionContract<TRecord> | null { return null }
  protected getRedirectUrl(): string | null { return null }
  protected getSaveFormAction(): ActionContract<TRecord> | null { return EditAction.make<TRecord>().label('Save') }
  protected getSavedNotification(): Notification | null { return null }
  protected getSavedNotificationTitle(): string | null { return null }
  protected handleRecordUpdate(record: TRecord, _data: TData): TRecord | Promise<TRecord> { return record }
  protected mutateFormDataBeforeFill(data: TData): TData | Promise<TData> { return data }
  protected mutateFormDataBeforeSave(data: TData): TData | Promise<TData> { return data }
  protected override getFormActions(): readonly ActionContract<TRecord>[] {
    return [...formAction(this.getSaveFormAction(), 'submit'), ...formAction(this.getCancelFormAction(), 'cancel')]
  }
}

function formAction<TRecord extends object>(action: ActionContract<TRecord> | null, intent: 'cancel' | 'create-another' | 'submit'): readonly ActionContract<TRecord>[] {
  return action ? [{ id: action.id, resourceRecordType: action.resourceRecordType, compile: () => ({ ...action.compile(), formIntent: intent }), manifest: scope => ({ ...action.manifest(scope), formIntent: intent }) }] : []
}

export abstract class ViewRecord<TRecord extends object = object> extends ResourcePage<TRecord> {
  static override readonly pageType = 'view' as const
}

export abstract class Page<TRecord extends object = object> extends ResourcePage<TRecord> {
  static override readonly pageType: ResourcePageType = 'manage'
}

export abstract class ManageRecords<TRecord extends object = object> extends ListRecords<TRecord> {
  static override readonly pageType: ResourcePageType = 'manage'
}

export abstract class ManageRelatedRecords<TRecord extends object = object> extends ListRecords<TRecord> {
  static override readonly pageType: ResourcePageType = 'manage-related'
  static relationship: string
}

interface ResourceBuilderContract {
  actions(configure: () => readonly object[]): ResourceBuilderContract
  baseQuery(scope: (query: ResourceQuery<unknown, ResourceRecord>, context: ResourceExecutionContext<object, unknown>) => ResourceQuery<unknown, ResourceRecord>): ResourceBuilderContract
  compile(): object
  createBindings(bindings: (context: ResourceExecutionContext<object, unknown>) => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>): ResourceBuilderContract
  form(value: object): ResourceBuilderContract
  globalSearch(options: Readonly<{ attributes: readonly string[], details?: readonly string[], limit?: number, title: string }>): ResourceBuilderContract
  infolist(value: object): ResourceBuilderContract
  navigation(value: Readonly<{ group?: string, icon?: string, label?: string, sort?: number }>): ResourceBuilderContract
  pages(...values: readonly object[]): ResourceBuilderContract
  readOnly(value?: boolean): ResourceBuilderContract
  recordTitle(value: string): ResourceBuilderContract
  relations(...values: readonly object[]): ResourceBuilderContract
  routeKey(value: string): ResourceBuilderContract
  shared(value?: boolean): ResourceBuilderContract
  slug(value: string): ResourceBuilderContract
  table(value: object): ResourceBuilderContract
  tenantScope(scope: (query: ResourceQuery<unknown, ResourceRecord>, context: ResourceExecutionContext<object, unknown>) => ResourceQuery<unknown, ResourceRecord>): ResourceBuilderContract
  widgets(...values: readonly object[]): ResourceBuilderContract
  writableAttributes(values: readonly string[]): ResourceBuilderContract
}

function invoke<TValue>(target: object, method: string, value: TValue, ...parameters: readonly unknown[]): TValue {
  const callback = Reflect.get(target, method)
  return typeof callback === 'function' ? Reflect.apply(callback, target, [value, ...parameters]) as TValue : value
}

function invokeArray(target: object, method: string): readonly object[] {
  const callback = Reflect.get(target, method)
  const value = typeof callback === 'function' ? Reflect.apply(callback, target, []) : []
  return Array.isArray(value)
    ? value.filter((item): item is object => (typeof item === 'object' && item !== null) || typeof item === 'function')
    : []
}

function configuredCompositions(target: object): Readonly<{ form: Schema, infolist: Schema, table: Table }> {
  const formFactory = resourceFormFactory()
  const infolistFactory = resourceInfolistFactory()
  const tableFactory = resourceTableFactory()
  return Object.freeze({
    form: invoke(target, 'form', new Schema(), formFactory),
    infolist: invoke(target, 'infolist', new Schema(), infolistFactory),
    table: invoke(target, 'table', new Table(), tableFactory),
  })
}

function pageRegistrations(target: object): readonly ResourcePageRegistration[] {
  const callback = Reflect.get(target, 'getPages')
  const value = typeof callback === 'function' ? Reflect.apply(callback, target, []) : {}
  if (!value || typeof value !== 'object') return []
  return Object.values(value).filter((page): page is ResourcePageRegistration => Boolean(page && typeof page === 'object' && 'pageType' in page && 'path' in page))
}

function pageActionDefinitions(pages: readonly ResourcePageRegistration[]): readonly object[] {
  return pages.flatMap((page) => {
    const mount = page.pageType === 'edit' || page.pageType === 'view' ? 'record' : 'page'
    return [
      ...[...page.actions.header, ...page.actions.footer].map(action => Object.freeze({ ...action.compile(), mount, source: page.pageType })),
      ...(page.actions.form ?? []).map(action => Object.freeze({ ...action.compile(), mount, source: `${page.pageType}:form` })),
    ]
  })
}

function fieldActionDefinitions(form: Schema): readonly object[] {
  const visit = (components: readonly object[]): readonly object[] => components.flatMap((component) => {
    const server = Reflect.get(component, 'server')
    const actions = server && typeof server === 'object' && Array.isArray(Reflect.get(server, 'actions')) ? Reflect.get(server, 'actions') as readonly object[] : []
    const children = server && typeof server === 'object' && Array.isArray(Reflect.get(server, 'children')) ? Reflect.get(server, 'children') as readonly object[] : []
    const path = Reflect.get(component, 'path')
    return [
      ...actions.flatMap(action => ['page', 'record'].map(mount => Object.freeze({ ...action, mount, source: `form-field:${String(path)}` }))),
      ...visit(children),
    ]
  })
  return visit(form.compile().fields)
}

export function defineImporter<TResource extends ResourceClass>(
  id: string,
  resource: TResource,
): ImporterBuilder<RegisteredModelRecord<TResource>, ResourceInput<RegisteredModelRecord<TResource>>, DefaultPanelActor, DefaultPanelTenant> {
  return Reflect.apply(defineCoreImporter, undefined, [id, resource]) as ImporterBuilder<RegisteredModelRecord<TResource>, ResourceInput<RegisteredModelRecord<TResource>>, DefaultPanelActor, DefaultPanelTenant>
}

export function defineExporter<TResource extends ResourceClass>(
  id: string,
  resource: TResource,
): ExporterBuilder<RegisteredResourceQuery<TResource>, RegisteredModelRecord<TResource>, RegisteredResourceIdentifier<TResource>, DefaultPanelActor, DefaultPanelTenant> {
  return Reflect.apply(defineCoreExporter, undefined, [id, resource]) as ExporterBuilder<RegisteredResourceQuery<TResource>, RegisteredModelRecord<TResource>, RegisteredResourceIdentifier<TResource>, DefaultPanelActor, DefaultPanelTenant>
}

export abstract class Resource {
  static readonly discoveryMarker = DISCOVERY_MARKER
  static readonly kind = 'resource' as const
  protected static model: ResourceModelSource
  static navigationBadge: string | null = null
  static navigationGroup: string | null = null
  static navigationIcon: string | null = null
  static navigationLabel: string | null = null
  static navigationParentItem: string | null = null
  static navigationSort: number | null = null
  static recordTitleAttribute: string | null = null
  static routeKeyName: string | null = null
  static slug: string | null = null
  static writableAttributes: readonly string[] | null = null
  protected static isScopedToTenant = true

  protected static attribute<TResource extends ResourceClass, const TPath extends RecordPath<ResourceRecordFor<RegisteredResourceModel<TResource>>>>(
    this: TResource,
    path: TPath,
  ): TPath { return path }

  protected static attributes<TResource extends ResourceClass, const TPaths extends readonly RecordPath<ResourceRecordFor<RegisteredResourceModel<TResource>>>[]>(
    this: TResource,
    paths: TPaths,
  ): TPaths { return paths }

  protected static configureCreateBindings<TResource extends ResourceClass>(
    this: TResource,
    configuration: ResourceCreateBindingsConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>, DefaultPanelActor, DefaultPanelTenant>,
  ): ResourceCreateBindings {
    return context => configuration(context)
  }

  static action<TResource extends ResourceClass, TResult>(
    this: TResource,
    configure: (action: ResourceActionFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>) => TResult,
  ): TResult
  static action<TResource extends ResourceClass, TResult>(
    this: TResource,
    action: (action: ResourceActionFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>) => TResult,
  ): TResult {
    type TRecord = ResourceRecordFor<RegisteredResourceModel<TResource>>
    return bindResourceActionOwner(action(resourceActionFactory<TRecord>()), this)
  }

  static actions<TResource extends ResourceClass, const TActions extends readonly ActionContract<ResourceRecordFor<RegisteredResourceModel<TResource>>>[]>(
    this: TResource,
    configure: (action: ResourceActionFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>) => TActions,
  ): TActions {
    type TRecord = ResourceRecordFor<RegisteredResourceModel<TResource>>
    return configure(resourceActionFactory<TRecord>())
  }

  protected static configureForm<TResource extends ResourceClass>(
    this: TResource,
    configuration: SchemaConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>, ResourceFormFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>>,
  ): ResourceSchemaConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>, ResourceFormFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>> {
    return (schema, components) => Reflect.apply(configuration, this, [schema, components])
  }

  protected static configureInfolist<TResource extends ResourceClass>(
    this: TResource,
    configuration: SchemaConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>, ResourceInfolistFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>>,
  ): ResourceSchemaConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>, ResourceInfolistFactory<ResourceRecordFor<RegisteredResourceModel<TResource>>>> {
    return (schema, components) => Reflect.apply(configuration, this, [schema, components])
  }

  protected static configureQuery<TResource extends ResourceClass>(
    this: TResource,
    configuration: ResourceQueryConfiguration<RegisteredResourceModel<TResource>, DefaultPanelActor, DefaultPanelTenant>,
  ): ResourceQueryScope {
    return (query, context) => Reflect.apply(configuration, this, [query, context]) as ResourceQuery<unknown, ResourceRecord>
  }

  protected static configureTable<TResource extends ResourceClass>(
    this: TResource,
    configuration: TableConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>>,
  ): ResourceTableConfiguration<ResourceRecordFor<RegisteredResourceModel<TResource>>> {
    return (table, components) => Reflect.apply(configuration, this, [table, components])
  }

  static compile(): CompiledResourceDefinition {
    const model = this.model
    const create = defineResource as unknown as (source: ResourceModelSource) => ResourceBuilderContract
    let builder = create(model)
    const { form, infolist, table } = configuredCompositions(this)
    const pages = pageRegistrations(this)
    const relations = invokeArray(this, 'getRelations')
    const widgets = invokeArray(this, 'getWidgets')
    if (this.slug) builder = builder.slug(this.slug)
    if (this.recordTitleAttribute) builder = builder.recordTitle(this.recordTitleAttribute)
    if (this.routeKeyName) builder = builder.routeKey(this.routeKeyName)
    if (this.writableAttributes) builder = builder.writableAttributes(this.writableAttributes)
    if (!this.isScopedToTenant) builder = builder.shared()
    builder = builder.navigation({
      ...(this.navigationGroup ? { group: this.navigationGroup } : {}),
      ...(this.navigationIcon ? { icon: this.navigationIcon } : {}),
      ...(this.navigationLabel ? { label: this.navigationLabel } : {}),
      ...(this.navigationSort !== null ? { sort: this.navigationSort } : {}),
    })
    builder = builder.form(form).infolist(infolist).table(table).pages(...pages).relations(...relations).widgets(...widgets, ...pages.flatMap(page => [...page.widgets?.header ?? [], ...page.widgets?.footer ?? []]))
    const tableActions = table.compile().serverActions
    builder = builder.actions(() => Array.isArray(tableActions) ? tableActions.map(action => ({ compile: () => action })) : [])
    const baseQuery = Reflect.get(this, 'modifyBaseQuery')
    if (typeof baseQuery === 'function') builder = builder.baseQuery((query, context) => Reflect.apply(baseQuery, this, [query, context]) as ResourceQuery<unknown, ResourceRecord>)
    const tenantQuery = Reflect.get(this, 'scopeQueryToTenant')
    if (typeof tenantQuery === 'function') builder = builder.tenantScope((query, context) => Reflect.apply(tenantQuery, this, [query, context]) as ResourceQuery<unknown, ResourceRecord>)
    const createBindings = Reflect.get(this, 'getCreateBindings')
    if (typeof createBindings === 'function') builder = builder.createBindings(context => Reflect.apply(createBindings, this, [context]) as Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>)
    const searchableAttributes = this.getGloballySearchableAttributes()
    if (searchableAttributes.length > 0) {
      builder = builder.globalSearch({
        attributes: searchableAttributes,
        details: this.getGlobalSearchResultDetailAttributes(),
        limit: this.getGlobalSearchResultsLimit(),
        title: this.recordTitleAttribute ?? model.definition.primaryKey,
      })
    }
    const readOnly = Reflect.get(this, 'isReadOnly')
    if (typeof readOnly === 'function' && Reflect.apply(readOnly, this, []) === true) builder = builder.readOnly()
    const compiled = builder.compile() as CompiledResourceDefinition
    const actions = Reflect.get(compiled, 'actions')
    const pageActions = pageActionDefinitions(pages)
    const fieldActions = fieldActionDefinitions(form)
    return Object.freeze({
      ...compiled,
      globalWidgets: widgets,
      actions: Object.freeze([
        ...(Array.isArray(actions) ? actions.map(action => Object.freeze({ ...action, source: Reflect.get(action, 'source') ?? 'table' })) : []),
        ...pageActions,
        ...fieldActions,
      ]),
      permissionReferences: Object.freeze([...new Set([...(Array.isArray(compiled.permissionReferences) ? compiled.permissionReferences.filter((key): key is string => typeof key === 'string') : []), ...actionPermissionReferences([...pageActions, ...fieldActions]), ...resourceNotificationPermissionReferences(this)])]),
    })
  }

  static compileDiscoveryDefinition(): CompiledResourceDefinition { return this.compile() }
  static canAccess(): boolean | Promise<boolean> { return true }
  static canCreate(): boolean | Promise<boolean> { return true }
  static canDelete(_record: object): boolean | Promise<boolean> { return true }
  static canDeleteAny(): boolean | Promise<boolean> { return true }
  static canEdit(_record: object): boolean | Promise<boolean> { return true }
  static canForceDelete(_record: object): boolean | Promise<boolean> { return true }
  static canForceDeleteAny(): boolean | Promise<boolean> { return true }
  static canReplicate(_record: object): boolean | Promise<boolean> { return true }
  static canRestore(_record: object): boolean | Promise<boolean> { return true }
  static canRestoreAny(): boolean | Promise<boolean> { return true }
  static canView(_record: object): boolean | Promise<boolean> { return true }
  static canViewAny(): boolean | Promise<boolean> { return true }
  static getGloballySearchableAttributes(): readonly string[] { return [] }
  static getGlobalSearchResultDetailAttributes(): readonly string[] { return [] }
  static getGlobalSearchResultsLimit(): number { return 50 }
  static getGlobalSearchResultDetails(_record: object): Readonly<Record<string, string>> { return {} }
  static getGlobalSearchResultTitle(record: object): string { return String(Reflect.get(record, this.recordTitleAttribute ?? 'id') ?? '') }
  static getGlobalSearchResultUrl(_record: object): string | null { return null }
  static getModelLabel(): string | null { return null }
  static getNavigationBadge(): string | null { return this.navigationBadge }
  static getNavigationBadgeColor(): string | null { return null }
  static getNavigationGroup(): string | null { return this.navigationGroup }
  static getNavigationIcon(): string | null { return this.navigationIcon }
  static getNavigationLabel(): string | null { return this.navigationLabel }
  static getNavigationParentItem(): string | null { return this.navigationParentItem }
  static getNavigationSort(): number | null { return this.navigationSort }
  static getPluralModelLabel(): string | null { return null }
  static getRecordRouteBindingEloquentQuery(): ResourceQuery<unknown, ResourceRecord> { return this.model.query() }
  static getRecordTitle(record: object): string { return String(Reflect.get(record, this.recordTitleAttribute ?? 'id') ?? '') }
  static getRouteBaseName(): string { return this.slug ?? this.model.definition.name }
  static getSlug(): string { return this.slug ?? this.model.definition.name }
  static getUrl(name = 'index', parameters: Readonly<Record<string, number | string>> = {}): string {
    const suffix = name === 'index' ? '' : name === 'create' ? '/create' : name === 'edit' ? `/${String(parameters.record ?? ':record')}/edit` : `/${String(parameters.record ?? ':record')}`
    return `/${this.getSlug()}${suffix}`
  }
  static isReadOnly(): boolean { return false }
  static getWidgets(): readonly object[] { return [] }
  static shouldRegisterNavigation(): boolean { return true }
}

export abstract class RelationManager {
  static readonly discoveryMarker = DISCOVERY_MARKER
  static readonly kind = 'relation-manager' as const
  protected static relationship: string
  static title: string | null = null

  static action<TManager extends RelationManagerClass, TResult>(
    this: TManager,
    configure: (action: ResourceActionFactory<RegisteredRelationRecord<TManager>>) => TResult,
  ): TResult
  static action<TManager extends RelationManagerClass, TResult>(
    this: TManager,
    action: (action: ResourceActionFactory<RegisteredRelationRecord<TManager>>) => TResult,
  ): TResult {
    type TRecord = RegisteredRelationRecord<TManager>
    return action(resourceActionFactory<TRecord>())
  }

  static actions<TManager extends RelationManagerClass, const TActions extends readonly ActionContract<RegisteredRelationRecord<TManager>>[]>(
    this: TManager,
    configure: (action: ResourceActionFactory<RegisteredRelationRecord<TManager>>) => TActions,
  ): TActions {
    type TRecord = RegisteredRelationRecord<TManager>
    return configure(resourceActionFactory<TRecord>())
  }

  protected static configureForm<TManager extends RelationManagerClass>(
    this: TManager,
    configuration: SchemaConfiguration<RegisteredRelationRecord<TManager>, ResourceFormFactory<RegisteredRelationRecord<TManager>>>,
  ): ResourceSchemaConfiguration<RegisteredRelationRecord<TManager>, ResourceFormFactory<RegisteredRelationRecord<TManager>>> {
    return (schema, components) => Reflect.apply(configuration, this, [schema, components])
  }

  protected static configureInfolist<TManager extends RelationManagerClass>(
    this: TManager,
    configuration: SchemaConfiguration<RegisteredRelationRecord<TManager>, ResourceInfolistFactory<RegisteredRelationRecord<TManager>>>,
  ): ResourceSchemaConfiguration<RegisteredRelationRecord<TManager>, ResourceInfolistFactory<RegisteredRelationRecord<TManager>>> {
    return (schema, components) => Reflect.apply(configuration, this, [schema, components])
  }

  protected static configureTable<TManager extends RelationManagerClass>(
    this: TManager,
    configuration: TableConfiguration<RegisteredRelationRecord<TManager>>,
  ): ResourceTableConfiguration<RegisteredRelationRecord<TManager>> {
    return (table, components) => Reflect.apply(configuration, this, [table, components])
  }

  static compile(): object {
    const { form, infolist, table } = configuredCompositions(this)
    const manager = Reflect.construct(this, []) as RelationManager
    const headerActions = [...manager.getHeaderActions(), ...manager.getTableHeaderActions()].map(action => ({ ...action.compile(), mount: 'page' }))
    return Object.freeze({
      actions: [...(table.compile().serverActions as readonly object[]), ...headerActions],
      discoveryMarker: DISCOVERY_MARKER,
      form,
      id: this.relationship,
      infolist,
      kind: 'relation-manager',
      relationName: this.relationship,
      resourceRecordType: Object.freeze({}),
      table,
      title: this.title,
    })
  }

  static compileDiscoveryDefinition(): object { return this.compile() }
  static canViewForRecord<TManager extends RelationManagerClass>(
    this: TManager,
    _ownerRecord: ResourceRecordFor<RegisteredRelationOwnerModel<TManager>>,
    _pageClass: ResourcePageConstructor,
  ): boolean | Promise<boolean> { return true }
  protected getHeaderActions(): readonly ActionContract<object>[] { return [] }
  protected getTableHeaderActions(): readonly ActionContract<object>[] { return [] }
}
