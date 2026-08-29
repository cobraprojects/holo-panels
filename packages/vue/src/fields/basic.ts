import { Button, Checkbox, Input, InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, RadioGroup, RadioGroupItem, Switch, Textarea } from '../internal-ui'
import { FieldLegend, FieldSet } from '../ui/field'
import { defineComponent, h, ref, type PropType, type VNode } from 'vue'
import { actionButton, fieldFrame, property, touchField, updateField } from './shared'
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
        return h(Input, { name: context.definition.path, type: 'hidden', modelValue: textValue(context.value), 'data-slot': 'input' })
      }
      if (context.definition.type === 'textarea') {
        const autosize = property(context, 'autosize', false)
        return fieldFrame(context, h(Textarea, {
          ...common,
          'data-autosize': autosize || undefined,
          'data-slot': 'textarea',
          maxlength: property(context, 'maximumLength', undefined as number | undefined),
          rows: property(context, 'rows', 4),
          modelValue: textValue(context.value),
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
        const control = context.definition.type === 'toggle'
          ? h(Switch, {
              disabled: context.disabled || context.readOnly,
              modelValue: context.value === true,
              onBlur: common.onBlur,
              'onUpdate:modelValue': (checked: boolean) => updateField(props, checked),
            })
          : h(Checkbox, {
              disabled: context.disabled || context.readOnly,
              modelValue: context.value === true,
              onBlur: common.onBlur,
              'onUpdate:modelValue': (checked: boolean | 'indeterminate') => updateField(props, checked === true),
            })
        return fieldFrame(context, control, {
          after: stateLabel ? h('span', { class: 'hp-field-toggle-label' }, stateLabel) : undefined,
        })
      }
      if (context.definition.type === 'radio') {
        const options: readonly unknown[] = Array.isArray(context.definition.properties.options) ? context.definition.properties.options : []
        const description = context.definition.helperText ?? context.definition.hint
        const descriptionId = description ? `${context.inputId}-description` : undefined
        const errorId = context.errors.length > 0 ? `${context.inputId}-errors` : undefined
        return h(FieldSet, {
          class: 'hp-field',
          disabled: context.disabled || context.readOnly,
          'data-field-path': context.definition.path,
          'data-field-type': 'radio',
          'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
          'aria-invalid': context.errors.length > 0 ? 'true' : undefined,
          'aria-required': context.definition.required ? 'true' : undefined,
        }, [
          context.definition.label ? h(FieldLegend, { variant: 'label' }, () => [context.definition.label, context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null]) : null,
          description ? h('div', { id: descriptionId }, description) : null,
          h(RadioGroup, {
            disabled: context.disabled || context.readOnly,
            modelValue: typeof context.value === 'boolean' || typeof context.value === 'number' || typeof context.value === 'string' ? String(context.value) : undefined,
            'onUpdate:modelValue': (raw: unknown) => {
              const match = options.find(option => typeof option === 'object' && option !== null && !Array.isArray(option) && String(Reflect.get(option, 'value')) === raw)
              if (match) updateField(props, Reflect.get(match, 'value'))
            },
          }, () => options.map((option, index) => {
            if (typeof option !== 'object' || option === null || Array.isArray(option)) return null
            const value: unknown = Reflect.get(option, 'value')
            if (!['boolean', 'number', 'string'].includes(typeof value)) return null
            const id = `${context.inputId}-${index}`
            return h('label', { for: id, key: String(value) }, [
              h(RadioGroupItem, {
                disabled: context.disabled || context.readOnly || Reflect.get(option, 'disabled') === true,
                id,
                value: String(value),
              }),
              typeof Reflect.get(option, 'label') === 'string' ? String(Reflect.get(option, 'label')) : String(value),
            ])
          })),
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
      const prefixAction = actionButton(context.definition.properties.prefixAction, context.executeAction, context.actionPending)
      const suffixAction = actionButton(context.definition.properties.suffixAction, context.executeAction, context.actionPending)
      const datalistValue = context.definition.properties.datalist
      const datalist = Array.isArray(datalistValue) ? datalistValue.filter((value): value is string => typeof value === 'string') : []
      const datalistId = datalist.length > 0 ? `${context.inputId}-list` : undefined
      const inputProps = {
        ...common,
        autocomplete: property(context, 'autocomplete', undefined as string | undefined),
        'data-mask': stringProperty(props, 'mask') ?? undefined,
        'data-slot': context.definition.type === 'slider' ? 'slider' : 'input',
        list: datalistId,
        max: property(context, 'maximum', undefined as number | string | undefined),
        maxlength: property(context, 'maximumLength', undefined as number | undefined),
        min: property(context, 'minimum', undefined as number | string | undefined),
        minlength: property(context, 'minimumLength', undefined as number | undefined),
        step: property(context, 'step', undefined as number | undefined),
        type: inputType,
        modelValue: context.definition.type === 'date' ? dateValue(context.value, dateMode) : textValue(context.value),
        onInput: (event: Event) => {
          const raw = eventTarget<HTMLInputElement>(event).value
          updateField(props, context.definition.type === 'slider' || typeof context.value === 'number' ? Number(raw) : raw)
        },
      }
      const input = prefix || suffix || prefixAction || suffixAction || revealable
        ? h(InputGroup, {}, () => [
            prefix || prefixAction ? h(InputGroupAddon, { align: 'inline-start' }, () => [prefix ? h(InputGroupText, { class: 'hp-field-prefix' }, () => prefix) : null, prefixAction]) : null,
            h(InputGroupInput, inputProps),
            suffix || suffixAction || revealable ? h(InputGroupAddon, { align: 'inline-end' }, () => [
              suffix ? h(InputGroupText, { class: 'hp-field-suffix' }, () => suffix) : null,
              suffixAction,
              revealable ? h(Button, {
                'aria-controls': context.inputId,
                'aria-label': passwordVisible.value ? 'Hide password' : 'Show password',
                size: 'sm',
                type: 'button',
                variant: 'ghost',
                onClick: () => { passwordVisible.value = !passwordVisible.value },
              }, () => passwordVisible.value ? 'Hide' : 'Show') : null,
            ]) : null,
          ])
        : h(Input, inputProps)
      return fieldFrame(context, input, {
        after: datalistId ? h('datalist', { id: datalistId }, datalist.map(option => h('option', { key: option, value: option }))) : undefined,
      })
    }
  },
})
