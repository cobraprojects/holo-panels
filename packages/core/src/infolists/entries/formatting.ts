import { toJsonValue } from '../../protocol/serialization'
import type { JsonValue } from '../../protocol/json'
import type { EntryFormat } from './types'

function text(value: JsonValue): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function formatEntryState(value: unknown, formatters: readonly EntryFormat[], locale = 'en'): JsonValue {
  let formatted = toJsonValue(value)
  for (const formatter of formatters) {
    if (formatter.kind === 'prefix') formatted = `${String(formatter.value ?? '')}${text(formatted)}`
    if (formatter.kind === 'suffix') formatted = `${text(formatted)}${String(formatter.value ?? '')}`
    if (formatter.kind === 'limit') formatted = text(formatted).slice(0, Number(formatter.characters))
    if (formatter.kind === 'list' && Array.isArray(formatted)) formatted = formatted.map(text).join(String(formatter.separator ?? ', '))
    if (formatter.kind === 'number' && typeof formatted === 'number') {
      formatted = new Intl.NumberFormat(locale, formatter.options as Intl.NumberFormatOptions).format(formatted)
    }
    if (formatter.kind === 'date' && (typeof formatted === 'number' || typeof formatted === 'string')) {
      const timestamp = new Date(formatted)
      formatted = Number.isNaN(timestamp.getTime())
        ? ''
        : new Intl.DateTimeFormat(locale, formatter.options as Intl.DateTimeFormatOptions).format(timestamp)
    }
    if (formatter.kind === 'markdown' && formatter.value !== false) {
      formatted = text(formatted)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
    }
  }
  return formatted
}

export function copyableEntryText(value: JsonValue): string {
  return text(value)
}
