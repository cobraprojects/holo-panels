<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  PanelsDropdown,
  PanelsModal,
  PanelsPortalProvider,
} from '@holo-js/panels-vue'
import '@holo-js/panels-vue/style.css'

const darkModalOpen = ref(false)
const darkPortal = ref<HTMLElement | null>(null)
const lightPortal = ref<HTMLElement | null>(null)
const portalHosts: HTMLElement[] = []

const lightItems = [
  { id: 'light-action', label: 'Light panel action' },
] as const

function createPortalHost(theme: 'dark' | 'light'): HTMLElement {
  const container = window.document.createElement('div')
  container.className = 'hp-panel-portal-host'
  container.dataset.e2ePortalHost = theme
  container.dataset.holoPanel = ''
  container.dataset.panel = `e2e-${theme}`
  container.dataset.theme = theme
  window.document.body.append(container)
  portalHosts.push(container)
  return container
}

onMounted(() => {
  lightPortal.value = createPortalHost('light')
  darkPortal.value = createPortalHost('dark')
})

onBeforeUnmount(() => {
  for (const container of portalHosts.splice(0)) container.remove()
})
</script>

<template>
  <main class="hp-main" data-e2e-panel-portal-theme>
    <h1>Panel portal theme isolation</h1>

    <ClientOnly>
      <section
        class="hp-panel hp-section"
        data-e2e-panel="light"
        data-holo-panel
        data-panel="e2e-light"
        data-theme="light"
      >
        <h2>Light panel</h2>
        <PanelsPortalProvider :container="lightPortal">
          <PanelsDropdown
            aria-label="Open light panel menu"
            :items="lightItems"
            label="Open light panel menu"
          />
        </PanelsPortalProvider>
      </section>

      <section
        class="hp-panel hp-section"
        data-e2e-panel="dark"
        data-holo-panel
        data-panel="e2e-dark"
        data-theme="dark"
      >
        <h2>Dark panel</h2>
        <PanelsPortalProvider :container="darkPortal">
          <button
            class="hp-button"
            type="button"
            @click="darkModalOpen = true"
          >
            Open dark panel modal
          </button>
          <PanelsModal
            :open="darkModalOpen"
            title="Dark panel modal"
            @close="darkModalOpen = false"
          >
            <p>This dialog belongs to the dark panel.</p>
          </PanelsModal>
        </PanelsPortalProvider>
      </section>
    </ClientOnly>
  </main>
</template>
