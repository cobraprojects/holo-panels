<script lang="ts">
  import type { PanelChromeComponentProps } from '@holo-js/panels-svelte'
  let { actor }: PanelChromeComponentProps = $props()
</script>

<aside data-custom-sidebar={actor.id}>Custom sidebar</aside>
