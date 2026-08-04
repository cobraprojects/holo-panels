import { ActionExecutionError, createRequestEnvelope, PROTOCOL_VERSION, type JsonObject } from '@holo-js/panels-core'
import { createApp as createH3App, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { createApp, createSSRApp, defineComponent, h, nextTick, shallowRef, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureNuxtImports } from './nuxt-imports'

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

const { PanelPage, usePanelPage } = await import('../src')
const { createPanelOperationHandler } = await import('../src/server')
import type { NuxtPanelOperationContext, NuxtPanelOperationResult, NuxtPanelPage, NuxtPanelRuntime } from '../src'

const page: NuxtPanelPage = {
  bootstrap: {
    actor: { id: 7 },
    manifest: {
      branding: { favicon: null, logo: null, name: 'Admin' },
      databaseNotifications: null,
      default: true,
      id: 'admin',
      navigation: [{ badge: '4', group: null, icon: 'posts', id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 1 }],
      navigationMode: 'sidebar',
      path: '/admin',
      sidebarCollapsible: true,
      theme: { darkMode: 'system' },
      userMenu: [],
    },
    notifications: null,
    provider: 'users',
  },
  page: {
    breadcrumbs: [{ label: 'Posts', path: '/admin/posts' }],
    data: { records: [] },
    heading: 'Posts',
    manifest: { body: null, id: 'posts.list', pageType: 'list', path: '/admin/posts', schemaId: null },
    schema: null,
    subheading: 'Manage published content',
    title: 'Posts',
  },
  path: '/admin/posts',
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
    { defaultValue: 'docs', disabled: false, helperText: null, hint: null, label: 'Department', optionSource: { options: [{ label: 'Docs', value: 'docs' }, { label: 'Support', value: 'support' }] }, path: 'department', placeholder: null, properties: { paginated: false, preload: true, searchable: false }, readOnly: false, required: true, type: 'select', visible: true },
    { disabled: false, helperText: null, hint: null, label: 'Office', optionSource: { dependency: 'department', options: [], optionsByDependency: { docs: [{ label: 'Berlin', value: 'Berlin' }], support: [{ label: 'Lisbon', value: 'Lisbon' }] } }, path: 'office', placeholder: null, properties: { paginated: false, preload: true, searchable: false }, readOnly: false, required: true, type: 'select', visible: true },
  ],
  filters: [{ manifest: { defaultValue: null, id: 'department', label: 'Department', properties: {}, type: 'select' }, options: [{ label: 'All', value: null }, { label: 'Docs', value: 'docs' }] }],
  kind: 'resource',
  recordTitle: 'headline',
  resourceId: 'articles',
  routeKey: 'permalink',
}

function formRequest(panelId: string, operation: string, payload: JsonObject = {}, id = 'request-1234567890'): Request {
  const envelope = createRequestEnvelope({ id, operation, panelId, payload })
  const body = new URLSearchParams({ request: JSON.stringify(envelope), _token: 'valid' })
  return new Request(`http://localhost/_holo/panels/${panelId}/${operation}`, {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-TOKEN': 'valid' },
    method: 'POST',
  })
}

function webHandler(handler: ReturnType<typeof createPanelOperationHandler>): (request: Request) => Promise<Response> {
  const app = createH3App()
  const router = createRouter()
  router.get('/_holo/panels/:panelId/:operation', handler)
  router.post('/_holo/panels/:panelId/:operation', handler)
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
  security.calls.length = 0
  security.reject = false
})

