<script lang="ts">
  import TableRenderer from '../src/tables/TableRenderer.svelte'
  import type { SvelteTableRendererProps } from '../src/tables/types'

  export interface P16Record extends Record<string, unknown> {
    readonly active: boolean
    readonly avatar: string
    readonly id: number
    readonly title: string
  }

  let { table }: { readonly table: SvelteTableRendererProps<P16Record, number> } = $props()
</script>

<TableRenderer {table} />
