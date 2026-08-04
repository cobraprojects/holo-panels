<script lang="ts">
  import ActionRenderer from '../src/actions/ActionRenderer.svelte'
  import type { SvelteActionRendererProps } from '../src/actions/contracts'

  let { action }: { action: SvelteActionRendererProps } = $props()
</script>

<ActionRenderer {...action} />
