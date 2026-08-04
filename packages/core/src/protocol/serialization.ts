import type { JsonValue } from './json'

const UNSAFE_URL_PATTERN = /^(?:data|file|javascript|vbscript):/i
const URL_KEYS = new Set(['href', 'url'])

export class ManifestSerializationError extends TypeError {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`Manifest value at ${path} is not JSON-safe: ${reason}`)
    this.name = 'ManifestSerializationError'
    this.path = path
  }
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertSafeUrl(value: string, path: string): void {
  const trimmed = value.trim()

  const hasUnsafeCharacter = trimmed.includes('\\') || [...trimmed].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })

  if (UNSAFE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//') || hasUnsafeCharacter) {
    throw new ManifestSerializationError(path, 'unsafe URL')
  }

  if (!/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    return
  }

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    throw new ManifestSerializationError(path, 'invalid URL')
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ManifestSerializationError(path, 'only credential-free HTTPS URLs are allowed')
  }
}

function convertValue(value: unknown, path: string, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ManifestSerializationError(path, 'numbers must be finite')
    }

    return Object.is(value, -0) ? 0 : value
  }

  if (typeof value !== 'object') {
    throw new ManifestSerializationError(path, `${typeof value} values are unsupported`)
  }

  if (ancestors.has(value)) {
    throw new ManifestSerializationError(path, 'circular references are unsupported')
  }

  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => convertValue(item, `${path}[${index}]`, ancestors))
    }

    if (!isPlainObject(value)) {
      throw new ManifestSerializationError(path, 'class instances are unsupported')
    }

    const result: Record<string, JsonValue> = {}

    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      const itemPath = `${path}.${key}`

      if (typeof item === 'string' && URL_KEYS.has(key.toLowerCase())) {
        assertSafeUrl(item, itemPath)
      }

      result[key] = convertValue(item, itemPath, ancestors)
    }

    return result
  } finally {
    ancestors.delete(value)
  }
}

export function toJsonValue(value: unknown): JsonValue {
  return convertValue(value, '$', new Set())
}

export function assertJsonSafe(value: unknown): asserts value is JsonValue {
  toJsonValue(value)
}

export function serializeManifest(value: unknown): string {
  return JSON.stringify(toJsonValue(value))
}
