import type { CompiledPanelDefinition } from '../panels/contracts'

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
