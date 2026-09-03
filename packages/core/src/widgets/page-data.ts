import { authorizePanelActionPermissions } from '../actions/authorization'
import type { CompiledPanelDefinition } from '../panels/contracts'
import type { CompiledPageDefinition } from '../pages/contracts'
import { resolvePageData } from '../pages/resolution'
import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import { executeGeneratedResourceOperation, type GeneratedResourceOperationInput } from '../resources/generated-pages'
import type { TableQueryState } from '../tables/query/contracts'
import type { CompiledWidgetDefinition, WidgetContext } from './contracts'
import { DashboardFilterValidationError, resolveDashboardFilters, resolveDashboardFilterForm, type DashboardFilterSchema } from './filter-form'
import { dashboardFilterSession } from './filter-session'
import { normalizeDashboardPage } from './page'
import { resolveRegisteredWidget } from './table'

type Registry = Readonly<Record<string, () => Promise<object>>>
type Context = WidgetContext<object, unknown, unknown> & Pick<GeneratedResourceOperationInput['context'], 'scopeTenantQuery' | 'tenantBindings'>

function compiled(value: object): object {
  return 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
}

function jsonObject(value: unknown): JsonObject {
  const json = toJsonValue(value)
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Widget requests require objects')
  return json
}

function parameters(page: CompiledPageDefinition<JsonObject, object, unknown, unknown>, input: JsonObject): Readonly<Record<string, string>> {
  const names = page.manifest.path.split('/').filter(part => part.startsWith(':')).map(part => part.slice(1))
  if (Object.keys(input).some(key => !names.includes(key))) throw new Error('Unknown widget page parameter')
  return Object.fromEntries(names.map(name => {
    const value = input[name]
    if (typeof value !== 'string' || !value || /[/\\]/u.test(value) || [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)) throw new Error('Invalid widget page parameter')
    return [name, value]
  }))
}

async function dashboardFilters(page: Awaited<ReturnType<typeof resolvePageData>>, payload: JsonObject, context: Context, guard: string, source: DashboardFilterSchema | undefined): Promise<JsonObject> {
  const dashboard = page.manifest.body?.properties.dashboard
  if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)) {
    if (payload.dashboardFilters !== undefined) throw new Error('This page has no dashboard filters')
    return {}
  }
  const session = dashboard.persistFilters === true ? await dashboardFilterSession(context, page.manifest.id, guard) : null
  const input = payload.resetFilters === true ? {} : payload.dashboardFilters === undefined ? jsonObject(page.data.filters ?? {}) : jsonObject(payload.dashboardFilters)
  const form = await resolveDashboardFilterForm(source, input)
  const schema = form?.schema ?? (dashboard.filters ? jsonObject(dashboard.filters) : null)
  const filters = await resolveDashboardFilters(schema, form?.values ?? input, payload.resetFilters !== true, context.locale)
  if (context.signal.aborted) throw context.signal.reason
  if (payload.widgetId === undefined && (payload.resetFilters === true || payload.dashboardFilters !== undefined)) await session?.write(payload.resetFilters === true ? null : filters)
  return filters
}

