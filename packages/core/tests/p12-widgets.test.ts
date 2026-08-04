import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { defineChartWidget, defineCustomWidget, defineResourceStatsWidget, defineStatsWidget, defineTableWidget, type WidgetBuilder } from '../src/widgets/builder'
import { createResourceWidgetContext, defineDashboard, selectDefaultDashboard } from '../src/widgets/dashboard'
import { createAccessibleChartModel, renderAccessibleChart, requireResolvedWidget, resolveTableWidgetData, resolveWidget, WidgetAccessError } from '../src/widgets/resolution'
import type { ChartWidgetData, StatsWidgetData } from '../src/widgets/contracts'
import { createExtensionTypeId } from '../src/plugins/type-id'

class Actor {
  declare readonly id: number
  declare readonly role: string
}

class Services {
  declare readonly source: string
}

class PostRecord {
  declare readonly id: number
  declare readonly title: string
}

const signal = new AbortController().signal
const context = {
  actor: { id: 1, role: 'admin' },
  locale: 'en',
  panelId: 'admin',
  services: { source: 'orders' },
  signal,
  tenant: 'acme',
}

describe('P12 widget definitions and resolution', () => {
  it('builds stats, chart, table, and custom manifests with fluent layout and behavior contracts', () => {
    const stats = defineStatsWidget('sales')
      .heading('Sales')
      .description('Current period')
      .sort(10)
      .columnSpan(2)
      .columnStart(1)
      .lazy()
      .poll(30_000)
      .filter('period', 'Period', 'month')
      .emptyState('No sales')
      .errorState('Sales unavailable')

    expectTypeOf(stats).toEqualTypeOf<WidgetBuilder<StatsWidgetData>>()
    expect(stats.compile().manifest).toMatchObject({
      family: 'stats',
      filters: [{ defaultValue: 'month', id: 'period', label: 'Period' }],
      layout: { columnSpan: 2, columnStart: 1 },
      lazy: true,
      polling: { enabled: true, interval: 30_000 },
    })
    expect(defineChartWidget('revenue').compile().manifest.family).toBe('chart')
    expect(defineTableWidget('latest-orders').compile().manifest.family).toBe('table')
    expect(defineCustomWidget('weather', createExtensionTypeId('app.weather', 'widget', 'forecast')).compile().manifest.type).toBe('app.weather:widget:forecast')
    expect(stats.compileDiscoveryDefinition()).toMatchObject({
      componentKeys: ['panels.widgets.stats'],
      id: 'sales',
      kind: 'widget',
      permissionKeys: ['widgets.sales.view'],
    })
    expect(() => defineStatsWidget('invalid widget')).toThrow('stable identifier')
    expect(() => defineStatsWidget('stats').columnSpan(0)).toThrow('positive integer')
  })

  it('checks visibility and authorization before data, applies only allow-listed filters, and keeps callbacks server-only', async () => {
    let dataCalls = 0
    const data = (scope: { readonly filters: Readonly<Record<string, unknown>> }): StatsWidgetData => {
      dataCalls += 1
      return ({
      stats: [{
        action: null,
        chart: [10, 12],
        color: 'success',
        description: 'Up 20%',
        icon: 'currency',
        id: 'revenue',
        label: 'Revenue',
        trend: 'up' as const,
        url: '/admin/orders',
        value: `${String(scope.filters.period)}:120`,
      }],
      })
    }
    const widget = defineStatsWidget('sales', { actor: Actor, services: Services, tenant: String })
      .filter('period', 'Period', 'month')
      .visible(scope => scope.tenant === 'acme')
      .authorize(scope => scope.actor.role === 'admin')
      .data(data)
      .compile()

    const ready = await resolveWidget(widget, context, { period: 'year' })
    expect(requireResolvedWidget(ready).stats[0]?.value).toBe('year:120')
    expect(dataCalls).toBe(1)
    expect(JSON.stringify(widget.manifest)).not.toContain('role')
    await expect(resolveWidget(widget, context, { injected: true })).rejects.toThrow('Unknown widget filter')

    const denied = await resolveWidget(widget, { ...context, actor: { id: 2, role: 'viewer' } })
    expect(denied).toMatchObject({ data: null, status: 'unauthorized' })
    expect(() => requireResolvedWidget(denied)).toThrow(WidgetAccessError)
    expect(dataCalls).toBe(1)

    const hidden = await resolveWidget(widget, { ...context, tenant: 'other' })
    expect(hidden.status).toBe('hidden')
    expect(dataCalls).toBe(1)
  })

  it('creates an accessible renderer-neutral chart table and rejects invalid series data', () => {
    const chart: ChartWidgetData = {
      description: 'Revenue by month, in dollars',
      series: [
        { color: 'primary', id: 'current', label: 'Current', points: [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 14 }] },
        { color: 'muted', id: 'previous', label: 'Previous', points: [{ label: 'Jan', value: 8 }] },
      ],
      summary: 'Monthly revenue',
      type: 'line',
    }
    expect(createAccessibleChartModel(chart)).toEqual({
      caption: 'Monthly revenue',
      columns: ['Current', 'Previous'],
      description: 'Revenue by month, in dollars',
      rows: [{ label: 'Jan', values: [10, 8] }, { label: 'Feb', values: [14, null] }],
    })
    expect(renderAccessibleChart(chart, { render: (_data, accessibility) => accessibility.caption })).toBe('Monthly revenue')
    expect(() => createAccessibleChartModel({ ...chart, series: [...chart.series, chart.series[0]!] })).toThrow('unique stable IDs')
    expect(() => createAccessibleChartModel({ ...chart, description: '' })).toThrow('accessible')
  })

  it('composes table widgets through the table execution contract', async () => {
    const execute = vi.fn(async () => ({ hasMore: false, lastPage: 1, mode: 'page' as const, page: 1, perPage: 10, records: [{ id: 1 }], total: 1 }))
    const data = await resolveTableWidgetData('latest-orders', { execute }, { pagination: 'page', perPage: 10 }, { tenant: 'acme' })
    expect(execute).toHaveBeenCalledWith({ pagination: 'page', perPage: 10 }, { tenant: 'acme' })
    expect(data).toEqual({ tableId: 'latest-orders', result: { hasMore: false, lastPage: 1, mode: 'page', page: 1, perPage: 10, records: [{ id: 1 }], total: 1 } })
  })

  it('selects the explicit authorized dashboard or the first authorized navigation item', async () => {
    const reports = defineDashboard('reports', { actor: Actor, services: Services, tenant: String })
      .path('/reports')
      .navigation('Reports', { sort: 20 })
      .authorize(scope => scope.actor.role === 'analyst')
      .widgets('sales')
      .compile()
    const overview = defineDashboard('overview', { actor: Actor, services: Services, tenant: String })
      .path('/overview')
      .navigation('Overview', { sort: 10 })
      .widgets('sales', 'latest-orders')
      .compile()
    expect((await selectDefaultDashboard([reports, overview], context))?.manifest.id).toBe('overview')

    const preferred = defineDashboard('preferred', { actor: Actor, services: Services, tenant: String }).default().navigation('Preferred', { sort: 50 }).compile()
    expect((await selectDefaultDashboard([overview, preferred], context))?.manifest.id).toBe('preferred')
    expect(await selectDefaultDashboard([reports], context)).toBeNull()
    await expect(selectDefaultDashboard([preferred, defineDashboard('duplicate', { actor: Actor, services: Services, tenant: String }).default().compile()], context)).rejects.toThrow('Only one')
    expect(defineDashboard('metrics').path('/metrics').widgets('sales').compileDiscoveryDefinition()).toMatchObject({
      id: 'metrics',
      kind: 'page',
      navigationKeys: ['metrics'],
      route: '/metrics',
    })
  })

  it('provides constrained resource header/footer context without arbitrary client queries', () => {
    const resource = createResourceWidgetContext(
      context,
      'posts',
      'edit-post',
      'header',
      { record: { id: 12, title: 'Typed' }, tableState: { pagination: 'page', search: 'safe' } },
    )
    expect(resource).toMatchObject({ pageId: 'edit-post', placement: 'header', record: { id: 12 }, resourceId: 'posts', tableState: { search: 'safe' } })
    expect(Object.isFrozen(resource)).toBe(true)
    defineResourceStatsWidget('post-stats', { actor: Actor, record: PostRecord, services: Services, tenant: String })
      .data(scope => ({ stats: [{ action: null, chart: [], color: null, description: null, icon: null, id: 'record', label: 'Record', trend: null, url: null, value: scope.resource?.record?.title ?? 'none' }] }))
  })

  it('honors cancellation before authorization and after asynchronous data resolution', async () => {
    const controller = new AbortController()
    controller.abort(new Error('stopped'))
    const authorize = vi.fn(() => true)
    const widget = defineStatsWidget('cancelled').authorize(authorize).compile()
    await expect(resolveWidget(widget, { ...context, signal: controller.signal })).rejects.toThrow('stopped')
    expect(authorize).not.toHaveBeenCalled()

    const during = new AbortController()
    let resolveData: (data: StatsWidgetData) => void = () => undefined
    const dataPromise = new Promise<StatsWidgetData>(resolve => {
      resolveData = resolve
    })
    const loading = resolveWidget(defineStatsWidget('during').data(() => dataPromise).compile(), { ...context, signal: during.signal })
    during.abort(new Error('cancelled during load'))
    resolveData({ stats: [] })
    await expect(loading).rejects.toThrow('cancelled during load')
  })
})
