import type { JsonObject } from '@holo-js/panels-core'
import type { PanelsTransport } from '../transport'
import type { WidgetLoader } from './contracts'

export function createWidgetLoader(transport: PanelsTransport, panelId: string, request: JsonObject, dashboardFilters?: () => JsonObject): WidgetLoader {
  return async (widgetId, filters, signal) => {
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'page-data' }, {
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/page-data`,
      panelId,
      payload: { ...request, widgetId, filters: { ...filters }, ...(dashboardFilters ? { dashboardFilters: dashboardFilters() } : {}) },
      signal,
    })
    if (!response.ok) throw new Error('Unable to load widget')
    const result = response.data
    if (!result || !['ready', 'hidden', 'unauthorized'].includes(String(result.status))) throw new Error('Invalid widget response')
    return { data: result.status === 'ready' ? result.data ?? null : null, status: result.status as 'ready' | 'hidden' | 'unauthorized' }
  }
}
