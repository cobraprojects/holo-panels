import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { safeExternalUrl, type ClientToast, type ClientToastStore } from '@holo-js/panels-client'
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
  return <button onClick={() => ignoreFailure(store.trigger(toast.id, action.id))} type="button">{action.label}</button>
}

export function ReactToastViewport({ navigate, placement = 'top', store }: ReactToastViewportProps): ReactNode {
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )
  return <section aria-label="Notifications" className="hp-notification-toasts" data-placement={placement}>
    <div aria-atomic="true" aria-live="polite" className="hp-visually-hidden" role="status">{state.liveMessage}</div>
    <ol aria-label="Notification queue">
      {state.items.map(toast => <li data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status} key={toast.id}>
        <article aria-labelledby={`${toast.id}-toast-title`}>
          {toast.icon ? <span aria-hidden="true" data-icon={toast.icon} /> : null}
          <h2 id={`${toast.id}-toast-title`}>{toast.title}</h2>
          {toast.body ? <p>{toast.body}</p> : null}
          <div>{toast.actions.map(actionValue).filter(action => action !== null).map(action => <ToastAction action={action} key={action.id} navigate={navigate} store={store} toast={toast} />)}</div>
          {toast.closeable ? <button aria-label={`Close ${toast.title}`} onClick={() => store.dismiss(toast.id)} type="button">×</button> : null}
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
  return <div className="hp-notification-actions">
    {actions.map(action => {
      const url = action.kind === 'navigate' ? safeExternalUrl(action.url) : null
      if (url) return <a href={url} key={action.id} onClick={navigate ? event => { event.preventDefault(); navigate(url) } : undefined}>{action.label}</a>
      if (action.kind === 'mark-read') return <button key={action.id} onClick={() => ignoreFailure(controls.markRead())} type="button">{action.label}</button>
      if (action.kind === 'mark-unread') return <button key={action.id} onClick={() => ignoreFailure(controls.markUnread())} type="button">{action.label}</button>
      if (action.kind === 'dismiss') return <button key={action.id} onClick={() => ignoreFailure(controls.delete())} type="button">{action.label}</button>
      return null
    })}
    {item.read
      ? <button onClick={() => ignoreFailure(controls.markUnread())} type="button">Mark unread</button>
      : <button onClick={() => ignoreFailure(controls.markRead())} type="button">Mark read</button>}
    <button onClick={() => ignoreFailure(controls.delete())} type="button">Delete</button>
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
    return () => store.dispose()
  }, [store])
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize))
  return <section aria-busy={state.loading} aria-label="Notification inbox" className="hp-notification-inbox" data-placement={placement}>
    <header><h2>Notifications</h2><span aria-label={`${state.unread} unread`}>{state.unread}</span><button disabled={state.unread === 0} onClick={() => ignoreFailure(store.markAllRead())} type="button">Mark all read</button></header>
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.loading ? <p aria-live="polite" role="status">Loading notifications</p> : null}
    {!state.loading && state.items.length === 0 ? <p>{emptyMessage}</p> : null}
    <ol>{state.items.map(item => {
      const controls: ReactNotificationControls = {
        delete: () => store.delete([item.id]),
        markRead: () => store.markRead([item.id]),
        markUnread: () => store.markUnread([item.id]),
      }
      const rendererName = reactNotificationRendererName(item.type)
      const Custom = registry?.has(rendererName, panelId)
        ? registry.resolve<ReactCustomNotificationProps>(rendererName, panelId, `notification "${item.id}"`)
        : null
      return <li data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read} key={item.id}>
        {Custom ? <Custom controls={controls} notification={item} /> : <article aria-labelledby={`${item.id}-notification-title`}>
          {item.presentation.icon ? <span aria-hidden="true" data-icon={item.presentation.icon} /> : null}
          <h3 id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
          {item.presentation.body ? <p>{item.presentation.body}</p> : null}
          <time dateTime={item.createdAt}>{item.createdAt}</time>
          <NotificationActions controls={controls} item={item} navigate={navigate} />
        </article>}
      </li>
    })}</ol>
    <nav aria-label="Notification pagination">
      <button aria-label="Previous notification page" disabled={state.page <= 1} onClick={() => ignoreFailure(store.load(state.page - 1))} type="button">Previous</button>
      <span>Page {state.page} of {pages}</span>
      <button aria-label="Next notification page" disabled={state.page >= pages} onClick={() => ignoreFailure(store.load(state.page + 1))} type="button">Next</button>
    </nav>
  </section>
}
