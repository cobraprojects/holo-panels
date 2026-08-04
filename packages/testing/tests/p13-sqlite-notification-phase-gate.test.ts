import { holoRuntimeInternals } from '../../../../holo-js/packages/core/src/index'
import {
  configureDB,
  createConnectionManager,
  createDialect,
  resetDB,
} from '../../../../holo-js/packages/db/src/index'
import { createSQLiteAdapter } from '../../../../holo-js/packages/db-sqlite/src/index'
import {
  configureNotificationsRuntime,
  resetNotificationsRuntime,
  type NotificationRecord,
} from '@holo-js/notifications'
import {
  databaseNotificationPayload,
  definePanel,
  executePanelDatabaseNotificationOperation,
  panelNotification,
  PanelNotificationAccessError,
  type PanelAuthenticatedScope,
  type PanelDatabaseNotificationPage,
} from '@holo-js/panels-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

class AcceptanceActor {
  declare readonly id: string
  declare readonly role: 'admin' | 'customer' | 'vendor'
  declare readonly tenantId: string
}

const createdAt = new Date('2026-07-28T10:00:00.000Z')
const database = createSQLiteAdapter({ filename: ':memory:' })
const manager = createConnectionManager({
  defaultConnection: 'acceptance',
  connections: {
    acceptance: {
      adapter: database,
      connectionName: 'acceptance',
      dialect: createDialect('sqlite'),
      driver: 'sqlite',
    },
  },
})

type NotificationStoreConfig = Parameters<typeof holoRuntimeInternals.createCoreNotificationStore>[0]

function notificationStoreConfig(): NotificationStoreConfig {
  return {
    database: { defaultConnection: 'acceptance' },
    notifications: { table: 'notifications' },
  } as NotificationStoreConfig
}

function scope(actor: AcceptanceActor, guard: 'admin' | 'vendor'): PanelAuthenticatedScope<AcceptanceActor> {
  return Object.freeze({
    actor,
    guard,
    panelId: 'commerce',
    provider: 'users',
    signal: new AbortController().signal,
  })
}

function panel(guard: 'admin' | 'vendor') {
  return definePanel('commerce', AcceptanceActor)
    .guard(guard)
    .databaseNotifications({ polling: 1_000, realtime: true })
    .databaseNotificationInbox({
      authorize: (_operation, authenticated) => authenticated.guard === guard && authenticated.actor.role === guard,
      resolve: authenticated => ({
        realtimeChannel: `panels.notifications.${guard}.${authenticated.actor.id}`,
        recipient: { id: authenticated.actor.id, type: 'User' },
        tenantId: authenticated.actor.tenantId,
      }),
    })
    .compile()
}

function record(id: string, guard: 'admin' | 'vendor', tenantId: string): NotificationRecord {
  const presentation = panelNotification(id)
    .title(`Notification ${id}`)
    .action('read', 'Mark read', 'mark-read')
    .action('unread', 'Mark unread', 'mark-unread')
    .action('delete', 'Delete', 'dismiss')
    .presentation()

  return Object.freeze({
    createdAt: new Date(createdAt.getTime() + Number(id.replace(/\D/gu, '')) * 1_000),
    data: databaseNotificationPayload(presentation, { guard, panelId: 'commerce', tenantId }),
    id,
    notifiableId: 'user-1',
    notifiableType: 'User',
    readAt: null,
    type: 'panels.acceptance',
    updatedAt: createdAt,
  })
}

function page(result: Awaited<ReturnType<typeof executePanelDatabaseNotificationOperation>>): PanelDatabaseNotificationPage {
  if (!('items' in result)) throw new Error('Expected a notification page')
  return result
}

describe('P13 SQLite database notification phase gate', () => {
  beforeEach(async () => {
    configureDB(manager)
    await manager.initializeAll()
    await database.execute('DROP TABLE IF EXISTS notifications')
    await database.execute(`
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        type TEXT,
        notifiable_type TEXT NOT NULL,
        notifiable_id TEXT NOT NULL,
        data TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    const store = holoRuntimeInternals.createCoreNotificationStore(notificationStoreConfig())
    configureNotificationsRuntime({ store })
    await store.create(record('notification-1', 'admin', 'tenant-1'))
    await store.create(record('notification-2', 'admin', 'tenant-1'))
    await store.create(record('notification-3', 'admin', 'tenant-2'))
    await store.create(record('notification-4', 'vendor', 'tenant-1'))
  })

  afterEach(() => {
    resetNotificationsRuntime()
    resetDB()
  })

  it('isolates guards and tenants through the production executor and Holo SQLite store', async () => {
    const adminPanel = panel('admin')
    const vendorPanel = panel('vendor')
    const adminTenantOne = scope({ id: 'user-1', role: 'admin', tenantId: 'tenant-1' }, 'admin')
    const adminTenantTwo = scope({ id: 'user-1', role: 'admin', tenantId: 'tenant-2' }, 'admin')
    const vendorTenantOne = scope({ id: 'user-1', role: 'vendor', tenantId: 'tenant-1' }, 'vendor')

    const firstPoll = page(await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: adminTenantOne,
    }))
    expect(firstPoll.items.map(item => item.id)).toEqual(['notification-2', 'notification-1'])
    expect(firstPoll).toMatchObject({ total: 2, unread: 2 })

    const store = holoRuntimeInternals.createCoreNotificationStore(notificationStoreConfig())
    await store.create(record('notification-5', 'admin', 'tenant-1'))
    const refreshedPoll = page(await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: adminTenantOne,
    }))
    expect(refreshedPoll.items.map(item => item.id)).toEqual(['notification-5', 'notification-2', 'notification-1'])

    await expect(executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'mark-read', ids: ['notification-1', 'notification-3', 'notification-4'] },
      scope: adminTenantOne,
    })).rejects.toBeInstanceOf(PanelNotificationAccessError)
    const read = await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'mark-read', ids: ['notification-1'] },
      scope: adminTenantOne,
    })
    expect(read).toEqual({ affected: 1 })
    const afterRead = page(await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: adminTenantOne,
    }))
    expect(afterRead.unread).toBe(2)
    expect(afterRead.items.find(item => item.id === 'notification-1')?.read).toBe(true)

    const unread = await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'mark-unread', ids: ['notification-1'] },
      scope: adminTenantOne,
    })
    expect(unread).toEqual({ affected: 1 })

    await expect(executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'delete', ids: ['notification-2', 'notification-3', 'notification-4'] },
      scope: adminTenantOne,
    })).rejects.toBeInstanceOf(PanelNotificationAccessError)
    const deleted = await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'delete', ids: ['notification-2'] },
      scope: adminTenantOne,
    })
    expect(deleted).toEqual({ affected: 1 })

    const adminOtherTenant = page(await executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: adminTenantTwo,
    }))
    const vendor = page(await executePanelDatabaseNotificationOperation({
      panel: vendorPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: vendorTenantOne,
    }))
    expect(adminOtherTenant.items.map(item => item.id)).toEqual(['notification-3'])
    expect(vendor.items.map(item => item.id)).toEqual(['notification-4'])

    await expect(executePanelDatabaseNotificationOperation({
      panel: adminPanel,
      payload: { action: 'list', page: 1, pageSize: 20 },
      scope: scope({ id: 'user-1', role: 'customer', tenantId: 'tenant-1' }, 'admin'),
    })).rejects.toBeInstanceOf(PanelNotificationAccessError)
  })
})
