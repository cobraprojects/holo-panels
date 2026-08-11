import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type DashboardBuilder,
  type DefaultPanelActor,
  type DefaultPanelServices,
  type DefaultPanelTenant,
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
    const stats = defineStatsWidget('sales').authorize(context => {
      expectTypeOf(context.actor.name).toEqualTypeOf<string | undefined>()
      expectTypeOf(context.tenant).toEqualTypeOf<string>()
      return true
    })
    const dashboard = defineDashboard('overview').widgets('sales')

    expectTypeOf(stats).toEqualTypeOf<WidgetBuilder<StatsWidgetData, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>>()
    expectTypeOf(dashboard).toEqualTypeOf<DashboardBuilder>()
    expect(defineChartWidget('chart').compile().manifest.family).toBe('chart')
    expect(defineTableWidget('table').compile().manifest.family).toBe('table')
    expect(defineCustomWidget('custom').compile().manifest.family).toBe('custom')
    expectTypeOf<ChartWidgetData['type']>().toEqualTypeOf<'area' | 'bar' | 'line' | 'pie'>()
    expect(WidgetStore).toBeTypeOf('function')
  })
})
