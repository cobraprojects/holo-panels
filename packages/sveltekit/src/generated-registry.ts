import { createSvelteKitHoloHelpers } from '@holo-js/adapter-sveltekit'
import {
  executeWidgetTableOperation,
  executeGeneratedWidgetOperation,
  executeWidgetDataOperation,
  PanelRuntime,
  createNavigationSeed,
  executeGeneratedGlobalSearch,
  executeGeneratedResourceOperation,
  executeGeneratedUploadOperation,
  executePanelDatabaseNotificationOperation,
  preparePageRoutes,
  resolvePanelNavigationSeed,
  resolvePageData,
  requestedLocales,
  resolvePanelLocale,
  normalizeDashboardPage,
  resolvePageWidgetGroup,
  resolveDashboardLanding,
  toJsonValue,
  type CompiledPageDefinition,
  type CompiledPanelDefinition,
  type CompiledWidgetDefinition,
  type HoloAuth,
  type JsonObject,
  type JsonValue,
  type TableQueryState,
} from '@holo-js/panels-svelte/server'
import type {
  PanelAuthenticatedScope,
  PanelOperation,
  PanelOperationInput,
  PanelPageResolutionInput,
  PanelResolvedPageData,
  PanelRuntimeLike,
  SvelteKitPanelRegistry,
  SvelteKitPanelServerRegistry,
} from './contracts'
import { panelResolver } from './internal-registry'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const holo = createSvelteKitHoloHelpers()

interface TenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & TenantScopedQuery<TQuery>
}

function compiled(value: object): object {
  return 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
}

async function definitions(registry: SvelteKitPanelServerRegistry, panelId: string, kind: 'page'): Promise<readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[]>
async function definitions(registry: SvelteKitPanelServerRegistry, panelId: string, kind: 'panel'): Promise<readonly CompiledPanelDefinition<object>[]>
async function definitions(registry: SvelteKitPanelServerRegistry, panelId: string, kind: 'widget'): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]>
async function definitions(registry: SvelteKitPanelServerRegistry, panelId: string, kind: 'page' | 'panel' | 'widget'): Promise<readonly object[]> {
  const prefix = `${panelId}:${kind}:`
  const keys = Object.keys(registry).filter(key => key.startsWith(prefix) && IDENTIFIER.test(key.slice(prefix.length))).sort()
  const values = (await Promise.all(keys.map(key => registry[key]!()))).map(value => normalizeDashboardPage(compiled(value)) as object)
  if (kind !== 'widget') return values.filter(value => Reflect.get(value, 'kind') === kind)
  return Object.freeze(values.filter(value => Reflect.get(value, 'kind') === 'widget') as CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[])
}

async function resourceWidgets(registry: SvelteKitPanelServerRegistry, panelId: string, resourceId: string | null): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]> {
  if (!resourceId || !IDENTIFIER.test(resourceId)) return Object.freeze([])
  const loader = registry[`${panelId}:resource:${resourceId}`]
  if (!loader) return Object.freeze([])
  const resource = compiled(await loader())
  const widgets = Reflect.get(resource, 'widgets')
  return Object.freeze(Array.isArray(widgets) ? widgets.map(compiled).filter(value => Reflect.get(value, 'kind') === 'widget') as CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[] : [])
}

function pageWidgetResource(
  page: PanelResolvedPageData,
  tableState: Readonly<TableQueryState> | null,
): Readonly<{ readonly pageId: string, readonly record: JsonObject | null, readonly resourceId: string, readonly tableState: Readonly<TableQueryState> | null }> | null {
  const resource = page.manifest.body?.properties.resource
  if (!resource || typeof resource !== 'object' || Array.isArray(resource) || typeof resource.id !== 'string') return null
  const record = page.data.record
  return Object.freeze({ pageId: page.manifest.id, record: record && typeof record === 'object' && !Array.isArray(record) ? record : null, resourceId: resource.id, tableState })
}

