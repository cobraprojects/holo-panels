import type { JsonObject } from '../protocol/json'

const QUERY_FIELDS = new Set(['filters', 'grouping', 'page', 'panelId', 'perPage', 'queryVersion', 'search', 'selection', 'sort', 'tableId', 'visibleColumns'])

export function widgetTableQuery(value: JsonObject, strict = true): JsonObject {
  const entries = Object.entries(value)
  if (strict && entries.some(([key]) => !QUERY_FIELDS.has(key))) throw new Error('Unknown table widget query field')
  return Object.fromEntries(entries.filter(([key]) => QUERY_FIELDS.has(key)))
}

export function bindWidgetTableQuery(client: JsonObject, bound: JsonObject): JsonObject {
  const query = { ...widgetTableQuery(client), ...widgetTableQuery(bound) }
  const selection = query.selection
  if (selection && typeof selection === 'object' && !Array.isArray(selection) && selection.mode === 'all-matching') {
    const selectedQuery = selection.query
    if (!selectedQuery || typeof selectedQuery !== 'object' || Array.isArray(selectedQuery)) throw new Error('Invalid table widget selection query')
    query.selection = { ...selection, query: { ...widgetTableQuery(selectedQuery), ...widgetTableQuery(bound) } }
  }
  return query
}
