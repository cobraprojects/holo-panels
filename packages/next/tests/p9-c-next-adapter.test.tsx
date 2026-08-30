import { act, type ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestEnvelope, definePage, definePanel, defineStatsWidget, TRANSPORT_REQUEST_FIELD, type HoloAuth, type JsonObject } from '@holo-js/panels-core'
import { ClientEffectSession, ClientToastStore, ReactFeedbackProvider, type PanelAvatarComponentProps, type PanelChromeComponentProps, type ReactNotificationInboxTriggerProps } from '@holo-js/panels-react'
import { createNextPanelComponentRegistry, NextPanelClient } from '../src/panel-client'
import { NextPanelResourcePage } from '../src/resource-page'
import { createPanelOperationRoute } from '../src/operation'
import { nextPanelsRuntimeInternals, resolveNextPanelBillingResponse, resolveNextPanelPage, resolveNextPanelPath } from '../src/runtime'
import type { NextPanelsRuntime } from '../src/contracts'
import { createNextPanelsAcceptanceRuntime, nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@holo-js/security/next/server', () => ({
  csrfProtection: () => (request: Request) => request.headers.get('x-csrf-token') === 'valid'
    ? undefined
    : new Response('CSRF token mismatch.', { status: 419 }),
}))

class Actor {
  declare readonly id: number
}

const panel = definePanel('admin', Actor)
  .path('/admin')
  .presentActor(actor => ({ id: actor.id }))
  .compile()

const reportsPanel = definePanel('reports', Actor)
  .path('/reports')
  .presentActor(currentActor => ({ id: currentActor.id }))
  .compile()

const posts = definePage('posts', { actor: Actor, load: () => ({ records: [{ id: 1, title: 'First post' }] }) })
  .path('/admin/posts')
  .title('Posts')
  .heading('Manage posts')
  .navigation({ label: 'Posts', sort: 1 })
  .compile()

const actor = { id: 7 }
const auth: HoloAuth<object> = {
  guard: () => ({ provider: async () => 'session', user: async () => actor }),
}

function runtime(overrides: Partial<NextPanelsRuntime> = {}): NextPanelsRuntime {
  return {
    auth,
    registry: {
      'admin:panel:admin': async () => panel,
      'admin:page:posts': async () => posts,
      'admin:resource:posts': vi.fn(async () => { throw new Error('Resource modules stay lazy until an operation needs them') }),
    },
    ...overrides,
  }
}

function operationRequest(panelId: string, operation: string, payload: JsonObject = {}, csrf = 'valid'): Request {
  const envelope = createRequestEnvelope({ id: 'request-123', operation, panelId, payload })
  const body = new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: JSON.stringify(envelope), _token: csrf })
  return new Request(`https://example.test/holo/panels/${panelId}/${operation}`, {
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': csrf },
    method: 'POST',
  })
}

