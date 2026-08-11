import type { PanelShellStore, PanelTenantSwitcherTransport } from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import { PanelsAvatar, PanelsDropdown, type PanelsDropdownItem } from '../primitives'
import { usePanelsStore } from '../store'

export interface ReactTenantSwitcherProps {
  readonly onError?: (error: unknown) => void
  readonly onNavigate?: (path: string) => void
  readonly onSwitched?: (routeKey: string) => void
  readonly store: PanelShellStore
  readonly transport: PanelTenantSwitcherTransport
}

export function ReactTenantSwitcher(props: ReactTenantSwitcherProps): ReactNode {
  const state = usePanelsStore({
    getSnapshot: () => props.store.snapshot,
    subscribe: listener => props.store.subscribe(() => listener()),
  })
  const tenancy = state.tenancy
  const configuration = state.manifest?.tenancy
  if (!tenancy || !configuration || configuration.menu === false) return null
  const switchTenant = (routeKey: string): void => {
    void props.store.switchTenant(routeKey, props.transport)
      .then(() => props.onSwitched?.(routeKey))
      .catch(error => props.onError?.(error))
  }
  const navigate = (path: string): void => {
    if (props.onNavigate) props.onNavigate(path)
    else if (typeof window !== 'undefined') window.location.assign(path)
  }
  const items: PanelsDropdownItem[] = configuration.switcher === false
    ? []
    : tenancy.memberships.memberships.map(tenant => ({
        disabled: tenant.routeKey === tenancy.active?.routeKey,
        id: `tenant:${tenant.routeKey}`,
        label: tenant.label,
        onSelect: () => switchTenant(tenant.routeKey),
        textValue: tenant.label,
      }))
  const routes = [
    ...(configuration.profile ? [{ icon: 'user', id: 'profile', label: 'Tenant profile', path: configuration.profile.path }] : []),
    ...(configuration.billing ? [{ icon: 'billing', id: 'billing', label: 'Billing', path: configuration.billing.path }] : []),
    ...(configuration.menuItems ?? []),
    ...(configuration.registration ? [{ icon: 'plus', id: 'registration', label: 'Create tenant', path: configuration.registration.path }] : []),
  ]
  items.push(...routes.map(item => ({ icon: item.icon, id: `menu:${item.id}`, label: item.label, onSelect: () => navigate(item.path) })))
  if (items.length === 0) return null
  const active = tenancy.active
  return <PanelsDropdown
    ariaLabel="Tenant menu"
    items={items}
    label={<><PanelsAvatar alt={active?.label ?? 'Tenant'} fallback={active?.label.slice(0, 2)} src={active?.avatarUrl ?? undefined} />{active?.label ?? 'Select tenant'}</>}
    searchable={configuration.searchableMenu ?? tenancy.memberships.memberships.length > 10}
  />
}
