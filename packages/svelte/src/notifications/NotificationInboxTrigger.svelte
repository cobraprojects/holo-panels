<script lang="ts">
  import { toSvelteState } from '../stores'
  import type { SvelteNotificationInboxTriggerProps } from './contracts'
  import NotificationInbox from './NotificationInbox.svelte'

  let { emptyMessage, label = 'Notifications', navigate, panelId, placement, registry, store }: SvelteNotificationInboxTriggerProps = $props()
  const componentId = $props.id()
  const inboxId = `hp-notification-inbox-${componentId}`
  const inboxState = $derived.by(() => toSvelteState(store))
  const inboxPlacement = $derived(placement === 'topbar' ? 'dropdown' : 'sidebar')
  const resolvedLabel = $derived(label.trim() || 'Notifications')
  let open = $state(false)
  let container: HTMLDivElement
  let trigger: HTMLButtonElement

  function closeAndRestoreFocus(): void {
    open = false
    trigger.focus()
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
  <button
    aria-controls={inboxId}
    aria-expanded={open}
    bind:this={trigger}
    class="hp-notification-inbox-trigger-button"
    onclick={() => { open = !open }}
    type="button"
  >
    <span>{resolvedLabel}</span>
    <span aria-label={`${$inboxState.unread} unread notifications`} class="hp-notification-inbox-trigger-badge">{$inboxState.unread}</span>
  </button>
  <div class="hp-notification-inbox-trigger-content" hidden={!open} id={inboxId}>
    <NotificationInbox {emptyMessage} {navigate} {panelId} placement={inboxPlacement} {registry} {store} />
  </div>
</div>