afterEach(() => {
  routerPush.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Next panel adapter', () => {
  it('resolves safe optional catch-all routes, authenticates, and leaves resources lazy', async () => {
    const configured = runtime()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), configured)
    expect(payload.bootstrap.actor).toEqual({ id: 7 })
    expect(payload.bootstrap.manifest.navigation).toEqual([expect.objectContaining({ id: 'posts', label: 'Posts', path: '/admin/posts' })])
    expect(payload.page.data).toEqual({ records: [{ id: 1, title: 'First post' }] })
    expect(configured.registry['admin:resource:posts']).not.toHaveBeenCalled()
    await expect(resolveNextPanelPage('admin', ['..'], new Request('https://example.test/admin'), configured)).rejects.toThrow('unsafe segment')
  })

  it('includes every authorized discovered page in navigation and omits denied pages', async () => {
    const denied = definePage('secret', { actor: Actor, load: () => ({}) })
      .authorize(() => false)
      .path('/admin/secret')
      .navigation({ label: 'Secret', sort: 2 })
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: {
        'admin:page:posts': async () => posts,
        'admin:page:secret': async () => denied,
        'admin:panel:admin': async () => panel,
      },
    }))

    expect(payload.bootstrap.manifest.navigation.map(item => item.id)).toEqual(['posts'])
  })

  it('derives fixed routes from the compiled panel path when the ID differs', async () => {
    const controlPanel = definePanel('backoffice', Actor).path('/control').presentActor(currentActor => ({ id: currentActor.id })).compile()
    const controlPage = definePage('control-posts', { actor: Actor, load: () => ({ ready: true }) }).path('/control/posts').compile()
    const configured = runtime({ registry: { 'backoffice:page:control-posts': async () => controlPage, 'backoffice:panel:backoffice': async () => controlPanel } })
    expect(await resolveNextPanelPath('backoffice', configured)).toBe('/control')
    const payload = await resolveNextPanelPage('backoffice', ['posts'], new Request('https://example.test/control/posts'), configured)
    expect(payload.path).toBe('/control/posts')
  })

  it('serves a domain-bound panel only on its configured hosts', async () => {
    const domainPanel = definePanel('admin', Actor)
      .path('/admin')
      .domains(['admin.example.test', 'staff.example.test'])
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const configured = runtime({ registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => domainPanel } })

    await expect(resolveNextPanelPage('admin', ['posts'], new Request('https://admin.example.test/admin/posts'), configured)).resolves.toMatchObject({ path: '/admin/posts' })
    await expect(resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), configured)).rejects.toMatchObject({ name: 'NextPanelPageNotFoundError' })
  })

  it('uses the configured panel home URL for the brand link', async () => {
    const homePanel = definePanel('admin', Actor)
      .path('/admin')
      .homeUrl('/admin/overview')
      .icons({ posts: 'home' })
      .navigationItems([{ badge: null, group: null, icon: 'posts', id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 1 }])
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => homePanel },
    }))

    const markup = renderToString(<NextPanelClient payload={payload} />)
    expect(markup).toContain('href="/admin/overview"')
    expect(markup).toContain('data-icon="home"')
  })

  it('renders shared panel chrome in Arabic with an RTL sidebar', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts', { headers: { 'accept-language': 'ar' } }), runtime())
    const markup = renderToString(<NextPanelClient payload={payload} />)

    expect(payload.bootstrap).toMatchObject({ direction: 'rtl', locale: 'ar' })
    expect(markup).toContain('dir="rtl"')
    expect(markup).toContain('lang="ar"')
    expect(markup).toContain('قائمة الحساب')
    expect(markup).toContain('data-side="right"')
  })

  it('navigates same-origin panel links in SPA mode, honors exceptions, and prefetches on hover', async () => {
    const spaPanel = definePanel('admin', Actor)
      .path('/admin')
      .spa({ hasPrefetching: true })
      .spaUrlExceptions(['/admin/external*'])
      .navigationItems([
        { badge: null, group: null, icon: null, id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 1 },
        { badge: null, group: null, icon: null, id: 'external', label: 'External', parent: null, path: '/admin/external-report', sort: 2 },
      ])
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => spaPanel },
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<NextPanelClient payload={payload} />))
    const postsLink = [...container.querySelectorAll('a')].find(anchor => anchor.textContent === 'Posts')
    const externalLink = [...container.querySelectorAll('a')].find(anchor => anchor.textContent === 'External')
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
    await act(async () => root.unmount())
  })

  it('passes the active tenant identifier to generated page contexts', async () => {
    const tenant: Readonly<{ id: string, slug: string }> = Object.freeze({ id: 'tenant-acme', slug: 'acme' })
    const tenantModel = Object.freeze({ prototype: { id: '', slug: '' } })
    const tenantPanel = definePanel('tenant-admin', Actor)
      .path('/tenant-admin')
      .tenancy({
        authorize: () => true,
        findMembershipById: id => id === tenant.id ? tenant : null,
        findMembershipByRouteKey: routeKey => routeKey === tenant.slug ? tenant : null,
        identify: value => value.id,
        memberships: () => ({ nextCursor: null, tenants: [tenant] }),
        model: tenantModel,
        persistence: {
          clear: async () => undefined,
          load: async () => tenant.id,
          save: async () => undefined,
        },
        present: value => ({ label: value.slug }),
        routeKey: value => value.slug,
      })
      .compile()
    const tenantPage = definePage('tenant-dashboard', {
      load: context => ({ tenantId: context.tenant }),
      tenant: String,
    }).path('/tenant-admin').compile()
    const configured = runtime({
      registry: {
        'tenant-admin:page:tenant-dashboard': async () => tenantPage,
        'tenant-admin:panel:tenant-admin': async () => tenantPanel,
      },
    })

    const payload = await resolveNextPanelPage('tenant-admin', [], new Request('https://example.test/tenant-admin'), configured)

    expect(payload.page.data).toEqual({ tenantId: 'tenant-acme' })
  })

  it('renders deterministic SSR and hydrates the JSON-only client boundary', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const markup = renderToString(<NextPanelClient payload={payload} />)
    expect(markup).toContain('Manage posts')
    expect(markup).toContain('aria-current="page"')
    document.body.innerHTML = '<div id="root"></div>'
    const container = document.querySelector('#root')!
    container.innerHTML = markup
    const errors: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container as unknown as Element, <NextPanelClient payload={payload} />, { onRecoverableError: error => errors.push(error) })
      await Promise.resolve()
    })
    expect(errors).toEqual([])
    await act(async () => root?.unmount())
  })

  it('exposes additive shell regions, collapsed labels, and the shared account glyph', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const markup = renderToString(<NextPanelClient payload={payload} />)

    expect(markup).toContain('hp-panel-topbar-start')
    expect(markup).toContain('hp-panel-topbar-end')
    expect(markup).toContain('hp-panel-navigation-header')
    expect(markup).toContain('hp-panel-navigation-body')
    expect(markup).toContain('hp-panel-main-header')
    expect(markup).toContain('hp-panel-main-body')
    expect(markup).toContain('hp-panel-user-glyph')
    expect(markup).toContain('hp-panel-user-action')
    expect(markup).toContain('hp-panel-actions--compact')
    expect(markup).toContain('aria-label="Account menu"')
    expect(markup).not.toContain('>AC<')
  })

  it('portals overlays into the owning panel root and removes them on unmount', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const container = document.createElement('div')
    container.dir = 'rtl'
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<NextPanelClient payload={payload} />))
    const host = container.querySelector<HTMLElement>('[data-holo-panel][data-panel="admin"]')
    expect(host?.parentElement).toBe(container)
    expect(host?.hasAttribute('data-holo-panel')).toBe(true)
    expect(host?.dataset.theme).toBe(payload.bootstrap.manifest.theme.darkMode)
    expect(host?.dataset.density).toBe(payload.bootstrap.manifest.theme.density)
    expect(host?.closest('[dir="rtl"]')).toBe(container)
    expect(host?.style.getPropertyValue('--hp-sidebar-width')).not.toBe('')

    const account = container.querySelector<HTMLButtonElement>('[aria-label="Account menu"]')
    await act(async () => {
      account?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }))
    })
    await vi.waitFor(() => expect(host?.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull())

    await act(async () => root.unmount())
    expect(document.body.contains(host)).toBe(false)
    container.remove()
  })

  it('dismisses the mobile drawer with Escape or its backdrop and restores toggle focus', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const mediaQueryState = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: '(max-width: 767px)',
      onchange: null,
      removeEventListener: vi.fn(),
    }
    const mediaQuery = mediaQueryState as unknown as MediaQueryList
    const matchMedia = vi.spyOn(globalThis, 'matchMedia').mockReturnValue(mediaQuery)
    vi.stubGlobal('innerWidth', 600)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<NextPanelClient payload={payload} />))
    const toggle = container.querySelector<HTMLButtonElement>('.hp-panel-navigation-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
    expect(mediaQueryState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-panels-component="slide-over"][data-mobile="true"]')).not.toBeNull()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    await vi.waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)

    await act(async () => toggle.click())
    const backdrop = container.querySelector<HTMLElement>('[data-slot="sheet-overlay"][data-state="open"]')!
    await act(async () => new Promise<void>(resolve => setTimeout(resolve, 0)))
    await act(async () => {
      backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerType: 'mouse' }))
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
    })
    await vi.waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)
    await act(async () => root.unmount())
    expect(mediaQueryState.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    container.remove()
  })

  it('renders the built-in tenant switcher without application transport helpers', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const tenantPayload = {
      ...payload,
      bootstrap: {
        ...payload.bootstrap,
        manifest: { ...payload.bootstrap.manifest, tenancy: { enabled: true as const } },
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

    const markup = renderToString(<NextPanelClient payload={{
      ...tenantPayload,
      page: { ...tenantPayload.page, breadcrumbs: [{ label: 'Posts', path: '/admin/posts' }] },
    }} />)

    expect(markup).toContain('aria-label="Tenant menu"')
    expect(markup).toContain('data-slot="dropdown-menu-trigger"')
    expect(markup).toContain('Acme')
    const container = document.createElement('div')
    container.innerHTML = markup
    const sidebar = container.querySelector('.hp-panel-sidebar')
    const tenantMenu = sidebar?.querySelector('[aria-label="Tenant menu"]')
    const navigation = sidebar?.querySelector('.hp-panel-navigation-body')
    const accountMenu = sidebar?.querySelector('[aria-label="Account menu"]')
    expect(tenantMenu).not.toBeNull()
    expect(navigation).not.toBeNull()
    expect(accountMenu).not.toBeNull()
    expect(tenantMenu?.compareDocumentPosition(navigation!).toString()).toBe(Node.DOCUMENT_POSITION_FOLLOWING.toString())
    expect(navigation?.compareDocumentPosition(accountMenu!).toString()).toBe(Node.DOCUMENT_POSITION_FOLLOWING.toString())
    const pageHeader = container.querySelector('.hp-panel-page-header')
    expect(pageHeader?.querySelector('.hp-panel-page-heading .hp-panel-breadcrumbs')).not.toBeNull()
    expect(pageHeader?.querySelector('.hp-panel-page-actions')).not.toBeNull()
    const hidden = renderToString(<NextPanelClient payload={{
      ...tenantPayload,
      bootstrap: { ...tenantPayload.bootstrap, manifest: { ...tenantPayload.bootstrap.manifest, tenancy: { enabled: true, switcher: false } } },
    }} />)
    expect(hidden).not.toContain('aria-label="Tenant menu"')
  })

  it('restores an isolated light, dark, or system preference for the panel', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem('holo-panels:admin:color-mode', 'dark')
    document.body.innerHTML = '<div id="root"></div>'
    const container = document.querySelector('#root')!
    const root = createRoot(container)
    await act(async () => root.render(<NextPanelClient payload={payload} />))
    const panelRoot = container.querySelector<HTMLElement>('[data-holo-panel]')
    expect(panelRoot?.dataset.theme).toBe('dark')
    await act(async () => root.unmount())
  })

  it('renders top navigation without a sidebar when the panel selects topbar mode', async () => {
    const topbarPanel = definePanel('admin', Actor)
      .path('/admin')
      .navigationMode('topbar')
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: {
        'admin:page:posts': async () => posts,
        'admin:panel:admin': async () => topbarPanel,
      },
    }))
    const markup = renderToString(<NextPanelClient payload={payload} />)

    expect(markup).toContain('hp-panel-navigation--topbar')
    expect(markup).toContain('hp-panel-topbar-center')
    expect(markup).not.toContain('hp-panel-sidebar')
  })

  it('omits the panel header when the provider disables the topbar', async () => {
    const panel = definePanel('admin', Actor)
      .path('/admin')
      .topbar(false)
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: {
        'admin:page:posts': async () => posts,
        'admin:panel:admin': async () => panel,
      },
    }))

    expect(renderToString(<NextPanelClient payload={payload} />)).not.toContain('hp-panel-header')
  })

  it('omits the account dropdown when the provider disables the user menu', async () => {
    const configuredPanel = definePanel('admin', Actor)
      .path('/admin')
      .userMenu(false)
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => configuredPanel },
    }))

    expect(renderToString(<NextPanelClient payload={payload} />)).not.toContain('hp-panel-user-trigger')
  })

  it('omits navigation chrome when the provider disables navigation', async () => {
    const configuredPanel = definePanel('admin', Actor)
      .path('/admin')
      .navigation(false)
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => configuredPanel },
    }))
    const markup = renderToString(<NextPanelClient payload={payload} />)

    expect(markup).not.toContain('hp-panel-sidebar')
    expect(markup).not.toContain('hp-panel-navigation-toggle')
  })

  it('renders provider-configured topbar, sidebar, and avatar components', async () => {
    const chromePanel = definePanel('admin', Actor)
      .path('/admin')
      .topbarComponent('custom-topbar')
      .sidebarComponent('custom-sidebar')
      .assets([{ id: 'admin-theme', src: '/admin/theme.css', type: 'css' }])
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const avatarPanel = definePanel('admin', Actor)
      .path('/admin')
      .defaultAvatarProvider('custom-avatar')
      .databaseNotifications({ component: 'custom-notification' })
      .presentActor(currentActor => ({ id: currentActor.id }))
      .compile()
    const registry = createNextPanelComponentRegistry()
      .register('custom-topbar', (props: PanelChromeComponentProps) => <header data-custom-topbar={props.manifest.id}>{props.page ? 'Custom topbar' : null}</header>)
      .register('custom-sidebar', (props: PanelChromeComponentProps) => <aside data-custom-sidebar={props.actor.id}>Custom sidebar</aside>)
      .register('custom-avatar', (props: PanelAvatarComponentProps) => <span data-custom-avatar={props.actor.id}>{props.label}</span>)
      .register('custom-notification', (props: ReactNotificationInboxTriggerProps) => <span data-custom-notification={props.placement}>Custom notifications</span>)
    const resolve = async (configuredPanel: typeof chromePanel) => resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime({
      registry: {
        'admin:page:posts': async () => posts,
        'admin:panel:admin': async () => configuredPanel,
      },
    }))

    const chrome = renderToString(<NextPanelClient payload={await resolve(chromePanel)} registry={registry} />)
    const avatar = renderToString(<NextPanelClient payload={await resolve(avatarPanel)} registry={registry} />)
    expect(chrome).toContain('data-custom-topbar="admin"')
    expect(chrome).toContain('data-custom-sidebar="7"')
    expect(chrome).not.toContain('hp-panel-header')
    expect(chrome).toContain('data-panel-asset="admin-theme"')
    expect(chrome).toContain('href="/admin/theme.css"')
    expect(avatar).toContain('data-custom-avatar="7"')
    expect(avatar).toContain('data-custom-notification="topbar"')
    expect(avatar).toContain('hp-panel-notification-action')
  })

  it('serves the configured tenant billing route and enforces required subscriptions elsewhere', async () => {
    const routeAction = vi.fn(() => new Response(null, { headers: { location: 'https://billing.example.test/session' }, status: 303 }))
    const billing = {
      getRouteAction: () => routeAction,
      getSubscribedMiddleware: () => () => false,
    }
    class BillingTenant {
      declare readonly id: string
      declare readonly slug: string
    }
    const BillingTenantModel = { prototype: new BillingTenant() }
    const tenant = Object.assign(new BillingTenant(), { id: 'tenant-1', slug: 'acme' })
    const billingPanel = definePanel('admin', Actor)
      .path('/admin')
      .presentActor(currentActor => ({ id: currentActor.id }))
      .tenancy({
        authorize: () => true,
        findMembershipById: tenantId => tenantId === tenant.id ? tenant : null,
        findMembershipByRouteKey: routeKey => routeKey === tenant.slug ? tenant : null,
        identify: currentTenant => currentTenant.id,
        memberships: () => ({ nextCursor: null, tenants: [tenant] }),
        model: BillingTenantModel,
        persistence: { clear: async () => undefined, load: async () => tenant.id, save: async () => undefined },
        present: currentTenant => ({ label: currentTenant.slug }),
        routeKey: currentTenant => currentTenant.slug,
      })
      .tenantBillingProvider(billing)
      .tenantBillingRouteSlug('subscription')
      .requiresTenantSubscription()
      .compile()
    const configuredRuntime = runtime({
      registry: {
        'admin:page:posts': async () => posts,
        'admin:panel:admin': async () => billingPanel,
      },
    })
    const request = new Request('https://example.test/admin/subscription')

    const response = await resolveNextPanelBillingResponse('admin', ['subscription'], request, configuredRuntime)
    expect(response?.status).toBe(303)
    expect(response?.headers.get('location')).toBe('https://billing.example.test/session')
    expect(routeAction).toHaveBeenCalledOnce()
    await expect(resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), configuredRuntime)).rejects.toMatchObject({
      billingPath: '/admin/subscription',
      code: 'subscription-required',
    })
  })

  it('resolves declared page widgets and renders their data as dashboard cards', async () => {
    const dashboard = definePage('dashboard', { actor: Actor, load: () => ({}) })
      .path('/admin')
      .headerWidgets('content-overview')
      .compile()
    const overview = defineStatsWidget('content-overview')
      .data(() => ({
        stats: [{
          action: null,
          chart: [],
          color: 'primary',
          description: 'All posts',
          icon: null,
          id: 'posts',
          label: 'Posts',
          trend: null,
          url: '/admin/posts',
          value: '3',
        }],
      }))
      .compile()
    const configured = runtime({
      registry: {
        'admin:page:dashboard': async () => dashboard,
        'admin:panel:admin': async () => panel,
        'admin:widget:content-overview': async () => overview,
      },
    })

    const payload = await resolveNextPanelPage('admin', [], new Request('https://example.test/admin'), configured)
    const markup = renderToString(<NextPanelClient payload={payload} />)

    expect(payload.widgets.header).toEqual([expect.objectContaining({ status: 'ready' })])
    expect(markup).toContain('hp-widget-stats')
    expect(markup).toContain('All posts')
    expect(markup).not.toContain('<dt>stats</dt>')
  })

  it('enforces panel allow-lists, CSRF, authorization, and safe mutation responses', async () => {
    const execute = vi.fn(async (input: { readonly request: Request }) => {
      const replayed = await input.request.clone().formData()
      expect(replayed.get(TRANSPORT_REQUEST_FIELD)).toContain('request-123')
      return { data: { saved: true }, effects: [{ kind: 'redirect' as const, url: '/admin/posts' }] }
    })
    const route = createPanelOperationRoute({ panelIds: ['admin', 'reports'], runtime: runtime({ execute }) })
    const context = { params: Promise.resolve({ operation: 'form-submit', panelId: 'admin' }) }
    const denied = await route.POST(operationRequest('admin', 'form-submit', {}, 'invalid'), context)
    expect(denied.status).toBe(419)
    const accepted = await route.POST(operationRequest('admin', 'form-submit', { title: 'Post' }), context)
    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toMatchObject({ direction: 'ltr', effects: [{ kind: 'redirect', url: '/admin/posts' }], id: 'request-123', locale: 'en', ok: true, protocolVersion: '1.0' })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'form-submit', panelId: 'admin', payload: { title: 'Post' } }))
    const unknown = await route.POST(operationRequest('other', 'bootstrap'), { params: Promise.resolve({ operation: 'bootstrap', panelId: 'other' }) })
    expect(unknown.status).toBe(404)
  })

  it('serves generated custom panel routes at rewritten public and authenticated URLs', async () => {
    const publicHandler = vi.fn(() => new Response('healthy'))
    const authenticatedHandler = vi.fn(() => new Response('private'))
    const routedPanel = definePanel('admin', Actor)
      .path('/admin')
      .presentActor(currentActor => ({ id: currentActor.id }))
      .routes(routes => routes.get('/health', publicHandler))
      .authenticatedRoutes(routes => routes.get('/private', authenticatedHandler))
      .compile()
    const route = createPanelOperationRoute({
      panelIds: ['admin'],
      runtime: runtime({ registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => routedPanel } }),
    })

    const publicResponse = await route.GET(new Request('https://example.test/holo/panels/admin/custom-route?panelRoute=/admin/health'), {
      params: Promise.resolve({ operation: 'custom-route', panelId: 'admin' }),
    })
    const authenticatedResponse = await route.GET(new Request('https://example.test/holo/panels/admin/custom-route?panelRoute=/admin/private'), {
      params: Promise.resolve({ operation: 'custom-route', panelId: 'admin' }),
    })

    await expect(publicResponse.text()).resolves.toBe('healthy')
    await expect(authenticatedResponse.text()).resolves.toBe('private')
    expect(publicHandler).toHaveBeenCalledOnce()
    expect(authenticatedHandler).toHaveBeenCalledOnce()
  })

  it('returns configured panel error notifications as client toast effects', async () => {
    const errorPanel = definePanel('admin', Actor)
      .path('/admin')
      .presentActor(currentActor => ({ id: currentActor.id }))
      .registerErrorNotification('Save failed', 'The post could not be saved.', 500)
      .compile()
    const route = createPanelOperationRoute({
      panelIds: ['admin'],
      runtime: runtime({
        execute: async () => { throw new Error('database unavailable') },
        registry: { 'admin:page:posts': async () => posts, 'admin:panel:admin': async () => errorPanel },
      }),
    })
    const response = await route.POST(operationRequest('admin', 'form-submit'), { params: Promise.resolve({ operation: 'form-submit', panelId: 'admin' }) })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      direction: 'ltr',
      effects: [{ kind: 'toast', level: 'danger', message: 'The post could not be saved.', title: 'Save failed' }],
      locale: 'en',
      ok: false,
    })
  })

  it('accepts bounded multipart upload bodies beyond the ordinary transport limit', async () => {
    const execute = vi.fn(async (input: { readonly request: Request }) => {
      const form = await input.request.formData()
      const contents = form.get('contents')
      expect(contents).toBeInstanceOf(Blob)
      expect((contents as Blob).size).toBe(2_097_152)
      return { data: { stored: true } }
    })
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime({ execute }) })
    const envelope = createRequestEnvelope({ id: 'upload-request-123', operation: 'upload', panelId: 'admin', payload: { action: 'write', fieldId: 'avatar', resourceId: 'posts' } })
    const body = new FormData()
    body.set(TRANSPORT_REQUEST_FIELD, JSON.stringify(envelope))
    body.set('_token', 'valid')
    body.set('contents', new Blob([new Uint8Array(2_097_152)]))
    const response = await route.POST(new Request('https://example.test/holo/panels/admin/upload', {
      body,
      headers: { 'x-csrf-token': 'valid' },
      method: 'POST',
    }), { params: Promise.resolve({ operation: 'upload', panelId: 'admin' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { stored: true }, ok: true })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('loads only exact generated registry keys and rejects ambiguous route setup', async () => {
    const configured = runtime()
    expect(nextPanelsRuntimeInternals.registryKeys(configured, 'admin', 'page')).toEqual(['admin:page:posts'])
    expect(() => createPanelOperationRoute({ panelIds: ['admin', 'admin'], runtime: configured })).toThrow('unique stable panel IDs')
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: configured })
    const bootstrap = await route.POST(operationRequest('admin', 'bootstrap'), { params: Promise.resolve({ operation: 'bootstrap', panelId: 'admin' }) })
    expect(bootstrap.status).toBe(200)
    await expect(bootstrap.json()).resolves.toMatchObject({ data: { actor: { id: 7 }, manifest: { id: 'admin', navigation: [{ id: 'posts', path: '/admin/posts' }] } }, id: 'request-123', ok: true })
  })

  it('isolates multiple panels behind the generated route allow-list', async () => {
    const configured = runtime({
      registry: {
        'admin:panel:admin': async () => panel,
        'admin:page:posts': async () => posts,
        'reports:panel:reports': async () => reportsPanel,
      },
    })
    const route = createPanelOperationRoute({ panelIds: ['admin', 'reports'], runtime: configured })
    const result = await route.POST(operationRequest('reports', 'bootstrap'), {
      params: Promise.resolve({ operation: 'bootstrap', panelId: 'reports' }),
    })
    await expect(result.json()).resolves.toMatchObject({ data: { manifest: { id: 'reports' } }, ok: true })
  })

  it('rejects mismatched, malformed, and oversized transport envelopes with safe protocol errors', async () => {
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime() })
    const context = { params: Promise.resolve({ operation: 'bootstrap', panelId: 'admin' }) }
    const mismatch = await route.POST(operationRequest('admin', 'page-data'), context)
    await expect(mismatch.json()).resolves.toMatchObject({
      error: { category: 'validation', message: 'The submitted data is invalid.' },
      id: 'request-123',
      ok: false,
      protocolVersion: '1.0',
    })
    const malformed = await route.POST(new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: '{' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    }), context)
    await expect(malformed.json()).resolves.toMatchObject({ error: { category: 'validation' }, id: 'invalid-request', ok: false })
    const rejectedBeforeDecode = await route.POST(new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: '{' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'invalid' },
      method: 'POST',
    }), context)
    expect(rejectedBeforeDecode.status).toBe(419)
    await expect(rejectedBeforeDecode.json()).resolves.toMatchObject({ error: { category: 'authorization' }, id: 'invalid-request', ok: false })
    const oversizedRequest = new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: 'x' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    })
    const getHeader = oversizedRequest.headers.get.bind(oversizedRequest.headers)
    vi.spyOn(oversizedRequest.headers, 'get').mockImplementation(name => name.toLowerCase() === 'content-length' ? '1048577' : getHeader(name))
    const oversized = await route.POST(oversizedRequest, context)
    expect(oversized.status).toBe(413)
    await expect(oversized.json()).resolves.toMatchObject({ error: { category: 'internal' }, ok: false })
    const unrelatedBody = new URLSearchParams({ padding: 'x'.repeat(1_048_576), [TRANSPORT_REQUEST_FIELD]: '{}' })
    const chunked = new Request('https://example.test', {
      body: unrelatedBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    })
    expect(chunked.headers.get('content-length')).toBeNull()
    const chunkedResult = await route.POST(chunked, context)
    expect(chunkedResult.status).toBe(413)
  })

  it('exposes the example Post CRUD routes, policy boundaries, and page actions', async () => {
    const pages = nextPanelAcceptanceFixture.pages
    expect(pages.map(page => [page.manifest.pageType, page.manifest.path])).toEqual([
      ['list', '/admin/posts'],
      ['create', '/admin/posts/create'],
      ['view', '/admin/posts/:record'],
      ['edit', '/admin/posts/:record/edit'],
    ])
    const body = pages[3]?.manifest.body
    expect(body?.component).toBe('resource-page')
    const resource = body?.properties.resource
    expect(resource && typeof resource === 'object' && !Array.isArray(resource) ? resource.actions : null).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'delete', kind: 'delete' }),
    ]))
  })

  it('runs the Post List/Create/Edit/View/Delete UI journey with filters and safe errors', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const mutations: { readonly intent: string, readonly recordId: number | string | null, readonly values: Readonly<Record<string, string>> }[] = []
    let fail = false
    const adminAuth: HoloAuth<object> = {
      guard: () => ({ provider: async () => 'session', user: async () => ({ id: '7', role: 'admin' }) }),
    }
    const exampleRuntime = await createNextPanelsAcceptanceRuntime({
      auth: adminAuth,
      async mutatePost(mutation: { readonly intent: string, readonly recordId: number | string | null, readonly values: Readonly<Record<string, string>> }) {
        if (fail) throw new Error('Policy denied this operation.')
        mutations.push(mutation)
      },
      resolveServices: async () => ({}),
      resolveTenant: async () => 'tenant-a',
    })
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: exampleRuntime })
    const deniedMutation = vi.fn(async () => undefined)
    const deniedRuntime = await createNextPanelsAcceptanceRuntime({
      auth: { guard: () => ({ provider: async () => 'session', user: async () => ({ id: '8', role: 'viewer' }) }) },
      mutatePost: deniedMutation,
      resolveServices: async () => ({}),
      resolveTenant: async () => 'tenant-a',
    })
    const deniedRoute = createPanelOperationRoute({ panelIds: ['admin'], runtime: deniedRuntime })
    const deniedResponse = await deniedRoute.POST(operationRequest('admin', 'action', { intent: 'delete', recordId: 1, resourceId: 'posts' }), { params: Promise.resolve({ operation: 'action', panelId: 'admin' }) })
    expect(deniedResponse.status).toBe(403)
    expect(deniedMutation).not.toHaveBeenCalled()
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    const schemaRequests: JsonObject[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const match = /\/holo\/panels\/([^/]+)\/([^/]+)$/u.exec(url)
      if (!match?.[1] || !match[2]) return new Response(null, { status: 404 })
      const headers = new Headers(init?.headers)
      headers.set('x-csrf-token', 'valid')
      const request = new Request(new URL(url, 'https://example.test'), { ...init, headers })
      if (match[2] === 'options') {
        const parameters = new URLSearchParams(await request.clone().text())
        const envelope = JSON.parse(parameters.get(TRANSPORT_REQUEST_FIELD) ?? '{}') as { readonly payload?: JsonObject }
        if (envelope.payload?.action === 'schema') schemaRequests.push(envelope.payload)
      }
      return route.POST(request, { params: Promise.resolve({ operation: match[2], panelId: match[1] }) })
    }))
    const properties = (index: number): JsonObject => {
      const body = nextPanelAcceptanceFixture.pages[index]?.manifest.body
      if (body?.component !== 'resource-page') throw new Error(`Page ${index} is missing its resource manifest.`)
      return body.properties
    }
    const root = createRoot(container as unknown as Element)
    const toastStore = new ClientToastStore()
    const renderResource = async (page: ReactNode): Promise<void> => act(async () => root.render(<ReactFeedbackProvider panelId="admin" store={toastStore}>{page}</ReactFeedbackProvider>))
    const effects = new ClientEffectSession({ panelId: 'admin', toastStore })
    const input = (selector: string): HTMLInputElement => container.querySelector(selector) as unknown as HTMLInputElement
    const select = (selector: string): HTMLSelectElement => container.querySelector(selector) as unknown as HTMLSelectElement
    const click = async (label: string): Promise<void> => act(async () => {
      const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent === label)
      if (!button) throw new Error(`Missing ${label} button`)
      ;(button as unknown as HTMLButtonElement).click()
      await Promise.resolve()
    })
    const change = async (element: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> => act(async () => {
      const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    const choose = async (value: string): Promise<void> => act(async () => {
      const label = [...container.querySelectorAll('label')].find(candidate => candidate.textContent?.trim() === value)
      const radio = label?.querySelector('input[type="radio"]')
      if (!radio) throw new Error(`Missing ${value} option`)
      ;(radio as unknown as HTMLInputElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    const listProperties = structuredClone(properties(0))
    const listResource = listProperties.resource
    if (!listResource || typeof listResource !== 'object' || Array.isArray(listResource)) throw new Error('List page is missing its resource definition.')
    const listTable = listResource.table
    if (!listTable || typeof listTable !== 'object' || Array.isArray(listTable) || !Array.isArray(listTable.columns)) throw new Error('List page is missing its table definition.')
    listTable.columns = listTable.columns.map((column, index) => column && typeof column === 'object' && !Array.isArray(column) && index === 0 ? { ...column, formatters: [{ kind: 'prefix', value: 'Post: ' }], lineClamp: 2, searchable: true } : column)
    const firstPost = { category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' }
    const cityGuide = { category: 'Guides', city: 'Giza', id: 2, slug: 'city-guide', title: 'City guide' }
    const listRecords = [firstPost, cityGuide]
    await renderResource(<NextPanelResourcePage data={{
      groups: [
        { key: 'News', records: [firstPost], title: 'News' },
        { key: 'Guides', records: [cityGuide], title: 'Guides' },
      ],
      records: listRecords,
    }} panelId="admin" panelPath="/admin" properties={listProperties} />)
    expect(container.textContent).toContain('Post: First post')
    const tableSearch = input('input[type="search"]')
    expect(tableSearch.closest('[data-slot="input-group"]')).not.toBeNull()
    const selectPage = container.querySelector<HTMLButtonElement>('[role="checkbox"][aria-label="Select page"]')
    expect(selectPage).not.toBeNull()
    await act(async () => selectPage?.click())
    expect(container.textContent).toContain('2 records selected')
    expect([...container.querySelectorAll<HTMLButtonElement>('button')].some(button => button.textContent === 'Bulk actions')).toBe(true)
    await change(tableSearch, 'guide')
    await vi.waitFor(() => {
      expect(container.textContent).toContain('City guide')
      expect(container.textContent).not.toContain('First post')
    })
    vi.stubGlobal('confirm', vi.fn(() => true))
    await act(async () => {
      const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
      expect(trigger).not.toBeNull()
      trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      trigger?.click()
    })
    await act(async () => {
      const action = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === 'Delete')
      expect(action).toBeDefined()
      action?.click()
    })
    await click('Confirm')
    await vi.waitFor(() => expect(container.textContent).not.toContain('City guide'))
    const createProperties = structuredClone(properties(1))
    const createResource = createProperties.resource
    if (!createResource || typeof createResource !== 'object' || Array.isArray(createResource)) throw new Error('Create page is missing its resource definition.')
    const createForm = createResource.form
    if (!createForm || typeof createForm !== 'object' || Array.isArray(createForm) || !Array.isArray(createForm.fields)) throw new Error('Create page is missing its form definition.')
    createForm.fields = createForm.fields.map(field => field && typeof field === 'object' && !Array.isArray(field) ? { ...field, ...(field.path === 'category' ? { debounceMilliseconds: 20 } : {}), label: null } : field)
    await renderResource(<NextPanelResourcePage data={{}} effects={effects} panelId="admin" panelPath="/admin" properties={createProperties} unsavedChangesAlerts />)
    const renderedLabels = [...container.querySelectorAll('label')].map(label => label.textContent ?? '')
    expect(renderedLabels.some(label => label.startsWith('Title'))).toBe(true)
    expect(renderedLabels.some(label => label.startsWith('Slug'))).toBe(true)
    await click('Create')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('required')
    await change(input('[data-field-path="title"] input'), 'My New Post')
    expect(input('[data-field-path="slug"] input').value).toBe('my-new-post')
    const beforeUnload = new Event('beforeunload', { cancelable: true })
    globalThis.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(true)
    const schemaRequestCount = schemaRequests.length
    await choose('Guides')
    expect(schemaRequests).toHaveLength(schemaRequestCount)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25))
    })
    expect(schemaRequests).toHaveLength(schemaRequestCount + 1)
    expect([...select('[data-field-path="city"] select').options].map(option => option.value)).toContain('Giza')
    await change(select('[data-field-path="city"] select'), 'Giza')
    await click('Create')
    await vi.waitFor(() => expect(toastStore.state.items.at(-1)).toMatchObject({ title: 'Post saved.', status: 'success' }))
    expect(container.querySelector('.hp-resource-form [role="status"]')).toBeNull()
    const savedBeforeUnload = new Event('beforeunload', { cancelable: true })
    globalThis.dispatchEvent(savedBeforeUnload)
    expect(savedBeforeUnload.defaultPrevented).toBe(false)
    await renderResource(<NextPanelResourcePage data={{ record: { category: 'News', city: 'Alexandria', id: 1, slug: 'first-post', title: 'First post' } }} panelId="admin" panelPath="/admin" properties={properties(3)} />)
    expect(input('[data-field-path="title"] input').value).toBe('First post')
    await change(input('[data-field-path="title"] input'), 'Edited post')
    expect(input('[data-field-path="slug"] input').value).toBe('edited-post')
    await click('Save')
    fail = true
    await renderResource(<NextPanelResourcePage data={{ record: { category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' } }} panelId="admin" panelPath="/admin" properties={properties(3)} />)
    await click('Delete')
    await click('Confirm')
    await vi.waitFor(() => expect(toastStore.state.items.at(-1)?.body).toBe('The operation could not be completed.'))
    expect(mutations.map(mutation => mutation.intent)).toEqual(['delete', 'create', 'edit'])
    await act(async () => root.unmount())
    effects.dispose()
  })

  it('redirects successful resource creates using the configured Filament destination', async () => {
    const body = nextPanelAcceptanceFixture.pages[1]?.manifest.body
    if (body?.component !== 'resource-page') throw new Error('Create page is missing its resource manifest.')
    const properties = structuredClone(body.properties)
    const resource = properties.resource
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) throw new Error('Create page is missing its resource definition.')
    const form = resource.form
    if (!form || typeof form !== 'object' || Array.isArray(form) || !Array.isArray(form.fields)) throw new Error('Create page is missing its fields.')
    form.fields = form.fields.map(field => field && typeof field === 'object' && !Array.isArray(field) ? { ...field, required: false } : field)
    const operation = { execute: vi.fn(async () => ({ data: { record: { id: 'new-post' } }, ok: true as const })) }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<NextPanelResourcePage createRedirect="view" data={{}} operation={operation} panelId="admin" panelPath="/admin" properties={properties} />))
    await act(async () => {
      container.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(operation.execute).toHaveBeenCalled())
    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith('/admin/posts/new-post'))
    await act(async () => root.unmount())
  })

  it('makes relation managers interactive on view pages only when the panel enables it', async () => {
    const body = nextPanelAcceptanceFixture.pages[2]?.manifest.body
    if (body?.component !== 'resource-page') throw new Error('View page is missing its resource manifest.')
    const data: JsonObject = {
      record: { id: 'post-1', title: 'First post' },
      relations: [{ badge: null, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'author', label: 'Author', operations: ['select', 'associate'], presentation: 'inline', records: [{ id: 'author-1', values: { name: 'Ada' } }], url: null, visible: true }],
    }
    const operation = { execute: vi.fn(async () => ({ data: {}, ok: true as const })) }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<NextPanelResourcePage data={data} operation={operation} panelId="admin" panelPath="/admin" properties={body.properties} readOnlyRelations={false} />))
    expect(container.querySelector('[data-operation="associate"]')).not.toBeNull()
    await act(async () => root.render(<NextPanelResourcePage data={data} operation={operation} panelId="admin" panelPath="/admin" properties={body.properties} readOnlyRelations />))
    expect(container.querySelector('[data-operation="associate"]')).toBeNull()
    await act(async () => root.unmount())
  })
})
