<script lang="ts">
  import type { SvelteCustomNotificationProps } from '../../../packages/svelte/src/notifications/contracts'

  let { notification }: SvelteCustomNotificationProps = $props()
</script>

<article data-custom-notification={notification.type}>Custom release: {notification.presentation.title}</article>
