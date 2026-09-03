import { usePanelLocale, usePanelTranslator } from '../localization'
import { Button, Input, Progress } from '../internal-ui'
import type { ClientUploadFile } from '@holo-js/panels-client'
import { defineComponent, getCurrentScope, h, onScopeDispose, readonly, shallowRef, watchEffect, type PropType, type VNode } from 'vue'
import { requireStore } from './shared'
import type { VueFieldControlProps } from './types'

export const VueUploadField = defineComponent({
  name: 'VueUploadField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const locale = usePanelLocale()
    const translate = usePanelTranslator()
    const field = new Proxy(componentProps.field, {
      get: (_target, property) => Reflect.get(componentProps.field, property),
    })
    const store = requireStore(field.uploadStore, field.context.definition.type, 'UploadStore')
    watchEffect(() => store.setLocale(locale()))
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
          field.context.definition.label ?? translate('uploads.label'),
          field.context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null,
        ]),
        state.value.error ? h('p', { role: 'alert' }, state.value.error) : null,
        description ? h('div', { id: descriptionId }, description) : null,
        h(Input, {
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
          item.previewUrl ? h('img', { alt: translate('uploads.preview', { name: item.name }), src: item.previewUrl }) : null,
          h('span', item.name),
          h(Progress, { 'aria-label': translate('uploads.progress', { name: item.name }), max: 1, modelValue: item.progress }),
          h('span', { 'aria-live': 'polite' }, translate(`uploads.${item.status}`)),
          item.error ? h('span', { role: 'alert' }, item.error) : null,
          h(Button, { type: 'button', 'aria-label': translate('uploads.moveUp', { name: item.name }), disabled: disabled || index === 0, onClick: () => store.reorder(index, index - 1) }, '↑'),
          h(Button, { type: 'button', 'aria-label': translate('uploads.moveDown', { name: item.name }), disabled: disabled || index === state.value.items.length - 1, onClick: () => store.reorder(index, index + 1) }, '↓'),
          h(Button, { type: 'button', 'aria-label': translate(item.status === 'pending' || item.status === 'uploading' ? 'uploads.cancel' : 'uploads.remove', { name: item.name }), disabled, onClick: () => void store.remove(item.id) }, item.status === 'pending' || item.status === 'uploading' ? translate('actions.cancel') : translate('fields.remove')),
        ]))),
        field.context.errors.length > 0 ? h('ul', { id: errorId, role: 'alert' }, field.context.errors.map(error => h('li', { key: error }, error))) : null,
      ])
    }
  },
})
