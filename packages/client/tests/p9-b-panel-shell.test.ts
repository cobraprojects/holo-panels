import { describe, expect, it, vi } from 'vitest'
import type { PanelShellBootstrap } from '../src/panel-shell/contracts'
import { PanelShellStore } from '../src/panel-shell/store'

const bootstrap: PanelShellBootstrap = {
  actor: { id: 7, name: 'Ada' },
  manifest: {
    branding: { favicon: '/favicon.svg', logo: '/logo.svg', name: 'Admin' },
    databaseNotifications: { placement: 'topbar', polling: 30_000, realtime: true },
  default: true,
  globalSearch: false,
  id: 'admin',
    navigation: [
      { badge: null, group: null, icon: 'home', id: 'dashboard', label: 'Dashboard', parent: null, path: '/admin/dashboard', sort: 10 },
      { badge: '4', group: 'Content', icon: 'document', id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 20 },
    ],
    navigationMode: 'sidebar',
    path: '/admin',
    sidebarCollapsible: true,
    slots: {},
    tenancy: null,
    theme: { colors: { primary: '#2563eb' }, darkMode: 'system', density: 'comfortable', fontFamily: 'Inter', width: 'constrained' },
    userMenu: [{ icon: 'user', id: 'profile', label: 'Profile', path: '/admin/profile' }],
  },
  notifications: { realtimeChannel: 'panels.notifications.admin-7' },
  provider: 'users',
  tenancy: null,
}

