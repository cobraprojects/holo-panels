<script lang="ts">
  import NotificationInbox from '../src/notifications/NotificationInbox.svelte'
  import ToastViewport from '../src/notifications/ToastViewport.svelte'
  import type { SvelteNotificationInboxProps, SvelteToastViewportProps } from '../src/notifications/contracts'

  let { inbox, toasts }: { readonly inbox?: SvelteNotificationInboxProps, readonly toasts?: SvelteToastViewportProps } = $props()
</script>

{#if toasts}<ToastViewport {...toasts} />{/if}
{#if inbox}<NotificationInbox {...inbox} />{/if}
