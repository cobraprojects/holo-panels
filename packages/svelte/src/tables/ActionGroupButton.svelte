<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { createTableActionHost, publishPanelError, type TableRecordId } from '@holo-js/panels-client'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import type { SvelteTableAction, SvelteTableActionGroup, SvelteTableRendererProps } from './types'

  let { action, group, record, table }: {
    readonly action?: SvelteTableAction
    readonly group?: SvelteTableActionGroup
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  const host = $derived(createTableActionHost({
    actions: group?.actions ?? (action ? [action] : []),
    group: group ? { ...group, label: group.label ?? (group.scope === 'row' ? 'Row actions' : group.scope === 'bulk' ? 'Bulk actions' : 'Actions') } : undefined,
    recordId: record ? table.getRecordId(record) : undefined,
    selection: () => table.store.selectionPayload(),
    execute: async (request, signal) => {
      try {
        if (!table.actionTransport) throw new Error('Table actions require an action transport')
        await table.actionTransport.execute(request, signal)
      } catch (cause) {
        if (!signal.aborted) publishPanelError(table.panelId ?? 'default', `${(group?.actions ?? (action ? [action] : [])).find(candidate => candidate.id === request.actionId)?.label ?? 'Action'} failed`)
        throw cause
      }
    },
  }))
  $effect(() => {
    const store = host.store
    return () => { while (store.activeFrame) store.close() }
  })
</script>

{#if host.actions[0]}<ActionRenderer {...host} action={host.actions[0]} panelId={table.panelId} registry={table.registry} />{/if}
