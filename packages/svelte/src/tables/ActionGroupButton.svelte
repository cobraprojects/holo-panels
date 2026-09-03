<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { createTableActionHost, publishPanelError, type TableRecordId } from '@holo-js/panels-client'
  import { usePanelTranslator } from '../localization'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import type { SvelteTableAction, SvelteTableActionGroup, SvelteTableRendererProps } from './types'

  let { action, group, record, table }: {
    readonly action?: SvelteTableAction
    readonly group?: SvelteTableActionGroup
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  const translate = usePanelTranslator(() => table.locale)
  const host = $derived(createTableActionHost({
    actions: group?.actions ?? (action ? [action] : []),
    group: group ? { ...group, label: group.label ?? translate(group.scope === 'row' ? 'actions.row' : group.scope === 'bulk' ? 'actions.bulk' : 'actions.group') } : undefined,
    recordId: record ? table.getRecordId(record) : undefined,
    selection: () => table.store.selectionPayload(),
    clearSelection: () => table.store.clearSelection(),
    execute: async (request, signal) => {
      try {
        if (!table.actionTransport) throw new Error('Table actions require an action transport')
        await table.actionTransport.execute(request, signal)
      } catch (cause) {
        if (!signal.aborted) publishPanelError(table.panelId ?? 'default', translate('feedback.failedAction', { label: (group?.actions ?? (action ? [action] : [])).find(candidate => candidate.id === request.actionId)?.label ?? translate('actions.action') }))
        throw cause
      }
    },
  }))
  $effect(() => {
    const store = host.store
    return () => { while (store.activeFrame) store.close() }
  })
</script>

{#if host.actions[0]}<ActionRenderer {...host} action={host.actions[0]} locale={table.locale} panelId={table.panelId} registry={table.registry} />{/if}
