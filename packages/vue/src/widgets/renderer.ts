import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  PanelsIcon,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../internal-ui'
import { safeExternalUrl } from '@holo-js/panels-client'
import { panelColorAppearance } from '@holo-js/panels-ui'
import {
  defineComponent,
  h,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  type Component,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import type {
  VueChartSeries,
  VueChartWidgetData,
  VueCustomWidgetData,
  VueCustomWidgetProps,
  VueDashboardRendererProps,
  VueResourceWidgetsProps,
  VueStatsWidgetData,
  VueTableWidgetData,
  VueWidgetManifest,
  VueWidgetRendererProps,
  VueWidgetStore,
  VueWidgetStat,
} from './types'

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function statsData(value: unknown): VueStatsWidgetData | null {
  const object = objectValue(value)
  return object && Array.isArray(object.stats) ? object as unknown as VueStatsWidgetData : null
}

function chartData(value: unknown): VueChartWidgetData | null {
  const object = objectValue(value)
  return object && Array.isArray(object.series) && typeof object.description === 'string' && typeof object.summary === 'string'
    ? object as unknown as VueChartWidgetData
    : null
}

function tableData(value: unknown): VueTableWidgetData | null {
  const object = objectValue(value)
  return object && typeof object.tableId === 'string' && objectValue(object.result)
    ? object as unknown as VueTableWidgetData
    : null
}

function customData(value: unknown): VueCustomWidgetData | null {
  const object = objectValue(value)
  return object && typeof object.component === 'string' && objectValue(object.properties)
    ? object as unknown as VueCustomWidgetData
    : null
}

function finitePoints(series: VueChartSeries): readonly number[] {
  return series.points.map(point => point.value).filter(Number.isFinite)
}

function sparkline(values: readonly number[], label: string): VNode | null {
  if (values.length === 0) return null
  const minimum = Math.min(...values)
  const range = Math.max(...values) - minimum || 1
  const denominator = Math.max(values.length - 1, 1)
  const points = values.map((value, index) => `${(index / denominator) * 100},${24 - ((value - minimum) / range) * 24}`).join(' ')
  return h('svg', { 'aria-label': label, class: 'hp-widget-sparkline', role: 'img', viewBox: '0 0 100 24' }, [
    h('polyline', { fill: 'none', points, stroke: 'currentColor', 'stroke-width': 2 }),
  ])
}

function statContent(stat: VueWidgetStat, onAction: VueWidgetRendererProps['onAction']): VNode {
  const content = [
    stat.icon ? PanelsIcon(stat.icon) : null,
    h('span', { class: 'hp-widget-stat__label' }, stat.label),
    h('strong', { class: 'hp-widget-stat__value' }, String(stat.value)),
    stat.description ? h('span', { class: 'hp-widget-stat__description' }, stat.description) : null,
    stat.trend ? h('span', { class: `hp-widget-stat__trend hp-widget-stat__trend--${stat.trend}` }, `Trend: ${stat.trend}`) : null,
    sparkline(stat.chart, `${stat.label} trend`),
  ]
  const url = safeExternalUrl(stat.url)
  const appearance = panelColorAppearance(stat.color)
  const attributes = {
    class: 'hp-widget-stat',
    'data-color': appearance.attribute,
    style: appearance.custom ? { '--hp-widget-color': appearance.custom } : undefined,
  }
  if (url) return h(Button, { ...attributes, as: 'a', href: url, variant: 'ghost' }, () => content)
  if (stat.action && onAction) return h(Button, {
    ...attributes,
    type: 'button',
    variant: 'ghost',
    onClick: () => void onAction(stat.action!, stat),
  }, () => content)
  return h(Card, attributes, () => h(CardContent, {}, () => content))
}

function renderStats(data: VueStatsWidgetData, props: VueWidgetRendererProps): VNodeChild {
  return data.stats.length > 0
    ? h('div', { class: 'hp-widget-stats' }, data.stats.map(stat => h('div', { key: stat.id }, [statContent(stat, props.onAction)])))
    : null
}

function chartLabels(data: VueChartWidgetData): readonly string[] {
  const labels: string[] = []
  for (const series of data.series) {
    for (const point of series.points) if (!labels.includes(point.label)) labels.push(point.label)
  }
  return labels
}

function chartColor(series: VueChartSeries, index: number): string {
  return series.color ?? `var(--hp-chart-${index + 1}, currentColor)`
}

function chartY(value: number, minimum: number, maximum: number): number {
  return 38 - ((value - minimum) / Math.max(maximum - minimum, 1)) * 36
}

function lineMarks(data: VueChartWidgetData, minimum: number, maximum: number): VNode[] {
  return data.series.map((series, seriesIndex) => {
    const denominator = Math.max(series.points.length - 1, 1)
    const points = series.points.map((point, index) => `${(index / denominator) * 100},${chartY(point.value, minimum, maximum)}`).join(' ')
    return h('polyline', { 'data-chart-mark': 'line', fill: 'none', key: series.id, points, stroke: chartColor(series, seriesIndex), 'stroke-width': 2 })
  })
}

function areaMarks(data: VueChartWidgetData, minimum: number, maximum: number): VNode[] {
  const baseline = chartY(0, minimum, maximum)
  return data.series.map((series, seriesIndex) => {
    const denominator = Math.max(series.points.length - 1, 1)
    const points = series.points.map((point, index) => `${(index / denominator) * 100},${chartY(point.value, minimum, maximum)}`)
    const polygon = [`0,${baseline}`, ...points, `100,${baseline}`].join(' ')
    return h('polygon', { 'data-chart-mark': 'area', fill: chartColor(series, seriesIndex), 'fill-opacity': 0.2, key: series.id, points: polygon, stroke: chartColor(series, seriesIndex), 'stroke-width': 2 })
  })
}

function barMarks(data: VueChartWidgetData, labels: readonly string[], minimum: number, maximum: number): VNode[] {
  const seriesCount = Math.max(data.series.length, 1)
  const categoryWidth = 90 / Math.max(labels.length, 1)
  const barWidth = categoryWidth / seriesCount
  const baseline = chartY(0, minimum, maximum)
  return labels.flatMap((label, labelIndex) => data.series.map((series, seriesIndex) => {
    const value = series.points.find(point => point.label === label)?.value ?? 0
    const valueY = chartY(value, minimum, maximum)
    return h('rect', {
      'data-chart-mark': 'bar',
      fill: chartColor(series, seriesIndex),
      height: Math.max(Math.abs(baseline - valueY), 0.5),
      key: `${label}:${series.id}`,
      width: Math.max(barWidth - 1, 0.5),
      x: 5 + labelIndex * categoryWidth + seriesIndex * barWidth,
      y: Math.min(baseline, valueY),
    })
  }))
}

function polarPoint(angle: number): readonly [number, number] {
  return [50 + Math.cos(angle) * 18, 20 + Math.sin(angle) * 18]
}

function pieMarks(data: VueChartWidgetData): VNode[] {
  const slices = data.series.flatMap((series, seriesIndex) => series.points
    .filter(point => point.value > 0)
    .map(point => ({ color: chartColor(series, seriesIndex), id: `${series.id}:${point.label}`, value: point.value })))
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (slices.length === 1) return [h('circle', { 'data-chart-mark': 'pie', cx: 50, cy: 20, fill: slices[0]?.color, key: slices[0]?.id, r: 18 })]
  let angle = -Math.PI / 2
  return slices.map(slice => {
    const start = angle
    angle += (slice.value / total) * Math.PI * 2
    const [startX, startY] = polarPoint(start)
    const [endX, endY] = polarPoint(angle)
    const largeArc = angle - start > Math.PI ? 1 : 0
    return h('path', {
      d: `M 50 20 L ${startX} ${startY} A 18 18 0 ${largeArc} 1 ${endX} ${endY} Z`,
      'data-chart-mark': 'pie',
      fill: slice.color,
      key: slice.id,
    })
  })
}

function chartMarks(data: VueChartWidgetData, labels: readonly string[]): VNode[] {
  const values = data.series.flatMap(finitePoints)
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values, 1)
  if (data.type === 'area') return areaMarks(data, minimum, maximum)
  if (data.type === 'bar') return barMarks(data, labels, minimum, maximum)
  if (data.type === 'pie') return pieMarks(data)
  return lineMarks(data, minimum, maximum)
}

