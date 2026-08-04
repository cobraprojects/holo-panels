<script lang="ts">
  import NotificationInbox from '../../../packages/svelte/src/notifications/NotificationInbox.svelte'
  import ToastViewport from '../../../packages/svelte/src/notifications/ToastViewport.svelte'
  import { SvelteComponentRegistry } from '../../../packages/svelte/src/registry'
  import type { NotificationAcceptanceModel } from '../../../packages/testing/src/notification-acceptance'
  import P13CustomNotification from './P13CustomNotification.svelte'

  let { model }: { readonly model: NotificationAcceptanceModel } = $props()
  const registry = new SvelteComponentRegistry()
  registry.register({ component: P13CustomNotification, source: 'example-sveltekit', typeId: 'notification.app.notifications.release' })
</script>

<ToastViewport placement={model.toastPlacement} store={model.toastStore} />
<aside>
  <NotificationInbox panelId={model.panelId} placement={model.inboxPlacement} {registry} store={model.inboxStore} />
</aside>
