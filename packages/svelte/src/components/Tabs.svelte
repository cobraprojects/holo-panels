<script lang="ts">
  interface Tab { disabled?: boolean; id: string; label: string }
  interface Props { label: string; onselect?: (id: string) => void; tabs: readonly Tab[]; value: string }
  let { label, onselect, tabs, value = $bindable() }: Props = $props()

  function select(next: string): void {
    value = next
    onselect?.(next)
  }

  function onkeydown(event: KeyboardEvent, index: number): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const enabled = tabs.flatMap((tab, tabIndex) => tab.disabled ? [] : [tabIndex])
    const current = enabled.indexOf(index)
    const nextPosition = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? enabled.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
    const nextIndex = enabled[nextPosition]
    if (nextIndex === undefined) return
    event.preventDefault()
    select(tabs[nextIndex]?.id ?? value)
    const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }
</script>

<div aria-label={label} class="hp-tabs" data-panels-component="tabs" role="tablist">
  {#each tabs as tab, index (tab.id)}
    <button aria-selected={value === tab.id} disabled={tab.disabled} onclick={() => select(tab.id)} onkeydown={event => onkeydown(event, index)} role="tab" tabindex={value === tab.id ? 0 : -1} type="button">{tab.label}</button>
  {/each}
</div>
