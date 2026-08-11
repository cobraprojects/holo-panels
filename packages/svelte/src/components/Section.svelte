<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; heading: string }
  let { children, heading }: Props = $props()
</script>

<section class="hp-section" data-panels-component="section" data-slot="card"><h2 data-slot="card-title">{heading}</h2><div data-slot="card-content">{@render children?.()}</div></section>
