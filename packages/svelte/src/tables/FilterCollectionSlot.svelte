<script lang="ts">
  import type { Component } from 'svelte'
  import type { FilterCollectionPresentation } from '@holo-js/panels-client'
  import type { SvelteComponentRegistry } from '../registry'
  import type { SvelteFilterCollectionSlotProps } from './types'

  let {
    panelId,
    placement,
    presentation,
    registry,
  }: {
    readonly panelId?: string
    readonly placement: SvelteFilterCollectionSlotProps['placement']
    readonly presentation: FilterCollectionPresentation
    readonly registry?: SvelteComponentRegistry
  } = $props()

  const references = $derived(presentation.slots[placement] ?? [])

  function resolve(component: string): Component<SvelteFilterCollectionSlotProps> {
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for filter collection ${placement} slots.`)
    return registry.resolve<SvelteFilterCollectionSlotProps>(component, panelId, `filter collection ${placement} slot`)
  }
</script>

{#each references as reference (`${reference.source}:${reference.order}:${reference.component}`)}
  {@const Renderer = resolve(reference.component)}
  <Renderer {...reference.properties} {placement} {presentation} />
{/each}
