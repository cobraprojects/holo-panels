import { ShadcnButton, ShadcnIcon } from '../internal-ui'
import { defineComponent, h, onMounted, onUnmounted, shallowRef, useId, type PropType, type VNode } from 'vue'
import { VueNotificationInbox } from './renderer'
import type { VueNotificationInboxTriggerProps } from './types'

export const VueNotificationInboxTrigger = defineComponent({
  name: 'HoloPanelsNotificationInboxTrigger',
  props: {
    emptyMessage: String,
    label: { default: 'Notifications', type: String },
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
    const container = shallowRef<HTMLDivElement | null>(null)
    const state = shallowRef(props.store.state)
    const unsubscribe = props.store.subscribe(next => { state.value = next })
    const inboxId = `hp-notification-inbox-${useId()}`
    const closeAndRestoreFocus = (): void => {
      open.value = false
      container.value?.querySelector<HTMLButtonElement>('.hp-notification-inbox-trigger-button')?.focus()
    }
    const onDocumentClick = (event: MouseEvent): void => {
      if (!open.value || !(event.target instanceof Node) || container.value?.contains(event.target)) return
      closeAndRestoreFocus()
    }
    const onDocumentKeyDown = (event: KeyboardEvent): void => {
      if (!open.value || event.key !== 'Escape') return
      event.preventDefault()
      closeAndRestoreFocus()
    }
    onMounted(() => {
      document.addEventListener('click', onDocumentClick)
      document.addEventListener('keydown', onDocumentKeyDown)
    })
    onUnmounted(() => {
      unsubscribe()
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onDocumentKeyDown)
    })
    return (): VNode => {
      const resolvedLabel = props.label.trim() || 'Notifications'
      const accessibleLabel = state.value.unread > 0 ? `${resolvedLabel}, ${state.value.unread} unread` : resolvedLabel
      const inboxPlacement = props.placement === 'topbar' ? 'dropdown' : 'sidebar'
      return h('div', { class: 'hp-notification-inbox-trigger', 'data-placement': props.placement, ref: container }, [
        h(ShadcnButton, {
          'aria-controls': inboxId,
          'aria-expanded': String(open.value),
          'aria-label': accessibleLabel,
          class: 'hp-notification-inbox-trigger-button',
          onClick: () => { activated.value = true; open.value = !open.value },
          title: resolvedLabel,
          type: 'button',
        }, [
          ShadcnIcon('bell'),
          state.value.unread > 0 ? h('span', { 'aria-hidden': 'true', class: 'hp-notification-inbox-trigger-badge' }, state.value.unread) : null,
        ]),
        h('div', { class: 'hp-notification-inbox-trigger-content', hidden: !open.value, id: inboxId }, [
          activated.value ? h(VueNotificationInbox, {
            emptyMessage: props.emptyMessage,
            navigate: props.navigate,
            panelId: props.panelId,
            placement: inboxPlacement,
            registry: props.registry,
            store: props.store,
          }) : null,
        ]),
      ])
    }
  },
})
