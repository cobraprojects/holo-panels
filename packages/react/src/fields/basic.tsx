import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ShadcnButton, ShadcnInput, ShadcnTextarea } from '../internal-ui'
import { FieldFrame, property, touchField, updateField } from './shared'
import type { ReactFieldControlProps } from './types'

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function stringProperty<TValues extends object>(props: ReactFieldControlProps<TValues>, name: string): string | null {
  const value = props.context.definition.properties[name]
  return typeof value === 'string' ? value : null
}

export function ReactBasicField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const { context } = props
  const [passwordVisible, setPasswordVisible] = useState(false)
  const common = {
    disabled: context.disabled,
    onBlur: () => touchField(props),
    placeholder: context.definition.placeholder ?? undefined,
    readOnly: context.readOnly,
  }
  if (context.definition.type === 'hidden') {
    return <ShadcnInput data-slot="input" name={context.definition.path} type="hidden" value={textValue(context.value)} />
  }
  if (context.definition.type === 'textarea') {
    return <FieldFrame context={context}><ShadcnTextarea
      {...common}
      data-autosize={property(context, 'autosize', false) || undefined}
      data-slot="textarea"
      maxLength={property(context, 'maximumLength', undefined as number | undefined)}
      onChange={event => updateField(props, event.currentTarget.value)}
      onInput={property(context, 'autosize', false) ? (event: FormEvent<HTMLTextAreaElement>) => {
        event.currentTarget.style.height = 'auto'
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
      } : undefined}
      rows={property(context, 'rows', 4)}
      value={textValue(context.value)}
    /></FieldFrame>
  }
  if (context.definition.type === 'checkbox' || context.definition.type === 'toggle') {
    const stateLabel = context.value === true
      ? stringProperty(props, 'onLabel')
      : stringProperty(props, 'offLabel')
    return <FieldFrame after={stateLabel ? <span className="hp-field-toggle-label">{stateLabel}</span> : null} context={context}><ShadcnInput
      checked={context.value === true}
      data-slot={context.definition.type === 'toggle' ? 'switch' : 'checkbox'}
      disabled={context.disabled}
      onBlur={common.onBlur}
      onChange={event => updateField(props, event.currentTarget.checked)}
      readOnly={context.readOnly}
      role={context.definition.type === 'toggle' ? 'switch' : undefined}
      type="checkbox"
    /></FieldFrame>
  }
  if (context.definition.type === 'radio') {
    const options: readonly unknown[] = Array.isArray(context.definition.properties.options) ? context.definition.properties.options : []
    return <fieldset className="hp-field" data-field-path={context.definition.path} data-field-type="radio" disabled={context.disabled}>
      {context.definition.label ? <legend>{context.definition.label}</legend> : null}
      {options.map((option: unknown, index: number) => {
        if (typeof option !== 'object' || option === null || Array.isArray(option)) return null
        const value: unknown = Reflect.get(option, 'value')
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null
        const id = `${context.inputId}-${index}`
        return <label htmlFor={id} key={String(value)}><ShadcnInput
          checked={context.value === value}
          data-slot="radio-group-item"
          disabled={context.disabled || Reflect.get(option, 'disabled') === true}
          id={id}
          name={context.definition.path}
          onChange={() => updateField(props, value)}
          readOnly={context.readOnly}
          type="radio"
        />{typeof Reflect.get(option, 'label') === 'string' ? String(Reflect.get(option, 'label')) : String(value)}</label>
      })}
    </fieldset>
  }
  const dateMode = property(context, 'mode', 'date' as string)
  const textMode = property(context, 'inputMode', 'text' as string)
  const revealable = textMode === 'password' && property(context, 'revealable', false)
  const inputType = context.definition.type === 'color'
    ? 'color'
    : context.definition.type === 'date'
      ? dateMode === 'date-time' ? 'datetime-local' : dateMode
      : context.definition.type === 'slider'
        ? 'range'
        : textMode === 'password' ? passwordVisible ? 'text' : 'password' : textMode
  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.currentTarget.value
    updateField(props, context.definition.type === 'slider' || typeof context.value === 'number' ? Number(raw) : raw)
  }
  const prefix = stringProperty(props, 'prefix')
  const suffix = stringProperty(props, 'suffix')
  const datalistProperty = context.definition.properties.datalist
  const datalist = Array.isArray(datalistProperty)
    ? datalistProperty.filter((value): value is string => typeof value === 'string')
    : []
  const datalistId = datalist.length > 0 ? `${context.inputId}-list` : undefined
  const after = <>
    {suffix ? <span className="hp-field-suffix">{suffix}</span> : null}
    {revealable ? <ShadcnButton
      aria-controls={context.inputId}
      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
      onClick={() => setPasswordVisible(value => !value)}
      type="button"
    >{passwordVisible ? 'Hide' : 'Show'}</ShadcnButton> : null}
    {datalistId ? <datalist id={datalistId}>{datalist.map(option => <option key={option} value={option} />)}</datalist> : null}
  </>
  return <FieldFrame after={after} before={prefix ? <span className="hp-field-prefix">{prefix}</span> : null} context={context}><ShadcnInput
    {...common}
    autoComplete={property(context, 'autocomplete', undefined as string | undefined)}
    data-mask={stringProperty(props, 'mask') ?? undefined}
    data-slot={context.definition.type === 'slider' ? 'slider' : 'input'}
    list={datalistId}
    max={property(context, 'maximum', undefined as number | string | undefined)}
    maxLength={property(context, 'maximumLength', undefined as number | undefined)}
    min={property(context, 'minimum', undefined as number | string | undefined)}
    minLength={property(context, 'minimumLength', undefined as number | undefined)}
    onChange={change}
    step={property(context, 'step', undefined as number | undefined)}
    type={inputType}
    value={textValue(context.value)}
  /></FieldFrame>
}
