<script lang="ts">
  import type { JsonObject } from '@holo-js/panels-client'

  let { result, tableId }: { readonly result: JsonObject, readonly tableId: string, readonly widgetId: string } = $props()
</script>

<p data-table-widget={tableId}>{JSON.stringify(result.records)}</p>
