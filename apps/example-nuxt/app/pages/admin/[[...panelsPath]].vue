<!-- @holo-panels-managed sha256:e852f0c9592b5202bdf31ceeb201937b9ebd5740060f16812733a2029db7ec95 -->
<script setup lang="ts">
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
