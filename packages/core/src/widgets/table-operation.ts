import type { CompiledPanelDefinition } from '../panels/contracts'
import type { JsonObject } from '../protocol/json'
import { executeGeneratedResourceOperation, type GeneratedResourceOperationResult } from '../resources/generated-pages'
import { resolveWidgetRequestData } from './page-data'
import { widgetTableQuery } from './table-query'

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid table widget request')
  return value as JsonObject
}

export async function executeWidgetTableOperation(
  registry: Parameters<typeof resolveWidgetRequestData>[0],
  operation: 'action' | 'table-data',
  payload: JsonObject,
  context: Parameters<typeof resolveWidgetRequestData>[2],
  panel: CompiledPanelDefinition<object>,
): Promise<GeneratedResourceOperationResult> {
  const request = object(payload.widgetTable)
  if (typeof request.widgetId !== 'string') throw new Error('Table widget requests require a widget ID')
  if (payload.intent === 'relation' || payload.source !== undefined && payload.source !== 'table') throw new Error('Table widget requests require table operations')
  const query = operation === 'table-data' ? widgetTableQuery(payload, false) : object(payload.tableQuery ?? {})
  const { data: resolved, definition } = await resolveWidgetRequestData(registry, { ...request, widgetTableQuery: { ...query, ...(payload.selection === undefined ? {} : { selection: payload.selection }) } }, context, panel)
  if (resolved.status !== 'ready' || object(resolved.manifest).family !== 'table') throw new Error('The table widget is not available')
  const data = object(resolved.data)
  const result = object(data.result)
  if (typeof data.tableId !== 'string' || payload.resourceId !== data.tableId) throw new Error('The resource does not belong to this table widget')
  if (operation === 'table-data') return { data: result, effects: [] }
  const binding = definition?.server.table
  if (!binding) throw new Error('The table widget resource is not registered')
  return executeGeneratedResourceOperation(binding.resource(), {
    context, operation, panel, panelId: context.panelId,
    payload: { ...payload, resourceId: data.tableId, source: 'table', tableQuery: result.query ?? {}, ...(payload.selection === undefined ? {} : { selection: object(result.query).selection ?? null }) },
    strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
  })
}
