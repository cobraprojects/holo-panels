<script lang="ts">
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; tone?: 'danger' | 'info' | 'neutral' | 'success' | 'warning' }
  let { children, tone = 'neutral' }: Props = $props()
</script>

<span class="hp-badge hp-tone-{tone}" data-panels-component="badge" data-slot="badge" data-variant={tone === 'danger' ? 'destructive' : tone === 'neutral' ? 'secondary' : tone}>{@render children?.()}</span>
