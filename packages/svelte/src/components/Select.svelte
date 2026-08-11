<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLSelectAttributes } from 'svelte/elements'
  interface Props extends HTMLSelectAttributes { children?: Snippet }
  let { children, class: className = '', value = $bindable(), ...attributes }: Props = $props()
  let element = $state<HTMLSelectElement>()

  function applyValue(): void {
    if (!element) return
    if (Array.isArray(value)) {
      const selected = new Set(value.map(String))
      for (const option of Array.from(element.options)) option.selected = selected.has(option.value)
      return
    }
    element.value = typeof value === 'undefined' ? '' : String(value)
  }

  function syncOptions(node: HTMLSelectElement): { destroy(): void } {
    const observer = new MutationObserver(applyValue)
    observer.observe(node, { childList: true, subtree: true })
    queueMicrotask(applyValue)
    return { destroy: () => observer.disconnect() }
  }

  $effect(() => {
    value
    element
    queueMicrotask(applyValue)
  })
</script>

<select {...attributes} bind:this={element} bind:value use:syncOptions class={className} data-slot="native-select">{@render children?.()}</select>
