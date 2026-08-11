import {
  createRequestEnvelope,
  toJsonValue,
  type CompiledPanelDefinition,
  type JsonObject,
  type JsonValue,
} from '@holo-js/panels-svelte'
import { executePanelDatabaseNotificationOperation } from '@holo-js/panels-svelte/server'
import { describe, expect, it, vi } from 'vitest'
import type { PanelRuntimeLike, SvelteKitPanelEvent, SvelteKitPanelRegistry } from '../src/contracts'

vi.mock('@holo-js/adapter-sveltekit', () => ({
  createSvelteKitHoloHelpers: () => ({ getAuth: async () => undefined }),
  runWithSvelteKitRequestEvent: <TValue>(_event: unknown, callback: () => TValue): TValue => callback(),
}))
vi.mock('@holo-js/security/sveltekit/server', () => ({
  csrfProtection: () => async ({ resolve }: { readonly resolve: () => Promise<Response> }) => resolve(),
}))
vi.mock('@sveltejs/kit', () => ({
  error: (status: number, message: string) => { throw Object.assign(new Error(message), { status }) },
  redirect: (status: number, location: string) => { throw Object.assign(new Error('Redirect'), { location, status }) },
}))

const { createPanelOperationHandler } = await import('../src/server')

type Actor = { readonly id: string, readonly tenantId: string }
type NotificationRecord = {
  readonly createdAt: Date
  readonly data: JsonValue
  readonly id: string
  readonly notifiableId: string
  readonly notifiableType: string
  readonly readAt: Date | null
  readonly type: string
  readonly updatedAt: Date
}
type NotificationQuery = {
  readonly guard: string
  readonly panelId: string
  readonly recipient: { readonly id: number | string, readonly type: string }
  readonly tenantId: string | null
  readonly version: 1
}

const panel: CompiledPanelDefinition<Actor> = {
  discover: {},
  guard: 'web',
  kind: 'panel',
  manifest: {
    auth: null,
    branding: { favicon: null, logo: null, name: 'Admin' },
    databaseNotifications: { placement: 'topbar', polling: 30_000, realtime: false },
    default: true,
    globalSearch: true,
    id: 'admin',
    navigation: [],
    navigationMode: 'sidebar',
    path: '/admin',
    sidebarCollapsible: true,
    slots: {},
    tenancy: null,
    theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'full' },
    userMenu: [],
  },
  server: {
    access: () => true,
    defaults: [],
    notifications: {
      inbox: {
        authorize: (_operation, scope) => scope.actor.id === 'user-7',
        resolve: scope => ({ recipient: { id: scope.actor.id, type: 'User' }, realtimeChannel: null, tenantId: scope.actor.tenantId }),
      },
    },
    plugins: [],
    registered: [],
    presentActor: actor => actor,
  },
}

function record(id: string, tenantId = 'north'): NotificationRecord {
  const timestamp = new Date('2026-07-28T10:00:00.000Z')
  return {
    createdAt: timestamp,
    data: {
      panel: {
        guard: 'web',
        panelId: 'admin',
        presentation: { actions: [], body: null, closeable: true, color: null, duration: 5_000, icon: null, id, persistent: false, status: 'info', title: id },
        tenantId,
        version: 1,
      },
    },
    id,
    notifiableId: 'user-7',
    notifiableType: 'User',
    readAt: null,
    type: 'panels.test',
    updatedAt: timestamp,
  }
}

class NotificationStore {
  records: NotificationRecord[]

  constructor(records: readonly NotificationRecord[]) {
    this.records = [...records]
  }

  async delete(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    const selected = new Set(ids)
    const before = this.records.length
    this.records = this.records.filter(item => !this.matches(item, query) || !selected.has(item.id))
    return before - this.records.length
  }

  async list(query: NotificationQuery, pagination: { readonly limit: number, readonly offset: number }) {
    const records = this.records.filter(item => this.matches(item, query))
    return { limit: pagination.limit, offset: pagination.offset, records: records.slice(pagination.offset, pagination.offset + pagination.limit), total: records.length, unread: records.filter(item => item.readAt == null).length }
  }

