import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { safeExternalUrl, type ClientToast, type ClientToastStore } from '@holo-js/panels-client'
import { toast as sonnerToast } from 'sonner'
import { panelColorValue } from '@holo-js/panels-ui'
import { PanelsIcon } from '../internal-ui'
import { ReactActionRenderer } from '../actions'
import {
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
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Pagination,
  PaginationContent,
  PaginationItem,
  ScrollArea,
  Separator,
  Toaster,
} from '../ui'
import type {
  ReactCustomNotificationProps,
  ReactDatabaseNotification,
  ReactNotificationControls,
  ReactNotificationInboxProps,
  ReactToastViewportProps,
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

export function reactNotificationRendererName(type: string): string {
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

function ToastAction({ action, navigate, store, toast }: {
  readonly action: NotificationAction
  readonly navigate?: (url: string) => void
  readonly store: ClientToastStore
  readonly toast: ClientToast
}): ReactNode {
  const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
  if (url) return <Button asChild size="sm" variant="outline"><a href={url} onClick={event => {
    ignoreFailure(store.trigger(toast.id, action.id))
    if (navigate) {
      event.preventDefault()
      navigate(url)
    }
  }}><PanelsIcon name={notificationActionIcon(action.kind)} />{action.label}</a></Button>
  return <Button onClick={() => ignoreFailure(store.trigger(toast.id, action.id))} size="sm" type="button" variant={action.kind === 'dismiss' ? 'destructive' : 'outline'}><PanelsIcon name={notificationActionIcon(action.kind)} />{action.label}</Button>
}

function ToastContent({ navigate, panelId, registry, store, toast }: {
  readonly panelId?: ReactToastViewportProps['panelId']
  readonly registry?: ReactToastViewportProps['registry']
  readonly navigate?: (url: string) => void
  readonly store: ClientToastStore
  readonly toast: ClientToast
}): ReactNode {
  const actions = toast.actions.map(actionValue).filter(action => action !== null)
  const host = store.actionHost(toast.id)
  return <Card className="hp-notification-toast hp:relative hp:w-full hp:border-0 hp:shadow-none" data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status} data-slot="notification-toast" style={{ borderInlineStartColor: panelColorValue(toast.color ?? toast.status), borderInlineStartStyle: 'solid', borderInlineStartWidth: '3px' }}>
    <CardHeader className="hp:gap-1 hp:pr-10">
      <CardTitle className="hp:flex hp:items-center hp:gap-2 hp:text-sm">{toast.icon ? <span data-slot="notification-icon" style={{ color: panelColorValue(toast.iconColor ?? toast.color ?? toast.status) }}><PanelsIcon name={toast.icon} /></span> : null}{toast.title}</CardTitle>
      {toast.body ? <CardDescription>{toast.body}</CardDescription> : null}
    </CardHeader>
    {actions.length > 0 ? <CardContent className="hp:flex hp:flex-wrap hp:gap-2">{actions.map(action => <ToastAction action={action} key={action.id} navigate={navigate} store={store} toast={toast} />)}</CardContent> : null}
    {host?.actions[0] ? <CardContent><ReactActionRenderer actions={host.actions} manifest={host.actions[0]} panelId={panelId} registry={registry} store={host.store} /></CardContent> : null}
    {toast.closeable ? <Button aria-label={`Close ${toast.title}`} className="hp:absolute hp:right-2 hp:top-2" onClick={() => store.dismiss(toast.id)} size="icon-sm" type="button" variant="ghost"><PanelsIcon name="x" /></Button> : null}
  </Card>
}

function toastFingerprint(value: ClientToast): string {
  return JSON.stringify(value)
}

export function ReactToastViewport({ navigate, panelId, placement = 'top', registry, store }: ReactToastViewportProps): ReactNode {
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )
  const rendered = useRef(new Map<string, string>())

  useEffect(() => {
    const owned = rendered.current
    return () => {
      for (const id of owned.keys()) sonnerToast.dismiss(id)
      owned.clear()
    }
  }, [store])

  useEffect(() => {
    const activeIds = new Set(state.items.map(item => item.id))
    for (const id of rendered.current.keys()) {
      if (activeIds.has(id)) continue
      sonnerToast.dismiss(id)
      rendered.current.delete(id)
    }
    for (const item of state.items) {
      const fingerprint = toastFingerprint(item)
      if (rendered.current.get(item.id) === fingerprint) continue
      sonnerToast.custom(() => <ToastContent navigate={navigate} panelId={panelId} registry={registry} store={store} toast={item} />, {
        duration: Infinity,
        id: item.id,
        onDismiss: () => store.dismiss(item.id),
        onAutoClose: () => store.dismiss(item.id),
      })
      rendered.current.set(item.id, fingerprint)
    }
  }, [navigate, panelId, registry, state.items, store])

  return <><div aria-atomic="true" aria-live="polite" className="hp:sr-only" role="status">{state.liveMessage}</div><Toaster closeButton={false} position={placement === 'top' ? 'top-center' : 'bottom-center'} /></>
}

