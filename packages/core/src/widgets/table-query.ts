import type { JsonObject } from '../protocol/json'

const QUERY_FIELDS = new Set(['filters', 'grouping', 'page', 'panelId', 'perPage', 'queryVersion', 'search', 'selection', 'sort', 'tableId'])

export function widgetTableQuery(value: JsonObject, strict = true): JsonObject {
  const entries = Object.entries(value)
  if (strict && entries.some(([key]) => !QUERY_FIELDS.has(key))) throw new Error('Unknown table widget query field')
  return Object.fromEntries(entries.filter(([key]) => QUERY_FIELDS.has(key)))
}