function renderChart(data: VueChartWidgetData, heading: string): VNodeChild {
  const labels = chartLabels(data)
  return h('figure', { class: `hp-widget-chart hp-widget-chart--${data.type}` }, [
    h('svg', { 'aria-hidden': 'true', focusable: 'false', viewBox: '0 0 100 40' }, chartMarks(data, labels)),
    h('figcaption', [h('strong', data.summary), h('span', data.description)]),
    h(Table, { 'aria-label': `${heading} chart data` }, () => [
      h(TableCaption, {}, () => data.summary),
      h(TableHeader, {}, () => h(TableRow, {}, () => [h(TableHead, {}, () => 'Category'), ...data.series.map(series => h(TableHead, { key: series.id }, () => series.label))])),
      h(TableBody, {}, () => labels.map(label => h(TableRow, { key: label }, () => [
        h(TableHead, {}, () => label),
        ...data.series.map(series => h(TableCell, { key: series.id }, () => series.points.find(point => point.label === label)?.value ?? '—')),
      ]))),
    ]),
  ])
}

function customRenderer(data: VueCustomWidgetData, props: VueWidgetRendererProps): VNodeChild {
  if (!props.registry) throw new Error(`[Holo Panels] A Vue component registry is required for custom widget "${props.manifest.id}".`)
  const component = props.registry.resolve(widgetRendererName(data.component), props.panelId, `widget "${props.manifest.id}"`) as Component<VueCustomWidgetProps>
  return h(component, { data, manifest: props.manifest })
}

