import type {
  NotificationJsonValue,
  NotificationPage,
  NotificationQuery,
  NotificationRecord,
  getNotificationsRuntime,
} from '@holo-js/notifications'
import { toJsonValue } from '../protocol/serialization'
import type {
  PanelNotificationRecord,
  PanelNotificationStore,
  PanelNotificationStorePage,
  PanelNotificationStorePagination,
  PanelNotificationStoreQuery,
} from './contracts'

type HoloNotificationsRuntime = ReturnType<typeof getNotificationsRuntime>

let runtimePromise: Promise<HoloNotificationsRuntime> | undefined

function loadRuntime(): Promise<HoloNotificationsRuntime> {
  if ('window' in globalThis) {
    return Promise.reject(new Error('Holo notification persistence is only available on the server'))
  }
  runtimePromise ??= import('@holo-js/notifications').then(module => module.getNotificationsRuntime())
  return runtimePromise
}

function holoQuery(query: PanelNotificationStoreQuery): NotificationQuery {
  return {
    recipient: query.recipient,
    ...(query.id === undefined ? {} : { id: query.id }),
    dataMatches: [
      { path: ['panel', 'version'], value: query.version },
      { path: ['panel', 'panelId'], value: query.panelId },
      { path: ['panel', 'guard'], value: query.guard },
      { path: ['panel', 'tenantId'], value: query.tenantId },
    ],
  }
}

function panelRecord(record: NotificationRecord<NotificationJsonValue>): PanelNotificationRecord {
  return Object.freeze({
    createdAt: record.createdAt,
    data: toJsonValue(record.data),
    id: record.id,
    notifiableId: record.notifiableId,
    notifiableType: record.notifiableType,
    readAt: record.readAt,
    type: record.type,
    updatedAt: record.updatedAt,
  })
}

function panelPage(page: NotificationPage, pagination: PanelNotificationStorePagination): PanelNotificationStorePage {
  return Object.freeze({
    limit: pagination.limit,
    offset: pagination.offset,
    records: Object.freeze(page.records.map(record => panelRecord(record))),
    total: page.total,
    unread: page.unread,
  })
}

export function holoNotificationStore(): PanelNotificationStore {
  return Object.freeze({
    async delete(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
      const runtime = await loadRuntime()
      return await runtime.deleteNotifications(holoQuery(query), ids)
    },
    async list(
      query: PanelNotificationStoreQuery,
      pagination: PanelNotificationStorePagination,
    ): Promise<PanelNotificationStorePage> {
      const runtime = await loadRuntime()
      return panelPage(await runtime.listNotifications(holoQuery(query), pagination), pagination)
    },
    async markAsRead(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
      const runtime = await loadRuntime()
      return await runtime.markNotificationsAsRead(holoQuery(query), ids)
    },
    async markAsUnread(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
      const runtime = await loadRuntime()
      return await runtime.markNotificationsAsUnread(holoQuery(query), ids)
    },
  })
}
