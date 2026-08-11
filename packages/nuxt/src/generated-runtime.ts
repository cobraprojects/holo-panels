import {
  createNavigationSeed,
  executeGeneratedGlobalSearch,
  executeGeneratedResourceOperation,
  executeGeneratedUploadOperation,
  executePanelDatabaseNotificationOperation,
  preparePageRoutes,
  resolvePageData,
  resolveWidget,
  type CompiledPageDefinition,
  type CompiledPanelDefinition,
  type CompiledWidgetDefinition,
  type JsonObject,
  type JsonValue,
  type ResolvedWidget,
  type TableQueryState,
} from '@holo-js/panels-vue/server'
import type { NuxtPanelOperationContext, NuxtPanelRuntime, NuxtPanelServerRegistry } from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

interface TenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & TenantScopedQuery<TQuery>
}

function compiled(value: object): object {
  return 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
}

async function definitions(registry: NuxtPanelServerRegistry, panelId: string, kind: 'page'): Promise<readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[]>
async function definitions(registry: NuxtPanelServerRegistry, panelId: string, kind: 'panel'): Promise<readonly CompiledPanelDefinition<object>[]>
async function definitions(registry: NuxtPanelServerRegistry, panelId: string, kind: 'widget'): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]>
async function definitions(registry: NuxtPanelServerRegistry, panelId: string, kind: 'page' | 'panel' | 'widget'): Promise<readonly object[]> {
  const prefix = `${panelId}:${kind}:`
  const keys = Object.keys(registry).filter(key => key.startsWith(prefix) && IDENTIFIER.test(key.slice(prefix.length))).sort()
  const values = (await Promise.all(keys.map(key => registry[key]!()))).map(compiled)
  if (kind !== 'widget') return values.filter(value => Reflect.get(value, 'kind') === kind)
  return Object.freeze(values.filter(value => Reflect.get(value, 'kind') === 'widget') as CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[])
}

async function resourceWidgets(registry: NuxtPanelServerRegistry, panelId: string, resourceId: string | null): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]> {
  if (!resourceId || !IDENTIFIER.test(resourceId)) return Object.freeze([])
  const loader = registry[`${panelId}:resource:${resourceId}`]
  if (!loader) return Object.freeze([])
  const resource = compiled(await loader())
  const widgets = Reflect.get(resource, 'widgets')
  return Object.freeze(Array.isArray(widgets) ? widgets.map(compiled).filter(value => Reflect.get(value, 'kind') === 'widget') as CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[] : [])
}

async function resolvedPageWidgets(
  ids: readonly string[],
  widgets: readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[],
  context: {
    readonly actor: object
    readonly locale: string
    readonly panelId: string
    readonly services: unknown
    readonly signal: AbortSignal
    readonly tenant: unknown
  },
  resource: Readonly<{ readonly pageId: string, readonly record: JsonObject | null, readonly resourceId: string, readonly tableState: Readonly<TableQueryState> | null }> | null,
  placement: 'footer' | 'header',
): Promise<readonly ResolvedWidget<JsonValue>[]> {
  const widgetsById = new Map(widgets.map(widget => [widget.manifest.id, widget]))
  return Object.freeze(await Promise.all(ids.map(async id => {
    const widget = widgetsById.get(id)
    if (!widget) throw new Error(`[Holo Panels] Page references missing widget "${id}".`)
    return await resolveWidget(widget, context, {}, resource ? { ...context, ...resource, placement } : null)
  })))
}

function pageWidgetResource(
  page: { readonly data: JsonObject, readonly manifest: { readonly body: { readonly properties: JsonObject } | null, readonly id: string } },
  tableState: Readonly<TableQueryState> | null,
): Readonly<{ readonly pageId: string, readonly record: JsonObject | null, readonly resourceId: string, readonly tableState: Readonly<TableQueryState> | null }> | null {
  const resource = page.manifest.body?.properties.resource
  if (!resource || typeof resource !== 'object' || Array.isArray(resource) || typeof resource.id !== 'string') return null
  const record = page.data.record
  return Object.freeze({ pageId: page.manifest.id, record: record && typeof record === 'object' && !Array.isArray(record) ? record : null, resourceId: resource.id, tableState })
}

function parameters(pattern: string, path: string): Readonly<Record<string, string>> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const values: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]!
    const value = actual[index]!
    if (segment.startsWith(':')) values[segment.slice(1)] = decodeURIComponent(value)
    else if (segment !== value) return null
  }
  return Object.freeze(values)
}

function panelWithNavigation(panel: CompiledPanelDefinition<object>, pages: readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[]): CompiledPanelDefinition<object> {
  const items = new Map(createNavigationSeed(pages).map(item => [item.id, item]))
  for (const item of panel.manifest.navigation) items.set(item.id, item)
  return Object.freeze({
    ...panel,
    manifest: Object.freeze({ ...panel.manifest, navigation: Object.freeze([...items.values()].sort((left, right) => left.sort - right.sort || left.label.localeCompare(right.label))) }),
  })
}

