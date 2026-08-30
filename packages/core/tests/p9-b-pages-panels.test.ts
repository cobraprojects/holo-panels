import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  defineCreatePage,
  defineCustomPage,
  defineEditPage,
  defineListPage,
  defineRelatedRecordPage,
  defineSingularPage,
  defineViewPage,
  type PageBuilder,
} from '../src/pages/page'
import { PageAccessError, preparePageRoutes, resolvePageData } from '../src/pages/resolution'
import { createNavigationSeed, resolvePanelNavigationSeed } from '../src/panels/navigation'
import { definePanel, type PanelBuilder } from '../src/panels/panel'
import { PanelRuntime, type PanelRuntimeError } from '../src/panels/runtime'
import type { JsonObject } from '../src/protocol/json'
import { defineSchema, schemaComponentsFor } from '../src/schemas'
import type { HoloAuth, PanelOperation } from '../src/panels/contracts'

class Actor {
  declare readonly id: number
  declare readonly role: string
}

class Services {
  declare readonly source: string
}

class PageSchemaValues {}

class PageSchemaContext {
  declare readonly actor: { readonly id: number, readonly role: string }
  declare readonly locale: string
  declare readonly panelId: string
  declare readonly parameters: Readonly<Record<string, string>>
  declare readonly services: { readonly source: string }
  declare readonly signal: AbortSignal
  declare readonly tenant: string
}

const signal = new AbortController().signal

