import type { JsonObject, JsonValue } from '../../protocol/json'
import type { RecordPath, RecordPathValue } from '../columns/types'

export type GroupOrder = 'asc' | 'desc'
export type SummaryKind = 'average' | 'count' | 'custom' | 'max' | 'min' | 'range' | 'sum'
export type SummaryMode = 'full-query' | 'page'
export type AggregateDriver = 'mysql' | 'postgres' | 'sqlite'
export type AggregatePrimitive = bigint | number | string | null

export interface GroupManifest<TPath extends string = string> {
  readonly id: string
  readonly path: TPath
  readonly column: string
  readonly label: string | null
  readonly collapsible: boolean
  readonly collapsed: boolean
  readonly order: GroupOrder
  readonly persistKey: string
}

export interface GroupResolverContext<TRecord, TPath extends RecordPath<TRecord>, TContext> {
  readonly context: TContext
  readonly path: TPath
  readonly value: RecordPathValue<TRecord, TPath>
  readonly records: readonly TRecord[]
}

export type GroupResolver<TRecord, TPath extends RecordPath<TRecord>, TContext> = (
  context: GroupResolverContext<TRecord, TPath, TContext>,
) => string | null | Promise<string | null>

export interface CompiledGroupDefinition<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext = unknown,
> {
  readonly kind: 'group'
  readonly manifest: GroupManifest<TPath>
  readonly server: {
    readonly title?: GroupResolver<TRecord, TPath, TContext>
    readonly description?: GroupResolver<TRecord, TPath, TContext>
  }
}

export interface GroupStateSnapshot {
  readonly order: GroupOrder
  readonly collapsed: readonly string[]
}

export interface GroupedRecords<TRecord> {
  readonly key: string
  readonly value: JsonValue
  readonly title: string | null
  readonly description: string | null
  readonly collapsed: boolean
  readonly records: readonly TRecord[]
}

export interface SummaryManifest<TPath extends string | null = string | null> {
  readonly id: string
  readonly kind: SummaryKind
  readonly mode: SummaryMode
  readonly path: TPath
  readonly column: string | null
  readonly label: string | null
  readonly properties: JsonObject
}

export interface SummaryResult {
  readonly id: string
  readonly kind: SummaryKind
  readonly mode: SummaryMode
  readonly value: JsonValue
}

export interface SummaryResolverContext<TRecord, TContext> {
  readonly context: TContext
  readonly mode: SummaryMode
  readonly records?: readonly TRecord[]
}

export type CustomSummaryResolver<TRecord, TContext> = (
  context: SummaryResolverContext<TRecord, TContext>,
) => JsonValue | Promise<JsonValue>

export interface CompiledSummaryDefinition<
  TRecord,
  TPath extends RecordPath<TRecord> | null = RecordPath<TRecord> | null,
  TContext = unknown,
> {
  readonly kind: 'summary'
  readonly manifest: SummaryManifest<TPath>
  readonly server: {
    readonly custom?: CustomSummaryResolver<TRecord, TContext>
  }
}

export interface SummaryAggregateRequest {
  readonly id: string
  readonly kind: Exclude<SummaryKind, 'custom'>
  readonly column: string | null
}

export interface HoloAggregateQuery {
  count(): Promise<number>
  sum(column: string): Promise<AggregatePrimitive>
  avg(column: string): Promise<AggregatePrimitive>
  min(column: string): Promise<AggregatePrimitive>
  max(column: string): Promise<AggregatePrimitive>
}

export interface SummaryDriverAdapter<TQuery> {
  readonly driver: AggregateDriver
  execute(query: TQuery, requests: readonly SummaryAggregateRequest[]): Promise<Readonly<Record<string, JsonValue>>>
}

export interface GroupedAggregateRequest {
  readonly groupColumn: string
  readonly order: GroupOrder
  readonly summaries: readonly SummaryAggregateRequest[]
}

export interface GroupedAggregateRow {
  readonly key: JsonValue
  readonly values: Readonly<Record<string, JsonValue>>
}

export interface GroupedSummaryDriverAdapter<TQuery> {
  execute(query: TQuery, request: GroupedAggregateRequest): Promise<readonly GroupedAggregateRow[]>
}
