import {
  configureNotificationsRuntime,
  defineNotification,
  resetNotificationsRuntime,
  type NotificationRecord,
  type NotificationStore,
} from '@holo-js/notifications'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  holoTransferCompletionNotifier,
  type TransferCompletionNotifier,
  type TransferOperationRecord,
} from '../src/transfers'
import { TransferOperationLifecycle } from '../src/transfers/lifecycle'
import { TransferOutboxDispatcher } from '../src/transfers/outbox'
import { MemoryTransferStore } from './helpers/transfer-store'

class AdminActor {
  constructor(
    readonly id: string,
    readonly type: string,
  ) {}
}

const now = new Date('2026-07-29T10:00:00.000Z')
const source = Object.freeze({
  contentType: 'text/csv',
  digest: { algorithm: 'sha256' as const, value: 'a'.repeat(64) },
  disk: 'private',
  filename: 'input.csv',
  path: 'input.csv',
  size: 10,
})

function notification(status: 'completed' | 'failed', operation: TransferOperationRecord) {
  return defineNotification({
    type: `transfer-${status}`,
    via(_actor: AdminActor) {
      return ['database']
    },
    build: {
      database(actor) {
        return { data: { actorId: actor.id, operationId: operation.id, status } }
      },
    },
  })
}

function notificationStore(records: Map<string, NotificationRecord>): NotificationStore {
  return {
    async create(record) {
      const existing = records.get(record.id)
      if (!existing) {
        records.set(record.id, record)
        return
      }
      if (
        existing.notifiableId !== record.notifiableId
        || existing.notifiableType !== record.notifiableType
        || existing.type !== record.type
      ) {
        throw new Error('notification collision')
      }
    },
    delete: async () => 0,
    list: async (_query, pagination) => ({ records: [], limit: pagination.limit, offset: pagination.offset, total: 0, unread: 0 }),
    markAsRead: async () => 0,
    markAsUnread: async () => 0,
    unread: async (_query, pagination) => ({ records: [], limit: pagination.limit, offset: pagination.offset, total: 0, unread: 0 }),
  }
}

afterEach(() => {
  resetNotificationsRuntime()
})

describe('P15 Holo notification outbox convergence', () => {
  it('infers the actor and converges after notification commit before outbox acknowledgement', async () => {
    const notifications = new Map<string, NotificationRecord>()
    configureNotificationsRuntime({ store: notificationStore(notifications) })
    const notifier = holoTransferCompletionNotifier({
      completed: operation => notification('completed', operation),
      failed: operation => notification('failed', operation),
    })
    expectTypeOf(notifier).toMatchTypeOf<TransferCompletionNotifier<AdminActor, { readonly id: string }>>()

    let sequence = 0
    let clock = now
    const store = new MemoryTransferStore()
    const lifecycle = new TransferOperationLifecycle<object>({
      authorizeCancellation: () => true,
      authorizeDownload: () => true,
      clock: () => clock,
      identifyActor: actor => (actor as AdminActor).id,
      identifyGuard: () => 'admin',
      identifyPanel: () => 'admin',
      identifyProvider: () => null,
      identifyTenant: tenant => (tenant as { readonly id: string }).id,
      makeId: () => `id-${++sequence}`,
      maxChunkRetries: 2,
      retentionMilliseconds: 1_000,
      signDownload: () => 'token',
      store,
      verifyDownload: () => null,
    })
    const operation = await lifecycle.create({
      definitionId: 'users',
      definitionRevision: 'b'.repeat(64),
      input: { formatId: 'csv', kind: 'import', mappings: [], source },
      kind: 'import',
      queue: {},
      resourceId: 'users',
      total: 0,
    }, { actor: new AdminActor('actor-1', 'admins'), tenant: { id: 'tenant-a' } })
    store.outbox.clear()
    await lifecycle.complete(operation.id, null)
    const outboxId = [...store.outbox.keys()][0]!
    vi.spyOn(store, 'acknowledgeOutbox').mockResolvedValueOnce(false)

    const dispatcher = new TransferOutboxDispatcher({
      clock: () => clock,
      leaseMilliseconds: 1_000,
      notifier,
      queue: { enqueue: async () => ({ jobId: 'unused' }) },
      resolveContext: current => Promise.resolve({
        actor: new AdminActor(String(current.identity.actor), 'admins'),
        guard: current.identity.guard,
        panelId: current.identity.panelId,
        provider: current.identity.provider,
        resourceId: current.resourceId,
        signal: new AbortController().signal,
        tenant: { id: 'tenant-a' },
      }),
      store,
    })

    await expect(dispatcher.run()).resolves.toEqual({ dispatched: 1, inspected: 1 })
    expect(notifications.size).toBe(1)
    expect([...notifications.values()][0]).toMatchObject({ type: 'transfer-completed' })
    expect(store.outbox.size).toBe(1)

    clock = new Date(now.getTime() + 1_001)
    await expect(dispatcher.run()).resolves.toEqual({ dispatched: 1, inspected: 1 })
    expect(notifications.size).toBe(1)
    expect(store.outbox.size).toBe(0)
  })
})
