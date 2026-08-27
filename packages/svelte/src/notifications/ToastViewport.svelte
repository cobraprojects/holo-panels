<script lang="ts">
  import { onDestroy } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { Toaster } from '../ui/sonner'
  import { toSvelteState } from '../stores'
  import type { SvelteToastViewportProps } from './contracts'
  import ToastContent from './ToastContent.svelte'

  let { navigate, panelId, placement = 'top', registry, store }: SvelteToastViewportProps = $props()
  const toastState = $derived.by(() => toSvelteState(store))

  let rendered = new Map<string, string>()

  onDestroy(() => {
    for (const id of rendered.keys()) toast.dismiss(id)
    rendered.clear()
  })

  $effect(() => {
    const activeIds = new Set($toastState.items.map(item => item.id))
    for (const id of rendered.keys()) {
      if (activeIds.has(id)) continue
      toast.dismiss(id)
      rendered.delete(id)
    }
    for (const item of $toastState.items) {
      const fingerprint = JSON.stringify(item)
      if (rendered.get(item.id) === fingerprint) continue
      toast.custom(ToastContent, {
        componentProps: { navigate, panelId, registry, store, toast: item },
        duration: Infinity,
        id: item.id,
        onAutoClose: () => store.dismiss(item.id),
        onDismiss: () => store.dismiss(item.id),
      })
      rendered.set(item.id, fingerprint)
    }
  })
</script>

<div aria-atomic="true" aria-live="polite" class="hp:sr-only" role="status">{$toastState.liveMessage}</div>
<Toaster closeButton={false} position={placement === 'top' ? 'top-center' : 'bottom-center'} />
