import { DB } from '@holo-js/db'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { definePanel, type PanelBuilder } from '../src/panels/panel'
import type { PanelRouteRegistry } from '../src/panels/contracts'
import { panelErrorNotificationEffect, PanelRuntime } from '../src/panels/runtime'
import { compiledPanelRoutePath, executePanelRoute, resolvePanelRoute } from '../src/panels/routes'

class Actor {
  declare readonly id: string
}

describe('Filament-shaped panel configuration', () => {
  it('supports Filament-style identity configuration without requiring a constructor ID', () => {
    const panel = definePanel().id('admin').default().compile()
    const inferred = definePanel({ prototype: new Actor() }).id('staff')

    expect(panel.manifest).toMatchObject({ default: true, id: 'admin', path: '/admin' })
    expectTypeOf(inferred).toEqualTypeOf<PanelBuilder<Actor>>()
    expect(definePanel().id('cp').brandName('Control').compile().manifest).toMatchObject({
      branding: { name: 'Control' },
      id: 'cp',
      path: '/cp',
    })
  })

  it('uses Filament content width defaults and accepts nullable route registrars', () => {
    const panel = definePanel()
      .routes(null)
      .authenticatedRoutes(null)
      .tenantRoutes(null)
      .authenticatedTenantRoutes(null)
      .compile()

    expect(panel.manifest.layout?.maxContentWidth).toBe('7xl')
    expect(panel.server.routes).toEqual([])
  })

  it('uses SPA navigation by default and keeps explicit opt-out available', () => {
    expect(definePanel().compile().manifest.runtime?.spa).toBe(true)
    expect(definePanel().spa(false).compile().manifest.runtime?.spa).toBe(false)
  })

  it('configures independent auth pages without requiring a login page', () => {
    const publicPanel = definePanel('public').compile()
    const accountPanel = definePanel('account')
      .path('cp')
      .registration()
      .registrationRouteSlug('sign-up')
      .passwordReset()
      .passwordResetRoutePrefix('password-reset')
      .passwordResetRequestRouteSlug('request')
      .passwordResetRouteSlug('reset')
      .emailVerification()
      .emailVerificationRoutePrefix('email-verification')
      .emailVerificationPromptRouteSlug('prompt')
      .emailVerificationRouteSlug('verify')
      .emailChangeVerification()
      .emailChangeVerificationRoutePrefix('email-change-verification')
      .emailChangeVerificationRouteSlug('verify')
      .profile()
      .multiFactorAuthentication()
      .revealablePasswords(false)
      .compile()

    expect(publicPanel.manifest.auth).toBeNull()
    expect(accountPanel.manifest.auth).toMatchObject({
      emailChangeVerification: { path: '/cp/email-change-verification/verify' },
      emailVerification: {
        path: '/cp/email-verification/prompt',
        verificationPath: '/cp/email-verification/verify',
      },
      login: null,
      multiFactor: { challengePath: '/cp/mfa-challenge' },
      passwordReset: { requestPath: '/cp/password-reset/request', resetPath: '/cp/password-reset/reset' },
      profile: { path: '/cp/profile' },
      registration: { path: '/cp/sign-up' },
      revealablePasswords: false,
    })
    expect(accountPanel.server.auth?.passwordBroker).toBe('users')
    expect(definePanel('account')
      .path('cp')
      .login()
      .registration()
      .passwordReset()
      .compileDiscoveryDefinition().client).toMatchObject({
      forgotPasswordPath: '/cp/forgot-password',
      loginPath: '/cp/login',
      registrationPath: '/cp/register',
    })
  })

  it('supports external authentication without built-in auth pages and keeps guest access explicit', async () => {
    const actor = Object.assign(new Actor(), { id: 'external-user' })
    const panel = definePanel('external', Actor).compile()
    const authenticated = new PanelRuntime({
      guard: () => ({ provider: async () => 'external-users', user: async () => actor }),
    }, [panel])
    const guest = new PanelRuntime({
      guard: () => ({ provider: async () => 'external-users', user: async () => null }),
    }, [panel])

    await expect(authenticated.bootstrap(['external'], new AbortController().signal)).resolves.toMatchObject([
      { actor: {}, manifest: { auth: null, id: 'external' } },
    ])
    await expect(guest.bootstrap(['external'], new AbortController().signal)).rejects.toMatchObject({ code: 'unauthenticated' })

    const publicRoute = definePanel('public')
      .routes(routes => routes.get('/health', () => new Response('ok')))
      .compile()
    await expect(executePanelRoute(
      publicRoute,
      { guard: () => ({ provider: async () => null, user: async () => null }) },
      new Request('https://example.test/public/health'),
    )).resolves.toMatchObject({ status: 200 })
  })

  it('provides a convention-based working profile for model actors', async () => {
    class Actor {
      declare readonly id: string
      declare email: string
      declare name: string
      async update(values: Readonly<Record<string, unknown>>): Promise<void> {
        if (typeof values.name === 'string') this.name = values.name
        if (typeof values.email === 'string') this.email = values.email
      }
    }
    const persisted = Object.assign(new Actor(), { email: 'old@example.test', id: 'user-1', name: 'Old name' })
    const actorModel = {
      definition: {
        primaryKey: 'id',
        table: { columns: { email: {}, id: {}, name: {} }, tableName: 'users' },
      },
      find: vi.fn(async () => persisted),
      prototype: new Actor(),
    }
    const panel = definePanel(actorModel).profile().compile()
    const sessionActor = { email: persisted.email, id: persisted.id, name: persisted.name } as Actor
    const context = { actor: sessionActor, guard: 'web', panelId: 'panel', provider: 'users', services: {}, signal: new AbortController().signal, tenant: undefined }

    await expect(Promise.resolve(panel.server.auth?.profile?.values(context))).resolves.toEqual({ email: 'old@example.test', name: 'Old name' })
    await panel.server.auth?.profile?.update(context, { email: 'new@example.test', name: 'New name' })
    expect(persisted).toMatchObject({ email: 'new@example.test', name: 'New name' })
  })

  it('applies authentication route configuration independently of call order', () => {
    const auth = definePanel('admin')
      .loginRouteSlug('sign-in')
      .registrationRouteSlug('join')
      .passwordResetRequestRouteSlug('forgot')
      .passwordResetRouteSlug('change')
      .emailVerificationPromptRouteSlug('notice')
      .emailVerificationRouteSlug('confirm')
      .emailChangeVerificationRouteSlug('confirm')
      .login()
      .registration()
      .passwordReset()
      .emailVerification()
      .emailChangeVerification()
      .compile().manifest.auth

    expect(auth).toMatchObject({
      emailChangeVerification: { path: '/admin/confirm' },
      emailVerification: { path: '/admin/notice', verificationPath: '/admin/confirm' },
      login: { path: '/admin/sign-in' },
      passwordReset: { requestPath: '/admin/forgot', resetPath: '/admin/change' },
      registration: { path: '/admin/join' },
    })
  })

  it('compiles appearance, layout, search, routing, and runtime options into panel behavior', () => {
    const panel = definePanel('admin', Actor)
      .default()
      .domain('admin.example.com')
      .domains(['admin.example.com', 'staff.example.com'])
      .homeUrl('dashboard')
      .brandName('Acme')
      .defaultAvatarProvider('app:avatar-provider')
      .brandLogo('/brand.svg')
      .darkModeBrandLogo('/brand-dark.svg')
      .brandLogoHeight('2rem')
      .favicon('/favicon.svg')
      .colors({ primary: '#7c3aed' })
      .icons({ dashboard: 'layout-dashboard' })
      .viteTheme('/admin.css')
      .defaultThemeMode('dark')
      .themeSwitcher()
      .font('Inter')
      .monoFont('JetBrains Mono')
      .serifFont('Source Serif')
      .maxContentWidth('full')
      .simplePageMaxContentWidth('screen-md')
      .subNavigationPosition('top')
      .breadcrumbs(false)
      .sidebarCollapsibleOnDesktop()
      .sidebarFullyCollapsibleOnDesktop()
      .collapsibleNavigationGroups(false)
      .sidebarWidth('18rem')
      .collapsedSidebarWidth('5rem')
      .topbar(false)
      .sidebarComponent('app:admin-sidebar')
      .topbarComponent('app:admin-topbar')
      .navigationGroups(['Content', { collapsible: false, icon: 'settings', label: 'Settings' }])
      .globalSearchDebounce(250)
      .globalSearchKeyBindings(['meta+k'])
      .globalSearchFieldSuffix('Search resources')
      .globalSearchFieldKeyBindingSuffix('⌘K')
      .globalSearchResourceOptIn()
      .broadcasting(false)
      .spa({ hasPrefetching: true })
      .spaUrlExceptions(['/downloads/*'])
      .unsavedChangesAlerts()
      .databaseTransactions()
      .resourceCreatePageRedirect('view')
      .resourceEditPageRedirect('index')
      .readOnlyRelationManagersOnResourceViewPagesByDefault(false)
      .strictAuthorization()
      .registerErrorNotification('An error occurred', 'Please try again later.')
      .hiddenErrorNotification(403)
      .disabledErrorNotification(503)
      .assets([{ id: 'admin-theme', src: '/admin.css', type: 'css' }])
      .compile()

    expectTypeOf(definePanel('typed', Actor).login()).toEqualTypeOf<PanelBuilder<Actor>>()
    expect(panel.manifest).toMatchObject({
      assets: [{ id: 'vite-theme', src: '/admin.css', type: 'css' }, { id: 'admin-theme', src: '/admin.css', type: 'css' }],
      branding: { avatarProvider: 'app:avatar-provider', darkModeLogo: '/brand-dark.svg', logoHeight: '2rem', name: 'Acme' },
      components: { sidebar: 'app:admin-sidebar', topbar: 'app:admin-topbar' },
      errorNotifications: {
        disabledStatusCodes: [503],
        enabled: true,
        hiddenStatusCodes: [403],
        notifications: [{ body: 'Please try again later.', statusCode: null, title: 'An error occurred' }],
      },
      globalSearchConfiguration: { debounce: 250, enabled: true, keybindings: ['meta+k'], resourceOptIn: true },
      icons: { dashboard: 'layout-dashboard' },
      layout: {
        breadcrumbs: false,
        collapsedSidebarWidth: '5rem',
        maxContentWidth: 'full',
        sidebarFullyCollapsible: true,
        sidebarWidth: '18rem',
        subNavigationPosition: 'top',
        topbar: false,
      },
      routing: { domain: 'admin.example.com', domains: ['admin.example.com', 'staff.example.com'], homeUrl: '/admin/dashboard' },
      navigationGroups: [{ label: 'Content' }, { collapsible: false, icon: 'settings', label: 'Settings' }],
      runtime: { broadcasting: false, databaseTransactions: true, resourceCreatePageRedirect: 'view', resourceEditPageRedirect: 'index', spa: true, spaPrefetching: true, strictAuthorization: true, unsavedChangesAlerts: true },
      theme: { darkMode: 'dark', fontFamily: 'Inter', monoFontFamily: 'JetBrains Mono', serifFontFamily: 'Source Serif' },
    })
    expect(definePanel('admin').colors({ primary: '#7c3aed' }).font('Inter').monoFont('JetBrains Mono').serifFont('Source Serif').theme({ density: 'compact', tokens: { 'radius-lg': '1rem' } }).compileDiscoveryDefinition().client).toMatchObject({
      appearance: {
        colors: { primary: '#7c3aed' },
        density: 'compact',
        fontFamily: 'Inter',
        monoFontFamily: 'JetBrains Mono',
        serifFontFamily: 'Source Serif',
        tokens: { 'radius-lg': '1rem' },
      },
      simplePageMaxContentWidth: 'lg',
      themeColors: { primary: '#7c3aed' },
    })
  })

  it('keeps middleware and lifecycle callbacks server-only', async () => {
    const boot = vi.fn()
    const panelMiddleware = vi.fn(async (_context, next: () => Promise<unknown>) => next())
    const authenticatedMiddleware = vi.fn(async (_context, next: () => Promise<unknown>) => next())
    const tenantMiddleware = vi.fn(async (_context, next: () => Promise<unknown>) => next())
    const publicHandler = vi.fn(() => new Response('health'))
    const authenticatedTenantHandler = vi.fn(() => new Response('settings'))
    const registerPublicRoutes = vi.fn((routes: PanelRouteRegistry) => routes.get('/health', publicHandler))
    const registerAuthenticatedTenantRoutes = vi.fn((routes: PanelRouteRegistry) => routes.post('/settings/:section', authenticatedTenantHandler))
    const panel = definePanel('admin', Actor)
      .middleware([panelMiddleware])
      .authMiddleware([authenticatedMiddleware], true)
      .tenantMiddleware([tenantMiddleware])
      .bootUsing(boot)
      .routes(registerPublicRoutes)
      .authenticatedTenantRoutes(registerAuthenticatedTenantRoutes)
      .compile()

    expect(panel.server.middleware).toEqual({
      authenticated: [authenticatedMiddleware],
      panel: [panelMiddleware],
      persistent: { authenticated: [authenticatedMiddleware], panel: [], tenant: [] },
      tenant: [tenantMiddleware],
    })
    expect(panel.server.boot).toEqual([boot])
    expect(panel.server.routes).toEqual([
      { handler: publicHandler, method: 'GET', path: '/health', scope: 'public' },
      { handler: authenticatedTenantHandler, method: 'POST', path: '/settings/:section', scope: 'authenticated-tenant' },
    ])
    expect(registerPublicRoutes).toHaveBeenCalledOnce()
    expect(registerAuthenticatedTenantRoutes).toHaveBeenCalledOnce()
    const publicRoute = panel.server.routes?.[0]
    expect(publicRoute && compiledPanelRoutePath(panel, publicRoute)).toBe('/admin/health')
    expect(resolvePanelRoute(panel, new Request('https://example.test/admin/health'))).toMatchObject({
      definition: { method: 'GET', path: '/health', scope: 'public' },
      parameters: {},
    })
    expect(resolvePanelRoute(panel, new Request('https://example.test/admin/health', { method: 'POST' }))).toBeNull()
    await expect(executePanelRoute(
      panel,
      { guard: () => ({ provider: async () => null, user: async () => null }) },
      new Request('https://example.test/admin/health'),
    )).resolves.toMatchObject({ status: 200 })
    expect(publicHandler).toHaveBeenCalledOnce()
    expect(JSON.stringify(panel.manifest)).not.toContain('middleware')
    expect(JSON.stringify(panel.manifest)).not.toContain('boot')
    expect(JSON.stringify(panel.manifest)).not.toContain('registerPublicRoutes')

    const runtime = new PanelRuntime({ guard: () => ({ provider: async () => 'users', user: async () => new Actor() }) }, [panel])
    await runtime.bootstrap(['admin'], new AbortController().signal)
    await runtime.execute('admin', 'page-data', new AbortController().signal, () => undefined)
    expect(boot).toHaveBeenCalledOnce()
    expect(boot).toHaveBeenCalledWith(expect.objectContaining({ guard: 'web', manifest: panel.manifest }))
    expect(panelMiddleware).toHaveBeenCalledOnce()
    expect(authenticatedMiddleware).toHaveBeenCalledTimes(2)
    expect(tenantMiddleware).not.toHaveBeenCalled()
  })

  it('wraps mutation operations in Holo database transactions when enabled', async () => {
    const transaction = vi.spyOn(DB, 'writeTransaction').mockImplementation(async callback => callback(null as never))
    const panel = definePanel('admin', Actor).databaseTransactions().compile()
    const runtime = new PanelRuntime({ guard: () => ({ provider: async () => 'users', user: async () => new Actor() }) }, [panel])
    const mutate = vi.fn(() => 'saved')

    await expect(runtime.execute('admin', 'form-submit', new AbortController().signal, mutate)).resolves.toBe('saved')
    await expect(runtime.execute('admin', 'page-data', new AbortController().signal, () => 'read')).resolves.toBe('read')
    expect(transaction).toHaveBeenCalledOnce()
    expect(mutate).toHaveBeenCalledOnce()
    transaction.mockRestore()
  })

  it('derives the conventional database-notification identity from the actor model', async () => {
    const UserModel = {
      definition: { hidden: [], table: { tableName: 'users' } },
      prototype: { id: '', tenantId: '' },
    }
    const panel = definePanel('admin', UserModel).guard('staff').databaseNotifications({ realtime: true }).compile()
    const identity = await panel.server.notifications?.inbox.resolve({
      actor: { id: 'user-1', tenantId: 'tenant-1' },
      guard: 'staff',
      panelId: 'admin',
      provider: 'users',
      signal: new AbortController().signal,
    })

    expect(identity).toEqual({
      realtimeChannel: 'panels.notifications.staff.user-1',
      recipient: { id: 'user-1', type: 'users' },
      tenantId: 'tenant-1',
    })
    const quietPanel = definePanel('quiet', UserModel).guard('staff').databaseNotifications({ realtime: true }).broadcasting(false).compile()
    const runtime = new PanelRuntime({
      guard: () => ({ provider: async () => 'users', user: async () => ({ id: 'user-1', tenantId: 'tenant-1' }) }),
    }, [quietPanel])
    await expect(runtime.bootstrap(['quiet'], new AbortController().signal)).resolves.toMatchObject([
      { notifications: { realtimeChannel: null } },
    ])
  })

  it('serializes inferred model actor dates and excludes hidden or non-model attributes', async () => {
    const ActorModel = {
      definition: {
        hidden: ['password'],
        table: { columns: { createdAt: {}, id: {}, password: {} }, tableName: 'users' },
      },
      prototype: { createdAt: new Date(), id: '', password: '' },
    }
    const actor = {
      createdAt: new Date('2026-08-11T08:00:00.000Z'),
      id: 'user-1',
      password: 'secret',
      tenantIds: ['tenant-acme'],
    }

    await expect(definePanel('admin', ActorModel).compile().server.presentActor(actor)).resolves.toEqual({
      createdAt: '2026-08-11T08:00:00.000Z',
      id: 'user-1',
    })
  })

  it('derives tenant membership, presentation, routing, and persistence from Holo model conventions', async () => {
    class Tenant {
      declare readonly id: string
      declare readonly name: string
      declare readonly slug: string
    }
    class TenantActor {
      declare readonly id: string
      declare tenantId: string
      declare readonly tenants: readonly Tenant[]
      async update(values: Readonly<{ tenantId: string | null }>): Promise<void> {
        if (values.tenantId !== null) this.tenantId = values.tenantId
      }
    }
    const TenantModel = {
      definition: {
        primaryKey: 'id',
        table: { columns: { id: {}, name: {}, slug: {} }, tableName: 'tenants' },
      },
      prototype: new Tenant(),
    }
    const actor = Object.assign(new TenantActor(), {
      id: 'user-1',
      tenantId: 'tenant-1',
      tenants: [
        Object.assign(new Tenant(), { id: 'tenant-1', name: 'Acme', slug: 'acme' }),
        Object.assign(new Tenant(), { id: 'tenant-2', name: 'Globex', slug: 'globex' }),
      ],
    })
    const resolver = vi.fn((key: string, current: Readonly<{ actor: TenantActor }>) => current.actor.tenants.find(tenant => tenant.slug === key) ?? null)
    const subscribed = vi.fn(() => true)
    const billingProvider = {
      getRouteAction: () => () => new Response(null, { status: 204 }),
      getSubscribedMiddleware: () => subscribed,
    }
    const panel = definePanel('admin', TenantActor)
      .tenant(TenantModel)
      .tenantRoutePrefix('team')
      .tenantDomain('{tenant:slug}.example.com')
      .tenantSwitcher()
      .searchableTenantMenu()
      .tenantMenu()
      .tenantMenuItems([{ icon: 'settings', id: 'settings', label: 'Settings', path: 'tenant/settings' }])
      .tenantProfile()
      .tenantRegistration()
      .tenantBillingProvider(billingProvider)
      .tenantBillingRouteSlug('subscription')
      .requiresTenantSubscription()
      .resolveTenantUsing(resolver)
      .compile()
    const scope = { actor, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }

    await expect(panel.server.tenancy?.bootstrap(scope)).resolves.toMatchObject({
      active: { label: 'Acme', routeKey: 'acme' },
      memberships: { memberships: [{ label: 'Acme' }, { label: 'Globex' }] },
    })
    await expect(panel.server.tenancy?.switch('globex', scope)).resolves.toEqual({ id: 'tenant-2', routeKey: 'globex' })
    expect(actor.tenantId).toBe('tenant-2')
    expect(resolver).toHaveBeenCalledWith('globex', scope)

    actor.tenantId = 'tenant-1'
    const actorModel = {
      definition: {
        primaryKey: 'id',
        table: { columns: { id: {}, tenantId: {} }, tableName: 'users' },
      },
      find: vi.fn(async () => actor),
      prototype: new TenantActor(),
    }
    const restoredActor = { id: actor.id, tenantId: actor.tenantId } as TenantActor
    const restoredPanel = definePanel('restored', actorModel).tenant(TenantModel).compile()
    const restoredScope = { ...scope, actor: restoredActor, panelId: 'restored' }
    await expect(restoredPanel.server.tenancy?.switch('globex', restoredScope)).resolves.toEqual({ id: 'tenant-2', routeKey: 'globex' })
    expect(actor.tenantId).toBe('tenant-2')
    expect(actorModel.find).toHaveBeenCalledWith('user-1')

    expect(panel.manifest.tenancy).toEqual({
      billing: { path: '/admin/subscription' },
      enabled: true,
      menu: true,
      menuItems: [{ icon: 'settings', id: 'settings', label: 'Settings', path: '/admin/tenant/settings' }],
      profile: { path: '/admin/tenant/profile' },
      registration: { path: '/admin/tenant/register' },
      requiresSubscription: true,
      routeDomain: '{tenant:slug}.example.com',
      routePrefix: 'team',
      searchableMenu: true,
      switcher: true,
    })
    expect(panel.server.tenancy?.billing).toBe(billingProvider)
    const runtime = new PanelRuntime({ guard: () => ({ provider: async () => 'users', user: async () => actor }) }, [panel])
    await expect(runtime.execute('admin', 'page-data', new AbortController().signal, () => 'allowed')).resolves.toBe('allowed')
    expect(subscribed).toHaveBeenCalledOnce()

    const denied = definePanel('billing', TenantActor)
      .tenant(TenantModel)
      .tenantBillingProvider({
        getRouteAction: () => () => new Response(null, { status: 204 }),
        getSubscribedMiddleware: () => () => false,
      })
      .tenantBillingRouteSlug('subscription')
      .requiresTenantSubscription()
      .compile()
    const deniedRuntime = new PanelRuntime({ guard: () => ({ provider: async () => 'users', user: async () => actor }) }, [denied])
    await expect(deniedRuntime.execute('billing', 'page-data', new AbortController().signal, () => 'denied')).rejects.toMatchObject({
      billingPath: '/billing/subscription',
      code: 'subscription-required',
    })
    expect(() => definePanel('broken').requiresTenantSubscription().compile()).toThrow('tenant billing provider')
  })

  it('reloads model actors before resolving tenant relationships from authenticated sessions', async () => {
    class Tenant {
      declare readonly id: string
      declare readonly name: string
      declare readonly slug: string
    }
    class Actor {
      declare readonly id: string
      declare readonly tenantId: string
      readonly #relations = new Map<string, unknown>()
      getRelation(name: string): unknown {
        return this.#relations.get(name)
      }
      setRelation(name: string, value: unknown): void {
        this.#relations.set(name, value)
      }
    }
    const tenant = Object.assign(new Tenant(), { id: 'tenant-1', name: 'Acme', slug: 'acme' })
    const persistedActor = Object.assign(new Actor(), {
      id: 'user-1',
      tenantId: tenant.id,
    })
    persistedActor.setRelation('tenants', [tenant])
    const find = vi.fn(async (id: string | number) => id === persistedActor.id ? persistedActor : null)
    const actorModel = {
      definition: { primaryKey: 'id' },
      find,
      prototype: new Actor(),
      with: vi.fn(() => ({ find })),
    }
    const tenantModel = {
      definition: {
        primaryKey: 'id',
        table: { columns: { id: {}, name: {}, slug: {} }, tableName: 'tenants' },
      },
      prototype: new Tenant(),
    }
    const panel = definePanel('admin', actorModel).tenant(tenantModel).compile()
    const sessionActor = Object.assign(new Actor(), { id: persistedActor.id, tenantId: tenant.id })
    const scope = { actor: sessionActor, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }

    await expect(panel.server.tenancy?.activeContext(scope)).resolves.toMatchObject({ tenantId: tenant.id, tenantRouteKey: tenant.slug })
    expect(actorModel.with).toHaveBeenCalledWith('tenants')
    expect(find).toHaveBeenCalledWith(persistedActor.id)
  })

  it('rejects unsafe public configuration at construction boundaries', () => {
    expect(() => definePanel('admin').domain('https://admin.example.com')).toThrow('valid hostnames')
    expect(() => definePanel('admin').brandLogoHeight('expression(alert(1))')).toThrow('CSS length')
    expect(() => definePanel('admin').homeUrl('/outside')).toThrow('fixed panel path')
    expect(() => definePanel('admin').assets([{ id: 'theme', src: 'javascript:alert(1)', type: 'css' }])).toThrow('absolute path or HTTPS')
  })

  it('resolves configured, hidden, disabled, and default error notifications by status', () => {
    const panel = definePanel('admin')
      .registerErrorNotification('Something failed', 'Try again.')
      .registerErrorNotification('Missing record', 'The requested record no longer exists.', 404)
      .hiddenErrorNotification(403)
      .disabledErrorNotification(503)
      .compile()

    expect(panelErrorNotificationEffect(panel, 404)).toMatchObject({
      kind: 'toast',
      level: 'danger',
      message: 'The requested record no longer exists.',
      title: 'Missing record',
    })
    expect(panelErrorNotificationEffect(panel, 500)).toMatchObject({ message: 'Try again.', title: 'Something failed' })
    expect(panelErrorNotificationEffect(panel, 403)).toBeNull()
    expect(panelErrorNotificationEffect(panel, 503)).toBeNull()
    expect(panelErrorNotificationEffect(definePanel('quiet').errorNotifications(false).compile(), 500)).toBeNull()
    expect(panelErrorNotificationEffect(definePanel('default').compile(), 500)).toMatchObject({
      message: 'Please try again later.',
      title: 'An error occurred',
    })
  })
})
