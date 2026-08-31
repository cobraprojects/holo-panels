import type { JsonObject, JsonValue } from '@holo-js/panels-core'
import { resolveTableActionManifest, type TableActionDefinition } from '../actions/table'

export function widgetTableObject(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function widgetTableObjects(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value) ? value.flatMap(item => item && typeof item === 'object' && !Array.isArray(item) ? [item] : []) : []
}

function text(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

function alignment(value: JsonValue | undefined): 'center' | 'end' | 'start' {
  return value === 'center' || value === 'end' ? value : 'start'
}

export function widgetTableColumns(table: JsonObject) {
  return widgetTableObjects(table.columns).map(column => ({ manifest: {
    alignment: alignment(column.alignment),
    copyable: column.copyable === true,
    formatters: widgetTableObjects(column.formatters),
    hidden: column.hidden === true,
    inlineEditor: column.inlineEditor ? widgetTableObject(column.inlineEditor) : null,
    label: text(column.label) || text(column.path),
    lineClamp: typeof column.lineClamp === 'number' ? column.lineClamp : null,
    path: text(column.path),
    searchable: column.searchable === true,
    sortable: column.sortable === true,
    toggleable: column.toggleable !== false,
    type: text(column.type),
    width: typeof column.width === 'number' || typeof column.width === 'string' ? column.width : null,
    wrap: column.wrap !== false,
  } }))
}

export function widgetTableFilters(table: JsonObject) {
  return widgetTableObjects(table.filters).map(filter => ({
    manifest: { defaultValue: filter.defaultValue ?? null, id: text(filter.id), label: text(filter.label), properties: widgetTableObject(filter.properties), type: text(filter.type) },
    options: widgetTableObjects(widgetTableObject(filter.properties).options).flatMap(option => option.value === null || typeof option.value === 'string' || typeof option.value === 'number' || typeof option.value === 'boolean' ? [{ disabled: option.disabled === true, label: text(option.label), value: option.value }] : []),
  }))
}

export interface WidgetTableActionGroup {
  readonly actions: readonly TableActionDefinition[]
  readonly id: string
  readonly kind: 'action-group'
  readonly label: string
  readonly scope: 'bulk' | 'header' | 'row'
}

export function widgetTableActions(entries: JsonValue | undefined, data: () => JsonObject): readonly (TableActionDefinition | WidgetTableActionGroup)[] {
  return widgetTableObjects(entries).map(action => {
    const scope = action.scope === 'bulk' || action.scope === 'header' ? action.scope : 'row'
    if (action.kind === 'action-group') return { actions: widgetTableActions(action.actions, data).flatMap(item => 'actions' in item ? [...item.actions] : [item]), id: text(action.id), kind: 'action-group', label: text(action.label), scope }
    return { id: text(action.id), label: text(action.label), scope, resolveManifest: recordId => resolveTableActionManifest(data(), text(action.id), recordId) }
  })
}

export function widgetTableSummaries(value: JsonValue | undefined) {
  return widgetTableObjects(value).map(summary => ({ id: text(summary.id), label: text(summary.label), value: typeof summary.value === 'number' ? summary.value : text(summary.value) }))
}

export function widgetTableGroups(value: JsonValue | undefined) {
  return widgetTableObjects(value).map(group => ({ collapsed: group.collapsed === true, collapsible: group.collapsible !== false, description: text(group.description), key: text(group.key), records: widgetTableObjects(group.records), summaries: widgetTableSummaries(group.summaries), title: text(group.title) }))
}
