import { PanelShellStore } from '@holo-js/panels-client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReactTenantSwitcher } from '../src/navigation/tenant-switcher'

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
      id: 'admin',
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

describe('React tenant switcher', () => {
  it('renders authorized memberships and the active tenant', () => {
    const html = renderToString(<ReactTenantSwitcher store={store()} transport={{ switch: async routeKey => ({ tenant: { id: routeKey, routeKey } }) }} />)

    expect(html).toContain('aria-label="Tenant menu"')
    expect(html).toContain('data-slot="dropdown-menu-trigger"')
    expect(html).toContain('Acme')
  })
})