function readyContent(props: VueWidgetRendererProps, data: unknown): VNodeChild {
  if (props.manifest.family === 'stats') {
    const parsed = statsData(data)
    return parsed ? renderStats(parsed, props) : null
  }
  if (props.manifest.family === 'chart') {
    const parsed = chartData(data)
    return parsed ? renderChart(parsed, props.manifest.heading ?? props.manifest.id) : null
  }
  if (props.manifest.family === 'table') {
    const parsed = tableData(data)
    return parsed && props.renderTable ? props.renderTable(parsed) : null
  }
  const parsed = customData(data)
  return parsed ? customRenderer(parsed, props) : null
}

function filterControl(props: VueWidgetRendererProps, state: VueWidgetStore['snapshot'], filter: VueWidgetManifest['filters'][number]): VNode {
  const value = state.filters[filter.id] ?? filter.defaultValue
  const inputId = `hp-widget-${props.manifest.id}-filter-${filter.id}`
  if (typeof filter.defaultValue === 'boolean') {
    return h(Field, { orientation: 'horizontal' }, () => [
      h(Checkbox, {
        disabled: state.loading,
        id: inputId,
        modelValue: value === true,
        'onUpdate:modelValue': (next: boolean | 'indeterminate') => void props.store.setFilter(filter.id, next === true),
      }),
      h(FieldLabel, { for: inputId }, () => filter.label),
    ])
  }
  const type = typeof filter.defaultValue === 'number' ? 'number' : 'text'
  const displayValue = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  return h(Field, {}, () => [
    h(FieldLabel, { for: inputId }, () => filter.label),
    h(Input, {
      disabled: state.loading,
      id: inputId,
      type,
      modelValue: displayValue,
      onChange: (event: Event) => {
        const input = event.currentTarget as HTMLInputElement
        void props.store.setFilter(filter.id, type === 'number' ? input.valueAsNumber : input.value)
      },
    }),
  ])
}

function filterControls(props: VueWidgetRendererProps, state: VueWidgetStore['snapshot']): VNode | null {
  if (props.manifest.filters.length === 0) return null
  return h(FieldGroup, { class: 'hp-widget-filters' }, () => [
    ...props.manifest.filters.map(filter => h('div', { key: filter.id }, [filterControl(props, state, filter)])),
    h(Button, { disabled: state.loading, type: 'button', variant: 'outline', onClick: () => void props.store.resetFilters() }, () => [PanelsIcon('restore'), 'Reset filters']),
  ])
}

export function widgetRendererName(type: string): string {
  return `widget.${type.replaceAll(':', '.').replaceAll('/', '.')}`
}

