import { ClientActionStore, ClientToastStore, FormStore, TableStateStore, toJsonValue, type ClientActionManifest, type JsonObject } from '@holo-js/panels-svelte'
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { PanelPage, type PanelPageData } from '../src'
import { resourceOperationIdentifier, resourceOperationIdentifiers } from '../src/resource-page'

const posts = [
  { category: 'engineering', city: 'Cairo', id: 'first-post', slug: 'first-post', title: 'First post' },
  { category: 'news', city: 'New York', id: 'daily-news', slug: 'daily-news', title: 'Daily news' },
]

function actionManifest(overrides: Partial<ClientActionManifest> & Pick<ClientActionManifest, 'id' | 'label'>): ClientActionManifest {
  return {
    badge: null,
    color: null,
    confirmation: null,
    disabled: false,
    icon: null,
    kind: 'custom',
    modal: null,
    mount: 'record',
    size: 'medium',
    tooltip: null,
    type: 'core:action:custom',
    visible: true,
    ...overrides,
  }
}

function actionPayload(overrides: Partial<ClientActionManifest> & Pick<ClientActionManifest, 'id' | 'label'>): JsonObject {
  const value = toJsonValue(actionManifest(overrides))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action manifest must serialize to an object')
  return value
}

const postResource = {
  actions: [actionPayload({ confirmation: 'Delete this post?', id: 'posts.delete', kind: 'delete', label: 'Delete', type: 'core:action:delete' })],
  basePath: '/admin/posts',
  columns: ['title', 'slug', 'category', 'city'].map(path => ({
    manifest: { alignment: 'start', copyable: path === 'slug', hidden: false, inlineEditor: null, label: `${path[0]?.toUpperCase() ?? ''}${path.slice(1)}`, path, sortable: true, toggleable: true, type: 'text', width: null, wrap: true },
  })),
  createLabel: 'Create post',
  dependencies: [
    { id: 'posts.slug', kind: 'slug', source: 'title', target: 'slug' },
    { id: 'posts.city', kind: 'clear', source: 'category', target: 'city' },
  ],
  fields: [
    { label: 'Title', path: 'title', required: true, type: 'text' },
    { label: 'Slug', path: 'slug', required: true, type: 'text' },
    { label: 'Category', path: 'category', required: true, type: 'select' },
    { label: 'City', path: 'city', required: true, type: 'select' },
  ],
  id: 'posts',
  label: 'Posts',
  options: {
    category: { values: ['engineering', 'news'] },
    city: { dependsOn: 'category', valuesByDependency: { engineering: ['Cairo', 'London'], news: ['Cairo', 'New York'] } },
  },
  recordId: 'id',
  routeKey: 'slug',
  routes: { create: '/admin/posts/create', edit: '/admin/posts/:record/edit', view: '/admin/posts/:record' },
  saveLabel: 'Save post',
}

