import type { FilterCollectionPresentation, TableRecordId } from '@holo-js/panels-client'
import type { SvelteTableColumn, SvelteTableFilter, SvelteTableRendererProps } from './types'

const filterBreakpoints = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export function filterCollectionStyle(columns: FilterCollectionPresentation['columns']): string {
  return filterBreakpoints.flatMap(breakpoint => columns[breakpoint] === undefined
    ? []
    : [`--hp-filter-columns-${breakpoint}:${columns[breakpoint]}`]).join(';')
}

export function filterLayoutStyle(layout: NonNullable<SvelteTableFilter['manifest']['layout']>): string {
  return filterBreakpoints.flatMap(breakpoint => {
    const span = layout.columnSpan?.[breakpoint]
    const start = layout.columnStart?.[breakpoint]
    return [
      ...(span === undefined ? [] : [`--hp-filter-column-span-${breakpoint}:${span === 'full' ? '-1' : `span ${span}`}`]),
      ...(start === undefined ? [] : [`--hp-filter-column-start-${breakpoint}:${start}`]),
    ]
  }).join(';')
}

export function recordValue(record: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) return value[Number(segment)]
    if (typeof value === 'object' && value !== null) return Reflect.get(value, segment)
    return undefined
  }, record)
}

export function displayValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '—'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function visibleColumns<TRecord extends object, TRecordId extends TableRecordId>(
  table: SvelteTableRendererProps<TRecord, TRecordId>,
  selected: readonly string[],
): readonly SvelteTableColumn<TRecord>[] {
  const configured = selected.length > 0
    ? new Set(selected)
    : new Set(table.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path))
  return table.columns.filter(column => configured.has(column.manifest.path))
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage))
}

export function optionValue(option: unknown): boolean | number | string | null | undefined {
  if (typeof option !== 'object' || option === null || Array.isArray(option)) return undefined
  const value: unknown = Reflect.get(option, 'value')
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null ? value : undefined
}
