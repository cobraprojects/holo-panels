import type {
  ClientActionManifest,
  ClientActionStore,
  ChartWidgetData,
  CustomWidgetData,
  JsonValue,
  StatsWidgetData,
  TableWidgetData,
  WidgetClientState,
  WidgetManifest,
  WidgetStat,
  WidgetStateListener,
  WidgetStore,
} from '@holo-js/panels-client'
import type { Component, VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'

export type VueWidgetStat = WidgetStat
export type VueStatsWidgetData = StatsWidgetData
export type VueChartWidgetData = ChartWidgetData
export type VueChartPoint = VueChartWidgetData['series'][number]['points'][number]
export type VueChartSeries = VueChartWidgetData['series'][number]
export type VueTableWidgetData = TableWidgetData
export type VueCustomWidgetData = CustomWidgetData
export type VueWidgetManifest = WidgetManifest

export interface VueWidgetStore {
  readonly snapshot: WidgetClientState
  activate(): Promise<void>
  load(): Promise<void>
  resetFilters(): Promise<void>
  setFilter(id: string, value: JsonValue): Promise<void>
  stop(): void
  subscribe(listener: WidgetStateListener): () => void
}

export interface VueCustomWidgetProps {
  readonly data: VueCustomWidgetData
  readonly manifest: VueWidgetManifest
}

export interface VueWidgetRendererProps {
  readonly actions?: readonly ClientActionManifest[]
  readonly actionStore?: ClientActionStore<unknown>
  readonly manifest: VueWidgetManifest
  readonly onAction?: (action: string, stat: VueWidgetStat) => void | Promise<void>
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly renderTable?: (data: VueTableWidgetData) => VNodeChild
  readonly store: VueWidgetStore | WidgetStore
}

export interface VueDashboardWidget extends VueWidgetRendererProps {
  readonly key?: string
}

export interface VueDashboardRendererProps {
  readonly dashboardId: string
  readonly label: string
  readonly viewportWidth: number
  readonly widgets: readonly VueDashboardWidget[]
}

export interface VueResourceWidgetsProps {
  readonly pageId: string
  readonly placement: 'footer' | 'header'
  readonly resourceId: string
  readonly viewportWidth: number
  readonly widgets: readonly VueDashboardWidget[]
}

export type VueWidgetComponent = Component<VueCustomWidgetProps>
export type VueWidgetData = JsonValue
