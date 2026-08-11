import {
  DISCOVERY_MARKER,
  FilterFactory,
  TableGroupFactory,
  PanelBuilder,
  ResourceBuilder,
  SummaryFactory,
  definePage as defineCorePage,
  defineAction as defineCoreAction,
  definePanel as defineCorePanel,
  defineResource as defineCoreResource,
  defineSchema as defineCompiledSchema,
  type DiscoverableDefinition,
  type ColumnFactory,
  type DefaultPanelActor,
  type DefaultPanelTenant,
  type InferredResourceBuilder,
  type OptionalRuntimeTypeValue,
  type ResourceAttributes,
  type ResourceContextTypeSources,
  type ResourceModel,
  type ResourceQuery,
  type ResourceRecord,
  type RecordTypeSource,
  type RuntimeTypeSource,
  type RuntimeTypeValue,
  type SchemaBuilder,
} from '@holo-js/panels-core'
import {
  ModelFieldFactory,
  modelColumns,
  type ModelComponentSource,
  type ModelRecordWithRelations,
} from './model-components'

export type ComponentValueKind = 'boolean' | 'date-time' | 'number' | 'text'

export interface ComponentDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> {
  readonly key: TKey
  readonly type: string
  readonly valueKind: TValueKind
  label(value: string): this
}

export interface FieldDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> extends ComponentDescriptor<TKey, TValueKind> {
  readonly disabledState: boolean
  readonly helperTextValue?: string
  readonly placeholderValue?: string
  readonly requiredState: boolean
  disabled(value?: boolean): this
  helperText(value: string): this
  placeholder(value: string): this
  required(): this
}

export interface ColumnDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> extends ComponentDescriptor<TKey, TValueKind> {
  readonly searchableState: boolean
  readonly sortableState: boolean
  readonly toggleableState: boolean
  searchable(value?: boolean): this
  sortable(value?: boolean): this
  toggleable(value?: boolean): this
}

type DescriptorValue<TValueKind extends ComponentValueKind> =
  TValueKind extends 'boolean' ? boolean
    : TValueKind extends 'number' ? number
      : TValueKind extends 'date-time' ? Date
        : string

type CheckedDescriptor<TRecord, TDescriptor> = TDescriptor extends ComponentDescriptor<infer TKey, infer TValueKind>
  ? TKey extends Extract<keyof ResourceAttributes<TRecord>, string>
    ? NonNullable<ResourceAttributes<TRecord>[TKey]> extends DescriptorValue<TValueKind> ? TDescriptor : never
    : never
  : never

type CheckedDescriptors<
  TRecord,
  TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[],
> = {
  readonly [TIndex in keyof TDescriptors]: CheckedDescriptor<TRecord, TDescriptors[TIndex]>
}

abstract class MutableComponentDescriptor<TKey extends string, TValueKind extends ComponentValueKind> implements ComponentDescriptor<TKey, TValueKind> {
  readonly key: TKey
  readonly type: string
  readonly valueKind: TValueKind
  labelValue?: string

  constructor(key: TKey, type: string, valueKind: TValueKind) {
    this.key = key
    this.type = type
    this.valueKind = valueKind
  }

  label(value: string): this {
    this.labelValue = value
    return this
  }
}

class MutableFieldDescriptor<TKey extends string, TValueKind extends ComponentValueKind> extends MutableComponentDescriptor<TKey, TValueKind> implements FieldDescriptor<TKey, TValueKind> {
  disabledState = false
  helperTextValue?: string
  placeholderValue?: string
  requiredState = false

  disabled(value = true): this {
    this.disabledState = value
    return this
  }

  helperText(value: string): this {
    this.helperTextValue = value
    return this
  }

  placeholder(value: string): this {
    this.placeholderValue = value
    return this
  }

  required(): this {
    this.requiredState = true
    return this
  }
}

class MutableColumnDescriptor<TKey extends string, TValueKind extends ComponentValueKind> extends MutableComponentDescriptor<TKey, TValueKind> implements ColumnDescriptor<TKey, TValueKind> {
  searchableState = false
  sortableState = false
  toggleableState = false

  searchable(value = true): this {
    this.searchableState = value
    return this
  }

  sortable(value = true): this {
    this.sortableState = value
    return this
  }

  toggleable(value = true): this {
    this.toggleableState = value
    return this
  }
}

function formField<TKey extends string, TValueKind extends ComponentValueKind>(key: TKey, type: string, valueKind: TValueKind): FieldDescriptor<TKey, TValueKind> {
  return new MutableFieldDescriptor(key, type, valueKind)
}

