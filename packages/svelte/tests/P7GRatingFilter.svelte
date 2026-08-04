<script lang="ts">
  import type { SvelteCustomFilterProps } from '../src/tables/types'

  let { filter, update, value }: SvelteCustomFilterProps = $props()
</script>

{#if filter.manifest.type === 'custom'}
  <div data-custom-filter-schema={JSON.stringify(filter.manifest.properties.schema)}></div>
{:else}
  <button data-rating-filter type="button" onclick={() => update(Number(value) + 1)}>Rating</button>
{/if}
