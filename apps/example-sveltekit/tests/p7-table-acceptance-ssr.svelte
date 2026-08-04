<script lang="ts">
  import TableRenderer from '../../../packages/svelte/src/tables/TableRenderer.svelte'
  import type { TableAcceptanceModel } from '../../../packages/testing/src/table-acceptance/index'

  let { table }: { table: TableAcceptanceModel } = $props()
</script>

<TableRenderer {table} />