async function pagePayload(context: NuxtPanelOperationContext<object>, registry: NuxtPanelServerRegistry): Promise<object> {
  const panelDefinitions = await definitions(registry, context.panelId, 'panel')
  const discoveredPanel = panelDefinitions.find(item => item.manifest.id === context.panelId)
  if (!discoveredPanel) throw Object.assign(new Error('Panel not found'), { code: 'panel-not-found', name: 'PanelRuntimeError' })
  const pages = preparePageRoutes(await definitions(registry, context.panelId, 'page'))
  const panel = panelWithNavigation(discoveredPanel, pages)
  const location = typeof context.input.path === 'string' ? context.input.path : panel.manifest.path
  const url = new URL(location, 'http://panels.local')
  const match = pages.map(definition => ({ definition, parameters: parameters(definition.manifest.path, url.pathname) })).find(item => item.parameters !== null)
  if (!match?.parameters) throw Object.assign(new Error('Panel page not found'), { name: 'ResourceRecordNotFoundError' })
  const scope = { actor: context.actor, guard: panel.guard, panelId: context.panelId, provider: context.provider, signal: context.signal }
  const tenancy = context.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
  const widgetDefinitions = await definitions(registry, context.panelId, 'widget')
  const resolutionContext = {
    actor: context.actor,
    locale: 'en',
    panelId: context.panelId,
    services: (await context.getApp()).runtime,
    signal: context.signal,
    strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
    tenant: context.tenant ?? tenancy?.tenantId,
  }
  const page = await resolvePageData(match.definition, { ...resolutionContext, parameters: match.parameters })
  const search = url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? ''
  const category = url.searchParams.get('category')?.trim() ?? ''
  let resolvedPage = page
  let tableState: Readonly<TableQueryState> | null = null
  if (match.definition.manifest.pageType === 'list') {
    const resourceValue = match.definition.manifest.body?.properties.resource
    const resourceId = resourceValue && typeof resourceValue === 'object' && !Array.isArray(resourceValue) && typeof resourceValue.id === 'string' ? resourceValue.id : ''
    const loader = resourceId ? registry[`${context.panelId}:resource:${resourceId}`] : undefined
    if (!loader) throw Object.assign(new Error('Resource not found'), { statusCode: 404 })
    const table = await executeGeneratedResourceOperation(await loader(), {
      context: {
        actor: context.actor,
        signal: context.signal,
        tenant: context.tenant ?? tenancy?.tenantId,
        ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
        ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
      },
      operation: 'table-data',
      panelId: context.panelId,
      payload: { filters: category ? { category } : {}, resourceId, search },
      strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
    })
    tableState = Object.freeze({
      filters: Object.freeze(category ? [{ id: 'category', operator: '=' as const, value: category }] : []),
      includeTotal: true,
      page: 1,
      pagination: 'page',
      perPage: 25,
      search,
      sort: Object.freeze([]),
    })
    resolvedPage = Object.freeze({ ...page, data: Object.freeze({ ...page.data, category, records: table.data.records ?? [], search, tableState: table.data.tableState ?? page.data.tableState ?? {}, total: table.data.total ?? 0 }) })
  }
  const widgetResource = pageWidgetResource(resolvedPage, tableState)
  const embeddedWidgets = await resourceWidgets(registry, context.panelId, widgetResource?.resourceId ?? null)
  const resolvedWidgets = new Map(embeddedWidgets.map(widget => [widget.manifest.id, widget]))
  for (const widget of widgetDefinitions) resolvedWidgets.set(widget.manifest.id, widget)
  const [header, footer] = await Promise.all([
    resolvedPageWidgets(match.definition.manifest.widgets.header, [...resolvedWidgets.values()], resolutionContext, widgetResource, 'header'),
    resolvedPageWidgets(match.definition.manifest.widgets.footer, [...resolvedWidgets.values()], resolutionContext, widgetResource, 'footer'),
  ])
  return {
    bootstrap: {
      actor: await panel.server.presentActor(context.actor),
      manifest: panel.manifest,
      notifications: null,
      provider: context.provider,
    },
    page: resolvedPage,
    path: location,
    widgets: { footer, header },
  }
}

