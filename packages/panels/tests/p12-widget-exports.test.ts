import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type DashboardBuilder,
  type WidgetBuilder,
  WidgetStore,
  defineChartWidget,
  defineCustomWidget,
  defineDashboard,
  defineStatsWidget,
  defineTableWidget,
  type ChartWidgetData,
  type StatsWidgetData,
} from '../src/index'

describe('P12 umbrella widget exports', () => {
  it('exposes the approved widget, dashboard, and client state APIs from the normal install target', () => {
    const stats = defineStatsWidget('sales')
    const dashboard = defineDashboard('overview').widgets('sales')

    expectTypeOf(stats).toEqualTypeOf<WidgetBuilder<StatsWidgetData>>()
    expectTypeOf(dashboard).toEqualTypeOf<DashboardBuilder>()
    expect(defineChartWidget('chart').compile().manifest.family).toBe('chart')
    expect(defineTableWidget('table').compile().manifest.family).toBe('table')
    expect(defineCustomWidget('custom').compile().manifest.family).toBe('custom')
    expectTypeOf<ChartWidgetData['type']>().toEqualTypeOf<'area' | 'bar' | 'line' | 'pie'>()
    expect(WidgetStore).toBeTypeOf('function')
  })
})
