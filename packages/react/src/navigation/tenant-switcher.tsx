import { createPanelTranslator, type PanelShellStore, type PanelTenantSwitcherTransport } from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { PanelsIcon } from '../internal-ui'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { usePanelsStore } from '../store'

export interface ReactTenantSwitcherProps {
  readonly locale?: string
  readonly onError?: (error: unknown) => void
  readonly onNavigate?: (path: string) => void
  readonly onSwitched?: (routeKey: string) => void
  readonly store: PanelShellStore
  readonly transport: PanelTenantSwitcherTransport
}

export function ReactTenantSwitcher(props: ReactTenantSwitcherProps): ReactNode {
  const translate = createPanelTranslator(props.locale ?? 'en')
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
  const memberships = configuration.switcher === false ? [] : tenancy.memberships.memberships
  const routes = [
    ...(configuration.profile ? [{ icon: 'user', id: 'profile', label: translate('tenant.profile'), path: configuration.profile.path }] : []),
    ...(configuration.billing ? [{ icon: 'billing', id: 'billing', label: translate('tenant.billing'), path: configuration.billing.path }] : []),
    ...(configuration.menuItems ?? []),
    ...(configuration.registration ? [{ icon: 'plus', id: 'registration', label: translate('tenant.create'), path: configuration.registration.path }] : []),
  ]
  if (memberships.length === 0 && routes.length === 0) return null
  const active = tenancy.active
  const activeLabel = active?.label ?? translate('tenant.select')
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button aria-label={translate('tenant.menu')} className="hp:justify-between" variant="outline">
        <span className="hp:flex hp:min-w-0 hp:items-center hp:gap-2">
          <Avatar size="sm">{active?.avatarUrl ? <AvatarImage alt={activeLabel} src={active.avatarUrl} /> : null}<AvatarFallback>{activeLabel.slice(0, 2)}</AvatarFallback></Avatar>
          <span className="hp:truncate">{activeLabel}</span>
        </span>
        <ChevronsUpDown className="hp:opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="hp:min-w-56" data-holo-panel="">
      {memberships.length > 0 ? <DropdownMenuLabel>{translate('tenant.tenants')}</DropdownMenuLabel> : null}
      {memberships.map(tenant => <DropdownMenuItem disabled={tenant.routeKey === active?.routeKey} key={tenant.routeKey} onSelect={() => switchTenant(tenant.routeKey)}>
        <Avatar size="sm">{tenant.avatarUrl ? <AvatarImage alt={tenant.label} src={tenant.avatarUrl} /> : null}<AvatarFallback>{tenant.label.slice(0, 2)}</AvatarFallback></Avatar>{tenant.label}
      </DropdownMenuItem>)}
      {memberships.length > 0 && routes.length > 0 ? <DropdownMenuSeparator /> : null}
      {routes.map(item => <DropdownMenuItem key={item.id} onSelect={() => navigate(item.path)}><PanelsIcon name={item.icon ?? 'circle'} />{item.label}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
