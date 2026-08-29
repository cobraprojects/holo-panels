import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Checkbox, Input, Textarea } from '../internal-ui'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, RadioGroup, RadioGroupItem, Switch } from '../ui'
import { actionButton, FieldFrame, property, touchField, updateField } from './shared'
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
    return <Input data-slot="input" name={context.definition.path} type="hidden" value={textValue(context.value)} />
  }
  if (context.definition.type === 'textarea') {
    return <FieldFrame context={context}><Textarea
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
    const Toggle = context.definition.type === 'toggle' ? Switch : Checkbox
    return <FieldFrame after={stateLabel ? <span className="hp-field-toggle-label">{stateLabel}</span> : null} context={context}><Toggle
      checked={context.value === true}
      disabled={context.disabled || context.readOnly}
      onBlur={common.onBlur}
      onCheckedChange={checked => updateField(props, checked === true)}
    /></FieldFrame>
  }
  if (context.definition.type === 'radio') {
    const options: readonly unknown[] = Array.isArray(context.definition.properties.options) ? context.definition.properties.options : []
    return <fieldset aria-describedby={context.errors.length ? `${context.inputId}-errors` : undefined} aria-invalid={context.errors.length > 0 || undefined} className="hp-field hp:grid hp:gap-2 hp:border-0 hp:p-0" data-field-path={context.definition.path} data-field-type="radio" disabled={context.disabled || context.readOnly}>
      {context.definition.label ? <legend className="hp:text-sm hp:font-medium">{context.definition.label}</legend> : null}
      <RadioGroup className="hp:grid hp:gap-3" disabled={context.disabled || context.readOnly} onValueChange={selected => {
        const option = options.find(candidate => typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) && String(Reflect.get(candidate, 'value')) === selected)
        if (!option || typeof option !== 'object' || Array.isArray(option)) return
        const value = Reflect.get(option, 'value')
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') updateField(props, value)
      }} value={String(context.value ?? '')}>{options.map((option: unknown, index: number) => {
        if (typeof option !== 'object' || option === null || Array.isArray(option)) return null
        const value: unknown = Reflect.get(option, 'value')
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null
        const id = `${context.inputId}-${index}`
        return <label className="hp:flex hp:items-center hp:gap-2 hp:text-sm" htmlFor={id} key={String(value)}><RadioGroupItem
          disabled={context.disabled || Reflect.get(option, 'disabled') === true}
          id={id}
          value={String(value)}
        />{typeof Reflect.get(option, 'label') === 'string' ? String(Reflect.get(option, 'label')) : String(value)}</label>
      })}</RadioGroup>
      {context.errors.length ? <ul id={`${context.inputId}-errors`} role="alert">{context.errors.map((message, index) => <li key={index}>{message}</li>)}</ul> : null}
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
  const prefixAction = actionButton(context.definition.properties.prefixAction, context.executeAction, context.actionPending)
  const suffixAction = actionButton(context.definition.properties.suffixAction, context.executeAction, context.actionPending)
  const datalistProperty = context.definition.properties.datalist
  const datalist = Array.isArray(datalistProperty)
    ? datalistProperty.filter((value): value is string => typeof value === 'string')
    : []
  const datalistId = datalist.length > 0 ? `${context.inputId}-list` : undefined
  const inputProps = {
    ...common,
    autoComplete: property(context, 'autocomplete', undefined as string | undefined),
    'data-mask': stringProperty(props, 'mask') ?? undefined,
    list: datalistId,
    max: property(context, 'maximum', undefined as number | string | undefined),
    maxLength: property(context, 'maximumLength', undefined as number | undefined),
    min: property(context, 'minimum', undefined as number | string | undefined),
    minLength: property(context, 'minimumLength', undefined as number | undefined),
    onChange: change,
    step: property(context, 'step', undefined as number | undefined),
    type: inputType,
    value: textValue(context.value),
  }
  return <FieldFrame context={context}>{controlProperties => <>
    {prefix || suffix || prefixAction || suffixAction || revealable
      ? <InputGroup>
          {prefix || prefixAction ? <InputGroupAddon align="inline-start">{prefix ? <InputGroupText className="hp-field-prefix">{prefix}</InputGroupText> : null}{prefixAction}</InputGroupAddon> : null}
          <InputGroupInput {...inputProps} {...controlProperties} />
          {suffix || suffixAction || revealable ? <InputGroupAddon align="inline-end">
            {suffix ? <InputGroupText className="hp-field-suffix">{suffix}</InputGroupText> : null}
            {suffixAction}
            {revealable ? <InputGroupButton aria-controls={context.inputId} aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible(value => !value)}>{passwordVisible ? 'Hide' : 'Show'}</InputGroupButton> : null}
          </InputGroupAddon> : null}
        </InputGroup>
      : <Input {...inputProps} {...controlProperties} data-slot={context.definition.type === 'slider' ? 'slider' : 'input'} />}
    {datalistId ? <datalist id={datalistId}>{datalist.map(option => <option key={option} value={option} />)}</datalist> : null}
  </>}</FieldFrame>
}
