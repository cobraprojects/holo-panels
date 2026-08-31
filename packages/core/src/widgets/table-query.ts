import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'

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
    const scopeChanged = ['search', 'filters'].some(key => bound[key] !== undefined && JSON.stringify(toJsonValue(selectedQuery[key] ?? (key === 'search' ? '' : {}))) !== JSON.stringify(toJsonValue(bound[key])))
    query.selection = scopeChanged ? { mode: 'explicit', recordIds: [] } : { ...selection, query: widgetTableQuery(selectedQuery) }
  }
  return query
}
