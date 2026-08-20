import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { safeExternalUrl, type ClientToast, type ClientToastStore } from '@holo-js/panels-client'
import { ShadcnButton } from '../internal-ui'
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

function ToastAction({ action, navigate, store, toast }: {
  readonly action: NotificationAction
  readonly navigate?: (url: string) => void
  readonly store: ClientToastStore
  readonly toast: ClientToast
}): ReactNode {
  const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
  if (url) return <a href={url} onClick={event => {
    ignoreFailure(store.trigger(toast.id, action.id))
    if (navigate) {
      event.preventDefault()
      navigate(url)
    }
  }}>{action.label}</a>
  return <ShadcnButton onClick={() => ignoreFailure(store.trigger(toast.id, action.id))} type="button">{action.label}</ShadcnButton>
}

export function ReactToastViewport({ navigate, placement = 'top', store }: ReactToastViewportProps): ReactNode {
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )
  return <section aria-label="Notifications" className="hp-notification-toasts" data-placement={placement}>
    <div aria-atomic="true" aria-live="polite" className="hp-visually-hidden" role="status">{state.liveMessage}</div>
    <ol aria-label="Notification queue" className="hp-notification-toast-list" data-slot="notification-toast-list">
      {state.items.map(toast => <li data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status} key={toast.id}>
        <article aria-labelledby={`${toast.id}-toast-title`} className="hp-notification-toast" data-slot="notification-toast">
          <span aria-hidden="true" className="hp-notification-toast-accent" data-color={toast.color ?? undefined} data-slot="notification-toast-accent" />
          {toast.icon ? <span aria-hidden="true" className="hp-notification-toast-icon" data-icon={toast.icon} data-slot="notification-toast-icon" /> : null}
          <div className="hp-notification-toast-content" data-slot="notification-toast-content">
            <h2 className="hp-notification-toast-title" id={`${toast.id}-toast-title`}>{toast.title}</h2>
            {toast.body ? <p className="hp-notification-toast-body">{toast.body}</p> : null}
          </div>
          <div aria-label={`${toast.title} actions`} className="hp-notification-toast-actions" data-slot="notification-toast-actions" role="group">{toast.actions.map(actionValue).filter(action => action !== null).map(action => <ToastAction action={action} key={action.id} navigate={navigate} store={store} toast={toast} />)}</div>
          {toast.closeable ? <ShadcnButton aria-label={`Close ${toast.title}`} className="hp-notification-toast-close" onClick={() => store.dismiss(toast.id)} type="button">×</ShadcnButton> : null}
        </article>
      </li>)}
    </ol>
  </section>
}

function NotificationActions({ controls, item, navigate }: {
  readonly controls: ReactNotificationControls
  readonly item: ReactDatabaseNotification
  readonly navigate?: (url: string) => void
}): ReactNode {
  const actions = item.presentation.actions.map(actionValue).filter(action => action !== null)
  return <div aria-label={`${item.presentation.title} actions`} className="hp-notification-actions" data-slot="notification-actions" role="group">
    {actions.map(action => {
      const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
      if (url) return <a href={url} key={action.id} onClick={navigate ? event => { event.preventDefault(); navigate(url) } : undefined}>{action.label}</a>
      if (action.kind === 'mark-read') return <ShadcnButton key={action.id} onClick={() => ignoreFailure(controls.markRead())} type="button">{action.label}</ShadcnButton>
      if (action.kind === 'mark-unread') return <ShadcnButton key={action.id} onClick={() => ignoreFailure(controls.markUnread())} type="button">{action.label}</ShadcnButton>
      if (action.kind === 'dismiss') return <ShadcnButton key={action.id} onClick={() => ignoreFailure(controls.delete())} type="button">{action.label}</ShadcnButton>
      return null
    })}
    {item.read
      ? <ShadcnButton onClick={() => ignoreFailure(controls.markUnread())} type="button">Mark unread</ShadcnButton>
      : <ShadcnButton onClick={() => ignoreFailure(controls.markRead())} type="button">Mark read</ShadcnButton>}
    <ShadcnButton onClick={() => ignoreFailure(controls.delete())} type="button">Delete</ShadcnButton>
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
  return <section aria-busy={state.loading} aria-label="Notification inbox" className="hp-notification-inbox" data-placement={placement}>
    <header className="hp-notification-inbox-header" data-slot="notification-inbox-header">
      <h2 className="hp-notification-inbox-title" data-slot="notification-inbox-title">Notifications</h2>
      {state.unread > 0 ? <span aria-label={`${state.unread} unread`} className="hp-notification-inbox-count hp-notification-unread-badge" data-slot="notification-inbox-count">{state.unread}</span> : null}
      <ShadcnButton className="hp-notification-mark-all" disabled={state.unread === 0} onClick={() => ignoreFailure(store.markAllRead())} type="button">Mark all read</ShadcnButton>
    </header>
    {state.error ? <p className="hp-notification-error" data-slot="notification-error" role="alert">{state.error}</p> : null}
    {state.loading ? <p aria-live="polite" className="hp-notification-loading" data-slot="notification-loading" role="status">Loading notifications</p> : null}
    {!state.loading && state.items.length === 0 ? <p className="hp-notification-empty" data-slot="notification-empty" role="status">{emptyMessage}</p> : null}
    {state.items.length > 0 ? <ol className="hp-notification-list" data-slot="notification-list">{state.items.map(item => {
      const controls: ReactNotificationControls = {
        delete: () => store.delete([item.id]),
        markRead: () => store.markRead([item.id]),
        markUnread: () => store.markUnread([item.id]),
      }
      const rendererName = reactNotificationRendererName(item.type)
      const Custom = registry?.has(rendererName, panelId)
        ? registry.resolve<ReactCustomNotificationProps>(rendererName, panelId, `notification "${item.id}"`)
        : null
      return <li className="hp-notification-item" data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read} data-slot="notification-item" key={item.id}>
        {Custom ? <Custom controls={controls} notification={item} /> : <article aria-labelledby={`${item.id}-notification-title`} className="hp-notification-item-content" data-slot="notification-item-content">
          {item.presentation.icon ? <span aria-hidden="true" className="hp-notification-item-icon" data-icon={item.presentation.icon} data-slot="notification-item-icon" /> : null}
          <div className="hp-notification-item-copy">
            <h3 className="hp-notification-item-title" data-slot="notification-item-title" id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
            {item.presentation.body ? <p className="hp-notification-item-body" data-slot="notification-item-body">{item.presentation.body}</p> : null}
            <time className="hp-notification-item-time" data-slot="notification-item-time" dateTime={item.createdAt}>{item.createdAt}</time>
          </div>
          <NotificationActions controls={controls} item={item} navigate={navigate} />
        </article>}
      </li>
    })}</ol> : null}
    {pages > 1 ? <nav aria-label="Notification pagination" className="hp-notification-pagination" data-slot="notification-pagination">
      <ShadcnButton aria-label="Previous notification page" disabled={state.page <= 1} onClick={() => ignoreFailure(store.load(state.page - 1))} type="button">Previous</ShadcnButton>
      <span>Page {state.page} of {pages}</span>
      <ShadcnButton aria-label="Next notification page" disabled={state.page >= pages} onClick={() => ignoreFailure(store.load(state.page + 1))} type="button">Next</ShadcnButton>
    </nav> : null}
  </section>
}
