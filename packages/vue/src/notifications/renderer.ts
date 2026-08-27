import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  PanelsIcon,
  Toaster,
} from '../internal-ui'
import { safeExternalUrl, type ClientToast } from '@holo-js/panels-client'
import { VueActionRenderer } from '../actions'
import { toast as sonnerToast } from 'vue-sonner'
import { panelColorValue } from '@holo-js/panels-ui'
import { defineComponent, Fragment, h, onMounted, onUnmounted, shallowRef, toRaw, type PropType, type VNode, type VNodeChild } from 'vue'
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

function notificationActionIcon(kind: NotificationAction['kind']): string {
  if (kind === 'navigate') return 'arrow-right'
  if (kind === 'mark-read') return 'check'
  if (kind === 'mark-unread') return 'mail'
  return 'trash'
}

const VueToastContent = defineComponent({
  name: 'HoloPanelsToastContent',
  props: {
    navigate: Function as PropType<VueToastViewportProps['navigate']>,
    panelId: String,
    registry: Object as PropType<VueToastViewportProps['registry']>,
    store: { required: true, type: Object as PropType<VueToastViewportProps['store']> },
    toast: { required: true, type: Object as PropType<ClientToast> },
  },
  setup(props) {
    const store = toRaw(props.store)
    return (): VNode => {
      const actions = props.toast.actions.map(actionValue).filter(action => action !== null)
      const host = store.actionHost(props.toast.id)
      const renderAction = (action: NotificationAction): VNode => {
        const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
        if (url) {
          return h(Button, {
            as: 'a',
            href: url,
            key: action.id,
            onClick: (event: Event) => {
              ignoreFailure(store.trigger(props.toast.id, action.id))
              if (!props.navigate) return
              event.preventDefault()
              props.navigate(url)
            },
            size: 'sm',
            variant: 'outline',
          }, () => [PanelsIcon(notificationActionIcon(action.kind)), action.label])
        }
        return h(Button, {
          key: action.id,
          onClick: () => ignoreFailure(store.trigger(props.toast.id, action.id)),
          size: 'sm',
          type: 'button',
          variant: action.kind === 'dismiss' ? 'destructive' : 'outline',
        }, () => [PanelsIcon(notificationActionIcon(action.kind)), action.label])
      }
      return h(Card, {
        class: 'hp-notification-toast hp:relative hp:w-full hp:border-0 hp:shadow-none',
        'data-color': props.toast.color ?? undefined,
        'data-persistent': props.toast.persistent || undefined,
        'data-slot': 'notification-toast',
        'data-status': props.toast.status,
        style: { borderInlineStartColor: panelColorValue(props.toast.color ?? props.toast.status), borderInlineStartStyle: 'solid', borderInlineStartWidth: '3px' },
      }, () => [
        h(CardHeader, { class: 'hp:gap-1 hp:pr-10' }, () => [
          h(CardTitle, { class: 'hp:flex hp:items-center hp:gap-2 hp:text-sm' }, () => [props.toast.icon ? h('span', { 'data-slot': 'notification-icon', style: { color: panelColorValue(props.toast.iconColor ?? props.toast.color ?? props.toast.status) } }, [PanelsIcon(props.toast.icon)]) : null, props.toast.title]),
          props.toast.body ? h(CardDescription, {}, () => props.toast.body) : null,
        ]),
        actions.length > 0 ? h(CardContent, { class: 'hp:flex hp:flex-wrap hp:gap-2' }, () => actions.map(renderAction)) : null,
        host?.actions[0] ? h(CardContent, {}, () => h(VueActionRenderer, { action: host.actions[0]!, actions: host.actions, panelId: props.panelId, registry: props.registry, store: host.store })) : null,
        props.toast.closeable ? h(Button, { 'aria-label': `Close ${props.toast.title}`, class: 'hp:absolute hp:right-2 hp:top-2', onClick: () => store.dismiss(props.toast.id), size: 'icon-sm', type: 'button', variant: 'ghost' }, () => PanelsIcon('x')) : null,
      ])
    }
  },
})

