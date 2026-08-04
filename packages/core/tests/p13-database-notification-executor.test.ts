import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  definePanel,
  executePanelDatabaseNotificationOperation,
  panelNotification,
  PanelNotificationAccessError,
  PanelNotificationRequestError,
  databaseNotificationPayload,
  type PanelAuthenticatedScope,
  type PanelNotificationRecord,
  type PanelNotificationStore,
} from '../src'

class Actor {
  declare readonly accountId: number
}

const signal = new AbortController().signal
const actor: Actor = { accountId: 17 }
const scope: PanelAuthenticatedScope<Actor> = Object.freeze({ actor, guard: 'staff', panelId: 'admin', provider: 'users', signal })

function record(): PanelNotificationRecord {
  return {
    createdAt: new Date('2026-07-28T10:00:00.000Z'),
    data: databaseNotificationPayload(panelNotification('notice').title('Notice').presentation(), {
      guard: 'staff',
      panelId: 'admin',
      tenantId: 'north',
    }),
    id: 'notification-1',
    notifiableId: 'recipient-17',
    notifiableType: 'Account',
    readAt: null,
    type: 'notice',
    updatedAt: new Date('2026-07-28T10:00:00.000Z'),
  }
}

function store(): PanelNotificationStore {
  return {
    delete: vi.fn(async (_query, ids) => ids.length),
    list: vi.fn(async (_query, pagination) => ({
      limit: pagination.limit,
      offset: pagination.offset,
      records: [record()],
      total: 1,
      unread: 1,
    })),
    markAsRead: vi.fn(async (_query, ids) => ids.length),
    markAsUnread: vi.fn(async (_query, ids) => ids.length),
  }
}

describe('P13 database notification operation executor', () => {
  it('keeps identity and authorization callbacks server-only while preserving builder inference', async () => {
    const resolve = vi.fn(async () => ({
      realtimeChannel: 'panels.notifications.account-17',
      recipient: { id: 'recipient-17', type: 'Account' },
      tenantId: 'north',
    }))
    const authorize = vi.fn(async () => true)
    const builder = definePanel('admin', Actor)
      .guard('staff')
      .databaseNotifications({ realtime: true })
      .databaseNotificationInbox({ authorize, resolve })
    const panel = builder.compile()

    expectTypeOf(builder.databaseNotificationInbox).returns.toEqualTypeOf<typeof builder>()
    expect(panel.server.notifications?.inbox.resolve).not.toBe(resolve)
    expect(JSON.stringify(panel.manifest)).not.toContain('recipient-17')
    expect(JSON.stringify(panel.manifest)).not.toContain('authorize')

    const result = await executePanelDatabaseNotificationOperation({
      panel,
      payload: { action: 'list', guard: 'attacker', page: 1, pageSize: 20, recipient: { id: 'attacker', type: 'Admin' }, tenantId: 'south' },
      scope,
      store: store(),
    })

    expect(result).toMatchObject({ items: [{ id: 'notification-1' }], total: 1, unread: 1 })
    expect(resolve).toHaveBeenCalledWith(scope)
    expect(authorize).toHaveBeenCalledWith('list', scope)
  })

  it('uses the resolved identity for every store query and ignores hostile client identity fields', async () => {
    const persistence = store()
    const panel = definePanel('admin', Actor)
      .guard('staff')
      .databaseNotifications()
      .databaseNotificationInbox({
        authorize: () => true,
        resolve: () => ({ realtimeChannel: null, recipient: { id: 'recipient-17', type: 'Account' }, tenantId: 'north' }),
      })
      .compile()

    await executePanelDatabaseNotificationOperation({
      panel,
      payload: { action: 'mark-read', guard: 'other', ids: ['notification-1'], recipient: { id: 'foreign', type: 'Admin' }, tenantId: 'south' },
      scope,
      store: persistence,
    })

    expect(persistence.markAsRead).toHaveBeenCalledWith(expect.objectContaining({
      guard: 'staff',
      panelId: 'admin',
      recipient: { id: 'recipient-17', type: 'Account' },
      tenantId: 'north',
    }), ['notification-1'])
  })

  it('fails before persistence for denied access, missing configuration, and malformed requests', async () => {
    const persistence = store()
    const denied = definePanel('admin', Actor)
      .databaseNotifications()
      .databaseNotificationInbox({
        authorize: () => false,
        resolve: () => ({ realtimeChannel: null, recipient: { id: 'recipient-17', type: 'Account' }, tenantId: null }),
      })
      .compile()

    await expect(executePanelDatabaseNotificationOperation({ panel: denied, payload: { action: 'list', page: 1, pageSize: 20 }, scope, store: persistence }))
      .rejects.toBeInstanceOf(PanelNotificationAccessError)
    await expect(executePanelDatabaseNotificationOperation({ panel: denied, payload: { action: 'list', page: 0, pageSize: 20 }, scope, store: persistence }))
      .rejects.toBeInstanceOf(PanelNotificationRequestError)
    await expect(executePanelDatabaseNotificationOperation({ panel: denied, payload: { action: 'mark-read', ids: [17] }, scope, store: persistence }))
      .rejects.toBeInstanceOf(PanelNotificationRequestError)

    const missing = definePanel('admin', Actor).databaseNotifications().compile()
    await expect(executePanelDatabaseNotificationOperation({ panel: missing, payload: { action: 'list', page: 1, pageSize: 20 }, scope, store: persistence }))
      .rejects.toBeInstanceOf(PanelNotificationAccessError)
    expect(persistence.list).not.toHaveBeenCalled()
  })
})
