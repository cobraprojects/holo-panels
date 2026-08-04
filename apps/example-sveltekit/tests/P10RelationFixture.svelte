<script lang="ts">
  import SvelteRelationManagerRenderer from '../../../packages/svelte/src/relations/RelationManagerRenderer.svelte'
  import type { ClientRelationManager } from '../../../packages/testing/src/relation-acceptance'

  let { managers }: { readonly managers: readonly ClientRelationManager[] } = $props()
</script>

<SvelteRelationManagerRenderer relations={{ managers }} />
