import { copyableEntryText, safeExternalUrl, type JsonValue } from '@holo-js/panels-client'
import type { SvelteEntrySnapshot } from './contracts'

export function entryText(value: JsonValue): string {
  return copyableEntryText(value)
}

export function safeEntryUrl(value: string | null): string | null {
  return safeExternalUrl(value)
}

export function colorValue(value: JsonValue): string | null {
  return typeof value === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/iu.test(value) ? value : null
}

export function objectEntries(value: JsonValue): readonly (readonly [string, JsonValue])[] {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : []
}

export function valueList(value: JsonValue): readonly JsonValue[] {
  return Array.isArray(value) ? value : []
}

export function entryLayoutStyle(entry: SvelteEntrySnapshot): string {
  const declarations: string[] = []
  for (const breakpoint of ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const) {
    const span = entry.layout?.columnSpan?.[breakpoint]
    const start = span === 'full' ? 1 : entry.layout?.columnStart?.[breakpoint]
    if (start !== undefined) declarations.push(`--hp-schema-column-start-${breakpoint}:${start}`)
    if (span !== undefined) declarations.push(`--hp-schema-column-end-${breakpoint}:${span === 'full' ? -1 : `span ${span}`}`)
    const order = entry.layout?.order?.[breakpoint]
    if (order !== undefined) declarations.push(`--hp-schema-order-${breakpoint}:${order}`)
  }
  return declarations.join(';')
}
