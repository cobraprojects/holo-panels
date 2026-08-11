<script lang="ts">
  import type { PanelChromeComponentProps } from '@holo-js/panels-svelte'
  let { manifest }: PanelChromeComponentProps = $props()
</script>

<header data-custom-topbar={manifest.id}>Custom topbar</header>
