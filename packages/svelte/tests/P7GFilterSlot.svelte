<script lang="ts">
  import type { SvelteFilterCollectionSlotProps } from '../src/tables/types'

  let { placement }: SvelteFilterCollectionSlotProps = $props()
</script>

<p data-filter-slot={placement}>{placement} filters</p>
