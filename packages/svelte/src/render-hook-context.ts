import { getContext, setContext } from 'svelte'
import type { JsonObject, PanelManifest } from '@holo-js/panels-core'
import type { SvelteComponentRegistry } from './registry'

export interface SveltePanelsRenderHookContext {
  readonly data: JsonObject
  readonly manifest: Pick<PanelManifest, 'id' | 'slots'>
  readonly registry?: SvelteComponentRegistry
  readonly scopes: readonly string[]
}

const contextKey = Symbol('holo-panels-render-hooks')

export function providePanelsRenderHooks(context: SveltePanelsRenderHookContext): void {
  setContext(contextKey, context)
}

export function usePanelsRenderHooks(): SveltePanelsRenderHookContext | undefined {
  return getContext<SveltePanelsRenderHookContext | undefined>(contextKey)
}
