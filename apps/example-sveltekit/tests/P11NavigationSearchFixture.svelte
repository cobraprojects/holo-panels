<script lang="ts">
  import NavigationSearchRenderer from '../../../packages/svelte/src/navigation/NavigationSearchRenderer.svelte'
  import type { NavigationSearchAcceptanceModel } from '../../../packages/testing/src/navigation-search-acceptance'

  let { model }: { readonly model: NavigationSearchAcceptanceModel } = $props()
</script>

<NavigationSearchRenderer shell={model} />