describe('P9-B page definitions', () => {
  it('defines every built-in page type and preserves fluent concrete types', () => {
    const definitions = [
      defineListPage('posts'),
      defineCreatePage('create-post'),
      defineEditPage('edit-post'),
      defineViewPage('view-post'),
      defineCustomPage('dashboard'),
      defineSingularPage('settings'),
      defineRelatedRecordPage('post-comments'),
    ].map(page => page.compile())

    expect(definitions.map(page => page.manifest.pageType)).toEqual([
      'list',
      'create',
      'edit',
      'view',
      'custom',
      'singular',
      'related-record',
    ])
    const builder = defineEditPage('typed').path('/posts/:record').title('Edit post')
    expectTypeOf(builder).toEqualTypeOf<PageBuilder>()
    expect(Object.isFrozen(builder.compile())).toBe(true)
  })

  it('resolves loaders, page copy, breadcrumbs, schemas, actions, widgets, and custom bodies without serializing callbacks', async () => {
    const page = defineCustomPage('dashboard', {
      actor: Actor,
      load: context => ({ count: context.services.source.length }),
      services: Services,
      tenant: String,
    })
      .path('/dashboard')
      .authorize(context => context.actor.role === 'admin')
      .title(context => `Dashboard for ${context.actor.id}`)
      .heading('Overview')
      .subheading(context => `Tenant ${context.tenant}`)
      .breadcrumbs(() => [{ label: 'Home', path: '/admin' }])
      .headerActions('posts.create')
      .footerActions('dashboard.refresh')
      .headerWidgets('post-stats')
      .footerWidgets('audit-log')
      .schema('dashboard-schema', null)
      .body('app.page.dashboard', { mode: 'summary' })
      .navigation({ group: 'Content', icon: 'home', label: 'Dashboard', sort: 10 })
      .compile()

    const context = { actor: { id: 7, role: 'admin' }, locale: 'en', panelId: 'admin', parameters: {}, services: { source: 'posts' }, signal, tenant: 'acme' }
    const result = await resolvePageData(page, context)
    expect(result).toMatchObject({ data: { count: 5 }, heading: 'Overview', subheading: 'Tenant acme', title: 'Dashboard for 7' })
    expect(result.breadcrumbs).toEqual([{ label: 'Home', path: '/admin' }])
    expect(result.manifest).toMatchObject({
      actions: { footer: ['dashboard.refresh'], header: ['posts.create'] },
      body: { component: 'app.page.dashboard', properties: { mode: 'summary' } },
      widgets: { footer: ['audit-log'], header: ['post-stats'] },
    })
    expect(JSON.stringify(page.manifest)).not.toContain('Dashboard for')
    await expect(resolvePageData(page, { ...context, actor: { id: 8, role: 'viewer' } })).rejects.toBeInstanceOf(PageAccessError)
  })

  it('enforces page authorization and deterministic navigation seeds', async () => {
    const context = { actor: { id: 7, role: 'admin' }, locale: 'en', panelId: 'admin', parameters: {}, services: { source: 'posts' }, signal, tenant: 'acme' }
    const denied = defineViewPage('secret').authorize(() => false).navigation({ label: 'Secret' }).compile()
    await expect(resolvePageData(denied, context)).rejects.toBeInstanceOf(PageAccessError)

    const pages = [
      defineListPage('posts').path('/posts').navigation({ label: 'Posts', sort: 20 }).compile(),
      defineCustomPage('dashboard').path('/dashboard').navigation({ label: 'Dashboard', sort: 10 }).compile(),
      denied,
      defineCustomPage('secret-child').path('/secret/child').navigation({ label: 'Secret child', parent: 'secret' }).compile(),
    ]
    expect(createNavigationSeed(pages).map(item => item.id)).toEqual(['secret', 'secret-child', 'dashboard', 'posts'])
    await expect(resolvePanelNavigationSeed(
      [
        { badge: null, group: null, icon: null, id: 'posts', label: 'Published posts', parent: null, path: '/posts', sort: 20 },
        { badge: null, group: null, icon: null, id: 'manual', label: 'Manual', parent: null, path: '/manual', sort: 30 },
      ],
      pages,
      context,
    )).resolves.toEqual([
      expect.objectContaining({ id: 'dashboard' }),
      expect.objectContaining({ id: 'posts', label: 'Published posts' }),
      expect.objectContaining({ id: 'manual' }),
    ])
  })

  it('prepares static page routes ahead of dynamic routes and rejects ambiguous patterns', () => {
    const pages = [
      defineViewPage('view-post').path('/posts/:record').compile(),
      defineCreatePage('create-post').path('/posts/create').compile(),
      defineListPage('posts').path('/posts').compile(),
    ]
    expect(preparePageRoutes(pages).map(page => page.manifest.id)).toEqual(['posts', 'create-post', 'view-post'])
    expect(() => preparePageRoutes([
      defineViewPage('view-post').path('/posts/:record').compile(),
      defineEditPage('edit-post').path('/posts/:slug').compile(),
    ])).toThrow('conflicts')
  })

  it('projects nested schema visibility without exposing server handles and validates breadcrumb destinations', async () => {
    const pageContext = { actor: { id: 7, role: 'admin' }, locale: 'en', panelId: 'admin', parameters: {}, services: { source: 'posts' }, signal, tenant: 'acme' }
    const components = schemaComponentsFor(PageSchemaValues, PageSchemaContext)
    const schema = defineSchema('secure-schema', PageSchemaValues, PageSchemaContext)
      .components([
        components.section([
          components.callout()
            .heading('Restricted')
            .visible(scope => scope.actor.role === 'admin'),
        ]).visible(scope => scope.tenant === 'acme'),
      ])
      .compile()
    const page = defineCustomPage('secure', { actor: Actor, load: () => ({}), services: Services, tenant: String })
      .schema('secure-schema', schema)
      .compile()
    const result = await resolvePageData(page, pageContext)

    expect(result.schema).toMatchObject({
      components: [{ children: [{ dynamicVisibility: true, visible: true }], dynamicVisibility: true, visible: true }],
    })
    expect(JSON.stringify(result.schema)).not.toContain('server')
    expect(JSON.stringify(result.schema)).not.toContain('visibility')
    const hidden = await resolvePageData(page, { ...pageContext, actor: { id: 8, role: 'viewer' } })
    expect(hidden.schema).toMatchObject({ components: [{ children: [{ visible: false }], visible: true }] })

    const unsafe = defineCustomPage('unsafe-breadcrumb').breadcrumbs([{ label: 'Escape', path: '/admin/../vendor' }]).compile()
    await expect(resolvePageData(unsafe, { actor: {}, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal, tenant: null })).rejects.toThrow('safe route')
  })
})

