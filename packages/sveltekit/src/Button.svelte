<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  interface Props extends HTMLButtonAttributes { children?: Snippet }
  let { children, class: className = '', type = 'button', ...attributes }: Props = $props()
</script>

<button {...attributes} {type} class={className} data-slot="button">{@render children?.()}</button>
