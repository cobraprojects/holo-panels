import type { CompiledPanelDefinition } from '@holo-js/panels-svelte'
import type { SvelteKitPanelRegistry } from './contracts'

export const panelResolver = Symbol('holo-panels-sveltekit-panel-resolver')

export type InternalSvelteKitPanelRegistry<TActor = unknown, TTenant = unknown> = SvelteKitPanelRegistry<TActor, TTenant> & {
  readonly [panelResolver]?: (panelId: string) => Promise<CompiledPanelDefinition<TActor>>
}