  async markAsRead(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, true)
  }

  async markAsUnread(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    return this.update(query, ids, false)
  }

  private matches(item: NotificationRecord, query: NotificationQuery): boolean {
    const panelPayload = item.data && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data.panel : null
    return item.notifiableType === query.recipient.type
      && String(item.notifiableId) === String(query.recipient.id)
      && panelPayload !== null
      && typeof panelPayload === 'object'
      && !Array.isArray(panelPayload)
      && panelPayload.panelId === query.panelId
      && panelPayload.guard === query.guard
      && panelPayload.tenantId === query.tenantId
  }

  private update(query: NotificationQuery, ids: readonly string[], read: boolean): number {
    const selected = new Set(ids)
    let affected = 0
    this.records = this.records.map(item => {
      if (!this.matches(item, query) || !selected.has(item.id)) return item
      affected += 1
      return { ...item, readAt: read ? new Date('2026-07-28T12:00:00.000Z') : null }
    })
    return affected
  }
}

function event(payload: JsonObject): SvelteKitPanelEvent {
  const url = new URL('https://panels.test/holo/panels/admin/notification')
  const envelope = createRequestEnvelope({ id: 'notification-request-1', operation: 'notification', panelId: 'admin', payload })
  return {
    cookies: { get: () => undefined, set: () => undefined },
    locals: {},
    params: { operation: 'notification', panelId: 'admin' },
    request: new Request(url, { body: new URLSearchParams({ request: JSON.stringify(envelope) }), headers: { 'content-type': 'application/x-www-form-urlencoded' }, method: 'POST' }),
    url,
  }
}

function endpoint(store: NotificationStore, actor: Actor = { id: 'user-7', tenantId: 'north' }) {
  const runtime: PanelRuntimeLike<typeof actor> = {
    async bootstrap() {
      return []
    },
    async execute(panelId, operation, signal, handler) {
      return handler({ actor, guard: 'web', panelId, provider: 'session', signal })
    },
  }
  const registry: SvelteKitPanelRegistry<typeof actor> = {
    operations: {
      notification: async input => ({ data: toJsonValue(await executePanelDatabaseNotificationOperation({ panel, payload: input.payload, scope: input.scope, store })) }),
    },
    resolvePage: async () => { throw new Error('Page resolution is not used') },
    runtime,
  }
  return createPanelOperationHandler({ panelIds: ['admin'], registry })
}

describe('SvelteKit production notification endpoint', () => {
  it('executes all inbox operations with server-derived recipient and tenant scope', async () => {
    expect(typeof executePanelDatabaseNotificationOperation).toBe('function')
    const store = new NotificationStore([record('north-1'), record('south-1', 'south')])
    const handler = endpoint(store)
    const list = await handler.POST(event({ action: 'list', page: 1, pageSize: 20, recipient: { id: 'attacker', type: 'Admin' }, tenantId: 'south' }))
    const listBody = await list.json()
    expect(listBody, JSON.stringify(listBody)).toMatchObject({ ok: true, data: { items: [{ id: 'north-1' }], total: 1, unread: 1 } })

    for (const action of ['mark-read', 'mark-unread', 'delete'] as const) {
      const response = await handler.POST(event({ action, ids: ['north-1'], tenantId: 'south' }))
      await expect(response.json()).resolves.toMatchObject({ ok: true, data: { affected: 1 } })
    }
    expect(store.records.map(item => item.id)).toEqual(['south-1'])
  })

  it('returns bounded failures for cross-tenant IDs, malformed payloads, and denied actors', async () => {
    const store = new NotificationStore([record('north-1'), record('south-1', 'south')])
    const handler = endpoint(store)
    const crossTenant = await handler.POST(event({ action: 'delete', ids: ['south-1'] }))
    expect(crossTenant.status).toBe(403)
    expect(JSON.stringify(await crossTenant.json())).not.toContain('south')

    const malformed = await handler.POST(event({ action: 'list', page: 0, pageSize: 20 }))
    expect(malformed.status).toBe(400)
    const denied = await endpoint(store, { id: 'attacker', tenantId: 'north' }).POST(event({ action: 'list', page: 1, pageSize: 20 }))
    expect(denied.status).toBe(403)
  })
})
