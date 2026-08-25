<script lang="ts">
  import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down'
  import { Button } from '../ui/button'
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
  import * as Popover from '../ui/popover'
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
  const searchable = $derived($tenantState.manifest?.tenancy?.searchableMenu ?? ($tenantState.tenancy?.memberships.memberships.length ?? 0) > 10)
  const activeTenantLabel = $derived($tenantState.tenancy?.active?.label ?? 'Select tenant')
  let open = $state(false)

  function selectItem(id: string): void {
    if (id.startsWith('menu:')) {
      const route = routes.find(item => `menu:${item.id}` === id)
      if (!route) return
      if (shell.onNavigate) shell.onNavigate(route.path)
      else if (typeof window !== 'undefined') window.location.assign(route.path)
      open = false
      return
    }
    const routeKey = id.slice('tenant:'.length)
    void shell.store.switchTenant(routeKey, shell.transport)
      .then(() => shell.onSwitched?.(routeKey))
      .catch(error => shell.onError?.(error))
    open = false
  }
</script>

{#if $tenantState.tenancy && $tenantState.manifest?.tenancy?.menu !== false && items.length > 0}
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}<Button {...props} aria-label="Tenant menu" role="combobox" variant="outline">{activeTenantLabel}<ChevronsUpDown /></Button>{/snippet}
    </Popover.Trigger>
    <Popover.Content align="end" class="hp:w-64 hp:p-0" data-holo-panel>
      <Command>
        {#if searchable}<CommandInput placeholder="Search tenants..." />{/if}
        <CommandList><CommandEmpty>No tenants found.</CommandEmpty><CommandGroup>
          {#each items as item (item.id)}<CommandItem disabled={'disabled' in item && item.disabled} value={item.label} onclick={() => selectItem(item.id)}>{item.label}</CommandItem>{/each}
        </CommandGroup></CommandList>
      </Command>
    </Popover.Content>
  </Popover.Root>
{/if}
