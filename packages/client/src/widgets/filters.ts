import { toJsonValue, type JsonValue } from '@holo-js/panels-core'
import type { WidgetClientFilter, WidgetFilterStorage } from './contracts'

const SCOPE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function storageKey(panelId: string, dashboardId: string, widgetId: string): string {
  for (const value of [panelId, dashboardId, widgetId]) {
    if (!SCOPE.test(value)) throw new Error('Widget filter persistence requires stable scope IDs')
  }
  return `holo-panels:${panelId}:dashboard:${dashboardId}:widget:${widgetId}:filters`
}

function defaults(definitions: readonly WidgetClientFilter[]): Record<string, JsonValue> {
  return Object.fromEntries(definitions.map(definition => [definition.id, definition.defaultValue]))
}

function allowlisted(value: Record<string, JsonValue>, definitions: readonly WidgetClientFilter[]): Record<string, JsonValue> {
  const allowed = new Set(definitions.map(definition => definition.id))
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)))
}

export class WidgetFilterPersistence {
  readonly #key: string
  readonly #storage: WidgetFilterStorage

  constructor(storage: WidgetFilterStorage, panelId: string, dashboardId: string, widgetId: string) {
    this.#storage = storage
    this.#key = storageKey(panelId, dashboardId, widgetId)
  }

  read(definitions: readonly WidgetClientFilter[]): Readonly<Record<string, JsonValue>> {
    const fallback = defaults(definitions)
    const stored = this.#storage.getItem(this.#key)
    if (stored === null) return Object.freeze(fallback)
    try {
      const parsed: JsonValue = JSON.parse(stored)
      const serialized = toJsonValue(parsed)
      if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('Widget filter state must be an object')
      return Object.freeze({ ...fallback, ...allowlisted(serialized, definitions) })
    } catch {
      this.#storage.removeItem(this.#key)
      return Object.freeze(fallback)
    }
  }

  write(filters: Readonly<Record<string, JsonValue>>, definitions: readonly WidgetClientFilter[]): void {
    const serialized = toJsonValue(allowlisted({ ...filters }, definitions))
    this.#storage.setItem(this.#key, JSON.stringify(serialized))
  }

  clear(): void {
    this.#storage.removeItem(this.#key)
  }
}
