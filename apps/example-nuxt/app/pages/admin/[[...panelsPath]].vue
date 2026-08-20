<!-- @holo-panels-managed sha256:5bffd5fd6849af1bcef90ce5b4179fe4f35f042ac05e324e6d5b719712f1e943 -->
<script setup lang="ts">
import '@holo-js/panels-vue/style.css'
import { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } from '@holo-js/panels-nuxt'
import { registerPanelPluginRenderers } from '../../../.holo-js/generated/panels/plugin-renderers'

definePageMeta({
  middleware: async (to) => {
    try {
      await useRequestFetch()('/holo/panels/admin/auth/mfa-status')
    } catch {
      return navigateTo(`/admin/login?next=${encodeURIComponent(to.fullPath)}`, { redirectCode: 302 })
    }
  },
})

const panelPage = await usePanelPage({ panelId: 'admin' })
const registry = registerPanelPluginRenderers(createNuxtPanelComponentRegistry())
</script>

<template>
  <PanelPage :page="panelPage" :registry="registry" />
</template>
