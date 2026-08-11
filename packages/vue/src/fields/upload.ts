import { ShadcnButton, ShadcnInput } from '../internal-ui'
import type { ClientUploadFile } from '@holo-js/panels-client'
import { defineComponent, getCurrentScope, h, onScopeDispose, readonly, shallowRef, type PropType, type VNode } from 'vue'
import { requireStore } from './shared'
import type { VueFieldControlProps } from './types'

export const VueUploadField = defineComponent({
  name: 'VueUploadField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const field = new Proxy(componentProps.field, {
      get: (_target, property) => Reflect.get(componentProps.field, property),
    })
    const store = requireStore(field.uploadStore, field.context.definition.type, 'UploadStore')
    const uploadState = shallowRef(store.state)
    const unsubscribe = store.subscribe(next => { uploadState.value = next })
    if (getCurrentScope()) onScopeDispose(unsubscribe)
    const state = readonly(uploadState)
    function select(event: Event): void {
      const input = event.currentTarget as HTMLInputElement
      if (input.files) store.add(Array.from(input.files) as readonly ClientUploadFile[])
      input.value = ''
    }
    return (): VNode => {
      const disabled = field.context.disabled || field.context.readOnly
      const description = field.context.definition.helperText ?? field.context.definition.hint
      const descriptionId = description ? `${field.context.inputId}-description` : undefined
      const errorId = field.context.errors.length > 0 ? `${field.context.inputId}-errors` : undefined
      return h('div', {
        class: 'hp-field hp-upload',
        'data-field-path': field.context.definition.path,
        'data-field-type': field.context.definition.type,
      }, [
        h('label', { for: field.context.inputId }, [
          field.context.definition.label ?? 'Upload files',
          field.context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null,
        ]),
        description ? h('div', { id: descriptionId }, description) : null,
        h(ShadcnInput, {
          id: field.context.inputId,
          type: 'file',
          multiple: true,
          disabled,
          'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
          'aria-invalid': field.context.errors.length > 0 ? 'true' : undefined,
          'aria-required': field.context.definition.required ? 'true' : undefined,
          onChange: select,
        }),
        h('ul', state.value.items.map((item, index) => h('li', { key: item.id }, [
          item.previewUrl ? h('img', { alt: `Preview of ${item.name}`, src: item.previewUrl }) : null,
          h('span', item.name),
          h('progress', { 'aria-label': `Upload progress for ${item.name}`, max: 1, value: item.progress }),
          h('span', { 'aria-live': 'polite' }, item.status),
          item.error ? h('span', { role: 'alert' }, item.error) : null,
          h(ShadcnButton, { type: 'button', 'aria-label': `Move ${item.name} up`, disabled: disabled || index === 0, onClick: () => store.reorder(index, index - 1) }, '↑'),
          h(ShadcnButton, { type: 'button', 'aria-label': `Move ${item.name} down`, disabled: disabled || index === state.value.items.length - 1, onClick: () => store.reorder(index, index + 1) }, '↓'),
          h(ShadcnButton, { type: 'button', 'aria-label': `Remove ${item.name}`, disabled, onClick: () => void store.remove(item.id) }, 'Remove'),
        ]))),
        field.context.errors.length > 0 ? h('ul', { id: errorId, role: 'alert' }, field.context.errors.map(error => h('li', { key: error }, error))) : null,
      ])
    }
  },
})
