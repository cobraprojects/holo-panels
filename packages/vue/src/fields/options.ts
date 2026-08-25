import { Button, Checkbox, Input, NativeSelect, RadioGroup, RadioGroupItem } from '../internal-ui'
import { computed, defineComponent, h, onMounted, ref, type PropType, type VNode } from 'vue'
import { usePanelsStore } from '../stores'
import { fieldFrame, property, requireStore, updateField } from './shared'
import type { VueFieldControlProps } from './types'

type OptionValue = string | number

interface ChoiceOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: OptionValue
}

function selected(value: unknown): readonly OptionValue[] {
  if (Array.isArray(value)) return value.filter((item): item is OptionValue => typeof item === 'number' || typeof item === 'string' && item.length > 0)
  return typeof value === 'number' || typeof value === 'string' && value.length > 0 ? [value] : []
}

function optionValue(raw: string, options: readonly ChoiceOption[]): OptionValue {
  return options.find(option => String(option.value) === raw)?.value ?? raw
}

export const VueOptionField = defineComponent({
  name: 'VueOptionField',
  props: {
    field: { type: Object as PropType<VueFieldControlProps<object>>, required: true },
  },
  setup(componentProps) {
    const props = new Proxy(componentProps.field, {
      get: (_target, property) => Reflect.get(componentProps.field, property),
    })
    const store = requireStore(props.optionStore, props.context.definition.type, 'OptionStore')
    const state = usePanelsStore(store)
    const createLabel = ref('')
    const editLabel = ref('')
    const values = computed(() => selected(props.context.value))
    const options = computed(() => {
      const combined = [...state.value.options]
      for (const option of state.value.selectedOptions) {
        if (!combined.some(candidate => candidate.value === option.value)) combined.push(option)
      }
      return combined
    })
    onMounted(() => {
      void store.hydrateSelected(values.value).then(async () => {
        if (property(props.context, 'preload', false) || !property(props.context, 'searchable', false)) await store.preload()
      })
    })
    async function createOption(): Promise<void> {
      const option = await store.create(createLabel.value)
      createLabel.value = ''
      updateField(props, multiple() ? [...values.value, option.value] : option.value)
      await store.hydrateSelected(multiple() ? [...values.value, option.value] : [option.value])
    }
    async function editOption(): Promise<void> {
      const value = values.value[0]
      if (typeof value === 'undefined') return
      await store.edit(value, editLabel.value)
      editLabel.value = ''
      await store.hydrateSelected([value])
    }
    function multiple(): boolean {
      return props.context.definition.type === 'multiselect' || props.context.definition.type === 'checkbox-list'
        || property(props.context, 'multiple', false)
    }
    function renderChoiceGroup(): VNode {
      const description = props.context.definition.helperText ?? props.context.definition.hint
      const descriptionId = description ? `${props.context.inputId}-description` : undefined
      const errorId = props.context.errors.length > 0 ? `${props.context.inputId}-errors` : undefined
      const choices = options.value.map(option => h('label', { key: String(option.value) }, [
        multiple()
          ? h(Checkbox, {
              disabled: option.disabled || props.context.readOnly,
              modelValue: values.value.includes(option.value),
              'onUpdate:modelValue': (checked: boolean | 'indeterminate') => updateField(props, checked === true
                ? [...values.value, option.value]
                : values.value.filter(value => value !== option.value)),
            })
          : h(RadioGroupItem, {
              disabled: option.disabled || props.context.readOnly,
              value: String(option.value),
            }),
        option.label,
      ]))
      return h('fieldset', {
        class: 'hp-field',
        disabled: props.context.disabled || state.value.disabled,
        'data-field-path': props.context.definition.path,
        'data-field-type': props.context.definition.type,
        'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': props.context.errors.length > 0 ? 'true' : undefined,
        'aria-required': props.context.definition.required ? 'true' : undefined,
      }, [
        props.context.definition.label ? h('legend', [
          props.context.definition.label,
          props.context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null,
        ]) : null,
        description ? h('div', { id: descriptionId }, description) : null,
        multiple()
          ? choices
          : h(RadioGroup, {
              disabled: props.context.disabled || props.context.readOnly,
              modelValue: String(values.value[0] ?? ''),
              'onUpdate:modelValue': (raw: unknown) => updateField(props, optionValue(String(raw), options.value)),
            }, () => choices),
        renderSearchAndPaging(),
        props.context.errors.length > 0 ? h('ul', { id: errorId, role: 'alert' }, props.context.errors.map(error => h('li', { key: error }, error))) : null,
      ])
    }
    function renderSearchAndPaging(): VNode[] {
      return [
        property(props.context, 'searchable', false) ? h(Input, {
          'aria-label': `Search ${props.context.definition.label ?? 'options'}`,
          disabled: props.context.disabled || state.value.disabled,
          type: 'search',
          modelValue: state.value.search,
          onInput: (event: Event) => void store.load((event.currentTarget as HTMLInputElement).value, 1),
        }) : null,
        property(props.context, 'paginated', true) && (state.value.page > 1 || state.value.hasMore) ? h('nav', { 'aria-label': `${props.context.definition.label ?? 'Option'} pages` }, [
          h(Button, { type: 'button', disabled: state.value.page <= 1 || state.value.loading, onClick: () => void store.load(state.value.search, state.value.page - 1) }, 'Previous'),
          h('span', { 'aria-live': 'polite' }, `Page ${state.value.page}`),
          h(Button, { type: 'button', disabled: !state.value.hasMore || state.value.loading, onClick: () => void store.load(state.value.search, state.value.page + 1) }, 'Next'),
        ]) : null,
      ].filter((node): node is VNode => node !== null)
    }
    function renderCreateEdit(): VNode[] {
      const controls: VNode[] = []
      if (property(props.context, 'canCreateOption', false)) controls.push(h('div', [
        h(Input, {
          'aria-label': `Create ${props.context.definition.label ?? 'option'} label`,
          disabled: props.context.disabled || props.context.readOnly,
          modelValue: createLabel.value,
          onInput: (event: Event) => { createLabel.value = (event.currentTarget as HTMLInputElement).value },
        }),
        h(Button, { type: 'button', disabled: !createLabel.value.trim(), onClick: () => void createOption() }, 'Create option'),
      ]))
      if (property(props.context, 'canEditOption', false)) controls.push(h('div', [
        h(Input, {
          'aria-label': `Edit ${props.context.definition.label ?? 'option'} label`,
          disabled: props.context.disabled || props.context.readOnly || values.value.length !== 1,
          modelValue: editLabel.value,
          onInput: (event: Event) => { editLabel.value = (event.currentTarget as HTMLInputElement).value },
        }),
        h(Button, { type: 'button', disabled: !editLabel.value.trim() || values.value.length !== 1, onClick: () => void editOption() }, 'Edit option'),
      ]))
      return controls
    }
    return (): VNode => {
      if (props.context.definition.type === 'checkbox-list' || props.context.definition.type === 'toggle-buttons') return renderChoiceGroup()
      const select = h(NativeSelect, {
        disabled: props.context.disabled || props.context.readOnly || state.value.disabled,
        multiple: multiple(),
        modelValue: multiple() ? values.value.map(String) : String(values.value[0] ?? ''),
        onChange: (event: Event) => {
          const element = event.currentTarget as HTMLSelectElement
          updateField(props, multiple()
            ? Array.from(element.selectedOptions).map(option => optionValue(option.value, options.value))
            : optionValue(element.value, options.value))
        },
      }, [
        !multiple() ? h('option', { value: '' }, state.value.loading ? 'Loading…' : 'Select an option') : null,
        ...options.value.map(option => h('option', { disabled: option.disabled, key: String(option.value), value: String(option.value) }, option.label)),
      ])
      return h('div', [fieldFrame(props.context, select), ...renderSearchAndPaging(), ...renderCreateEdit()])
    }
  },
})
