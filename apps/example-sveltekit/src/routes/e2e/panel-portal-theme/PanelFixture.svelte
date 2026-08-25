<script lang="ts">
  import { onMount } from 'svelte'
  import { setPanelsPortalTarget } from '@holo-js/panels-svelte'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import * as Dialog from '@holo-js/panels-svelte/ui/dialog'
  import * as DropdownMenu from '@holo-js/panels-svelte/ui/dropdown-menu'

  type Overlay = 'dropdown' | 'modal'
  type Theme = 'dark' | 'light'

  interface Props {
    overlay: Overlay
    theme: Theme
  }

  let { overlay, theme }: Props = $props()
  let modalOpen = $state(false)
  let portalElement = $state<HTMLElement>()

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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} aria-label="Open light panel menu" variant="outline">Open light panel menu</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Light panel action</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else}
    <Button
      onclick={() => modalOpen = true}
      type="button"
    >
      Open dark panel modal
    </Button>
    <Dialog.Root bind:open={modalOpen}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Dark panel modal</Dialog.Title>
          <Dialog.Description>This dialog belongs to the dark panel.</Dialog.Description>
        </Dialog.Header>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
</section>
