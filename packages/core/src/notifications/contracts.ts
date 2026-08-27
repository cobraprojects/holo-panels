import type { JsonObject, JsonValue } from '../protocol/json'
import type { NotificationActionReference } from './action-reference'

export type PanelNotificationStatus = 'danger' | 'info' | 'success' | 'warning'
export type PanelNotificationActionKind = 'dismiss' | 'execute' | 'mark-read' | 'mark-unread' | 'navigate'

export interface PanelNotificationAction extends JsonObject {
  id: string
  kind: PanelNotificationActionKind
  label: string
  url: string | null
}

export type PanelNotificationExecutionAction = PanelNotificationAction & {
  readonly execution: NotificationActionReference
  readonly actionManifest?: JsonObject
  readonly token?: string
}

export interface PanelNotificationPresentation extends JsonObject {
  actions: JsonValue[]
  body: string | null
  closeable: boolean
  color: string | null
  duration: number | null
  icon: string | null
  id: string
  persistent: boolean
  status: PanelNotificationStatus
  title: string
}

export interface PanelDatabaseNotificationPayload extends JsonObject {
  panel: JsonObject & {
    guard: string
    panelId: string
    presentation: PanelNotificationPresentation
    tenantId: string | null
    version: 1
  }
}

export interface PanelNotificationScope {
  readonly actorId: number | string
  readonly guard: string
  readonly panelId: string
  readonly tenantId: number | string | null
}

export interface PanelNotificationRecord {
  readonly createdAt: Date
  readonly data: JsonValue
  readonly id: string
  readonly notifiableId: number | string
  readonly notifiableType: string
  readonly readAt?: Date | null
  readonly type?: string
  readonly updatedAt: Date
}

export interface PanelNotificationStore {
  delete(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number>
  list(query: PanelNotificationStoreQuery, pagination: PanelNotificationStorePagination): Promise<PanelNotificationStorePage>
  markAsRead(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number>
  markAsUnread(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number>
}

export interface PanelNotificationStoreQuery {
  readonly id?: string
  readonly guard: string
  readonly panelId: string
  readonly recipient: PanelNotificationRecipient
  readonly tenantId: string | null
  readonly version: 1
}

export interface PanelNotificationStorePagination {
  readonly limit: number
  readonly offset: number
}

export interface PanelNotificationStorePage {
  readonly limit: number
  readonly offset: number
  readonly records: readonly PanelNotificationRecord[]
  readonly total: number
  readonly unread: number
}

export interface PanelNotificationRecipient {
  readonly id: number | string
  readonly type: string
}

export interface PanelNotificationRecipientResolver {
  resolve(scope: PanelNotificationScope): PanelNotificationRecipient | Promise<PanelNotificationRecipient>
}

export type PanelNotificationOperation = 'delete' | 'list' | 'mark-read' | 'mark-unread'

export interface PanelNotificationAuthorization {
  authorize(operation: PanelNotificationOperation, scope: PanelNotificationScope): boolean | Promise<boolean>
}

export interface PanelDatabaseNotificationItem {
  readonly createdAt: string
  readonly id: string
  readonly presentation: Readonly<PanelNotificationPresentation>
  readonly read: boolean
  readonly type: string
}

export interface PanelDatabaseNotificationPage {
  readonly items: readonly PanelDatabaseNotificationItem[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly unread: number
}
