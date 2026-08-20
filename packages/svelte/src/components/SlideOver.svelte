<script lang="ts">
  import { Dialog } from 'bits-ui'
  import X from 'lucide-svelte/icons/x'
  import { panelsPortalTarget } from '../portal'
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; labelledBy: string; onclose: () => void; open: boolean }
  let { children, labelledBy, onclose, open }: Props = $props()
  const portalTarget = panelsPortalTarget()
</script>

{#snippet surface()}
  <Dialog.Overlay class="hp-dialog-overlay" data-holo-panel="" data-slot="dialog-overlay" />
  <Dialog.Content aria-labelledby={labelledBy} aria-modal="true" class="hp-slide-over" data-holo-panel="" data-panels-component="slide-over" data-slot="sheet-content" role="dialog">
    <Dialog.Title class="hp-visually-hidden" data-slot="dialog-title">{labelledBy.replaceAll('-', ' ')}</Dialog.Title>
    {@render children?.()}
    <Dialog.Close aria-label="Close" class="hp-dialog-close" data-slot="dialog-close"><X aria-hidden="true" /></Dialog.Close>
  </Dialog.Content>
{/snippet}

<Dialog.Root {open} onOpenChange={value => { if (!value) onclose() }}>
  {#if portalTarget()}
    <Dialog.Portal to={portalTarget()}>{@render surface()}</Dialog.Portal>
  {:else}
    {@render surface()}
  {/if}
</Dialog.Root>
