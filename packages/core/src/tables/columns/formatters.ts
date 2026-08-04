import type { JsonObject, JsonValue } from '../../protocol/json'
import type { TextFormatter } from './types'

function finiteNumber(value: unknown): number | null {
  const converted = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(converted) ? converted : null
}

function validDate(value: unknown): Date | null {
  const converted = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(converted.getTime()) ? null : converted
}

function formatterOptions(formatter: TextFormatter): JsonObject {
  const options = formatter.options
  return options && typeof options === 'object' && !Array.isArray(options) ? options : {}
}

function safeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function relativeTime(date: Date, now: Date, locale: string): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const divisions = [
    { amount: 31_536_000, unit: 'year' },
    { amount: 2_592_000, unit: 'month' },
    { amount: 86_400, unit: 'day' },
    { amount: 3_600, unit: 'hour' },
    { amount: 60, unit: 'minute' },
  ] as const
  const division = divisions.find(item => Math.abs(seconds) >= item.amount)
  const amount = division ? Math.round(seconds / division.amount) : seconds
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, division?.unit ?? 'second')
}

export function formatTextValue(
  input: JsonValue | Date | readonly JsonValue[],
  formatters: readonly TextFormatter[],
  options: { readonly locale?: string, readonly now?: Date } = {},
): string {
  const locale = options.locale ?? 'en'
  let value = Array.isArray(input) ? input.map(item => String(item)) : input
  for (const formatter of formatters) {
    if (formatter.kind === 'list' && Array.isArray(value)) {
      value = value.join(typeof formatter.separator === 'string' ? formatter.separator : ', ')
    } else if (formatter.kind === 'date' || formatter.kind === 'time' || formatter.kind === 'date-time') {
      const date = validDate(value)
      if (date) {
        const defaults: Intl.DateTimeFormatOptions = formatter.kind === 'date'
          ? { dateStyle: 'medium' }
          : formatter.kind === 'time'
            ? { timeStyle: 'short' }
            : { dateStyle: 'medium', timeStyle: 'short' }
        value = new Intl.DateTimeFormat(locale, { ...defaults, ...formatterOptions(formatter) }).format(date)
      }
    } else if (formatter.kind === 'relative-time') {
      const date = validDate(value)
      if (date) value = relativeTime(date, options.now ?? new Date(), locale)
    } else if (formatter.kind === 'number' || formatter.kind === 'money') {
      const number = finiteNumber(value)
      if (number !== null) {
        const numberOptions = formatterOptions(formatter)
        const style = formatter.kind === 'money' ? { currency: String(formatter.currency), style: 'currency' as const } : {}
        value = new Intl.NumberFormat(locale, { ...numberOptions, ...style }).format(number)
      }
    } else if (formatter.kind === 'words') {
      const count = Number(formatter.count)
      value = String(value).trim().split(/\s+/u).slice(0, count).join(' ')
    } else if (formatter.kind === 'limit') {
      const characters = Number(formatter.characters)
      const text = String(value)
      value = text.length > characters ? `${text.slice(0, characters)}…` : text
    } else if (formatter.kind === 'markdown') {
      value = safeMarkdown(String(value))
    } else if (formatter.kind === 'prefix') {
      value = `${String(formatter.value ?? '')}${String(value)}`
    } else if (formatter.kind === 'suffix') {
      value = `${String(value)}${String(formatter.value ?? '')}`
    }
  }
  return Array.isArray(value) ? value.join(', ') : String(value ?? '')
}
