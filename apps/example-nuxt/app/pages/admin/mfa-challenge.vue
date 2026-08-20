<!-- @holo-panels-managed sha256:0942af5fee242b7b9c76c9a39987ef77a1b87b9e8b3f8a6202050435e9a7c8c2 -->
<script setup lang="ts">
import '@holo-js/panels-vue/style.css'
import { PanelAuthPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const appearance = {"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}} as const
</script>

<template>
  <PanelAuthPage :appearance="appearance" :brand-name="brandName" login-path="/admin/login" panel-id="admin" simple-page-max-content-width="lg" theme="system" type="mfa-challenge" />
</template>