function routeParameters(pattern: string, path: string): Readonly<Record<string, string>> | null {
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

function adaptedGuard(guard: object) {
  const refreshUser = Reflect.get(guard, 'refreshUser')
  const user = Reflect.get(guard, 'user')
  const provider = Reflect.get(guard, 'provider')
  return Object.freeze({
    provider: async (): Promise<string | null> => typeof provider === 'function' ? await Reflect.apply(provider, guard, []) as string | null : null,
    user: async (): Promise<object | null> => {
      const actor = typeof refreshUser === 'function'
        ? await Reflect.apply(refreshUser, guard, [])
        : typeof user === 'function' ? await Reflect.apply(user, guard, []) : null
      return actor && typeof actor === 'object' ? actor : null
    },
  })
}

async function auth(input: { readonly holo: PanelOperationInput['holo'] | PanelPageResolutionInput['holo'] }): Promise<HoloAuth<object>> {
  const binding = await input.holo.getAuth()
  if (!binding) throw Object.assign(new Error('Authentication is required'), { code: 'unauthenticated' })
  return Object.freeze({ guard: (name: string) => adaptedGuard(binding.guard(name)) })
}

async function discoveredPanel(registry: SvelteKitPanelServerRegistry, panelId: string): Promise<CompiledPanelDefinition<object>> {
  const pages = preparePageRoutes(await definitions(registry, panelId, 'page'))
  const panel = (await definitions(registry, panelId, 'panel')).find(item => item.manifest.id === panelId)
  if (!panel) throw Object.assign(new Error('Panel not found'), { code: 'panel-not-found' })
  return panelWithNavigation(panel, pages)
}

function generatedLocale(panel: CompiledPanelDefinition<object>, input: PanelOperationInput<object> | PanelPageResolutionInput<object>): string {
  const actorLocale = typeof input.scope.actor === 'object' && input.scope.actor !== null && 'locale' in input.scope.actor && typeof input.scope.actor.locale === 'string' ? input.scope.actor.locale : undefined
  return resolvePanelLocale(panel.manifest.locales, [...requestedLocales(input.event.request.headers.get('accept-language')), actorLocale]).locale
}

async function resolveGeneratedPage(input: PanelPageResolutionInput<object>, registry: SvelteKitPanelServerRegistry) {
  const pages = preparePageRoutes(await definitions(registry, input.panelId, 'page'))
  let match = pages.map(definition => ({ definition, parameters: routeParameters(definition.manifest.path, input.path) })).find(item => item.parameters !== null)
  const panel = await discoveredPanel(registry, input.panelId)
  const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
  const context = {
    guard: panel.guard,
    actor: input.scope.actor,
    locale: generatedLocale(panel, input),
    panelId: input.panelId,
    services: await input.holo.getProject(),
    signal: input.scope.signal,
    strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
    tenant: input.tenant ?? tenancy?.tenantId,
  }
  if (!match) {
    const dashboard = await resolveDashboardLanding(pages, input.path, panel.manifest.path, context)
    if (dashboard) match = { definition: dashboard, parameters: {} }
  }
  if (!match?.parameters) throw Object.assign(new Error('Panel page not found'), { code: 'panel-not-found' })
  const page = await resolvePageData(match.definition, { ...context, parameters: match.parameters })
  const search = input.event.url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? ''
  if (match.definition.manifest.pageType !== 'list' && match.definition.manifest.pageType !== 'manage') return page
  const resourceValue = match.definition.manifest.body?.properties.resource
  const resourceId = resourceValue && typeof resourceValue === 'object' && !Array.isArray(resourceValue) && typeof resourceValue.id === 'string' ? resourceValue.id : ''
  const loader = resourceId ? registry[`${input.panelId}:resource:${resourceId}`] : undefined
  if (!loader) throw Object.assign(new Error('Resource not found'), { status: 404 })
  const table = await executeGeneratedResourceOperation(await loader(), {
    context: {
      actor: input.scope.actor,
      locale: generatedLocale(panel, input),
      signal: input.scope.signal,
      tenant: input.tenant ?? tenancy?.tenantId,
      ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
      ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
    },
    operation: 'table-data',
    panelId: input.panelId,
    payload: { resourceId, search },
    strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
  })
  return Object.freeze({ ...page, data: Object.freeze({ ...page.data, filters: { search }, records: table.data.records ?? [], total: table.data.total ?? 0 }) })
}

async function resourceOperation(input: PanelOperationInput<object>, registry: SvelteKitPanelServerRegistry) {
  await input.holo.getProject()
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) throw Object.assign(new Error('Resource input is invalid'), { status: 422 })
  if (input.payload.widgetTable !== undefined) {
    if (input.operation !== 'action' && input.operation !== 'table-data') throw new Error('Unsupported table widget operation')
    const panel = await discoveredPanel(registry, input.panelId)
    const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
    return executeWidgetTableOperation(registry, input.operation, input.payload, {
      actor: input.scope.actor, locale: generatedLocale(panel, input), panelId: input.panelId,
      services: await input.holo.getProject(), signal: input.scope.signal, tenant: input.tenant ?? tenancy?.tenantId,
      ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
      ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
    }, panel)
  }
  if (input.operation === 'action' && input.payload.widgetId !== undefined) {
    const panel = await discoveredPanel(registry, input.panelId)
    const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
    return executeGeneratedWidgetOperation(registry, input.payload, {
      actor: input.scope.actor,
      locale: generatedLocale(panel, input),
      panelId: input.panelId,
      provider: input.scope.provider,
      services: await input.holo.getProject(),
      signal: input.scope.signal,
      tenant: input.tenant ?? tenancy?.tenantId,
      ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
      ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
    }, panel)
  }
  const resourceId = input.payload.resourceId
  if (typeof resourceId !== 'string') throw Object.assign(new Error('Resource ID is required'), { status: 422 })
  const loader = registry[`${input.panelId}:resource:${resourceId}`]
  if (!loader) throw Object.assign(new Error('Resource not found'), { status: 404 })
  const panel = await discoveredPanel(registry, input.panelId)
  const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
  return await executeGeneratedResourceOperation(await loader(), {
    context: {
      actor: input.scope.actor,
      locale: generatedLocale(panel, input),
      signal: input.scope.signal,
      tenant: input.tenant ?? tenancy?.tenantId,
      ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
      ...(tenancy?.scopeTenantQuery ? {
        scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>),
      } : {}),
    },
    operation: input.operation === 'action' ? 'action' : input.operation === 'options' ? 'options' : input.operation === 'table-data' ? 'table-data' : 'form-submit',
    panel,
    panelId: input.panelId,
    payload: input.payload,
    strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
  })
}

