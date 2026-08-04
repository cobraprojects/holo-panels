import {
  DISCOVERY_MARKER,
  PanelBuilder,
  ResourceBuilder,
  definePage as defineCorePage,
  definePanel as defineCorePanel,
  defineResource as defineCoreResource,
  defineSchema as defineCompiledSchema,
  type DiscoverableDefinition,
  type SchemaBuilder,
} from '@holo-js/panels-core'

export interface ComponentDescriptor<TKey extends string> {
  readonly key: TKey
  readonly type: string
}

export interface FieldDescriptor<TKey extends string> extends ComponentDescriptor<TKey> {
  readonly requiredState: boolean
  required(): this
}

type CheckedDescriptor<TRecord, TDescriptor> = TDescriptor extends ComponentDescriptor<infer TKey>
  ? TKey extends Extract<keyof TRecord, string>
    ? TDescriptor
    : never
  : never

type CheckedDescriptors<
  TRecord,
  TDescriptors extends readonly ComponentDescriptor<string>[],
> = {
  readonly [TIndex in keyof TDescriptors]: CheckedDescriptor<TRecord, TDescriptors[TIndex]>
}

class MutableFieldDescriptor<TKey extends string> implements FieldDescriptor<TKey> {
  readonly key: TKey
  readonly type: string
  requiredState = false

  constructor(key: TKey, type: string) {
    this.key = key
    this.type = type
  }

  required(): this {
    this.requiredState = true
    return this
  }
}

function component<TKey extends string>(key: TKey, type: string): ComponentDescriptor<TKey> {
  return Object.freeze({ key, type })
}

function formField<TKey extends string>(key: TKey, type: string): FieldDescriptor<TKey> {
  return new MutableFieldDescriptor(key, type)
}

export const field = Object.freeze({
  boolean: <TKey extends string>(key: TKey): FieldDescriptor<TKey> => formField(key, 'boolean'),
  dateTime: <TKey extends string>(key: TKey): FieldDescriptor<TKey> => formField(key, 'date-time'),
  number: <TKey extends string>(key: TKey): FieldDescriptor<TKey> => formField(key, 'number'),
  text: <TKey extends string>(key: TKey): FieldDescriptor<TKey> => formField(key, 'text'),
})

export const column = Object.freeze({
  boolean: <TKey extends string>(key: TKey): ComponentDescriptor<TKey> => component(key, 'boolean'),
  dateTime: <TKey extends string>(key: TKey): ComponentDescriptor<TKey> => component(key, 'date-time'),
  number: <TKey extends string>(key: TKey): ComponentDescriptor<TKey> => component(key, 'number'),
  text: <TKey extends string>(key: TKey): ComponentDescriptor<TKey> => component(key, 'text'),
})

export class SchemaDefinition<TRecord> {
  readonly definitionKind = 'schema' as const
  #fields: readonly ComponentDescriptor<string>[] = []

  fields<const TDescriptors extends readonly ComponentDescriptor<string>[]>(
    descriptors: TDescriptors & CheckedDescriptors<TRecord, TDescriptors>,
  ): this {
    this.#fields = descriptors
    return this
  }

  get components(): readonly ComponentDescriptor<string>[] {
    return this.#fields
  }
}

export class TableDefinition<TRecord> {
  readonly definitionKind = 'table' as const
  #columns: readonly ComponentDescriptor<string>[] = []

  columns<const TDescriptors extends readonly ComponentDescriptor<string>[]>(
    descriptors: TDescriptors & CheckedDescriptors<TRecord, TDescriptors>,
  ): this {
    this.#columns = descriptors
    return this
  }

  get components(): readonly ComponentDescriptor<string>[] {
    return this.#columns
  }
}

export type DefinitionRecordSource<TRecord extends object = object> =
  | { readonly prototype: TRecord }
  | { create(...parameters: never[]): TRecord | Promise<TRecord> }

export type DefinitionRecord<TSource extends DefinitionRecordSource> =
  TSource extends { readonly prototype: infer TRecord extends object } ? TRecord
    : TSource extends { create(...parameters: never[]): infer TResult } ? Awaited<TResult> & object
      : never

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
  if (typeof sourceOrId !== 'string') return new SchemaDefinition<object>()
  if (!source) return defineCompiledSchema(sourceOrId)
  if (!context) return defineCompiledSchema(sourceOrId, source)
  return defineCompiledSchema(sourceOrId, source, context)
}

export function defineTable<TSource extends DefinitionRecordSource>(source: TSource): TableDefinition<DefinitionRecord<TSource>>
export function defineTable(): TableDefinition<object>
export function defineTable<TRecord, TSource extends DefinitionRecordSource = DefinitionRecordSource>(_source?: TSource): TableDefinition<TRecord | DefinitionRecord<TSource>> {
  return new TableDefinition<TRecord | DefinitionRecord<TSource>>()
}

export { PanelBuilder as PanelDefinition, ResourceBuilder as ResourceDefinition }
export const definePanel = defineCorePanel
export const definePage = defineCorePage
export const defineResource = defineCoreResource

type SimpleDefinition<TKind extends string> = Readonly<{
  definitionKind: TKind
  id: string
}>

function simpleDefinition<TKind extends string>(definitionKind: TKind, id: string): SimpleDefinition<TKind> {
  return Object.freeze({ definitionKind, id })
}

function discoverable<TKind extends DiscoverableDefinition['kind']>(
  kind: TKind,
  id: string,
): DiscoverableDefinition<TKind> {
  return Object.freeze({ discoveryMarker: DISCOVERY_MARKER, kind, id })
}

export const defineAction = (id: string): SimpleDefinition<'action'> => simpleDefinition('action', id)
export const defineColumn = (id: string): SimpleDefinition<'column'> => simpleDefinition('column', id)
export const defineEntry = (id: string): SimpleDefinition<'entry'> => simpleDefinition('entry', id)
export const defineField = (id: string): SimpleDefinition<'field'> => simpleDefinition('field', id)
export const defineFilter = (id: string): SimpleDefinition<'filter'> => simpleDefinition('filter', id)
export const defineCluster = (id: string): DiscoverableDefinition<'cluster'> => discoverable('cluster', id)
export const defineResourcePage = defineCorePage
export const defineWidget = (id: string): DiscoverableDefinition<'widget'> => discoverable('widget', id)

export type RelationManagerDefinition<TRecord> = DiscoverableDefinition<'relation-manager'> & {
  readonly record?: TRecord
}

export function defineRelationManager<TSource extends DefinitionRecordSource>(id: string, source: TSource): RelationManagerDefinition<DefinitionRecord<TSource>>
export function defineRelationManager(id: string): RelationManagerDefinition<object>
export function defineRelationManager<TRecord, TSource extends DefinitionRecordSource = DefinitionRecordSource>(id: string, _source?: TSource): RelationManagerDefinition<TRecord | DefinitionRecord<TSource>> {
  return discoverable('relation-manager', id)
}
