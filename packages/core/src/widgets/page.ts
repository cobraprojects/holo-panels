import type { JsonObject } from '../protocol/json'
import type { CompiledPageDefinition, PageContext, PageManifest } from '../pages/contracts'
import type { CompiledDashboardDefinition, DashboardManifest } from './contracts'
import { DashboardFilterValidationError, resolveDashboardFilters, resolveDashboardFilterForm } from './filter-form'
import { dashboardFilterSession } from './filter-session'
import type { WidgetContext } from './contracts'
import { selectDefaultDashboard } from './dashboard'

export function dashboardPage<TActor, TTenant, TServices>(definition: CompiledDashboardDefinition<TActor, TTenant, TServices>): CompiledPageDefinition<JsonObject, TActor, TTenant, TServices> {
  const dashboard = definition.manifest
  const manifest: PageManifest = {
      actions: { footer: [], header: [] },
      body: { component: 'dashboard', properties: { dashboard } },
      id: dashboard.id,
      navigation: { ...dashboard.navigation, badge: null, group: null, parent: null },
      pageType: 'custom',
      path: dashboard.path,
      renderer: null,
      schemaId: null,
      widgets: { footer: [], header: dashboard.widgets },
  }
  const cache = new WeakMap<object, Promise<{ schema: JsonObject | null, filters: JsonObject, filtersValid: boolean }>>()
  const resolveFilters = (context: PageContext<TActor, TTenant, TServices>) => {
    const existing = cache.get(context)
    if (existing) return existing
    const pending = (async () => {
      if (dashboard.persistFilters && !context.guard) throw new Error('Dashboard persistence requires the panel guard')
      const session = dashboard.persistFilters && context.guard ? await dashboardFilterSession(context, dashboard.id, context.guard) : null
      const saved = session?.read() ?? {}
      let form = await resolveDashboardFilterForm(definition.server.filters, saved)
      let schema = form?.schema ?? dashboard.filters
      try { return { schema, filters: await resolveDashboardFilters(schema, form?.values ?? saved), filtersValid: true } } catch (error) {
        if (!(error instanceof DashboardFilterValidationError) && Object.keys(saved).length === 0) throw error
        await session?.write(null)
        form = await resolveDashboardFilterForm(definition.server.filters)
        schema = form?.schema ?? dashboard.filters
        const filters = await resolveDashboardFilters(schema, form?.values ?? {}, false)
        try { await resolveDashboardFilters(schema, filters); return { schema, filters, filtersValid: true } } catch (error) {
          if (!(error instanceof DashboardFilterValidationError)) throw error
          return { schema, filters, filtersValid: false }
        }
      }
    })().finally(() => cache.delete(context))
    cache.set(context, pending)
    return pending
  }
  return {
    kind: 'page',
    manifest,
    server: {
      authorize: definition.server.authorize,
      heading: dashboard.navigation.label,
      title: dashboard.navigation.label,
      async manifest(context) {
        const { schema } = await resolveFilters(context)
        return { ...manifest, body: { component: 'dashboard', properties: { dashboard: { ...dashboard, filters: schema } } } }
      },
      async load(context) {
        const { filters, filtersValid } = await resolveFilters(context)
        return { filters, filtersValid }
      },
    },
  }
}

export function normalizeDashboardPage(value: unknown): unknown {
  if (value && typeof value === 'object' && 'kind' in value && value.kind === 'dashboard') return dashboardPage(value as CompiledDashboardDefinition<unknown, unknown, unknown>)
  return value
}

export async function resolveDashboardLanding<TActor, TTenant, TServices>(pages: readonly CompiledPageDefinition<JsonObject, TActor, TTenant, TServices>[], path: string, panelPath: string, context: WidgetContext<NoInfer<TActor>, NoInfer<TTenant>, NoInfer<TServices>>): Promise<CompiledPageDefinition<JsonObject, TActor, TTenant, TServices> | null> {
  if (path.replace(/\/$/u, '') !== panelPath.replace(/\/$/u, '')) return null
  const dashboards = pages.flatMap(page => {
    const dashboard = page.manifest.body?.properties.dashboard
    if (page.manifest.body?.component !== 'dashboard' || !dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)) return []
    return [{
      kind: 'dashboard' as const,
      manifest: dashboard as DashboardManifest,
      server: { authorize: (scope: WidgetContext<TActor, TTenant, TServices>) => page.server.authorize({ ...scope, parameters: {} }) },
    }]
  })
  const selected = await selectDefaultDashboard(dashboards, context)
  return pages.find(page => page.manifest.id === selected?.manifest.id) ?? null
}
