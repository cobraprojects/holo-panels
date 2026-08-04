import { toJsonValue, type JsonValue } from '@holo-js/panels-core'
import type { TableGrouping, TableQuerySnapshot, TableSort } from './contracts'

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const COLUMN_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/

export type RestoredTableQuery = {
  readonly present: boolean
  readonly page?: number
  readonly perPage?: number
  readonly search?: string
  readonly sort?: readonly TableSort[]
  readonly filters?: Readonly<Record<string, JsonValue>>
  readonly grouping?: TableGrouping | null
  readonly visibleColumns?: readonly string[]
}

export function assertTableIdentifier(value: string, label: 'panel' | 'table'): void {
  if (!IDENTIFIER_PATTERN.test(value)) throw new Error(`[Holo Panels] Invalid ${label} ID "${value}" for table query state.`)
}

export function assertTableColumnIdentifier(value: string): void {
  if (!COLUMN_PATTERN.test(value)) throw new Error(`[Holo Panels] Invalid table column "${value}".`)
}

function namespace(panelId: string, tableId: string): string {
  assertTableIdentifier(panelId, 'panel')
  assertTableIdentifier(tableId, 'table')
  return `hp[${panelId}][${tableId}]`
}

function canonicalJson(value: JsonValue): string {
  return JSON.stringify(toJsonValue(value))
}

function positiveInteger(value: string | null, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : undefined
}

function parseSort(value: string | null): readonly TableSort[] | undefined {
  if (!value) return undefined
  const entries: TableSort[] = []
  const seen = new Set<string>()
  for (const item of value.split(',')) {
    const separator = item.lastIndexOf(':')
    if (separator < 1) return undefined
    const column = item.slice(0, separator)
    const direction = item.slice(separator + 1)
    if (!COLUMN_PATTERN.test(column) || (direction !== 'asc' && direction !== 'desc') || seen.has(column)) return undefined
    seen.add(column)
    entries.push({ column, direction })
  }
  return Object.freeze(entries)
}

function parseGrouping(value: string | null): TableGrouping | null | undefined {
  if (value === null) return undefined
  if (value === '') return null
  const parsed = parseSort(value)
  if (!parsed || parsed.length !== 1) return undefined
  return parsed[0]!
}

function parseColumns(value: string | null): readonly string[] | undefined {
  if (value === null) return undefined
  if (value === '') return Object.freeze([])
  const columns = value.split(',')
  if (new Set(columns).size !== columns.length || columns.some(column => !COLUMN_PATTERN.test(column))) return undefined
  return Object.freeze(columns)
}

function parseFilter(value: string): JsonValue | undefined {
  try {
    return toJsonValue(JSON.parse(value) as unknown)
  } catch {
    return undefined
  }
}

export function serializeTableQuery(snapshot: TableQuerySnapshot): string {
  const prefix = namespace(snapshot.panelId, snapshot.tableId)
  if (!Number.isSafeInteger(snapshot.page) || snapshot.page < 1) throw new Error('[Holo Panels] Table pages must be positive integers.')
  if (!Number.isSafeInteger(snapshot.perPage) || snapshot.perPage < 1 || snapshot.perPage > 500) {
    throw new Error('[Holo Panels] Table page size must be an integer from 1 to 500.')
  }
  if (snapshot.search.length > 500) throw new Error('[Holo Panels] Table search cannot exceed 500 characters.')
  const parameters = new URLSearchParams()
  if (snapshot.page !== 1) parameters.set(`${prefix}[page]`, String(snapshot.page))
  parameters.set(`${prefix}[perPage]`, String(snapshot.perPage))
  if (snapshot.search) parameters.set(`${prefix}[search]`, snapshot.search)
  if (snapshot.sort.length > 0) {
    parameters.set(`${prefix}[sort]`, snapshot.sort.map(({ column, direction }) => {
      assertTableColumnIdentifier(column)
      if (direction !== 'asc' && direction !== 'desc') throw new Error('[Holo Panels] Invalid table sort direction.')
      return `${column}:${direction}`
    }).join(','))
  }
  if (snapshot.grouping) {
    assertTableColumnIdentifier(snapshot.grouping.column)
    if (snapshot.grouping.direction !== 'asc' && snapshot.grouping.direction !== 'desc') {
      throw new Error('[Holo Panels] Invalid table grouping direction.')
    }
    parameters.set(`${prefix}[group]`, `${snapshot.grouping.column}:${snapshot.grouping.direction}`)
  }
  parameters.set(`${prefix}[columns]`, snapshot.visibleColumns.map((column) => {
    assertTableColumnIdentifier(column)
    return column
  }).join(','))
  for (const [filterId, value] of Object.entries(snapshot.filters).sort(([left], [right]) => left.localeCompare(right))) {
    assertTableColumnIdentifier(filterId)
    parameters.set(`${prefix}[filter][${filterId}]`, canonicalJson(value))
  }
  parameters.sort()
  return parameters.toString()
}

export function restoreTableQuery(
  parameters: URLSearchParams | string,
  panelId: string,
  tableId: string,
): RestoredTableQuery {
  const source = typeof parameters === 'string' ? new URLSearchParams(parameters.startsWith('?') ? parameters.slice(1) : parameters) : parameters
  const prefix = namespace(panelId, tableId)
  const present = [...source.keys()].some(key => key.startsWith(`${prefix}[`))
  if (!present) return Object.freeze({ present: false })
  const filters = new Map<string, JsonValue>()
  const filterPrefix = `${prefix}[filter][`
  for (const [key, value] of source) {
    if (!key.startsWith(filterPrefix) || !key.endsWith(']')) continue
    const filterId = key.slice(filterPrefix.length, -1)
    if (!COLUMN_PATTERN.test(filterId) || filters.has(filterId)) continue
    const parsed = parseFilter(value)
    if (typeof parsed !== 'undefined') filters.set(filterId, parsed)
  }
  const page = positiveInteger(source.get(`${prefix}[page]`))
  const perPage = positiveInteger(source.get(`${prefix}[perPage]`), 500)
  const search = source.get(`${prefix}[search]`)
  const sort = parseSort(source.get(`${prefix}[sort]`))
  const grouping = parseGrouping(source.get(`${prefix}[group]`))
  const visibleColumns = parseColumns(source.get(`${prefix}[columns]`))
  return Object.freeze({
    present: true,
    ...(page ? { page } : {}),
    ...(perPage ? { perPage } : {}),
    ...(search !== null ? { search: search.slice(0, 500) } : {}),
    ...(sort ? { sort } : {}),
    ...(typeof grouping !== 'undefined' ? { grouping } : {}),
    ...(visibleColumns ? { visibleColumns } : {}),
    ...(filters.size > 0 ? { filters: Object.freeze(Object.fromEntries([...filters].sort(([left], [right]) => left.localeCompare(right)))) } : {}),
  })
}
