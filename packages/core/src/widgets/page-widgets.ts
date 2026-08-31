import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type { CompiledWidgetDefinition, ResourceWidgetContext, ResolvedWidget, WidgetContext } from './contracts'
import { resolveWidget } from './resolution'
import { authorizePanelActionPermissions } from '../actions/authorization'
import type { CompiledPanelDefinition } from '../panels/contracts'

export async function resolvePageWidgetGroup(
  ids: readonly string[],
  definitions: readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown>[],
  context: WidgetContext<object, unknown, unknown>,
  resource: Omit<ResourceWidgetContext<JsonObject, object, unknown, unknown>, keyof WidgetContext<object, unknown, unknown> | 'placement'> | null,
  placement: 'footer' | 'header',
  request: JsonObject,
  dashboardFilters: JsonObject | undefined,
  panel: CompiledPanelDefinition<object>,
  filtersValid = true,
): Promise<readonly ResolvedWidget<JsonValue>[]> {
  const widgets = new Map(definitions.map(widget => [widget.manifest.id, widget]))
  return Promise.all(ids.map(async id => {
    const widget = widgets.get(id)
    if (!widget) throw new Error('The page widget is not registered')
    const refresh = { ...request, tableQuery: toJsonValue(resource?.tableState ?? {}), widgetId: id }
    try {
      await authorizePanelActionPermissions(panel, context, [`widgets.${id}.view`])
    } catch {
      if (context.signal.aborted) throw context.signal.reason
      return { data: null, manifest: widget.manifest, request: refresh, status: 'unauthorized' as const }
    }
    let initial: ResolvedWidget<JsonValue> | undefined
    const resourceContext = resource ? { ...context, ...resource, placement } : null
    try {
      initial = await resolveWidget(widget, context, {}, resourceContext, { dashboardFilters, defer: true })
      if (initial.status !== 'idle') return { ...initial, request: refresh }
      if (!filtersValid) return { ...initial, request: refresh, status: 'error' as const }
      if (widget.manifest.lazy) return { ...initial, request: refresh }
      const result = await resolveWidget(widget, context, {}, resourceContext, { dashboardFilters })
      return { ...result, request: refresh }
    } catch {
      if (context.signal.aborted) throw context.signal.reason
      return { ...initial, data: null, manifest: widget.manifest, request: refresh, status: 'error' as const }
    }
  }))
}
