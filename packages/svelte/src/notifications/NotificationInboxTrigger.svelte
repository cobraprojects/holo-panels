<script lang="ts">
  import { untrack } from 'svelte'
  import Button from '../components/Button.svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteNotificationInboxTriggerProps } from './contracts'
  import NotificationInbox from './NotificationInbox.svelte'

  let { emptyMessage, label = 'Notifications', lazy = false, navigate, panelId, placement, registry, store }: SvelteNotificationInboxTriggerProps = $props()
  const componentId = $props.id()
  const inboxId = `hp-notification-inbox-${componentId}`
  const inboxState = $derived.by(() => toSvelteState(store))
  const inboxPlacement = $derived(placement === 'topbar' ? 'dropdown' : 'sidebar')
  const resolvedLabel = $derived(label.trim() || 'Notifications')
  let open = $state(false)
  let activated = $state(untrack(() => !lazy))
  let container: HTMLDivElement
  let trigger = $state<HTMLButtonElement>()

  function closeAndRestoreFocus(): void {
    open = false
    trigger?.focus()
  }

  function onDocumentClick(event: MouseEvent): void {
    if (!open || !(event.target instanceof Node) || container.contains(event.target)) return
    closeAndRestoreFocus()
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    closeAndRestoreFocus()
  }

</script>

<svelte:window onclick={onDocumentClick} onkeydown={onDocumentKeyDown} />

<div bind:this={container} class="hp-notification-inbox-trigger" data-placement={placement}>
  <Button
    aria-controls={inboxId}
    aria-expanded={open}
    bind:ref={trigger}
    class="hp-notification-inbox-trigger-button"
    onclick={() => { activated = true; open = !open }}
    type="button"
  >
    <span>{resolvedLabel}</span>
    <span aria-label={`${$inboxState.unread} unread notifications`} class="hp-notification-inbox-trigger-badge">{$inboxState.unread}</span>
  </Button>
  <div class="hp-notification-inbox-trigger-content" hidden={!open} id={inboxId}>
    {#if activated}<NotificationInbox {emptyMessage} {navigate} {panelId} placement={inboxPlacement} {registry} {store} />{/if}
  </div>
</div>
