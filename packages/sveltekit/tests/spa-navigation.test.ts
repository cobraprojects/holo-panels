import { mount, tick, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { ClientToastStore, type JsonObject } from '@holo-js/panels-svelte'
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

function createResourcePageData(): PanelPageData {
  const current = pageData()
  return {
    ...current,
    page: {
      ...current.page,
      data: {
        resource: {
          actions: [],
          basePath: '/admin/articles',
          columns: [],
          createLabel: 'Create article',
          dependencies: [],
          entries: [],
          fields: [{ label: 'Title', path: 'title', properties: {}, required: false, type: 'text' }],
          filterMode: 'live',
          filters: [],
          id: 'articles',
          label: 'Articles',
          options: {},
          recordActions: [],
          recordId: 'id',
          routeKey: 'id',
          routes: { create: '/admin/articles/create', edit: '/admin/articles/:record/edit', view: '/admin/articles/:record' },
          formActions: [{ badge: null, color: null, confirmation: null, disabled: false, icon: 'plus', id: 'create', kind: 'create', label: 'Save article', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'create', visible: true }],
          saveLabel: 'Save article',
          tableActions: [],
        },
      },
      manifest: {
        ...current.page.manifest,
        body: { component: 'resource-page', properties: {} },
        id: 'articles.create',
        pageType: 'create',
        path: '/admin/articles/create',
      },
    },
  }
}

describe('SvelteKit panel SPA navigation', () => {
  it('mounts the replacement client before aborting obsolete work and ignores its late effects', async () => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const pending: Array<{
      readonly id: string
      readonly signal: AbortSignal | null
      resolve(response: Response): void
    }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const fields = new URLSearchParams(String(init?.body ?? ''))
      const envelope = JSON.parse(fields.get('request') ?? '{}') as { readonly id: string, readonly operation?: string }
      if (envelope.operation === 'options') {
        return Response.json({ data: { fields: [{ label: 'Title', path: 'title', properties: {}, required: false, type: 'text' }], operations: [], schema: { components: [{ children: [], dynamicVisibility: false, extraAttributes: {}, id: 'articles-title', key: 'title', kind: 'field', layout: {}, properties: {}, slots: {}, statePath: 'title', type: 'field', visible: true }], id: 'articles-create-form', kind: 'schema' } }, effects: [], id: envelope.id, ok: true, protocolVersion: '1.0' })
      }
      return await new Promise<Response>(resolve => pending.push({ id: envelope.id, resolve, signal: init?.signal ?? null }))
    }))
    const firstContainer = document.createElement('div')
    const replacementContainer = document.createElement('div')
    document.body.append(firstContainer, replacementContainer)
    const push = vi.spyOn(ClientToastStore.prototype, 'push')
    const first = mount(PanelPage, { props: { data: createResourcePageData() }, target: firstContainer })
    await tick()
    firstContainer.querySelector<HTMLFormElement>('form')?.requestSubmit()
    await vi.waitFor(() => expect(pending).toHaveLength(1))

    const replacement = mount(PanelPage, { props: { data: createResourcePageData() }, target: replacementContainer })
    await tick()
    await unmount(first)
    expect(pending[0]?.signal?.aborted).toBe(true)
    replacementContainer.querySelector<HTMLFormElement>('form')?.requestSubmit()
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[1]?.signal?.aborted).toBe(false)

    pending[0]?.resolve(Response.json({ data: { saved: true }, effects: [{ kind: 'toast', level: 'danger', message: 'Obsolete response' }], id: pending[0].id, ok: true, protocolVersion: '1.0' }))
    pending[1]?.resolve(Response.json({ data: { saved: true }, effects: [{ kind: 'toast', level: 'success', message: 'Current response' }], id: pending[1].id, ok: true, protocolVersion: '1.0' }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(push.mock.calls[0]?.[0]).toMatchObject({ title: 'Current response' })

    await unmount(replacement)
    vi.unstubAllGlobals()
  })

  it('hydrates the form schema once and refreshes dependent options after the field debounce', async () => {
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const configured = createResourcePageData()
    const resource = configured.page.data.resource
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) throw new Error('Resource metadata is unavailable')
    const fields: JsonObject[] = [
      { debounceMilliseconds: 20, label: 'Category', path: 'category', properties: { options: [{ label: 'Engineering', value: 'engineering' }, { label: 'News', value: 'news' }] }, required: false, type: 'select' },
      { label: 'City', path: 'city', properties: { options: [] }, required: false, type: 'select' },
    ]
    resource.fields = fields
    resource.options = {
      category: { values: ['engineering', 'news'] },
      city: { dependsOn: 'category', valuesByDependency: { engineering: ['Cairo'], news: ['Lisbon'] } },
    }
    const schema: JsonObject = {
      components: ['category', 'city'].map(path => ({ children: [], dynamicVisibility: false, extraAttributes: {}, id: `articles-${path}`, key: path, kind: 'field', layout: {}, properties: {}, slots: {}, statePath: path, type: 'field', visible: true })),
      id: 'articles-create-form',
      kind: 'schema',
    }
    resource.schema = schema
    const requests: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const parameters = new URLSearchParams(String(init?.body ?? ''))
      const envelope = JSON.parse(parameters.get('request') ?? '{}') as { readonly id?: string, readonly payload?: Record<string, unknown> }
      if (envelope.payload) requests.push(envelope.payload)
      const values = envelope.payload?.values
      const category = values && typeof values === 'object' && !Array.isArray(values) ? Reflect.get(values, 'category') : undefined
      const responseFields: JsonObject[] = [fields[0]!, { ...fields[1]!, properties: { options: category === 'news' ? [{ label: 'Lisbon', value: 'Lisbon' }] : [] } }]
      return Response.json({ data: { fields: responseFields, operations: [], schema }, effects: [], id: envelope.id, ok: true, protocolVersion: '1.0' })
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const component = mount(PanelPage, { props: { data: configured }, target: container })

    await vi.waitFor(() => expect(requests).toContainEqual(expect.objectContaining({ action: 'schema', lifecycle: 'hydrate' })))
    const category = container.querySelector<HTMLSelectElement>('[data-field-path="category"] select')
    if (!category) throw new Error('Category field did not render')
    await vi.waitFor(() => expect(Array.from(category.options).map(option => option.value)).toContain('news'))
    category.value = 'news'
    category.dispatchEvent(new Event('change', { bubbles: true }))
    await tick()
    expect(Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="city"] option')).map(option => option.value)).not.toContain('Lisbon')
    await vi.waitFor(() => expect(Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="city"] option')).map(option => option.value)).toContain('Lisbon'))

    await unmount(component)
    container.remove()
    vi.unstubAllGlobals()
  })

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
        formActions: [{ badge: null, color: null, confirmation: null, disabled: false, icon: 'plus', id: 'create', kind: 'create', label: 'Save post', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'create', visible: true }],
        saveLabel: 'Save post',
          },
        },
        manifest: { ...current.page.manifest, pageType: 'create', path: '/admin/posts/create' },
      },
    }
    const goto = vi.fn(async () => undefined)
    configureSvelteKitNavigation(goto)
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

    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/admin/posts/new-post'))
    await unmount(component)
    vi.unstubAllGlobals()
  })
})
