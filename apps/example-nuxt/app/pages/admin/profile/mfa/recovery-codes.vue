<!-- @holo-panels-managed sha256:2486c689ad416092a7ae515eddf8d41799f369059776e9bf0cba983174ddbee9 -->
<script setup lang="ts">
import '@holo-js/panels-vue/style.css'
import { PanelMultiFactorPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const appearance = {"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}} as const
</script>

<template>
  <PanelMultiFactorPage :appearance="appearance" :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" />
</template>
