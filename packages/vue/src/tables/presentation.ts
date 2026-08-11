import { ShadcnButton, ShadcnInput } from '../internal-ui'
import { rendererRegistryName, type ExtensionTypeId } from '@holo-js/panels-client'
import type { FormPath, FormValueAtPath } from '@holo-js/panels-client'
import { defineComponent, h, ref, type PropType, type VNode, type VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'
import type { VueCustomColumnProps, VueTableColumn } from './types'

type RuntimeRecord = Readonly<Record<string, unknown>>
type Formatter = Readonly<Record<string, unknown>> & { readonly kind: string }

function formatterList(manifest: object): readonly Formatter[] {
  const value = Reflect.get(manifest, 'formatters')
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Formatter => (
    typeof item === 'object'
    && item !== null
    && !Array.isArray(item)
    && typeof Reflect.get(item, 'kind') === 'string'
  ))
}

function formatterOptions(formatter: Formatter): Readonly<Record<string, unknown>> {
  const options = formatter.options
  return typeof options === 'object' && options !== null && !Array.isArray(options)
    ? options as Readonly<Record<string, unknown>>
    : {}
}

function finiteNumber(value: unknown): number | null {
  const converted = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(converted) ? converted : null
}

function validDate(value: unknown): Date | null {
  const converted = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(converted.getTime()) ? null : converted
}

function formattedValue(input: unknown, formatters: readonly Formatter[]): string {
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
        const number = finiteNumber(value)
        if (number !== null) {
          const style = formatter.kind === 'money' ? { currency: String(formatter.currency), style: 'currency' as const } : {}
          value = new Intl.NumberFormat(undefined, { ...formatterOptions(formatter), ...style }).format(number)
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

function safeUrl(value: unknown): string | null {
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

function safeColor(value: unknown): string | null {
  return typeof value === 'string' && /^(?:#[\da-f]{3,8}|[a-z][a-z0-9-]*)$/iu.test(value) ? value : null
}

function iconName(formatters: readonly Formatter[], active: boolean): string {
  const icon = formatters.find(formatter => formatter.kind === 'icon')?.name
  const booleanIcons = formatters.find(formatter => formatter.kind === 'boolean-icons')
  const configured = booleanIcons ? active ? booleanIcons.truthy : booleanIcons.falsy : icon
  return typeof configured === 'string' && /^[a-z][a-z0-9-]*$/u.test(configured) ? configured : active ? 'check' : 'x-mark'
}

export const VueTableColumnPresentation = defineComponent({
  name: 'VueTableColumnPresentation',
  props: {
    presentation: { type: Object as PropType<{
      readonly column: VueTableColumn<Record<string, unknown>>
      readonly panelId?: string
      readonly record: RuntimeRecord
      readonly registry?: ComponentRegistry
      readonly value: unknown
    }>, required: true },
  },
  setup(componentProps) {
    const copyStatus = ref('')
    return (): VNode => {
      const { column, panelId, record, registry, value } = componentProps.presentation
      const inferredValue = value as FormValueAtPath<RuntimeRecord, FormPath<RuntimeRecord>>
      if (column.render) return h('span', [column.render(inferredValue, record)])
      const formatters = formatterList(column.manifest)
      const formatted = formattedValue(value, formatters)
      const type = column.manifest.type
      const tooltip = formatters.find(formatter => formatter.kind === 'tooltip')?.value
      const url = safeUrl(column.url?.(record)) ?? safeUrl(formatters.find(formatter => formatter.kind === 'url')?.value)
      const badge = type === 'badge' || formatters.some(formatter => formatter.kind === 'badge' && formatter.value !== false)
      const lineClamp = Reflect.get(column.manifest, 'lineClamp')
      const contentStyle = Number.isSafeInteger(lineClamp) && Number(lineClamp) > 0
        ? { WebkitBoxOrient: 'vertical', WebkitLineClamp: Number(lineClamp), display: '-webkit-box', overflow: 'hidden' }
        : undefined
      let content: VNodeChild
      if (type.includes(':column:')) {
        if (!registry) throw new Error(`[Holo Panels] A Vue component registry is required for custom column "${type}".`)
        const renderer = registry.resolve(
          rendererRegistryName('column', type as ExtensionTypeId<'column'>),
          panelId,
          `column "${column.manifest.path}"`,
        )
        const configuration = formatters.find(formatter => formatter.kind === 'custom')?.configuration
        const properties = configuration !== null && typeof configuration === 'object' && !Array.isArray(configuration) ? configuration : {}
        content = h(renderer, { ...properties, column, record, value: inferredValue } satisfies VueCustomColumnProps<RuntimeRecord>)
      } else if (type === 'boolean' || type === 'icon') {
        const active = Boolean(value)
        content = h('span', { 'aria-label': active ? 'Yes' : 'No', 'data-icon': iconName(formatters, active), role: 'img' }, active ? '✓' : '✕')
      } else if (type === 'image') {
        const source = safeUrl(value)
        const size = formatters.find(formatter => formatter.kind === 'size')?.pixels
        const pixels = Number.isSafeInteger(size) && Number(size) > 0 && Number(size) <= 2_048 ? Number(size) : undefined
        const circular = formatters.some(formatter => formatter.kind === 'circular' && formatter.value !== false)
        content = source
          ? h('img', { alt: column.manifest.label ?? '', height: pixels, loading: 'lazy', src: source, style: circular ? { borderRadius: '9999px' } : undefined, width: pixels })
          : '—'
      } else if (type === 'color') {
        const color = safeColor(value)
        content = color ? h('span', [h('span', { 'aria-hidden': 'true', class: 'hp-table-color', style: { backgroundColor: color } }), color]) : formatted
      } else if ((type === 'checkbox' || type === 'toggle') && !column.manifest.inlineEditor) {
        content = h(ShadcnInput, { 'aria-label': column.manifest.label ?? column.manifest.path, checked: value === true, disabled: true, readonly: true, type: 'checkbox' })
      } else {
        const text = h('span', { style: contentStyle }, formatted)
        content = badge ? h('span', { class: 'hp-table-badge' }, [text]) : text
      }
      const linked = url ? h('a', { href: url, rel: url.startsWith('/') ? undefined : 'noopener noreferrer' }, [content]) : content
      const copy = async (): Promise<void> => {
        try {
          await globalThis.navigator?.clipboard?.writeText(formatted)
          copyStatus.value = 'Copied'
        } catch {
          copyStatus.value = 'Copy failed'
        }
      }
      return h('span', { title: typeof tooltip === 'string' ? tooltip : undefined }, [
        linked,
        column.manifest.copyable && !column.manifest.inlineEditor
          ? h(ShadcnButton, { 'aria-label': `Copy ${column.manifest.label ?? column.manifest.path}`, type: 'button', onClick: () => void copy() }, 'Copy')
          : null,
        h('span', { 'aria-live': 'polite', class: 'hp-visually-hidden' }, copyStatus.value),
      ])
    }
  },
})
