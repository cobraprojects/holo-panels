import type { JsonValue, WidgetClientState, WidgetStateListener } from '@holo-js/panels-client'
import { WidgetStore, WidgetTableController } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { registerSvelteWidgetRenderer } from '../src/widgets'
import type {
  SvelteCustomWidgetProps,
  SvelteDashboardRendererProps,
  SvelteDashboardWidget,
  SvelteTableWidgetProps,
  SvelteWidgetFamily,
  SvelteWidgetManifest,
  SvelteWidgetStore,
} from '../src/widgets/contracts'
import { SvelteComponentRegistry } from '../src/registry'

class TestWidgetStore implements SvelteWidgetStore {
  readonly activate = vi.fn(async () => undefined)
  readonly load = vi.fn(async () => undefined)
  readonly setFilter = vi.fn(async () => undefined)
  readonly stop = vi.fn()
  readonly #listeners = new Set<WidgetStateListener>()
  snapshot: WidgetClientState

  constructor(state: Partial<WidgetClientState> & Pick<WidgetClientState, 'status'>) {
    this.snapshot = {
      data: null,
      error: null,
      filters: {},
      loading: false,
      ...state,
    }
  }

  subscribe(listener: WidgetStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

let server: ViteDevServer
let ServerFixture: Component<{ dashboard: SvelteDashboardRendererProps }>
let ServerCustom: Component<SvelteCustomWidgetProps>
let ServerTable: Component<SvelteTableWidgetProps>
let renderServer: typeof render

function manifest(id: string, family: SvelteWidgetFamily, overrides: Partial<SvelteWidgetManifest> = {}): SvelteWidgetManifest {
  return {
    description: null,
    emptyState: 'No widget data',
    errorState: 'Unable to load widget',
    family,
    filters: [],
    heading: id,
    id,
    layout: { columnSpan: 1, columnStart: null },
    lazy: false,
    polling: { enabled: false, interval: null },
    sort: 0,
    type: `panels.widgets.${family}`,
    ...overrides,
  }
}

function widget(id: string, family: SvelteWidgetFamily, data: JsonValue, overrides: Partial<SvelteDashboardWidget> = {}): SvelteDashboardWidget {
  return {
    manifest: manifest(id, family),
    placement: 'dashboard',
    store: new TestWidgetStore({ data, status: 'ready' }),
    ...overrides,
  }
}

function renderDashboard(widgets: readonly SvelteDashboardWidget[], overrides: Partial<SvelteDashboardRendererProps> = {}): HTMLDivElement {
  const container = document.createElement('div')
  container.innerHTML = renderServer(ServerFixture, { props: { dashboard: { dashboardId: 'overview', label: 'Overview dashboard', width: 1280, widgets, ...overrides } } }).body
  return container
}

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p12-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  ServerFixture = (await server.ssrLoadModule('/tests/P12SvelteFixture.svelte')).default as Component<{ dashboard: SvelteDashboardRendererProps }>
  ServerCustom = (await server.ssrLoadModule('/tests/P12CustomWidget.svelte')).default as Component<SvelteCustomWidgetProps>
  ServerTable = (await server.ssrLoadModule('/tests/P12TableWidget.svelte')).default as Component<SvelteTableWidgetProps>
  renderServer = (await server.ssrLoadModule('svelte/server')).render as typeof render
})

