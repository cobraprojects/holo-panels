import { WidgetStore, type WidgetClientManifest, type WidgetScheduler } from '@holo-js/panels-client'
import type { JsonValue, WidgetManifest } from '@holo-js/panels-core'
import type {
  WidgetAcceptanceFixture,
  WidgetAcceptanceItem,
  WidgetAcceptanceJourneyReport,
  WidgetAcceptanceModel,
} from './contracts'

class AcceptanceScheduler implements WidgetScheduler {
  cleared = false

  clear(): void {
    this.cleared = true
  }

  every(): object {
    return {}
  }
}

function manifest(
  id: string,
  family: WidgetManifest['family'],
  options: Partial<WidgetManifest> = {},
): WidgetManifest {
  return {
    description: `${id} description`,
    emptyState: `No ${id} data`,
    errorState: `Unable to load ${id}`,
    family,
    filters: [],
    heading: id.split('-').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' '),
    id,
    layout: { columnSpan: 1, columnStart: null },
    lazy: false,
    polling: { enabled: false, interval: null },
    sort: 0,
    type: `panels.widgets.${family}`,
    ...options,
  }
}

async function item(
  widgetManifest: WidgetManifest,
  data: JsonValue,
  placement: WidgetAcceptanceItem['placement'],
): Promise<WidgetAcceptanceItem> {
  const store = new WidgetStore(widgetManifest as WidgetClientManifest, async () => ({ data, status: 'ready' }))
  await store.load()
  return { manifest: widgetManifest, placement, store }
}

function statsValue(value: JsonValue): string {
  if (value === null || Array.isArray(value) || typeof value !== 'object') throw new Error('Stats acceptance data must be an object')
  const stats = value.stats
  if (!Array.isArray(stats)) throw new Error('Stats acceptance data must contain stats')
  const first = stats[0]
  if (first === null || Array.isArray(first) || typeof first !== 'object') throw new Error('Stats acceptance data must contain a stat')
  if (typeof first.value !== 'string') throw new Error('Stats acceptance value must be a string')
  return first.value
}

async function model(): Promise<{ readonly filteredValue: string, readonly model: WidgetAcceptanceModel, readonly pollingCancelled: boolean }> {
  const scheduler = new AcceptanceScheduler()
  const statsManifest = manifest('sales', 'stats', {
    filters: [{ defaultValue: 'month', id: 'period', label: 'Period' }],
    layout: { columnSpan: 2, columnStart: 1 },
    polling: { enabled: true, interval: 30_000 },
    sort: 10,
  })
  const statsStore = new WidgetStore(statsManifest as WidgetClientManifest, async (_id, filters) => ({
    data: {
      stats: [{ action: 'refresh-sales', chart: [80, 100, 120], color: 'success', description: 'Up 20%', icon: 'currency', id: 'revenue', label: 'Revenue', trend: 'up', url: '/admin/orders', value: `${String(filters.period)}:120` }],
    },
    status: 'ready',
  }), { scheduler })
  await statsStore.setFilter('period', 'year')
  statsStore.startPolling()
  statsStore.stop()
  const filteredValue = statsValue(statsStore.snapshot.data)

  const dashboardWidgets: WidgetAcceptanceItem[] = [
    { manifest: statsManifest, placement: 'dashboard', store: statsStore },
    await item(manifest('revenue-chart', 'chart', { layout: { columnSpan: 2, columnStart: 3 }, sort: 20 }), {
      description: 'Revenue by month in dollars',
      series: [{ color: 'primary', id: 'revenue', label: 'Revenue', points: [{ label: 'Jan', value: 100 }, { label: 'Feb', value: 120 }] }],
      summary: 'Monthly revenue',
      type: 'line',
    }, 'dashboard'),
    await item(manifest('latest-orders', 'table', { sort: 30 }), {
      result: { records: [{ id: 1, name: 'Order 1001' }] },
      tableId: 'orders',
    }, 'dashboard'),
    await item(manifest('weather', 'custom', { sort: 40, type: 'app.widgets.weather' }), {
      component: 'app.widgets.weather',
      properties: { forecast: 'Sunny' },
    }, 'dashboard'),
  ]
  const resourceWidgets = [
    await item(manifest('post-stats', 'stats'), {
      stats: [{ action: null, chart: [1, 3], color: null, description: 'Current post', icon: null, id: 'views', label: 'Views', trend: 'up', url: null, value: 3 }],
    }, 'resource-header'),
    await item(manifest('post-weather', 'custom', { type: 'app.widgets.weather' }), {
      component: 'app.widgets.weather',
      properties: { forecast: 'Resource sunshine' },
    }, 'resource-footer'),
  ]
  return {
    filteredValue,
    model: { dashboardId: 'overview', dashboardWidgets, resourceWidgets, viewportWidth: 1280 },
    pollingCancelled: scheduler.cleared,
  }
}

export async function runWidgetAcceptanceJourney(fixture: WidgetAcceptanceFixture): Promise<WidgetAcceptanceJourneyReport> {
  const current = await model()
  const render = await fixture.render(current.model)
  return {
    filteredValue: current.filteredValue,
    framework: fixture.framework,
    pollingCancelled: current.pollingCancelled,
    render,
  }
}