function tableColumn<TKey extends string, TValueKind extends ComponentValueKind>(key: TKey, type: string, valueKind: TValueKind): ColumnDescriptor<TKey, TValueKind> {
  return new MutableColumnDescriptor(key, type, valueKind)
}

export const field = Object.freeze({
  boolean: <TKey extends string>(key: TKey): FieldDescriptor<TKey, 'boolean'> => formField(key, 'boolean', 'boolean'),
  dateTime: <TKey extends string>(key: TKey): FieldDescriptor<TKey, 'date-time'> => formField(key, 'date-time', 'date-time'),
  number: <TKey extends string>(key: TKey): FieldDescriptor<TKey, 'number'> => formField(key, 'number', 'number'),
  text: <TKey extends string>(key: TKey): FieldDescriptor<TKey, 'text'> => formField(key, 'text', 'text'),
})

export const column = Object.freeze({
  boolean: <TKey extends string>(key: TKey): ColumnDescriptor<TKey, 'boolean'> => tableColumn(key, 'boolean', 'boolean'),
  dateTime: <TKey extends string>(key: TKey): ColumnDescriptor<TKey, 'date-time'> => tableColumn(key, 'date-time', 'date-time'),
  number: <TKey extends string>(key: TKey): ColumnDescriptor<TKey, 'number'> => tableColumn(key, 'number', 'number'),
  text: <TKey extends string>(key: TKey): ColumnDescriptor<TKey, 'text'> => tableColumn(key, 'text', 'text'),
})

export class SchemaDefinition<TRecord> {
  readonly definitionKind = 'schema' as const
  declare readonly resourceRecordType: TRecord
  readonly #source?: ModelComponentSource
  #fields: readonly ComponentDescriptor<string, ComponentValueKind>[] = []

  constructor(source?: ModelComponentSource) {
    this.#source = source
  }

  fields<const TFields extends readonly { compile(): { readonly kind: 'field', readonly path: string } }[]>(
    configure: (field: ModelFieldFactory<TRecord>) => TFields,
  ): this
  fields<const TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[]>(
    descriptors: TDescriptors,
    ..._validation: TDescriptors extends CheckedDescriptors<TRecord, TDescriptors> ? [] : [error: never]
  ): this
  fields(
    descriptorsOrConfigure: readonly ComponentDescriptor<string, ComponentValueKind>[] | ((field: ModelFieldFactory<TRecord>) => readonly { compile(): { readonly kind: 'field', readonly path: string } }[]),
  ): this {
    if (typeof descriptorsOrConfigure === 'function') {
      if (!this.#source) throw new Error('Model-bound schema fields require a Holo model source')
      this.#fields = descriptorsOrConfigure(new ModelFieldFactory<TRecord>(this.#source)) as unknown as readonly ComponentDescriptor<string, ComponentValueKind>[]
      return this
    }
    this.#fields = descriptorsOrConfigure
    return this
  }

  get components(): readonly ComponentDescriptor<string, ComponentValueKind>[] {
    return this.#fields
  }

  compile(): Readonly<{ fields: readonly object[] }> {
    return Object.freeze({
      fields: Object.freeze(this.#fields.map(component => 'compile' in component && typeof component.compile === 'function'
        ? component.compile()
        : component)),
    })
  }
}

export class TableDefinition<TRecord> {
  readonly definitionKind = 'table' as const
  declare readonly resourceRecordType: TRecord
  readonly #source?: ModelComponentSource
  #columns: readonly ComponentDescriptor<string, ComponentValueKind>[] = []
  #filterMode: 'deferred' | 'live' = 'live'
  #filters: readonly { compile(): object }[] = []
  #groups: readonly { compile(): object }[] = []
  #summaries: readonly { compile(): object }[] = []

  constructor(source?: ModelComponentSource) {
    this.#source = source
  }

