import type { VueFieldControlProps } from '@holo-js/panels-vue'
import { defineComponent, h, type PropType, type VNode } from 'vue'

function currency(properties: Readonly<Record<string, unknown>>): string {
  return typeof properties.currency === 'string' ? properties.currency : 'USD'
}

export const CurrencyField = defineComponent({
  name: 'MoneyCurrencyField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    return (): VNode => {
      const props = componentProps.field
      return h('label', { class: 'hp-money-field', for: props.context.inputId }, [
        h('span', props.context.definition.label ?? currency(props.context.definition.properties)),
        h('input', {
          'aria-invalid': props.context.errors.length > 0 ? 'true' : undefined,
          disabled: props.context.disabled,
          id: props.context.inputId,
          inputmode: 'decimal',
          readonly: props.context.readOnly,
          step: 10 ** -Number(props.context.definition.properties.minorUnits ?? 2),
          type: 'number',
          value: typeof props.context.value === 'number' ? String(props.context.value) : '',
          onInput: (event: Event) => {
            const target = event.currentTarget
            const value: unknown = target === null ? undefined : Reflect.get(target, 'value')
            if (typeof value === 'string') props.store.batch([{ kind: 'set', path: props.context.definition.path, value: Number(value), touch: true }])
          },
        }),
        h('span', currency(props.context.definition.properties)),
      ])
    }
  },
})

export const MoneyColumn = defineComponent({
  name: 'MoneyColumn',
  props: {
    currency: { type: String, required: true },
    locale: { type: String, default: null },
    value: { type: Number, required: true },
  },
  setup(props) {
    return (): VNode => h('span', { class: 'hp-money-column' }, new Intl.NumberFormat(props.locale ?? undefined, { currency: props.currency, style: 'currency' }).format(props.value))
  },
})
