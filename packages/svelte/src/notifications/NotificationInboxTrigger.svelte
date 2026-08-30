<script lang="ts">
  import { untrack } from 'svelte'
  import Bell from 'lucide-svelte/icons/bell'
  import { Badge } from '../ui/badge'
  import { Button } from '../ui/button'
  import * as Popover from '../ui/popover'
  import { toSvelteState } from '../stores'
  import type { SvelteNotificationInboxTriggerProps } from './contracts'
  import NotificationInbox from './NotificationInbox.svelte'

  let { emptyMessage, label = 'Notifications', lazy = false, locale = 'en', navigate, panelId, placement, registry, store }: SvelteNotificationInboxTriggerProps = $props()
  const inboxState = $derived.by(() => toSvelteState(store))
  const inboxPlacement = $derived(placement === 'topbar' ? 'dropdown' : 'sidebar')
  const resolvedLabel = $derived(label.trim() || 'Notifications')
  const accessibleLabel = $derived($inboxState.unread > 0 ? `${resolvedLabel}, ${$inboxState.unread} unread` : resolvedLabel)
  let open = $state(false)
  let activated = $state(untrack(() => !lazy))
  let trigger = $state<HTMLButtonElement | null>(null)
</script>

<Popover.Root bind:open onOpenChange={(value) => { if (value) activated = true }}>
  <Popover.Trigger>
    {#snippet child({ props })}<Button {...props} aria-label={accessibleLabel} bind:ref={trigger} class="hp-notification-inbox-trigger-button hp:relative" size="icon" title={resolvedLabel} type="button" variant="ghost"><Bell />{#if $inboxState.unread > 0}<Badge aria-hidden="true" class="hp-notification-inbox-trigger-badge hp:absolute hp:-right-1 hp:-top-1 hp:min-w-5 hp:px-1" variant="destructive">{$inboxState.unread}</Badge>{/if}</Button>{/snippet}
  </Popover.Trigger>
  <Popover.Content align={placement === 'topbar' ? 'end' : 'start'} class="hp-notification-inbox-trigger-content hp:w-[min(28rem,calc(100vw-2rem))] hp:p-0 hp:data-[state=closed]:hidden" data-holo-panel forceMount={activated} onCloseAutoFocus={(event) => { event.preventDefault(); trigger?.focus() }}>
    {#if activated}<NotificationInbox {emptyMessage} {locale} {navigate} {panelId} placement={inboxPlacement} {registry} {store} />{/if}
  </Popover.Content>
</Popover.Root>
