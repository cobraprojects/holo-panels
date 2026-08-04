import { useEffect, type ReactNode } from 'react'
import { FieldFrame, requireStore, updateField, useStoreState } from './shared'
import type { ReactFieldControlProps } from './types'

type OptionValue = string | number

interface ChoiceOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: OptionValue
}

function selected(value: unknown): readonly OptionValue[] {
  if (Array.isArray(value)) return value.filter((item): item is OptionValue => typeof item === 'string' || typeof item === 'number')
  return typeof value === 'string' || typeof value === 'number' ? [value] : []
}

function optionValue(raw: string, options: readonly ChoiceOption[]): OptionValue {
  return options.find(option => String(option.value) === raw)?.value ?? raw
}

export function ReactOptionField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const optionStore = requireStore(props.optionStore, props.context.definition.type, 'OptionStore')
  const state = useStoreState(optionStore)
  const values = selected(props.context.value)
  const selectedKey = JSON.stringify(values)
  useEffect(() => {
    void optionStore.preload()
  }, [optionStore])
  useEffect(() => {
    void optionStore.hydrateSelected(values)
  }, [optionStore, selectedKey])
  const options = [...state.options]
  for (const item of state.selectedOptions) if (!options.some(option => option.value === item.value)) options.push(item)
  const multiple = props.context.definition.type === 'multiselect' || props.context.definition.type === 'checkbox-list'
  if (props.context.definition.type === 'checkbox-list' || props.context.definition.type === 'toggle-buttons') {
    return <fieldset className="hp-field" data-field-path={props.context.definition.path} disabled={props.context.disabled || state.disabled}>
      {props.context.definition.label ? <legend>{props.context.definition.label}</legend> : null}
      {options.map(option => <label key={String(option.value)}><input
        checked={values.includes(option.value)}
        disabled={option.disabled || props.context.readOnly}
        name={props.context.definition.path}
        onChange={event => updateField(props, event.currentTarget.checked
          ? multiple ? [...values, option.value] : option.value
          : multiple ? values.filter(value => value !== option.value) : null)}
        type={multiple ? 'checkbox' : 'radio'}
      />{option.label}</label>)}
    </fieldset>
  }
  return <FieldFrame context={props.context}><select
    disabled={props.context.disabled || state.disabled}
    multiple={multiple}
    onChange={event => updateField(props, multiple
      ? [...event.currentTarget.selectedOptions].map(option => optionValue(option.value, options))
      : optionValue(event.currentTarget.value, options))}
    value={multiple ? values.map(String) : String(values[0] ?? '')}
  >
    {!multiple ? <option value="">{state.loading ? 'Loading…' : 'Select an option'}</option> : null}
    {options.map(option => <option disabled={option.disabled} key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
  </select></FieldFrame>
}
