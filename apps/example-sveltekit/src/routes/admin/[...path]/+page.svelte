<!-- @holo-panels-managed sha256:bfb6790bf1082da7e777fe0bb9f676c9c4b92720893d91704dd06bd4c281d71c -->
<script lang="ts">
  import '@holo-js/panels-svelte/style.css'
  import { createSvelteKitPanelComponentRegistry, PanelPage } from '@holo-js/panels-sveltekit'
  import { registerPanelPluginRenderers } from '../../../../.holo-js/generated/panels/plugin-renderers'

  let { data } = $props()
  const registry = registerPanelPluginRenderers(createSvelteKitPanelComponentRegistry())
</script>

<PanelPage {data} {registry} />
