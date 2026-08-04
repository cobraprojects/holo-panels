import { resolveWidgetGrid, type JsonObject, type JsonValue } from '@holo-js/panels-client'
import type {
  SvelteDashboardWidget,
  SvelteWidgetGridItem,
  SvelteWidgetManifest,
} from './contracts'

export interface SvelteWidgetStat {
  readonly action: string | null
  readonly chart: readonly number[]
  readonly color: string | null
  readonly description: string | null
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly trend: 'down' | 'neutral' | 'up' | null
  readonly url: string | null
  readonly value: number | string
}

export interface SvelteChartSeries {
  readonly color: string | null
  readonly id: string
  readonly label: string
  readonly points: readonly { readonly label: string, readonly value: number }[]
}

export interface SvelteChartData {
  readonly description: string
  readonly series: readonly SvelteChartSeries[]
  readonly summary: string
  readonly type: 'area' | 'bar' | 'line' | 'pie'
}

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value : null
}

export function statsData(value: JsonValue): readonly SvelteWidgetStat[] {
  const stats = objectValue(value)?.stats
  if (!Array.isArray(stats)) return []
  return stats.flatMap(item => {
    const record = objectValue(item)
    if (!record || typeof record.id !== 'string' || typeof record.label !== 'string') return []
    if (typeof record.value !== 'string' && typeof record.value !== 'number') return []
    const chart = Array.isArray(record.chart)
      ? record.chart.flatMap(point => typeof point === 'number' && Number.isFinite(point) ? [point] : [])
      : []
    return [{
      action: typeof record.action === 'string' ? record.action : null,
      chart,
      color: typeof record.color === 'string' ? record.color : null,
      description: typeof record.description === 'string' ? record.description : null,
      icon: typeof record.icon === 'string' ? record.icon : null,
      id: record.id,
      label: record.label,
      trend: record.trend === 'down' || record.trend === 'neutral' || record.trend === 'up' ? record.trend : null,
      url: safeWidgetUrl(record.url),
      value: record.value,
    }]
  })
}

export function chartData(value: JsonValue): SvelteChartData | null {
  const record = objectValue(value)
  if (!record || typeof record.description !== 'string' || !record.description.trim()) return null
  if (typeof record.summary !== 'string' || !record.summary.trim() || !Array.isArray(record.series)) return null
  if (record.type !== 'area' && record.type !== 'bar' && record.type !== 'line' && record.type !== 'pie') return null
  const ids = new Set<string>()
  const series: SvelteChartSeries[] = []
  for (const item of record.series) {
    const entry = objectValue(item)
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.label !== 'string' || !Array.isArray(entry.points)) return null
    ids.add(entry.id)
    const points: Array<{ readonly label: string, readonly value: number }> = []
    for (const point of entry.points) {
      const dataPoint = objectValue(point)
      if (!dataPoint || typeof dataPoint.label !== 'string' || typeof dataPoint.value !== 'number' || !Number.isFinite(dataPoint.value)) return null
      points.push({ label: dataPoint.label, value: dataPoint.value })
    }
    series.push({ color: typeof entry.color === 'string' ? entry.color : null, id: entry.id, label: entry.label, points })
  }
  return { description: record.description, series, summary: record.summary, type: record.type }
}

export function chartLabels(data: SvelteChartData): readonly string[] {
  const labels: string[] = []
  for (const series of data.series) for (const point of series.points) if (!labels.includes(point.label)) labels.push(point.label)
  return labels
}

export function chartValue(series: SvelteChartSeries, label: string): number | null {
  return series.points.find(point => point.label === label)?.value ?? null
}

export function tableData(value: JsonValue): { readonly result: JsonObject, readonly tableId: string } | null {
  const record = objectValue(value)
  const result = record ? objectValue(record.result) : null
  return record && typeof record.tableId === 'string' && result ? { result, tableId: record.tableId } : null
}

export function customData(value: JsonValue): { readonly component: string, readonly properties: JsonObject } | null {
  const record = objectValue(value)
  const properties = record ? objectValue(record.properties) : null
  return record && typeof record.component === 'string' && properties ? { component: record.component, properties } : null
}

export function safeWidgetUrl(value: JsonValue | undefined): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (candidate.startsWith('/') || candidate.startsWith('#')) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null
  } catch {
    return null
  }
}

export function dashboardGrid(widgets: readonly SvelteDashboardWidget[], width: number): readonly SvelteWidgetGridItem[] {
  const sorted = [...widgets].sort((left, right) => left.manifest.sort - right.manifest.sort || left.manifest.id.localeCompare(right.manifest.id))
  const placements = resolveWidgetGrid(sorted.map(widget => widget.manifest), width)
  return sorted.map((widget, index) => ({ placement: placements[index]!, widget }))
}

export function gridStyle(item: SvelteWidgetGridItem): string {
  const start = item.placement.columnStart === null ? '' : `grid-column-start:${item.placement.columnStart};`
  return `${start}grid-column-end:span ${item.placement.columnSpan}`
}

export function widgetLabel(manifest: SvelteWidgetManifest): string {
  return manifest.heading ?? manifest.id
}
