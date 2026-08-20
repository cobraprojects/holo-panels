import { createNextRequestContext, runWithNextRequest } from '@holo-js/adapter-next/runtime'
import {
  PROTOCOL_VERSION,
  decodeResponseEnvelope,
  type CompiledPageDefinition,
  type CompiledPanelDefinition,
  type JsonObject,
  type Effect,
  type JsonValue,
  type PanelAuthenticatedScope,
} from '@holo-js/panels-react'
import {
  PanelRuntime,
  createNavigationSeed,
  preparePageRoutes,
  resolvePageData,
  resolveWidget,
  type CompiledWidgetDefinition,
  type ResolvedWidget,
  type TableQueryState,
} from '@holo-js/panels-react/server'
import type { NextPanelPagePayload, NextPanelsRuntime } from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
let installedRuntime: NextPanelsRuntime | null = null

interface TenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & TenantScopedQuery<TQuery>
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} must be a stable identifier`)
}

function compiled(value: unknown): unknown {
  if ((typeof value === 'object' && value !== null || typeof value === 'function') && 'compile' in value && typeof value.compile === 'function') return value.compile()
  return value
}

function isPanel(value: unknown): value is CompiledPanelDefinition<object> {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'kind') === 'panel'
}

function isPage(value: unknown): value is CompiledPageDefinition<JsonObject, object, unknown, unknown> {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'kind') === 'page'
}

function isWidget(value: unknown): value is CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object> {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'kind') === 'widget'
}

function registryKeys(runtime: NextPanelsRuntime, panelId: string, kind: 'page' | 'panel' | 'widget'): readonly string[] {
  const prefix = `${panelId}:${kind}:`
  return Object.keys(runtime.registry).filter(key => key.startsWith(prefix) && IDENTIFIER.test(key.slice(prefix.length))).sort()
}

async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'page'): Promise<readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[]>
async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'panel'): Promise<readonly CompiledPanelDefinition<object>[]>
async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'widget'): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]>
async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'page' | 'panel' | 'widget'): Promise<readonly unknown[]> {
  const values = await Promise.all(registryKeys(runtime, panelId, kind).map(key => runtime.registry[key]!()))
  const compiledValues = values.map(value => compiled(value))
  if (kind === 'panel') return compiledValues.filter(isPanel)
  if (kind === 'page') return compiledValues.filter(isPage)
  return Object.freeze(compiledValues.filter(isWidget))
}

async function resourceWidgets(
  runtime: NextPanelsRuntime,
  panelId: string,
  resourceId: string | null,
): Promise<readonly CompiledWidgetDefinition<JsonValue, object, unknown, unknown, object>[]> {
  if (!resourceId || !IDENTIFIER.test(resourceId)) return Object.freeze([])
  const loader = runtime.registry[`${panelId}:resource:${resourceId}`]
  if (!loader) return Object.freeze([])
  const definition = compiled(await loader())
  const widgets = definition && typeof definition === 'object' ? Reflect.get(definition, 'widgets') : null
  return Object.freeze(Array.isArray(widgets) ? widgets.map(widget => compiled(widget)).filter(isWidget) : [])
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
  page: Awaited<ReturnType<typeof resolvePageData>>,
  tableState: Readonly<TableQueryState> | null,
): Readonly<{ readonly pageId: string, readonly record: JsonObject | null, readonly resourceId: string, readonly tableState: Readonly<TableQueryState> | null }> | null {
  const resource = page.manifest.body?.properties.resource
  if (!resource || typeof resource !== 'object' || Array.isArray(resource) || typeof resource.id !== 'string') return null
  const record = page.data.record
  return Object.freeze({
    pageId: page.manifest.id,
    record: record && typeof record === 'object' && !Array.isArray(record) ? record : null,
    resourceId: resource.id,
    tableState,
  })
}

function panelWithDiscoveredNavigation(
  panel: CompiledPanelDefinition<object>,
  pages: readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[],
): CompiledPanelDefinition<object> {
  const navigationById = new Map(createNavigationSeed(pages).map(item => [item.id, item]))
  for (const item of panel.manifest.navigation) navigationById.set(item.id, item)
  const navigation = Object.freeze([...navigationById.values()]
    .sort((left, right) => left.sort - right.sort || left.label.localeCompare(right.label) || left.id.localeCompare(right.id)))
  return Object.freeze({
    ...panel,
    manifest: Object.freeze({ ...panel.manifest, navigation }),
  })
}

function pageParameters(pattern: string, path: string): Readonly<Record<string, string>> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const parameters: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const expectedSegment = expected[index]!
    const actualSegment = actual[index]!
    if (expectedSegment.startsWith(':')) parameters[expectedSegment.slice(1)] = decodeURIComponent(actualSegment)
    else if (expectedSegment !== actualSegment) return null
  }
  return Object.freeze(parameters)
}

function safeSegments(segments: readonly string[]): readonly string[] {
  return segments.map(segment => {
    if (!segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\') || /%(?:2e|2f|5c)/iu.test(segment)) {
      throw new Error('Panel paths contain an unsafe segment')
    }
    return encodeURIComponent(decodeURIComponent(segment))
  })
}

function panelAcceptsHost(panel: CompiledPanelDefinition<object>, request: Request): boolean {
  const routing = panel.manifest.routing
  if (!routing) return true
  const hosts = [...routing.domains, ...(routing.domain === null ? [] : [routing.domain])]
  return hosts.length === 0 || hosts.includes(new URL(request.url).hostname.toLowerCase())
}

async function auth(runtime: NextPanelsRuntime) {
  return typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
}

function sessionEffectKey(panelId: string): string {
  return `panels.effects.${panelId}`
}

function decodedSessionEffects(value: unknown): readonly Effect[] {
  if (!Array.isArray(value)) return Object.freeze([])
  try {
    return Object.freeze(decodeResponseEnvelope({
      data: null,
      effects: value,
      id: 'session-effects',
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
    }, 'session-effects').effects.filter(effect => effect.kind === 'toast'))
  } catch {
    return Object.freeze([])
  }
}

async function takeSessionEffects(
  guard: { readonly take?: <TValue = unknown>(key: string) => Promise<TValue | undefined> },
  panelId: string,
): Promise<readonly Effect[]> {
  if (!guard.take) return Object.freeze([])
  try {
    return decodedSessionEffects(await guard.take(sessionEffectKey(panelId)))
  } catch {
    return Object.freeze([])
  }
}

export function registerNextPanelsRuntime(runtime: NextPanelsRuntime): () => void {
  const previous = installedRuntime
  installedRuntime = runtime
  return () => {
    if (installedRuntime === runtime) installedRuntime = previous
  }
}

export function requireNextPanelsRuntime(runtime?: NextPanelsRuntime): NextPanelsRuntime {
  const resolved = runtime ?? installedRuntime
  if (!resolved) throw new Error('[Holo Panels] Next runtime is unavailable. Run `holo prepare` and register its generated panels server registry.')
  return resolved
}

export async function resolveNextPanelPath(panelId: string, runtimeInput?: NextPanelsRuntime): Promise<string> {
  assertIdentifier(panelId, 'Panel IDs')
  const runtime = requireNextPanelsRuntime(runtimeInput)
  const panels = await definitions(runtime, panelId, 'panel')
  const panel = panels.find(definition => definition.manifest.id === panelId)
  if (!panel) throw new NextPanelPageNotFoundError(`panel:${panelId}`)
  return panel.manifest.path
}

export async function resolveNextPanelBillingResponse(
  panelId: string,
  panelsPath: readonly string[],
  request: Request,
  runtimeInput?: NextPanelsRuntime,
): Promise<Response | null> {
  assertIdentifier(panelId, 'Panel IDs')
  const runtime = requireNextPanelsRuntime(runtimeInput)
  const panels = await definitions(runtime, panelId, 'panel')
  const panel = panels.find(definition => definition.manifest.id === panelId)
  if (!panel) throw new NextPanelPageNotFoundError(`panel:${panelId}`)
  if (!panelAcceptsHost(panel, request)) throw new NextPanelPageNotFoundError(`panel:${panelId}`)
  const billingPath = panel.manifest.tenancy?.billing?.path
  const path = `${panel.manifest.path === '/' ? '' : panel.manifest.path}/${safeSegments(panelsPath).join('/')}`.replace(/\/$/u, '') || '/'
  if (!billingPath || path !== billingPath) return null
  const billing = panel.server.tenancy?.billing
  if (!billing) throw new NextPanelPageNotFoundError(path)
  const action = billing.getRouteAction()
  if (typeof action !== 'function') throw new TypeError('Panel tenant billing providers must return a route action function')
  const resolvedAuth = await auth(runtime)
  const panelRuntime = new PanelRuntime(resolvedAuth, [panel])
  return panelRuntime.execute(panelId, 'bootstrap', request.signal, scope => action(request, scope))
}

export async function resolveNextPanelPage(
  panelId: string,
  panelsPath: readonly string[],
  request: Request,
  runtimeInput?: NextPanelsRuntime,
): Promise<NextPanelPagePayload> {
  assertIdentifier(panelId, 'Panel IDs')
  const runtime = requireNextPanelsRuntime(runtimeInput)
  const panels = await definitions(runtime, panelId, 'panel')
  const discoveredPanel = panels.find(definition => definition.manifest.id === panelId)
  if (!discoveredPanel) throw new Error(`[Holo Panels] Generated registry does not contain panel "${panelId}".`)
  if (!panelAcceptsHost(discoveredPanel, request)) throw new NextPanelPageNotFoundError(`panel:${panelId}`)
  const pages = preparePageRoutes(await definitions(runtime, panelId, 'page'))
  const widgetDefinitions = await definitions(runtime, panelId, 'widget')
  const panel = panelWithDiscoveredNavigation(discoveredPanel, pages)
  const path = `${panel.manifest.path === '/' ? '' : panel.manifest.path}/${safeSegments(panelsPath).join('/')}`.replace(/\/$/u, '') || '/'
  const match = pages.map(definition => ({ definition, parameters: pageParameters(definition.manifest.path, path) }))
    .find(candidate => candidate.parameters !== null)
  if (!match?.parameters) throw new NextPanelPageNotFoundError(path)
  const nextContext = createNextRequestContext(request)
  return runWithNextRequest(nextContext, async () => {
    const resolvedAuth = await auth(runtime)
    const panelRuntime = new PanelRuntime(resolvedAuth, [panel])
    const bootstrap = (await panelRuntime.bootstrap([panelId], request.signal))[0]!
    const pageResult = await panelRuntime.execute(panelId, 'page-data', request.signal, async (scope: PanelAuthenticatedScope<object>) => {
      const tenantContext = runtime.resolveTenant || !panel.server.tenancy ? undefined : await panel.server.tenancy.activeContext(scope)
      const context = {
        actor: scope.actor,
        locale: await runtime.resolveLocale?.(request) ?? 'en',
        panelId,
        services: await runtime.resolveServices?.(request),
        signal: request.signal,
        strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
        tenant: runtime.resolveTenant ? await runtime.resolveTenant(request) : tenantContext?.tenantId,
      }
      const loadedPage = await resolvePageData(match.definition, { ...context, parameters: match.parameters! })
      let page = loadedPage
      let tableState: Readonly<TableQueryState> | null = loadedPage.manifest.pageType === 'list'
        ? Object.freeze({ filters: Object.freeze([]), includeTotal: true, page: 1, pagination: 'page', perPage: 25, search: '', sort: Object.freeze([]) })
        : null
      const search = new URL(request.url).searchParams.get('search')?.trim() ?? ''
      if (search && loadedPage.manifest.pageType === 'list' && runtime.execute) {
        const resourceValue = loadedPage.manifest.body?.properties.resource
        const resourceId = resourceValue && typeof resourceValue === 'object' && !Array.isArray(resourceValue) && typeof resourceValue.id === 'string' ? resourceValue.id : ''
        if (resourceId) {
          const result = await runtime.execute({
            operation: 'table-data',
            panelId,
            payload: { resourceId, search },
            request,
            scope: {
              actor: scope.actor,
              locale: context.locale,
              panelId,
              parameters: match.parameters!,
              provider: scope.provider,
              request,
              services: context.services,
              signal: request.signal,
              tenant: context.tenant,
              ...(tenantContext?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenantContext.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
              ...(tenantContext?.tenantBindings ? { tenantBindings: tenantContext.tenantBindings } : {}),
            },
          })
          const data = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : {}
          tableState = Object.freeze({ filters: Object.freeze([]), includeTotal: true, page: 1, pagination: 'page', perPage: 25, search, sort: Object.freeze([]) })
          page = Object.freeze({ ...loadedPage, data: Object.freeze({ ...loadedPage.data, records: data.records ?? [], search, tableState: data.tableState ?? loadedPage.data.tableState ?? {}, total: data.total ?? 0 }) })
        }
      }
      const widgetResource = pageWidgetResource(page, tableState)
      const embeddedWidgets = await resourceWidgets(runtime, panelId, widgetResource?.resourceId ?? null)
      const resolvedWidgets = new Map(embeddedWidgets.map(widget => [widget.manifest.id, widget]))
      for (const widget of widgetDefinitions) resolvedWidgets.set(widget.manifest.id, widget)
      const [header, footer] = await Promise.all([
        resolvedPageWidgets(match.definition.manifest.widgets.header, [...resolvedWidgets.values()], context, widgetResource, 'header'),
        resolvedPageWidgets(match.definition.manifest.widgets.footer, [...resolvedWidgets.values()], context, widgetResource, 'footer'),
      ])
      return { page, widgets: { footer, header } }
    })
    const effects = await takeSessionEffects(resolvedAuth.guard(panel.guard), panelId)
    return Object.freeze({ bootstrap: bootstrap as unknown as NextPanelPagePayload['bootstrap'], effects, page: pageResult.page, path, widgets: pageResult.widgets })
  })
}

export class NextPanelPageNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Panel page "${path}" was not found`)
    this.name = 'NextPanelPageNotFoundError'
  }
}

export const nextPanelsRuntimeInternals = {
  definitions,
  panelWithDiscoveredNavigation,
  panelAcceptsHost,
  pageParameters,
  registryKeys,
  safeSegments,
}
