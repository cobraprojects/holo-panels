import { Badge, Button, PanelsIcon, Popover, PopoverContent, PopoverTrigger } from '../internal-ui'
import { defineComponent, h, nextTick, onUnmounted, shallowRef, type PropType, type VNode } from 'vue'
import { VueNotificationInbox } from './renderer'
import type { VueNotificationInboxTriggerProps } from './types'

export const VueNotificationInboxTrigger = defineComponent({
  name: 'HoloPanelsNotificationInboxTrigger',
  props: {
    emptyMessage: String,
    label: { default: 'Notifications', type: String },
    locale: { default: 'en', type: String },
    lazy: { default: false, type: Boolean },
    navigate: Function as PropType<VueNotificationInboxTriggerProps['navigate']>,
    panelId: String,
    placement: { required: true, type: String as PropType<VueNotificationInboxTriggerProps['placement']> },
    registry: Object as PropType<VueNotificationInboxTriggerProps['registry']>,
    store: { required: true, type: Object as PropType<VueNotificationInboxTriggerProps['store']> },
  },
  setup(props) {
    const open = shallowRef(false)
    const activated = shallowRef(!props.lazy)
    const trigger = shallowRef<HTMLButtonElement | { $el?: HTMLButtonElement }>()
    const state = shallowRef(props.store.state)
    const unsubscribe = props.store.subscribe(next => { state.value = next })
    onUnmounted(unsubscribe)
    return (): VNode => {
      const resolvedLabel = props.label.trim() || 'Notifications'
      const accessibleLabel = state.value.unread > 0 ? `${resolvedLabel}, ${state.value.unread} unread` : resolvedLabel
      const inboxPlacement = props.placement === 'topbar' ? 'dropdown' : 'sidebar'
      return h(Popover, { open: open.value, 'onUpdate:open': (nextOpen: boolean) => {
        open.value = nextOpen
        if (nextOpen) activated.value = true
        else void nextTick(() => {
          const element = trigger.value instanceof HTMLButtonElement ? trigger.value : trigger.value?.$el
          element?.focus()
        })
      } }, () => [
        h(PopoverTrigger, { asChild: true }, () => h(Button, { 'aria-label': accessibleLabel, class: 'hp-notification-inbox-trigger-button hp:relative', ref: trigger, size: 'icon', title: resolvedLabel, type: 'button', variant: 'ghost' }, () => [
          PanelsIcon('bell'),
          state.value.unread > 0 ? h(Badge, { 'aria-hidden': 'true', class: 'hp-notification-inbox-trigger-badge hp:absolute hp:-right-2 hp:-top-2', variant: 'destructive' }, () => state.value.unread) : null,
        ])),
        h(PopoverContent, { align: props.placement === 'topbar' ? 'end' : 'start', class: 'hp-notification-inbox-trigger-content hp:w-[min(28rem,calc(100vw-2rem))] hp:p-0 hp:data-[state=closed]:hidden', 'data-placement': inboxPlacement, forceMount: activated.value }, () => activated.value ? h(VueNotificationInbox, {
            emptyMessage: props.emptyMessage,
            locale: props.locale,
            navigate: props.navigate,
            panelId: props.panelId,
            placement: inboxPlacement,
            registry: props.registry,
            store: props.store,
          }) : null),
      ])
    }
  },
})
