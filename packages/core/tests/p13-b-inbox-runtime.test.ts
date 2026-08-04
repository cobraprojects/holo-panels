import { describe, expect, it, vi } from 'vitest'
import {
  databaseNotificationPayload,
  isPanelDatabaseNotificationPayload,
  panelNotification,
  PanelNotificationAccessError,
  PanelNotificationInbox,
  type PanelDatabaseNotificationPayload,
  type PanelNotificationRecord,
  type PanelNotificationScope,
  type PanelNotificationStorePagination,
} from '../src'

const scope: PanelNotificationScope = { actorId: 17, guard: 'staff', panelId: 'operations', tenantId: 'north' }

function notificationRecord(id: string, overrides: Partial<PanelNotificationRecord> = {}): PanelNotificationRecord {
  return {
    createdAt: new Date(`2026-07-28T10:${String(Number(id) % 60).padStart(2, '0')}:00.000Z`),
    data: databaseNotificationPayload(
      panelNotification(`notice-${id}`).title(`Notice ${id}`).action('open', 'Open', 'navigate', `/notices/${id}`).presentation(),
      scope,
    ),
    id,
    notifiableId: scope.actorId,
    notifiableType: scope.guard,
    readAt: null,
    type: 'notice',
    updatedAt: new Date('2026-07-28T10:00:00.000Z'),
    ...overrides,
  }
}

function inbox(records: PanelNotificationRecord[]) {
  const markAsRead = vi.fn(async (_query: unknown, ids: readonly string[]) => ids.length)
  return {
    inbox: new PanelNotificationInbox({
      authorization: { authorize: () => true },
      recipients: { resolve: current => ({ id: current.actorId, type: current.guard }) },
      store: {
        delete: async (_query, ids) => ids.length,
        list: async (_query, pagination: PanelNotificationStorePagination) => ({
          limit: pagination.limit,
          offset: pagination.offset,
          records: records.slice(pagination.offset, pagination.offset + pagination.limit),
          total: records.length,
          unread: records.filter(record => record.readAt == null).length,
        }),
        markAsRead,
        markAsUnread: async (_query, ids) => ids.length,
      },
    }),
    markAsRead,
  }
}

describe('P13-B database notification inbox runtime', () => {
  it('fully validates versioned payloads and freezes safe parsed presentation data', async () => {
    const valid = databaseNotificationPayload(panelNotification('safe').title('Safe').action('open', 'Open', 'navigate', '/safe').presentation(), scope)
    expect(isPanelDatabaseNotificationPayload(valid)).toBe(true)
    const malformed = [
      { panel: { ...valid.panel, version: 2 } },
      { panel: { ...valid.panel, tenantId: '' } },
      { panel: { ...valid.panel, tenantId: ' north' } },
      { panel: { ...valid.panel, tenantId: 'n'.repeat(201) } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, status: 'critical' } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, duration: Number.NaN } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'javascript:alert(1)' }] } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: '/\\attacker.test' }] } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'https://user:secret@example.com' }] } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'https://example.com/\\attacker' }] } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'https://example.com/\nattacker' }] } } },
      { panel: { ...valid.panel, presentation: { ...valid.panel.presentation, actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'https://' }] } } },
    ]
    for (const value of malformed) expect(isPanelDatabaseNotificationPayload(value)).toBe(false)

    const { inbox: service } = inbox([notificationRecord('1')])
    const page = await service.list(scope)
    expect(Object.isFrozen(page.items[0]?.presentation)).toBe(true)
    expect(Object.isFrozen(page.items[0]?.presentation.actions)).toBe(true)
    expect(Object.isFrozen(page.items[0]?.presentation.actions[0])).toBe(true)
  })

  it('normalizes bounded tenant IDs and refuses to build invalid tenant payloads', async () => {
    const presentation = panelNotification('safe').title('Safe').presentation()
    const normalized = databaseNotificationPayload(presentation, { ...scope, tenantId: ' north ' })

    expect(normalized.panel.tenantId).toBe('north')
    expect(isPanelDatabaseNotificationPayload(normalized)).toBe(true)
    await expect(inbox([notificationRecord('1')]).inbox.list({ ...scope, tenantId: ' north ' })).resolves.toMatchObject({ total: 1 })
    expect(() => databaseNotificationPayload(presentation, { ...scope, tenantId: '' })).toThrow('cannot be empty')
    expect(() => databaseNotificationPayload(presentation, { ...scope, tenantId: 'n'.repeat(201) })).toThrow('cannot exceed 200')
  })

  it('marks every authorized unread page in bounded batches', async () => {
    const records = Array.from({ length: 205 }, (_, index) => notificationRecord(String(index + 1)))
    const { inbox: service, markAsRead } = inbox(records)

    const first = await service.list(scope, 1, 100)
    expect(first.total).toBe(205)
    expect(first.items).toHaveLength(100)
    expect(first.unread).toBe(205)
    expect(await service.markAllRead(scope)).toBe(205)
    expect(markAsRead.mock.calls.map(call => call[1].length)).toEqual([100, 100, 5])
  })

  it('fails closed for malformed adapter timestamps and notification types', async () => {
    const stringTimestamp = notificationRecord('10')
    Object.defineProperty(stringTimestamp, 'createdAt', { value: '2026-07-28T10:00:00.000Z' })
    const throwingTimestamp = notificationRecord('11')
    Object.defineProperty(throwingTimestamp, 'createdAt', { value: new Proxy(new Date(), {}) })
    const records = [
      notificationRecord('6'),
      notificationRecord('7', { type: '' }),
      notificationRecord('8', { type: '../renderer' }),
      notificationRecord('9', { type: `notice.${'n'.repeat(200)}` }),
      stringTimestamp,
      throwingTimestamp,
    ]

    await expect(inbox(records).inbox.list(scope)).resolves.toMatchObject({
      items: [{ id: '6', type: 'notice' }],
      total: 6,
      unread: 6,
    })
  })

  it('fails closed for malformed guard-provider recipient identities', async () => {
    const store = {
      delete: async () => 0,
      list: vi.fn(async () => ({ limit: 20, offset: 0, records: [notificationRecord('1')], total: 1, unread: 1 })),
      markAsRead: async () => 0,
      markAsUnread: async () => 0,
    }
    for (const recipient of [{ id: 18, type: 'staff' }, { id: 17, type: '' }]) {
      const service = new PanelNotificationInbox({
        authorization: { authorize: () => true },
        recipients: { resolve: () => recipient },
        store,
      })
      await expect(service.list(scope)).rejects.toBeInstanceOf(PanelNotificationAccessError)
    }
    expect(store.list).not.toHaveBeenCalled()
  })

  it('does not accept payload types based only on their version envelope', () => {
    const shallow = { panel: { guard: 'staff', panelId: 'operations', presentation: {}, tenantId: 'north', version: 1 } }
    expect(isPanelDatabaseNotificationPayload(shallow)).toBe(false)
    expect(isPanelDatabaseNotificationPayload(shallow as PanelDatabaseNotificationPayload)).toBe(false)
  })
})
