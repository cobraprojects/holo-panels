import type { Component } from 'svelte'
import type { SvelteFieldRendererProps } from './contracts'
import type { SvelteComponentRegistry } from '../registry'
import BasicField from './BasicField.svelte'
import ChoiceField from './ChoiceField.svelte'
import CollectionField from './CollectionField.svelte'
import UploadField from './UploadField.svelte'

export function fieldRendererName(type: string): string {
  return type.startsWith('panels:field:') ? `field.${type.slice('panels:field:'.length)}` : `field.${type.replaceAll(':', '.')}`
}

const builtins: readonly [readonly string[], Component<SvelteFieldRendererProps>][] = [
  [['text', 'textarea', 'checkbox', 'toggle', 'radio', 'date', 'hidden', 'slider', 'color', 'slug'], BasicField],
  [['select', 'multiselect', 'checkbox-list', 'toggle-buttons'], ChoiceField],
  [['tags', 'key-value', 'code', 'markdown', 'rich-editor', 'repeater', 'builder'], CollectionField],
  [['panels:field:upload'], UploadField],
]

export function registerSvelteFieldRenderers(registry: SvelteComponentRegistry): SvelteComponentRegistry {
  for (const [types, component] of builtins) {
    for (const type of types) {
      const typeId = fieldRendererName(type)
      if (!registry.hasRenderer(typeId)) registry.register({ component, source: '@holo-js/panels-svelte', typeId })
    }
  }
  return registry
}
