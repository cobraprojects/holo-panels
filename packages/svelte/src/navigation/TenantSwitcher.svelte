<script lang="ts">
  import Dropdown from '../components/Dropdown.svelte'
  import { toSvelteSnapshot } from '../stores'
  import type { SvelteTenantSwitcherProps } from './contracts'

  let { shell }: { readonly shell: SvelteTenantSwitcherProps } = $props()
  const tenantState = $derived.by(() => toSvelteSnapshot(shell.store))
  const routes = $derived.by(() => {
    const configuration = $tenantState.manifest?.tenancy
    if (!configuration) return []
    return [
      ...(configuration.profile ? [{ icon: 'user', id: 'profile', label: 'Tenant profile', path: configuration.profile.path }] : []),
      ...(configuration.billing ? [{ icon: 'billing', id: 'billing', label: 'Billing', path: configuration.billing.path }] : []),
      ...(configuration.menuItems ?? []),
      ...(configuration.registration ? [{ icon: 'plus', id: 'registration', label: 'Create tenant', path: configuration.registration.path }] : []),
    ]
  })
  const items = $derived.by(() => {
    const tenancy = $tenantState.tenancy
    const configuration = $tenantState.manifest?.tenancy
    if (!tenancy || !configuration) return []
    return [
      ...(configuration.switcher === false ? [] : tenancy.memberships.memberships.map(tenant => ({
        disabled: tenant.routeKey === tenancy.active?.routeKey,
        id: `tenant:${tenant.routeKey}`,
        label: tenant.label,
      }))),
      ...routes.map(item => ({ icon: item.icon, id: `menu:${item.id}`, label: item.label })),
    ]
  })

  function selectItem(id: string): void {
    if (id.startsWith('menu:')) {
      const route = routes.find(item => `menu:${item.id}` === id)
      if (!route) return
      if (shell.onNavigate) shell.onNavigate(route.path)
      else if (typeof window !== 'undefined') window.location.assign(route.path)
      return
    }
    const routeKey = id.slice('tenant:'.length)
    void shell.store.switchTenant(routeKey, shell.transport)
      .then(() => shell.onSwitched?.(routeKey))
      .catch(error => shell.onError?.(error))
  }
</script>

{#if $tenantState.tenancy && $tenantState.manifest?.tenancy?.menu !== false && items.length > 0}
  <Dropdown ariaLabel="Tenant menu" {items} label={$tenantState.tenancy.active?.label ?? 'Select tenant'} onselect={selectItem} searchable={$tenantState.manifest?.tenancy?.searchableMenu ?? $tenantState.tenancy.memberships.memberships.length > 10} />
{/if}
