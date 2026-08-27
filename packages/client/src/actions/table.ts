import { builtInActionPresentation, type ActionExecutionResult, type ActionGroupManifest, type ActionManifest, type JsonObject } from '@holo-js/panels-core'
import type { TableRecordId, TableSelectionPayload } from '../tables/contracts'
import { ClientActionStore } from './store'
import { actionManifestCollection, isActionManifest } from './manifest'

export interface TableActionDefinition {
  readonly deselectAfterCompletion?: boolean
  readonly emptyStateOnly?: boolean
  readonly color?: string | null
  readonly confirmation?: string
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly resolveManifest?: (recordId?: TableRecordId) => Readonly<ActionManifest> | null
  readonly scope: 'bulk' | 'header' | 'row'
}

export interface TableActionExecutionRequest<TRecordId extends TableRecordId> {
  readonly actionId: string
  readonly idempotencyKey?: string
  readonly input?: JsonObject
  readonly mount?: ActionManifest['mount']
  readonly recordId?: TRecordId
  readonly selection?: TableSelectionPayload<TRecordId>
}

interface TableActionHostOptions<TRecordId extends TableRecordId> {
  readonly clearSelection?: () => void
  readonly actions: readonly TableActionDefinition[]
  readonly execute: (request: TableActionExecutionRequest<TRecordId>, signal: AbortSignal) => Promise<ActionExecutionResult<number | string, unknown> | void>
  readonly group?: { readonly color?: string | null, readonly icon?: string | null, readonly id: string, readonly label?: string | null }
  readonly recordId?: TRecordId
  readonly selection?: () => TableSelectionPayload<TRecordId>
}

export function resolveTableActionManifest(data: JsonObject, id: string, recordId?: TableRecordId): Readonly<ActionManifest> | null {
  const row = recordId === undefined || !Array.isArray(data.rowActions) ? undefined : data.rowActions.find(value => value && typeof value === 'object' && !Array.isArray(value) && String(value.recordId) === String(recordId))
  if (recordId !== undefined && row === undefined) return null
  const entries = row && typeof row === 'object' && !Array.isArray(row) ? row.actions : data.tableActions
  const find = (values: typeof entries): Readonly<ActionManifest> | null => {
    if (!Array.isArray(values)) return null
    for (const value of values) {
      if (isActionManifest(value, id)) return value
      if (value && typeof value === 'object' && !Array.isArray(value) && value.modal && typeof value.modal === 'object' && !Array.isArray(value.modal)) {
        const nested = find(value.modal.actions)
        if (nested) return nested
      }
      if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'action-group') {
        const nested = find(value.actions)
        if (nested) return nested
      }
    }
    return null
  }
  return find(entries)
}

function actionManifest(action: TableActionDefinition, recordId?: TableRecordId): Readonly<ActionManifest> | null {
  if (action.resolveManifest) return action.resolveManifest(recordId)
  const defaults = builtInActionPresentation(action.id)
  return { deselectAfterCompletion: action.deselectAfterCompletion, badge: null, color: action.color ?? defaults?.color ?? null, confirmation: action.confirmation ?? null, disabled: false, icon: action.icon ?? defaults?.icon ?? null, id: action.id, kind: 'custom', label: action.label, modal: null, mount: action.scope === 'row' ? 'record' : action.scope === 'bulk' ? 'bulk' : 'page', size: 'medium', tooltip: null, type: 'custom', visible: true }
}

export function createTableActionHost<TRecordId extends TableRecordId>(options: TableActionHostOptions<TRecordId>): { readonly actions: readonly Readonly<ActionManifest>[], readonly groups: readonly ActionGroupManifest[], readonly store: ClientActionStore } {
  const actions = options.actions.flatMap(action => { const manifest = actionManifest(action, options.recordId); return manifest ? [manifest] : [] })
  const groups = options.group ? [{ actions: actions.map(action => action.id), color: options.group.color ?? null, icon: options.group.icon ?? null, id: options.group.id, label: options.group.label ?? 'Actions' }] : []
  const store = new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: { execute: async (request, signal) => {
      const action = actionManifestCollection(actions).find(candidate => candidate.id === request.actionId)
      if (!action || action.disabled || !action.visible) throw new Error('The table action is not available')
      const result = await options.execute({ actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, mount: request.mount, ...(options.recordId === undefined ? {} : { recordId: options.recordId }), ...(action.mount === 'bulk' && options.selection ? { selection: options.selection() } : {}) }, signal)
      if (result && result.status !== 'succeeded') throw new Error('The action could not be completed for every record')
      if (action.mount === 'bulk' && action.deselectAfterCompletion) options.clearSelection?.()
      return result ?? { effects: [], items: [], status: 'succeeded' }
    } },
  })
  return { actions, groups, store }
}
