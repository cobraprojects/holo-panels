<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLTableAttributes } from 'svelte/elements'
  interface Props extends HTMLTableAttributes { children?: Snippet }
  let { children, class: className = '', ...attributes }: Props = $props()
</script>

<table {...attributes} class={className} data-slot="table">{@render children?.()}</table>
