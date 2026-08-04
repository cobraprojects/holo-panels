import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { WidgetStore, type WidgetLoadResult } from '@holo-js/panels-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentRegistry } from '../src/registry'
import {
  ReactDashboardRenderer,
  ReactResourceWidgets,
  ReactWidgetRenderer,
  registerReactWidgetRenderer,
} from '../src/widgets/renderer'
import type { ReactWidgetManifest, ReactWidgetRendererProps } from '../src/widgets/types'

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function manifest(overrides: Partial<ReactWidgetManifest> = {}): ReactWidgetManifest {
  return {
    description: 'Widget description',
    emptyState: 'No widget data',
    errorState: 'Widget failed',
    family: 'stats',
    filters: [],
    heading: 'Sales',
    id: 'sales',
    layout: { columnSpan: 2, columnStart: null },
    lazy: true,
    polling: { enabled: false, interval: null },
    sort: 0,
    type: 'stats',
    ...overrides,
  }
}

function createStore(widget: ReactWidgetManifest, result: WidgetLoadResult | (() => Promise<WidgetLoadResult>)): WidgetStore {
  return new WidgetStore(widget, typeof result === 'function' ? result : async () => result)
}

function mount(props: ReactWidgetRendererProps): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push({ container, unmount: () => root.unmount() })
  act(() => root.render(createElement(ReactWidgetRenderer, props)))
  return container
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P12 React widget renderer', () => {
  it('lazily renders complete stats and dispatches only configured links and actions', async () => {
    const widget = manifest()
    const action = vi.fn()
    const navigate = vi.fn()
    const store = createStore(widget, {
      data: { stats: [
        { action: 'sales.refresh', chart: [2, 4, 3], color: '#123456', description: 'Since last month', icon: 'currency', id: 'revenue', label: 'Revenue', trend: 'up', url: null, value: '$42' },
        { action: null, chart: [], color: null, description: null, icon: null, id: 'orders', label: 'Orders', trend: null, url: '/orders', value: 8 },
      ] },
      status: 'ready',
    })
    const container = mount({ action, manifest: widget, navigate, store })

    expect(container.textContent).toContain('Load widget')
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.textContent).toContain('Revenue$42Since last monthup')
    expect(container.querySelector('svg[aria-hidden="true"] polyline')).not.toBeNull()
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Revenue'))?.click())
    expect(action).toHaveBeenCalledWith('sales.refresh')
    act(() => container.querySelector<HTMLAnchorElement>('a[href="/orders"]')?.click())
    expect(navigate).toHaveBeenCalledWith('/orders')
  })

  it.each([
    ['line', 'line', 1],
    ['area', 'area', 1],
    ['bar', 'bar', 2],
    ['pie', 'slice', 2],
  ] as const)('renders %s charts with appropriate SVG marks and an accessible equivalent data table', async (type, mark, count) => {
    const widget = manifest({ family: 'chart', heading: 'Revenue chart', type })
    const store = createStore(widget, {
      data: {
        description: 'Revenue by month',
        series: [{ color: '#123456', id: 'revenue', label: 'Revenue', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 14 }] }],
        summary: 'Monthly revenue',
        type,
      },
      status: 'ready',
    })
    const container = mount({ manifest: widget, store })
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())

    expect(container.querySelector(`figure[data-chart-type="${type}"] svg[aria-hidden="true"]`)).not.toBeNull()
    expect(container.querySelectorAll(`[data-chart-mark="${mark}"]`)).toHaveLength(count)
    const chartMark = container.querySelector(`[data-chart-mark="${mark}"]`)
    expect(chartMark?.getAttribute('fill') === 'none' ? chartMark.getAttribute('stroke') : chartMark?.getAttribute('fill')).toBe('#123456')
    expect(container.querySelector('table caption')?.textContent).toBe('Monthly revenue')
    expect(container.querySelector('th[scope="row"]')?.textContent).toBe('Jan')
    expect(container.querySelector('td')?.textContent).toBe('10')
  })

  it('composes table widgets and resolves registered custom widgets', async () => {
    const table = manifest({ family: 'table', id: 'latest-orders', type: 'table' })
    const tableContainer = mount({
      manifest: table,
      renderTable: ({ data }) => <table><caption>{data.tableId}</caption></table>,
      store: createStore(table, { data: { result: { records: [] }, tableId: 'orders' }, status: 'ready' }),
    })
    await act(async () => tableContainer.querySelector<HTMLButtonElement>('button')?.click())
    expect(tableContainer.querySelector('caption')?.textContent).toBe('orders')

    const custom = manifest({ family: 'custom', id: 'welcome', type: 'custom' })
    const registry = createComponentRegistry()
    registerReactWidgetRenderer(registry, 'welcome-card', ({ properties }) => <p>{String(properties.message)}</p>)
    const customContainer = mount({
      manifest: custom,
      registry,
      store: createStore(custom, { data: { component: 'welcome-card', properties: { message: 'Welcome back' } }, status: 'ready' }),
    })
    await act(async () => customContainer.querySelector<HTMLButtonElement>('button')?.click())
    expect(customContainer.textContent).toContain('Welcome back')
  })

  it('renders filtered, unauthorized, error, and retry states without exposing data', async () => {
    const filtered = manifest({ filters: [{ defaultValue: 'month', id: 'period', label: 'Period' }] })
    const loader = vi.fn(async (_id: string, filters: Readonly<Record<string, unknown>>) => ({
      data: { stats: [{ action: null, chart: [], color: null, description: null, icon: null, id: 'value', label: String(filters.period), trend: null, url: null, value: 1 }] },
      status: 'ready' as const,
    }))
    const container = mount({ manifest: filtered, store: new WidgetStore(filtered, loader) })
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.textContent).toContain('month')
    const input = container.querySelector<HTMLInputElement>('#sales-period')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'year')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(loader).toHaveBeenLastCalledWith('sales', { period: 'year' }, expect.any(AbortSignal))

    const unauthorizedWidget = manifest({ id: 'private' })
    const unauthorized = mount({ manifest: unauthorizedWidget, store: createStore(unauthorizedWidget, { data: { secret: true }, status: 'unauthorized' }) })
    await act(async () => unauthorized.querySelector<HTMLButtonElement>('button')?.click())
    expect(unauthorized.textContent).toContain('Widget unavailable')
    expect(unauthorized.textContent).not.toContain('secret')

    const failedWidget = manifest({ id: 'failed' })
    const failed = mount({ manifest: failedWidget, store: createStore(failedWidget, async () => { throw new Error('Try later') }) })
    await act(async () => failed.querySelector<HTMLButtonElement>('button')?.click())
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain('Widget failedTry laterRetry')
  })

  it('places dashboard and resource widgets in ordered responsive semantic grids', () => {
    const first = manifest({ id: 'first', layout: { columnSpan: 2, columnStart: 3 }, sort: 1 })
    const second = manifest({ id: 'second', layout: { columnSpan: 'full', columnStart: null }, sort: 0 })
    const widgets = [
      { manifest: first, render: (): ReactNode => <p>First</p> },
      { manifest: second, render: (): ReactNode => <p>Second</p> },
    ]
    const dashboard = renderToString(<ReactDashboardRenderer label="Overview dashboard" widgets={widgets} width={800} />)
    expect(dashboard).toContain('aria-label="Overview dashboard"')
    expect(dashboard).toContain('data-columns="2"')
    expect(dashboard.indexOf('Second')).toBeLessThan(dashboard.indexOf('First'))

    const resource = renderToString(<ReactResourceWidgets widgets={[
      { manifest: first, placement: 'header', render: (): ReactNode => <p>First</p> },
      { manifest: second, placement: 'footer', render: (): ReactNode => <p>Second</p> },
    ]} width={500}><main>Resource record</main></ReactResourceWidgets>)
    expect(resource.indexOf('First')).toBeLessThan(resource.indexOf('Resource record'))
    expect(resource.indexOf('Second')).toBeGreaterThan(resource.indexOf('Resource record'))
    expect(resource).toContain('data-columns="1"')
  })
})
