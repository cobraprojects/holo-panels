<!-- @holo-panels-managed sha256:05178b57ed0bed95655524fd3e32c53967b725f5e43a5d08236485ce1b3ab80e -->
<script setup lang="ts">
import { PanelProfilePage } from '@holo-js/panels-nuxt'

const brandName = "Holo Panels Admin"
const themeColors = {"primary":"#7c3aed"}
</script>

<template>
  <PanelProfilePage :brand-name="brandName" panel-id="admin" simple-page-max-content-width="lg" theme="system" :theme-colors="themeColors" />
</template>
