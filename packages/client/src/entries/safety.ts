import type { JsonObject, JsonValue } from '@holo-js/panels-core'
import type {
  EntryClientObject,
  EntryRichTextMetadata,
  EntrySafeContentBlock,
  EntrySafeContentSegment,
} from './contracts'

export function safeExternalUrl(value: string | null): string | null {
  if (value === null) return null
  const candidate = value.trim()
  const hasControlCharacter = Array.from(candidate).some(character => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
  })
  if (!candidate || candidate.includes('\\') || candidate.startsWith('//') || hasControlCharacter) return null
  const sentinel = new URL('https://holo-panels.invalid')
  let parsed: URL
  try {
    parsed = new URL(candidate, sentinel)
  } catch {
    return null
  }
  if (parsed.origin === sentinel.origin) {
    if (!candidate.startsWith('/') && !candidate.startsWith('#') && !candidate.startsWith('?')) return null
    return candidate
  }
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return null
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && (parsed.username || parsed.password)) return null
  return parsed.toString()
}

export function copyableEntryText(value: JsonValue): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function formatObjects(properties: EntryClientObject): readonly EntryClientObject[] {
  const formats = properties.formats
  if (!Array.isArray(formats)) return []
  return formats.filter((format): format is EntryClientObject => format !== null && typeof format === 'object' && !Array.isArray(format))
}

export function entryUsesMarkdown(properties: EntryClientObject): boolean {
  return formatObjects(properties).some(format => format.kind === 'markdown' && format.value !== false && format.rawHtml === false)
}

export function entryRichTextMetadata(properties: EntryClientObject): EntryRichTextMetadata | null {
  const format = formatObjects(properties).find(candidate => candidate.kind === 'rich-text')
  if (!format || typeof format.sanitizer !== 'string' || format.structured !== true) return null
  return Object.freeze({ sanitizer: format.sanitizer, structured: true })
}

function appendText(segments: EntrySafeContentSegment[], value: string): void {
  if (!value) return
  const previous = segments.at(-1)
  if (previous?.kind === 'text') {
    segments[segments.length - 1] = Object.freeze({ kind: 'text', value: previous.value + value })
    return
  }
  segments.push(Object.freeze({ kind: 'text', value }))
}

function markdownSegments(value: string): readonly EntrySafeContentSegment[] {
  const segments: EntrySafeContentSegment[] = []
  const token = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/gu
  let offset = 0
  for (const match of value.matchAll(token)) {
    const index = match.index
    appendText(segments, value.slice(offset, index))
    const syntax = match[0]
    if (syntax.startsWith('`')) segments.push(Object.freeze({ kind: 'code', value: syntax.slice(1, -1) }))
    else if (syntax.startsWith('**')) segments.push(Object.freeze({ kind: 'strong', value: syntax.slice(2, -2) }))
    else if (syntax.startsWith('*')) segments.push(Object.freeze({ kind: 'emphasis', value: syntax.slice(1, -1) }))
    else {
      const separator = syntax.lastIndexOf('](')
      const label = syntax.slice(1, separator)
      const href = safeExternalUrl(syntax.slice(separator + 2, -1))
      if (href) segments.push(Object.freeze({ href, kind: 'link', value: label }))
      else appendText(segments, label)
    }
    offset = index + syntax.length
  }
  appendText(segments, value.slice(offset))
  return Object.freeze(segments)
}

export function safeMarkdownBlocks(value: JsonValue): readonly EntrySafeContentBlock[] {
  return Object.freeze(copyableEntryText(value).split(/\n{2,}/u).map(block => Object.freeze({
    segments: markdownSegments(block.replaceAll('\n', ' ')),
  })))
}

export function safeEntryAttributes(
  attributes: JsonObject | undefined,
): Readonly<Record<string, boolean | number | string>> {
  const safe: Record<string, boolean | number | string> = {}
  for (const [name, value] of Object.entries(attributes ?? {})) {
    const primitive = typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
    if (!primitive) continue
    if ((name === 'class' || name === 'className' || name === 'lang' || name === 'title') && typeof value === 'string') safe[name] = value
    else if (name === 'hidden' && typeof value === 'boolean') safe.hidden = value
    else if (name === 'dir' && (value === 'ltr' || value === 'rtl' || value === 'auto')) safe[name] = value
    else if (name.startsWith('aria-') || name.startsWith('data-')) safe[name] = value
  }
  return Object.freeze(safe)
}
