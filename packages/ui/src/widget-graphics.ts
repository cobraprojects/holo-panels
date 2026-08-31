import { panelColorValue } from './colors'

interface GraphicSeries {
  readonly id: string
  readonly color: string | null
  readonly points: readonly { readonly label: string, readonly value: number }[]
}

interface GraphicData {
  readonly type: 'area' | 'bar' | 'line' | 'pie'
  readonly series: readonly GraphicSeries[]
}

export interface WidgetChartMark {
  readonly key: string
  readonly kind: 'area' | 'bar' | 'line' | 'slice'
  readonly series: string
  readonly label: string
  readonly path: string
  readonly color: string
  readonly opacity: number
}

export function widgetSparklinePoints(values: readonly number[]): string | null {
  if (values.length < 2 || values.some(value => !Number.isFinite(value))) return null
  const minimum = Math.min(...values)
  const range = Math.max(...values) - minimum || 1
  return values.map((value, index) => `${index * 100 / (values.length - 1)},${28 - (value - minimum) / range * 24}`).join(' ')
}

export function widgetChartMarks(data: GraphicData): readonly WidgetChartMark[] {
  const labels = [...new Set(data.series.flatMap(series => series.points.map(point => point.label)))]
  const values = data.series.flatMap(series => series.points.map(point => point.value))
  if (values.some(value => !Number.isFinite(value))) return []
  const minimum = Math.min(0, ...values)
  const range = Math.max(0, ...values) - minimum || 1
  const y = (value: number): number => 96 - (value - minimum) / range * 92
  const baseline = y(0)
  const x = (label: string): number => labels.indexOf(label) * 100 / Math.max(1, labels.length - 1)
  const color = (series: GraphicSeries, index: number): string => panelColorValue(series.color) ?? `var(--hp-chart-${index % 5 + 1}, currentColor)`
  if (data.type === 'pie') return pieMarks(data.series, color)
  return data.series.flatMap<WidgetChartMark>((series, seriesIndex) => {
    const base = { color: color(series, seriesIndex), label: '', series: series.id, opacity: 1 }
    if (data.type === 'bar') {
      const slot = 100 / Math.max(1, labels.length)
      const width = slot * 0.8 / Math.max(1, data.series.length)
      return series.points.map(point => {
        const left = labels.indexOf(point.label) * slot + slot * 0.1 + seriesIndex * width
        const top = y(point.value)
        return { ...base, key: `${series.id}:${point.label}`, kind: 'bar' as const, label: point.label, path: `M ${left} ${baseline} L ${left} ${top} L ${left + width * 0.9} ${top} L ${left + width * 0.9} ${baseline} Z` }
      })
    }
    const points = [...series.points].sort((left, right) => labels.indexOf(left.label) - labels.indexOf(right.label))
    const first = points[0]
    const last = points.at(-1)
    if (!first || !last) return []
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.label)} ${y(point.value)}`).join(' ')
    const mark = { ...base, key: series.id, kind: 'line' as const, path: line }
    return data.type === 'area'
      ? [{ ...base, key: `${series.id}:area`, kind: 'area' as const, opacity: 0.2, path: `${line} L ${x(last.label)} ${baseline} L ${x(first.label)} ${baseline} Z` }, mark]
      : [mark]
  })
}

function pieMarks(series: readonly GraphicSeries[], color: (series: GraphicSeries, index: number) => string): readonly WidgetChartMark[] {
  const slices = series.flatMap((entry, index) => entry.points.filter(point => point.value > 0).map(point => ({ entry, index, point })))
  const total = slices.reduce((sum, slice) => sum + slice.point.value, 0)
  let angle = -Math.PI / 2
  return slices.map((slice, index) => {
    const start = angle
    const sweep = slice.point.value / total * Math.PI * 2
    angle += sweep
    const path = slices.length === 1
      ? 'M 50 6 A 44 44 0 1 1 50 94 A 44 44 0 1 1 50 6 Z'
      : `M 50 50 L ${50 + 44 * Math.cos(start)} ${50 + 44 * Math.sin(start)} A 44 44 0 ${sweep > Math.PI ? 1 : 0} 1 ${50 + 44 * Math.cos(angle)} ${50 + 44 * Math.sin(angle)} Z`
    return { key: `${slice.entry.id}:${slice.point.label}`, kind: 'slice', series: slice.entry.id, label: slice.point.label, path, color: color(slice.entry, slice.index), opacity: Math.max(0.35, 1 - index * 0.12) }
  })
}
