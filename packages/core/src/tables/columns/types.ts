import type { JsonObject, JsonValue } from '../../protocol/json'

type AtomicValue = bigint | boolean | Date | number | string | symbol | null | undefined

export type RecordPath<TRecord> = TRecord extends AtomicValue
  ? never
  : TRecord extends readonly (infer TItem)[]
    ? `${number}` | `${number}.${RecordPath<TItem>}`
    : TRecord extends object
      ? {
          [TKey in keyof TRecord & string]: TRecord[TKey] extends AtomicValue
            ? TKey
            : TRecord[TKey] extends readonly (infer TItem)[]
              ? TKey | `${TKey}.${number}` | `${TKey}.${number}.${RecordPath<TItem>}`
              : TKey | `${TKey}.${RecordPath<NonNullable<TRecord[TKey]>>}`
        }[keyof TRecord & string]
      : never

export type RecordPathValue<TRecord, TPath extends string> = TPath extends keyof TRecord
  ? TRecord[TPath]
  : TRecord extends readonly (infer TItem)[]
    ? TPath extends `${number}.${infer TTail}`
      ? RecordPathValue<TItem, TTail>
      : TPath extends `${number}`
        ? TItem
        : never
    : TPath extends `${infer THead}.${infer TTail}`
      ? THead extends keyof TRecord
        ? RecordPathValue<NonNullable<TRecord[THead]>, TTail>
        : never
      : never

export type RecordPathFor<TRecord, TValue> = {
  [TPath in RecordPath<TRecord>]: NonNullable<RecordPathValue<TRecord, TPath>> extends TValue ? TPath : never
}[RecordPath<TRecord>]

export type RelationPath<TRecord> = {
  [TPath in RecordPath<TRecord>]: NonNullable<RecordPathValue<TRecord, TPath>> extends readonly object[] | object
    ? TPath
    : never
}[RecordPath<TRecord>]

export type RelatedRecord<TValue> = NonNullable<TValue> extends readonly (infer TItem)[]
  ? TItem
  : NonNullable<TValue>

export type ColumnAlignment = 'center' | 'end' | 'start'
export type ColumnAggregate = 'average' | 'max' | 'min' | 'sum'

export interface ColumnResolverContext<TRecord, TPath extends RecordPath<TRecord>> {
  readonly path: TPath
  readonly record: Readonly<TRecord>
  readonly value: RecordPathValue<TRecord, TPath>
}

export type ColumnResolver<TRecord, TPath extends RecordPath<TRecord>, TValue> = (
  context: ColumnResolverContext<TRecord, TPath>,
) => TValue | Promise<TValue>

export interface ColumnDataSource {
  readonly aggregate?: ColumnAggregate
  readonly field?: string
  readonly kind: 'aggregate' | 'count' | 'exists' | 'path' | 'relationship'
  readonly relation?: string
  readonly titlePath?: string
}

export interface ColumnManifest {
  readonly alignment: ColumnAlignment
  readonly copyable: boolean
  readonly dataSource: ColumnDataSource
  readonly formatters: readonly JsonObject[]
  readonly hidden: boolean
  readonly inlineEditor: JsonObject | null
  readonly label: string | null
  readonly lineClamp: number | null
  readonly path: string
  readonly searchable: boolean
  readonly sortable: boolean
  readonly toggleable: boolean
  readonly type: string
  readonly width: number | string | null
  readonly wrap: boolean
}

export interface ColumnServerHandles<TRecord, TPath extends RecordPath<TRecord>> {
  action?: ColumnResolver<TRecord, TPath, string | null>
  state?: ColumnResolver<TRecord, TPath, JsonValue>
  tooltip?: ColumnResolver<TRecord, TPath, string | null>
  url?: ColumnResolver<TRecord, TPath, string | null>
}

export interface CompiledColumnDefinition<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TType extends string = string,
> {
  readonly kind: 'column'
  readonly manifest: ColumnManifest & { readonly type: TType, readonly path: TPath }
  readonly server: ColumnServerHandles<TRecord, TPath>
}

export interface TextFormatter extends JsonObject {
  kind: string
}

export type InlineEditorKind = 'checkbox' | 'select' | 'text-input' | 'toggle'

export interface InlineEditorManifest extends JsonObject {
  action: string
  kind: InlineEditorKind
}