export const VueWidgetRenderer = defineComponent({
  name: 'VueWidgetRenderer',
  props: {
    widget: { type: Object as PropType<VueWidgetRendererProps>, required: true },
  },
  setup(componentProps) {
    const state = shallowRef(componentProps.widget.store.snapshot)
    const host = ref<HTMLElement>()
    let observer: IntersectionObserver | null = null
    let activated = false
    const activate = (): void => {
      if (activated) return
      activated = true
      observer?.disconnect()
      void componentProps.widget.store.activate()
    }
    onScopeDispose(componentProps.widget.store.subscribe(next => { state.value = next }))
    onScopeDispose(() => {
      observer?.disconnect()
      componentProps.widget.store.stop()
    })
    onMounted(() => {
      if (!componentProps.widget.manifest.lazy) {
        activate()
      } else if (typeof globalThis.IntersectionObserver === 'function' && host.value) {
        observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) activate()
        })
        observer.observe(host.value)
      }
    })
    return (): VNode | null => {
      if (state.value.status === 'hidden' || state.value.status === 'unauthorized') return null
      const manifest = componentProps.widget.manifest
      const headingId = `hp-widget-${manifest.id}-heading`
      const content = state.value.status === 'loading'
        ? h(Skeleton, { 'aria-label': 'Loading widget', class: 'hp:h-24 hp:w-full', role: 'status' })
        : state.value.status === 'error'
          ? h(Alert, { variant: 'destructive' }, () => h(AlertDescription, {}, () => state.value.error ?? manifest.errorState))
          : state.value.status === 'ready'
            ? readyContent(componentProps.widget, state.value.data)
            : manifest.lazy
              ? h(Button, { type: 'button', onClick: activate }, `Load ${manifest.heading ?? manifest.id}`)
              : null
      const empty = state.value.status === 'ready' && content === null
      return h(Card, {
        ref: host,
        'aria-labelledby': manifest.heading ? headingId : undefined,
        class: `hp-widget hp-widget--${manifest.family}`,
        'data-slot': 'card',
        'data-widget-id': manifest.id,
      }, () => [
        manifest.heading || manifest.description ? h(CardHeader, {}, () => [
          manifest.heading ? h(CardTitle, { id: headingId }, () => manifest.heading) : null,
          manifest.description ? h(CardDescription, {}, () => manifest.description) : null,
        ]) : null,
        h(CardContent, {}, () => [
          filterControls(componentProps.widget, state.value),
          empty ? h(Empty, { class: 'hp-widget-empty' }, () => h(EmptyHeader, {}, () => [h(EmptyTitle, {}, () => 'No data'), h(EmptyDescription, {}, () => manifest.emptyState)])) : content,
        ]),
      ])
    }
  },
})

function gridColumns(width: number): number {
  if (!Number.isFinite(width) || width < 0) throw new Error('Widget viewport widths must be non-negative numbers')
  if (width < 640) return 1
  if (width < 1024) return 2
  return 4
}

function widgetGrid(label: string, width: number, widgets: VueDashboardRendererProps['widgets'], attributes: Record<string, string>): VNode {
  const columns = gridColumns(width)
  return h('section', { ...attributes, 'aria-label': label, class: 'hp-widget-grid', style: { '--hp-widget-columns': columns } }, [...widgets]
    .sort((left, right) => left.manifest.sort - right.manifest.sort)
    .map(widget => {
      const requested = widget.manifest.layout.columnSpan === 'full' ? columns : widget.manifest.layout.columnSpan
      const span = Math.min(Math.max(requested, 1), columns)
      const start = widget.manifest.layout.columnStart
      const validStart = start !== null && start > 0 && start + span - 1 <= columns ? start : null
      return h('div', {
        class: 'hp-widget-grid__item',
        'data-column-span': span,
        'data-column-start': validStart,
        key: widget.key ?? widget.manifest.id,
        style: { gridColumn: validStart ? `${validStart} / span ${span}` : `span ${span}` },
      }, [h(VueWidgetRenderer, { widget })])
    }))
}

export const VueDashboardRenderer = defineComponent({
  name: 'VueDashboardRenderer',
  props: { dashboard: { type: Object as PropType<VueDashboardRendererProps>, required: true } },
  setup(props) {
    return () => widgetGrid(props.dashboard.label, props.dashboard.viewportWidth, props.dashboard.widgets, { 'data-dashboard-id': props.dashboard.dashboardId })
  },
})

export const VueResourceWidgets = defineComponent({
  name: 'VueResourceWidgets',
  props: { area: { type: Object as PropType<VueResourceWidgetsProps>, required: true } },
  setup(props) {
    return () => widgetGrid(`${props.area.placement} widgets`, props.area.viewportWidth, props.area.widgets, {
      'data-page-id': props.area.pageId,
      'data-resource-id': props.area.resourceId,
      'data-widget-placement': props.area.placement,
    })
  },
})

export function registerVueWidgetRenderer(registry: VueWidgetRendererProps['registry'], type: string, component: Component): typeof registry {
  if (!registry) throw new Error('[Holo Panels] A Vue component registry is required to register a widget renderer.')
  registry.register(widgetRendererName(type), component, '@holo-js/panels-vue')
  return registry
}
