<!-- @holo-panels-managed sha256:79b60fd703ab4d552cda1d933813e80b816a4c5ad62383addc7d367b5c737275 -->
<script setup lang="ts">
import '../../../.holo-js/generated/panels/theme.css'
import { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } from '@holo-js/panels-nuxt'
import { registerPanelApplicationRenderers } from '../../../.holo-js/generated/panels/application-renderers'
import { registerPanelPluginRenderers } from '../../../.holo-js/generated/panels/plugin-renderers'

definePageMeta({
  middleware: async (to) => {
    let loginPath = '/login'
    try {
      const presentation = await useRequestFetch()('/holo/panels/admin/auth/presentation')
      const configuredLoginPath = presentation && typeof presentation === 'object' ? Reflect.get(presentation, 'loginPath') : null
      if (typeof configuredLoginPath === 'string') loginPath = configuredLoginPath
      await useRequestFetch()('/holo/panels/admin/auth/mfa-status')
    } catch {
      return navigateTo(`${loginPath}?next=${encodeURIComponent(to.fullPath)}`, { redirectCode: 302 })
    }
  },
})

const panelPage = await usePanelPage({ panelId: 'admin' })
const registry = registerPanelApplicationRenderers(registerPanelPluginRenderers(createNuxtPanelComponentRegistry()))
</script>

<template>
  <PanelPage :page="panelPage" :registry="registry" />
</template>
