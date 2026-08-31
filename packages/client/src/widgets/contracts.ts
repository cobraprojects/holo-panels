import type { JsonObject, JsonValue } from '@holo-js/panels-core'

export type WidgetClientStatus = 'error' | 'hidden' | 'idle' | 'loading' | 'ready' | 'unauthorized'
export type WidgetViewport = 'desktop' | 'mobile' | 'tablet'

export interface WidgetClientFilter extends JsonObject {
  defaultValue: JsonValue
  id: string
  label: string
}

export interface WidgetClientManifest extends JsonObject {
  filters: WidgetClientFilter[]
  id: string
  layout: { columnSpan: number | 'full', columnStart: number | null }
  lazy: boolean
  polling: { enabled: boolean, interval: number | null }
}

export interface WidgetClientState {
  readonly data: JsonValue
  readonly error: string | null
  readonly filters: Readonly<Record<string, JsonValue>>
  readonly loading: boolean
  readonly status: WidgetClientStatus
}

export interface WidgetLoadResult {
  readonly data?: JsonValue
  readonly status: 'error' | 'hidden' | 'idle' | 'ready' | 'unauthorized'
}

export type WidgetLoader = (
  widgetId: string,
  filters: Readonly<Record<string, JsonValue>>,
  signal: AbortSignal,
) => Promise<WidgetLoadResult>

export interface WidgetFilterStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

export interface WidgetScheduler {
  clear(handle: object): void
  every(callback: () => void, interval: number): object
}

export interface WidgetGridPlacement extends JsonObject {
  columnSpan: number
  columnStart: number | null
  columns: number
  widgetId: string
}

export type WidgetStateListener = (state: WidgetClientState, previous: WidgetClientState) => void
