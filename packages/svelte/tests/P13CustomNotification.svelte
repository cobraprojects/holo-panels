<script lang="ts">
  import type { SvelteCustomNotificationProps } from '../src/notifications/contracts'

  let { notification }: SvelteCustomNotificationProps = $props()
</script>

<strong data-custom-notification={notification.id}>Custom {notification.presentation.title}</strong>
