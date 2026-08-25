<script lang="ts">
  import { toast } from 'svelte-sonner'
  import { Toaster } from '../ui/sonner'
  import { toSvelteState } from '../stores'
  import type { SvelteToastViewportProps } from './contracts'
  import ToastContent from './ToastContent.svelte'

  let { navigate, placement = 'top', store }: SvelteToastViewportProps = $props()
  const toastState = $derived.by(() => toSvelteState(store))

  let rendered = new Map<string, string>()

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
        componentProps: { navigate, store, toast: item },
        duration: item.persistent ? Infinity : (item.duration ?? 5000),
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
