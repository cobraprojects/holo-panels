import {
  ComponentRegistry,
  VueDashboardRenderer,
  VueResourceWidgets,
  registerVueWidgetRenderer,
  type VueCustomWidgetProps,
} from '@holo-js/panels-vue'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { WidgetAcceptanceFixture, WidgetAcceptanceModel, WidgetAcceptanceRenderReport } from '../../../packages/testing/src/widget-acceptance'

const WeatherWidget = defineComponent({
  name: 'WeatherWidget',
  props: { data: { type: Object, required: true } },
  setup(props: { readonly data: VueCustomWidgetProps['data'] }) {
    return () => h('p', { 'data-custom-widget': 'weather' }, String(props.data.properties.forecast))
  },
})

const registry = registerVueWidgetRenderer(new ComponentRegistry(), 'app.widgets.weather', WeatherWidget)

async function render(model: WidgetAcceptanceModel): Promise<string> {
  const widgets = model.dashboardWidgets.map(current => ({
    manifest: current.manifest,
    panelId: 'admin',
    registry,
    renderTable: (data: { readonly result: Readonly<Record<string, unknown>>, readonly tableId: string }) => h('p', { 'data-table-widget': data.tableId }, JSON.stringify(data.result.records)),
    store: current.store,
  }))
  const resource = model.resourceWidgets.map(current => ({ manifest: current.manifest, panelId: 'admin', registry, store: current.store }))
  const component = defineComponent(() => () => h('div', [
    h(VueDashboardRenderer, { dashboard: { dashboardId: model.dashboardId, label: 'Overview dashboard', viewportWidth: model.viewportWidth, widgets } }),
    h(VueResourceWidgets, { area: { pageId: 'edit-post', placement: 'header', resourceId: 'posts', viewportWidth: model.viewportWidth, widgets: resource.filter((_item, index) => model.resourceWidgets[index]?.placement === 'resource-header') } }),
    h('main', 'Post resource'),
    h(VueResourceWidgets, { area: { pageId: 'edit-post', placement: 'footer', resourceId: 'posts', viewportWidth: model.viewportWidth, widgets: resource.filter((_item, index) => model.resourceWidgets[index]?.placement === 'resource-footer') } }),
  ]))
  return renderToString(createSSRApp(component))
}

export const nuxtWidgetAcceptanceFixture: WidgetAcceptanceFixture = {
  framework: 'vue',
  async render(model): Promise<WidgetAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'vue', markup, ssrStable: markup === await render(model) }
  },
}
