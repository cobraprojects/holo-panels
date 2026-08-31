import type { CompiledPanelDefinition } from '../panels/contracts'
import type { JsonObject, JsonValue } from '../protocol/json'
import { executeGeneratedResourceOperation, generatedResourcePageManifests } from '../resources/generated-pages'
import type { CompiledWidgetDefinition, ResourceWidgetContext, ResolvedWidget, WidgetContext, WidgetFilterState } from './contracts'
import { resolveWidget } from './resolution'
import { widgetTableQuery } from './table-query'

export async function resolveRegisteredWidget(
  definition: CompiledWidgetDefinition<JsonValue, object, unknown, unknown>,
  context: WidgetContext<object, unknown, unknown>,
  filters: WidgetFilterState,
  resource: ResourceWidgetContext<JsonObject, object, unknown, unknown> | null,
  panel: CompiledPanelDefinition<object>,
  options: { readonly dashboardFilters?: WidgetFilterState, readonly defer?: boolean, readonly tableQuery?: JsonObject } = {},
): Promise<ResolvedWidget<JsonValue>> {
  const binding = definition.server.table
  if (!binding) return resolveWidget(definition, context, filters, resource, options)
  return resolveWidget({
    ...definition,
    server: {
      ...definition.server,
      async data(scope) {
        const tableResource = binding.resource()
        const pages = generatedResourcePageManifests({ panelPath: panel.manifest.path, resource: tableResource })
        const page = pages.find(candidate => candidate.pageType === 'list' || candidate.pageType === 'manage')
        const manifest = page?.body?.properties.resource
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || typeof manifest.id !== 'string') throw new Error('Table widgets require a listable resource')
        const query = { ...widgetTableQuery(options.tableQuery ?? {}), ...widgetTableQuery(await binding.query?.(scope) ?? {}) }
        if (query.tableId !== undefined && query.tableId !== manifest.id || query.panelId !== undefined && query.panelId !== context.panelId) throw new Error('The query belongs to another table widget')
        const result = await executeGeneratedResourceOperation(tableResource, {
          context, operation: 'table-data', panel, panelId: context.panelId,
          payload: { ...query, resourceId: manifest.id },
          strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
        })
        return { tableId: manifest.id, result: { ...result.data, query, resource: manifest } }
      },
    },
  }, context, filters, resource, options)
}
