import { useEffect, useState, type ReactNode } from 'react'
import { ShadcnButton, ShadcnInput, ShadcnSelect } from '../internal-ui'
import { FieldFrame, property, requireStore, updateField, useStoreState } from './shared'
import type { ReactFieldControlProps } from './types'

type OptionValue = string | number

interface ChoiceOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: OptionValue
}

function selected(value: unknown): readonly OptionValue[] {
  if (Array.isArray(value)) return value.filter((item): item is OptionValue => (typeof item === 'string' && item.length > 0) || (typeof item === 'number' && Number.isFinite(item)))
  if (typeof value === 'string') return value.length > 0 ? [value] : []
  return typeof value === 'number' && Number.isFinite(value) ? [value] : []
}

function optionValue(raw: string, options: readonly ChoiceOption[]): OptionValue {
  return options.find(option => String(option.value) === raw)?.value ?? raw
}

function manifestOptions(value: unknown): readonly ChoiceOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const label = Reflect.get(item, 'label')
    const option = Reflect.get(item, 'value')
    if (typeof label !== 'string' || (typeof option !== 'string' && typeof option !== 'number')) return []
    return [{ disabled: Reflect.get(item, 'disabled') === true, label, value: option }]
  })
}

export function ReactOptionField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const optionStore = requireStore(props.optionStore, props.context.definition.type, 'OptionStore')
  const state = useStoreState(optionStore)
  const [createLabel, setCreateLabel] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const values = selected(props.context.value)
  const selectedKey = JSON.stringify(values)
  useEffect(() => {
    void optionStore.hydrateSelected(values).then(async () => {
      if (property(props.context, 'preload', false) || !property(props.context, 'searchable', false)) await optionStore.preload()
    })
  }, [optionStore, selectedKey])
  const options = [...manifestOptions(props.context.definition.properties.options)]
  for (const item of state.options) if (!options.some(option => option.value === item.value)) options.push(item)
  for (const item of state.selectedOptions) if (!options.some(option => option.value === item.value)) options.push(item)
  const multiple = props.context.definition.type === 'multiselect' || props.context.definition.type === 'checkbox-list'
  const searchAndPaging = <>
    {property(props.context, 'searchable', false) ? <ShadcnInput
      aria-label={`Search ${props.context.definition.label ?? 'options'}`}
      disabled={props.context.disabled || state.disabled}
      onChange={event => void optionStore.load(event.currentTarget.value, 1)}
      type="search"
      value={state.search}
    /> : null}
    {property(props.context, 'paginated', true) && (state.page > 1 || state.hasMore) ? <nav aria-label={`${props.context.definition.label ?? 'Option'} pages`}>
      <ShadcnButton disabled={state.page <= 1 || state.loading} onClick={() => void optionStore.load(state.search, state.page - 1)} type="button">Previous</ShadcnButton>
      <span aria-live="polite">Page {state.page}</span>
      <ShadcnButton disabled={!state.hasMore || state.loading} onClick={() => void optionStore.load(state.search, state.page + 1)} type="button">Next</ShadcnButton>
    </nav> : null}
  </>
  const createAndEdit = <>
    {property(props.context, 'canCreateOption', false) ? <div>
      <ShadcnInput aria-label={`Create ${props.context.definition.label ?? 'option'} label`} disabled={props.context.disabled || props.context.readOnly} onChange={event => setCreateLabel(event.currentTarget.value)} value={createLabel} />
      <ShadcnButton disabled={!createLabel.trim()} onClick={() => void optionStore.create(createLabel).then(async (option) => {
        const next = multiple ? [...values, option.value] : option.value
        setCreateLabel('')
        updateField(props, next)
        await optionStore.hydrateSelected(multiple ? next as readonly OptionValue[] : [option.value])
      })} type="button">Create option</ShadcnButton>
    </div> : null}
    {property(props.context, 'canEditOption', false) ? <div>
      <ShadcnInput aria-label={`Edit ${props.context.definition.label ?? 'option'} label`} disabled={props.context.disabled || props.context.readOnly || values.length !== 1} onChange={event => setEditLabel(event.currentTarget.value)} value={editLabel} />
      <ShadcnButton disabled={!editLabel.trim() || values.length !== 1} onClick={() => {
        const value = values[0]
        if (typeof value === 'undefined') return
        void optionStore.edit(value, editLabel).then(async () => {
          setEditLabel('')
          await optionStore.hydrateSelected([value])
        })
      }} type="button">Edit option</ShadcnButton>
    </div> : null}
  </>
  if (props.context.definition.type === 'checkbox-list' || props.context.definition.type === 'toggle-buttons') {
    return <fieldset className="hp-field" data-field-path={props.context.definition.path} disabled={props.context.disabled || state.disabled}>
      {props.context.definition.label ? <legend>{props.context.definition.label}</legend> : null}
      {options.map(option => <label key={String(option.value)}><ShadcnInput
        checked={values.includes(option.value)}
        disabled={option.disabled || props.context.readOnly}
        name={props.context.definition.path}
        onChange={event => updateField(props, event.currentTarget.checked
          ? multiple ? [...values, option.value] : option.value
          : multiple ? values.filter(value => value !== option.value) : null)}
        type={multiple ? 'checkbox' : 'radio'}
      />{option.label}</label>)}
      {searchAndPaging}
      {createAndEdit}
    </fieldset>
  }
  return <div><FieldFrame context={props.context}><ShadcnSelect
      disabled={props.context.disabled || props.context.readOnly || state.disabled}
      multiple={multiple}
      onChange={event => updateField(props, multiple
        ? [...event.currentTarget.selectedOptions].map(option => optionValue(option.value, options))
        : optionValue(event.currentTarget.value, options))}
      value={multiple ? values.map(String) : String(values[0] ?? '')}
    >
      {!multiple ? <option value="">{state.loading ? 'Loading…' : 'Select an option'}</option> : null}
      {options.map(option => <option disabled={option.disabled} key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
    </ShadcnSelect></FieldFrame>{searchAndPaging}{createAndEdit}</div>
}
