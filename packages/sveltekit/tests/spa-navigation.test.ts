import { mount, tick, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import PanelPage from '../src/PanelPage.svelte'
import type { PanelPageData } from '../src/contracts'
import { configureSvelteKitNavigation } from './sveltekit-navigation'

function pageData(): PanelPageData {
  return {
    effects: [],
    panel: {
      actor: { id: 7, name: 'Ada' },
      manifest: {
        auth: null,
        branding: { favicon: null, logo: null, name: 'Admin' },
        databaseNotifications: null,
        default: true,
        globalSearch: false,
        id: 'admin',
        navigation: [
          { badge: null, group: null, icon: null, id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 1 },
          { badge: null, group: null, icon: null, id: 'external', label: 'External', parent: null, path: '/admin/external-report', sort: 2 },
        ],
        navigationMode: 'sidebar',
        path: '/admin',
        runtime: { databaseTransactions: false, readOnlyRelationManagersOnResourceViewPagesByDefault: false, resourceCreatePageRedirect: 'edit', resourceEditPageRedirect: null, spa: true, spaPrefetching: true, spaUrlExceptions: ['/admin/external*'], strictAuthorization: false, unsavedChangesAlerts: false },
        sidebarCollapsible: true,
        slots: {},
        tenancy: null,
        theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'full' },
        userMenu: [],
      },
      notifications: null,
      provider: 'session',
      tenancy: null,
    },
    page: {
      breadcrumbs: [],
      data: {},
      heading: 'Posts',
      manifest: {
        actions: { footer: [], header: [] },
        body: null,
        id: 'posts.list',
        navigation: null,
        pageType: 'list',
        path: '/admin/posts',
        renderer: null,
        schemaId: null,
        widgets: { footer: [], header: [] },
      },
      schema: null,
      subheading: null,
      title: 'Posts',
    },
    widgets: { footer: [], header: [] },
  }
}

describe('SvelteKit panel SPA navigation', () => {
  it('navigates same-origin links, honors exceptions, and prefetches on hover', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const goto = vi.fn(async () => undefined)
    configureSvelteKitNavigation(goto)
    const component = mount(PanelPage, { props: { data: pageData() }, target: container })
    await tick()
    const postsLink = container.querySelector<HTMLAnchorElement>('a[href="/admin/posts"]')
    const externalLink = container.querySelector<HTMLAnchorElement>('a[href="/admin/external-report"]')
    if (!postsLink || !externalLink) throw new Error('SPA navigation links did not render')

    postsLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(document.head.querySelector('link[data-holo-panel-prefetch][href="/admin/posts"]')).not.toBeNull()
    const internalClick = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    postsLink.dispatchEvent(internalClick)
    expect(internalClick.defaultPrevented).toBe(true)
    expect(goto).toHaveBeenCalledWith('/admin/posts')
    const excludedClick = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    externalLink.dispatchEvent(excludedClick)
    expect(excludedClick.defaultPrevented).toBe(false)
    await unmount(component)
  })

  it('targets a panel-scoped portal with configured appearance', async () => {
    const current = pageData()
    const configured: PanelPageData = {
      ...current,
      panel: {
        ...current.panel,
        manifest: {
          ...current.panel.manifest,
          theme: { ...current.panel.manifest.theme, colors: { primary: '#123456' }, density: 'compact' },
        },
      },
    }
    const container = document.createElement('div')
    container.dir = 'rtl'
    document.body.append(container)
    const component = mount(PanelPage, { props: { data: configured }, target: container })
    await tick()

    const portal = container.querySelector<HTMLElement>('[data-holo-panel][data-panel-id="admin"]')
    expect(portal?.dataset.theme).toBe('system')
    expect(portal?.dataset.density).toBe('compact')
    expect(portal?.closest('[dir="rtl"]')).toBe(container)
    expect(portal?.style.getPropertyValue('--holo-color-primary')).toBe('#123456')

    const account = container.querySelector<HTMLButtonElement>('[data-slot="dropdown-menu-trigger"]')
    account?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
    await vi.waitFor(() => expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull())
    expect(portal?.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull()

    await unmount(component)
    expect(document.body.contains(portal)).toBe(false)
    container.remove()
  })

  it('tracks the shared mobile breakpoint and cleans up its media listener', async () => {
    const mediaQueryState = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: '(max-width: 767px)',
      onchange: null,
      removeEventListener: vi.fn(),
    }
    const mediaQuery = mediaQueryState as unknown as MediaQueryList
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)
    const container = document.createElement('div')
    document.body.append(container)
    const component = mount(PanelPage, { props: { data: pageData() }, target: container })
    await tick()

    const toggle = container.querySelector<HTMLButtonElement>('.hp-panel-navigation-toggle')
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
    expect(mediaQueryState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    toggle?.click()
    await tick()
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-panels-component="slide-over"][data-mobile="true"]')).not.toBeNull()
    expect(container.querySelector('[data-panels-component="slide-over"][data-mobile="true"]')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await tick()
    await Promise.resolve()
    await vi.waitFor(() => expect(toggle?.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)

    toggle?.click()
    await tick()
    const backdrop = container.querySelector<HTMLElement>('[data-slot="sheet-overlay"][data-state="open"]')
    expect(backdrop).not.toBeNull()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    backdrop?.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerType: 'mouse',
    }))
    await vi.waitFor(() => expect(toggle?.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(toggle)

    await unmount(component)
    expect(mediaQueryState.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function), {})
    container.remove()
    matchMedia.mockRestore()
  })

  it('redirects successful resource creates using the configured Filament destination', async () => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const current = pageData()
    const configured: PanelPageData = {
      ...current,
      panel: {
        ...current.panel,
        manifest: {
          ...current.panel.manifest,
          runtime: {
            databaseTransactions: false,
            readOnlyRelationManagersOnResourceViewPagesByDefault: true,
            resourceCreatePageRedirect: 'view',
            resourceEditPageRedirect: null,
            spa: false,
            spaUrlExceptions: [],
            strictAuthorization: false,
            unsavedChangesAlerts: false,
          },
        },
      },
      page: {
        ...current.page,
        data: {
          resource: {
        actions: [],
        basePath: '/admin/posts',
        columns: [],
        createLabel: 'Create post',
        dependencies: [],
        entries: [],
        fields: [{ label: 'Title', path: 'title', required: false, type: 'text' }],
        filters: [],
        id: 'posts',
        label: 'Posts',
        options: {},
        recordId: 'id',
        routeKey: 'slug',
        routes: { create: '/admin/posts/create', edit: '/admin/posts/:record/edit', view: '/admin/posts/:record' },
        saveLabel: 'Save post',
          },
        },
        manifest: { ...current.page.manifest, pageType: 'create', path: '/admin/posts/create' },
      },
    }
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const fields = new URLSearchParams(String(init?.body ?? ''))
      const request = JSON.parse(fields.get('request') ?? '{}') as { readonly id?: string }
      return new Response(JSON.stringify({ data: { record: { slug: 'new-post' } }, effects: [], id: request.id ?? 'request', ok: true, protocolVersion: '1.0' }), { headers: { 'Content-Type': 'application/json' } })
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const component = mount(PanelPage, { props: { data: configured }, target: container })
    await tick()

    container.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/posts/new-post'))
    await unmount(component)
    vi.unstubAllGlobals()
  })
})
