import { ActionExecutionError, createRequestEnvelope, definePanel, defineStatsWidget, PROTOCOL_VERSION, type JsonObject } from '@holo-js/panels-core'
import { createApp as createH3App, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { createApp, createSSRApp, defineComponent, effectScope, h, nextTick, shallowRef, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureNuxtImports, configureNuxtNavigation } from './nuxt-imports'

const security = vi.hoisted(() => ({ calls: [] as string[], reject: false }))

vi.mock('@holo-js/security/nuxt/server', () => ({
  csrfProtection: () => defineEventHandler((event) => {
    security.calls.push(event.method)
    if (security.reject) throw Object.assign(new Error('CSRF token mismatch.'), { statusCode: 419 })
  }),
}))

vi.mock('@holo-js/adapter-nuxt/runtime', () => ({
  holo: {
    getApp: vi.fn(async () => ({ projectRoot: '/app' })),
    getAuth: vi.fn(async () => ({ guard: () => ({ user: async () => ({ id: 7 }) }) })),
  },
  runWithNuxtRequest: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))

const { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } = await import('../src')
const { createGeneratedNuxtPanelRouteHandler, createPanelOperationHandler } = await import('../src/server')
import type { NuxtPanelOperationContext, NuxtPanelOperationResult, NuxtPanelPage, NuxtPanelRuntime } from '../src'

const page: NuxtPanelPage = {
  bootstrap: {
    actor: { id: 7 },
    direction: 'ltr',
    locale: 'en',
    manifest: {
      branding: { favicon: null, logo: null, name: 'Admin' },
      databaseNotifications: null,
      default: true,
      direction: 'ltr',
      globalSearch: true,
      id: 'admin',
      locale: 'en',
      locales: { allowed: ['en', 'ar'], fallback: 'en' },
      navigation: [{ badge: '4', group: null, icon: 'posts', id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 1 }],
      navigationMode: 'sidebar',
      path: '/admin',
      sidebarCollapsible: true,
      slots: {},
      tenancy: null,
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
      userMenu: [],
    },
    notifications: null,
    provider: 'users',
    tenancy: null,
  },
  page: {
    breadcrumbs: [{ label: 'Posts', path: '/admin/posts' }],
    data: { records: [] },
    heading: 'Posts',
    manifest: { body: null, id: 'posts.list', pageType: 'list', path: '/admin/posts', schemaId: null, widgets: { footer: [], header: [] } },
    schema: null,
    subheading: 'Manage published content',
    title: 'Posts',
  },
  path: '/admin/posts',
  widgets: { footer: [], header: [] },
}

const compiledResourceSchema: JsonObject = {
  actions: [
    { id: 'view-article', kind: 'view', label: 'View', scope: 'row' },
    { id: 'edit-article', kind: 'edit', label: 'Edit', scope: 'row' },
    { confirmation: 'Delete this article?', id: 'remove-article', kind: 'delete', label: 'Remove', scope: 'row' },
  ],
  basePath: '/control/articles',
  columns: ['headline', 'permalink', 'department', 'office'].map(path => ({
    manifest: { alignment: 'start', copyable: path === 'permalink', hidden: false, inlineEditor: null, label: path, path, sortable: true, toggleable: true, type: 'text', width: null, wrap: true },
  })),
  fields: [
    { disabled: false, helperText: null, hint: null, label: 'Headline', path: 'headline', placeholder: null, properties: {}, readOnly: false, required: true, type: 'text', visible: true },
    { disabled: false, helperText: null, hint: null, label: 'Permalink', path: 'permalink', placeholder: null, properties: {}, reactive: { source: 'headline', transform: 'slug' }, readOnly: false, required: true, type: 'slug', visible: true },
    { debounceMilliseconds: 20, defaultValue: 'docs', disabled: false, helperText: null, hint: null, label: 'Department', optionSource: { options: [{ label: 'Docs', value: 'docs' }, { label: 'Support', value: 'support' }] }, path: 'department', placeholder: null, properties: { paginated: false, preload: true, searchable: false }, readOnly: false, required: true, type: 'select', visible: true },
    { disabled: false, helperText: null, hint: null, label: 'Office', optionSource: { dependency: 'department', options: [], optionsByDependency: { docs: [{ label: 'Berlin', value: 'Berlin' }], support: [{ label: 'Lisbon', value: 'Lisbon' }] } }, path: 'office', placeholder: null, properties: { paginated: false, preload: true, searchable: false }, readOnly: false, required: true, type: 'select', visible: true },
  ],
  filters: [{ manifest: { defaultValue: null, id: 'department', label: 'Department', properties: {}, type: 'select' }, options: [{ label: 'All', value: null }, { label: 'Docs', value: 'docs' }] }],
  kind: 'resource',
  recordTitle: 'headline',
  resourceId: 'articles',
  routeKey: 'permalink',
  routes: {
    create: '/control/articles/create',
    edit: '/control/articles/:record/edit',
    view: '/control/articles/:record',
  },
}

function formRequest(panelId: string, operation: string, payload: JsonObject = {}, id = 'request-1234567890'): Request {
  const envelope = createRequestEnvelope({ id, operation, panelId, payload })
  const body = new URLSearchParams({ request: JSON.stringify(envelope), _token: 'valid' })
  return new Request(`http://localhost/holo/panels/${panelId}/${operation}`, {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-TOKEN': 'valid' },
    method: 'POST',
  })
}

function webHandler(handler: ReturnType<typeof createPanelOperationHandler>): (request: Request) => Promise<Response> {
  const app = createH3App()
  const router = createRouter()
  router.get('/holo/panels/:panelId/:operation', handler)
  router.post('/holo/panels/:panelId/:operation', handler)
  app.use(router)
  return toWebHandler(app)
}

function runtime(
  panelIds: readonly string[],
  execute: (context: NuxtPanelOperationContext) => NuxtPanelOperationResult | Promise<NuxtPanelOperationResult>,
): NuxtPanelRuntime {
  return {
    panels: Object.fromEntries(panelIds.map(panelId => [panelId, { access: () => true, guard: 'web' }])),
    execute,
  }
}

beforeEach(() => {
  configureNuxtNavigation(async () => undefined)
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  } satisfies MediaQueryList)))
  security.calls.length = 0
  security.reject = false
})

