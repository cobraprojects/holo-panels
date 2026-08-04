<script lang="ts">
  import type { Component } from 'svelte'
  import type { SvelteEntrySlotRendererProps, SvelteEntrySnapshot } from './contracts'
  import type { SvelteComponentRegistry } from '../registry'

  let {
    entry,
    panelId,
    placement,
    registry,
  }: {
    readonly entry: SvelteEntrySnapshot
    readonly panelId?: string
    readonly placement: SvelteEntrySlotRendererProps['placement']
    readonly registry?: SvelteComponentRegistry
  } = $props()

  const references = $derived(entry.slots?.[placement] ?? [])

  function resolve(component: string): Component<SvelteEntrySlotRendererProps> {
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for entry ${placement} slots on "${entry.id}".`)
    return registry.resolve<SvelteEntrySlotRendererProps>(component, panelId, `entry ${placement} slot on "${entry.id}"`)
  }
</script>

{#each references as reference (`${reference.source}:${reference.order}:${reference.component}`)}
  {@const Renderer = resolve(reference.component)}
  <Renderer {...reference.properties} {entry} {placement} {reference} />
{/each}
