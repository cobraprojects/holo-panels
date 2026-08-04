import type { JsonObject, JsonValue } from '../../protocol/json'
import type {
  ResponsiveValue,
  SchemaBreakpoint,
  SchemaColumnSpan,
  SchemaManifest,
  SchemaRenderSlots,
} from '../../schemas/contracts'
import type { RecordPath, RecordPathValue } from '../columns/types'
import type {
  TableFilterOperator,
  TableQueryFilter,
  TableQueryFilterDefinition,
  TableQueryScalar,
} from '../query/contracts'

export type FilterMode = 'deferred' | 'live'

export interface FilterLayout {
  readonly columnSpan?: Readonly<Partial<Record<SchemaBreakpoint, SchemaColumnSpan>>>
  readonly columnStart?: Readonly<Partial<Record<SchemaBreakpoint, number>>>
}

export type FilterResponsiveColumns = ResponsiveValue<number>
export type FilterCollectionPlacement = 'dropdown' | 'inline' | 'modal'

export interface FilterCollectionPresentation {
  readonly columns: Readonly<Partial<Record<SchemaBreakpoint, number>>>
  readonly id: string
  readonly placement: FilterCollectionPlacement
  readonly schema: SchemaManifest<Readonly<Record<string, JsonValue>>>
  readonly slots: Pick<SchemaRenderSlots, 'after' | 'before'>
}

export interface FilterManifest<TType extends string = string, TValue extends JsonValue = JsonValue> {
  readonly id: string
  readonly type: TType
  readonly label: string | null
  readonly mode: FilterMode
  readonly defaultValue: TValue
  readonly layout: FilterLayout
  readonly properties: JsonObject
}

export interface FilterExecutionContext<TContext> {
  readonly context: TContext
  readonly signal?: AbortSignal
}

export type FilterEncoder<TValue extends JsonValue, TContext> = (
  value: TValue,
  context: FilterExecutionContext<TContext>,
) => TableQueryFilter | readonly TableQueryFilter[] | null | Promise<TableQueryFilter | readonly TableQueryFilter[] | null>

export type FilterIndicatorResolver<TValue extends JsonValue, TContext> = (
  value: TValue,
  context: FilterExecutionContext<TContext>,
) => string | Promise<string>

export interface FilterServerHandles<TValue extends JsonValue, TContext> {
  readonly encode: FilterEncoder<TValue, TContext>
  readonly indicator?: FilterIndicatorResolver<TValue, TContext>
  readonly options?: (context: FilterExecutionContext<TContext>) => readonly SelectFilterOption[] | Promise<readonly SelectFilterOption[]>
}

export interface CompiledFilterDefinition<
  TValue extends JsonValue = JsonValue,
  TType extends string = string,
  TContext = unknown,
> {
  readonly kind: 'filter'
  readonly manifest: FilterManifest<TType, TValue>
  readonly queryDefinitions: Readonly<Record<string, TableQueryFilterDefinition>>
  readonly server: FilterServerHandles<TValue, TContext>
}

export interface SelectFilterOption {
  readonly value: TableQueryScalar
  readonly label: string
  readonly disabled?: boolean
}

export type TernaryFilterValue = 'all' | 'false' | 'true'
export type TrashedFilterValue = 'only' | 'with' | 'without'

export interface DateRangeFilterValue extends JsonObject {
  from: string | null
  to: string | null
}

export type AdvancedScalarType = 'boolean' | 'date' | 'number' | 'string'

export type AdvancedOperatorFor<TValue> = NonNullable<TValue> extends boolean
  ? '=' | '!=' | 'null' | 'not-null'
  : NonNullable<TValue> extends number | Date
    ? '=' | '!=' | '>' | '>=' | '<' | '<=' | 'between' | 'in' | 'not-in' | 'null' | 'not-null'
    : NonNullable<TValue> extends string
      ? '=' | '!=' | 'like' | 'in' | 'not-in' | 'null' | 'not-null'
      : never

export interface AdvancedFilterColumn<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TOperators extends readonly AdvancedOperatorFor<RecordPathValue<TRecord, TPath>>[],
> {
  readonly id: string
  readonly path: TPath
  readonly column: string
  readonly scalarType: AdvancedScalarType
  readonly operators: TOperators
}

export interface AnyAdvancedFilterColumn<TRecord> {
  readonly id: string
  readonly path: RecordPath<TRecord>
  readonly column: string
  readonly scalarType: AdvancedScalarType
  readonly operators: readonly TableFilterOperator[]
}

export type AdvancedColumnMap<TRecord> = Readonly<Record<string, AnyAdvancedFilterColumn<TRecord>>>

type AdvancedConditionForColumn<TColumn, TKey extends PropertyKey> = TColumn extends AdvancedFilterColumn<
  infer _TRecord,
  infer _TPath,
  infer TOperators
>
  ? {
      readonly column: TKey
      readonly operator: TOperators[number]
      readonly value?: JsonValue
    }
  : never

export type AdvancedFilterCondition<TColumns extends Readonly<Record<string, unknown>>> = {
  [TKey in keyof TColumns]: AdvancedConditionForColumn<TColumns[TKey], TKey>
}[keyof TColumns]

export interface AdvancedFilterValue extends JsonObject {
  conditions: JsonObject[]
}

export interface FilterIndicator {
  readonly filterId: string
  readonly label: string
  readonly value: JsonValue
}

export interface P7AFilterCompatibility {
  readonly definitions: Readonly<Record<string, TableQueryFilterDefinition>>
  readonly filters: readonly TableQueryFilter[]
}

export type SupportedFilterOperator = TableFilterOperator
