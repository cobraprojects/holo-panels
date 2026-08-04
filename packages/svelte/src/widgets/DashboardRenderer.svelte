<script lang="ts">
  import WidgetRenderer from './WidgetRenderer.svelte'
  import type { SvelteDashboardRendererProps } from './contracts'
  import { dashboardGrid, gridStyle } from './helpers'

  let { dashboardId, label, placement = 'dashboard', widgets, width }: SvelteDashboardRendererProps = $props()
  const items = $derived(dashboardGrid(widgets.filter(widget => widget.placement === placement), width))
  const columns = $derived(items[0]?.placement.columns ?? (width < 640 ? 1 : width < 1024 ? 2 : 4))
</script>

<section aria-label={label} class="hp-dashboard" data-dashboard={dashboardId} data-placement={placement} style={`--hp-widget-columns:${columns}`}>
  {#each items as item (item.widget.manifest.id)}
    <div class="hp-dashboard-widget" data-column-span={item.placement.columnSpan} data-column-start={item.placement.columnStart} style={gridStyle(item)}>
      <WidgetRenderer {...item.widget} />
    </div>
  {/each}
</section>
