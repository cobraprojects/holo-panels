<!-- @holo-panels-managed sha256:66c52354926179fd93e585c0cfdcae4f233acda2bd570f3099f172c99a33915c -->
<script lang="ts">
  import '@holo-js/panels-svelte/style.css'
  import { PanelAuthPage } from '@holo-js/panels-sveltekit'
</script>

<PanelAuthPage brandName={"Holo Panels"} loginPath="/admin/login" panelId="admin" simplePageMaxContentWidth="lg" theme="system" themeColors={{"primary":"#7c3aed"}} type="mfa-challenge" />
