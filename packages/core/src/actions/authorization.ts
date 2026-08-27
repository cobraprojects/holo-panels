import type { CompiledPanelDefinition } from '../panels/contracts'
import type { ActionKind, ActionMount } from './contracts'

export function actionExecutionPermissions(action: { readonly id: string, readonly ancestorActionIds?: readonly string[] }): readonly string[] {
  return [...(action.ancestorActionIds ?? []), action.id].map(id => `actions.${id}.view`)
}

export function resourceActionPermissions(resourceId: string, action: { readonly kind: ActionKind, readonly mount: ActionMount }): readonly string[] {
  const operations: Partial<Record<ActionKind, string>> = { create: 'create', edit: 'update', delete: 'delete', restore: 'restore', 'force-delete': 'forceDelete', replicate: 'replicate' }
  const operation = operations[action.kind]
  return operation ? [`${resourceId}.${operation}${action.mount === 'bulk' && ['delete', 'restore', 'forceDelete'].includes(operation) ? 'Any' : ''}`] : []
}

export async function authorizePanelActionPermissions(
  panel: CompiledPanelDefinition<object>,
  context: { readonly actor: object, readonly panelId: string, readonly signal: AbortSignal, readonly tenant: unknown },
  permissions: readonly string[],
): Promise<void> {
  if (panel.manifest.id !== context.panelId) throw new Error('Action permissions must match their panel')
  for (const plugin of panel.server.plugins) {
    for (const permission of permissions) {
      await plugin.authorizationLayer?.authorize({ ...context, guard: panel.guard, permission })
    }
  }
}
