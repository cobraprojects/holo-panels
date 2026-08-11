<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; description?: string; heading: string }
  let { children, description, heading }: Props = $props()
</script>

<section class="hp-empty-state" data-panels-component="empty-state" data-slot="empty"><h2 data-slot="empty-title">{heading}</h2>{#if description}<p data-slot="empty-description">{description}</p>{/if}{@render children?.()}</section>
