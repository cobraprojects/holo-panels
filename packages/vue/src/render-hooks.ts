import { Fragment, h, inject, provide, type InjectionKey, type VNode } from 'vue'
import type { JsonObject, PanelManifest, RenderHook } from '@holo-js/panels-core'
import type { ComponentRegistry } from './registry'

export interface VuePanelsRenderHookOptions {
  readonly data?: JsonObject
  readonly hook: RenderHook
  readonly manifest: Pick<PanelManifest, 'id' | 'slots'>
  readonly registry: ComponentRegistry
  readonly scopes?: readonly string[]
}

export type VuePanelsRenderHookContextOptions = Omit<VuePanelsRenderHookOptions, 'hook'>

const PanelsRenderHookContext: InjectionKey<VuePanelsRenderHookContextOptions> = Symbol('holo-panels-render-hooks')

export function providePanelsRenderHooks(options: VuePanelsRenderHookContextOptions): void {
  provide(PanelsRenderHookContext, options)
}

export function usePanelsRenderHook(): (hook: RenderHook, data?: JsonObject) => VNode {
  const context = inject(PanelsRenderHookContext, null)
  return (hook, data) => context
    ? renderPanelsHook({ ...context, ...(data ? { data } : {}), hook })
    : h(Fragment, [])
}

export function renderPanelsHook({ data = {}, hook, manifest, registry, scopes = [] }: VuePanelsRenderHookOptions): VNode {
  return h(Fragment, (manifest.slots[hook] ?? []).map((reference, index) => h(
    registry.resolve(reference.component, manifest.id, `render hook "${hook}"`),
    { ...reference.properties, data, key: `${reference.source}:${reference.component}:${reference.order}:${index}`, scopes },
  )))
}
