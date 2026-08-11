import type {
  Entity,
  RelationMap,
  StaticModelApi,
  TableDefinition,
} from '@holo-js/db'
import type { ClientManifestValue, DiscoverableDefinition, DiscoveryDirectories } from '../discovery/types'
import type { ResourceRenderSlot, ScopedRenderSlots } from '../panels/render-slots'

export type ResourceIdentifier = number | string
export type ResourceOperation = 'create' | 'delete' | 'forceDelete' | 'restore' | 'update' | 'view' | 'viewAny'

export interface ResourceModelDefinition {
  readonly fillable?: readonly string[]
  readonly guarded?: readonly string[]
  readonly hidden?: readonly string[]
  readonly name: string
  readonly primaryKey: string
  readonly softDeletes: boolean
  readonly table?: { readonly columns?: Readonly<Record<string, unknown>> }
}

export interface ResourceRecord {
  delete(): Promise<void>
  forceDelete(): Promise<void>
  restore(): Promise<this>
  toJSON(): object
  update(values: never): Promise<this>
}

export interface ResourceQuery<TQuery, TRecord> {
  first(): Promise<TRecord | undefined>
  withTrashed?(): TQuery
}

export interface ResourceModel<TRecord, TQuery> {
  readonly definition: ResourceModelDefinition
  create(values: never): Promise<TRecord>
  getConnectionName(): string | undefined
  query(): TQuery
  unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult>
}

export type ResourceRecordFor<TModel> = TModel extends StaticModelApi<
  infer TTable extends TableDefinition,
  infer _TScopes,
  infer TRelations extends RelationMap
>
  ? Entity<TTable, TRelations>
  : TModel extends abstract new (...parameters: never[]) => infer TRecord
    ? TRecord
    : never

export type ResourceAttributes<TRecord> = TRecord extends { toJSON(): infer TAttributes }
  ? TAttributes extends object ? TAttributes : Readonly<Record<string, unknown>>
  : TRecord extends object ? TRecord : Readonly<Record<string, unknown>>

export type ResourceAttribute<TRecord> = Extract<keyof ResourceAttributes<TRecord>, string>

export type ResourceInput<TRecord> = Partial<{
  readonly [TAttribute in ResourceAttribute<TRecord>]: ResourceAttributes<TRecord>[TAttribute]
}>

export interface ResourceExecutionContext<TActor extends object, TTenant> {
  readonly actor: TActor | null
  readonly signal: AbortSignal
  readonly tenant: TTenant
  readonly tenantBindings?: Readonly<Record<string, unknown>>
  readonly tenantCacheKey?: string
  readonly tenantId?: number | string
  readonly tenantRouteKey?: string
  readonly scopeTenantQuery?: <TQuery>(query: TQuery) => TQuery
}

export interface ResourceCompositionTypes<TRecord, TActor = unknown, TTenant = unknown, TServices = unknown> {
  readonly actor: TActor
  readonly record: TRecord
  readonly services: TServices
  readonly tenant: TTenant
}

export interface ResourceAuthorization<TModel, TRecord, TActor extends object> {
  authorizeClass(actor: TActor | null, operation: 'create' | 'viewAny', model: TModel): Promise<void>
  authorizeRecord(actor: TActor | null, operation: Exclude<ResourceOperation, 'create' | 'viewAny'>, record: TRecord): Promise<void>
}

export interface ResourceTransaction {
  run<TResult>(operation: () => Promise<TResult>): Promise<TResult>
}

export interface ResourceValidation<TInput extends Readonly<Record<string, unknown>>, TContext> {
  validate(input: TInput, context: TContext): Promise<void>
}

export interface ResourceLifecycle<TRecord, TInput extends Readonly<Record<string, unknown>>, TContext> {
  readonly afterCreate?: (record: TRecord, context: TContext) => void | Promise<void>
  readonly afterDelete?: (record: TRecord, context: TContext) => void | Promise<void>
  readonly afterFill?: (input: TInput, context: TContext) => TInput | Promise<TInput>
  readonly afterSave?: (record: TRecord, context: TContext) => void | Promise<void>
  readonly afterValidate?: (input: TInput, context: TContext) => void | Promise<void>
  readonly beforeCreate?: (input: TInput, context: TContext) => void | Promise<void>
  readonly beforeDelete?: (record: TRecord, context: TContext) => void | Promise<void>
  readonly beforeFill?: (input: TInput, context: TContext) => TInput | Promise<TInput>
  readonly beforeRedirect?: (record: TRecord, context: TContext) => string | null | Promise<string | null>
  readonly beforeSave?: (input: TInput, context: TContext) => void | Promise<void>
  readonly beforeValidate?: (input: TInput, context: TContext) => void | Promise<void>
}

