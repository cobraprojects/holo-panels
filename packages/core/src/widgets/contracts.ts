import type { JsonObject, JsonValue } from '../protocol/json'
import type { ActionManifest } from '../actions/contracts'
import type { RegisteredAction } from '../actions/registration'
import type { TableQueryState } from '../tables/query/contracts'

export type WidgetFamily = 'chart' | 'custom' | 'stats' | 'table'
export type WidgetColumnSpan = number | 'full'
export type WidgetResourcePlacement = 'footer' | 'header'

export interface WidgetLayout extends JsonObject {
  columnSpan: WidgetColumnSpan
  columnStart: number | null
}

export interface WidgetPolling extends JsonObject {
  enabled: boolean
  interval: number | null
}

export interface WidgetFilterDefinition extends JsonObject {
  defaultValue: JsonValue
  id: string
  label: string
}

export interface WidgetManifest extends JsonObject {
  description: string | null
  emptyState: string
  errorState: string
  family: WidgetFamily
  filters: WidgetFilterDefinition[]
  heading: string | null
  id: string
  layout: WidgetLayout
  lazy: boolean
  polling: WidgetPolling
  sort: number
  type: string
}

export interface WidgetContext<TActor, TTenant, TServices> {
  readonly actor: TActor
  readonly locale: string
  readonly panelId: string
  readonly services: TServices
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface ResourceWidgetContext<TRecord, TActor, TTenant, TServices> extends WidgetContext<TActor, TTenant, TServices> {
  readonly pageId: string
  readonly placement: WidgetResourcePlacement
  readonly record: Readonly<TRecord> | null
  readonly resourceId: string
  readonly tableState: Readonly<TableQueryState> | null
}

export type WidgetFilterState = Readonly<Record<string, JsonValue>>

export interface WidgetDataContext<TActor, TTenant, TServices, TRecord extends object = object> extends WidgetContext<TActor, TTenant, TServices> {
  readonly filters: WidgetFilterState
  readonly resource: ResourceWidgetContext<TRecord, TActor, TTenant, TServices> | null
}

export interface WidgetServerHandles<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object = object> {
  readonly actions?: readonly RegisteredAction<TRecord>[]
  readonly authorize: (context: WidgetContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>
  readonly data: (context: WidgetDataContext<TActor, TTenant, TServices, TRecord>) => TData | Promise<TData>
  readonly visible: (context: WidgetContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>
}

export interface CompiledWidgetDefinition<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object = object> {
  readonly kind: 'widget'
  readonly manifest: WidgetManifest
  readonly server: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>
}

export interface WidgetStat extends JsonObject {
  action: string | null
  chart: number[]
  color: string | null
  description: string | null
  icon: string | null
  id: string
  label: string
  trend: 'down' | 'neutral' | 'up' | null
  url: string | null
  value: number | string
}

export interface StatsWidgetData extends JsonObject {
  stats: WidgetStat[]
}

export interface ChartPoint extends JsonObject {
  label: string
  value: number
}

export interface ChartSeries extends JsonObject {
  color: string | null
  id: string
  label: string
  points: ChartPoint[]
}

export interface ChartWidgetData extends JsonObject {
  description: string
  series: ChartSeries[]
  summary: string
  type: 'area' | 'bar' | 'line' | 'pie'
}

export interface AccessibleChartRow extends JsonObject {
  label: string
  values: (number | null)[]
}

export interface AccessibleChartModel extends JsonObject {
  caption: string
  columns: string[]
  description: string
  rows: AccessibleChartRow[]
}

export interface AccessibleChartRenderer<TOutput> {
  render(data: ChartWidgetData, accessibility: AccessibleChartModel): TOutput
}

export interface TableWidgetData extends JsonObject {
  result: JsonObject
  tableId: string
}

export interface CustomWidgetData extends JsonObject {
  component: string
  properties: JsonObject
}

export interface ResolvedWidget<TData extends JsonValue> {
  readonly actions?: readonly Readonly<ActionManifest>[]
  readonly resourceId?: string
  readonly data: TData | null
  readonly manifest: WidgetManifest
  readonly status: 'hidden' | 'ready' | 'unauthorized'
}

export interface DashboardNavigation extends JsonObject {
  icon: string | null
  label: string
  sort: number
}

export interface DashboardManifest extends JsonObject {
  default: boolean
  id: string
  navigation: DashboardNavigation
  path: string
  widgets: string[]
}

export type DashboardContext<TActor, TTenant, TServices> = WidgetContext<TActor, TTenant, TServices>

export interface CompiledDashboardDefinition<TActor, TTenant, TServices> {
  readonly kind: 'dashboard'
  readonly manifest: DashboardManifest
  readonly server: {
    readonly authorize: (context: DashboardContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>
  }
}
