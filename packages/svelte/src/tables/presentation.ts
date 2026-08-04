export type TableFormatter = Readonly<Record<string, unknown>> & { readonly kind: string }

export function tableFormatters(manifest: object): readonly TableFormatter[] {
  const value = Reflect.get(manifest, 'formatters')
  if (!Array.isArray(value)) return []
  return value.filter((item): item is TableFormatter => (
    typeof item === 'object'
    && item !== null
    && !Array.isArray(item)
    && typeof Reflect.get(item, 'kind') === 'string'
  ))
}

function formatterOptions(formatter: TableFormatter): Readonly<Record<string, unknown>> {
  const options = formatter.options
  return typeof options === 'object' && options !== null && !Array.isArray(options)
    ? options as Readonly<Record<string, unknown>>
    : {}
}

function validDate(value: unknown): Date | null {
  const converted = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(converted.getTime()) ? null : converted
}

export function formattedTableValue(input: unknown, formatters: readonly TableFormatter[]): string {
  let value: unknown = Array.isArray(input) ? input.map(item => String(item)) : input
  for (const formatter of formatters) {
    try {
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
          value = new Intl.DateTimeFormat(undefined, { ...defaults, ...formatterOptions(formatter) }).format(date)
        }
      } else if (formatter.kind === 'relative-time') {
        const date = validDate(value)
        if (date) {
          const seconds = Math.round((date.getTime() - Date.now()) / 1_000)
          const division = [
            { amount: 31_536_000, unit: 'year' },
            { amount: 2_592_000, unit: 'month' },
            { amount: 86_400, unit: 'day' },
            { amount: 3_600, unit: 'hour' },
            { amount: 60, unit: 'minute' },
          ].find(item => Math.abs(seconds) >= item.amount)
          const amount = division ? Math.round(seconds / division.amount) : seconds
          value = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(amount, division?.unit as Intl.RelativeTimeFormatUnit ?? 'second')
        }
      } else if (formatter.kind === 'number' || formatter.kind === 'money') {
        const converted = typeof value === 'number' ? value : Number(value)
        if (Number.isFinite(converted)) {
          const style = formatter.kind === 'money' ? { currency: String(formatter.currency), style: 'currency' as const } : {}
          value = new Intl.NumberFormat(undefined, { ...formatterOptions(formatter), ...style }).format(converted)
        }
      } else if (formatter.kind === 'words') {
        value = String(value).trim().split(/\s+/u).slice(0, Number(formatter.count)).join(' ')
      } else if (formatter.kind === 'limit') {
        const text = String(value)
        const characters = Number(formatter.characters)
        value = text.length > characters ? `${text.slice(0, characters)}…` : text
      } else if (formatter.kind === 'prefix') {
        value = `${String(formatter.value ?? '')}${String(value)}`
      } else if (formatter.kind === 'suffix') {
        value = `${String(value)}${String(formatter.value ?? '')}`
      }
    } catch {
      continue
    }
  }
  if (value === null || typeof value === 'undefined') return '—'
  return Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function hasUnsafeUrlCharacter(value: string): boolean {
  return [...value].some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127 || character === '\\'
  })
}

export function safeTableUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value || hasUnsafeUrlCharacter(value)) return null
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.split('/').some(segment => segment === '.' || segment === '..' || /%(?:2e|2f|5c)/iu.test(segment)) ? null : value
  }
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? value : null
  } catch {
    return null
  }
}

export function safeTableColor(value: unknown): string | null {
  return typeof value === 'string' && /^(?:#[\da-f]{3,8}|[a-z][a-z0-9-]*)$/iu.test(value) ? value : null
}

export function tableIconName(formatters: readonly TableFormatter[], active: boolean): string {
  const icon = formatters.find(formatter => formatter.kind === 'icon')?.name
  const booleanIcons = formatters.find(formatter => formatter.kind === 'boolean-icons')
  const configured = booleanIcons ? active ? booleanIcons.truthy : booleanIcons.falsy : icon
  return typeof configured === 'string' && /^[a-z][a-z0-9-]*$/u.test(configured) ? configured : active ? 'check' : 'x-mark'
}
