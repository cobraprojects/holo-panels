<script lang="ts">
  import { Dialog } from 'bits-ui'
  import X from 'lucide-svelte/icons/x'
  import type { Snippet } from 'svelte'
  interface Props { children?: Snippet; labelledBy: string; onclose: () => void; open: boolean }
  let { children, labelledBy, onclose, open }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={value => { if (!value) onclose() }}>
  <Dialog.Content aria-labelledby={labelledBy} aria-modal="true" class="hp-slide-over" data-holo-panel="" data-panels-component="slide-over" data-slot="sheet-content" role="dialog">
    <Dialog.Title class="hp-visually-hidden" data-slot="dialog-title">{labelledBy.replaceAll('-', ' ')}</Dialog.Title>
    {@render children?.()}
    <Dialog.Close aria-label="Close" class="hp-dialog-close" data-slot="dialog-close"><X aria-hidden="true" /></Dialog.Close>
  </Dialog.Content>
</Dialog.Root>
