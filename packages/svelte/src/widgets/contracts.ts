import type {
  JsonObject,
  JsonValue,
  WidgetClientManifest,
  WidgetClientState,
  WidgetGridPlacement,
  WidgetStateListener,
} from '@holo-js/panels-client'
import type { Component } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'

export type SvelteWidgetFamily = 'chart' | 'custom' | 'stats' | 'table'

export interface SvelteWidgetManifest extends WidgetClientManifest {
  readonly description: string | null
  readonly emptyState: string
  readonly errorState: string
  readonly family: SvelteWidgetFamily
  readonly heading: string | null
  readonly sort: number
  readonly type: string
}

export interface SvelteWidgetStore {
  readonly snapshot: WidgetClientState
  activate(): Promise<void>
  load(): Promise<void>
  setFilter(id: string, value: JsonValue): Promise<void>
  stop(): void
  subscribe(listener: WidgetStateListener): () => void
}

export interface SvelteTableWidgetProps extends Record<string, unknown> {
  readonly result: JsonObject
  readonly tableId: string
  readonly widgetId: string
}

export interface SvelteCustomWidgetProps extends Record<string, unknown> {
  readonly properties: JsonObject
  readonly widgetId: string
}

export interface SvelteWidgetRendererProps extends Record<string, unknown> {
  readonly manifest: SvelteWidgetManifest
  readonly onAction?: (actionId: string, widgetId: string) => Promise<void> | void
  readonly panelId?: string
  readonly placement?: 'dashboard' | 'resource-footer' | 'resource-header'
  readonly registry?: SvelteComponentRegistry
  readonly store: SvelteWidgetStore
  readonly tableRenderer?: Component<SvelteTableWidgetProps>
}

export interface SvelteDashboardWidget extends SvelteWidgetRendererProps {
  readonly placement: 'dashboard' | 'resource-footer' | 'resource-header'
}

export interface SvelteDashboardRendererProps extends Record<string, unknown> {
  readonly dashboardId?: string
  readonly label: string
  readonly placement?: SvelteDashboardWidget['placement']
  readonly widgets: readonly SvelteDashboardWidget[]
  readonly width: number
}

export interface SvelteWidgetGridItem {
  readonly placement: WidgetGridPlacement
  readonly widget: SvelteDashboardWidget
}