export const VueToastViewport = defineComponent({
  name: 'HoloPanelsToastViewport',
  props: {
    navigate: Function as PropType<VueToastViewportProps['navigate']>,
    panelId: String,
    registry: Object as PropType<VueToastViewportProps['registry']>,
    placement: { default: 'top', type: String as PropType<NonNullable<VueToastViewportProps['placement']>> },
    store: { required: true, type: Object as PropType<VueToastViewportProps['store']> },
  },
  setup(props) {
    const state = shallowRef(props.store.state)
    const rendered = new Map<string, string>()
    const sync = (items: readonly ClientToast[]): void => {
      const nextIds = new Set(items.map(item => item.id))
      for (const id of rendered.keys()) {
        if (!nextIds.has(id)) {
          sonnerToast.dismiss(id)
          rendered.delete(id)
        }
      }
      for (const item of items) {
        const fingerprint = JSON.stringify(item)
        if (rendered.get(item.id) === fingerprint) continue
        sonnerToast.custom(VueToastContent, {
          componentProps: { navigate: props.navigate, panelId: props.panelId, registry: props.registry, store: props.store, toast: item },
          duration: Number.POSITIVE_INFINITY,
          id: item.id,
          onAutoClose: () => props.store.dismiss(item.id),
          onDismiss: () => props.store.dismiss(item.id),
        })
        rendered.set(item.id, fingerprint)
      }
    }
    const unsubscribe = props.store.subscribe(next => {
      state.value = next
      sync(next.items)
    })
    onMounted(() => sync(props.store.state.items))
    onUnmounted(() => {
      unsubscribe()
      for (const id of rendered.keys()) sonnerToast.dismiss(id)
    })
    const position = props.placement === 'top' ? 'top-center' : 'bottom-center'
    return (): VNode => h(Fragment, {}, [
      h('div', { 'aria-atomic': 'true', 'aria-live': 'polite', class: 'hp:sr-only', role: 'status' }, state.value.liveMessage),
      h(Toaster, { closeButton: false, position }),
    ])
  },
})

function notificationActions(item: VueDatabaseNotification, controls: VueNotificationControls, props: Pick<VueNotificationInboxProps, 'navigate' | 'panelId' | 'registry' | 'store'>): VNode {
  const { navigate } = props
  const host = props.store.actionHost(item.id)
  const actions = item.presentation.actions.map(actionValue).filter(action => action !== null).map(action => {
    const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
    if (url) return h('a', { href: url, key: action.id, onClick: navigate ? (event: Event) => { event.preventDefault(); navigate(url) } : undefined }, action.label)
    if (action.kind === 'mark-read') return h(Button, { key: action.id, onClick: () => ignoreFailure(controls.markRead()), type: 'button' }, action.label)
    if (action.kind === 'mark-unread') return h(Button, { key: action.id, onClick: () => ignoreFailure(controls.markUnread()), type: 'button' }, action.label)
    return deleteNotificationAction(action.label, controls.delete, action.id)
  })
  return h('div', { 'aria-label': `${item.presentation.title} actions`, class: 'hp-notification-actions', 'data-slot': 'notification-actions', role: 'group' }, [
    ...(host?.actions[0] ? [h(VueActionRenderer, { action: host.actions[0], actions: host.actions, panelId: props.panelId, registry: props.registry, store: host.store })] : []),
    ...actions,
    item.read
      ? h(Button, { onClick: () => ignoreFailure(controls.markUnread()), type: 'button' }, 'Mark unread')
      : h(Button, { onClick: () => ignoreFailure(controls.markRead()), type: 'button' }, 'Mark read'),
    ...(item.presentation.actions.some(action => actionValue(action)?.kind === 'dismiss') ? [] : [deleteNotificationAction('Delete', controls.delete, `${item.id}-delete`)]),
  ])
}

function deleteNotificationAction(label: string, operation: () => Promise<unknown>, key: string): VNode {
  return h(AlertDialog, { key }, () => [
    h(AlertDialogTrigger, { asChild: true }, () => h(Button, { type: 'button', variant: 'destructive' }, () => [PanelsIcon('trash'), label])),
    h(AlertDialogContent, {}, () => [
      h(AlertDialogHeader, {}, () => [
        h(AlertDialogTitle, {}, () => 'Delete notification?'),
        h(AlertDialogDescription, {}, () => 'This action cannot be undone.'),
      ]),
      h(AlertDialogFooter, {}, () => [
        h(AlertDialogCancel, {}, () => 'Cancel'),
        h(AlertDialogAction, { onClick: () => ignoreFailure(operation()), variant: 'destructive' }, () => [PanelsIcon('trash'), 'Delete']),
      ]),
    ]),
  ])
}

