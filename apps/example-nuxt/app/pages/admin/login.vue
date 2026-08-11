<!-- @holo-panels-managed sha256:c200e5b95980bafb566c8a581f9af922df4baef2881413bd6b40f960fdfb7e74 -->
<script setup lang="ts">
import { PanelLoginPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const themeColors = {"primary":"#7c3aed"}
</script>

<template>
  <PanelLoginPage :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" :theme-colors="themeColors" />
</template>
