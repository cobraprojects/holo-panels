import type { CollectionStore, EditorAdapterInstance } from '@holo-js/panels-client'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import { usePanelsStore } from '../stores'
import { fieldFrame, property, requireStore, updateField } from './shared'
import type { VueFieldControlProps } from './types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

const VueEditorField = defineComponent({
  name: 'VueEditorField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const element = ref<HTMLElement>()
    let instance: EditorAdapterInstance | undefined
    const adapterId = () => typeof componentProps.field.context.definition.properties.editorAdapter === 'string'
      ? componentProps.field.context.definition.properties.editorAdapter
      : null
    onMounted(() => {
      const id = adapterId()
      if (!id || !element.value) return
      const registry = requireStore(componentProps.field.editorAdapters, componentProps.field.context.definition.type, 'EditorAdapterRegistry')
      instance = registry.resolve(id, componentProps.field.context.definition.path).mount({
        disabled: componentProps.field.context.disabled,
        element: element.value,
        onChange: value => updateField(componentProps.field, value),
        readOnly: componentProps.field.context.readOnly,
        value: asString(componentProps.field.context.value),
      })
    })
    watch(() => asString(componentProps.field.context.value), value => instance?.update(value))
    onBeforeUnmount(() => instance?.destroy())
    return (): VNode => {
      if (adapterId()) return fieldFrame(componentProps.field.context, h('div', { ref: element, tabindex: 0 }))
      return fieldFrame(componentProps.field.context, h('textarea', {
        disabled: componentProps.field.context.disabled,
        readonly: componentProps.field.context.readOnly,
        value: asString(componentProps.field.context.value),
        onInput: (event: Event) => updateField(componentProps.field, (event.currentTarget as HTMLTextAreaElement).value),
      }))
    }
  },
})

function collectionActions(
  store: CollectionStore<unknown>,
  disabled: boolean,
  index: number,
  length: number,
): VNode {
  return h('span', { class: 'hp-collection-actions' }, [
    h('button', { type: 'button', 'aria-label': `Move item ${index + 1} up`, disabled: disabled || index === 0, onClick: () => store.move(index, index - 1) }, '↑'),
    h('button', { type: 'button', 'aria-label': `Move item ${index + 1} down`, disabled: disabled || index === length - 1, onClick: () => store.move(index, index + 1) }, '↓'),
    h('button', { type: 'button', 'aria-label': `Clone item ${index + 1}`, disabled, onClick: () => store.clone(index) }, 'Clone'),
    h('button', { type: 'button', 'aria-label': `Remove item ${index + 1}`, disabled, onClick: () => store.delete(index) }, 'Remove'),
  ])
}

function keyValueEditor(store: CollectionStore<unknown>, value: unknown, index: number, disabled: boolean): VNodeChild {
  const key = typeof value === 'object' && value !== null ? asString(Reflect.get(value, 'key')) : ''
  const entryValue = typeof value === 'object' && value !== null ? asString(Reflect.get(value, 'value')) : ''
  return h('span', [
    h('input', {
      'aria-label': `Key ${index + 1}`,
      disabled,
      value: key,
      onInput: (event: Event) => store.replace(index, { key: (event.currentTarget as HTMLInputElement).value, value: entryValue }),
    }),
    h('input', {
      'aria-label': `Value ${index + 1}`,
      disabled,
      value: entryValue,
      onInput: (event: Event) => store.replace(index, { key, value: (event.currentTarget as HTMLInputElement).value }),
    }),
  ])
}

export const VueCollectionField = defineComponent({
  name: 'VueCollectionField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const field = new Proxy(componentProps.field, {
      get: (_target, property) => Reflect.get(componentProps.field, property),
    })
    if (['code', 'markdown', 'rich-editor'].includes(field.context.definition.type)) {
      return () => h(VueEditorField, { field: componentProps.field })
    }
    if (field.context.definition.type === 'tags') {
      return () => {
        const separator = property(field.context, 'separator', ',')
        const value = Array.isArray(field.context.value) ? field.context.value.filter(item => typeof item === 'string').join(`${separator} `) : ''
        return fieldFrame(field.context, h('input', {
          disabled: field.context.disabled,
          readonly: field.context.readOnly,
          type: 'text',
          value,
          onInput: (event: Event) => updateField(field, (event.currentTarget as HTMLInputElement).value.split(separator).map(item => item.trim()).filter(Boolean)),
        }))
      }
    }
    const store = requireStore(field.collectionStore, field.context.definition.type, 'CollectionStore')
    const state = usePanelsStore(store)
    watch(() => state.value.version, () => updateField(field, store.values))
    function itemContent(value: unknown, index: number): VNodeChild {
      if (field.context.definition.type === 'key-value') return keyValueEditor(store, value, index, field.context.disabled || field.context.readOnly)
      if (field.context.definition.type === 'builder') {
        return field.renderBuilderBlock?.(value, index)
          ?? h('span', typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string' ? String(Reflect.get(value, 'type')) : `Block ${index + 1}`)
      }
      return field.renderRepeaterItem?.(value, index) ?? h('span', `Item ${index + 1}`)
    }
    return (): VNode => {
      const maximum = property(field.context, 'maximumItems', null as number | null)
      const disabled = field.context.disabled || field.context.readOnly
      return h('div', {
        class: 'hp-field hp-collection',
        'data-field-path': field.context.definition.path,
        'data-field-type': field.context.definition.type,
      }, [
        field.context.definition.label ? h('div', field.context.definition.label) : null,
        h('ol', state.value.items.map((item, index) => h('li', { key: item.key }, [
          item.collapsed ? null : itemContent(item.value, index),
          h('button', {
            type: 'button',
            'aria-expanded': String(!item.collapsed),
            disabled,
            onClick: () => store.toggleCollapsed(index),
          }, item.collapsed ? 'Expand' : 'Collapse'),
          collectionActions(store, disabled, index, state.value.items.length),
          Object.entries(state.value.errors).filter(([path]) => path === String(index) || path.startsWith(`${index}.`)).map(([path, errors]) => h('ul', { key: path, role: 'alert' }, errors.map(error => h('li', { key: error }, error)))),
        ]))),
        h('button', {
          type: 'button',
          disabled: disabled || (maximum !== null && state.value.items.length >= maximum),
          onClick: () => store.add(field.createCollectionItem?.() ?? {}),
        }, 'Add item'),
        field.context.errors.length > 0 ? h('ul', { role: 'alert' }, field.context.errors.map(error => h('li', { key: error }, error))) : null,
      ])
    }
  },
})