async function uploadOperation(input: PanelOperationInput<object>, registry: SvelteKitPanelServerRegistry) {
  await input.holo.getProject()
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) throw Object.assign(new Error('Upload input is invalid'), { status: 422 })
  const resourceId = input.payload.resourceId
  if (typeof resourceId !== 'string') throw Object.assign(new Error('Resource ID is required'), { status: 422 })
  const loader = registry[`${input.panelId}:resource:${resourceId}`]
  if (!loader) throw Object.assign(new Error('Resource not found'), { status: 404 })
  const panel = await discoveredPanel(registry, input.panelId)
  const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
  const form = await input.event.request.formData()
  const binary = form.get('contents')
  const contents = binary && typeof binary === 'object' && 'arrayBuffer' in binary && typeof binary.arrayBuffer === 'function'
    ? new Uint8Array(await binary.arrayBuffer())
    : undefined
  return {
    data: await executeGeneratedUploadOperation(await loader(), {
      ...(contents ? { contents } : {}),
      context: {
        actor: input.scope.actor,
        signal: input.scope.signal,
        tenant: input.tenant ?? tenancy?.tenantId,
        ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
        ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
      },
      panelId: input.panelId,
      payload: input.payload,
      strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
    }),
  }
}

async function globalSearchOperation(input: PanelOperationInput<object>, registry: SvelteKitPanelServerRegistry) {
  await input.holo.getProject()
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload) || typeof input.payload.term !== 'string') {
    throw Object.assign(new Error('Search term is required'), { status: 422 })
  }
  const panel = await discoveredPanel(registry, input.panelId)
  if (!panel.manifest.globalSearch) throw Object.assign(new Error('Global search is not enabled'), { status: 404 })
  const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
  const resources = await Promise.all(Object.entries(registry)
    .filter(([key]) => key.startsWith(`${input.panelId}:resource:`))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, loader]) => loader()))
  return {
    data: await executeGeneratedGlobalSearch({
      actor: input.scope.actor,
      panelId: input.panelId,
      panelPath: panel.manifest.path,
      resources,
      resourceOptIn: panel.manifest.globalSearchConfiguration?.resourceOptIn,
      signal: input.scope.signal,
      strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
      tenant: input.tenant ?? tenancy?.tenantId,
      term: input.payload.term,
      ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
      ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
    }),
  }
}

