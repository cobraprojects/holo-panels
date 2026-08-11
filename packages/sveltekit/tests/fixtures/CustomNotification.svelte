<script lang="ts">
  import type { SvelteNotificationInboxTriggerProps } from '@holo-js/panels-svelte'
  let { placement }: SvelteNotificationInboxTriggerProps = $props()
</script>

<span data-custom-notification={placement}>Custom notifications</span>
