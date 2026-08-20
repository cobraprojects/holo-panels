<!-- @holo-panels-managed sha256:3bc9c218be5c248a378905133c50816b90429f5586541da2050def9cd5accd75 -->
<script setup lang="ts">
import '@holo-js/panels-vue/style.css'
import { PanelLoginPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const appearance = {"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}} as const
</script>

<template>
  <PanelLoginPage :appearance="appearance" :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" />
</template>
