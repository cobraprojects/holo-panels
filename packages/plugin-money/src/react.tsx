import type { ReactFieldControlProps } from '@holo-js/panels-react'
import type { ChangeEvent, ReactNode } from 'react'

function currency(properties: Readonly<Record<string, unknown>>): string {
  return typeof properties.currency === 'string' ? properties.currency : 'USD'
}

function value(input: unknown): string {
  return typeof input === 'number' && Number.isFinite(input) ? String(input) : ''
}

export function CurrencyField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const update = (event: ChangeEvent<HTMLInputElement>): void => {
    const value: unknown = Reflect.get(event.target, 'value')
    if (typeof value === 'string') props.store.batch([{ kind: 'set', path: props.context.definition.path, value: Number(value), touch: true }])
  }
  return <label className="hp-money-field" htmlFor={props.context.inputId}>
    <span>{props.context.definition.label ?? currency(props.context.definition.properties)}</span>
    <input
      aria-invalid={props.context.errors.length > 0 || undefined}
      disabled={props.context.disabled}
      id={props.context.inputId}
      inputMode="decimal"
      onChange={update}
      readOnly={props.context.readOnly}
      step={10 ** -Number(props.context.definition.properties.minorUnits ?? 2)}
      type="number"
      value={value(props.context.value)}
    />
    <span>{currency(props.context.definition.properties)}</span>
  </label>
}

export function MoneyColumn(props: { readonly currency: string, readonly locale?: string | null, readonly value: number }): ReactNode {
  return <span className="hp-money-column">{new Intl.NumberFormat(props.locale ?? undefined, { currency: props.currency, style: 'currency' }).format(props.value)}</span>
}
