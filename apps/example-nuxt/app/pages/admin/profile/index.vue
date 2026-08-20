<!-- @holo-panels-managed sha256:03b04e582cc143b8e8ab6da9096a3d8d6d55b7597e5b016e311eb7d4e2b167e7 -->
<script setup lang="ts">
import '@holo-js/panels-vue/style.css'
import { PanelProfilePage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const appearance = {"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}} as const
</script>

<template>
  <PanelProfilePage :appearance="appearance" :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" />
</template>
