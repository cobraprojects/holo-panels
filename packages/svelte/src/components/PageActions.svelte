<script lang="ts">
  import { Portal } from 'bits-ui'
  import type { Snippet } from 'svelte'

  let { children, to }: { readonly children?: Snippet, readonly to?: HTMLElement } = $props()
</script>

{#if to}
  <Portal {to}>
    <div class="hp-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2" data-slot="page-actions">{@render children?.()}</div>
  </Portal>
{:else if to === undefined}
  <div class="hp-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2" data-slot="page-actions">{@render children?.()}</div>
{/if}
