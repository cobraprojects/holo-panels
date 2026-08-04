import type {
  NotificationDatabaseMessage,
  NotificationJsonValue,
  NotificationRecord,
  NotificationStore,
} from '@holo-js/notifications'
import { configureNotificationsRuntime, resetNotificationsRuntime } from '@holo-js/notifications'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  databaseNotificationPayload,
  holoNotificationStore,
  panelNotification,
  PanelNotificationAccessError,
  PanelNotificationInbox,
  type PanelDatabaseNotificationPayload,
  type PanelNotificationScope,
} from '../src'

const scope: PanelNotificationScope = { actorId: 'admin-7', guard: 'admin', panelId: 'admin', tenantId: 'acme' }

afterEach(() => {
  resetNotificationsRuntime()
})

describe('P13 Holo Notifications compatibility', () => {
  it('uses the Holo runtime with one fixed panel scope for reads and mutations', async () => {
    const data = databaseNotificationPayload(
      panelNotification('post.published').title('Post published').presentation(),
      scope,
    )
    const message: NotificationDatabaseMessage<PanelDatabaseNotificationPayload> = { data }
    const records: NotificationRecord<NotificationJsonValue>[] = [{
      createdAt: new Date('2026-07-28T10:00:00.000Z'),
      data: message.data,
      id: 'notification-1',
      notifiableId: scope.actorId,
      notifiableType: 'admins',
      readAt: null,
      type: 'post.published',
      updatedAt: new Date('2026-07-28T10:00:00.000Z'),
    }]
    const list = vi.fn<NotificationStore['list']>(async (_query, pagination) => ({
      records,
      limit: pagination.limit,
      offset: pagination.offset,
      total: records.length,
      unread: records.filter(record => record.readAt == null).length,
    }))
    const markAsRead = vi.fn<NotificationStore['markAsRead']>(async (_query, ids) => ids.length)
    const holoStore: NotificationStore = {
      create: async record => { records.push(record) },
      delete: async (_query, ids) => ids.length,
      list,
      markAsRead,
      markAsUnread: async (_query, ids) => ids.length,
      unread: list,
    }
    configureNotificationsRuntime({ store: holoStore })
    const inbox = new PanelNotificationInbox({
      authorization: { authorize: () => true },
      recipients: { resolve: current => ({ id: current.actorId, type: 'admins' }) },
      store: holoNotificationStore(),
    })

    expectTypeOf(message).toMatchTypeOf<NotificationDatabaseMessage>()
    await expect(inbox.list(scope)).resolves.toMatchObject({ total: 1, unread: 1 })
    await expect(inbox.markRead(scope, ['notification-1'])).resolves.toBe(1)
    const expectedQuery = {
      recipient: { id: 'admin-7', type: 'admins' },
      dataMatches: [
        { path: ['panel', 'version'], value: 1 },
        { path: ['panel', 'panelId'], value: 'admin' },
        { path: ['panel', 'guard'], value: 'admin' },
        { path: ['panel', 'tenantId'], value: 'acme' },
      ],
    }
    expect(list).toHaveBeenNthCalledWith(1, expectedQuery, { limit: 20, offset: 0 })
    expect(list).toHaveBeenNthCalledWith(2, expectedQuery, { limit: 100, offset: 0 })
    expect(markAsRead).toHaveBeenCalledWith(expectedQuery, ['notification-1'])
    expect(records[0]?.data).toEqual(data)
  })

  it('retains visibility enumeration so foreign notification ids fail closed', async () => {
    const list = vi.fn<NotificationStore['list']>(async (_query, pagination) => ({
      records: [],
      limit: pagination.limit,
      offset: pagination.offset,
      total: 0,
      unread: 0,
    }))
    const markAsRead = vi.fn<NotificationStore['markAsRead']>(async () => 1)
    configureNotificationsRuntime({
      store: {
        create: async () => {},
        delete: async () => 0,
        list,
        markAsRead,
        markAsUnread: async () => 0,
        unread: list,
      },
    })
    const inbox = new PanelNotificationInbox({
      authorization: { authorize: () => true },
      recipients: { resolve: current => ({ id: current.actorId, type: 'admins' }) },
      store: holoNotificationStore(),
    })

    await expect(inbox.markRead(scope, ['foreign-id'])).rejects.toBeInstanceOf(PanelNotificationAccessError)
    expect(markAsRead).not.toHaveBeenCalled()
  })

  it('rejects Holo records that fail Panels JSON serialization', async () => {
    const unsafeRecord: NotificationRecord<NotificationJsonValue> = {
      createdAt: new Date('2026-07-28T10:00:00.000Z'),
      data: { url: 'javascript:alert(1)' },
      id: 'notification-unsafe',
      notifiableId: scope.actorId,
      notifiableType: 'admins',
      readAt: null,
      type: 'unsafe',
      updatedAt: new Date('2026-07-28T10:00:00.000Z'),
    }
    configureNotificationsRuntime({
      store: {
        create: async () => {},
        delete: async () => 0,
        list: async (_query, pagination) => ({
          records: [unsafeRecord],
          limit: pagination.limit,
          offset: pagination.offset,
          total: 1,
          unread: 1,
        }),
        markAsRead: async () => 0,
        markAsUnread: async () => 0,
        unread: async (_query, pagination) => ({ records: [], limit: pagination.limit, offset: pagination.offset, total: 0, unread: 0 }),
      },
    })

    await expect(holoNotificationStore().list({
      guard: 'admin',
      panelId: 'admin',
      recipient: { id: 'admin-7', type: 'admins' },
      tenantId: 'acme',
      version: 1,
    }, { limit: 20, offset: 0 })).rejects.toThrow('unsafe URL')
  })
})
