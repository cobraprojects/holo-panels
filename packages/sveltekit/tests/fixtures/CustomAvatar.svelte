<script lang="ts">
  import type { PanelAvatarComponentProps } from '@holo-js/panels-svelte'
  let { actor, label }: PanelAvatarComponentProps = $props()
</script>

<span data-custom-avatar={actor.id}>{label}</span>