export async function resolveWidgetRequestData(registry: Registry, payload: JsonObject, context: Context, panel: CompiledPanelDefinition<object>): Promise<{ readonly data: JsonObject, readonly definition?: CompiledWidgetDefinition<JsonValue, object, unknown, unknown> }> {
  if (payload.widgetId !== undefined && payload.resetFilters !== undefined) throw new Error('Widget refresh cannot reset dashboard filters')
  if (context.panelId !== panel.manifest.id || typeof payload.pageId !== 'string') throw new Error('Widget requests require their registered page')
  const pageLoader = registry[`${context.panelId}:page:${payload.pageId}`]
  if (!pageLoader) throw new Error('The widget page is not registered')
  const compiledPage = compiled(await pageLoader())
  const value = normalizeDashboardPage(compiledPage)
  if (!value || typeof value !== 'object' || Reflect.get(value, 'kind') !== 'page') throw new Error('The widget page is not registered')
  const definition = value as CompiledPageDefinition<JsonObject, object, unknown, unknown>
  if (definition.manifest.id !== payload.pageId) throw new Error('The widget page is not registered under its ID')
  const pageContext = { ...context, guard: panel.guard, strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false, parameters: parameters(definition, jsonObject(payload.parameters ?? {})) }
  const page = await resolvePageData(definition, pageContext)
  let filters: JsonObject
  const source = Reflect.get(compiledPage, 'kind') === 'dashboard' ? Reflect.get(Reflect.get(compiledPage, 'server'), 'filters') as DashboardFilterSchema | undefined : undefined
  try { filters = await dashboardFilters(page, payload, context, panel.guard, source) } catch (error) {
    if (error instanceof DashboardFilterValidationError) return { data: { errors: jsonObject(error.errors), status: 'invalid' } }
    throw error
  }
  if (payload.widgetId === undefined) return { data: { filters, status: 'ready' } }
  const widgetId = payload.widgetId
  const placement = page.manifest.widgets.header.includes(String(widgetId)) ? 'header' as const : 'footer' as const
  if (typeof widgetId !== 'string' || !page.manifest.widgets[placement].includes(widgetId)) throw new Error('The widget is not registered on this page')
  await authorizePanelActionPermissions(panel, context, [`widgets.${widgetId}.view`])
  const resource = page.manifest.body?.properties.resource
  const resourceId = resource && typeof resource === 'object' && !Array.isArray(resource) && typeof resource.id === 'string' ? resource.id : null
  const resourceLoader = resourceId ? registry[`${context.panelId}:resource:${resourceId}`] : undefined
  const resourceDefinition = resourceLoader ? compiled(await resourceLoader()) : null
  const embedded = resourceDefinition ? Reflect.get(resourceDefinition, 'widgets') : null
  const widgetLoader = registry[`${context.panelId}:widget:${widgetId}`]
  const widget = widgetLoader ? compiled(await widgetLoader()) : Array.isArray(embedded) ? embedded.map(compiled).find(entry => Reflect.get(Reflect.get(entry, 'manifest'), 'id') === widgetId) : null
  if (!widget || Reflect.get(widget, 'kind') !== 'widget') throw new Error('The widget is not registered')
  const widgetDefinition = widget as CompiledWidgetDefinition<JsonValue, object, unknown, unknown>
  if (widgetDefinition.manifest.id !== widgetId) throw new Error('The widget is not registered under its ID')
  let tableState: Readonly<TableQueryState> | null = null
  if (resourceDefinition && (page.manifest.pageType === 'list' || page.manifest.pageType === 'manage')) {
    if (!await widgetDefinition.server.authorize(context)) return { data: jsonObject({ data: null, manifest: widgetDefinition.manifest, status: 'unauthorized' }) }
    if (!await widgetDefinition.server.visible(context)) return { data: jsonObject({ data: null, manifest: widgetDefinition.manifest, status: 'hidden' }) }
    const table = await executeGeneratedResourceOperation(resourceDefinition, { context, operation: 'table-data', panel, panelId: context.panelId, strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false, payload: { ...jsonObject(payload.tableQuery ?? {}), resourceId } })
    const data = jsonObject(table.data)
    tableState = data.tableState as JsonObject & TableQueryState
  }
  const record = page.data.record
  const resourceContext = resourceId ? { ...context, pageId: page.manifest.id, placement, resourceId, record: record && typeof record === 'object' && !Array.isArray(record) ? record : null, tableState } : null
  const resolved = await resolveRegisteredWidget(widgetDefinition, context, jsonObject(payload.filters ?? {}), resourceContext, panel, { dashboardFilters: filters, tableQuery: jsonObject(payload.widgetTableQuery ?? {}) })
  return { data: jsonObject(resolved), definition: widgetDefinition }
}

export async function executeWidgetDataOperation(registry: Registry, payload: JsonObject, context: Context, panel: CompiledPanelDefinition<object>): Promise<JsonObject> {
  return (await resolveWidgetRequestData(registry, payload, context, panel)).data
}