export function createGeneratedNuxtPanelsRuntime(registry: NuxtPanelServerRegistry): NuxtPanelRuntime<object> {
  return Object.freeze({
    async execute(context: NuxtPanelOperationContext<object>) {
      await context.getApp()
      if (context.operation === 'bootstrap' || context.operation === 'page-data') return { data: await pagePayload(context, registry) }
      if (context.operation === 'notification') {
        const panel = (await definitions(registry, context.panelId, 'panel')).find(item => item.manifest.id === context.panelId)
        if (!panel) throw Object.assign(new Error('Panel not found'), { statusCode: 404 })
        return { data: await executePanelDatabaseNotificationOperation({ panel, payload: context.input, scope: { actor: context.actor, guard: panel.guard, panelId: context.panelId, provider: context.provider, signal: context.signal } }) }
      }
      if (context.operation === 'global-search') {
        const panel = (await definitions(registry, context.panelId, 'panel')).find(item => item.manifest.id === context.panelId)
        if (!panel) throw Object.assign(new Error('Panel not found'), { statusCode: 404 })
        if (!panel.manifest.globalSearch) throw Object.assign(new Error('Global search is not enabled'), { statusCode: 404 })
        const scope = { actor: context.actor, guard: panel.guard, panelId: context.panelId, provider: context.provider, signal: context.signal }
        const tenancy = context.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
        const resources = await Promise.all(Object.entries(registry)
          .filter(([key]) => key.startsWith(`${context.panelId}:resource:`))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, loader]) => loader()))
        if (typeof context.input.term !== 'string') throw Object.assign(new Error('Search term is required'), { statusCode: 422 })
        return {
          data: await executeGeneratedGlobalSearch({
            actor: context.actor,
            panelId: context.panelId,
            panelPath: panel.manifest.path,
            resources,
            resourceOptIn: panel.manifest.globalSearchConfiguration?.resourceOptIn,
            signal: context.signal,
            strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
            tenant: context.tenant ?? tenancy?.tenantId,
            term: context.input.term,
            ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
            ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
          }),
        }
      }
      if (context.operation === 'upload') {
        const resourceId = context.input.resourceId
        if (typeof resourceId !== 'string') throw Object.assign(new Error('Resource ID is required'), { statusCode: 422 })
        const loader = registry[`${context.panelId}:resource:${resourceId}`]
        if (!loader) throw Object.assign(new Error('Resource not found'), { statusCode: 404 })
        const panel = (await definitions(registry, context.panelId, 'panel')).find(item => item.manifest.id === context.panelId)
        if (!panel) throw Object.assign(new Error('Panel not found'), { statusCode: 404 })
        const scope = { actor: context.actor, guard: panel.guard, panelId: context.panelId, provider: context.provider, signal: context.signal }
        const tenancy = context.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
        const body = Reflect.get(context.event, '_requestBody')
        if (!(body instanceof Uint8Array)) throw Object.assign(new Error('Upload request body is unavailable'), { statusCode: 400 })
        const contentType = context.event.node.req.headers['content-type']
        if (typeof contentType !== 'string') throw Object.assign(new Error('Upload content type is required'), { statusCode: 400 })
        const form = await new Response(body, { headers: { 'content-type': contentType } }).formData()
        const binary = form.get('contents')
        const contents = binary && typeof binary === 'object' && 'arrayBuffer' in binary && typeof binary.arrayBuffer === 'function'
          ? new Uint8Array(await binary.arrayBuffer())
          : undefined
        return {
          data: await executeGeneratedUploadOperation(await loader(), {
            ...(contents ? { contents } : {}),
            context: {
              actor: context.actor,
              signal: context.signal,
              tenant: context.tenant ?? tenancy?.tenantId,
              ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
              ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
            },
            panelId: context.panelId,
            payload: context.input,
            strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
          }),
        }
      }
      if (context.operation !== 'action' && context.operation !== 'form-submit' && context.operation !== 'options' && context.operation !== 'table-data') throw Object.assign(new Error('Panel operation not found'), { statusCode: 404 })
      const resourceId = context.input.resourceId
      if (typeof resourceId !== 'string') throw Object.assign(new Error('Resource ID is required'), { statusCode: 422 })
      const loader = registry[`${context.panelId}:resource:${resourceId}`]
      if (!loader) throw Object.assign(new Error('Resource not found'), { statusCode: 404 })
      const panel = (await definitions(registry, context.panelId, 'panel')).find(item => item.manifest.id === context.panelId)
      if (!panel) throw Object.assign(new Error('Panel not found'), { statusCode: 404 })
      const scope = { actor: context.actor, guard: panel.guard, panelId: context.panelId, provider: context.provider, signal: context.signal }
      const tenancy = context.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
      const result = await executeGeneratedResourceOperation(await loader(), {
        context: {
          actor: context.actor,
          signal: context.signal,
          tenant: context.tenant ?? tenancy?.tenantId,
          ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
          ...(tenancy?.scopeTenantQuery ? {
            scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>),
          } : {}),
        },
        operation: context.operation,
        panelId: context.panelId,
        payload: context.input,
        strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
      })
      return result
    },
    panels: {},
    registry,
  })
}
