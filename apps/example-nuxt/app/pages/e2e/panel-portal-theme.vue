<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PanelsPortalProvider,
} from '@holo-js/panels-vue'
import '@holo-js/panels-vue/style.css'

const darkModalOpen = ref(false)
const darkPortal = ref<HTMLElement | null>(null)
const lightPortal = ref<HTMLElement | null>(null)
const portalHosts: HTMLElement[] = []

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
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button aria-label="Open light panel menu" variant="outline">
                Open light panel menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Light panel action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Button
            type="button"
            @click="darkModalOpen = true"
          >
            Open dark panel modal
          </Button>
          <Dialog v-model:open="darkModalOpen">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dark panel modal</DialogTitle>
                <DialogDescription>This dialog belongs to the dark panel.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </PanelsPortalProvider>
      </section>
    </ClientOnly>
  </main>
</template>
