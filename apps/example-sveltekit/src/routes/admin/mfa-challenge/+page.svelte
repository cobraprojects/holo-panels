<!-- @holo-panels-managed sha256:d99afabd5b4983bcd20cc4b8d88b5e700785d4310ef5cbc0977154a2d07c1249 -->
<script lang="ts">
  import '@holo-js/panels-svelte/style.css'
  import { PanelAuthPage } from '@holo-js/panels-sveltekit'
</script>

<PanelAuthPage brandName={"Holo Panels"} loginPath="/admin/login" panelId="admin" simplePageMaxContentWidth="lg" theme="system" appearance={{"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}}} type="mfa-challenge" />
