import type { PanelTranslator } from '@holo-js/panels-client'
import { usePanelTranslator } from '../localization'
import { VueTableRenderer } from '../tables/renderer'
import { widgetExtensionRendererName } from '@holo-js/panels-client'
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
import { VueActionRenderer } from '../actions/renderer'
import { panelColorAppearance, panelColorValue, widgetChartMarks, widgetSparklinePoints } from '@holo-js/panels-ui'
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

function sparkline(values: readonly number[], label: string): VNode | null {
  const points = widgetSparklinePoints(values)
  if (!points) return null
  return h('svg', { 'aria-label': label, class: 'hp-widget-sparkline hp:h-8 hp:w-full', role: 'img', viewBox: '0 0 100 32' }, [
    h('polyline', { fill: 'none', points, stroke: 'currentColor', 'stroke-width': 2 }),
  ])
}

function statContent(stat: VueWidgetStat, props: VueWidgetRendererProps, translate: PanelTranslator): VNode {
  const content = [
    stat.icon ? PanelsIcon(stat.icon) : null,
    h('span', { class: 'hp-widget-stat__label' }, stat.label),
    h('strong', { class: 'hp-widget-stat__value' }, String(stat.value)),
    stat.description ? h('span', { class: 'hp-widget-stat__description' }, stat.description) : null,
    stat.trend ? h('span', { class: `hp-widget-stat__trend hp-widget-stat__trend--${stat.trend}` }, translate('widgets.trendDescription', { trend: translate(`widgets.trend.${stat.trend}`) })) : null,
    stat.progress ? h('progress', { 'aria-label': stat.label, class: 'hp-widget-progress hp:w-full', value: stat.progress.value, max: stat.progress.max }, `${stat.progress.value} / ${stat.progress.max}`) : null,
    sparkline(stat.chart, translate('widgets.trendValues', { label: stat.label, values: stat.chart.join(', ') })),
  ]
  const url = safeExternalUrl(stat.url)
  const appearance = panelColorAppearance(stat.color)
  const attributes = {
    class: 'hp-widget-stat hp:h-auto hp:w-full hp:whitespace-normal hp:items-start hp:flex hp:flex-col hp:gap-2 hp:text-start',
    'data-color': appearance.attribute,
    style: { '--hp-widget-color': appearance.custom, color: panelColorValue(stat.color) },
  }
  if (url) return h(Button, { ...attributes, as: 'a', href: url, variant: 'ghost' }, () => content)
  if (stat.action && props.actionStore) {
    const action = props.actions?.find(candidate => candidate.id === stat.action && candidate.visible)
    return action ? h(Button, { ...attributes, disabled: action.disabled, onClick: () => props.actionStore?.mount(action), type: 'button', variant: 'ghost' }, () => content) : h(Card, attributes, () => h(CardContent, {}, () => content))
  }
  const onAction = props.onAction
  if (stat.action && onAction) return h(Button, {
    ...attributes,
    type: 'button',
    variant: 'ghost',
    onClick: () => void onAction(stat.action!, stat),
  }, () => content)
  return h(Card, attributes, () => h(CardContent, {}, () => content))
}

function renderStats(data: VueStatsWidgetData, props: VueWidgetRendererProps, translate: PanelTranslator): VNodeChild {
  return data.stats.length > 0
    ? h('div', { class: 'hp-widget-stats hp:grid hp:gap-4 hp:sm:grid-cols-2 hp:lg:grid-cols-4' }, data.stats.map(stat => h('div', { key: stat.id }, [statContent(stat, props, translate)])))
    : null
}

function chartLabels(data: VueChartWidgetData): readonly string[] {
  const labels: string[] = []
  for (const series of data.series) {
    for (const point of series.points) if (!labels.includes(point.label)) labels.push(point.label)
  }
  return labels
}

function chartMarks(data: VueChartWidgetData): VNode[] {
  return widgetChartMarks(data).map(mark => h('path', {
    d: mark.path, 'data-chart-mark': mark.kind, 'data-chart-series': mark.series, 'data-chart-label': mark.label,
    fill: mark.kind === 'line' ? 'none' : mark.color, 'fill-opacity': mark.opacity,
    stroke: mark.kind === 'line' ? mark.color : undefined, 'vector-effect': 'non-scaling-stroke', key: mark.key,
  }))
}

