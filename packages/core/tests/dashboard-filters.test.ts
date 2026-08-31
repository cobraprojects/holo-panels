import { afterEach, describe, expect, it } from 'vitest'
import { authRuntimeInternals, configureAuthRuntime, defineAuthConfig, resetAuthRuntime } from '@holo-js/auth'
import { defineDashboard } from '../src/widgets/dashboard'
import { dashboardPage, resolveDashboardLanding } from '../src/widgets/page'
import { executeWidgetDataOperation } from '../src/widgets/page-data'
import { resolvePageData } from '../src/pages/resolution'
import { definePanel } from '../src/panels/panel'
import { resolveDashboardFilterForm } from '../src/widgets/filter-form'

afterEach(() => resetAuthRuntime())

function fixture() {
  const authContext = authRuntimeInternals.createMemoryAuthContext()
  authContext.setSessionId('web', 'session')
  const now = new Date()
  let record = { id: 'session', store: 'database', data: { existing: 'retained' } as Readonly<Record<string, unknown>>, createdAt: now, lastActivityAt: now, expiresAt: new Date(now.getTime() + 60_000) }
  configureAuthRuntime({
    config: defineAuthConfig({ defaults: { guard: 'web' }, guards: { web: { driver: 'session', provider: 'users' } }, providers: { users: { model: 'User' } } }),
    context: authContext,
    providers: {},
    session: {
      create: async () => record,
      read: async () => record,
      write: async value => { record = value; return value },
      touch: async () => record,
      invalidate: async () => undefined,
      issueRememberMeToken: async () => 'token',
      sessionCookie: value => value,
      rememberMeCookie: value => value,
    },
  })
  const context = { actor: { id: 1 }, guard: 'web', locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: 'acme', parameters: {} }
  const dashboard = defineDashboard('metrics').filtersForm({ fields: [{ path: 'search', type: 'text', defaultValue: 'all', required: true }] }).persistFiltersInSession().compile()
  const registry = { 'admin:page:metrics': async () => dashboard }
  return { context, dashboard, registry, panel: definePanel('admin').compile(), record: () => record }
}

