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
      h('ol', { 'aria-label': 'Notification queue' }, state.value.items.map(toast => h('li', { 'data-color': toast.color ?? undefined, 'data-persistent': toast.persistent || undefined, 'data-status': toast.status, key: toast.id }, [
        h('article', { 'aria-labelledby': `${toast.id}-toast-title` }, [
          toast.icon ? h('span', { 'aria-hidden': 'true', 'data-icon': toast.icon }) : null,
          h('h2', { id: `${toast.id}-toast-title` }, toast.title),
          toast.body ? h('p', toast.body) : null,
          h('div', toast.actions.map(actionValue).filter(action => action !== null).map(action => toastAction(action, toast, props))),
          toast.closeable ? h(ShadcnButton, { 'aria-label': `Close ${toast.title}`, onClick: () => props.store.dismiss(toast.id), type: 'button' }, '×') : null,
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
  return h('div', { class: 'hp-notification-actions' }, [
    ...actions,
    item.read
      ? h(ShadcnButton, { onClick: () => ignoreFailure(controls.markUnread()), type: 'button' }, 'Mark unread')
      : h(ShadcnButton, { onClick: () => ignoreFailure(controls.markRead()), type: 'button' }, 'Mark read'),
    h(ShadcnButton, { onClick: () => ignoreFailure(controls.delete()), type: 'button' }, 'Delete'),
  ])
}

function defaultNotification(item: VueDatabaseNotification, controls: VueNotificationControls, navigate?: (url: string) => void): VNode {
  return h('article', { 'aria-labelledby': `${item.id}-notification-title` }, [
    item.presentation.icon ? h('span', { 'aria-hidden': 'true', 'data-icon': item.presentation.icon }) : null,
    h('h3', { id: `${item.id}-notification-title` }, item.presentation.title),
    item.presentation.body ? h('p', item.presentation.body) : null,
    h('time', { datetime: item.createdAt }, item.createdAt),
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
        return h('li', { 'data-color': item.presentation.color ?? undefined, 'data-notification': item.id, 'data-read': item.read, key: item.id }, [content])
      })
      return h('section', { 'aria-busy': state.value.loading, 'aria-label': 'Notification inbox', class: 'hp-notification-inbox', 'data-placement': props.placement }, [
        h('header', [h('h2', 'Notifications'), h('span', { 'aria-label': `${state.value.unread} unread` }, state.value.unread), h(ShadcnButton, { disabled: state.value.unread === 0, onClick: () => ignoreFailure(props.store.markAllRead()), type: 'button' }, 'Mark all read')]),
        state.value.error ? h('p', { role: 'alert' }, state.value.error) : null,
        state.value.loading ? h('p', { 'aria-live': 'polite', role: 'status' }, 'Loading notifications') : null,
        !state.value.loading && items.length === 0 ? h('p', props.emptyMessage) : null,
        h('ol', items),
        h('nav', { 'aria-label': 'Notification pagination' }, [
          h(ShadcnButton, { 'aria-label': 'Previous notification page', disabled: state.value.page <= 1, onClick: () => ignoreFailure(props.store.load(state.value.page - 1)), type: 'button' }, 'Previous'),
          h('span', `Page ${state.value.page} of ${pages}`),
          h(ShadcnButton, { 'aria-label': 'Next notification page', disabled: state.value.page >= pages, onClick: () => ignoreFailure(props.store.load(state.value.page + 1)), type: 'button' }, 'Next'),
        ]),
      ])
    }
  },
})
