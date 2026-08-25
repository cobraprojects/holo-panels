import { createContext, Fragment, useContext, type ReactNode } from 'react'
import type { JsonObject, PanelManifest, RenderHook } from '@holo-js/panels-core'
import type { ComponentRegistry } from './registry'

export interface ReactRenderHookComponentProps {
  readonly data: JsonObject
  readonly scopes: readonly string[]
}

export interface ReactPanelsRenderHookProps {
  readonly data?: JsonObject
  readonly hook: RenderHook
  readonly manifest?: Pick<PanelManifest, 'id' | 'slots'>
  readonly registry?: ComponentRegistry
  readonly scopes?: readonly string[]
}

interface ReactPanelsRenderHookContext {
  readonly data: JsonObject
  readonly manifest: Pick<PanelManifest, 'id' | 'slots'>
  readonly registry: ComponentRegistry
  readonly scopes: readonly string[]
}

const RenderHookContext = createContext<ReactPanelsRenderHookContext | null>(null)

export interface ReactPanelsRenderHookProviderProps extends ReactPanelsRenderHookContext {
  readonly children?: ReactNode
}

export function ReactPanelsRenderHookProvider({ children, data, manifest, registry, scopes }: ReactPanelsRenderHookProviderProps): ReactNode {
  return <RenderHookContext.Provider value={{ data, manifest, registry, scopes }}>{children}</RenderHookContext.Provider>
}

export function ReactPanelsRenderHook({ data, hook, manifest, registry, scopes }: ReactPanelsRenderHookProps): ReactNode {
  const context = useContext(RenderHookContext)
  const resolvedManifest = manifest ?? context?.manifest
  const resolvedRegistry = registry ?? context?.registry
  if (!resolvedManifest || !resolvedRegistry) return null
  const resolvedData = data ?? context?.data ?? {}
  const resolvedScopes = scopes ?? context?.scopes ?? []
  return <>{(resolvedManifest.slots[hook] ?? []).map((reference, index) => {
    const Component = resolvedRegistry.resolve<ReactRenderHookComponentProps>(reference.component, resolvedManifest.id, `render hook "${hook}"`)
    return <Fragment key={`${reference.source}:${reference.component}:${reference.order}:${index}`}><Component {...reference.properties} data={resolvedData} scopes={resolvedScopes} /></Fragment>
  })}</>
}
