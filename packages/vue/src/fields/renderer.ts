import { defineComponent, h, type Component, type PropType, type VNode } from 'vue'
import { VueBasicField } from './basic'
import { VueCollectionField } from './collections'
import { VueOptionField } from './options'
import { useFieldContext } from './shared'
import type { VueFieldControlProps, VueFieldRendererProps } from './types'
import { VueUploadField } from './upload'

const basicTypes = new Set(['checkbox', 'color', 'date', 'hidden', 'radio', 'slider', 'slug', 'text', 'textarea', 'toggle'])
const optionTypes = new Set(['checkbox-list', 'multiselect', 'select', 'toggle-buttons'])
const collectionTypes = new Set(['builder', 'code', 'key-value', 'markdown', 'repeater', 'rich-editor', 'tags'])

export function fieldRendererName(type: string): string {
  return type.startsWith('panels:field:') ? `field.${type.slice('panels:field:'.length)}` : `field.${type.replaceAll(':', '.')}`
}

function control(component: Component, field: VueFieldControlProps<object>): VNode {
  return h(component, { field })
}

export const VueFieldRenderer = defineComponent({
  name: 'VueFieldRenderer',
  props: {
    field: { type: Object as PropType<VueFieldRendererProps<object>>, required: true },
  },
  setup(componentProps) {
    const context = useFieldContext(componentProps.field)
    return (): VNode | null => {
      if (!context.value) return null
      const field: VueFieldControlProps<object> = { ...componentProps.field, context: context.value }
      if (basicTypes.has(field.definition.type)) return control(VueBasicField, field)
      if (optionTypes.has(field.definition.type)) return control(VueOptionField, field)
      if (collectionTypes.has(field.definition.type)) return control(VueCollectionField, field)
      if (field.definition.type === 'panels:field:upload') return control(VueUploadField, field)
      const renderer = field.registry.resolve(
        fieldRendererName(field.definition.type),
        field.panelId,
        `field "${field.definition.path}"`,
      )
      return control(renderer, field)
    }
  },
})

export function registerVueFieldRenderers(registry: VueFieldRendererProps<object>['registry']): typeof registry {
  for (const type of basicTypes) registry.register(fieldRendererName(type), VueBasicField, '@holo-js/panels-vue')
  for (const type of optionTypes) registry.register(fieldRendererName(type), VueOptionField, '@holo-js/panels-vue')
  for (const type of collectionTypes) registry.register(fieldRendererName(type), VueCollectionField, '@holo-js/panels-vue')
  registry.register('field.upload', VueUploadField, '@holo-js/panels-vue')
  return registry
}

export const vueFieldTypes = Object.freeze({
  basic: Object.freeze([...basicTypes]),
  collection: Object.freeze([...collectionTypes]),
  option: Object.freeze([...optionTypes]),
  upload: Object.freeze(['panels:field:upload']),
})