  columns<const TColumns extends readonly { compile(): { readonly kind: 'column', readonly manifest: { readonly path: string } } }[]>(
    configure: (column: ColumnFactory<TRecord>) => TColumns,
  ): this
  columns<const TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[]>(
    descriptors: TDescriptors,
    ..._validation: TDescriptors extends CheckedDescriptors<TRecord, TDescriptors> ? [] : [error: never]
  ): this
  columns(
    descriptorsOrConfigure: readonly ComponentDescriptor<string, ComponentValueKind>[] | ((column: ColumnFactory<TRecord>) => readonly { compile(): { readonly kind: 'column', readonly manifest: { readonly path: string } } }[]),
  ): this {
    if (typeof descriptorsOrConfigure === 'function') {
      if (!this.#source) throw new Error('Model-bound table columns require a Holo model source')
      const factory = modelColumns(this.#source) as unknown as ColumnFactory<TRecord>
      this.#columns = descriptorsOrConfigure(factory) as unknown as readonly ComponentDescriptor<string, ComponentValueKind>[]
      return this
    }
    this.#columns = descriptorsOrConfigure
    return this
  }

  get components(): readonly ComponentDescriptor<string, ComponentValueKind>[] {
    return this.#columns
  }

  filters<const TFilters extends readonly { compile(): object }[]>(
    configure: (filter: FilterFactory<TRecord>) => TFilters,
  ): this {
    this.#filters = configure(new FilterFactory<TRecord>())
    return this
  }

  deferFilters(value = true): this {
    this.#filterMode = value ? 'deferred' : 'live'
    return this
  }

  groups<const TGroups extends readonly { compile(): object }[]>(
    configure: (group: TableGroupFactory<TRecord>) => TGroups,
  ): this {
    this.#groups = configure(new TableGroupFactory<TRecord>())
    return this
  }

  summaries<const TSummaries extends readonly { compile(): object }[]>(
    configure: (summary: SummaryFactory<TRecord>) => TSummaries,
  ): this {
    this.#summaries = configure(new SummaryFactory<TRecord>())
    return this
  }

  compile(): Readonly<{
    columns: readonly object[]
    filterMode: 'deferred' | 'live'
    filters: readonly object[]
    groups: readonly object[]
    serverColumns: readonly object[]
    serverFilters: readonly object[]
    serverGroups: readonly object[]
    serverSummaries: readonly object[]
    summaries: readonly object[]
  }> {
    const definitions = this.#columns.map(component => 'compile' in component && typeof component.compile === 'function'
      ? component.compile()
      : component)
    const filters = this.#filters.map(filter => filter.compile())
    const groups = this.#groups.map(group => group.compile())
    const summaries = this.#summaries.map(summary => summary.compile())
    return Object.freeze({
      columns: Object.freeze(definitions.map(definition => typeof definition === 'object' && definition !== null && 'manifest' in definition
        ? definition.manifest as object
        : definition)),
      filterMode: this.#filterMode,
      filters: Object.freeze(filters.map(definition => 'manifest' in definition ? definition.manifest as object : definition)),
      groups: Object.freeze(groups.map(definition => 'manifest' in definition ? definition.manifest as object : definition)),
      serverColumns: Object.freeze(definitions),
      serverFilters: Object.freeze(filters),
      serverGroups: Object.freeze(groups),
      serverSummaries: Object.freeze(summaries),
      summaries: Object.freeze(summaries.map(definition => 'manifest' in definition ? definition.manifest as object : definition)),
    })
  }
}

export type DefinitionRecordSource<TRecord extends object = object> =
  | { readonly prototype: TRecord }
  | { create(...parameters: never[]): TRecord | Promise<TRecord> }

export type DefinitionRecord<TSource extends DefinitionRecordSource> =
  TSource extends { readonly prototype: infer TRecord extends object } ? TRecord
    : TSource extends { create(...parameters: never[]): infer TResult } ? Awaited<TResult> & object
      : never

type DefinitionTableRecord<TSource extends DefinitionRecordSource> = TSource extends ModelComponentSource
  ? ModelRecordWithRelations<TSource>
  : DefinitionRecord<TSource>

export function defineSchema<TSource extends DefinitionRecordSource>(source: TSource): SchemaDefinition<DefinitionRecord<TSource>>
export function defineSchema(): SchemaDefinition<object>
export function defineSchema<TSource extends DefinitionRecordSource>(id: string, source: TSource): SchemaBuilder<DefinitionRecord<TSource>, unknown>
export function defineSchema<TSource extends DefinitionRecordSource, TContextSource extends { readonly prototype: object }>(id: string, source: TSource, context: TContextSource): SchemaBuilder<DefinitionRecord<TSource>, TContextSource['prototype']>
export function defineSchema(id: string): SchemaBuilder<Readonly<Record<string, unknown>>, unknown>
export function defineSchema(
  sourceOrId?: string | DefinitionRecordSource,
  source?: DefinitionRecordSource,
  context?: { readonly prototype: object },
) {
  if (typeof sourceOrId !== 'string') return new SchemaDefinition<object>(sourceOrId && 'create' in sourceOrId ? sourceOrId : undefined)
  if (!source) return defineCompiledSchema(sourceOrId)
  if (!context) return defineCompiledSchema(sourceOrId, source)
  return defineCompiledSchema(sourceOrId, source, context)
}

export function defineTable<TSource extends DefinitionRecordSource>(source: TSource): TableDefinition<DefinitionTableRecord<TSource>>
export function defineTable(): TableDefinition<object>
export function defineTable<TRecord, TSource extends DefinitionRecordSource = DefinitionRecordSource>(source?: TSource): TableDefinition<TRecord | DefinitionTableRecord<TSource>> {
  return new TableDefinition<TRecord | DefinitionTableRecord<TSource>>(source && 'create' in source ? source : undefined)
}

export { PanelBuilder as PanelDefinition, ResourceBuilder as ResourceDefinition }
export const definePanel = defineCorePanel
export const definePage = defineCorePage

interface ResourceFactory {
  <
    TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>,
    TActorSource extends RecordTypeSource | undefined = undefined,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
  >(
    model: TModel,
    sources: ResourceContextTypeSources<TActorSource, TTenantSource>,
  ): InferredResourceBuilder<
    TModel,
    TActorSource extends RecordTypeSource ? Extract<RuntimeTypeValue<TActorSource>, object> : DefaultPanelActor,
    OptionalRuntimeTypeValue<TTenantSource>
  >
  <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>>(
    model: TModel,
  ): InferredResourceBuilder<TModel, DefaultPanelActor, DefaultPanelTenant>
}

export const defineResource = defineCoreResource as ResourceFactory

export interface CompiledCustomDefinition<TKind extends string, TValue, TContext> {
  readonly definitionKind: TKind
  readonly id: string
  readonly label?: string
  readonly properties: Readonly<Record<string, unknown>>
  readonly renderer?: string
  readonly visible: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>)
}

