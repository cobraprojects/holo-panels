import type { Component } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'
import RawDashboardRenderer from './DashboardRenderer.svelte'
import RawWidgetRenderer from './WidgetRenderer.svelte'
import type {
  SvelteCustomWidgetProps,
  SvelteDashboardRendererProps,
  SvelteWidgetRendererProps,
} from './contracts'

export const DashboardRenderer: Component<SvelteDashboardRendererProps> = RawDashboardRenderer
export const WidgetRenderer: Component<SvelteWidgetRendererProps> = RawWidgetRenderer

export function registerSvelteWidgetRenderer(
  registry: SvelteComponentRegistry,
  type: string,
  component: Component<SvelteCustomWidgetProps>,
): SvelteComponentRegistry {
  registry.register({ component, source: '@holo-js/panels-svelte', typeId: type })
  return registry
}

export * from './contracts'
export * from './helpers'
