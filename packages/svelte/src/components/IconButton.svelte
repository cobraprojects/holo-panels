<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; disabled?: boolean; label: string }
  let { children, disabled = false, label }: Props = $props()
</script>

<button aria-label={label} class="hp-icon-button" data-panels-component="icon-button" {disabled} type="button">{@render children?.()}</button>