function pageData(pageType: 'create' | 'edit' | 'list' | 'view'): PanelPageData {
  const record = posts[0]
  const path = pageType === 'list'
    ? '/admin/posts'
    : pageType === 'create'
      ? '/admin/posts/create'
      : pageType === 'edit'
        ? '/admin/posts/first-post/edit'
        : '/admin/posts/first-post'
  return {
    effects: [],
    panel: {
      actor: { id: 7, name: 'Ada' },
      manifest: {
        auth: null,
        branding: { favicon: null, logo: null, name: 'Admin' },
        databaseNotifications: null,
        default: true,
        id: 'admin',
        navigation: [{ badge: null, group: null, icon: null, id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 10 }],
        navigationMode: 'sidebar',
        path: '/admin',
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
      breadcrumbs: [{ label: 'Posts', path: '/admin/posts' }],
      data: {
        ...(pageType === 'list' ? { filters: { search: '' }, records: posts } : {}),
        ...(pageType === 'edit' || pageType === 'view' ? { record } : {}),
        resource: postResource,
      },
      heading: pageType === 'list' ? 'Posts' : `${pageType[0]?.toUpperCase() ?? ''}${pageType.slice(1)} post`,
      manifest: {
        actions: {
          footer: [],
          header: pageType === 'list' ? ['posts.create'] : pageType === 'view' ? ['posts.edit', 'posts.delete'] : pageType === 'edit' ? ['posts.delete'] : [],
        },
        body: null,
        id: `posts.${pageType}`,
        navigation: null,
        pageType,
        path,
        renderer: null,
        schemaId: null,
        slots: {},
        widgets: { footer: [], header: [] },
      },
      schema: null,
      subheading: null,
      title: 'Posts',
    },
  }
}

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

describe('SvelteKit resource page acceptance', () => {
  it('uses route-key identifiers for update and row-delete operations', () => {
    const record = { id: 'post-primary-id', slug: 'post-route-key', title: 'Post' }

    expect(resourceOperationIdentifier(record, 'slug')).toBe('post-route-key')
    expect(resourceOperationIdentifiers([record], 'id', 'slug', 'post-primary-id')).toEqual(['post-route-key'])
    expect(resourceOperationIdentifiers([record], 'id', 'slug', 'missing-id')).toEqual([])
  })

  it('SSR-renders List/Create/View/Edit through shared Svelte resource renderers', () => {
    const list = render(PanelPage, { props: { data: pageData('list') } }).body
    const create = render(PanelPage, { props: { data: pageData('create') } }).body
    const view = render(PanelPage, { props: { data: pageData('view') } }).body
    const edit = render(PanelPage, { props: { data: pageData('edit') } }).body

    expect(list).toContain('data-panels-component="table"')
    expect(list).toContain('First post')
    expect(list).toContain('href="/admin/posts/create"')
    expect(list).toContain('href="/admin/posts/first-post"')
    expect(list).toContain('href="/admin/posts/first-post/edit"')
    expect(create).toContain('Save post')
    expect(create).toContain('Category')
    expect(view).toContain('First post')
    expect(view).toContain('Delete')
    expect(view).toContain('href="/admin/posts/first-post/edit"')
    expect(edit).toContain('value="First post"')
    expect(render(PanelPage, { props: { data: pageData('list') } }).body).toBe(list)
  })

  it('places the configured notification trigger without opening realtime during SSR', () => {
    const data = pageData('list')
    const configured: PanelPageData = {
      ...data,
      panel: {
        ...data.panel,
        manifest: {
          ...data.panel.manifest,
          databaseNotifications: { placement: 'topbar', polling: 30_000, realtime: true },
        },
        notifications: { realtimeChannel: 'panels.admin.7' },
      },
    }
    let realtimeCalls = 0
    const html = render(PanelPage, {
      props: {
        data: configured,
        notificationRealtime: () => {
          realtimeCalls++
          return { subscribe: () => () => undefined }
        },
      },
    }).body

    expect(html).toContain('data-placement="topbar"')
    expect(html).toContain('aria-label="0 unread notifications"')
    expect(realtimeCalls).toBe(0)
  })

  it('renders consumed session toasts during initial SSR exactly once', () => {
    const data = pageData('create')
    const push = vi.spyOn(ClientToastStore.prototype, 'push')
    const html = render(PanelPage, {
      props: {
        data: {
          ...data,
          effects: [{ kind: 'toast', level: 'success', message: 'Article saved' }],
        },
      },
    }).body

    expect(html).toContain('Article saved')
    expect(push).toHaveBeenCalledOnce()
    push.mockRestore()
  })

  it('renders unrelated resource metadata below a non-admin panel base path without adapter route assumptions', () => {
    const data = pageData('view')
    const inventory: PanelPageData = {
      ...data,
      panel: {
        ...data.panel,
        manifest: { ...data.panel.manifest, id: 'operations', navigation: [], path: '/control' },
      },
      page: {
        ...data.page,
        breadcrumbs: [{ label: 'Inventory', path: '/control/inventory' }],
        data: {
          record: { code: 'widget-1', name: 'Widget one', uuid: 41 },
          resource: {
            actions: [actionPayload({ id: 'inventory.archive', label: 'Archive' })],
            basePath: '/control/inventory',
            columns: [{ manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: 'Name', path: 'name', sortable: true, toggleable: true, type: 'text', width: null, wrap: true } }],
            fields: [{ label: 'Name', path: 'name', required: true, type: 'text' }],
            id: 'inventory',
            label: 'Inventory item',
            options: {},
            recordId: 'uuid',
            routeKey: 'code',
            routes: { create: '/control/inventory/create', edit: '/control/inventory/:record/edit', view: '/control/inventory/:record' },
          },
        },
        manifest: { ...data.page.manifest, actions: { footer: [], header: ['inventory.edit'] }, id: 'inventory.view', path: '/control/inventory/widget-1' },
      },
    }
    const html = render(PanelPage, { props: { data: inventory } }).body

    expect(html).toContain('Widget one')
    expect(html).toContain('href="/control/inventory/widget-1/edit"')
    expect(html).toContain('Archive')
    expect(html).not.toContain('/admin/posts')
    expect(html).not.toContain('Save post')

    const withoutEditAction = render(PanelPage, {
      props: { data: { ...inventory, page: { ...inventory.page, manifest: { ...inventory.page.manifest, actions: { footer: [], header: [] } } } } },
    }).body
    expect(withoutEditAction).not.toContain('href="/control/inventory/widget-1/edit"')
  })

  it('applies filter, slug, and dependent-city state through shared client stores', () => {
    const table = new TableStateStore({ panelId: 'admin', records: posts, tableId: 'posts', total: posts.length })
    table.setSearch('First')
    expect(table.query.search).toBe('First')
    expect(table.query.queryVersion).toBe(1)

    const form = new FormStore<Record<string, unknown>>({ category: '', city: '', slug: '', title: '' }, {
      dependencies: [
        {
          id: 'slug',
          paths: ['title'],
          recompute: context => [{ kind: 'set', path: 'slug', value: slug(String(context.get('title') ?? '')) }],
        },
        {
          id: 'city',
          paths: ['category'],
          recompute: () => [{ kind: 'set', path: 'city', value: null }],
        },
      ],
    })
    form.set('title', 'Café Launch Story')
    expect(form.get('slug')).toBe('cafe-launch-story')
    form.set('city', 'Cairo')
    form.set('category', 'engineering')
    expect(form.get('city')).toBeNull()
  })

  it('executes Delete once through the shared action store and reports safe failures', async () => {
    const requests: string[] = []
    const store = new ClientActionStore<{ readonly deleted: boolean }>({
      createIdempotencyKey: () => 'delete-request-123456789',
      transport: {
        async execute(request) {
          requests.push(request.idempotencyKey)
          return { effects: [], items: [], result: { deleted: true }, status: 'succeeded' }
        },
      },
    })
    store.mount(actionManifest({ confirmation: 'Delete this post?', id: 'posts.delete', kind: 'delete', label: 'Delete', type: 'core:action:delete' }))
    store.confirm()
    const first = store.submit(['first-post'])
    const second = store.submit(['first-post'])
    await expect(first).resolves.toMatchObject({ result: { deleted: true }, status: 'succeeded' })
    await expect(second).resolves.toMatchObject({ status: 'succeeded' })
    expect(requests).toEqual(['delete-request-123456789'])

    const denied = new ClientActionStore({
      createIdempotencyKey: () => 'denied-request-12345678',
      transport: { execute: async () => { throw new Error('You are not authorized to perform this operation.') } },
    })
    denied.mount(actionManifest({ id: 'posts.delete', kind: 'delete', label: 'Delete', type: 'core:action:delete' }))
    await expect(denied.submit(['first-post'])).rejects.toThrow('not authorized')
    expect(denied.activeFrame?.error).toBe('You are not authorized to perform this operation.')
  })
})
