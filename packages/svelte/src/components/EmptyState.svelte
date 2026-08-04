<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; description?: string; heading: string }
  let { children, description, heading }: Props = $props()
</script>

<section class="hp-empty-state" data-panels-component="empty-state"><h2>{heading}</h2>{#if description}<p>{description}</p>{/if}{@render children?.()}</section>