describe('P9-D Nuxt adapter', () => {
  it('mounts generated public custom routes at their native Nuxt URL', async () => {
    const customPanel = definePanel('admin')
      .path('/admin')
      .routes(routes => routes.get('/health', () => new Response('healthy')))
      .compile()
    const configured: NuxtPanelRuntime<object> = {
      execute: async () => ({ data: {} }),
      panels: { admin: { access: () => true, definition: customPanel, guard: 'web' } },
    }
    const app = createH3App()
    const router = createRouter()
    router.get('/admin/health', createGeneratedNuxtPanelRouteHandler({ panelId: 'admin', runtime: configured }))
    app.use(router)

    const response = await toWebHandler(app)(new Request('http://localhost/admin/health'))

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('healthy')
  })

  it('uses the configured panel home URL for the brand link', async () => {
    const configured: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, manifest: { ...page.bootstrap.manifest, icons: { posts: 'home' }, routing: { domain: null, domains: [], homeUrl: '/admin/overview' } } },
    }

    const markup = await renderToString(createSSRApp(PanelPage, { page: configured }))
    expect(markup).toContain('href="/admin/overview"')
    expect(markup).toContain('data-icon="home"')
  })

  it('renders shared panel chrome in Arabic with an RTL sidebar', async () => {
    const configured: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, direction: 'rtl', locale: 'ar' },
    }

    const markup = await renderToString(createSSRApp(PanelPage, { page: configured }))

    expect(markup).toContain('dir="rtl"')
    expect(markup).toContain('lang="ar"')
    expect(markup).toContain('قائمة الحساب')
    expect(markup).toContain('data-side="right"')
  })

  it('navigates same-origin panel links in SPA mode, honors exceptions, and prefetches on hover', async () => {
    const configured: NuxtPanelPage = {
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: {
          ...page.bootstrap.manifest,
          navigation: [
            ...page.bootstrap.manifest.navigation,
            { badge: null, group: null, icon: null, id: 'external', label: 'External', parent: null, path: '/admin/external-report', sort: 2 },
          ],
          runtime: { databaseTransactions: false, readOnlyRelationManagersOnResourceViewPagesByDefault: false, resourceCreatePageRedirect: 'edit', resourceEditPageRedirect: null, spa: true, spaPrefetching: true, spaUrlExceptions: ['/admin/external*'], strictAuthorization: false, unsavedChangesAlerts: false },
        },
      },
    }
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(PanelPage, { page: configured })
    const routerPush = vi.fn(async () => undefined)
    configureNuxtNavigation(routerPush)
    app.mount(container)
    const postsLink = container.querySelector<HTMLAnchorElement>('a[href="/admin/posts"]')
    const externalLink = container.querySelector<HTMLAnchorElement>('a[href="/admin/external-report"]')
    if (!postsLink || !externalLink) throw new Error('SPA navigation links did not render')

    postsLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(document.head.querySelector('link[data-holo-panel-prefetch][href="/admin/posts"]')).not.toBeNull()
    const internalClick = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    postsLink.dispatchEvent(internalClick)
    expect(internalClick.defaultPrevented).toBe(true)
    expect(routerPush).toHaveBeenCalledWith('/admin/posts')
    const excludedClick = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    externalLink.dispatchEvent(excludedClick)
    expect(excludedClick.defaultPrevented).toBe(false)
    app.unmount()
  })

  it('returns configured panel error notifications as client toast effects', async () => {
    const configured = runtime(['admin'], async () => { throw new Error('database unavailable') })
    const runtimePanel = configured.panels.admin
    if (!runtimePanel) throw new Error('Admin panel fixture was not registered')
    Reflect.set(runtimePanel, 'definition', definePanel('admin')
      .registerErrorNotification('Save failed', 'The post could not be saved.', 500)
      .compile())
    const response = await webHandler(createPanelOperationHandler({ panelIds: ['admin'], runtime: configured }))(formRequest('admin', 'form-submit'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      effects: [{ kind: 'toast', level: 'danger', message: 'The post could not be saved.', title: 'Save failed' }],
      ok: false,
    })
  })

  it('localizes authorization failures before an actor is available', async () => {
    const configured = runtime(['admin'], async () => ({ data: {} }))
    const runtimePanel = configured.panels.admin
    if (!runtimePanel) throw new Error('Admin panel fixture was not registered')
    Reflect.set(runtimePanel, 'access', () => false)
    Reflect.set(runtimePanel, 'definition', definePanel('admin').locales(['en', 'ar']).compile())
    const request = formRequest('admin', 'action')
    request.headers.set('Accept-Language', 'ar')

    const response = await webHandler(createPanelOperationHandler({ panelIds: ['admin'], runtime: configured }))(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ direction: 'rtl', locale: 'ar', ok: false })
  })

  it('serves the configured tenant billing route before subscription-protected page execution', async () => {
    const routeAction = vi.fn(() => new Response(null, { headers: { location: 'https://billing.example.test/session' }, status: 303 }))
    const configured = runtime(['admin'], vi.fn(() => ({ data: {} })))
    const configuredPanel = configured.panels.admin
    if (!configuredPanel) throw new Error('Admin panel fixture was not registered')
    Reflect.set(configuredPanel, 'definition', {
      manifest: { tenancy: { billing: { path: '/admin/subscription' } } },
      server: { tenancy: { billing: { getRouteAction: () => routeAction, getSubscribedMiddleware: () => () => false } } },
    })
    const response = await webHandler(createPanelOperationHandler({ panelIds: ['admin'], runtime: configured }))(
      new Request('http://localhost/holo/panels/admin/page-data?path=/admin/subscription'),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://billing.example.test/session')
    expect(routeAction).toHaveBeenCalledOnce()
    expect(configured.execute).not.toHaveBeenCalled()
  })

  it('deduplicates SSR page loading through Nuxt state and supports multiple fixed panels', async () => {
    const requests: string[] = []
    configureNuxtImports({
      path: '/admin/posts?status=draft',
      fetch: async (path, options) => {
        requests.push(`${path}:${JSON.stringify(options)}`)
        return structuredClone(page)
      },
    })
    const scope = effectScope()
    const admin = await scope.run(() => usePanelPage({ panelId: 'admin' }))!
    const staff = await usePanelPage({ panelId: 'staff', path: '/staff', load: async request => ({ ...page, path: request.path }) })
    expect(admin.page.title).toBe('Posts')
    expect(staff.path).toBe('/staff')
    expect(requests[0]).toContain('/holo/panels/admin/page-data')
    expect(requests[0]).toContain('/admin/posts')
    configureNuxtImports({
      path: '/admin/posts/post-1/edit',
      fetch: async (_path, options) => ({
        ...page,
        page: { ...page.page, title: 'Edit Post' },
        path: String((options.query as { readonly path?: unknown }).path),
      }),
    })
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(admin.path).toBe('/admin/posts/post-1/edit')
    expect(admin.page.title).toBe('Edit Post')
    scope.stop()
    await expect(usePanelPage({ panelId: '../admin', path: '/admin', load: async () => page })).rejects.toThrow('stable panel IDs')
  })

  it('stops page loading when the generated page leaves its Vue scope', async () => {
    configureNuxtImports({ path: '/admin/posts', fetch: async () => structuredClone(page) })
    const scope = effectScope()
    await scope.run(() => usePanelPage({ panelId: 'admin' }))
    scope.stop()
    const fetch = vi.fn(async () => structuredClone(page))
    configureNuxtImports({ path: '/admin/profile', fetch })
    await nextTick()
    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renders deterministic SSR, hydrates active navigation, and lazily resolves a resource', async () => {
    const ResourcePage = defineComponent(() => () => h('article', { 'data-resource': 'posts' }, 'Loaded posts'))
    const properties = { page, resolveResource: async () => ResourcePage }
    const html = await renderToString(createSSRApp(PanelPage, properties))
    expect(html).toContain('data-panels-panel="admin"')
    expect(html).toContain('data-panels-ready="false"')
    expect(html).toContain('inert')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Manage published content')
    expect(html).toContain('data-resource="posts"')
    expect(html).toContain('hp-panel-topbar-start')
    expect(html).toContain('hp-panel-topbar-end')
    expect(html).toContain('hp-panel-navigation-header')
    expect(html).toContain('hp-panel-navigation-body')
    expect(html).toContain('hp-panel-main-header')
    expect(html).toContain('hp-panel-main-body')
    expect(html).toContain('hp-panel-user-glyph')
    expect(html).toContain('hp-panel-user-action')
    expect(html).toContain('hp-panel-actions--compact')
    expect(html).toContain('aria-label="Account menu"')
    expect(html).toContain('AC')
    expect(html).not.toContain('function')
    const container = document.createElement('div')
    container.dir = 'rtl'
    container.innerHTML = html
    document.body.append(container)
    const hydrated = createSSRApp(PanelPage, properties)
    hydrated.mount(container)
    await nextTick()
    expect(container.querySelector('[data-panels-panel="admin"]')?.getAttribute('data-panels-ready')).toBe('true')
    expect(container.querySelector('[data-panels-panel="admin"]')?.hasAttribute('inert')).toBe(false)
    const portal = container.querySelector<HTMLElement>('[data-holo-panel][data-panels-panel="admin"]')
    expect(portal?.dataset.theme).toBe('system')
    expect(portal?.dataset.density).toBe('comfortable')
    expect(portal?.closest('[dir="rtl"]')).toBe(container)
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Posts')
    await vi.waitFor(() => expect(container.querySelector('[data-resource="posts"]')?.textContent).toBe('Loaded posts'))
    hydrated.unmount()
    expect(portal?.isConnected).toBe(false)
    container.remove()
  })

  it('dismisses the mobile drawer with Escape or its backdrop and restores toggle focus', async () => {
    const mediaQueryState = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: '(max-width: 768px)',
      onchange: null,
      removeEventListener: vi.fn(),
    }
    const mediaQuery = mediaQueryState as unknown as MediaQueryList
    const matchMedia = vi.fn(() => mediaQuery)
    vi.stubGlobal('matchMedia', matchMedia)
    const container = document.createElement('div')
    document.body.append(container)
    const app = createSSRApp(PanelPage, { page })
    app.mount(container)
    await nextTick()

    const toggle = container.querySelector<HTMLButtonElement>('.hp-panel-navigation-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 768px)')
    expect(mediaQueryState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function), { passive: true })

    toggle.click()
    await nextTick()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-panels-component="slide-over"][data-mobile="true"]')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await nextTick()
    await Promise.resolve()
    await vi.waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)

    toggle.click()
    await nextTick()
    const backdrop = container.querySelector<HTMLElement>('[data-slot="sheet-overlay"][data-state="open"]')!
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
    backdrop.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }))
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    await nextTick()
    await Promise.resolve()
    await vi.waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)
    app.unmount()
    expect(mediaQueryState.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function), { passive: true })
    container.remove()
  })

  it('renders top navigation without a sidebar when the panel selects topbar mode', async () => {
    const topbarPage: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, manifest: { ...page.bootstrap.manifest, navigationMode: 'topbar' } },
    }
    const html = await renderToString(createSSRApp(PanelPage, { page: topbarPage }))

    expect(html).toContain('hp-panel-navigation--topbar')
    expect(html).toContain('hp-panel-topbar-center')
    expect(html).not.toContain('hp-panel-sidebar')
  })

  it('omits the panel header when the provider disables the topbar', async () => {
    const withoutTopbar: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, manifest: { ...page.bootstrap.manifest, layout: { ...page.bootstrap.manifest.layout!, topbar: false } } },
    }

    expect(await renderToString(createSSRApp(PanelPage, { page: withoutTopbar }))).not.toContain('hp-panel-header')
  })

  it('omits the account dropdown when the provider disables the user menu', async () => {
    const withoutUserMenu: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, manifest: { ...page.bootstrap.manifest, userMenuEnabled: false } },
    }

    expect(await renderToString(createSSRApp(PanelPage, { page: withoutUserMenu }))).not.toContain('hp-panel-user-trigger')
  })

  it('omits navigation chrome when the provider disables navigation', async () => {
    const withoutNavigation: NuxtPanelPage = {
      ...page,
      bootstrap: { ...page.bootstrap, manifest: { ...page.bootstrap.manifest, navigationEnabled: false } },
    }
    const markup = await renderToString(createSSRApp(PanelPage, { page: withoutNavigation }))

    expect(markup).not.toContain('data-slot="sidebar"')
    expect(markup).not.toContain('hp-panel-navigation-toggle')
  })

  it('renders provider-configured topbar, sidebar, and avatar components', async () => {
    const registry = createNuxtPanelComponentRegistry()
      .register('custom-topbar', defineComponent({ props: { manifest: { type: Object, required: true } }, setup: props => () => h('header', { 'data-custom-topbar': Reflect.get(props.manifest, 'id') }, 'Custom topbar') }))
      .register('custom-sidebar', defineComponent({ props: { actor: { type: Object, required: true } }, setup: props => () => h('aside', { 'data-custom-sidebar': Reflect.get(props.actor, 'id') }, 'Custom sidebar') }))
      .register('custom-avatar', defineComponent({ props: { actor: { type: Object, required: true }, label: { type: String, required: true } }, setup: props => () => h('span', { 'data-custom-avatar': Reflect.get(props.actor, 'id') }, props.label) }))
      .register('custom-notification', defineComponent({ props: { placement: { type: String, required: true } }, setup: props => () => h('span', { 'data-custom-notification': props.placement }, 'Custom notifications') }))
    const configured = (components: { readonly sidebar: string | null, readonly topbar: string | null }, avatarProvider: string | null): NuxtPanelPage => ({
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: { ...page.bootstrap.manifest, assets: [{ id: 'admin-theme', src: '/admin/theme.css', type: 'css' }], branding: { ...page.bootstrap.manifest.branding, avatarProvider }, components },
      },
    })

    const chrome = await renderToString(createSSRApp(PanelPage, { page: configured({ sidebar: 'custom-sidebar', topbar: 'custom-topbar' }, null), registry }))
    const configuredAvatar = configured({ sidebar: null, topbar: null }, 'custom-avatar')
    const avatarPage: NuxtPanelPage = {
      ...configuredAvatar,
      bootstrap: {
        ...configuredAvatar.bootstrap,
        manifest: { ...configuredAvatar.bootstrap.manifest, databaseNotifications: { component: 'custom-notification', lazy: true, placement: 'topbar', polling: false, realtime: false } },
      },
    }
    const avatar = await renderToString(createSSRApp(PanelPage, { page: avatarPage, registry }))
    expect(chrome).toContain('data-custom-topbar="admin"')
    expect(chrome).toContain('data-custom-sidebar="7"')
    expect(chrome).not.toContain('hp-panel-header')
    expect(chrome).toContain('data-panel-asset="admin-theme"')
    expect(chrome).toContain('href="/admin/theme.css"')
    expect(avatar).toContain('data-custom-avatar="7"')
    expect(avatar).toContain('data-custom-notification="topbar"')
    expect(avatar).toContain('hp-panel-notification-action')
  })

  it('renders the built-in tenant switcher without application transport helpers', async () => {
    const tenantPage: NuxtPanelPage = {
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: { ...page.bootstrap.manifest, tenancy: { enabled: true } },
        tenancy: {
          active: { avatarUrl: null, description: null, label: 'Acme', routeKey: 'acme' },
          memberships: {
            memberships: [
              { avatarUrl: null, description: null, label: 'Acme', routeKey: 'acme' },
              { avatarUrl: null, description: null, label: 'Globex', routeKey: 'globex' },
            ],
            nextCursor: null,
          },
        },
      },
    }

    const html = await renderToString(createSSRApp(PanelPage, { page: tenantPage }))

    expect(html).toContain('aria-label="Tenant menu"')
    expect(html).toContain('data-slot="dropdown-menu-trigger"')
    expect(html).toContain('Acme')
    const sidebarStart = html.indexOf('hp-panel-sidebar')
    const tenantMenu = html.indexOf('aria-label="Tenant menu"', sidebarStart)
    const navigation = html.indexOf('hp-panel-navigation-body', sidebarStart)
    const accountMenu = html.indexOf('aria-label="Account menu"', sidebarStart)
    expect(sidebarStart).toBeGreaterThanOrEqual(0)
    expect(tenantMenu).toBeGreaterThan(sidebarStart)
    expect(navigation).toBeGreaterThan(tenantMenu)
    expect(accountMenu).toBeGreaterThan(navigation)
    expect(html).toMatch(/hp-panel-page-header[\s\S]*hp-panel-page-heading[\s\S]*hp-panel-breadcrumbs[\s\S]*hp-panel-page-actions/u)
    const hidden = await renderToString(createSSRApp(PanelPage, {
      page: {
        ...tenantPage,
        bootstrap: { ...tenantPage.bootstrap, manifest: { ...tenantPage.bootstrap.manifest, tenancy: { enabled: true, switcher: false } } },
      },
    }))
    expect(hidden).not.toContain('aria-label="Tenant menu"')
  })

  it('renders resolved page widgets inside the admin shell', async () => {
    const manifest = defineStatsWidget('content-overview')
      .heading('Content overview')
      .data(() => ({ stats: [] }))
      .compile().manifest
    const widgetPage: NuxtPanelPage = {
      ...page,
      page: { ...page.page, manifest: { ...page.page.manifest, pageType: 'custom', widgets: { footer: [], header: ['content-overview'] } } },
      widgets: {
        footer: [],
        header: [{ data: { stats: [{ action: null, chart: [], color: 'primary', description: 'All posts', icon: null, id: 'posts', label: 'Posts', trend: null, url: '/admin/posts', value: 3 }] }, manifest, status: 'ready' }],
      },
    }

    const html = await renderToString(createSSRApp(PanelPage, { page: widgetPage }))

    expect(html).toContain('Page header widgets')
    expect(html).toContain('Content overview')
    expect(html).toContain('All posts')
  })

  it('decodes protocol mutations, binds route identity, invokes Holo accessors, and returns effects', async () => {
    const execute = vi.fn(async context => ({
      data: { deleted: context.input.id },
      effects: [{ kind: 'toast' as const, level: 'success' as const, message: 'Deleted' }],
    }))
    const fetch = webHandler(createPanelOperationHandler({ panelIds: ['admin', 'staff'], runtime: runtime(['admin', 'staff'], execute) }))
    const response = await fetch(formRequest('admin', 'action', { id: 42 }))
    const body = await response.json() as Record<string, unknown>
    expect(response.status, JSON.stringify(body)).toBe(200)
    expect(body).toMatchObject({ data: { deleted: 42 }, direction: 'ltr', id: 'request-1234567890', locale: 'en', ok: true, protocolVersion: PROTOCOL_VERSION })
    expect(body.effects).toEqual([{ kind: 'toast', level: 'success', message: 'Deleted' }])
    expect(security.calls).toEqual(['POST'])
    const context = execute.mock.calls[0]?.[0]
    expect(context).toMatchObject({ operation: 'action', panelId: 'admin', requestId: 'request-1234567890' })
    await expect(context?.getAuth()).resolves.toHaveProperty('guard')
  })

  it('rejects mismatched, malformed, unregistered, and CSRF-failing mutations without dispatch', async () => {
    const execute = vi.fn(async () => ({ data: { ok: true } }))
    const fetch = webHandler(createPanelOperationHandler({ panelIds: ['admin'], runtime: runtime(['admin'], execute) }))
    const mismatch = await fetch(formRequest('staff', 'action'))
    expect(mismatch.status).toBe(404)
    expect(execute).not.toHaveBeenCalled()

    const wrongOperationEnvelope = createRequestEnvelope({ id: 'request-abcdefghijkl', operation: 'upload', panelId: 'admin', payload: {} })
    const wrongOperation = await fetch(new Request('http://localhost/holo/panels/admin/action', {
      body: new URLSearchParams({ request: JSON.stringify(wrongOperationEnvelope), _token: 'valid' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }))
    expect(wrongOperation.status).toBe(400)
    expect(await wrongOperation.json()).toMatchObject({ ok: false, error: { category: 'protocol', code: 'invalid_request' } })

    const malformed = await fetch(new Request('http://localhost/holo/panels/admin/action', {
      body: new URLSearchParams({ request: '{', _token: 'valid' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }))
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({ ok: false, protocolVersion: PROTOCOL_VERSION })

    security.reject = true
    const csrf = await fetch(formRequest('admin', 'action'))
    expect(csrf.status).toBe(419)
    expect(execute).not.toHaveBeenCalled()
  })

  it('preserves only validated action execution effects on failure envelopes', async () => {
    const effect = { kind: 'toast' as const, level: 'danger' as const, message: 'Could not save' }
    const actionFailure = webHandler(createPanelOperationHandler({
      panelIds: ['admin'],
      runtime: runtime(['admin'], async () => { throw new ActionExecutionError('failed', 'failed', [effect]) }),
    }))
    const actionResponse = await actionFailure(formRequest('admin', 'action'))
    expect(await actionResponse.json()).toMatchObject({ direction: 'ltr', effects: [effect], locale: 'en', ok: false })

    const spoofedFailure = webHandler(createPanelOperationHandler({
      panelIds: ['admin'],
      runtime: runtime(['admin'], async () => { throw Object.assign(new Error('failed'), { effects: [effect] }) }),
    }))
    const spoofedResponse = await spoofedFailure(formRequest('admin', 'action'))
    expect(await spoofedResponse.json()).toMatchObject({ ok: false, effects: [] })

    const invalidFailure = webHandler(createPanelOperationHandler({
      panelIds: ['admin'],
      runtime: runtime(['admin'], async () => {
        throw new ActionExecutionError('failed', 'failed', [{ kind: 'unknown' } as never])
      }),
    }))
    const invalidResponse = await invalidFailure(formRequest('admin', 'action'))
    expect(await invalidResponse.json()).toMatchObject({ ok: false, effects: [] })
  })

  it('serves internal SSR page data with safe native H3 status translation', async () => {
    const fetch = webHandler(createPanelOperationHandler({
      panelIds: ['admin'],
      runtime: runtime(['admin'], async context => {
        if (context.input.path === '/admin/missing') throw Object.assign(new Error('missing'), { name: 'ResourceRecordNotFoundError' })
        return { data: page }
      }),
    }))
    const response = await fetch(new Request('http://localhost/holo/panels/admin/page-data?path=%2Fadmin%2Fposts'))
    expect(response.status).toBe(200)
    const payload = await response.json() as NuxtPanelPage
    expect(payload.path).toBe('/admin/posts')
    expect(payload.page.title).toBe('Posts')
    const missing = await fetch(new Request('http://localhost/holo/panels/admin/page-data?path=%2Fadmin%2Fmissing'))
    expect(missing.status).toBe(404)
    expect(await missing.text()).not.toContain('missing')
  })

  it('bounds missing and spoofed content lengths before CSRF or dispatch', async () => {
    const execute = vi.fn(async () => ({ data: { ok: true } }))
    const fetch = webHandler(createPanelOperationHandler({ panelIds: ['admin'], runtime: runtime(['admin'], execute) }))
    const oversized = 'x'.repeat(1_048_577)
    for (const headers of [
      new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      new Headers({ 'Content-Length': '1', 'Content-Type': 'application/x-www-form-urlencoded' }),
    ]) {
      const response = await fetch(new Request('http://localhost/holo/panels/admin/action', { body: oversized, headers, method: 'POST' }))
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({ ok: false, error: { code: 'payload_too_large' } })
    }
    expect(security.calls).toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })

  it('uses shared table, form, option, and action engines for CRUD rendering', async () => {
    const resourcePage: NuxtPanelPage = {
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: { ...page.bootstrap.manifest, id: 'backoffice', navigation: [{ ...page.bootstrap.manifest.navigation[0]!, path: '/control/articles' }], path: '/control', runtime: { databaseTransactions: false, readOnlyRelationManagersOnResourceViewPagesByDefault: false, resourceCreatePageRedirect: 'edit', resourceEditPageRedirect: null, spa: false, spaUrlExceptions: [], strictAuthorization: false, unsavedChangesAlerts: false } },
      },
      page: {
        ...page.page,
        data: {
          department: 'docs',
          record: { created_at: 'private', department: 'docs', headline: 'Guide', id: 1, office: 'Berlin', permalink: 'guide' },
          records: [{ department: 'docs', headline: 'Guide', id: 1, office: 'Berlin', permalink: 'guide' }],
          relations: [{ badge: null, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'author', label: 'Author', operations: ['select', 'associate'], presentation: 'inline', records: [{ id: 'author-1', values: { name: 'Ada' } }], url: null, visible: true }],
        },
        heading: 'Articles',
        manifest: { ...page.page.manifest, body: { component: 'resource-page', properties: { resourceId: 'articles' } }, pageType: 'edit' as const, path: '/control/articles/guide/edit' },
        schema: compiledResourceSchema,
        title: 'Articles',
      },
      path: '/control/articles?department=docs',
    }
    const container = document.createElement('div')
    document.body.append(container)
    const currentPage = shallowRef<NuxtPanelPage>(resourcePage)
    const ResourceHarness = defineComponent(() => () => h(PanelPage as Component, { page: currentPage.value }))
    const app = createApp(ResourceHarness)
    app.mount(container)
    await nextTick()
    const title = container.querySelector<HTMLInputElement>('[data-field-path="headline"] input')
    expect(title).not.toBeNull()
    expect(container.querySelector('[data-field-path="created_at"]')).toBeNull()
    if (title) {
      title.value = 'Reactive Slug'
      title.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await nextTick()
    expect(container.querySelector<HTMLInputElement>('[data-field-path="permalink"] input')?.value).toBe('reactive-slug')
    currentPage.value = { ...resourcePage, page: { ...resourcePage.page, heading: 'Updated articles' } }
    await nextTick()
    expect(container.querySelector<HTMLInputElement>('[data-field-path="headline"] input')?.value).toBe('Reactive Slug')
    expect(container.querySelector('[data-field-path="department"]')).not.toBeNull()
    expect(container.querySelector('[data-field-path="office"]')).not.toBeNull()
    await vi.waitFor(() => {
      const officeOptions = Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="office"] option')).map(option => option.textContent)
      expect(officeOptions).toContain('Berlin')
      expect(officeOptions).not.toContain('Lisbon')
    })
    const department = container.querySelector<HTMLSelectElement>('[data-field-path="department"] select')
    expect(department).not.toBeNull()
    await vi.waitFor(() => expect(Array.from(department?.options ?? []).map(option => option.value)).toContain('support'))
    if (department) {
      department.value = 'support'
      department.dispatchEvent(new Event('change', { bubbles: true }))
    }
    await nextTick()
    expect(Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="office"] option')).map(option => option.textContent)).not.toContain('Lisbon')
    await vi.waitFor(() => {
      const officeOptions = Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="office"] option')).map(option => option.textContent)
      expect(officeOptions).toContain('Lisbon')
      expect(officeOptions).not.toContain('Berlin')
    })
    app.unmount()

    const listApp = createApp(PanelPage, { page: { ...resourcePage, page: { ...resourcePage.page, manifest: { ...resourcePage.page.manifest, pageType: 'manage' as const } } } })
    const actionRequests: Request[] = []
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const fetchAction = vi.spyOn(window, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? new Request(input, init) : new Request(new URL(String(input), 'http://localhost'), init)
      actionRequests.push(request)
      const parameters = new URLSearchParams(await request.clone().text())
      const envelope = JSON.parse(parameters.get('request') ?? '{}') as { readonly id?: unknown }
      return new Response(JSON.stringify({ data: {}, effects: [], id: envelope.id, ok: true, protocolVersion: PROTOCOL_VERSION }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    })
    listApp.mount(container)
    await nextTick()
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('h2')?.textContent).toBe('Articles')
    expect(container.querySelector('[data-panels-component="table"]')?.getAttribute('data-state')).toBe('ready')
    const rowMenu = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
    expect(rowMenu).not.toBeNull()
    rowMenu?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    rowMenu?.click()
    await nextTick()
    expect(document.querySelector('a[href="/control/articles/guide"]')?.textContent).toBe('Guide')
    expect(Array.from(document.querySelectorAll('[role="menuitem"]')).some(item => item.textContent === 'Edit')).toBe(true)
    const remove = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'Remove')
    expect(remove).toBeDefined()
    remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await Promise.resolve()
    await nextTick()
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Delete this article?'))
    const confirmAction = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')
    expect(confirmAction).toBeDefined()
    confirmAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => expect(actionRequests).toHaveLength(2))
    expect(container.querySelector('[role="alert"]')?.textContent).toBeUndefined()
    expect(actionRequests[0]?.url).toBe('http://localhost/holo/panels/backoffice/action')
    const actionParameters = new URLSearchParams(await actionRequests[0]?.clone().text())
    expect(JSON.parse(actionParameters.get('request') ?? '{}')).toMatchObject({
      operation: 'action',
      panelId: 'backoffice',
      payload: { actionId: 'remove-article', recordIds: ['guide'], resourceId: 'articles' },
    })
    const refreshParameters = new URLSearchParams(await actionRequests[1]?.clone().text())
    expect(JSON.parse(refreshParameters.get('request') ?? '{}')).toMatchObject({ operation: 'table-data', panelId: 'backoffice' })
    listApp.unmount()
    fetchAction.mockRestore()
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'

    const viewApp = createApp(PanelPage, { page: { ...resourcePage, page: { ...resourcePage.page, manifest: { ...resourcePage.page.manifest, pageType: 'view' as const } } } })
    viewApp.mount(container)
    await nextTick()
    expect(container.querySelector('[data-action-mount="record"]')).not.toBeNull()
    expect(container.querySelector('[data-action-id="edit-article"]')?.textContent).toBe('Edit')
    expect(container.querySelector('[data-relation-manager="author"]')?.textContent).toContain('Ada')
    expect(container.querySelector('[data-operation="associate"]')).not.toBeNull()
    expect(container.querySelector('[data-panels-panel="backoffice"]')).not.toBeNull()
    viewApp.unmount()

    const readOnlyPage = {
      ...resourcePage,
      bootstrap: {
        ...resourcePage.bootstrap,
        manifest: {
          ...resourcePage.bootstrap.manifest,
          runtime: { ...resourcePage.bootstrap.manifest.runtime, readOnlyRelationManagersOnResourceViewPagesByDefault: true },
        },
      },
      page: { ...resourcePage.page, manifest: { ...resourcePage.page.manifest, pageType: 'view' as const } },
    }
    const readOnlyApp = createApp(PanelPage, { page: readOnlyPage })
    readOnlyApp.mount(container)
    await nextTick()
    expect(container.querySelector('[data-relation-manager="author"]')?.textContent).toContain('Ada')
    expect(container.querySelector('[data-operation="associate"]')).toBeNull()
    readOnlyApp.unmount()
    container.remove()
  })

  it('loads the example compiled Post schema and applies its real panel policy', async () => {
    const { nuxtPanelAcceptanceFixture } = await import('../../../apps/example-nuxt/tests/p9-panel-acceptance-nuxt')
    const { default: AdminPanel } = await import('../../../apps/example-nuxt/server/admin/AdminPanel')
    const schema = await nuxtPanelAcceptanceFixture.loadResourceSchema()
    const fields = Reflect.get(schema, 'fields') as readonly Record<string, unknown>[]
    const columns = Reflect.get(schema, 'columns') as readonly Record<string, unknown>[]
    const actions = Reflect.get(schema, 'actions') as readonly Record<string, unknown>[]
    expect(Reflect.get(schema, 'basePath')).toBe('/admin/posts')
    expect(fields.map(field => field.path)).toEqual([
      'title',
      'slug',
      'category',
      'city',
      'featuredMediaId',
    ])
    expect(fields.find(field => field.path === 'title')?.label).toBe('Title')
    expect(fields.find(field => field.path === 'featuredMediaId')?.label).toBe('Featured Media Id')
    expect(columns.map(column => Reflect.get(Reflect.get(column, 'manifest') as object, 'path'))).toEqual([
      'title',
      'slug',
      'category',
      'city',
      'author.name',
    ])
    expect(actions.map(action => action.kind)).toEqual(['view', 'edit', 'delete', 'action-group'])
    expect(actions.at(-1)).toMatchObject({ actions: [expect.objectContaining({ kind: 'custom' }), expect.objectContaining({ kind: 'delete' })] })
    expect(fields.find(field => field.path === 'slug')).toMatchObject({ type: 'slug' })
    expect(fields.find(field => field.path === 'category')).toMatchObject({ properties: { options: [{ label: 'News', value: 'News' }, { label: 'Guides', value: 'Guides' }] } })
    const panel = AdminPanel.compile()
    const context = { guard: 'web', operation: 'page-data' as const, panelId: 'admin', provider: 'session', signal: new AbortController().signal }
    const timestamp = new Date('2026-01-01T00:00:00.000Z')
    await expect(Promise.resolve(panel.server.access({ ...context, actor: { created_at: timestamp, email: 'editor@example.test', id: '1', name: 'Editor', password: 'secret', role: 'editor', tenantId: null, updated_at: timestamp } }))).resolves.toBe(true)
    await expect(Promise.resolve(panel.server.access({ ...context, actor: { created_at: timestamp, email: 'viewer@example.test', id: '2', name: 'Viewer', password: 'secret', role: 'viewer', tenantId: null, updated_at: timestamp } }))).resolves.toBe(false)
    expect(nuxtPanelAcceptanceFixture.pages.map(definition => definition.manifest.path)).toContain('/admin/posts/:record/edit')
  })
})
