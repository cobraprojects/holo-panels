<!-- @holo-panels-managed sha256:bc653d246e3d1857b88ee0b3fa27e562e434427f218d6dcde531770459c9ab43 -->
<script setup lang="ts">
import '../../../.holo-js/generated/panels/theme.css'
import { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } from '@holo-js/panels-nuxt'
import { registerPanelApplicationRenderers } from '../../../.holo-js/generated/panels/application-renderers'
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
const registry = registerPanelApplicationRenderers(registerPanelPluginRenderers(createNuxtPanelComponentRegistry()))
</script>

<template>
  <PanelPage :page="panelPage" :registry="registry" />
</template>
