<script lang="ts">
  import type { SvelteCustomEntryProps } from '../src/entries/contracts'

  let { entry }: SvelteCustomEntryProps = $props()
</script>

<output data-custom-entry>{entry.state}</output>
