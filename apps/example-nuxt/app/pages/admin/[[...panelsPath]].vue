<script setup lang="ts">
import { PanelPage, usePanelPage } from '@holo-js/panels-nuxt'

definePageMeta({ middleware: 'panel-auth' })

const panelPage = await usePanelPage({ panelId: 'admin' })
</script>

<template>
  <PanelPage :page="panelPage" />
</template>
