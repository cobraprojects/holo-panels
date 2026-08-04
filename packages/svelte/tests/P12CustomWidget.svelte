<script lang="ts">
  import type { SvelteCustomWidgetProps } from '../src/widgets/contracts'

  let { properties, widgetId }: SvelteCustomWidgetProps = $props()
</script>

<p data-custom-widget={widgetId}>{properties.message}</p>
