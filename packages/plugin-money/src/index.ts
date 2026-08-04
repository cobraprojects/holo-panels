import {
  componentDefault,
  createExtensionTypeId,
  customField,
  definePanelPlugin,
  type BoundFormField,
  type ColumnFactory,
  type CustomColumn,
  type CustomFieldBuilder,
  type ExtensionTypeId,
  type FormFieldPathFor,
  type JsonObject,
  type PanelPlugin,
  type RecordPathFor,
} from '@holo-js/panels-core'

const currencyFieldType = createExtensionTypeId('holo.money', 'field', 'currency')
const moneyColumnType = createExtensionTypeId('holo.money', 'column', 'money')

export interface CurrencyFieldProperties extends JsonObject {
  readonly currency: string
  readonly minorUnits: number
}

export interface MoneyColumnProperties extends JsonObject {
  readonly currency: string
  readonly locale: string | null
}

function labelAmount(builder: object): object {
  const label = Reflect.get(builder, 'label')
  if (typeof label !== 'function') throw new TypeError('Money defaults require a label-capable builder')
  const result: unknown = Reflect.apply(label, builder, ['Amount'])
  if (typeof result !== 'object' || result === null) throw new TypeError('Money defaults require label() to return the builder')
  return result
}

function normalizeCurrency(currency: string): { readonly currency: string, readonly minorUnits: number } {
  const normalized = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/u.test(normalized)) throw new Error('Money currencies require a three-letter ISO 4217 code')
  let minorUnits: number
  try {
    minorUnits = new Intl.NumberFormat('en', { currency: normalized, style: 'currency' }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    throw new Error(`Unsupported money currency ${normalized}`)
  }
  return Object.freeze({ currency: normalized, minorUnits })
}

export function currencyField<TValues, TPath extends FormFieldPathFor<TValues, number>>(
  binding: BoundFormField<TValues, TPath>,
  currency: string,
): CustomFieldBuilder<TValues, TPath, number, ExtensionTypeId<'field'>, CurrencyFieldProperties> {
  const properties = normalizeCurrency(currency)
  return customField(binding, currencyFieldType, {
    codec: {
      decode(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Currency fields decode finite numbers only')
        return value
      },
      encode(value) {
        if (!Number.isFinite(value)) throw new TypeError('Currency fields encode finite numbers only')
        return value
      },
    },
    properties,
  })
}

export function moneyColumn<TRecord, const TPath extends RecordPathFor<TRecord, number>>(
  columns: ColumnFactory<TRecord>,
  path: TPath,
  currency: string,
): CustomColumn<TRecord, TPath, ExtensionTypeId<'column'>> {
  const properties: MoneyColumnProperties = { currency: normalizeCurrency(currency).currency, locale: null }
  return columns.custom(moneyColumnType, path, properties)
}

const compatibility = Object.freeze({
  panels: Object.freeze({ minimum: '0.0.0' }),
  protocol: Object.freeze({ maximumExclusive: '2.0', minimum: '1.0' }),
})

export const moneyPlugin: PanelPlugin<unknown> = definePanelPlugin({
  compatibility,
  id: 'holo.money',
  packageName: '@holo-js/panels-plugin-money',
})
  .extension({ compatibility, kind: 'field', pluginId: 'holo.money', typeId: currencyFieldType })
  .extension({ compatibility, kind: 'column', pluginId: 'holo.money', typeId: moneyColumnType })
  .renderer({ exportName: 'CurrencyField', framework: 'react', module: './react', typeId: currencyFieldType })
  .renderer({ exportName: 'MoneyColumn', framework: 'react', module: './react', typeId: moneyColumnType })
  .renderer({ exportName: 'CurrencyField', framework: 'vue', module: './vue', typeId: currencyFieldType })
  .renderer({ exportName: 'MoneyColumn', framework: 'vue', module: './vue', typeId: moneyColumnType })
  .renderer({ exportName: 'CurrencyField', framework: 'svelte', module: './svelte', typeId: currencyFieldType })
  .renderer({ exportName: 'MoneyColumn', framework: 'svelte', module: './svelte', typeId: moneyColumnType })
  .translation({ catalog: { amount: 'Amount', currency: 'Currency' }, locale: 'en', namespace: 'holo.money' })
  .icon({
    definition: {
      name: 'holo.money.currency',
      paths: [{ fill: 'none', path: 'M4 7h16M4 17h16M8 3v18M16 3v18', stroke: 'currentColor', strokeWidth: 2 }],
      viewBox: '0 0 24 24',
    },
    id: 'currency',
  })
  .asset({ id: 'money-style', kind: 'style', load: 'eager', source: './money.css' })
  .defaults(
    componentDefault('field', currencyFieldType, labelAmount),
    componentDefault('column', moneyColumnType, labelAmount),
  )