function DeleteNotificationButton({ controls, label = 'Delete' }: { readonly controls: ReactNotificationControls, readonly label?: string }): ReactNode {
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button size="sm" type="button" variant="destructive"><PanelsIcon name="trash" />{label}</Button></AlertDialogTrigger>
    <AlertDialogContent data-holo-panel>
      <AlertDialogHeader><AlertDialogTitle>Delete notification?</AlertDialogTitle><AlertDialogDescription>This notification will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => ignoreFailure(controls.delete())} variant="destructive"><PanelsIcon name="trash" />Delete</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

function NotificationActions({ controls, item, navigate, panelId, registry, store }: {
  readonly controls: ReactNotificationControls
  readonly item: ReactDatabaseNotification
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly registry?: ReactNotificationInboxProps['registry']
  readonly store: ReactNotificationInboxProps['store']
}): ReactNode {
  const actions = item.presentation.actions.map(actionValue).filter(action => action !== null)
  const host = store.actionHost(item.id)
  return <div aria-label={`${item.presentation.title} actions`} className="hp-notification-actions hp:flex hp:flex-wrap hp:gap-2" data-slot="notification-actions" role="group">
    {host?.actions[0] ? <ReactActionRenderer actions={host.actions} manifest={host.actions[0]} panelId={panelId} registry={registry} store={host.store} /> : null}
    {actions.map(action => {
      const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
      if (url) return <Button asChild key={action.id} size="sm" variant="outline"><a href={url} onClick={navigate ? event => { event.preventDefault(); navigate(url) } : undefined}><PanelsIcon name={notificationActionIcon(action.kind)} />{action.label}</a></Button>
      if (action.kind === 'mark-read') return <Button key={action.id} onClick={() => ignoreFailure(controls.markRead())} size="sm" type="button" variant="outline"><PanelsIcon name="check" />{action.label}</Button>
      if (action.kind === 'mark-unread') return <Button key={action.id} onClick={() => ignoreFailure(controls.markUnread())} size="sm" type="button" variant="outline"><PanelsIcon name="mail" />{action.label}</Button>
      if (action.kind === 'dismiss') return <DeleteNotificationButton controls={controls} key={action.id} label={action.label} />
      return null
    })}
    {item.read
      ? <Button onClick={() => ignoreFailure(controls.markUnread())} size="sm" type="button" variant="outline"><PanelsIcon name="mail" />Mark unread</Button>
      : <Button onClick={() => ignoreFailure(controls.markRead())} size="sm" type="button" variant="outline"><PanelsIcon name="check" />Mark read</Button>}
    {!actions.some(action => action.kind === 'dismiss') ? <DeleteNotificationButton controls={controls} /> : null}
  </div>
}