describe('dashboard filter session boundary', () => {
  it('resolves one canonical tree with deterministic dependent defaults and hydrated values', async () => {
    const resolved = await resolveDashboardFilterForm({ components: [
      { path: 'period', type: 'text', disabled: false, defaultValue: 'all', server: { defaultValue: () => 'month', disabled: () => true } },
      { path: 'derived', type: 'text', disabled: true, server: { defaultValue: ({ get }: { get: (path: string) => string }) => get('period') } },
      { path: 'first', type: 'text', server: { defaultValue: () => 'base' } },
      { path: 'second', type: 'text', server: { defaultValue: ({ get }: { get: (path: string) => string }) => get('first') } },
      { path: 'term', type: 'text', defaultValue: 'draft', server: { hydrate: ({ value }: { value: string }) => value.toUpperCase() } },
    ] }, { period: 'forged' })
    expect(resolved?.values).toEqual({ period: 'month', derived: 'month', first: 'base', second: 'base', term: 'DRAFT' })
    expect(resolved?.schema.components).toBeUndefined()
    const reversed = await resolveDashboardFilterForm({ fields: [
      { path: 'derived', type: 'text', disabled: true, dependencies: ['locked'], server: { defaultValue: ({ get }: { get: (path: string) => string }) => get('locked') } },
      { path: 'locked', type: 'text', disabled: true, defaultValue: 'safe' },
    ] }, { locked: 'forged' })
    expect(reversed?.values).toEqual({ derived: 'safe', locked: 'safe' })
  })

  it('retains server field callbacks, accepts required input after initial render, and protects disabled fields', async () => {
    const { context, panel } = fixture()
    const dashboard = defineDashboard('metrics').filtersForm({ fields: [
      { path: 'search', type: 'text', required: true },
      { path: 'period', type: 'text', defaultValue: 'all', server: { defaultValue: () => 'month', disabled: () => true } },
      { path: 'internal', type: 'text', server: { visible: () => false } },
    ] }).persistFiltersInSession().compile()
    const page = await resolvePageData(dashboardPage(dashboard), context)
    expect(page.data).toMatchObject({ filters: { search: '', period: 'month' }, filtersValid: false })
    expect(page.manifest.body?.properties.dashboard).toMatchObject({ filters: { fields: [
      { path: 'search' }, { path: 'period', disabled: true, defaultValue: 'month' }, { path: 'internal', visible: false },
    ] } })
    expect(JSON.stringify(page)).not.toContain('server')
    const registry = { 'admin:page:metrics': async () => dashboard }
    expect(await executeWidgetDataOperation(registry, { pageId: 'metrics', dashboardFilters: { search: 'draft', period: 'forged', internal: 'forged' } }, context, panel)).toMatchObject({ status: 'ready', filters: { search: 'draft', period: 'month', internal: '' } })
    expect(await executeWidgetDataOperation(registry, { pageId: 'metrics', resetFilters: true }, context, panel)).toMatchObject({ status: 'ready', filters: { search: '', period: 'month' } })
    await expect(executeWidgetDataOperation(registry, { pageId: 'metrics', widgetId: 'sales', resetFilters: true }, context, panel)).rejects.toThrow('Widget refresh cannot reset')
    expect((await resolvePageData(dashboardPage(dashboard), context)).data).toMatchObject({ filters: { search: '' }, filtersValid: false })
  })

  it('validates submissions, restores only the same actor/panel/tenant/dashboard scope, and resets defaults', async () => {
    const { context, dashboard, registry, panel, record } = fixture()
    const page = dashboardPage(dashboard)
    expect((await resolvePageData(page, context)).data.filters).toEqual({ search: 'all' })
    expect(await executeWidgetDataOperation(registry, { pageId: 'metrics', dashboardFilters: { search: '' } }, context, panel)).toMatchObject({ status: 'invalid' })
    await expect(executeWidgetDataOperation(registry, { pageId: 'metrics', dashboardFilters: { injected: 'secret' } }, context, panel)).rejects.toThrow('Unknown dashboard filter')
    expect(await executeWidgetDataOperation(registry, { pageId: 'metrics', dashboardFilters: { search: 'draft' } }, context, panel)).toMatchObject({ status: 'ready', filters: { search: 'draft' } })
    expect((await resolvePageData(page, context)).data.filters).toEqual({ search: 'draft' })
    for (const scope of [{ ...context, actor: { id: 2 } }, { ...context, tenant: 'globex' }, { ...context, panelId: 'other' }]) {
      expect((await resolvePageData(page, scope)).data.filters).toEqual({ search: 'all' })
    }
    const other = dashboardPage({ ...dashboard, manifest: { ...dashboard.manifest, id: 'reports' } })
    expect((await resolvePageData(other, context)).data.filters).toEqual({ search: 'all' })
    expect(record().data.existing).toBe('retained')
    await executeWidgetDataOperation(registry, { pageId: 'metrics', resetFilters: true }, context, panel)
    expect((await resolvePageData(page, context)).data.filters).toEqual({ search: 'all' })
    expect(Object.keys(record().data)).toEqual(['existing'])
  })

  it('chooses an authorized dashboard at the panel root and preserves unknown-route failures', async () => {
    const { context } = fixture()
    const pages = [dashboardPage(defineDashboard('restricted').default().authorize(() => false).compile()), dashboardPage(defineDashboard('reports').navigation('Reports', { sort: 2 }).compile())]
    expect((await resolveDashboardLanding(pages, '/admin', '/admin', context))?.manifest.id).toBe('reports')
    expect(await resolveDashboardLanding(pages, '/admin/missing', '/admin', context)).toBeNull()
  })
})
