import type {
  PanelDatabaseNotificationPage,
  PanelNotificationAction,
  PanelNotificationPresentation,
} from '@holo-js/panels-core'

export interface ClientToast extends PanelNotificationPresentation {
  readonly announced: boolean
  readonly createdAt: number
  readonly trusted: boolean
}

export interface ClientToastState {
  readonly items: readonly ClientToast[]
  readonly liveMessage: string
  readonly version: number
}

export type ClientToastStateListener = (state: ClientToastState, previous: ClientToastState) => void

export interface ClientNotificationTransport {
  delete(ids: readonly string[], signal: AbortSignal): Promise<number>
  list(page: number, pageSize: number, signal: AbortSignal): Promise<PanelDatabaseNotificationPage>
  markRead(ids: readonly string[], signal: AbortSignal): Promise<number>
  markUnread(ids: readonly string[], signal: AbortSignal): Promise<number>
}

export interface ClientNotificationInboxState extends PanelDatabaseNotificationPage {
  readonly error: string | null
  readonly loading: boolean
  readonly version: number
}

export type ClientNotificationInboxListener = (
  state: ClientNotificationInboxState,
  previous: ClientNotificationInboxState,
) => void

export interface ClientNotificationRealtime {
  subscribe(invalidate: () => void): () => void
}

export interface ClientNotificationInboxOptions {
  readonly pageSize?: number
  readonly polling?: false | number
  readonly realtime?: ClientNotificationRealtime
  readonly transport: ClientNotificationTransport
}

export type ClientNotificationActionHandler = (action: Readonly<PanelNotificationAction>, toast: Readonly<ClientToast>) => void | Promise<void>
