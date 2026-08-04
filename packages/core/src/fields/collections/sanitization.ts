import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject } from '../../protocol/json'
import type { RichTextDocument, RichTextMark, RichTextNode, RichTextSanitizer } from './types'

const NODE_TYPES = new Set(['blockquote', 'bullet-list', 'code-block', 'doc', 'hard-break', 'heading', 'list-item', 'ordered-list', 'paragraph', 'text'])
const MARK_TYPES = new Set(['bold', 'code', 'italic', 'link', 'strike', 'underline'])

function safeLink(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Rich text links require string href values')
  const href = value.trim()
  if (href.startsWith('/') || href.startsWith('#')) return href
  const parsed = new URL(href)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Rich text links require relative or credential-free HTTPS URLs')
  return parsed.href
}

function sanitizeAttributes(type: string, attrs: JsonObject): JsonObject {
  if (type === 'link') return { href: safeLink(attrs.href) }
  if (type === 'heading') {
    const level = attrs.level
    if (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1 || level > 6) throw new Error('Rich text heading levels must be integers from 1 to 6')
    return { level }
  }
  if (Object.keys(attrs).length > 0) throw new Error(`Rich text ${type} attributes are not allowed`)
  return {}
}

function sanitizeMark(mark: RichTextMark): RichTextMark {
  if (!MARK_TYPES.has(mark.type)) throw new Error(`Unsupported rich text mark: ${String(mark.type)}`)
  return Object.freeze({ attrs: sanitizeAttributes(mark.type, mark.attrs), type: mark.type })
}

function sanitizeNode(node: RichTextNode): RichTextNode {
  if (!NODE_TYPES.has(node.type)) throw new Error(`Unsupported rich text node: ${String(node.type)}`)
  if (node.type === 'text' && typeof node.text !== 'string') throw new Error('Rich text text nodes require text')
  if (node.type !== 'text' && node.text !== null) throw new Error(`Rich text ${node.type} nodes cannot contain direct text`)
  const content = node.type === 'text' || node.type === 'hard-break'
    ? []
    : node.content.map(sanitizeNode)
  const marks = node.type === 'text' ? node.marks.map(sanitizeMark) : []
  return Object.freeze({
    attrs: sanitizeAttributes(node.type, node.attrs),
    content,
    marks,
    text: node.type === 'text' ? node.text : null,
    type: node.type,
  })
}

export const structuralRichTextSanitizer: RichTextSanitizer = Object.freeze({
  sanitize(document: RichTextDocument): RichTextDocument {
    const sanitized = sanitizeNode(document)
    if (sanitized.type !== 'doc') throw new Error('Rich text documents require a doc root')
    return sanitized as RichTextDocument
  },
})

export function serializeMarkdown(value: string): string {
  return value
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\0', '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function serializeRichText(document: RichTextDocument, sanitizer: RichTextSanitizer): string {
  return JSON.stringify(toJsonValue(sanitizer.sanitize(document)))
}

export function deserializeRichText(value: string, sanitizer: RichTextSanitizer): RichTextDocument {
  const parsed: unknown = JSON.parse(value)
  const serialized = toJsonValue(parsed)
  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object' || serialized.type !== 'doc') {
    throw new Error('Serialized rich text requires a document object')
  }
  return sanitizer.sanitize(serialized as RichTextDocument)
}
