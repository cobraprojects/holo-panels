import type { JsonValue, WidgetClientState, WidgetStateListener } from '@holo-js/panels-client'
import { WidgetStore, WidgetTableController } from '@holo-js/panels-client'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentRegistry } from '../src/registry'
import {
  registerVueWidgetRenderer,
  VueDashboardRenderer,
  VueResourceWidgets,
  VueWidgetRenderer,
} from '../src/widgets/renderer'
import type { VueDashboardWidget, VueWidgetManifest, VueWidgetStore } from '../src/widgets/types'

class WidgetStoreFixture implements VueWidgetStore {
  readonly activate = vi.fn(async () => undefined)
  readonly load = vi.fn(async () => undefined)
  readonly resetFilters = vi.fn(async () => undefined)
  readonly setFilter = vi.fn(async (_id: string, _value: JsonValue) => undefined)
  readonly stop = vi.fn()
  readonly #listeners = new Set<WidgetStateListener>()
  snapshot: WidgetClientState

  constructor(status: WidgetClientState['status'], data: JsonValue = null, error: string | null = null) {
    this.snapshot = { data, error, filters: {}, loading: status === 'loading', status }
  }

  subscribe(listener: WidgetStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  update(status: WidgetClientState['status'], data: JsonValue = null, error: string | null = null): void {
    const previous = this.snapshot
    this.snapshot = { ...previous, data, error, loading: status === 'loading', status }
    for (const listener of this.#listeners) listener(this.snapshot, previous)
  }
}

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function manifest(id: string, family: VueWidgetManifest['family'], overrides: Partial<VueWidgetManifest> = {}): VueWidgetManifest {
  return {
    description: `${id} description`,
    emptyState: 'Nothing to show',
    errorState: 'Unable to load this widget',
    family,
    filters: [],
    heading: id.replace('-', ' '),
    id,
    layout: { columnSpan: 1, columnStart: null },
    lazy: false,
    polling: { enabled: false, interval: null },
    sort: 10,
    type: `panels.widgets.${family}`,
    ...overrides,
  }
}

function mount(component: ReturnType<typeof defineComponent>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(component)
  app.mount(container)
  mounted.push({ app, container })
  return container
}

function mountWidget(widget: VueDashboardWidget): HTMLElement {
  return mount(defineComponent(() => () => h(VueWidgetRenderer, { widget })))
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.app.unmount()
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P12 Vue widget renderer', () => {
  it('resolves the renderer registered for a custom widget extension ID', () => {
    const registry = createComponentRegistry().register('widget.app.widget.summary', defineComponent(() => () => h('p', 'Registered summary')), 'test')
    const container = mountWidget({ manifest: manifest('summary', 'custom', { type: 'app:widget:summary' }), registry, store: new WidgetStoreFixture('ready', { component: 'summary', properties: {} }) })
    expect(container.textContent).toContain('Registered summary')
  })
  it('renders the shared table and retains selected rows after widget refresh', async () => {
    const definition = manifest('recent', 'table', { lazy: true })
    const data = { tableId: 'posts', result: { records: [{ id: 'one', title: 'First post' }], total: 1, resource: { id: 'posts', routeKey: 'id', labels: { plural: 'Posts' }, table: { actions: [{ id: 'publish', label: 'Publish', scope: 'bulk' }], columns: [{ path: 'title', type: 'text', label: 'Title' }] } } } }
    const store = new WidgetStore(definition, async () => ({ status: 'ready', data }), { initialResult: { status: 'ready', data } })
    const table = new WidgetTableController(store, { panelId: 'admin', request: () => ({ pageId: 'overview', widgetId: definition.id }), execute: async () => ({}) })
    const container = mountWidget({ manifest: definition, store, table })
    expect(container.querySelector('table')?.textContent).toContain('First post')
    const checkbox = container.querySelector<HTMLElement>('[aria-label="Select record one"]')
    expect(checkbox).not.toBeNull()
    checkbox?.click()
    await nextTick()
    await store.load()
    await nextTick()
    expect(container.querySelector('[aria-label="Select record one"]')?.getAttribute('aria-checked')).toBe('true')
    table.dispose()
  })
  it('renders complete stats and accessible dependency-free charts', () => {
    const action = vi.fn()
    const stats = new WidgetStoreFixture('ready', {
      stats: [
        { action: null, chart: [12, 18, 15], color: '#336699', description: 'This month', icon: 'currency', id: 'revenue', label: 'Revenue', progress: { value: 75, max: 100 }, trend: 'up', url: '/reports', value: '$18k' },
        { action: 'orders.open', chart: [], color: 'success', description: null, icon: null, id: 'orders', label: 'Orders', trend: 'neutral', url: null, value: 42 },
      ],
    })
    const chart = new WidgetStoreFixture('ready', {
      description: 'Revenue for the first two months',
      series: [
        { color: '#336699', id: 'actual', label: 'Actual', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 14 }] },
        { color: null, id: 'target', label: 'Target', points: [{ label: 'Jan', value: 12 }] },
      ],
      summary: 'Monthly revenue',
      type: 'line',
    })
    const container = mount(defineComponent(() => () => h('main', [
      h(VueWidgetRenderer, { widget: { manifest: manifest('sales', 'stats'), onAction: action, store: stats } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('revenue-chart', 'chart'), store: chart } }),
    ])))

    expect(container.querySelector('[data-widget-id="sales"] a')?.getAttribute('href')).toBe('/reports')
    expect(container.querySelector('[data-icon="currency"]')).not.toBeNull()
    expect(container.querySelector('progress[aria-label="Revenue"]')?.getAttribute('value')).toBe('75')
    expect(container.querySelector('.hp-widget-stat__trend')?.textContent).toBe('Trend: up')
    const renderedStats = container.querySelectorAll<HTMLElement>('.hp-widget-stat')
    expect(renderedStats[0]?.dataset.color).toBe('#336699')
    expect(renderedStats[0]?.style.getPropertyValue('--hp-widget-color')).toBe('#336699')
    expect(renderedStats[1]?.dataset.color).toBe('success')
    expect(renderedStats[1]?.style.getPropertyValue('--hp-widget-color')).toBe('')
    expect(container.querySelector('.hp-widget-sparkline polyline')?.getAttribute('stroke')).toBe('currentColor')
    expect(container.querySelector('.hp-widget-sparkline')?.getAttribute('aria-label')).toBe('Revenue trend: 12, 18, 15')
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('Orders'))?.click()
    expect(action).toHaveBeenCalledWith('orders.open', expect.objectContaining({ id: 'orders' }))
    expect(container.querySelector('.hp-widget-chart svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.hp-widget-chart figcaption')?.textContent).toContain('Monthly revenue')
    expect(container.querySelector('.hp-widget-chart table')?.getAttribute('aria-label')).toBe('Monthly revenue')
    expect(Array.from(container.querySelectorAll('.hp-widget-chart tbody tr')).map(row => row.textContent)).toEqual(['Jan1012', 'Feb14—'])
  })

  it('uses chart-type-specific SVG marks while preserving accessible data tables', () => {
    const data = (type: 'area' | 'bar' | 'line' | 'pie'): JsonValue => ({
      description: `${type} comparison`,
      series: [
        { color: '#336699', id: 'actual', label: 'Actual', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 14 }] },
        { color: '#993366', id: 'target', label: 'Target', points: [{ label: 'Jan', value: 12 }, { label: 'Feb', value: 16 }] },
      ],
      summary: `${type} summary`,
      type,
    })
    const types = ['area', 'bar', 'line', 'pie'] as const
    const container = mount(defineComponent(() => () => h('main', types.map(type => h(VueWidgetRenderer, {
      key: type,
      widget: { manifest: manifest(`${type}-chart`, 'chart'), store: new WidgetStoreFixture('ready', data(type)) },
    })))))

    expect(container.querySelectorAll('.hp-widget-chart--line path[data-chart-mark="line"]')).toHaveLength(2)
    expect(container.querySelectorAll('.hp-widget-chart--area path[data-chart-mark="area"]')).toHaveLength(2)
    expect(container.querySelectorAll('.hp-widget-chart--bar path[data-chart-mark="bar"]')).toHaveLength(4)
    expect(container.querySelectorAll('.hp-widget-chart--pie path[data-chart-mark="slice"]')).toHaveLength(4)
    expect(container.querySelectorAll('.hp-widget-chart svg[aria-hidden="true"]')).toHaveLength(4)
    expect(container.querySelectorAll('.hp-widget-chart table')).toHaveLength(4)
    expect(container.querySelector('.hp-widget-chart--pie table')?.textContent).toContain('Jan1012')
  })

  it('composes table widgets and resolves custom widgets through the panel registry', () => {
    const registry = createComponentRegistry()
    const Custom = defineComponent({
      props: { data: { type: Object, required: true } },
      setup(props) {
        return () => h('output', { 'data-weather': true }, String(Reflect.get(Reflect.get(props.data, 'properties') as object, 'temperature')))
      },
    })
    registerVueWidgetRenderer(registry, 'app.widgets.weather', Custom)
    const table = new WidgetStoreFixture('ready', { result: { rows: [{ id: 1 }] }, tableId: 'recent-orders' })
    const custom = new WidgetStoreFixture('ready', { component: 'app.widgets.weather', properties: { temperature: 31 } })
    const container = mount(defineComponent(() => () => h('main', [
      h(VueWidgetRenderer, { widget: { manifest: manifest('orders', 'table'), renderTable: data => h('div', { 'data-table-id': data.tableId }, String(data.result.rows)), store: table } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('weather', 'custom'), panelId: 'admin', registry, store: custom } }),
    ])))

    expect(container.querySelector('[data-table-id="recent-orders"]')).not.toBeNull()
    expect(container.querySelector('[data-weather]')?.textContent).toBe('31')
    expect(() => mountWidget({ manifest: manifest('missing', 'custom'), registry, store: new WidgetStoreFixture('ready', { component: 'app.widgets.missing', properties: {} }) }))
      .toThrow(/widget\.app\.widgets\.missing.*widget/u)
  })

  it('handles lazy activation, loading, error, empty, hidden, and unauthorized states', async () => {
    const lazy = new WidgetStoreFixture('idle')
    const error = new WidgetStoreFixture('error', null, 'Filtered request failed')
    const empty = new WidgetStoreFixture('ready', { stats: [] })
    const hidden = new WidgetStoreFixture('hidden')
    const unauthorized = new WidgetStoreFixture('unauthorized')
    const container = mount(defineComponent(() => () => h('main', [
      h(VueWidgetRenderer, { widget: { manifest: manifest('lazy-sales', 'stats', { lazy: true }), store: lazy } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('failed', 'stats'), store: error } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('empty', 'stats'), store: empty } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('hidden', 'stats'), store: hidden } }),
      h(VueWidgetRenderer, { widget: { manifest: manifest('secret', 'stats'), store: unauthorized } }),
    ])))

    expect(container.querySelector('[data-widget-id="hidden"]')).toBeNull()
    expect(container.querySelector('[data-widget-id="secret"]')?.textContent).toContain('Widget unavailable')
    expect(container.querySelector('[data-widget-id="failed"] [role="alert"]')?.textContent).toContain('Unable to load')
    expect(container.querySelector('[data-widget-id="empty"] .hp-widget-empty')?.textContent).toContain('Nothing to show')
    expect(lazy.activate).not.toHaveBeenCalled()
    container.querySelector<HTMLButtonElement>('[data-widget-id="lazy-sales"] button')?.click()
    expect(lazy.activate).toHaveBeenCalledOnce()
    lazy.update('loading')
    await nextTick()
    expect(container.querySelector('[data-widget-id="lazy-sales"] [role="status"]')?.getAttribute('aria-label')).toBe('Loading widget')
  })

  it('operates persisted widget filters through the shared store contract', () => {
    const store = new WidgetStoreFixture('ready', { stats: [] })
    store.snapshot = { ...store.snapshot, filters: { period: 'year' } }
    const filteredManifest = manifest('filtered-sales', 'stats', {
      filters: [{ defaultValue: 'month', id: 'period', label: 'Period' }],
    })
    const container = mountWidget({ manifest: filteredManifest, store })
    const input = container.querySelector<HTMLInputElement>('#hp-widget-filtered-sales-filter-period')

    expect(input?.value).toBe('year')
    if (input) {
      input.value = 'quarter'
      input.dispatchEvent(new Event('change'))
    }
    expect(store.setFilter).toHaveBeenCalledWith('period', 'quarter')
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Reset filters')?.click()
    expect(store.resetFilters).toHaveBeenCalledOnce()
  })

  it('places sorted widgets on responsive dashboard and resource grids', () => {
    const first = { manifest: manifest('first', 'stats', { layout: { columnSpan: 3, columnStart: 2 }, sort: 1 }), store: new WidgetStoreFixture('ready', { stats: [] }) }
    const second = { manifest: manifest('second', 'stats', { layout: { columnSpan: 'full', columnStart: null }, sort: 2 }), store: new WidgetStoreFixture('ready', { stats: [] }) }
    const container = mount(defineComponent(() => () => h('main', [
      h(VueDashboardRenderer, { dashboard: { dashboardId: 'operations', label: 'Operations dashboard', viewportWidth: 800, widgets: [second, first] } }),
      h(VueResourceWidgets, { area: { pageId: 'edit-post', placement: 'header', resourceId: 'posts', viewportWidth: 500, widgets: [first] } }),
    ])))

    const dashboard = container.querySelector('[data-dashboard-id="operations"]')
    expect(dashboard?.getAttribute('aria-label')).toBe('Operations dashboard')
    expect(dashboard?.getAttribute('style')).toContain('--hp-widget-columns: 2')
    expect(Array.from(dashboard?.querySelectorAll('[data-widget-id]') ?? []).map(widget => widget.getAttribute('data-widget-id'))).toEqual(['first', 'second'])
    expect(Array.from(dashboard?.querySelectorAll('.hp-widget-grid__item') ?? []).map(item => [item.getAttribute('data-column-span'), item.getAttribute('data-column-start')])).toEqual([['2', null], ['2', null]])
    const resource = container.querySelector('[data-resource-id="posts"]')
    expect(resource?.getAttribute('data-page-id')).toBe('edit-post')
    expect(resource?.getAttribute('data-widget-placement')).toBe('header')
    expect(resource?.getAttribute('style')).toContain('--hp-widget-columns: 1')
    expect(resource?.querySelector('.hp-widget-grid__item')?.getAttribute('data-column-span')).toBe('1')
  })
})
