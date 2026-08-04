import {
  createRequestEnvelope,
  databaseNotificationPayload,
  definePanel,
  executePanelDatabaseNotificationOperation,
  panelNotification,
  type JsonObject,
  type PanelAuthenticatedScope,
  type PanelNotificationRecord,
  type PanelNotificationStore,
  type PanelNotificationStoreQuery,
} from '@holo-js/panels-core'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authentication = vi.hoisted(() => ({ actor: { id: 'user-7', tenantId: 'north' } as { readonly id: string, readonly tenantId: string } | null }))

vi.mock('@holo-js/security/nuxt/server', () => ({ csrfProtection: () => defineEventHandler(() => undefined) }))
vi.mock('@holo-js/adapter-nuxt/runtime', () => ({
  holo: {
    getApp: vi.fn(async () => ({})),
    getAuth: vi.fn(async () => ({ guard: () => ({ provider: async () => 'session', user: async () => authentication.actor }) })),
  },
  runWithNuxtRequest: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))

const { createPanelOperationHandler } = await import('../src/server')
import type { NuxtPanelOperationContext, NuxtPanelRuntime } from '../src/contracts'

class NotificationStore implements PanelNotificationStore {
  records: PanelNotificationRecord[]

  constructor(records: readonly PanelNotificationRecord[]) {
    this.records = [...records]
  }

  async delete(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    const selected = new Set(ids)
    const before = this.records.length
    this.records = this.records.filter(record => !this.matches(record, query) || !selected.has(record.id))
    return before - this.records.length
  }

  async list(query: PanelNotificationStoreQuery, pagination: { readonly limit: number, readonly offset: number }) {
    const records = this.records.filter(record => this.matches(record, query))
    return { limit: pagination.limit, offset: pagination.offset, records: records.slice(pagination.offset, pagination.offset + pagination.limit), total: records.length, unread: records.filter(record => record.readAt == null).length }
  }

  async markAsRead(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, true)
  }

  async markAsUnread(query: PanelNotificationStoreQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, false)
  }

  private matches(record: PanelNotificationRecord, query: PanelNotificationStoreQuery): boolean {
    const panel = record.data && typeof record.data === 'object' && !Array.isArray(record.data) ? record.data.panel : null
    return record.notifiableType === query.recipient.type
      && String(record.notifiableId) === String(query.recipient.id)
      && panel !== null
      && typeof panel === 'object'
      && !Array.isArray(panel)
      && panel.panelId === query.panelId
      && panel.guard === query.guard
      && panel.tenantId === query.tenantId
  }

  private update(query: PanelNotificationStoreQuery, ids: readonly string[], read: boolean): number {
    const selected = new Set(ids)
    let affected = 0
    this.records = this.records.map(record => {
      if (!this.matches(record, query) || !selected.has(record.id)) return record
      affected += 1
      return { ...record, readAt: read ? new Date('2026-07-28T12:00:00.000Z') : null }
    })
    return affected
  }
}

class Actor {
  declare readonly id: string
  declare readonly tenantId: string
}

const panel = definePanel('admin', Actor)
  .guard('web')
  .databaseNotifications()
  .databaseNotificationInbox({
    authorize: (_operation, scope) => scope.actor.id === 'user-7',
    resolve: scope => ({ recipient: { id: scope.actor.id, type: 'User' }, realtimeChannel: `panels.admin.${scope.actor.id}`, tenantId: scope.actor.tenantId }),
  })
  .compile()

function record(id: string, tenantId = 'north'): PanelNotificationRecord {
  const now = new Date('2026-07-28T10:00:00.000Z')
  return {
    createdAt: now,
    data: databaseNotificationPayload(panelNotification(id).title(id).presentation(), { guard: 'web', panelId: 'admin', tenantId }),
    id,
    notifiableId: 'user-7',
    notifiableType: 'User',
    readAt: null,
    type: 'panels.test',
    updatedAt: now,
  }
}

function request(payload: JsonObject): Request {
  const envelope = createRequestEnvelope({ id: 'notification-request-1', operation: 'notification', panelId: 'admin', payload })
  return new Request('http://localhost/_holo/panels/admin/notification', {
    body: new URLSearchParams({ request: JSON.stringify(envelope), _token: 'valid' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
    method: 'POST',
  })
}

function endpoint(store: PanelNotificationStore): (request: Request) => Promise<Response> {
  const runtime: NuxtPanelRuntime = {
    panels: { admin: { access: () => true, guard: 'web' } },
    async execute(context: NuxtPanelOperationContext) {
      const scope: PanelAuthenticatedScope<{ readonly id: string, readonly tenantId: string }> = {
        actor: context.actor as { readonly id: string, readonly tenantId: string },
        guard: 'web',
        panelId: 'admin',
        provider: context.provider,
        signal: context.signal,
      }
      return { data: await executePanelDatabaseNotificationOperation({ panel, payload: context.input, scope, store }) }
    },
  }
  const app = createApp()
  const router = createRouter()
  router.post('/_holo/panels/:panelId/:operation', createPanelOperationHandler({ panelIds: ['admin'], runtime }))
  app.use(router)
  return toWebHandler(app)
}

beforeEach(() => {
  authentication.actor = { id: 'user-7', tenantId: 'north' }
})

describe('Nuxt production notification endpoint', () => {
  it('executes list, read, unread, and delete against server-derived identity and tenant scope', async () => {
    const store = new NotificationStore([record('north-1'), record('south-1', 'south')])
    const fetch = endpoint(store)
    const list = await fetch(request({ action: 'list', page: 1, pageSize: 20, recipient: { id: 'attacker', type: 'Admin' }, tenantId: 'south' }))
    await expect(list.json()).resolves.toMatchObject({ ok: true, data: { items: [{ id: 'north-1' }], total: 1, unread: 1 } })

    for (const [action, affected] of [['mark-read', 1], ['mark-unread', 1], ['delete', 1]] as const) {
      const response = await fetch(request({ action, ids: ['north-1'], tenantId: 'south' }))
      await expect(response.json()).resolves.toMatchObject({ ok: true, data: { affected } })
    }
    expect(store.records.map(item => item.id)).toEqual(['south-1'])
  })

  it('rejects cross-tenant IDs, malformed operations, and unauthenticated requests without leaking scope', async () => {
    const fetch = endpoint(new NotificationStore([record('north-1'), record('south-1', 'south')]))
    const crossTenant = await fetch(request({ action: 'delete', ids: ['south-1'] }))
    expect(crossTenant.status).toBe(403)
    await expect(crossTenant.json()).resolves.toMatchObject({ ok: false, error: { code: 'notification_access_denied' } })

    const malformed = await fetch(request({ action: 'list', page: 0, pageSize: 20 }))
    expect(malformed.status).toBe(400)
    authentication.actor = null
    const unauthenticated = await fetch(request({ action: 'list', page: 1, pageSize: 20 }))
    expect(unauthenticated.status).toBe(401)
  })
})
