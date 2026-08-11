<!-- @holo-panels-managed sha256:1411cf31f83d3114940de05bd189d2c53fb9d7664cd27eeb15fc1571450943ff -->
<script setup lang="ts">
import { PanelAuthPage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const themeColors = {"primary":"#7c3aed"}
</script>

<template>
  <PanelAuthPage :brand-name="brandName" login-path="/admin/login" panel-id="admin" simple-page-max-content-width="lg" theme="system" :theme-colors="themeColors" type="mfa-challenge" />
</template>
