<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  interface Props extends HTMLButtonAttributes { children?: Snippet; ref?: HTMLButtonElement }
  let { children, class: className = '', ref = $bindable(), type = 'button', 'data-slot': slot = 'button', 'data-variant': variant = 'outline', ...attributes }: Props = $props()
</script>

<button bind:this={ref} {...attributes} {type} class={`hp-button ${className}`.trim()} data-panels-component="button" data-slot={slot} data-variant={variant}>{@render children?.()}</button>