export function ReactNotificationInbox({
  emptyMessage = 'No notifications',
  navigate,
  panelId,
  placement = 'page',
  registry,
  store,
}: ReactNotificationInboxProps): ReactNode {
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )
  useEffect(() => {
    ignoreFailure(store.start())
    return () => store.stop()
  }, [store])
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize))
  const content = <CardContent className="hp:space-y-4">
    {state.error ? <p className="hp:rounded-md hp:border hp:border-destructive/50 hp:p-3 hp:text-sm hp:text-destructive" data-slot="notification-error" role="alert">{state.error}</p> : null}
    {state.loading ? <p aria-live="polite" className="hp:text-sm hp:text-muted-foreground" data-slot="notification-loading" role="status">Loading notifications</p> : null}
    {!state.loading && !state.error && state.items.length === 0 ? <Empty data-slot="notification-empty"><EmptyHeader><EmptyTitle>{emptyMessage}</EmptyTitle><EmptyDescription>You are all caught up.</EmptyDescription></EmptyHeader></Empty> : null}
    {state.items.length > 0 ? <ol className="hp-notification-list hp:divide-y" data-slot="notification-list">{state.items.map(item => {
      const controls: ReactNotificationControls = {
        delete: () => store.delete([item.id]),
        markRead: () => store.markRead([item.id]),
        markUnread: () => store.markUnread([item.id]),
      }
      const rendererName = reactNotificationRendererName(item.type)
      const Custom = registry?.has(rendererName, panelId)
        ? registry.resolve<ReactCustomNotificationProps>(rendererName, panelId, `notification "${item.id}"`)
        : null
      return <li className="hp-notification-item hp:py-4 hp:ps-3 hp:first:pt-0 hp:last:pb-0" data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read} data-slot="notification-item" key={item.id} style={{ borderInlineStartColor: panelColorValue(item.presentation.color ?? item.presentation.status), borderInlineStartStyle: 'solid', borderInlineStartWidth: '3px' }}>
        {Custom ? <Custom controls={controls} notification={item} /> : <article aria-labelledby={`${item.id}-notification-title`} className="hp:space-y-3" data-slot="notification-item-content">
          <div className="hp:flex hp:items-start hp:gap-3">
            {item.presentation.icon ? <span className="hp:mt-0.5" data-slot="notification-icon" style={{ color: panelColorValue(item.presentation.iconColor ?? item.presentation.color ?? item.presentation.status) }}><PanelsIcon name={item.presentation.icon} /></span> : null}
            <div className="hp:min-w-0 hp:flex-1 hp:space-y-1">
              <h3 className="hp:text-sm hp:font-medium" data-slot="notification-item-title" id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
              {item.presentation.body ? <p className="hp:text-sm hp:text-muted-foreground" data-slot="notification-item-body">{item.presentation.body}</p> : null}
              <time className="hp:text-xs hp:text-muted-foreground" data-slot="notification-item-time" dateTime={item.createdAt}>{item.createdAt}</time>
            </div>
            {!item.read ? <Badge variant="secondary">Unread</Badge> : null}
          </div>
          <NotificationActions controls={controls} item={item} navigate={navigate} panelId={panelId} registry={registry} store={store} />
        </article>}
      </li>
    })}</ol> : null}
    {pages > 1 ? <><Separator /><Pagination aria-label="Notification pagination" data-slot="notification-pagination"><PaginationContent>
      <PaginationItem><Button aria-label="Previous notification page" disabled={state.page <= 1} onClick={() => ignoreFailure(store.load(state.page - 1))} size="sm" type="button" variant="outline"><PanelsIcon name="chevron-left" />Previous</Button></PaginationItem>
      <PaginationItem><span className="hp:px-2 hp:text-sm hp:text-muted-foreground">Page {state.page} of {pages}</span></PaginationItem>
      <PaginationItem><Button aria-label="Next notification page" disabled={state.page >= pages} onClick={() => ignoreFailure(store.load(state.page + 1))} size="sm" type="button" variant="outline">Next<PanelsIcon name="chevron-right" /></Button></PaginationItem>
    </PaginationContent></Pagination></> : null}
  </CardContent>
  return <Card aria-busy={state.loading} aria-label="Notification inbox" className={`hp-notification-inbox hp:w-full ${placement === 'page' ? '' : 'hp:rounded-none hp:border-0 hp:shadow-none'}`} data-placement={placement}>
    <CardHeader className="hp:flex-row hp:items-center hp:gap-3 hp:space-y-0" data-slot="notification-inbox-header">
      <CardTitle className="hp:flex-1" data-slot="notification-inbox-title">Notifications</CardTitle>
      {state.unread > 0 ? <Badge aria-label={`${state.unread} unread`} className="hp-notification-inbox-count" data-slot="notification-inbox-count" variant="secondary">{state.unread}</Badge> : null}
      <Button disabled={state.unread === 0} onClick={() => ignoreFailure(store.markAllRead())} size="sm" type="button" variant="outline"><PanelsIcon name="check-check" />Mark all read</Button>
    </CardHeader>
    {placement === 'page' ? content : <ScrollArea className="hp:max-h-[min(36rem,calc(100vh-8rem))]">{content}</ScrollArea>}
  </Card>
}
