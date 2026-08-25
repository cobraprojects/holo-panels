<!-- @holo-panels-managed sha256:c2b0a2d2075c88769d879d6f5c6ba40f86015819f9ba2532b0385a797b5262e2 -->
<script setup lang="ts">
import '../../../.holo-js/generated/panels/theme.css'
import { PanelAuthPage } from '@holo-js/panels-nuxt'
</script>

<template>
  <PanelAuthPage panel-id="admin" type="mfa-challenge" />
</template>