export interface ResourcePersistence<TRecord, TInput extends Readonly<Record<string, unknown>>, TContext, TSoftDeletes extends boolean> {
  create(input: TInput, context: TContext): Promise<TRecord>
  delete(record: TRecord, context: TContext): Promise<void>
  update(record: TRecord, input: TInput, context: TContext): Promise<TRecord>
  restore: TSoftDeletes extends true ? (record: TRecord, context: TContext) => Promise<TRecord> : never
  forceDelete: TSoftDeletes extends true ? (record: TRecord, context: TContext) => Promise<void> : never
}

export interface ResourceNavigation {
  readonly badge?: string
  readonly group?: string
  readonly icon?: string
  readonly label?: string
  readonly parent?: string
  readonly sort?: number
}

export interface ResourceCapabilities<TSoftDeletes extends boolean> extends Readonly<Record<string, ClientManifestValue>> {
  readonly delete: boolean
  readonly forceDelete: TSoftDeletes
  readonly restore: TSoftDeletes
}

export interface ResourceClientManifest<TRecord, TSoftDeletes extends boolean> extends Readonly<Record<string, ClientManifestValue>> {
  readonly capabilities: ResourceCapabilities<TSoftDeletes>
  readonly globalSearch: boolean
  readonly navigation: ResourceNavigation & Readonly<Record<string, ClientManifestValue>>
  readonly recordTitle: ResourceAttribute<TRecord>
  readonly routeKey: ResourceAttribute<TRecord>
  readonly slug: string
  readonly softDeletes: TSoftDeletes
}

export interface ResourceGlobalSearch<TRecord> {
  readonly attributes: readonly ResourceAttribute<TRecord>[]
  readonly details?: readonly ResourceAttribute<TRecord>[]
  readonly limit?: number
  readonly title: ResourceAttribute<TRecord>
}

export interface SingularResourceOptions<TRecord, TQuery, TActor extends object, TTenant> {
  readonly resolve: (
    query: TQuery,
    context: ResourceExecutionContext<TActor, TTenant>,
  ) => Promise<TRecord | null>
}

export interface ResourceParentReference<TParentRecord extends ResourceRecord> {
  readonly id: string
  readonly routeKey: ResourceAttribute<TParentRecord>
}

export interface ResourceParentRegistry<TActor extends object, TTenant> {
  resolveAuthorized(
    parent: Readonly<{ readonly id: string, readonly routeKey: string }>,
    identifier: ResourceIdentifier,
    context: ResourceExecutionContext<TActor, TTenant>,
  ): Promise<ResourceRecord | null>
}

export interface NestedResourceOptions<TParentRecord, _TRecord, TQuery, TActor extends object, TTenant> {
  readonly parameter?: string
  readonly relationship: string
  readonly scope: (
    query: TQuery,
    parent: TParentRecord,
    context: ResourceExecutionContext<TActor, TTenant>,
  ) => TQuery
}

export interface CompiledNestedResource<TParentRecord extends ResourceRecord, TRecord, TQuery, TActor extends object, TTenant> {
  readonly options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant> & { readonly parameter: string }
  readonly parent: ResourceParentReference<TParentRecord>
}

export interface ResourceDefinition<
  TModel,
  TRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
> extends DiscoverableDefinition<'resource'> {
  readonly actions: readonly Readonly<{ readonly id: string, readonly kind: string }>[]
  readonly baseQuery: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery
  readonly capabilities: ResourceCapabilities<TSoftDeletes>
  readonly client: ResourceClientManifest<TRecord, TSoftDeletes>
  readonly createBindings?: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>
  readonly discover?: Readonly<DiscoveryDirectories>
  readonly form?: object
  readonly globalSearch?: ResourceGlobalSearch<TRecord>
  readonly infolist?: object
  readonly lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>
  readonly model: TModel
  readonly navigation: ResourceNavigation
  readonly nested: CompiledNestedResource<ResourceRecord, TRecord, TQuery, TActor, TTenant> | null
  readonly pages: readonly object[]
  readonly persistence?: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>
  readonly recordTitle: ResourceAttribute<TRecord>
  readonly relations: readonly object[]
  readonly routeKey: ResourceAttribute<TRecord>
  readonly shared: boolean
  readonly singular: SingularResourceOptions<TRecord, TQuery, TActor, TTenant> | null
  readonly slug: string
  readonly softDeletes: TSoftDeletes
  readonly table?: object
  readonly slots: ScopedRenderSlots<ResourceRenderSlot>
  readonly tenantScope?: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery
  readonly validation?: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>
  readonly widgets: readonly object[]
  readonly writableAttributes: readonly ResourceAttribute<TRecord>[]
}
