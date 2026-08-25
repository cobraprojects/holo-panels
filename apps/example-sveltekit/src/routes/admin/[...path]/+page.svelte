<!-- @holo-panels-managed sha256:3b2d6fec9810e6d9cea3455df875e0d0badd314bf4ade15fe8b836b021732116 -->
<script lang="ts">
  import '../../../../.holo-js/generated/panels/theme.css'
  import { createSvelteKitPanelComponentRegistry, PanelPage } from '@holo-js/panels-sveltekit'
  import { registerPanelApplicationRenderers } from '../../../../.holo-js/generated/panels/application-renderers'
  import { registerPanelPluginRenderers } from '../../../../.holo-js/generated/panels/plugin-renderers'

  let { data } = $props()
  const registry = registerPanelApplicationRenderers(registerPanelPluginRenderers(createSvelteKitPanelComponentRegistry()))
</script>

<PanelPage {data} {registry} />
