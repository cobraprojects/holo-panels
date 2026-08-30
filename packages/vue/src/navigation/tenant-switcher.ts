import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  PanelsIcon,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../internal-ui'
import { createPanelTranslator, type PanelShellStore, type PanelTenantSwitcherTransport } from '@holo-js/panels-client'
import { defineComponent, h, onScopeDispose, ref, shallowRef, type PropType, type VNodeChild } from 'vue'

interface TenantMenuItem {
  readonly disabled?: boolean
  readonly icon?: string | null
  readonly id: string
  readonly label: string
}

export interface VueTenantSwitcherProps {
  readonly locale?: string
  readonly onError?: (error: unknown) => void
  readonly onNavigate?: (path: string) => void
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
    const translate = createPanelTranslator(componentProps.shell.locale ?? 'en')
    const open = ref(false)
    const state = shallowRef(componentProps.shell.store.snapshot)
    const unsubscribe = componentProps.shell.store.subscribe(next => {
      state.value = next
    })
    onScopeDispose(unsubscribe)
    return (): VNodeChild => {
      const tenancy = state.value.tenancy
      const configuration = state.value.manifest?.tenancy
      if (!tenancy || !configuration || configuration.menu === false) return null
      const items: TenantMenuItem[] = configuration.switcher === false
        ? []
        : tenancy.memberships.memberships.map(tenant => ({
            disabled: tenant.routeKey === tenancy.active?.routeKey,
            id: `tenant:${tenant.routeKey}`,
            label: tenant.label,
          }))
      const routes = [
        ...(configuration.profile ? [{ icon: 'user', id: 'profile', label: translate('tenant.profile'), path: configuration.profile.path }] : []),
        ...(configuration.billing ? [{ icon: 'billing', id: 'billing', label: translate('tenant.billing'), path: configuration.billing.path }] : []),
        ...(configuration.menuItems ?? []),
        ...(configuration.registration ? [{ icon: 'plus', id: 'registration', label: translate('tenant.create'), path: configuration.registration.path }] : []),
      ]
      items.push(...routes.map(item => ({ icon: item.icon, id: `menu:${item.id}`, label: item.label })))
      if (items.length === 0) return null
      const selectItem = (id: string): void => {
        open.value = false
          if (id.startsWith('tenant:')) {
            const routeKey = id.slice('tenant:'.length)
            void componentProps.shell.store.switchTenant(routeKey, componentProps.shell.transport)
              .then(() => componentProps.shell.onSwitched?.(routeKey))
              .catch(error => componentProps.shell.onError?.(error))
            return
          }
          const route = routes.find(item => `menu:${item.id}` === id)
          if (!route) return
          if (componentProps.shell.onNavigate) componentProps.shell.onNavigate(route.path)
          else if (typeof window !== 'undefined') window.location.assign(route.path)
      }
      return h(Popover, {
        open: open.value,
        'onUpdate:open': (nextOpen: boolean) => { open.value = nextOpen },
      }, {
        default: () => [
          h(PopoverTrigger, { asChild: true }, {
            default: () => h(Button, {
              'aria-expanded': open.value,
              'aria-label': translate('tenant.menu'),
              role: 'combobox',
              variant: 'outline',
            }, () => [
              h('span', tenancy.active?.label ?? translate('tenant.select')),
              PanelsIcon('chevron-down', 'hp:ms-auto hp:opacity-50'),
            ]),
          }),
          h(PopoverContent, { align: 'start', class: 'hp:w-(--reka-popover-trigger-width) hp:p-0' }, {
            default: () => h(Command, {}, () => [
              configuration.searchableMenu ?? tenancy.memberships.memberships.length > 10
                ? h(CommandInput, { placeholder: translate('tenant.search') })
                : null,
              h(CommandList, {}, () => [
                h(CommandEmpty, {}, () => translate('tenant.none')),
                ...items.map(item => h(CommandItem, {
                  disabled: item.disabled,
                  key: item.id,
                  value: item.id,
                  onSelect: () => selectItem(item.id),
                }, () => [
                  item.icon ? PanelsIcon(item.icon) : null,
                  h('span', item.label),
                  item.disabled ? PanelsIcon('check', 'hp:ms-auto') : null,
                ])),
              ]),
            ]),
          }),
        ],
      })
    }
  },
})
