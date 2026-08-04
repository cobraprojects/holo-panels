<script lang="ts">
  import { SvelteComponentRegistry } from '../../../packages/svelte/src/registry'
  import DashboardRenderer from '../../../packages/svelte/src/widgets/DashboardRenderer.svelte'
  import type { SvelteDashboardWidget } from '../../../packages/svelte/src/widgets/contracts'
  import type { WidgetAcceptanceModel } from '../../../packages/testing/src/widget-acceptance'
  import P12TableWidget from './P12TableWidget.svelte'
  import P12WeatherWidget from './P12WeatherWidget.svelte'

  let { model }: { readonly model: WidgetAcceptanceModel } = $props()
  const registry = new SvelteComponentRegistry()
  registry.register({ component: P12WeatherWidget, source: 'example-sveltekit', typeId: 'app.widgets.weather' })
  const dashboard = $derived(model.dashboardWidgets.map(widget => ({ ...widget, registry, tableRenderer: P12TableWidget }) satisfies SvelteDashboardWidget))
  const resources = $derived(model.resourceWidgets.map(widget => ({ ...widget, registry, tableRenderer: P12TableWidget }) satisfies SvelteDashboardWidget))
</script>

<DashboardRenderer dashboardId={model.dashboardId} label="Overview dashboard" placement="dashboard" widgets={dashboard} width={model.viewportWidth} />
<DashboardRenderer label="Resource header widgets" placement="resource-header" widgets={resources} width={model.viewportWidth} />
<main>Post resource</main>
<DashboardRenderer label="Resource footer widgets" placement="resource-footer" widgets={resources} width={model.viewportWidth} />