export class CustomDefinitionBuilder<TKind extends string, TValue = unknown, TContext = unknown> {
  declare readonly contextType: TContext
  readonly definitionKind: TKind
  readonly id: string
  declare readonly valueType: TValue
  #label?: string
  #properties: Readonly<Record<string, unknown>> = {}
  #renderer?: string
  #visible: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>) = true

  constructor(definitionKind: TKind, id: string) {
    this.definitionKind = definitionKind
    this.id = id
  }

  label(value: string): this {
    this.#label = value
    return this
  }

  properties(value: Readonly<Record<string, unknown>>): this {
    this.#properties = Object.freeze({ ...value })
    return this
  }

  renderer(value: string): this {
    this.#renderer = value
    return this
  }

  visible(value: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>)): this {
    this.#visible = value
    return this
  }

  compile(): CompiledCustomDefinition<TKind, TValue, TContext> {
    return Object.freeze({
      definitionKind: this.definitionKind,
      id: this.id,
      ...(this.#label ? { label: this.#label } : {}),
      properties: this.#properties,
      ...(this.#renderer ? { renderer: this.#renderer } : {}),
      visible: this.#visible,
    })
  }
}

function customDefinition<
  TKind extends string,
  TValueSource extends RuntimeTypeSource | undefined = undefined,
  TContextSource extends RuntimeTypeSource | undefined = undefined,
>(
  definitionKind: TKind,
  id: string,
  _valueSource?: TValueSource,
  _contextSource?: TContextSource,
): CustomDefinitionBuilder<TKind, OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> {
  return new CustomDefinitionBuilder(definitionKind, id)
}

function discoverable<TKind extends DiscoverableDefinition['kind']>(
  kind: TKind,
  id: string,
): DiscoverableDefinition<TKind> {
  return Object.freeze({ discoveryMarker: DISCOVERY_MARKER, kind, id })
}

export const defineAction = defineCoreAction
export const defineColumn = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'column', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('column', id, valueSource, contextSource)
export const defineEntry = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'entry', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('entry', id, valueSource, contextSource)
export const defineField = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'field', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('field', id, valueSource, contextSource)
export const defineFilter = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'filter', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('filter', id, valueSource, contextSource)
export const defineCluster = (id: string): DiscoverableDefinition<'cluster'> => discoverable('cluster', id)
export const defineResourcePage = defineCorePage
export const defineWidget = (id: string): DiscoverableDefinition<'widget'> => discoverable('widget', id)

export type RelationManagerDefinition<TRecord> = DiscoverableDefinition<'relation-manager'> & {
  readonly record?: TRecord
  readonly resourceRecordType: TRecord
}

export function defineRelationManager<TSource extends DefinitionRecordSource>(id: string, source: TSource): RelationManagerDefinition<DefinitionRecord<TSource>>
export function defineRelationManager(id: string): RelationManagerDefinition<object>
export function defineRelationManager<TRecord, TSource extends DefinitionRecordSource = DefinitionRecordSource>(id: string, _source?: TSource): RelationManagerDefinition<TRecord | DefinitionRecord<TSource>> {
  return discoverable('relation-manager', id) as RelationManagerDefinition<TRecord | DefinitionRecord<TSource>>
}
