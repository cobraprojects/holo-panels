import { PanelShellStore } from '@holo-js/panels-client'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { VueTenantSwitcher } from '../src/navigation/tenant-switcher'

function store(): PanelShellStore {
  const value = new PanelShellStore('admin')
  const tenants = [
    { avatarUrl: null, description: null, label: 'Acme', routeKey: 'acme' },
    { avatarUrl: null, description: null, label: 'Globex', routeKey: 'globex' },
  ]
  value.bootstrap({
    actor: { id: 1 },
    direction: 'ltr',
    locale: 'en',
    manifest: {
      branding: { favicon: null, logo: null, name: 'Admin' },
      databaseNotifications: null,
      default: true,
      direction: 'ltr',
      id: 'admin',
      locale: 'en',
      locales: { allowed: ['en', 'ar'], fallback: 'en' },
      navigation: [],
      navigationMode: 'sidebar',
      path: '/admin',
      sidebarCollapsible: true,
      slots: {},
      tenancy: { enabled: true },
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
      userMenu: [],
    },
    notifications: null,
    provider: 'users',
    tenancy: { active: tenants[0]!, memberships: { memberships: tenants, nextCursor: null } },
  })
  return value
}

describe('Vue tenant switcher', () => {
  it('renders authorized memberships and the active tenant', async () => {
    const shell = { store: store(), transport: { switch: async (routeKey: string) => ({ tenant: { id: routeKey, routeKey } }) } }
    const html = await renderToString(createSSRApp(() => h(VueTenantSwitcher, { shell })))

    expect(html).toContain('aria-label="Tenant menu"')
    expect(html).toContain('data-slot="popover-trigger"')
    expect(html).toContain('Acme')
  })

  it('localizes built-in tenant controls without translating application labels', async () => {
    const shell = { locale: 'ar', store: store(), transport: { switch: async (routeKey: string) => ({ tenant: { id: routeKey, routeKey } }) } }
    const html = await renderToString(createSSRApp(() => h(VueTenantSwitcher, { shell })))

    expect(html).toContain('aria-label="قائمة المستأجرين"')
    expect(html).toContain('Acme')
  })
})
