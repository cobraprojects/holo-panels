import {
  ComponentRegistry,
  ReactDashboardRenderer,
  ReactResourceWidgets,
  ReactWidgetRenderer,
  registerReactWidgetRenderer,
  type ReactCustomWidgetProps,
} from '@holo-js/panels-react'
import { createElement, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import type { WidgetAcceptanceFixture, WidgetAcceptanceModel, WidgetAcceptanceRenderReport } from '../../../packages/testing/src/widget-acceptance'

function WeatherWidget(props: ReactCustomWidgetProps): React.ReactNode {
  return createElement('p', { 'data-custom-widget': 'weather' }, String(props.properties.forecast))
}

const registry = registerReactWidgetRenderer(new ComponentRegistry(), 'app.widgets.weather', WeatherWidget)

function widget(model: WidgetAcceptanceModel, index: number): React.ReactNode {
  const current = [...model.dashboardWidgets, ...model.resourceWidgets][index]
  if (!current) throw new Error('Widget acceptance item is unavailable')
  return createElement(ReactWidgetRenderer, {
    manifest: current.manifest,
    panelId: 'admin',
    registry,
    renderTable: props => createElement('p', { 'data-table-widget': props.data.tableId }, JSON.stringify(props.data.result.records)),
    store: current.store,
  })
}

function render(model: WidgetAcceptanceModel): string {
  const all = [...model.dashboardWidgets, ...model.resourceWidgets]
  const dashboard = model.dashboardWidgets.map((current, index) => ({ manifest: current.manifest, render: () => widget(model, index) }))
  const resources = model.resourceWidgets.map((current, resourceIndex) => ({
    manifest: current.manifest,
    placement: current.placement === 'resource-header' ? 'header' as const : 'footer' as const,
    render: () => widget(model, model.dashboardWidgets.length + resourceIndex),
  }))
  if (all.length === 0) throw new Error('Widget acceptance requires widgets')
  return renderToString(createElement(Fragment, null,
    createElement(ReactDashboardRenderer, { label: 'Overview dashboard', widgets: dashboard, width: model.viewportWidth }),
    createElement(ReactResourceWidgets, { children: createElement('main', null, 'Post resource'), widgets: resources, width: model.viewportWidth }),
  ))
}

export const nextWidgetAcceptanceFixture: WidgetAcceptanceFixture = {
  framework: 'react',
  async render(model): Promise<WidgetAcceptanceRenderReport> {
    const markup = render(model)
    return { framework: 'react', markup, ssrStable: markup === render(model) }
  },
}
