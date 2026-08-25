import { publishPanelError, type TableRecordId } from '@holo-js/panels-client'
import type { SvelteTableAction, SvelteTableRendererProps } from './types'

export async function executeTableAction<TRecord extends object, TRecordId extends TableRecordId>(
  action: SvelteTableAction,
  record: Readonly<TRecord> | undefined,
  table: SvelteTableRendererProps<TRecord, TRecordId>,
): Promise<void> {
  if (!table.actionTransport) {
    publishPanelError(table.panelId ?? 'default', 'Action failed')
    return
  }
  try {
    await table.actionTransport.execute({
      actionId: action.id,
      ...(record ? { recordId: table.getRecordId(record) } : {}),
      ...(action.scope === 'bulk' ? { selection: table.store.selectionPayload() } : {}),
    }, new AbortController().signal)
  } catch {
    publishPanelError(table.panelId ?? 'default', `${action.label} failed`)
  }
}
