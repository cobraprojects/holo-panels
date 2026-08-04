<script lang="ts">
  import { tick, type Snippet } from 'svelte'
  interface Props { children?: Snippet; labelledBy: string; onclose: () => void; open: boolean }
  let { children, labelledBy, onclose, open }: Props = $props()
  let surface = $state<HTMLDivElement>()

  $effect(() => {
    if (!open) return
    tick().then(() => surface?.querySelector<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus())
  })

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose()
    if (event.key !== 'Tab') return
    if (!surface) return
    const focusable = Array.from(surface.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
</script>

{#if open}
  <div aria-labelledby={labelledBy} aria-modal="true" bind:this={surface} class="hp-slide-over" data-panels-component="slide-over" onkeydown={onkeydown} role="dialog" tabindex="-1">{@render children?.()}</div>
{/if}
