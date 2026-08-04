import { copyableEntryText, safeExternalUrl, type JsonValue } from '@holo-js/panels-client'

export function entryText(value: JsonValue): string {
  return copyableEntryText(value)
}

export function entryRendererName(type: string): string {
  return `entry.${type.replaceAll(':', '.')}`
}

export function safeEntryUrl(value: string | null): string | null {
  return safeExternalUrl(value)
}

export function colorValue(value: JsonValue): string | null {
  return typeof value === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/iu.test(value) ? value : null
}
