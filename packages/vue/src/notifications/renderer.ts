import { ShadcnButton } from '../internal-ui'
import { safeExternalUrl, type ClientToast } from '@holo-js/panels-client'
import { defineComponent, h, onMounted, onUnmounted, shallowRef, type PropType, type VNode, type VNodeChild } from 'vue'
import type {
  VueCustomNotificationProps,
  VueDatabaseNotification,
  VueNotificationControls,
  VueNotificationInboxProps,
  VueToastViewportProps,
} from './types'

interface NotificationAction {
  readonly id: string
  readonly kind: 'dismiss' | 'mark-read' | 'mark-unread' | 'navigate'
  readonly label: string
  readonly url: string | null
}

function ignoreFailure(operation: Promise<unknown>): void {
  void operation.catch(() => undefined)
}

export function vueNotificationRendererName(type: string): string {
  return `notification.${type}`
}

function actionValue(value: unknown): NotificationAction | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const action = value as Record<string, unknown>
  if (typeof action.id !== 'string' || typeof action.label !== 'string') return null
  if (action.kind !== 'dismiss' && action.kind !== 'mark-read' && action.kind !== 'mark-unread' && action.kind !== 'navigate') return null
  return { id: action.id, kind: action.kind, label: action.label, url: typeof action.url === 'string' ? action.url : null }
}

function toastAction(action: NotificationAction, toast: ClientToast, props: VueToastViewportProps): VNode {
  const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
  if (url) return h('a', { href: url, onClick: (event: Event) => {
    ignoreFailure(props.store.trigger(toast.id, action.id))
    if (props.navigate) {
      event.preventDefault()
      props.navigate(url)
    }
  } }, action.label)
  return h(ShadcnButton, { onClick: () => ignoreFailure(props.store.trigger(toast.id, action.id)), type: 'button' }, action.label)
}

export const VueToastViewport = defineComponent({
  name: 'HoloPanelsToastViewport',
  props: {
    navigate: Function as PropType<VueToastViewportProps['navigate']>,
    placement: { default: 'top', type: String as PropType<NonNullable<VueToastViewportProps['placement']>> },
    store: { required: true, type: Object as PropType<VueToastViewportProps['store']> },
  },
  setup(props) {
    const state = shallowRef(props.store.state)
    const unsubscribe = props.store.subscribe(next => { state.value = next })
    onUnmounted(unsubscribe)
    return (): VNode => h('section', { 'aria-label': 'Notifications', class: 'hp-notification-toasts', 'data-placement': props.placement }, [
      h('div', { 'aria-atomic': 'true', 'aria-live': 'polite', class: 'hp-visually-hidden', role: 'status' }, state.value.liveMessage),
      h('ol', { 'aria-label': 'Notification queue', class: 'hp-notification-toast-list', 'data-slot': 'notification-toast-list' }, state.value.items.map(toast => h('li', { 'data-color': toast.color ?? undefined, 'data-persistent': toast.persistent || undefined, 'data-status': toast.status, key: toast.id }, [
        h('article', { 'aria-labelledby': `${toast.id}-toast-title`, class: 'hp-notification-toast', 'data-slot': 'notification-toast' }, [
          h('span', { 'aria-hidden': 'true', class: 'hp-notification-toast-accent', 'data-color': toast.color ?? undefined, 'data-slot': 'notification-toast-accent' }),
          toast.icon ? h('span', { 'aria-hidden': 'true', class: 'hp-notification-toast-icon', 'data-icon': toast.icon, 'data-slot': 'notification-toast-icon' }) : null,
          h('div', { class: 'hp-notification-toast-content', 'data-slot': 'notification-toast-content' }, [
            h('h2', { class: 'hp-notification-toast-title', id: `${toast.id}-toast-title` }, toast.title),
            toast.body ? h('p', { class: 'hp-notification-toast-body' }, toast.body) : null,
          ]),
          h('div', { 'aria-label': `${toast.title} actions`, class: 'hp-notification-toast-actions', 'data-slot': 'notification-toast-actions', role: 'group' }, toast.actions.map(actionValue).filter(action => action !== null).map(action => toastAction(action, toast, props))),
          toast.closeable ? h(ShadcnButton, { 'aria-label': `Close ${toast.title}`, class: 'hp-notification-toast-close', onClick: () => props.store.dismiss(toast.id), type: 'button' }, '×') : null,
        ]),
      ]))),
    ])
  },
})

function notificationActions(item: VueDatabaseNotification, controls: VueNotificationControls, navigate?: (url: string) => void): VNode {
  const actions = item.presentation.actions.map(actionValue).filter(action => action !== null).map(action => {
    const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
    if (url) return h('a', { href: url, key: action.id, onClick: navigate ? (event: Event) => { event.preventDefault(); navigate(url) } : undefined }, action.label)
    if (action.kind === 'mark-read') return h(ShadcnButton, { key: action.id, onClick: () => ignoreFailure(controls.markRead()), type: 'button' }, action.label)
    if (action.kind === 'mark-unread') return h(ShadcnButton, { key: action.id, onClick: () => ignoreFailure(controls.markUnread()), type: 'button' }, action.label)
    return h(ShadcnButton, { key: action.id, onClick: () => ignoreFailure(controls.delete()), type: 'button' }, action.label)
  })
  return h('div', { 'aria-label': `${item.presentation.title} actions`, class: 'hp-notification-actions', 'data-slot': 'notification-actions', role: 'group' }, [
    ...actions,
    item.read
      ? h(ShadcnButton, { onClick: () => ignoreFailure(controls.markUnread()), type: 'button' }, 'Mark unread')
      : h(ShadcnButton, { onClick: () => ignoreFailure(controls.markRead()), type: 'button' }, 'Mark read'),
    h(ShadcnButton, { onClick: () => ignoreFailure(controls.delete()), type: 'button' }, 'Delete'),
  ])
}

