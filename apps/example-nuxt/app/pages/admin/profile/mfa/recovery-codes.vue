<!-- @holo-panels-managed sha256:90c3eb5400971febf3e65c7c3d97f8cbd8eed906f0ea272428b526d19c99a3a0 -->
<script setup lang="ts">
import { PanelMultiFactorPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const themeColors = {"primary":"#7c3aed"}
</script>

<template>
  <PanelMultiFactorPage :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" :theme-colors="themeColors" />
</template>
