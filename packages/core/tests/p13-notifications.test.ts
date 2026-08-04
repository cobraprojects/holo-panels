import { describe, expect, it } from 'vitest'
import {
  databaseNotificationPayload,
  isPanelDatabaseNotificationPayload,
  panelNotification,
  PanelNotificationAccessError,
  PanelNotificationInbox,
  type PanelNotificationRecord,
  type PanelNotificationScope,
  type PanelNotificationStorePagination,
  type PanelNotificationStoreQuery,
} from '../src'

const adminScope: PanelNotificationScope = { actorId: 7, guard: 'admin', panelId: 'admin', tenantId: 10 }

class MemoryNotificationStore {
  constructor(readonly records: PanelNotificationRecord[]) {}

  async list(query: PanelNotificationStoreQuery, pagination: PanelNotificationStorePagination) {
    const records = this.scoped(query)
    return {
      limit: pagination.limit,
      offset: pagination.offset,
      records: records.slice(pagination.offset, pagination.offset + pagination.limit),
      total: records.length,
      unread: records.filter(record => record.readAt == null).length,
    }
  }

  async markAsRead(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, true)
  }

  async markAsUnread(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, false)
  }

  async delete(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    const selected = new Set(ids)
    const scoped = new Set(this.scoped(query).map(record => record.id))
    const previous = this.records.length
    for (let index = this.records.length - 1; index >= 0; index--) {
      const id = this.records[index]?.id ?? ''
      if (selected.has(id) && scoped.has(id)) this.records.splice(index, 1)
    }
    return previous - this.records.length
  }

  private scoped(query: PanelNotificationStoreQuery): PanelNotificationRecord[] {
    return this.records.filter((record) => {
      if (record.notifiableType !== query.recipient.type || String(record.notifiableId) !== String(query.recipient.id)) return false
      if (!isPanelDatabaseNotificationPayload(record.data)) return false
      const panel = record.data.panel
      return panel.version === query.version
        && panel.panelId === query.panelId
        && panel.guard === query.guard
        && panel.tenantId === query.tenantId
    })
  }

  private update(query: PanelNotificationStoreQuery, ids: readonly string[], read: boolean): number {
    const selected = new Set(ids)
    const scoped = new Set(this.scoped(query).map(record => record.id))
    let updated = 0
    for (let index = 0; index < this.records.length; index++) {
      const record = this.records[index]
      if (!record || !selected.has(record.id) || !scoped.has(record.id)) continue
      this.records[index] = { ...record, readAt: read ? new Date('2026-07-27T12:00:00Z') : null }
      updated++
    }
    return updated
  }
}

function record(id: string, scope: PanelNotificationScope = adminScope): PanelNotificationRecord {
  return {
    createdAt: new Date(`2026-07-27T10:00:0${id}.000Z`),
    data: databaseNotificationPayload(
      panelNotification(`post.saved-${id}`).title('Post saved').status('success').action('open', 'Open', 'navigate', `/admin/posts/${id}`).presentation(),
      scope,
    ),
    id,
    notifiableId: scope.actorId,
    notifiableType: scope.guard,
    readAt: null,
    type: 'post.saved',
    updatedAt: new Date('2026-07-27T10:00:00Z'),
  }
}

describe('P13 panel notifications', () => {
  it('builds bounded versioned presentation payloads with safe actions', () => {
    const presentation = panelNotification('post.saved')
      .title('Post saved')
      .body('The post is ready')
      .status('success')
      .persistent()
      .action('open', 'Open post', 'navigate', '/admin/posts/1')
      .presentation()
    const payload = databaseNotificationPayload(presentation, adminScope)

    expect(payload.panel).toMatchObject({ guard: 'admin', panelId: 'admin', tenantId: '10', version: 1 })
    expect(presentation.duration).toBeNull()
    expect(() => panelNotification('unsafe').title('Unsafe').action('open', 'Open', 'navigate', 'javascript:alert(1)')).toThrow()
  })

  it('isolates list and mutations by panel, guard, tenant, recipient, and authorization', async () => {
    const vendorScope: PanelNotificationScope = { actorId: 7, guard: 'vendor', panelId: 'vendor', tenantId: 10 }
    const wrongTenant = { ...adminScope, tenantId: 11 }
    const store = new MemoryNotificationStore([record('1'), record('2', vendorScope), record('3', wrongTenant)])
    const inbox = new PanelNotificationInbox({
      authorization: { authorize: operation => operation !== 'delete' },
      recipients: { resolve: scope => ({ id: scope.actorId, type: scope.guard }) },
      store,
    })

    const page = await inbox.list(adminScope)
    expect(page.items.map(item => item.id)).toEqual(['1'])
    expect(page.unread).toBe(1)
    await expect(inbox.markRead(adminScope, ['2'])).rejects.toBeInstanceOf(PanelNotificationAccessError)
    expect(await inbox.markRead(adminScope, ['1'])).toBe(1)
    expect((await inbox.list(adminScope)).unread).toBe(0)
    await expect(inbox.delete(adminScope, ['1'])).rejects.toBeInstanceOf(PanelNotificationAccessError)
  })

  it('fails closed when recipient resolution does not match the authenticated actor', async () => {
    const inbox = new PanelNotificationInbox({
      authorization: { authorize: () => true },
      recipients: { resolve: () => ({ id: 99, type: 'admin' }) },
      store: new MemoryNotificationStore([record('1')]),
    })
    await expect(inbox.list(adminScope)).rejects.toBeInstanceOf(PanelNotificationAccessError)
  })
})
