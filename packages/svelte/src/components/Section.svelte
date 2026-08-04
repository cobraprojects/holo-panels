<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; heading: string }
  let { children, heading }: Props = $props()
</script>

<section class="hp-section" data-panels-component="section"><h2>{heading}</h2>{@render children?.()}</section>
