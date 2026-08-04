import type { NuxtPanelJsonObject, NuxtPanelJsonValue } from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
}

export function assertPanelId(value: string): void {
  if (!IDENTIFIER.test(value)) throw new Error('Nuxt panel adapters require stable panel IDs')
}

export function normalizePanelPath(value: string): string {
  if (value !== value.trim() || !value.startsWith('/') || value.includes('\\') || value.includes('//') || hasControlCharacter(value)) {
    throw new Error('Nuxt panel routes must be normalized absolute paths')
  }
  const path = value.split(/[?#]/u, 1)[0] ?? ''
  let decoded = path
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      if (next.includes('\\') || next.split('/').length !== decoded.split('/').length) throw new Error('Nuxt panel routes must be safe')
      decoded = next
    } catch {
      throw new Error('Nuxt panel routes must be safely encoded')
    }
  }
  if (decoded.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Nuxt panel routes cannot contain traversal segments')
  return path === '/' ? path : path.replace(/\/+$/gu, '')
}

export function normalizePanelLocation(value: string): string {
  if (value.includes('#')) throw new Error('Nuxt panel locations must not contain fragments')
  const separator = value.indexOf('?')
  const path = normalizePanelPath(separator < 0 ? value : value.slice(0, separator))
  if (separator < 0) return path
  const query = value.slice(separator + 1)
  if (hasControlCharacter(query)) throw new Error('Nuxt panel query strings must be safe')
  const parameters = new URLSearchParams(query)
  return parameters.size ? `${path}?${parameters.toString()}` : path
}

export function toJsonObject(value: unknown): NuxtPanelJsonObject {
  const serialized = JSON.parse(JSON.stringify(value)) as unknown
  if (!serialized || typeof serialized !== 'object' || Array.isArray(serialized)) throw new TypeError('Nuxt panel operation inputs must be JSON objects')
  return serialized as NuxtPanelJsonObject
}

export function isJsonValue(value: unknown): value is NuxtPanelJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  return typeof value === 'object' && Object.values(value).every(isJsonValue)
}

export function safeRedirect(value: string): string {
  const path = normalizePanelPath(value)
  if (path !== value) throw new Error('Nuxt panel redirects must be normalized')
  return path
}
