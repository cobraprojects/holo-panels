import { toJsonValue, type JsonObject } from '@holo-js/panels-core'
import type { TableActionExecutionRequest } from '../actions/table'
import { TableStateStore } from '../tables/table-state'
import type { WidgetStore } from './store'
import { widgetTableActions, widgetTableColumns, widgetTableFilters, widgetTableGroups, widgetTableObject, widgetTableObjects, widgetTableSummaries } from './table-presentation'

interface WidgetTableOptions {
  readonly execute: (operation: 'action', payload: JsonObject, signal: AbortSignal) => Promise<JsonObject>
  readonly panelId: string
  readonly request: () => JsonObject
}

export class WidgetTableController {
  readonly #widget: WidgetStore
  readonly #options: WidgetTableOptions
  readonly #unsubscribe: () => void
  #table: TableStateStore<JsonObject, string> | null = null
  #result: JsonObject = {}
  #resource: JsonObject = {}

  constructor(widget: WidgetStore, options: WidgetTableOptions) {
    this.#widget = widget
    this.#options = options
    this.#unsubscribe = widget.subscribe(() => this.synchronize())
    this.synchronize()
  }

  get query(): JsonObject {
    return this.#table ? { ...widgetTableObject(toJsonValue(this.#table.query)), selection: toJsonValue(this.#table.selectionPayload()) } : {}
  }

  get presentation() {
    const store = this.#table
    if (!store) return null
    const table = widgetTableObject(this.#resource.table)
    return {
      actionTransport: { execute: (request: TableActionExecutionRequest<string>, signal: AbortSignal) => this.execute(request, signal) },
      actions: widgetTableActions(this.#result.tableActions ?? table.actions, () => this.#result),
      caption: String(widgetTableObject(this.#resource.labels).plural ?? this.#resource.id),
      columns: widgetTableColumns(table),
      filters: widgetTableFilters(table),
      getRecordId: (record: Readonly<JsonObject>) => String(record[String(this.#resource.routeKey ?? 'id')]),
      groups: widgetTableGroups(this.#result.groups),
      onQueryChange: () => { void this.#widget.load() },
      panelId: this.#options.panelId,
      store,
      summaries: widgetTableSummaries(this.#result.summaries),
    }
  }

  dispose(): void {
    this.#unsubscribe()
  }

  private synchronize(): void {
    const state = this.#widget.snapshot
    if (state.status !== 'ready') return
    const data = widgetTableObject(state.data)
    if (typeof data.tableId !== 'string') return
    this.#result = widgetTableObject(data.result)
    this.#resource = widgetTableObject(this.#result.resource)
    if (this.#resource.id !== data.tableId) return
    const records = widgetTableObjects(this.#result.records)
    const total = typeof this.#result.total === 'number' ? this.#result.total : records.length
    if (!this.#table) {
      const table = widgetTableObject(this.#resource.table)
      const state = widgetTableObject(this.#result.tableState)
      this.#table = new TableStateStore({ filterMode: table.filterMode === 'deferred' ? 'deferred' : 'live', panelId: this.#options.panelId, perPage: typeof state.perPage === 'number' ? state.perPage : 25, records, selection: widgetTableObject(table.selection), tableId: data.tableId, total, visibleColumns: widgetTableColumns(table).filter(column => !column.manifest.hidden).map(column => column.manifest.path) })
    }
    this.#table.applyData({ queryVersion: this.#table.query.queryVersion, records, selection: widgetTableObject(this.#result.selection), total })
  }

  private async execute(request: TableActionExecutionRequest<string>, signal: AbortSignal): Promise<void> {
    const result = await this.#options.execute('action', {
      actionId: request.actionId,
      idempotencyKey: request.idempotencyKey ?? globalThis.crypto.randomUUID(),
      input: request.input ?? {},
      mount: request.mount ?? 'record',
      recordIds: request.selection?.mode === 'explicit' ? [...request.selection.recordIds] : request.recordId === undefined ? [] : [request.recordId],
      ...(request.selection?.mode === 'all-matching' ? { selection: toJsonValue(request.selection) } : {}),
      resourceId: this.#resource.id ?? '',
      source: 'table',
      tableQuery: this.query,
      widgetTable: this.#options.request(),
    }, signal)
    if (result.status === 'partial') throw new Error('One or more records could not be updated')
    await this.#widget.load()
  }
}
