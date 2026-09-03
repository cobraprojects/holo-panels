<script lang="ts">
  import { usePanelLocale } from '../localization'
  import { createRelationActionHost, type ClientRelationManager, type ClientRelationRecord } from '@holo-js/panels-client'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import type { SvelteRelationManagerRendererProps } from './contracts'

  let { manager, record, selectedIds, relations }: {
    readonly manager: ClientRelationManager
    readonly record?: ClientRelationRecord
    readonly selectedIds?: readonly (number | string)[]
    readonly relations: SvelteRelationManagerRendererProps
  } = $props()
  const locale = usePanelLocale()
  const host = $derived(createRelationActionHost({
    execute: async (request, signal) => relations.onOperation?.(request, signal),
    locale: locale(), loadOptions: relations.loadOptions, manager, panelId: relations.panelId, record, selectedIds,
  }))
  $effect(() => {
    const current = host
    return () => { while (current.store.activeFrame) current.store.close() }
  })
</script>

{#if host.actions[0]}<ActionRenderer action={host.actions[0]} actions={host.actions} panelId={relations.panelId} recordIds={record ? [record.id] : selectedIds} registry={relations.registry} store={host.store} />{/if}
