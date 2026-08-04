<script lang="ts">
  import EntryRenderer from '../src/entries/EntryRenderer.svelte'
  import type { SvelteEntryRendererProps } from '../src/entries/contracts'

  let { entries }: { readonly entries: readonly SvelteEntryRendererProps[] } = $props()
</script>

{#each entries as entry (entry.store.snapshot.id)}
  <EntryRenderer {...entry} />
{/each}
