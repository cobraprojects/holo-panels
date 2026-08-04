import type { Component } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'
import type { SvelteCustomEntryProps, SvelteEntryRendererProps } from './contracts'
import RawEntryRenderer from './EntryRenderer.svelte'

export const EntryRenderer: Component<SvelteEntryRendererProps> = RawEntryRenderer

export function registerSvelteEntryRenderer(
  registry: SvelteComponentRegistry,
  type: string,
  component: Component<SvelteCustomEntryProps>,
): SvelteComponentRegistry {
  registry.register({ component, source: '@holo-js/panels-svelte', typeId: `entry.${type.replaceAll(':', '.')}` })
  return registry
}

export * from './contracts'
export * from './helpers'
