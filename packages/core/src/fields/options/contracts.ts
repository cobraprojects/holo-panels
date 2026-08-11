import type { JsonValue } from '../../protocol/json'
import type { FieldResolverContext, FormFieldPath, FormFieldValue } from '../base'

export type OptionValue = string | number
export type OptionDependencies = Readonly<Record<string, JsonValue>>

export interface ChoiceOption<TValue extends OptionValue = OptionValue> {
  readonly value: TValue
  readonly label: string
  readonly disabled?: boolean
}

export interface OptionQueryRequest<TValue extends OptionValue = OptionValue> {
  readonly panelId: string
  readonly resourceId: string
  readonly fieldId: string
  readonly tenantKey: string
  readonly locale: string
  readonly dependencies: OptionDependencies
  readonly search: string
  readonly page: number
  readonly perPage: number
  readonly selectedValues?: readonly TValue[]
}

export interface OptionPage<TValue extends OptionValue = OptionValue> {
  readonly options: readonly ChoiceOption<TValue>[]
  readonly page: number
  readonly perPage: number
  readonly hasMore: boolean
  readonly total?: number
}

export interface OptionSource<TValue extends OptionValue, TContext> {
  readonly kind: 'custom' | 'relationship' | 'resolver' | 'static'
  manifestOptions?(): readonly ChoiceOption<TValue>[]
  list(request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal): Promise<OptionPage<TValue>>
  hydrateSelected(
    request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    context: TContext,
    signal?: AbortSignal,
  ): Promise<readonly ChoiceOption<TValue>[]>
  create?(label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>
  edit?(value: TValue, label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>
}

export interface OptionServiceLimits {
  readonly maxPage?: number
  readonly maxPerPage?: number
  readonly maxSearchLength?: number
  readonly maxSelectedValues?: number
  readonly maxLabelLength?: number
}

export interface HoloOptionPage<TRecord> {
  readonly data: readonly TRecord[]
  readonly meta: {
    readonly total: number
    readonly currentPage: number
    readonly perPage: number
    readonly hasMorePages: boolean
  }
}

export interface HoloOptionQuery<TQuery, TRecord> {
  where(column: string, value: JsonValue): TQuery
  whereIn(column: string, values: readonly OptionValue[]): TQuery
  whereAny(columns: readonly string[], operator: 'like', value: string): TQuery
  orderBy(column: string, direction?: 'asc' | 'desc'): TQuery
  paginate(perPage: number, page: number): Promise<HoloOptionPage<TRecord>>
  get(): Promise<readonly TRecord[]>
}

export interface RelationshipOptionContext<TValues, TPath extends FormFieldPath<TValues>, TRecord, TQuery> {
  readonly query: TQuery
  readonly field: FieldResolverContext<TValues, TPath, TRecord>
  get<TDependencyPath extends FormFieldPath<TValues>>(
    path: TDependencyPath,
  ): FormFieldValue<TValues, TDependencyPath>
}

export type RelationshipOptionQueryModifier<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TRecord,
  TQuery,
> = (context: RelationshipOptionContext<TValues, TPath, TRecord, TQuery>) => TQuery

export interface RelationshipOptionAdapter<
  TQuery,
  TOptionRecord,
  TValue extends OptionValue,
  TContext,
> {
  readonly valueColumn: string
  readonly labelColumn: string
  readonly searchColumns: readonly string[]
  createQuery(context: TContext): TQuery
  applyAuthorizationScope(query: TQuery, context: TContext): TQuery
  applyTenantScope(query: TQuery, context: TContext): TQuery
  value(record: TOptionRecord): TValue
  label(record: TOptionRecord): string
  disabled?(record: TOptionRecord): boolean
  create?(label: string, context: TContext): Promise<TOptionRecord>
  edit?(value: TValue, label: string, context: TContext): Promise<TOptionRecord>
}