afterAll(async () => server?.close())

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P12 Svelte widget and dashboard renderer', () => {
  it('resolves the renderer registered for a custom widget extension ID', () => {
    const registry = registerSvelteWidgetRenderer(new SvelteComponentRegistry(), 'widget.app.widget.summary', ServerCustom)
    const container = renderDashboard([widget('summary', 'custom', { component: 'summary', properties: { message: 'Registered summary' } }, { manifest: manifest('summary', 'custom', { type: 'app:widget:summary' }), registry })])
    expect(container.textContent).toContain('Registered summary')
  })
  it('composes the shared table with its selection controls', () => {
    const definition = manifest('recent', 'table')
    const data = { tableId: 'posts', result: { records: [{ id: 'one', title: 'First post' }], total: 1, resource: { id: 'posts', routeKey: 'id', labels: { plural: 'Posts' }, table: { actions: [{ id: 'publish', label: 'Publish', scope: 'bulk' }], columns: [{ path: 'title', type: 'text', label: 'Title' }] } } } }
    const store = new WidgetStore(definition, async () => ({ status: 'ready', data }), { initialResult: { status: 'ready', data } })
    const tableController = new WidgetTableController(store, { panelId: 'admin', request: () => ({ pageId: 'overview', widgetId: definition.id }), execute: async () => ({}) })
    const container = renderDashboard([{ manifest: definition, store, tableController, placement: 'dashboard' }])
    expect(container.querySelector('table')?.textContent).toContain('First post')
    expect(container.querySelector('[aria-label="Select record one"]')).not.toBeNull()
    tableController.dispose()
  })
  it('renders stats and charts with action, trend, SVG, and accessible table semantics', () => {
    const container = renderDashboard([
      widget('growth', 'stats', { stats: [
        { action: 'reports.open', chart: [4, 7, 9], color: 'success', description: 'This month', icon: 'arrow-up', id: 'revenue', label: 'Revenue', progress: { value: 75, max: 100 }, trend: 'up', url: '/reports', value: '$12k' },
        { action: null, chart: [], color: '#123456', description: null, icon: null, id: 'orders', label: 'Orders', trend: null, url: null, value: 42 },
      ] }),
      widget('revenue', 'chart', { description: 'Revenue for each month', series: [{ color: '#2563eb', id: 'net', label: 'Net', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 18 }] }], summary: 'Monthly revenue', type: 'line' }),
    ])

    expect(container.querySelector('.hp-widget-stat')?.textContent).toContain('Revenue')
    expect(container.querySelector('.hp-widget-stat')?.textContent).toContain('$12k')
    expect(container.querySelector('[aria-label="Trend up"]')?.textContent).toBe('↑')
    const stats = container.querySelectorAll<HTMLElement>('.hp-widget-stat')
    expect(container.querySelector('svg[data-icon="arrow-up"]')).not.toBeNull()
    expect(container.querySelector('.hp-widget-sparkline polyline')).not.toBeNull()
    expect(container.querySelector('progress[aria-label="Revenue"]')?.getAttribute('value')).toBe('75')
    expect(stats[0]?.dataset.color).toBe('success')
    expect(stats[0]?.style.getPropertyValue('--hp-widget-color')).toBe('inherit')
    expect(stats[1]?.dataset.color).toBe('#123456')
    expect(stats[1]?.style.getPropertyValue('--hp-widget-color')).toBe('#123456')
    expect(container.querySelector('[data-action="reports.open"]')).not.toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/reports')
    expect(container.querySelector('[data-chart-mark="line"]')?.getAttribute('d')).toContain('L')
    expect(container.querySelector('figure figcaption')?.textContent).toBe('Monthly revenue')
    expect(container.querySelector('figure table caption')?.textContent).toBe('Monthly revenue')
    expect(container.querySelector('th[scope="row"]')?.textContent).toBe('Jan')
  })

  it('uses type-specific SVG geometry for line, area, bar, and pie charts', () => {
    const chart = (type: 'area' | 'bar' | 'line' | 'pie'): JsonValue => ({
      description: `${type} chart description`,
      series: [{ color: '#2563eb', id: 'primary', label: 'Primary', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 30 }] }],
      summary: `${type} chart summary`,
      type,
    })
    const container = renderDashboard([
      widget('line-chart', 'chart', chart('line')),
      widget('area-chart', 'chart', chart('area')),
      widget('bar-chart', 'chart', chart('bar')),
      widget('pie-chart', 'chart', chart('pie')),
    ])

    expect(container.querySelector('[data-chart-type="line"] [data-chart-mark="line"]')).not.toBeNull()
    expect(container.querySelector('[data-chart-type="area"] [data-chart-mark="area"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-chart-type="bar"] [data-chart-mark="bar"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-chart-type="pie"] [data-chart-mark="slice"]')).toHaveLength(2)
    expect(container.querySelector('[data-chart-type="pie"] path')?.getAttribute('d')).toContain(' A ')
    expect(container.querySelectorAll('figure table')).toHaveLength(4)
  })

  it('composes table and registered custom widgets without bypassing their renderers', () => {
    const registry = registerSvelteWidgetRenderer(new SvelteComponentRegistry(), 'acme:widget:message', ServerCustom)
    const container = renderDashboard([
      widget('posts', 'table', { result: { total: 42 }, tableId: 'posts-table' }, { tableRenderer: ServerTable }),
      widget('message', 'custom', { component: 'acme:widget:message', properties: { message: 'Hello dashboard' } }, { registry }),
    ])

    expect(container.querySelector('[data-table-widget="posts"] caption')?.textContent).toBe('posts-table')
    expect(container.querySelector('[data-table-widget="posts"] td')?.textContent).toBe('42')
    expect(container.querySelector('[data-custom-widget="message"]')?.textContent).toBe('Hello dashboard')
  })

  it('renders lazy, error, unauthorized, hidden, and filter states safely', () => {
    const container = renderDashboard([
      { manifest: manifest('lazy', 'stats', { filters: [{ defaultValue: 'week', id: 'period', label: 'Period' }], lazy: true }), placement: 'dashboard', store: new TestWidgetStore({ filters: { period: 'month' }, status: 'idle' }) },
      { manifest: manifest('broken', 'stats'), placement: 'dashboard', store: new TestWidgetStore({ error: 'Request failed', status: 'error' }) },
      { manifest: manifest('private', 'stats'), placement: 'dashboard', store: new TestWidgetStore({ status: 'unauthorized' }) },
      { manifest: manifest('hidden', 'stats'), placement: 'dashboard', store: new TestWidgetStore({ status: 'hidden' }) },
    ])

    expect(container.querySelector('[data-panels-widget="lazy"] [role="status"]')?.textContent).toBe('Loading widget')
    expect(container.querySelector('form[aria-label="lazy filters"] input')?.getAttribute('value')).toBe('month')
    expect(container.querySelector('[data-panels-widget="broken"] [role="alert"]')?.textContent).toContain('Unable to load widget')
    expect(container.querySelector('[data-panels-widget="private"] [role="status"]')?.textContent).toContain('Widget unavailable')
    expect(container.querySelector('[data-panels-widget="hidden"]')).toBeNull()
  })

  it('places sorted dashboard and resource widgets in the responsive grid', () => {
    const header = widget('header', 'stats', { stats: [] }, { manifest: manifest('header', 'stats', { layout: { columnSpan: 'full', columnStart: 3 }, sort: 2 }), placement: 'resource-header' })
    const first = widget('first', 'stats', { stats: [] }, { manifest: manifest('first', 'stats', { layout: { columnSpan: 3, columnStart: 2 }, sort: -1 }) })
    const desktop = renderDashboard([header, widget('second', 'stats', { stats: [] }), first])
    const mobile = renderDashboard([header, first], { placement: 'resource-header', width: 400 })

    expect(Array.from(desktop.querySelectorAll('[data-panels-widget]')).map(element => element.getAttribute('data-panels-widget'))).toEqual(['first', 'second'])
    expect(desktop.querySelector('[data-panels-widget="first"]')?.parentElement?.getAttribute('data-column-span')).toBe('3')
    expect(mobile.querySelector('[data-dashboard]')?.getAttribute('data-placement')).toBe('resource-header')
    expect(mobile.querySelector('[data-panels-widget="header"]')?.getAttribute('data-placement')).toBe('resource-header')
    expect(mobile.querySelector('[data-panels-widget="header"]')?.parentElement?.getAttribute('data-column-span')).toBe('1')
    expect(mobile.querySelector('[data-panels-widget="first"]')).toBeNull()
  })
})