function renderChart(data: VueChartWidgetData, translate: PanelTranslator): VNodeChild {
  const labels = chartLabels(data)
  return h('figure', { class: `hp-widget-chart hp-widget-chart--${data.type}` }, [
    h('svg', { 'aria-hidden': 'true', focusable: 'false', class: 'hp:h-48 hp:w-full', viewBox: '0 0 100 100' }, chartMarks(data)),
    h('figcaption', [h('strong', data.summary), h('span', data.description)]),
    h(Table, { 'aria-label': data.summary }, () => [
      h(TableCaption, {}, () => data.summary),
      h(TableHeader, {}, () => h(TableRow, {}, () => [h(TableHead, {}, () => translate('widgets.label')), ...data.series.map(series => h(TableHead, { key: series.id }, () => series.label))])),
      h(TableBody, {}, () => labels.map(label => h(TableRow, { key: label }, () => [
        h(TableHead, {}, () => label),
        ...data.series.map(series => h(TableCell, { key: series.id }, () => series.points.find(point => point.label === label)?.value ?? '—')),
      ]))),
    ]),
  ])
}

function customRenderer(data: VueCustomWidgetData, props: VueWidgetRendererProps): VNodeChild {
  if (!props.registry) throw new Error(`[Holo Panels] A Vue component registry is required for custom widget "${props.manifest.id}".`)
  const component = props.registry.resolve(widgetExtensionRendererName(props.manifest.type) ?? widgetRendererName(data.component), props.panelId, `widget "${props.manifest.id}"`) as Component<VueCustomWidgetProps>
  return h(component, { data, manifest: props.manifest })
}

function readyContent(props: VueWidgetRendererProps, data: unknown, translate: PanelTranslator): VNodeChild {
  if (props.manifest.family === 'stats') {
    const parsed = statsData(data)
    return parsed ? renderStats(parsed, props, translate) : null
  }
  if (props.manifest.family === 'chart') {
    const parsed = chartData(data)
    return parsed ? renderChart(parsed, translate) : null
  }
  if (props.manifest.family === 'table') {
    const presentation = props.table?.presentation
    if (presentation) return h(VueTableRenderer, { table: { ...presentation, registry: props.registry, emptyMessage: props.manifest.emptyState } })
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

function filterControls(props: VueWidgetRendererProps, state: VueWidgetStore['snapshot'], translate: PanelTranslator): VNode | null {
  if (props.manifest.filters.length === 0) return null
  return h(FieldGroup, { class: 'hp-widget-filters' }, () => [
    ...props.manifest.filters.map(filter => h('div', { key: filter.id }, [filterControl(props, state, filter)])),
    h(Button, { disabled: state.loading, type: 'button', variant: 'outline', onClick: () => void props.store.resetFilters() }, () => [PanelsIcon('restore'), translate('tables.resetFilters')]),
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
    const translate = usePanelTranslator()
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
      if (state.value.status === 'hidden') return null
      const manifest = componentProps.widget.manifest
      const headingId = `hp-widget-${manifest.id}-heading`
      const content = state.value.status === 'loading' && state.value.data === null
        ? h(Skeleton, { 'aria-label': translate('widgets.loadingShort'), class: 'hp:h-24 hp:w-full', role: 'status' })
        : state.value.status === 'unauthorized'
          ? h('p', { role: 'status' }, translate('widgets.unavailable'))
        : state.value.status === 'error'
          ? h(Alert, { variant: 'destructive' }, () => [h(AlertDescription, {}, () => manifest.errorState), h(Button, { type: 'button', onClick: () => void componentProps.widget.store.load() }, () => translate('widgets.retry'))])
          : state.value.status === 'ready' || state.value.status === 'loading' && state.value.data !== null
            ? readyContent(componentProps.widget, state.value.data, translate)
            : manifest.lazy
              ? h(Button, { type: 'button', onClick: activate }, translate('widgets.load'))
              : null
      const empty = state.value.status === 'ready' && content === null
      return h(Card, {
        ref: (value) => {
          const element: unknown = value && '$el' in value ? value.$el : value
          host.value = element instanceof HTMLElement ? element : undefined
        },
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
          state.value.status === 'ready' && componentProps.widget.actions?.[0] && componentProps.widget.actionStore ? h(VueActionRenderer, { action: componentProps.widget.actions[0], actions: componentProps.widget.actions, panelId: componentProps.widget.panelId, registry: componentProps.widget.registry, store: componentProps.widget.actionStore }) : null,
          filterControls(componentProps.widget, state.value, translate),
          empty ? h(Empty, { class: 'hp-widget-empty' }, () => h(EmptyHeader, {}, () => h(EmptyTitle, {}, () => manifest.emptyState))) : content,
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
  return h('section', { ...attributes, 'aria-label': label, class: 'hp-widget-grid hp:grid hp:gap-4', style: { '--hp-widget-columns': columns, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } }, [...widgets]
    .sort((left, right) => left.manifest.sort - right.manifest.sort || left.manifest.id.localeCompare(right.manifest.id))
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
    const translate = usePanelTranslator()
    return () => widgetGrid(translate(props.area.placement === 'header' ? 'widgets.resourceHeader' : 'widgets.resourceFooter'), props.area.viewportWidth, props.area.widgets, {
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
