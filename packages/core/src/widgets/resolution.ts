import { toJsonValue } from '../protocol/serialization'
import { createPanelTranslator } from '../translations/presentation'
import { compileActionManifest, resolveActionState } from '../actions/action'
import type { JsonValue } from '../protocol/json'
import type { TableQueryResult, TableQueryState } from '../tables/query/contracts'
import type {
  AccessibleChartModel,
  AccessibleChartRenderer,
  ChartWidgetData,
  CompiledWidgetDefinition,
  ResourceWidgetContext,
  ResolvedWidget,
  TableWidgetData,
  WidgetContext,
  WidgetDataContext,
  WidgetFilterState,
} from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const WIDGET_RENDERER_IDENTIFIER = /^[a-z][a-z0-9.-]*:widget:[a-z][a-z0-9._-]*$/u

export class WidgetAccessError extends Error {
  constructor(readonly widgetId: string) {
    super(`Widget ${widgetId} is not authorized`)
    this.name = 'WidgetAccessError'
  }
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

function validatedFilters<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object>(
  definition: CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>,
  filters: WidgetFilterState,
): WidgetFilterState {
  const allowed = new Map(definition.manifest.filters.map(filter => [filter.id, filter]))
  for (const key of Object.keys(filters)) {
    if (!allowed.has(key)) throw new Error(`Unknown widget filter ${key}`)
  }
  const result = Object.fromEntries(definition.manifest.filters.map(filter => [filter.id, filters[filter.id] ?? filter.defaultValue]))
  toJsonValue(result)
  return Object.freeze(result)
}

export async function resolveWidget<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object = object>(
  definition: CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>,
  context: WidgetContext<TActor, TTenant, TServices>,
  filters: WidgetFilterState = {},
  resource: ResourceWidgetContext<TRecord, TActor, TTenant, TServices> | null = null,
  options: { readonly dashboardFilters?: WidgetFilterState, readonly defer?: boolean } = {},
): Promise<ResolvedWidget<TData>> {
  const translate = createPanelTranslator(context.locale)
  const manifest = {
    ...definition.manifest,
    emptyState: definition.server.defaultEmptyState ? translate('widgets.empty') : definition.manifest.emptyState,
    errorState: definition.server.defaultErrorState ? translate('widgets.error') : definition.manifest.errorState,
  }
  assertNotAborted(context.signal)
  if (!await definition.server.authorize(context)) return { data: null, manifest, status: 'unauthorized' }
  assertNotAborted(context.signal)
  if (!await definition.server.visible(context)) return { data: null, manifest, status: 'hidden' }
  assertNotAborted(context.signal)
  const actions = await Promise.all((definition.server.actions ?? []).map(async (action) => {
    const scope = { ...context, mount: action.mount, record: resource?.record ?? null }
    const state = await resolveActionState(action, scope)
    return compileActionManifest(action, state.label, scope, state)
  }))
  const metadata = { ...(actions.length > 0 ? { actions } : {}), ...(resource ? { resourceId: resource.resourceId } : {}) }
  if (options.defer) return { ...metadata, data: null, manifest, status: 'idle' }
  const dataContext: WidgetDataContext<TActor, TTenant, TServices, TRecord> = { ...context, filters: { ...options.dashboardFilters, ...validatedFilters(definition, filters) }, resource }
  const data = await definition.server.data(dataContext)
  assertNotAborted(context.signal)
  toJsonValue(data)
  if (definition.manifest.family === 'custom') {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.component !== 'string' || !IDENTIFIER.test(data.component) && !WIDGET_RENDERER_IDENTIFIER.test(data.component)) throw new Error('Custom widgets require a registered renderer identifier')
    if (!data.properties || typeof data.properties !== 'object' || Array.isArray(data.properties)) throw new Error('Custom widgets require serializable properties')
  }
  if (definition.manifest.family === 'stats' && data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.stats)) {
    for (const stat of data.stats) {
      if (!stat || typeof stat !== 'object' || Array.isArray(stat) || stat.progress === undefined || stat.progress === null) continue
      const progress = stat.progress
      if (typeof progress !== 'object' || Array.isArray(progress) || typeof progress.value !== 'number' || typeof progress.max !== 'number' || !Number.isFinite(progress.value) || !Number.isFinite(progress.max) || progress.max <= 0 || progress.value < 0 || progress.value > progress.max) {
        throw new Error('Stat progress requires a value between zero and a positive maximum')
      }
    }
  }
  return { ...metadata, data, manifest, status: 'ready' }
}

export interface TableWidgetExecutor<TRecord, TContext> {
  execute(state: TableQueryState, context: TContext): Promise<TableQueryResult<TRecord>>
}

export async function resolveTableWidgetData<TRecord, TContext>(
  tableId: string,
  executor: TableWidgetExecutor<TRecord, TContext>,
  state: TableQueryState,
  context: TContext,
): Promise<TableWidgetData> {
  if (!IDENTIFIER.test(tableId)) throw new Error('Table widgets require a stable table ID')
  const serialized = toJsonValue(await executor.execute(state, context))
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('Table widget results must be JSON objects')
  return { result: serialized, tableId }
}

export function requireResolvedWidget<TData extends JsonValue>(widget: ResolvedWidget<TData>): TData {
  if (widget.status === 'unauthorized') throw new WidgetAccessError(widget.manifest.id)
  if (widget.status !== 'ready' || widget.data === null) throw new Error(`Widget ${widget.manifest.id} has no resolved data`)
  return widget.data
}

export function createAccessibleChartModel(data: ChartWidgetData): AccessibleChartModel {
  if (!data.description.trim() || !data.summary.trim()) throw new Error('Charts require an accessible description and summary')
  const seriesIds = new Set<string>()
  const labels: string[] = []
  for (const series of data.series) {
    if (!series.id || seriesIds.has(series.id)) throw new Error('Chart series require unique stable IDs')
    seriesIds.add(series.id)
    for (const point of series.points) {
      if (!Number.isFinite(point.value)) throw new Error('Chart points require finite values')
      if (!labels.includes(point.label)) labels.push(point.label)
    }
  }
  return {
    caption: data.summary,
    columns: data.series.map(series => series.label),
    description: data.description,
    rows: labels.map(label => ({
      label,
      values: data.series.map(series => series.points.find(point => point.label === label)?.value ?? null),
    })),
  }
}

export function renderAccessibleChart<TOutput>(data: ChartWidgetData, renderer: AccessibleChartRenderer<TOutput>): TOutput {
  return renderer.render(data, createAccessibleChartModel(data))
}
