<script lang="ts">
  interface Item { disabled?: boolean; id: string; label: string }
  interface Props { items: readonly Item[]; label: string; onselect?: (id: string) => void }
  let { items, label, onselect }: Props = $props()
  let open = $state(false)
  let activeIndex = $state(0)

  function move(direction: 1 | -1): void {
    const enabled = items.flatMap((item, index) => item.disabled ? [] : [index])
    if (enabled.length === 0) return
    const current = enabled.indexOf(activeIndex)
    activeIndex = enabled[(Math.max(current, 0) + direction + enabled.length) % enabled.length] ?? 0
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      open = true
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Escape') {
      open = false
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      const item = items[activeIndex]
      if (item && !item.disabled) {
        event.preventDefault()
        onselect?.(item.id)
        open = false
      }
    }
  }
</script>

<div class="hp-dropdown" data-panels-component="dropdown">
  <button aria-expanded={open} aria-haspopup="menu" onkeydown={onkeydown} onclick={() => open = !open} type="button">{label}</button>
  {#if open}
    <div role="menu">
      {#each items as item, index (item.id)}
        <button aria-disabled={item.disabled || undefined} onclick={() => { if (!item.disabled) onselect?.(item.id); open = false }} onkeydown={onkeydown} role="menuitem" tabindex={index === activeIndex ? 0 : -1} type="button">{item.label}</button>
      {/each}
    </div>
  {/if}
</div>