function defaultNotification(item: VueDatabaseNotification, controls: VueNotificationControls, navigate?: (url: string) => void): VNode {
  return h('article', { 'aria-labelledby': `${item.id}-notification-title`, class: 'hp-notification-item-content', 'data-slot': 'notification-item-content' }, [
    item.presentation.icon ? h('span', { 'aria-hidden': 'true', class: 'hp-notification-item-icon', 'data-icon': item.presentation.icon, 'data-slot': 'notification-item-icon' }) : null,
    h('div', { class: 'hp-notification-item-copy' }, [
      h('h3', { class: 'hp-notification-item-title', 'data-slot': 'notification-item-title', id: `${item.id}-notification-title` }, item.presentation.title),
      item.presentation.body ? h('p', { class: 'hp-notification-item-body', 'data-slot': 'notification-item-body' }, item.presentation.body) : null,
      h('time', { class: 'hp-notification-item-time', 'data-slot': 'notification-item-time', datetime: item.createdAt }, item.createdAt),
    ]),
    notificationActions(item, controls, navigate),
  ])
}

export const VueNotificationInbox = defineComponent({
  name: 'HoloPanelsNotificationInbox',
  props: {
    emptyMessage: { default: 'No notifications', type: String },
    navigate: Function as PropType<VueNotificationInboxProps['navigate']>,
    panelId: String,
    placement: { default: 'page', type: String as PropType<NonNullable<VueNotificationInboxProps['placement']>> },
    registry: Object as PropType<VueNotificationInboxProps['registry']>,
    store: { required: true, type: Object as PropType<VueNotificationInboxProps['store']> },
  },
  setup(props) {
    const state = shallowRef(props.store.state)
    const unsubscribe = props.store.subscribe(next => { state.value = next })
    onMounted(() => ignoreFailure(props.store.start()))
    onUnmounted(() => { unsubscribe(); props.store.dispose() })
    return (): VNode => {
      const pages = Math.max(1, Math.ceil(state.value.total / state.value.pageSize))
      const items: VNodeChild[] = state.value.items.map(item => {
        const controls: VueNotificationControls = {
          delete: () => props.store.delete([item.id]),
          markRead: () => props.store.markRead([item.id]),
          markUnread: () => props.store.markUnread([item.id]),
        }
        const rendererName = vueNotificationRendererName(item.type)
        const Custom = props.registry?.has(rendererName, props.panelId)
          ? props.registry.resolve(rendererName, props.panelId, `notification "${item.id}"`)
          : null
        const content = Custom ? h(Custom, { controls, notification: item } satisfies VueCustomNotificationProps) : defaultNotification(item, controls, props.navigate)
        return h('li', { class: 'hp-notification-item', 'data-color': item.presentation.color ?? undefined, 'data-notification': item.id, 'data-read': item.read, 'data-slot': 'notification-item', key: item.id }, [content])
      })
      return h('section', { 'aria-busy': state.value.loading, 'aria-label': 'Notification inbox', class: 'hp-notification-inbox', 'data-placement': props.placement }, [
        h('header', { class: 'hp-notification-inbox-header', 'data-slot': 'notification-inbox-header' }, [
          h('h2', { class: 'hp-notification-inbox-title', 'data-slot': 'notification-inbox-title' }, 'Notifications'),
          state.value.unread > 0 ? h('span', { 'aria-label': `${state.value.unread} unread`, class: 'hp-notification-inbox-count hp-notification-unread-badge', 'data-slot': 'notification-inbox-count' }, state.value.unread) : null,
          h(ShadcnButton, { class: 'hp-notification-mark-all', disabled: state.value.unread === 0, onClick: () => ignoreFailure(props.store.markAllRead()), type: 'button' }, 'Mark all read'),
        ]),
        state.value.error ? h('p', { class: 'hp-notification-error', 'data-slot': 'notification-error', role: 'alert' }, state.value.error) : null,
        state.value.loading ? h('p', { 'aria-live': 'polite', class: 'hp-notification-loading', 'data-slot': 'notification-loading', role: 'status' }, 'Loading notifications') : null,
        !state.value.loading && items.length === 0 ? h('p', { class: 'hp-notification-empty', 'data-slot': 'notification-empty', role: 'status' }, props.emptyMessage) : null,
        items.length > 0 ? h('ol', { class: 'hp-notification-list', 'data-slot': 'notification-list' }, items) : null,
        pages > 1 ? h('nav', { 'aria-label': 'Notification pagination', class: 'hp-notification-pagination', 'data-slot': 'notification-pagination' }, [
          h(ShadcnButton, { 'aria-label': 'Previous notification page', disabled: state.value.page <= 1, onClick: () => ignoreFailure(props.store.load(state.value.page - 1)), type: 'button' }, 'Previous'),
          h('span', `Page ${state.value.page} of ${pages}`),
          h(ShadcnButton, { 'aria-label': 'Next notification page', disabled: state.value.page >= pages, onClick: () => ignoreFailure(props.store.load(state.value.page + 1)), type: 'button' }, 'Next'),
        ]) : null,
      ])
    }
  },
})
