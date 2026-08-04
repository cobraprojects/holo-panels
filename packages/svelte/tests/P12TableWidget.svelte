<script lang="ts">
  import type { SvelteTableWidgetProps } from '../src/widgets/contracts'

  let { result, tableId, widgetId }: SvelteTableWidgetProps = $props()
</script>

<table data-table-widget={widgetId}><caption>{tableId}</caption><tbody><tr><td>{result.total}</td></tr></tbody></table>
