import { ClientActionStore, ClientToastStore, FormStore, TableStateStore, toJsonValue, type ClientActionManifest, type JsonObject } from '@holo-js/panels-svelte'
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { createSvelteKitPanelComponentRegistry, PanelPage, type PanelPageData } from '../src'
import { resourceOperationIdentifier, resourceOperationIdentifiers, resourcePageMetadata } from '../src/resource-page'
import CustomAvatar from './fixtures/CustomAvatar.svelte'
import CustomNotification from './fixtures/CustomNotification.svelte'
import CustomSidebar from './fixtures/CustomSidebar.svelte'
import CustomTopbar from './fixtures/CustomTopbar.svelte'

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
  actions: [{ ...actionPayload({ confirmation: 'Delete this post?', id: 'posts.delete', kind: 'delete', label: 'Delete', type: 'core:action:delete' }), scope: 'row' }],
  basePath: '/admin/posts',
  columns: ['title', 'slug', 'category', 'city'].map(path => ({
    manifest: { alignment: 'start', copyable: path === 'slug', formatters: path === 'title' ? [{ kind: 'prefix', value: 'Post: ' }] : [], hidden: false, inlineEditor: null, label: `${path[0]?.toUpperCase() ?? ''}${path.slice(1)}`, lineClamp: path === 'title' ? 2 : null, path, searchable: path === 'title', sortable: true, toggleable: true, type: 'text', width: null, wrap: true },
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
  recordActions: [
    actionPayload({ id: 'posts.create', kind: 'create', label: 'Create post', mount: 'page', type: 'core:action:create' }),
    actionPayload({ id: 'posts.edit', kind: 'edit', label: 'Edit', type: 'core:action:edit' }),
    actionPayload({ confirmation: 'Delete this post?', id: 'posts.delete', kind: 'delete', label: 'Delete', type: 'core:action:delete' }),
  ],
  routeKey: 'slug',
  routes: { create: '/admin/posts/create', edit: '/admin/posts/:record/edit', view: '/admin/posts/:record' },
  saveLabel: 'Save post',
  formActions: [actionPayload({ id: 'posts.save', label: 'Save post', mount: 'page' })],
}

function pageData(pageType: 'create' | 'edit' | 'list' | 'manage' | 'view'): PanelPageData {
  const record = posts[0]
  const path = pageType === 'list' || pageType === 'manage'
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
      direction: 'ltr',
      locale: 'en',
      manifest: {
        auth: null,
        branding: { favicon: null, logo: null, name: 'Admin' },
        databaseNotifications: null,
        default: true,
        globalSearch: true,
        id: 'admin',
        locales: { allowed: ['en', 'ar'], fallback: 'en' },
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
        ...(pageType === 'list' || pageType === 'manage' ? { filters: { search: '' }, records: posts } : {}),
        ...(pageType === 'edit' || pageType === 'view' ? { record } : {}),
        resource: postResource,
      },
      heading: pageType === 'list' || pageType === 'manage' ? 'Posts' : `${pageType[0]?.toUpperCase() ?? ''}${pageType.slice(1)} post`,
      manifest: {
        actions: {
          footer: [],
          header: pageType === 'list' || pageType === 'manage' ? ['posts.create'] : pageType === 'view' ? ['posts.edit', 'posts.delete'] : pageType === 'edit' ? ['posts.delete'] : [],
        },
        body: null,
        id: `posts.${pageType}`,
        navigation: null,
        pageType,
        path,
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

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

describe('SvelteKit resource page acceptance', () => {
  it('uses the configured panel home URL for the brand link', () => {
    const data = pageData('list')
    const configured: PanelPageData = {
      ...data,
      panel: {
        ...data.panel,
        manifest: {
          ...data.panel.manifest,
          icons: { posts: 'home' },
          navigation: data.panel.manifest.navigation.map(item => ({ ...item, icon: 'posts' })),
          routing: { domain: null, domains: [], homeUrl: '/admin/overview' },
        },
      },
    }

    const markup = render(PanelPage, { props: { data: configured } }).body
    expect(markup).toContain('href="/admin/overview"')
    expect(markup).toContain('data-icon="home"')
  })

  it('renders shared panel chrome in Arabic with an RTL sidebar', () => {
    const current = pageData('list')
    const configured: PanelPageData = {
      ...current,
      panel: { ...current.panel, direction: 'rtl', locale: 'ar' },
    }

    const markup = render(PanelPage, { props: { data: configured } }).body

    expect(markup).toContain('dir="rtl"')
    expect(markup).toContain('lang="ar"')
    expect(markup).toContain('قائمة الحساب')
    expect(markup).toContain('data-side="right"')
  })

  it('makes relation managers interactive on view pages only when the panel enables it', () => {
    const current = pageData('view')
    const relations = [{ badge: null, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'author', label: 'Author', operations: ['select', 'associate'], presentation: 'inline', records: [{ id: 'author-1', values: { name: 'Ada' } }], url: null, visible: true }]
    const configured = (readOnly: boolean): PanelPageData => ({
      ...current,
      panel: {
        ...current.panel,
        manifest: {
          ...current.panel.manifest,
          runtime: {
            databaseTransactions: false,
            readOnlyRelationManagersOnResourceViewPagesByDefault: readOnly,
            resourceCreatePageRedirect: 'edit',
            resourceEditPageRedirect: null,
            spa: false,
            spaUrlExceptions: [],
            strictAuthorization: false,
            unsavedChangesAlerts: false,
          },
        },
      },
      page: { ...current.page, data: { ...current.page.data, relations } },
    })

    const interactive = render(PanelPage, { props: { data: configured(false) } }).body
    const readOnly = render(PanelPage, { props: { data: configured(true) } }).body
    expect(interactive).toContain('data-operation="associate"')
    expect(readOnly).not.toContain('data-operation="associate"')
    expect(readOnly).toContain('Ada')
  })

  it('keeps generated edit routes stable when a mutable route key changes', () => {
    const metadata = resourcePageMetadata({
      form: { fields: [] },
      id: 'posts',
      infolist: { entries: [] },
      labels: { plural: 'Posts' },
      recordId: 'id',
      routeKey: 'slug',
      table: { actions: [], columns: [], filters: [] },
    }, '/admin/posts/old-slug/edit', 'edit')

    expect(metadata?.basePath).toBe('/admin/posts')
    expect(metadata?.routes.edit).toBe('/admin/posts/:record/edit')
    expect(metadata?.routes.view).toBe('/admin/posts/:record')
  })

  it('uses route-key identifiers for update and row-delete operations', () => {
    const record = { id: 'post-primary-id', slug: 'post-route-key', title: 'Post' }

    expect(resourceOperationIdentifier(record, 'slug')).toBe('post-route-key')
    expect(resourceOperationIdentifiers([record], 'id', 'slug', 'post-primary-id')).toEqual(['post-route-key'])
    expect(resourceOperationIdentifiers([record], 'id', 'slug', 'missing-id')).toEqual([])
  })

  it('SSR-renders List/Manage/Create/View/Edit through shared Svelte resource renderers', () => {
    const list = render(PanelPage, { props: { data: pageData('list') } }).body
    const manage = render(PanelPage, { props: { data: pageData('manage') } }).body
    const create = render(PanelPage, { props: { data: pageData('create') } }).body
    const view = render(PanelPage, { props: { data: pageData('view') } }).body
    const edit = render(PanelPage, { props: { data: pageData('edit') } }).body

    expect(list).toContain('data-panels-component="table"')
    expect(manage).toContain('data-panels-component="table"')
    expect(list).toContain('First post')
    expect(list).toContain('Post: First post')
    expect(list).toContain('data-action-id="posts.create"')
    expect(list).toContain('aria-label="Row actions"')
    expect(list).toContain('hp-panel-topbar-start')
    expect(list).toContain('hp-panel-topbar-end')
    expect(list).toContain('hp-panel-navigation-header')
    expect(list).toContain('hp-panel-navigation-body')
    expect(list).toContain('hp-panel-main-header')
    expect(list).toContain('hp-panel-main-body')
    expect(list).toContain('hp-panel-user-glyph')
    expect(list).toContain('hp-panel-user-action')
    expect(list).toContain('hp-panel-actions--compact')
    expect(list).toContain('AD')
    expect(create).toContain('Save post')
    expect(create).toContain('Category')
    expect(view).toContain('First post')
    expect(view).toContain('Delete')
    expect(view).toContain('data-action-id="posts.edit"')
    expect(edit).toContain('value="First post"')
    expect(render(PanelPage, { props: { data: pageData('list') } }).body).toBe(list)
  })

  it('renders top navigation without a sidebar when the panel selects topbar mode', () => {
    const data = pageData('list')
    const topbar = render(PanelPage, {
      props: { data: { ...data, panel: { ...data.panel, manifest: { ...data.panel.manifest, navigationMode: 'topbar' } } } },
    }).body

    expect(topbar).toContain('hp-panel-navigation--topbar')
    expect(topbar).toContain('hp-panel-topbar-center')
    expect(topbar).not.toContain('hp-panel-sidebar')
  })

  it('omits the panel header when the provider disables the topbar', () => {
    const data = pageData('list')
    const withoutTopbar = render(PanelPage, {
      props: { data: { ...data, panel: { ...data.panel, manifest: { ...data.panel.manifest, layout: { ...data.panel.manifest.layout!, topbar: false } } } } },
    }).body

    expect(withoutTopbar).not.toContain('hp-panel-header')
  })

  it('omits the account dropdown when the provider disables the user menu', () => {
    const data = pageData('list')
    const withoutUserMenu = render(PanelPage, {
      props: { data: { ...data, panel: { ...data.panel, manifest: { ...data.panel.manifest, userMenuEnabled: false } } } },
    }).body

    expect(withoutUserMenu).not.toContain('hp-panel-user-trigger')
  })

  it('omits navigation chrome when the provider disables navigation', () => {
    const data = pageData('list')
    const withoutNavigation = render(PanelPage, {
      props: { data: { ...data, panel: { ...data.panel, manifest: { ...data.panel.manifest, navigationEnabled: false } } } },
    }).body

    expect(withoutNavigation).not.toContain('data-slot="sidebar"')
    expect(withoutNavigation).not.toContain('hp-panel-navigation-toggle')
  })

  it('renders provider-configured topbar, sidebar, and avatar components', () => {
    const data = pageData('list')
    const registry = createSvelteKitPanelComponentRegistry()
    registry.register({ component: CustomTopbar, source: 'acceptance', typeId: 'custom-topbar' })
    registry.register({ component: CustomSidebar, source: 'acceptance', typeId: 'custom-sidebar' })
    registry.register({ component: CustomAvatar, source: 'acceptance', typeId: 'custom-avatar' })
    registry.register({ component: CustomNotification, source: 'acceptance', typeId: 'custom-notification' })
    const configured = (components: { readonly sidebar: string | null, readonly topbar: string | null }, avatarProvider: string | null): PanelPageData => ({
      ...data,
      panel: {
        ...data.panel,
        manifest: { ...data.panel.manifest, assets: [{ id: 'admin-theme', src: '/admin/theme.css', type: 'css' }], branding: { ...data.panel.manifest.branding, avatarProvider }, components },
      },
    })

    const chromeRender = render(PanelPage, { props: { data: configured({ sidebar: 'custom-sidebar', topbar: 'custom-topbar' }, null), registry } })
    const chrome = chromeRender.body
    const configuredAvatar = configured({ sidebar: null, topbar: null }, 'custom-avatar')
    const avatarData: PanelPageData = {
      ...configuredAvatar,
      panel: {
        ...configuredAvatar.panel,
        manifest: { ...configuredAvatar.panel.manifest, databaseNotifications: { component: 'custom-notification', lazy: true, placement: 'topbar', polling: false, realtime: false } },
      },
    }
    const avatar = render(PanelPage, { props: { data: avatarData, registry } }).body
    expect(chrome).toContain('data-custom-topbar="admin"')
    expect(chrome).toContain('data-custom-sidebar="7"')
    expect(chrome).not.toContain('hp-panel-header')
    expect(chromeRender.head).toContain('data-panel-asset="admin-theme"')
    expect(chromeRender.head).toContain('href="/admin/theme.css"')
    expect(avatar).toContain('data-custom-avatar="7"')
    expect(avatar).toContain('data-custom-notification="topbar"')
    expect(avatar).toContain('hp-panel-notification-action')
  })

  it('renders the built-in tenant switcher without application transport helpers', () => {
    const data = pageData('list')
    const html = render(PanelPage, {
      props: {
        data: {
          ...data,
          panel: {
            ...data.panel,
            manifest: { ...data.panel.manifest, tenancy: { enabled: true } },
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
        },
      },
    }).body

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
    const hidden = render(PanelPage, {
      props: {
        data: {
          ...data,
          panel: {
            ...data.panel,
            manifest: { ...data.panel.manifest, tenancy: { enabled: true, switcher: false } },
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
        },
      },
    }).body
    expect(hidden).not.toContain('aria-label="Tenant menu"')
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

    expect(html).toContain('hp-panel-notification-action')
    expect(html).toContain('aria-label="Notifications"')
    expect(html).not.toContain('unread notifications')
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
            recordActions: [
              actionPayload({ id: 'inventory.edit', kind: 'edit', label: 'Edit', type: 'core:action:edit' }),
              actionPayload({ id: 'inventory.archive', label: 'Archive' }),
            ],
            routeKey: 'code',
            routes: { create: '/control/inventory/create', edit: '/control/inventory/:record/edit', view: '/control/inventory/:record' },
          },
        },
        manifest: { ...data.page.manifest, actions: { footer: [], header: ['inventory.edit'] }, id: 'inventory.view', path: '/control/inventory/widget-1' },
      },
    }
    const html = render(PanelPage, { props: { data: inventory } }).body

    expect(html).toContain('Widget one')
    expect(html).toContain('data-action-id="inventory.edit"')
    expect(html).toContain('Archive')
    expect(html).not.toContain('/admin/posts')
    expect(html).not.toContain('Save post')

    const withoutEditAction = render(PanelPage, {
      props: { data: { ...inventory, page: { ...inventory.page, manifest: { ...inventory.page.manifest, actions: { footer: [], header: [] } } } } },
    }).body
    expect(withoutEditAction).not.toContain('href="/control/inventory/widget-1/edit"')
  })

  it('renders accessible field labels when generated metadata omits them', () => {
    const data = pageData('create')
    const resource = data.page.data.resource
    if (!resource || typeof resource !== 'object' || Array.isArray(resource) || !Array.isArray(resource.fields)) throw new Error('Create page is missing its resource fields')
    const unlabeledFields = resource.fields.map(field => field && typeof field === 'object' && !Array.isArray(field) ? { ...field, label: null } : field)
    const html = render(PanelPage, {
      props: {
        data: {
          ...data,
          page: { ...data.page, data: { ...data.page.data, resource: { ...resource, fields: unlabeledFields } } },
        },
      },
    }).body

    expect(html).toContain('Title')
    expect(html).toContain('Category')
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
    expect(denied.activeFrame).toBeNull()
  })
})
