import type { PanelShellStore, PanelTenantSwitcherTransport } from '@holo-js/panels-client'
import type { ChangeEvent, ReactNode } from 'react'
import { usePanelsStore } from '../store'

export interface ReactTenantSwitcherProps {
  readonly onError?: (error: unknown) => void
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
  if (!tenancy || tenancy.memberships.memberships.length < 2) return null
  const switchTenant = (event: ChangeEvent<HTMLSelectElement>): void => {
    const routeKey = event.currentTarget.value
    void props.store.switchTenant(routeKey, props.transport)
      .then(() => props.onSwitched?.(routeKey))
      .catch(error => props.onError?.(error))
  }
  return <label>Tenant<select aria-label="Tenant" onChange={switchTenant} value={tenancy.active?.routeKey ?? ''}>
    {tenancy.active === null ? <option disabled value="">Select a tenant</option> : null}
    {tenancy.memberships.memberships.map(tenant => <option key={tenant.routeKey} value={tenant.routeKey}>{tenant.label}</option>)}
  </select></label>
}
