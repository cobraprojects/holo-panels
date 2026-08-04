import type { JsonValue } from '../../protocol/json'
import type { RecordPath } from '../columns/types'
import type {
  AggregateDriver,
  CompiledGroupDefinition,
  CompiledSummaryDefinition,
  GroupedAggregateRow,
  GroupedSummaryDriverAdapter,
  HoloAggregateQuery,
  SummaryAggregateRequest,
  SummaryDriverAdapter,
  SummaryKind,
  SummaryResult,
} from './types'
import { normalizeAggregateNumber, safeJson, valueAtPath } from './validation'

interface ExecutableSummary<TRecord, TContext> {
  readonly definition: CompiledSummaryDefinition<TRecord, RecordPath<TRecord> | null, TContext>
}

function assertUniqueSummaries<TRecord, TContext>(definitions: readonly ExecutableSummary<TRecord, TContext>[]): void {
  const ids = new Set<string>()
  for (const { definition } of definitions) {
    if (ids.has(definition.manifest.id)) throw new Error(`Duplicate summary definition: ${definition.manifest.id}`)
    ids.add(definition.manifest.id)
  }
}

function normalizeComparable(value: unknown): number | string | null {
  if (value === null || typeof value === 'undefined') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return value
  throw new Error('Summary values must be numbers, strings, dates, or null')
}

function pageSummary<TRecord>(kind: Exclude<SummaryKind, 'custom'>, path: string | null, records: readonly TRecord[]): JsonValue {
  if (kind === 'count') return records.length
  if (!path) throw new Error(`${kind} summaries require a path`)
  const values = records.map(record => normalizeComparable(valueAtPath(record, path))).filter(value => value !== null)
  if (values.length === 0) return kind === 'sum' ? 0 : null
  if (kind === 'sum' || kind === 'average' || kind === 'range') {
    if (values.some(value => typeof value !== 'number')) throw new Error(`${kind} summaries require numeric values`)
    const numbers = values as number[]
    if (kind === 'sum') return numbers.reduce((total, value) => total + value, 0)
    if (kind === 'average') return numbers.reduce((total, value) => total + value, 0) / numbers.length
    return Math.max(...numbers) - Math.min(...numbers)
  }
  const ordered = [...values].sort((left, right) => (
    typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
  ))
  return kind === 'min' ? ordered[0] ?? null : ordered.at(-1) ?? null
}

export function asExecutableSummary<
  TRecord,
  TPath extends RecordPath<TRecord> | null,
  TContext,
>(definition: CompiledSummaryDefinition<TRecord, TPath, TContext>): ExecutableSummary<TRecord, TContext> {
  return { definition: definition as CompiledSummaryDefinition<TRecord, RecordPath<TRecord> | null, TContext> }
}

export async function executePageSummaries<TRecord, TContext>(
  definitions: readonly ExecutableSummary<TRecord, TContext>[],
  records: readonly TRecord[],
  context: TContext,
): Promise<readonly SummaryResult[]> {
  assertUniqueSummaries(definitions)
  return Promise.all(definitions.filter(({ definition }) => definition.manifest.mode === 'page').map(async ({ definition }) => {
    const value = definition.manifest.kind === 'custom'
      ? await definition.server.custom?.({ context, mode: 'page', records }) ?? null
      : pageSummary(definition.manifest.kind, definition.manifest.path, records)
    return Object.freeze({
      id: definition.manifest.id,
      kind: definition.manifest.kind,
      mode: definition.manifest.mode,
      value: safeJson(value, `Summary ${definition.manifest.id}`),
    })
  }))
}

function aggregateRequest<TRecord, TContext>(summary: ExecutableSummary<TRecord, TContext>): SummaryAggregateRequest | null {
  const { manifest } = summary.definition
  if (manifest.kind === 'custom') return null
  return { id: manifest.id, kind: manifest.kind, column: manifest.column }
}

export async function executeFullQuerySummaries<TQuery, TRecord, TContext>(
  definitions: readonly ExecutableSummary<TRecord, TContext>[],
  scopedQuery: TQuery,
  adapter: SummaryDriverAdapter<TQuery>,
  context: TContext,
): Promise<readonly SummaryResult[]> {
  assertUniqueSummaries(definitions)
  const selected = definitions.filter(({ definition }) => definition.manifest.mode === 'full-query')
  const requests = selected.map(aggregateRequest).filter((request): request is SummaryAggregateRequest => request !== null)
  const aggregateValues = requests.length > 0 ? await adapter.execute(scopedQuery, requests) : {}
  return Promise.all(selected.map(async ({ definition }) => {
    const value = definition.manifest.kind === 'custom'
      ? await definition.server.custom?.({ context, mode: 'full-query' }) ?? null
      : aggregateValues[definition.manifest.id]
    if (typeof value === 'undefined') throw new Error(`Summary adapter omitted ${definition.manifest.id}`)
    return Object.freeze({
      id: definition.manifest.id,
      kind: definition.manifest.kind,
      mode: definition.manifest.mode,
      value,
    })
  }))
}

export function createHoloSummaryAdapter<TQuery extends HoloAggregateQuery>(
  driver: AggregateDriver,
): SummaryDriverAdapter<TQuery> {
  return {
    driver,
    async execute(query, requests) {
      const entries = await Promise.all(requests.map(async request => {
        if (request.kind === 'count') return [request.id, await query.count()] as const
        if (!request.column) throw new Error(`${request.kind} summary ${request.id} requires a column`)
        if (request.kind === 'sum') return [request.id, normalizeAggregateNumber(await query.sum(request.column), driver) ?? 0] as const
        if (request.kind === 'average') return [request.id, normalizeAggregateNumber(await query.avg(request.column), driver)] as const
        if (request.kind === 'min') return [request.id, normalizeAggregateNumber(await query.min(request.column), driver)] as const
        if (request.kind === 'max') return [request.id, normalizeAggregateNumber(await query.max(request.column), driver)] as const
        const [minimum, maximum] = await Promise.all([query.min(request.column), query.max(request.column)])
        const normalizedMinimum = normalizeAggregateNumber(minimum, driver)
        const normalizedMaximum = normalizeAggregateNumber(maximum, driver)
        return [request.id, normalizedMinimum === null || normalizedMaximum === null ? null : normalizedMaximum - normalizedMinimum] as const
      }))
      return Object.freeze(Object.fromEntries(entries))
    },
  }
}

export async function executeGroupedFullQuery<
  TQuery,
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext,
>(
  scopedQuery: TQuery,
  group: CompiledGroupDefinition<TRecord, TPath, TContext>,
  summaries: readonly ExecutableSummary<TRecord, TContext>[],
  adapter: GroupedSummaryDriverAdapter<TQuery>,
  order = group.manifest.order,
): Promise<readonly GroupedAggregateRow[]> {
  const requests = summaries
    .filter(summary => summary.definition.manifest.mode === 'full-query')
    .map(aggregateRequest)
    .filter((request): request is SummaryAggregateRequest => request !== null)
  return adapter.execute(scopedQuery, {
    groupColumn: group.manifest.column,
    order,
    summaries: requests,
  })
}
