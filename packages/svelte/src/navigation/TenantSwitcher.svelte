<script lang="ts">
  import { toSvelteSnapshot } from '../stores'
  import type { SvelteTenantSwitcherProps } from './contracts'

  let { shell }: { readonly shell: SvelteTenantSwitcherProps } = $props()
  const tenantState = $derived.by(() => toSvelteSnapshot(shell.store))

  function switchTenant(event: Event): void {
    const routeKey = (event.currentTarget as HTMLSelectElement).value
    void shell.store.switchTenant(routeKey, shell.transport)
      .then(() => shell.onSwitched?.(routeKey))
      .catch(error => shell.onError?.(error))
  }
</script>

{#if $tenantState.tenancy && $tenantState.tenancy.memberships.memberships.length > 1}
  <label>Tenant<select aria-label="Tenant" value={$tenantState.tenancy.active?.routeKey ?? ''} onchange={switchTenant}>
    {#if $tenantState.tenancy.active === null}<option disabled value="">Select a tenant</option>{/if}
    {#each $tenantState.tenancy.memberships.memberships as tenant (tenant.routeKey)}<option value={tenant.routeKey}>{tenant.label}</option>{/each}
  </select></label>
{/if}