function defaultNotification(item: VueDatabaseNotification, controls: VueNotificationControls, props: Pick<VueNotificationInboxProps, 'navigate' | 'panelId' | 'registry' | 'store'>): VNode {
  return h(Card, { 'aria-labelledby': `${item.id}-notification-title`, class: 'hp-notification-item-content' }, () => [
    h(CardHeader, {}, () => [
      h(CardTitle, { id: `${item.id}-notification-title` }, () => [item.presentation.icon ? h('span', { 'data-slot': 'notification-icon', style: { color: panelColorValue(item.presentation.iconColor ?? item.presentation.color ?? item.presentation.status) } }, [PanelsIcon(item.presentation.icon)]) : null, item.presentation.title]),
      item.presentation.body ? h(CardDescription, {}, () => item.presentation.body) : null,
      h(CardDescription, {}, () => h('time', { class: 'hp-notification-item-time', datetime: item.createdAt }, item.createdAt)),
    ]),
    h(CardFooter, {}, () => notificationActions(item, controls, props)),
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
        const content = Custom ? h(Custom, { controls, notification: item } satisfies VueCustomNotificationProps) : defaultNotification(item, controls, props)
        return h('li', { class: 'hp-notification-item hp:ps-3', 'data-color': item.presentation.color ?? undefined, 'data-notification': item.id, 'data-read': item.read, 'data-slot': 'notification-item', key: item.id, style: { borderInlineStartColor: panelColorValue(item.presentation.color ?? item.presentation.status), borderInlineStartStyle: 'solid', borderInlineStartWidth: '3px' } }, [content])
      })
      return h(Card, { 'aria-busy': state.value.loading, 'aria-label': 'Notification inbox', class: ['hp-notification-inbox hp:w-full', props.placement === 'page' ? null : 'hp:rounded-none hp:border-0 hp:shadow-none'], 'data-placement': props.placement }, () => [
        h(CardHeader, { class: 'hp-notification-inbox-header' }, () => [
          h(CardTitle, {}, () => ['Notifications', state.value.unread > 0 ? h(Badge, { 'aria-label': `${state.value.unread} unread`, class: 'hp-notification-inbox-count', variant: 'secondary' }, () => `${state.value.unread} unread`) : null]),
          h(Button, { disabled: state.value.unread === 0, onClick: () => ignoreFailure(props.store.markAllRead()), size: 'sm', type: 'button', variant: 'outline' }, () => [PanelsIcon('check-check'), 'Mark all read']),
        ]),
        h(CardContent, { class: props.placement === 'page' ? null : 'hp:max-h-[min(36rem,calc(100vh-8rem))] hp:overflow-y-auto' }, () => [
          state.value.error ? h(Alert, { 'data-slot': 'notification-error', variant: 'destructive' }, () => h(AlertDescription, {}, () => state.value.error)) : null,
          state.value.loading ? h('p', { 'aria-live': 'polite', class: 'hp:text-sm hp:text-muted-foreground', 'data-slot': 'notification-loading', role: 'status' }, 'Loading notifications') : null,
          !state.value.loading && !state.value.error && items.length === 0 ? h(Empty, { 'data-slot': 'notification-empty' }, () => h(EmptyHeader, {}, () => [h(EmptyTitle, {}, () => props.emptyMessage), h(EmptyDescription, {}, () => 'You are all caught up.')])) : null,
          items.length > 0 ? h('ol', { class: 'hp:grid hp:gap-3', 'data-slot': 'notification-list' }, items) : null,
        ]),
        pages > 1 ? h(CardFooter, { class: 'hp-notification-pagination' }, () => [
          h(Button, { 'aria-label': 'Previous notification page', disabled: state.value.page <= 1, onClick: () => ignoreFailure(props.store.load(state.value.page - 1)), type: 'button', variant: 'outline' }, () => [PanelsIcon('chevron-left'), 'Previous']),
          h('span', `Page ${state.value.page} of ${pages}`),
          h(Button, { 'aria-label': 'Next notification page', disabled: state.value.page >= pages, onClick: () => ignoreFailure(props.store.load(state.value.page + 1)), type: 'button', variant: 'outline' }, () => ['Next', PanelsIcon('chevron-right')]),
        ]) : null,
      ])
    }
  },
})
