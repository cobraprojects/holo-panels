import type { PanelShellStore, PanelTenantSwitcherTransport } from '@holo-js/panels-client'
import { defineComponent, h, onScopeDispose, shallowRef, type PropType, type VNodeChild } from 'vue'

export interface VueTenantSwitcherProps {
  readonly onError?: (error: unknown) => void
  readonly onSwitched?: (routeKey: string) => void
  readonly store: PanelShellStore
  readonly transport: PanelTenantSwitcherTransport
}

export const VueTenantSwitcher = defineComponent({
  name: 'VueTenantSwitcher',
  props: {
    shell: { type: Object as PropType<VueTenantSwitcherProps>, required: true },
  },
  setup(componentProps) {
    const state = shallowRef(componentProps.shell.store.snapshot)
    const unsubscribe = componentProps.shell.store.subscribe(next => {
      state.value = next
    })
    onScopeDispose(unsubscribe)
    return (): VNodeChild => {
      const tenancy = state.value.tenancy
      if (!tenancy || tenancy.memberships.memberships.length < 2) return null
      return h('label', ['Tenant', h('select', {
        'aria-label': 'Tenant',
        value: tenancy.active?.routeKey ?? '',
        onChange: (event: Event) => {
          const routeKey = (event.currentTarget as HTMLSelectElement).value
          void componentProps.shell.store.switchTenant(routeKey, componentProps.shell.transport)
            .then(() => componentProps.shell.onSwitched?.(routeKey))
            .catch(error => componentProps.shell.onError?.(error))
        },
      }, [
        tenancy.active === null ? h('option', { disabled: true, value: '' }, 'Select a tenant') : null,
        ...tenancy.memberships.memberships.map(tenant => h('option', { key: tenant.routeKey, value: tenant.routeKey }, tenant.label)),
      ])])
    }
  },
})
