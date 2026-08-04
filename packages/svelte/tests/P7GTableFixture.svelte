<script lang="ts">
  import TableRenderer from '../src/tables/TableRenderer.svelte'
  import type { SvelteTableRendererProps } from '../src/tables/types'

  interface PostRecord extends Record<string, unknown> {
    readonly id: number
    readonly status: string
    readonly title: string
    readonly version: string
  }

  let { table }: { table: SvelteTableRendererProps<PostRecord, number> } = $props()
</script>

<TableRenderer {table} />
