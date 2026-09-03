import { usePanelTranslator } from '../localization'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, Input, NativeSelect } from '../internal-ui'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui'
import { Search } from 'lucide-react'
import { FieldFrame, property, requireStore, touchField, updateField, useStoreState } from './shared'
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
  const translate = usePanelTranslator()
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
    {property(props.context, 'searchable', false) ? <InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput
      aria-label={translate('fields.searchOptions', { label: props.context.definition.label ?? translate('fields.options') })}
      disabled={props.context.disabled || state.disabled}
      onChange={event => void optionStore.load(event.currentTarget.value, 1)}
      type="search"
      value={state.search}
    /></InputGroup> : null}
    {property(props.context, 'paginated', true) && (state.page > 1 || state.hasMore) ? <nav aria-label={translate('fields.optionPages', { label: props.context.definition.label ?? translate('fields.option') })}>
      <Button disabled={state.page <= 1 || state.loading} onClick={() => void optionStore.load(state.search, state.page - 1)} type="button">{translate('pagination.previous')}</Button>
      <span aria-live="polite">{translate('tables.page', { page: state.page })}</span>
      <Button disabled={!state.hasMore || state.loading} onClick={() => void optionStore.load(state.search, state.page + 1)} type="button">{translate('pagination.next')}</Button>
    </nav> : null}
  </>
  const createAndEdit = <>
    {property(props.context, 'canCreateOption', false) ? <div>
      <Input aria-label={translate('fields.createOptionLabel', { label: props.context.definition.label ?? translate('fields.option') })} disabled={props.context.disabled || props.context.readOnly} onChange={event => setCreateLabel(event.currentTarget.value)} value={createLabel} />
      <Button disabled={!createLabel.trim()} onClick={() => void optionStore.create(createLabel).then(async (option) => {
        const next = multiple ? [...values, option.value] : option.value
        setCreateLabel('')
        updateField(props, next)
        await optionStore.hydrateSelected(multiple ? next as readonly OptionValue[] : [option.value])
      })} type="button">{translate('fields.createOption')}</Button>
    </div> : null}
    {property(props.context, 'canEditOption', false) ? <div>
      <Input aria-label={translate('fields.editOptionLabel', { label: props.context.definition.label ?? translate('fields.option') })} disabled={props.context.disabled || props.context.readOnly || values.length !== 1} onChange={event => setEditLabel(event.currentTarget.value)} value={editLabel} />
      <Button disabled={!editLabel.trim() || values.length !== 1} onClick={() => {
        const value = values[0]
        if (typeof value === 'undefined') return
        void optionStore.edit(value, editLabel).then(async () => {
          setEditLabel('')
          await optionStore.hydrateSelected([value])
        })
      }} type="button">{translate('fields.editOption')}</Button>
    </div> : null}
  </>
  if (props.context.definition.type === 'checkbox-list' || props.context.definition.type === 'toggle-buttons') {
    return <fieldset className="hp-field" data-field-path={props.context.definition.path} disabled={props.context.disabled || state.disabled} onBlur={() => touchField(props)}>
      {props.context.definition.label ? <legend>{props.context.definition.label}</legend> : null}
      {options.map(option => <label key={String(option.value)}><Input
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
      {props.context.errors.length ? <ul role="alert">{props.context.errors.map((message, index) => <li key={index}>{message}</li>)}</ul> : null}
    </fieldset>
  }
  return <div><FieldFrame context={props.context}><NativeSelect
      disabled={props.context.disabled || props.context.readOnly || state.disabled}
      multiple={multiple}
      onBlur={() => touchField(props)}
      onChange={event => updateField(props, multiple
        ? [...event.currentTarget.selectedOptions].map(option => optionValue(option.value, options))
        : optionValue(event.currentTarget.value, options))}
      value={multiple ? values.map(String) : String(values[0] ?? '')}
    >
      {!multiple ? <option value="">{state.loading ? translate('fields.loading') : translate('fields.selectOption')}</option> : null}
      {options.map(option => <option disabled={option.disabled} key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
    </NativeSelect></FieldFrame>{searchAndPaging}{createAndEdit}</div>
}
