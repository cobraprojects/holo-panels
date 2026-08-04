<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; disabled?: boolean; type?: 'button' | 'reset' | 'submit' }
  let { children, disabled = false, type = 'button' }: Props = $props()
</script>

<button {disabled} {type} class="hp-button" data-panels-component="button">{@render children?.()}</button>
