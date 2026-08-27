import type { JsonObject, JsonValue } from '../../protocol/json'
import type { RegisteredAction } from '../../actions/registration'
import type {
  RenderSlotReference,
  ResponsiveValue,
  SchemaColumnSpan,
  SchemaLayoutProperties,
  SchemaRenderSlots,
} from '../../schemas/contracts'
import type { RecordPath, RecordPathValue, RelationPath, RelatedRecord } from '../../tables/columns/types'

export type EntryRecordPath<TRecord> = RecordPath<TRecord>
export type EntryRecordPathValue<TRecord, TPath extends EntryRecordPath<TRecord>> = RecordPathValue<TRecord, TPath>
export type EntryRelationPath<TRecord> = RelationPath<TRecord>
export type EntryRelatedRecord<TValue> = RelatedRecord<TValue>

export interface EntryResolverContext<TRecord, TValue> {
  readonly locale: string
  readonly record: Readonly<TRecord>
  readonly value: TValue
}

export type EntryResolver<TRecord, TValue, TResult> = (
  context: EntryResolverContext<TRecord, TValue>,
) => TResult | Promise<TResult>

export type EntryStateSource =
  | { readonly kind: 'computed', readonly id: string }
  | { readonly kind: 'json', readonly path: string }
  | { readonly kind: 'path', readonly path: string }
  | { readonly kind: 'relationship', readonly path: string, readonly titlePath: string }

export interface EntryFormat extends JsonObject {
  readonly kind: string
}

export interface EntryManifest {
  readonly actions: readonly string[]
  readonly copyable: boolean
  readonly defaultValue: JsonValue
  readonly dynamicVisibility: boolean
  readonly extraAttributes: JsonObject
  readonly formatters: readonly EntryFormat[]
  readonly inlineLabel: boolean
  readonly label: string | null
  readonly layout: SchemaLayoutProperties
  readonly path: string | null
  readonly placeholder: string | null
  readonly properties: JsonObject
  readonly source: EntryStateSource
  readonly slots: SchemaRenderSlots
  readonly type: string
  readonly visible: boolean
}

export interface EntryServerHandles<TRecord, TValue> {
  readonly actions?: readonly RegisteredAction<TRecord>[]
  readonly visibility?: EntryResolver<TRecord, TValue, boolean>
  readonly state?: EntryResolver<TRecord, TValue, unknown>
  readonly tooltip?: EntryResolver<TRecord, TValue, string | null>
  readonly url?: EntryResolver<TRecord, TValue, string | null>
}

export type EntryColumnSpan = ResponsiveValue<SchemaColumnSpan>
export type EntryColumnStart = ResponsiveValue<number>
export type EntrySlotReference = string | RenderSlotReference

export interface CompiledEntryDefinition<
  TRecord,
  TValue,
  TType extends string = string,
> {
  readonly kind: 'entry'
  readonly manifest: EntryManifest & { readonly type: TType }
  readonly server: EntryServerHandles<TRecord, TValue>
}

export interface EntryRendererProps<TState = JsonValue> {
  readonly actions: readonly string[]
  readonly copyable: boolean
  readonly label: string | null
  readonly state: TState
  readonly tooltip: string | null
  readonly url: string | null
}

export interface EntryRendererRegistration<TType extends string = string> {
  readonly type: TType
  readonly source: string
}

export interface EntryRendererRegistryContract<TRenderer> {
  has(type: string): boolean
  register<TType extends string>(registration: EntryRendererRegistration<TType>, renderer: TRenderer): () => void
  resolve(type: string, requestedFrom?: string): TRenderer
}