describe('P9-B panel shell state', () => {
  it('hydrates branding, theme, navigation, active route, actor, and panel-scoped cache identity', () => {
    const store = new PanelShellStore('admin')
    store.bootstrap(bootstrap, '/admin/posts/42/edit?tab=content')

    expect(store.cacheKey).toBe('panel:admin:tenant:none:shell')
    expect(store.snapshot).toMatchObject({ activeNavigationId: 'posts', activePath: '/admin/posts/42/edit', provider: 'users', sidebarOpen: true })
    expect(store.snapshot.manifest).toMatchObject({ branding: { name: 'Admin' }, theme: { darkMode: 'system' } })
    expect(Object.isFrozen(store.snapshot.manifest?.navigation)).toBe(true)
    expect(store.snapshot.notifications).toEqual({ realtimeChannel: 'panels.notifications.admin-7' })
    expect(Object.isFrozen(store.snapshot.manifest?.databaseNotifications)).toBe(true)
    expect(Object.isFrozen(store.snapshot.notifications)).toBe(true)
  })

  it('supports sidebar, topbar, user menu, responsive transitions, and error pages', () => {
    const listener = vi.fn()
    const store = new PanelShellStore('admin')
    store.subscribe(listener)
    store.bootstrap(bootstrap)
    store.toggleSidebar()
    expect(store.snapshot.sidebarOpen).toBe(false)
    store.toggleUserMenu()
    expect(store.snapshot.userMenuOpen).toBe(true)
    store.setViewport(500)
    expect(store.snapshot).toMatchObject({ sidebarOpen: false, viewport: 'mobile' })
    store.fail(503, 'Service unavailable', { requestId: 'request-1' })
    expect(store.snapshot.error).toEqual({ code: 503, message: 'Service unavailable', requestId: 'request-1', retryable: true })
    store.clearError()
    expect(store.snapshot.error).toBeNull()
    expect(listener).toHaveBeenCalled()

    const topbarStore = new PanelShellStore('admin')
    topbarStore.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, navigationMode: 'topbar' } })
    topbarStore.toggleSidebar()
    expect(topbarStore.snapshot.sidebarOpen).toBe(false)
  })

  it('switches only an authorized tenant and rotates the panel cache identity', async () => {
    const store = new PanelShellStore('admin')
    const tenants = [
      { avatarUrl: null, description: null, label: 'Acme', routeKey: 'acme' },
      { avatarUrl: null, description: null, label: 'Globex', routeKey: 'globex' },
    ]
    store.bootstrap({
      ...bootstrap,
      manifest: { ...bootstrap.manifest, tenancy: { enabled: true } },
      tenancy: { active: tenants[0]!, memberships: { memberships: tenants, nextCursor: null } },
    })
    const transport = { switch: vi.fn(async (routeKey: string) => ({ tenant: { id: `id:${routeKey}`, routeKey } })) }

    expect(store.cacheKey).toBe('panel:admin:tenant:acme:shell')
    await store.switchTenant('globex', transport)
    expect(store.snapshot.tenancy?.active).toEqual(tenants[1])
    expect(store.cacheKey).toBe('panel:admin:tenant:globex:shell')
    await expect(store.switchTenant('unknown', transport)).rejects.toThrow('membership was not found')
    expect(transport.switch).toHaveBeenCalledTimes(1)
  })

  it('rejects cross-panel bootstrap and navigation outside the fixed panel route', () => {
    const store = new PanelShellStore('admin')
    expect(() => store.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, id: 'vendor' } })).toThrow('fixed shell panel')
    store.bootstrap(bootstrap)
    expect(() => store.navigate('/vendor/orders')).toThrow('fixed panel path')
    store.navigate('/admin/dashboard')
    expect(store.snapshot.activeNavigationId).toBe('dashboard')
  })

  it('detaches bootstrap state from mutable input and supports a root-mounted fixed panel', () => {
    const payload: PanelShellBootstrap = {
      ...bootstrap,
      actor: { preferences: { locale: 'en' } },
      manifest: { ...bootstrap.manifest, id: 'root', path: '/', navigation: [] },
    }
    const store = new PanelShellStore('root')
    store.bootstrap(payload, '/posts')
    const preferences = payload.actor.preferences as { locale: string }
    preferences.locale = 'fr'
    expect(store.snapshot.actor).toEqual({ preferences: { locale: 'en' } })
    store.navigate('/settings')
    expect(store.snapshot.activePath).toBe('/settings')
  })

  it('rejects non-normalized bootstrap panel paths', () => {
    const store = new PanelShellStore('admin')
    expect(() => store.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, path: '/admin/' } })).toThrow('normalized absolute paths')
  })

  it('rejects invalid notification configuration and realtime bootstrap channels', () => {
    const store = new PanelShellStore('admin')
    expect(() => store.bootstrap({
      ...bootstrap,
      manifest: {
        ...bootstrap.manifest,
        databaseNotifications: { placement: 'topbar', polling: 999, realtime: true },
      },
    })).toThrow('polling')
    expect(() => store.bootstrap({
      ...bootstrap,
      notifications: { realtimeChannel: 'panels.notifications.admin?tenant=other' },
    })).toThrow('stable channel')
    expect(() => store.bootstrap({
      ...bootstrap,
      manifest: { ...bootstrap.manifest, databaseNotifications: null },
    })).toThrow('requires database notifications')
  })

  it.each([
    '/admin/../vendor',
    '/admin/%2e%2e/vendor',
    '/admin/%252e%252e/vendor',
    '/admin/%2fvendor',
    '/admin\\vendor',
    '/admin//vendor',
    '/admin/\u0000vendor',
  ])('rejects unsafe navigation path %s', (path) => {
    const store = new PanelShellStore('admin')
    store.bootstrap(bootstrap)
    expect(() => store.navigate(path)).toThrow()
  })

  it('rejects hostile navigation and user-menu destinations in bootstrap manifests', () => {
    const store = new PanelShellStore('admin')
    const navigation = [{ ...bootstrap.manifest.navigation[0]!, path: '/vendor' }]
    expect(() => store.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, navigation } })).toThrow('destinations')
    const userMenu = [{ ...bootstrap.manifest.userMenu[0]!, path: '/admin/%2e%2e/vendor' }]
    expect(() => store.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, userMenu } })).toThrow()
    expect(() => store.bootstrap({ ...bootstrap, manifest: { ...bootstrap.manifest, branding: { ...bootstrap.manifest.branding, logo: 'javascript:alert(1)' } } })).toThrow('HTTPS URL')
  })
})
