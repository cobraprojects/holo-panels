<script lang="ts">
  import { onMount } from 'svelte'
  import {
    PanelsDropdown,
    PanelsModal,
    setPanelsPortalTarget,
  } from '@holo-js/panels-svelte'

  type Overlay = 'dropdown' | 'modal'
  type Theme = 'dark' | 'light'

  interface Props {
    overlay: Overlay
    theme: Theme
  }

  let { overlay, theme }: Props = $props()
  let modalOpen = $state(false)
  let portalElement = $state<HTMLElement>()

  const lightItems = [
    { id: 'light-action', label: 'Light panel action' },
  ] as const

  setPanelsPortalTarget(() => portalElement)

  onMount(() => {
    const container = window.document.createElement('div')
    container.className = 'hp-panel-portal-host'
    container.dataset.e2ePortalHost = theme
    container.dataset.holoPanel = ''
    container.dataset.panel = `e2e-${theme}`
    container.dataset.theme = theme
    window.document.body.append(container)
    portalElement = container

    return () => container.remove()
  })
</script>

<section
  class="hp-panel hp-section"
  data-e2e-panel={theme}
  data-holo-panel
  data-panel={`e2e-${theme}`}
  data-theme={theme}
>
  <h2>{theme === 'light' ? 'Light panel' : 'Dark panel'}</h2>
  {#if overlay === 'dropdown'}
    <PanelsDropdown
      items={lightItems}
      label="Open light panel menu"
    />
  {:else}
    <button
      class="hp-button"
      onclick={() => modalOpen = true}
      type="button"
    >
      Open dark panel modal
    </button>
    <PanelsModal
      labelledBy="dark-panel-modal-title"
      onclose={() => modalOpen = false}
      open={modalOpen}
    >
      <h2 id="dark-panel-modal-title">Dark panel modal</h2>
      <p>This dialog belongs to the dark panel.</p>
    </PanelsModal>
  {/if}
</section>