describe('P9-D Nuxt adapter', () => {
  it('deduplicates SSR page loading through Nuxt state and supports multiple fixed panels', async () => {
    const requests: string[] = []
    configureNuxtImports({
      path: '/admin/posts?status=draft',
      fetch: async (path, options) => {
        requests.push(`${path}:${JSON.stringify(options)}`)
        return page
      },
    })
    const admin = await usePanelPage({ panelId: 'admin' })
    const staff = await usePanelPage({ panelId: 'staff', path: '/staff', load: async request => ({ ...page, path: request.path }) })
    expect(admin.page.title).toBe('Posts')
    expect(staff.path).toBe('/staff')
    expect(requests[0]).toContain('/_holo/panels/admin/page-data')
    expect(requests[0]).toContain('/admin/posts')
    await expect(usePanelPage({ panelId: '../admin', path: '/admin', load: async () => page })).rejects.toThrow('stable panel IDs')
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
    expect(html).not.toContain('function')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const hydrated = createSSRApp(PanelPage, properties)
    hydrated.mount(container)
    await nextTick()
    expect(container.querySelector('[data-panels-panel="admin"]')?.getAttribute('data-panels-ready')).toBe('true')
    expect(container.querySelector('[data-panels-panel="admin"]')?.hasAttribute('inert')).toBe(false)
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Posts')
    await vi.waitFor(() => expect(container.querySelector('[data-resource="posts"]')?.textContent).toBe('Loaded posts'))
    hydrated.unmount()
    container.remove()
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
    expect(body).toMatchObject({ id: 'request-1234567890', ok: true, protocolVersion: PROTOCOL_VERSION, data: { deleted: 42 } })
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
    const wrongOperation = await fetch(new Request('http://localhost/_holo/panels/admin/action', {
      body: new URLSearchParams({ request: JSON.stringify(wrongOperationEnvelope), _token: 'valid' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }))
    expect(wrongOperation.status).toBe(400)
    expect(await wrongOperation.json()).toMatchObject({ ok: false, error: { category: 'protocol', code: 'invalid_request' } })

    const malformed = await fetch(new Request('http://localhost/_holo/panels/admin/action', {
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
    expect(await actionResponse.json()).toMatchObject({ ok: false, effects: [effect] })

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
    const response = await fetch(new Request('http://localhost/_holo/panels/admin/page-data?path=%2Fadmin%2Fposts'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ path: '/admin/posts', page: { title: 'Posts' } })
    const missing = await fetch(new Request('http://localhost/_holo/panels/admin/page-data?path=%2Fadmin%2Fmissing'))
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
      const response = await fetch(new Request('http://localhost/_holo/panels/admin/action', { body: oversized, headers, method: 'POST' }))
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({ ok: false, error: { code: 'payload_too_large' } })
    }
    expect(security.calls).toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })

  it('uses shared table, form, option, and action engines for CRUD rendering', async () => {
    const resourcePage = {
      ...page,
      bootstrap: {
        ...page.bootstrap,
        manifest: { ...page.bootstrap.manifest, id: 'backoffice', navigation: [{ ...page.bootstrap.manifest.navigation[0]!, path: '/control/articles' }], path: '/control' },
      },
      page: {
        ...page.page,
        data: { department: 'docs', record: { department: 'docs', headline: 'Guide', id: 1, office: 'Berlin', permalink: 'guide' }, records: [{ department: 'docs', headline: 'Guide', id: 1, office: 'Berlin', permalink: 'guide' }] },
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
    await vi.waitFor(() => {
      const officeOptions = Array.from(container.querySelectorAll<HTMLOptionElement>('[data-field-path="office"] option')).map(option => option.textContent)
      expect(officeOptions).toContain('Lisbon')
      expect(officeOptions).not.toContain('Berlin')
    })
    app.unmount()

    const listApp = createApp(PanelPage, { page: { ...resourcePage, page: { ...resourcePage.page, manifest: { ...resourcePage.page.manifest, pageType: 'list' as const } } } })
    const actionRequests: Request[] = []
    document.cookie = 'XSRF-TOKEN=signed; path=/'
    const confirmAction = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmAction)
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
    expect(container.querySelector('a[href="/control/articles/guide"]')?.textContent).toBe('Guide')
    expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent === 'Edit')).toBe(true)
    expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent === 'Remove')).toBe(true)
    expect(container.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/control/articles')
    const remove = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Remove')
    expect(remove).toBeDefined()
    remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(confirmAction).toHaveBeenCalledWith('Delete this article?')
    await vi.waitFor(() => expect(actionRequests.length + (container.querySelector('[role="alert"]') ? 1 : 0)).toBeGreaterThan(0))
    expect(container.querySelector('[role="alert"]')?.textContent).toBeUndefined()
    expect(actionRequests).toHaveLength(1)
    expect(actionRequests[0]?.url).toBe('http://localhost/_holo/panels/backoffice/action')
    const actionParameters = new URLSearchParams(await actionRequests[0]?.clone().text())
    expect(JSON.parse(actionParameters.get('request') ?? '{}')).toMatchObject({
      operation: 'action',
      panelId: 'backoffice',
      payload: { actionId: 'remove-article', recordIds: ['guide'], resourceId: 'articles' },
    })
    listApp.unmount()
    fetchAction.mockRestore()
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'

    const viewApp = createApp(PanelPage, { page: { ...resourcePage, page: { ...resourcePage.page, manifest: { ...resourcePage.page.manifest, pageType: 'view' as const } } } })
    viewApp.mount(container)
    await nextTick()
    expect(container.querySelector('[data-action-mount="record"]')).not.toBeNull()
    expect(container.querySelector('a[href="/control/articles/guide/edit"]')?.textContent).toBe('Edit')
    expect(container.querySelector('[data-panels-panel="backoffice"]')).not.toBeNull()
    viewApp.unmount()
    container.remove()
  })

  it('loads the example compiled Post schema and applies its real panel policy', async () => {
    const { nuxtPanelAcceptanceFixture } = await import('../../../apps/example-nuxt/tests/p9-panel-acceptance-nuxt')
    const schema = await nuxtPanelAcceptanceFixture.loadResourceSchema()
    const fields = Reflect.get(schema, 'fields') as readonly Record<string, unknown>[]
    const columns = Reflect.get(schema, 'columns') as readonly Record<string, unknown>[]
    const actions = Reflect.get(schema, 'actions') as readonly Record<string, unknown>[]
    expect(Reflect.get(schema, 'basePath')).toBe('/admin/posts')
    expect(fields.map(field => field.path)).toEqual([
      'title',
      'slug',
      'excerpt',
      'body',
      'status',
      'categoryId',
      'authorId',
      'featuredMediaId',
      'category',
      'city',
    ])
    expect(columns.map(column => Reflect.get(Reflect.get(column, 'manifest') as object, 'path'))).toEqual([
      'title',
      'slug',
      'status',
      'categoryId',
      'authorId',
      'category',
      'city',
    ])
    expect(actions.map(action => action.kind)).toEqual(['view', 'edit', 'delete'])
    expect(fields.find(field => field.path === 'slug')).toMatchObject({ reactive: { source: 'title', transform: 'slug' } })
    expect(fields.find(field => field.path === 'city')).toMatchObject({ optionSource: { dependency: 'category' } })
    const runtime = await nuxtPanelAcceptanceFixture.loadRuntime()
    await expect(Promise.resolve(runtime.panels.admin?.access({ actor: { id: 1, role: 'editor', tenantId: null }, operation: 'page-data', panelId: 'admin', signal: new AbortController().signal }))).resolves.toBe(true)
    await expect(Promise.resolve(runtime.panels.admin?.access({ actor: { id: 2, role: 'viewer', tenantId: null }, operation: 'page-data', panelId: 'admin', signal: new AbortController().signal }))).resolves.toBe(false)
    expect(nuxtPanelAcceptanceFixture.pages.map(definition => definition.manifest.path)).toContain('/admin/posts/:record/edit')
  })
})
