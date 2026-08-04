import { defineComponent, h, ref, type PropType, type VNode, type VNodeChild } from 'vue'
import { fieldFrame, property, touchField, updateField } from './shared'
import type { VueFieldControlProps } from './types'

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function dateValue(value: unknown, mode: string): string {
  const date = value instanceof Date ? value : new Date(textValue(value))
  if (Number.isNaN(date.getTime())) return ''
  const iso = date.toISOString()
  if (mode === 'date') return iso.slice(0, 10)
  if (mode === 'time') return iso.slice(11, 16)
  return iso.slice(0, 16)
}

function stringProperty<TValues extends object>(props: VueFieldControlProps<TValues>, name: string): string | null {
  const value = props.context.definition.properties[name]
  return typeof value === 'string' ? value : null
}

function resizeTextarea(element: HTMLTextAreaElement): void {
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function eventTarget<TElement extends EventTarget>(event: Event): TElement {
  return event.currentTarget as TElement
}

export const VueBasicField = defineComponent({
  name: 'VueBasicField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const passwordVisible = ref(false)
    return (): VNode => {
      const props = componentProps.field
      const { context } = props
      const common = {
        disabled: context.disabled,
        placeholder: context.definition.placeholder ?? undefined,
        readonly: context.readOnly,
        onBlur: () => touchField(props),
      }
      if (context.definition.type === 'hidden') {
        return h('input', { name: context.definition.path, type: 'hidden', value: textValue(context.value) })
      }
      if (context.definition.type === 'textarea') {
        const autosize = property(context, 'autosize', false)
        return fieldFrame(context, h('textarea', {
          ...common,
          'data-autosize': autosize || undefined,
          maxlength: property(context, 'maximumLength', undefined as number | undefined),
          rows: property(context, 'rows', 4),
          value: textValue(context.value),
          onInput: (event: Event) => {
            const element = eventTarget<HTMLTextAreaElement>(event)
            if (autosize) resizeTextarea(element)
            updateField(props, element.value)
          },
        }))
      }
      if (context.definition.type === 'checkbox' || context.definition.type === 'toggle') {
        const stateLabel = context.value === true
          ? stringProperty(props, 'onLabel')
          : stringProperty(props, 'offLabel')
        return fieldFrame(context, h('input', {
          checked: context.value === true,
          disabled: context.disabled || context.readOnly,
          readonly: context.readOnly,
          role: context.definition.type === 'toggle' ? 'switch' : undefined,
          type: 'checkbox',
          onBlur: common.onBlur,
          onChange: (event: Event) => updateField(props, eventTarget<HTMLInputElement>(event).checked),
        }), {
          after: stateLabel ? h('span', { class: 'hp-field-toggle-label' }, stateLabel) : undefined,
        })
      }
      if (context.definition.type === 'radio') {
        const options: readonly unknown[] = Array.isArray(context.definition.properties.options) ? context.definition.properties.options : []
        const description = context.definition.helperText ?? context.definition.hint
        const descriptionId = description ? `${context.inputId}-description` : undefined
        const errorId = context.errors.length > 0 ? `${context.inputId}-errors` : undefined
        return h('fieldset', {
          class: 'hp-field',
          disabled: context.disabled || context.readOnly,
          'data-field-path': context.definition.path,
          'data-field-type': 'radio',
          'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
          'aria-invalid': context.errors.length > 0 ? 'true' : undefined,
          'aria-required': context.definition.required ? 'true' : undefined,
        }, [
          context.definition.label ? h('legend', [context.definition.label, context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null]) : null,
          description ? h('div', { id: descriptionId }, description) : null,
          ...options.map((option, index) => {
            if (typeof option !== 'object' || option === null || Array.isArray(option)) return null
            const value: unknown = Reflect.get(option, 'value')
            if (!['boolean', 'number', 'string'].includes(typeof value)) return null
            const id = `${context.inputId}-${index}`
            return h('label', { for: id, key: String(value) }, [
              h('input', {
                checked: context.value === value,
                disabled: context.disabled || context.readOnly || Reflect.get(option, 'disabled') === true,
                id,
                name: context.definition.path,
                readonly: context.readOnly,
                type: 'radio',
                onChange: () => updateField(props, value),
              }),
              typeof Reflect.get(option, 'label') === 'string' ? String(Reflect.get(option, 'label')) : String(value),
            ])
          }),
          context.errors.length > 0 ? h('ul', { id: errorId, role: 'alert' }, context.errors.map(error => h('li', { key: error }, error))) : null,
        ])
      }
      const dateMode = property(context, 'mode', 'date' as string)
      const textMode = property(context, 'inputMode', 'text' as string)
      const revealable = textMode === 'password' && property(context, 'revealable', false)
      const inputType = context.definition.type === 'color'
        ? 'color'
        : context.definition.type === 'date'
          ? dateMode === 'date-time' ? 'datetime-local' : dateMode === 'time' ? 'time' : 'date'
          : context.definition.type === 'slider'
            ? 'range'
            : textMode === 'password' ? passwordVisible.value ? 'text' : 'password' : textMode
      const prefix = stringProperty(props, 'prefix')
      const suffix = stringProperty(props, 'suffix')
      const datalistValue = context.definition.properties.datalist
      const datalist = Array.isArray(datalistValue) ? datalistValue.filter((value): value is string => typeof value === 'string') : []
      const datalistId = datalist.length > 0 ? `${context.inputId}-list` : undefined
      const after: VNodeChild[] = [
        suffix ? h('span', { class: 'hp-field-suffix' }, suffix) : null,
        revealable ? h('button', {
          'aria-controls': context.inputId,
          'aria-label': passwordVisible.value ? 'Hide password' : 'Show password',
          type: 'button',
          onClick: () => { passwordVisible.value = !passwordVisible.value },
        }, passwordVisible.value ? 'Hide' : 'Show') : null,
        datalistId ? h('datalist', { id: datalistId }, datalist.map(option => h('option', { key: option, value: option }))) : null,
      ]
      return fieldFrame(context, h('input', {
        ...common,
        autocomplete: property(context, 'autocomplete', undefined as string | undefined),
        'data-mask': stringProperty(props, 'mask') ?? undefined,
        list: datalistId,
        max: property(context, 'maximum', undefined as number | string | undefined),
        maxlength: property(context, 'maximumLength', undefined as number | undefined),
        min: property(context, 'minimum', undefined as number | string | undefined),
        minlength: property(context, 'minimumLength', undefined as number | undefined),
        step: property(context, 'step', undefined as number | undefined),
        type: inputType,
        value: context.definition.type === 'date' ? dateValue(context.value, dateMode) : textValue(context.value),
        onInput: (event: Event) => {
          const raw = eventTarget<HTMLInputElement>(event).value
          updateField(props, context.definition.type === 'slider' || typeof context.value === 'number' ? Number(raw) : raw)
        },
      }), {
        after,
        before: prefix ? h('span', { class: 'hp-field-prefix' }, prefix) : undefined,
      })
    }
  },
})