describe('P9-B panel runtime', () => {
  function auth(actors: Readonly<Record<string, Actor | null>>) {
    const guard = vi.fn((name: string) => ({
      provider: vi.fn(async () => `${name}-provider`),
      user: vi.fn(async () => actors[name] ?? null),
    }))
    return { facade: { guard } satisfies HoloAuth<Actor>, guard }
  }

  it('preserves the existing discoverable panel fluent surface', () => {
    const panel = definePanel('admin', Actor)
      .default()
      .path('/control/admin')
      .guard('staff')
      .discoverResources()
      .discoverPages('custom-pages')
      .discoverWidgets()
      .discoverClusters()
      .branding({ name: 'Control' })
      .navigationMode('topbar')
    expectTypeOf(panel).toEqualTypeOf<PanelBuilder<Actor>>()
    expect(panel.route).toBe('/control/admin')
    expect(panel.guardName).toBe('staff')
    expect(panel.compileDiscoveryDefinition()).toMatchObject({ client: { path: '/control/admin' }, default: true, discover: { pages: 'custom-pages' }, route: '/control/admin' })
    expect(panel.compileDiscoveryDefinition().client).toEqual({ appearance: { colors: {}, density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, tokens: {} }, brandingName: 'Control', darkMode: 'system', path: '/control/admin', simplePageMaxContentWidth: 'lg', themeColors: {} })
    expect(panel.compile().manifest.branding.name).toBe('Control')
  })

  it('accepts a named token theme and rejects stylesheet injection values', () => {
    const panel = definePanel('admin', Actor).theme({
      colorScheme: 'dark',
      name: 'Ocean',
      tokens: { 'color-primary': '#00a8cc', 'font-sans': 'Inter, sans-serif' },
    }).compile()

    expect(panel.manifest.theme).toMatchObject({
      darkMode: 'dark',
      name: 'Ocean',
      tokens: { 'color-primary': '#00a8cc', 'font-sans': 'Inter, sans-serif' },
    })
    expect(() => definePanel('unsafe').theme({
      colorScheme: 'light',
      name: 'Unsafe',
      tokens: { 'color-primary': 'red; background: black' },
    })).toThrow('unsafe value')
  })

  it('shares one Holo Auth guard resolution for same-guard bootstrap while checking access independently', async () => {
    const accessCalls: string[] = []
    const access = (context: { readonly panelId: string }): boolean => {
      accessCalls.push(context.panelId)
      return true
    }
    const first = definePanel('admin', Actor).guard('staff').presentActor(actor => ({ id: actor.id })).access(access).compile()
    const second = definePanel('reports', Actor).guard('staff').presentActor(actor => ({ id: actor.id })).access(access).compile()
    const fixture = auth({ staff: { id: 1, role: 'admin' } })
    const payloads = await new PanelRuntime(fixture.facade, [first, second]).bootstrap(['admin', 'reports'], signal)

    expect(fixture.guard).toHaveBeenCalledOnce()
    expect(fixture.guard).toHaveBeenCalledWith('staff')
    expect(accessCalls).toEqual(['admin', 'reports'])
    expect(payloads.map(payload => payload.manifest.id)).toEqual(['admin', 'reports'])
  })

  it('resolves different guards independently and never accepts a client-selected guard', async () => {
    const admin = definePanel('admin', Actor).guard('staff').presentActor(actor => ({ id: actor.id })).compile()
    const vendor = definePanel('vendor', Actor).guard('vendors').presentActor(actor => ({ id: actor.id })).compile()
    const fixture = auth({ staff: { id: 1, role: 'admin' }, vendors: { id: 2, role: 'vendor' } })
    const runtime = new PanelRuntime(fixture.facade, [admin, vendor])

    const payloads = await runtime.bootstrap(['admin', 'vendor'], signal)
    expect(fixture.guard.mock.calls.map(([name]) => name)).toEqual(['staff', 'vendors'])
    expect(payloads.map(payload => payload.actor.id)).toEqual([1, 2])
    await expect(runtime.execute('missing', 'page-data', signal, () => undefined)).rejects.toMatchObject({ code: 'panel-not-found' })
  })

  it('carries an allow-listed locale and direction in panel bootstrap payloads', async () => {
    const actor = { id: 1, locale: 'ar-EG', role: 'admin' }
    const panel = definePanel('admin').compile()
    const runtime = new PanelRuntime(auth({ web: actor }).facade, [panel])

    const inherited = (await runtime.bootstrap(['admin'], signal))[0]!
    const overridden = (await runtime.bootstrap(['admin'], signal, 'en-US'))[0]!
    const rejectedOverride = (await runtime.bootstrap(['admin'], signal, 'fr-FR'))[0]!

    expect(inherited).toMatchObject({ direction: 'rtl', locale: 'ar' })
    expect(overridden).toMatchObject({ direction: 'ltr', locale: 'en' })
    expect(rejectedOverride).toMatchObject({ direction: 'rtl', locale: 'ar' })
    expect(inherited.manifest.locales).toEqual({ allowed: ['en', 'ar'], fallback: 'en' })
  })

  it('runs the fixed panel access policy for every operation and rejects unauthenticated or denied actors', async () => {
    const operations: readonly PanelOperation[] = ['action', 'bootstrap', 'form-submit', 'global-search', 'notification', 'options', 'page-data', 'resolver', 'table-data', 'upload']
    const checked: PanelOperation[] = []
    const panel = definePanel('admin', Actor).guard('staff').access(context => {
      checked.push(context.operation)
      return context.actor.role === 'admin'
    }).compile()
    const allowed = new PanelRuntime(auth({ staff: { id: 1, role: 'admin' } }).facade, [panel])
    for (const operation of operations) {
      if (operation === 'bootstrap') await allowed.bootstrap(['admin'], signal)
      else await allowed.execute('admin', operation, signal, scope => scope.guard)
    }
    expect(checked).toEqual(operations)

    const denied = new PanelRuntime(auth({ staff: { id: 2, role: 'viewer' } }).facade, [panel])
    await expect(denied.execute('admin', 'page-data', signal, () => undefined)).rejects.toEqual(expect.objectContaining({ code: 'access-denied' } satisfies Partial<PanelRuntimeError>))
    const guest = new PanelRuntime(auth({ staff: null }).facade, [panel])
    await expect(guest.execute('admin', 'page-data', signal, () => undefined)).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('uses an explicit actor projection and keeps navigation, menu, and branding inside trusted boundaries', async () => {
    const actor: Actor & { readonly secret: string } = { id: 7, role: 'admin', secret: 'session-secret' }
    const panel = definePanel('admin', Actor)
      .path('/control')
      .presentActor(value => ({ id: value.id, role: value.role }))
      .branding({ favicon: '/assets/favicon.svg', logo: 'https://cdn.example.test/logo.svg', name: ' Control ' })
      .navigationItems([{ badge: null, group: null, icon: null, id: 'posts', label: 'Posts', parent: null, path: 'posts', sort: 0 }])
      .userMenuItems([{ icon: null, id: 'profile', label: 'Profile', path: '/control/profile' }])
      .compile()
    const payload = (await new PanelRuntime(auth({ web: actor }).facade, [panel]).bootstrap(['admin'], signal))[0]

    expect(payload?.actor).toEqual({ id: 7, role: 'admin' })
    expect(JSON.stringify(payload)).not.toContain('session-secret')
    expect(payload?.manifest.navigation[0]?.path).toBe('/control/posts')
    expect(payload?.manifest.userMenu[0]?.path).toBe('/control/profile')
    await expect(definePanel('safe', Actor).compile().server.presentActor({ id: 1, role: 'admin' })).resolves.toEqual({})
    expect(() => definePanel('unsafe-nav').path('/admin').navigationItems([{ badge: null, group: null, icon: null, id: 'escape', label: 'Escape', parent: null, path: '/vendor', sort: 0 }]).compile()).toThrow('fixed panel path')
    expect(() => definePanel('unsafe-menu').userMenuItems([{ icon: null, id: 'escape', label: 'Escape', path: '../vendor' }]).compile()).toThrow('safe panel route')
    expect(() => definePanel('unsafe-brand').branding({ logo: 'javascript:alert(1)' })).toThrow('absolute path or HTTPS')
  })

  it('rejects duplicate bootstrap IDs before resolving guards or producing repeated payloads', async () => {
    const fixture = auth({ web: { id: 1, role: 'admin' } })
    const runtime = new PanelRuntime(fixture.facade, [definePanel('admin', Actor).compile()])

    await expect(runtime.bootstrap(['admin', 'admin'], signal)).rejects.toThrow('IDs must be unique')
    expect(fixture.guard).not.toHaveBeenCalled()
  })
})