export function createGeneratedSvelteKitPanelsRegistry(serverRegistry: SvelteKitPanelServerRegistry): SvelteKitPanelRegistry<object> {
  const runtime: PanelRuntimeLike<object> = {
    async bootstrap(panelIds: readonly string[], signal: AbortSignal, requestedLocale?: string) {
      const panels = await Promise.all(panelIds.map(panelId => discoveredPanel(serverRegistry, panelId)))
      const panelRuntime = new PanelRuntime(await auth({ holo }), panels)
      const bootstraps = await panelRuntime.bootstrap(panelIds, signal, requestedLocale)
      return await Promise.all(bootstraps.map(async bootstrap => {
        const panel = panels.find(candidate => candidate.manifest.id === bootstrap.manifest.id)!
        const pages = preparePageRoutes(await definitions(serverRegistry, bootstrap.manifest.id, 'page'))
        const navigation = await panelRuntime.execute(bootstrap.manifest.id, 'bootstrap', signal, async scope => {
          const tenancy = panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
          return await resolvePanelNavigationSeed(panel.manifest.navigation, pages, {
            actor: scope.actor,
            locale: bootstrap.locale,
            panelId: bootstrap.manifest.id,
            services: await holo.getProject(),
            signal,
            tenant: tenancy?.tenantId,
          })
        })
        return Object.freeze({ ...bootstrap, manifest: Object.freeze({ ...bootstrap.manifest, navigation }) })
      }))
    },
    async execute<TResult>(panelId: string, operation: PanelOperation, signal: AbortSignal, handler: (scope: PanelAuthenticatedScope<object>) => TResult | Promise<TResult>): Promise<TResult> {
      const panel = await discoveredPanel(serverRegistry, panelId)
      return await new PanelRuntime(await auth({ holo }), [panel]).execute(panelId, operation, signal, handler)
    },
  }
  return Object.freeze({
    [panelResolver]: (panelId: string) => discoveredPanel(serverRegistry, panelId),
    operations: {
      'page-data': async (input: PanelOperationInput<object>) => {
        const panel = await discoveredPanel(serverRegistry, input.panelId)
        const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
        return { data: await executeWidgetDataOperation(serverRegistry, objectPayload(input.payload), {
          actor: input.scope.actor, locale: generatedLocale(panel, input), panelId: input.panelId,
          services: await input.holo.getProject(), signal: input.scope.signal, tenant: input.tenant ?? tenancy?.tenantId,
          ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
          ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
        }, panel) }
      },
      action: (input: PanelOperationInput<object>) => resourceOperation(input, serverRegistry),
      'form-submit': (input: PanelOperationInput<object>) => resourceOperation(input, serverRegistry),
      'global-search': (input: PanelOperationInput<object>) => globalSearchOperation(input, serverRegistry),
      notification: async (input: PanelOperationInput<object>) => {
        await input.holo.getProject()
        const result = await executePanelDatabaseNotificationOperation({ panel: await discoveredPanel(serverRegistry, input.panelId), payload: input.payload, registry: serverRegistry, scope: input.scope })
        return { data: toJsonValue(result), effects: 'effects' in result ? result.effects : [] }
      },
      options: (input: PanelOperationInput<object>) => resourceOperation(input, serverRegistry),
      'table-data': (input: PanelOperationInput<object>) => resourceOperation(input, serverRegistry),
      upload: (input: PanelOperationInput<object>) => uploadOperation(input, serverRegistry),
    },
    async resolvePage(input: PanelPageResolutionInput<object>) {
      return await resolveGeneratedPage(input, serverRegistry)
    },
    async resolveWidgets(input: PanelPageResolutionInput<object> & { readonly page: PanelResolvedPageData }) {
      const panel = await discoveredPanel(serverRegistry, input.panelId)
      const tenancy = input.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(input.scope) : null
      const context = {
        actor: input.scope.actor,
        locale: generatedLocale(panel, input),
        panelId: input.panelId,
        services: await input.holo.getProject(),
        signal: input.scope.signal,
        tenant: input.tenant ?? tenancy?.tenantId,
      }
      const widgets = await definitions(serverRegistry, input.panelId, 'widget')
      const search = input.event.url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? ''
      const tableState: Readonly<TableQueryState> | null = input.page.manifest.pageType === 'list' || input.page.manifest.pageType === 'manage'
        ? Object.freeze({ filters: Object.freeze([]), includeTotal: true, page: 1, pagination: 'page', perPage: 25, search, sort: Object.freeze([]) })
        : null
      const resource = pageWidgetResource(input.page, tableState)
      const embeddedWidgets = await resourceWidgets(serverRegistry, input.panelId, resource?.resourceId ?? null)
      const resolvedWidgets = new Map(embeddedWidgets.map(widget => [widget.manifest.id, widget]))
      for (const widget of widgets) resolvedWidgets.set(widget.manifest.id, widget)
      const [header, footer] = await Promise.all([
        resolvePageWidgetGroup(input.page.manifest.widgets.header, [...resolvedWidgets.values()], context, resource, 'header', { pageId: input.page.manifest.id, parameters: routeParameters(input.page.manifest.path, input.path) ?? {} }, input.page.data.filters as JsonObject | undefined, panel, input.page.data.filtersValid !== false),
        resolvePageWidgetGroup(input.page.manifest.widgets.footer, [...resolvedWidgets.values()], context, resource, 'footer', { pageId: input.page.manifest.id, parameters: routeParameters(input.page.manifest.path, input.path) ?? {} }, input.page.data.filters as JsonObject | undefined, panel, input.page.data.filtersValid !== false),
      ])
      return Object.freeze({ footer, header })
    },
    runtime,
  })
}

function objectPayload(value: JsonValue): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Widget requests require objects')
  return value
}
