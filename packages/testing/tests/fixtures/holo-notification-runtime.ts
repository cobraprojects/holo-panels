import {
  configureNotificationsRuntime,
  defineNotification,
  notificationsRuntimeInternals,
  notify,
  resetNotificationsRuntime,
  type NotificationBroadcastMessage,
  type NotificationBroadcastRoute,
  type NotificationDataMatch,
  type NotificationJsonValue,
  type NotificationPage,
  type NotificationPagination,
  type NotificationQuery,
  type NotificationRecord,
  type NotificationSendContext,
  type NotificationStore,
} from '@holo-js/notifications'
import { ClientNotificationInboxStore } from '@holo-js/panels-client'
import {
  databaseNotificationPayload,
  holoNotificationStore,
  panelNotification,
  PanelNotificationAccessError,
  PanelNotificationInbox,
  type PanelNotificationScope,
} from '@holo-js/panels-core'
import { vi } from 'vitest'

interface AcceptanceRecipient {
  readonly broadcastChannels: readonly string[]
  readonly guard: string
  readonly id: string
  readonly panelId: string
  readonly tenantId: string
  readonly type: string
}

interface QueueDeliveryJob {
  handle(payload: QueueDeliveryPayload): Promise<unknown> | unknown
}

interface QueueDeliveryPayload {
  readonly anonymous: boolean
  readonly channel: string
  readonly notifiable: unknown
  readonly notificationType?: string
  readonly payload: unknown
  readonly route?: unknown
  readonly targetIndex: number
}

interface QueuedDelivery {
  readonly connection: string | null
  readonly jobName: string
  readonly queue: string | null
}

interface NotificationAcceptanceReport {
  readonly adminTenantIsolation: boolean
  readonly broadcastInvalidations: number
  readonly clientRefreshes: number
  readonly contractAtomicMutationScope: boolean
  readonly contractJsonScalarMatching: boolean
  readonly contractPagination: boolean
  readonly deleted: boolean
  readonly dispatchQueued: boolean
  readonly duplicateItemsPrevented: boolean
  readonly initialUnread: number
  readonly markedRead: boolean
  readonly markedUnread: boolean
  readonly navigationUrl: string | null
  readonly pollingContinued: boolean
  readonly queueDelivery: QueuedDelivery
  readonly storedCount: number
  readonly realtimeCoalesced: boolean
  readonly realtimeDeliveries: number
  readonly unauthorizedGuardRejected: boolean
  readonly vendorGuardIsolation: boolean
}

class DeterministicQueueModule {
  readonly #jobs = new Map<string, QueueDeliveryJob>()
  readonly deliveries: QueuedDelivery[] = []

  defineJob(definition: QueueDeliveryJob): QueueDeliveryJob {
    return definition
  }

  dispatch(jobName: string, payload: QueueDeliveryPayload): {
    delay(value: Date | number): ReturnType<DeterministicQueueModule['dispatch']>
    dispatch(): Promise<unknown>
    onConnection(name: string): ReturnType<DeterministicQueueModule['dispatch']>
    onQueue(name: string): ReturnType<DeterministicQueueModule['dispatch']>
  } {
    let connection: string | null = null
    let queue: string | null = null
    const chain = {
      delay: (_value: Date | number) => chain,
      dispatch: async (): Promise<unknown> => {
        const job = this.#jobs.get(jobName)
        if (!job) throw new Error(`Unknown notification queue job: ${jobName}`)
        this.deliveries.push(Object.freeze({ connection, jobName, queue }))
        return await job.handle(payload)
      },
      onConnection: (name: string) => {
        connection = name
        return chain
      },
      onQueue: (name: string) => {
        queue = name
        return chain
      },
    }
    return chain
  }

  getRegisteredQueueJob(name: string): QueueDeliveryJob | undefined {
    return this.#jobs.get(name)
  }

  registerQueueJob(definition: QueueDeliveryJob, options: { readonly name: string }): void {
    this.#jobs.set(options.name, definition)
  }
}

class InMemoryNotificationStore implements NotificationStore {
  readonly records: NotificationRecord[] = []

  async create(record: NotificationRecord): Promise<void> {
    this.records.push(record)
  }

  async delete(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    const selected = new Set(ids)
    const retained = this.records.filter(record => !selected.has(record.id) || !this.matches(record, query))
    const deleted = this.records.length - retained.length
    this.records.splice(0, this.records.length, ...retained)
    return deleted
  }

  async list(query: NotificationQuery, pagination: NotificationPagination): Promise<NotificationPage> {
    return this.page(this.scoped(query), pagination)
  }

  async markAsRead(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    return this.updateReadAt(query, ids, new Date('2026-07-28T00:00:00.000Z'))
  }

  async markAsUnread(query: NotificationQuery, ids: readonly string[]): Promise<number> {
    return this.updateReadAt(query, ids, null)
  }

  async unread(query: NotificationQuery, pagination: NotificationPagination): Promise<NotificationPage> {
    return this.page(this.scoped(query).filter(record => record.readAt == null), pagination)
  }

  private dataMatches(record: NotificationRecord, matches: readonly NotificationDataMatch[]): boolean {
    return matches.every(match => {
      let value: NotificationJsonValue = record.data
      for (const segment of match.path) {
        if (value === null || Array.isArray(value) || typeof value !== 'object') return false
        const objectValue = value as Readonly<Record<string, NotificationJsonValue>>
        if (!Object.hasOwn(objectValue, segment)) return false
        value = objectValue[segment] as NotificationJsonValue
      }
      return value === match.value
    })
  }

  private matches(record: NotificationRecord, query: NotificationQuery): boolean {
    return record.notifiableType === query.recipient.type
      && String(record.notifiableId) === String(query.recipient.id)
      && (query.type === undefined || record.type === query.type)
      && this.dataMatches(record, query.dataMatches ?? [])
  }

  private page(records: readonly NotificationRecord[], pagination: NotificationPagination): NotificationPage {
    const ordered = [...records].sort((left, right) => {
      const created = right.createdAt.getTime() - left.createdAt.getTime()
      return created !== 0 ? created : right.id.localeCompare(left.id)
    })
    return Object.freeze({
      records: Object.freeze(ordered.slice(pagination.offset, pagination.offset + pagination.limit)),
      limit: pagination.limit,
      offset: pagination.offset,
      total: ordered.length,
      unread: ordered.filter(record => record.readAt == null).length,
    })
  }

  private scoped(query: NotificationQuery): readonly NotificationRecord[] {
    return this.records.filter(record => this.matches(record, query))
  }

  private updateReadAt(query: NotificationQuery, ids: readonly string[], readAt: Date | null): number {
    const selected = new Set(ids)
    let updated = 0
    for (let index = 0; index < this.records.length; index++) {
      const record = this.records[index]
      if (!record || !selected.has(record.id) || !this.matches(record, query)) continue
      this.records[index] = Object.freeze({ ...record, readAt, updatedAt: new Date('2026-07-28T00:00:00.000Z') })
      updated++
    }
    return updated
  }
}

class InvalidationBroadcaster {
  readonly #listeners = new Set<() => void>()
  invalidations = 0
  realtimeDeliveries = 0

  send(
    message: NotificationBroadcastMessage,
    _context: NotificationSendContext<NotificationBroadcastRoute, NotificationBroadcastMessage>,
  ): void {
    if (message.event !== 'panels.notifications.invalidated') return
    this.invalidations++
    for (const listener of this.#listeners) {
      listener()
      listener()
      this.realtimeDeliveries += 2
    }
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

function createInbox(): PanelNotificationInbox {
  return new PanelNotificationInbox({
    authorization: {
      authorize: (_operation, scope) => scope.guard === 'admin' || scope.guard === 'vendor',
    },
    recipients: {
      resolve: scope => ({ id: scope.actorId, type: 'User' }),
    },
    store: holoNotificationStore(),
  })
}

async function verifyNotificationStoreContract(): Promise<{
  readonly atomicMutationScope: boolean
  readonly jsonScalarMatching: boolean
  readonly pagination: boolean
}> {
  const store = new InMemoryNotificationStore()
  const createdAt = new Date('2026-07-28T00:00:00.000Z')
  const records: readonly NotificationRecord[] = [
    {
      id: 'matched-unread',
      type: 'panels.contract',
      notifiableType: 'User',
      notifiableId: 'user-1',
      data: { tenant: { id: 'tenant-1' }, metadata: { archivedAt: null, attempts: 2, enabled: true } },
      readAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'matched-read',
      type: 'panels.contract',
      notifiableType: 'User',
      notifiableId: 'user-1',
      data: { tenant: { id: 'tenant-1' }, metadata: { archivedAt: null, attempts: 2, enabled: true } },
      readAt: createdAt,
      createdAt: new Date('2026-07-28T00:01:00.000Z'),
      updatedAt: createdAt,
    },
    {
      id: 'missing-null-path',
      type: 'panels.contract',
      notifiableType: 'User',
      notifiableId: 'user-1',
      data: { tenant: { id: 'tenant-1' }, metadata: { attempts: 2, enabled: true } },
      readAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'wrong-type',
      type: 'panels.other',
      notifiableType: 'User',
      notifiableId: 'user-1',
      data: { tenant: { id: 'tenant-1' }, metadata: { archivedAt: null, attempts: 2, enabled: true } },
      readAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'wrong-recipient',
      type: 'panels.contract',
      notifiableType: 'User',
      notifiableId: 'user-2',
      data: { tenant: { id: 'tenant-1' }, metadata: { archivedAt: null, attempts: 2, enabled: true } },
      readAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ]
  for (const record of records) await store.create(record)

  const query: NotificationQuery = {
    recipient: { id: 'user-1', type: 'User' },
    type: 'panels.contract',
    dataMatches: [
      { path: ['tenant', 'id'], value: 'tenant-1' },
      { path: ['metadata', 'archivedAt'], value: null },
      { path: ['metadata', 'attempts'], value: 2 },
      { path: ['metadata', 'enabled'], value: true },
    ],
  }
  const first = await store.list(query, { limit: 1, offset: 0 })
  const second = await store.list(query, { limit: 1, offset: 1 })
  const unread = await store.unread(query, { limit: 10, offset: 0 })
  const allIds = records.map(record => record.id)
  const markedRead = await store.markAsRead(query, allIds)
  const markedUnread = await store.markAsUnread(query, allIds)
  const deleted = await store.delete(query, allIds)

  return Object.freeze({
    atomicMutationScope: markedRead === 2
      && markedUnread === 2
      && deleted === 2
      && store.records.map(record => record.id).sort().join(',') === 'missing-null-path,wrong-recipient,wrong-type',
    jsonScalarMatching: first.total === 2
      && first.unread === 1
      && unread.total === 1
      && unread.unread === 1
      && unread.records[0]?.id === 'matched-unread',
    pagination: first.records[0]?.id === 'matched-read'
      && second.records[0]?.id === 'matched-unread'
      && first.limit === 1
      && first.offset === 0
      && second.offset === 1,
  })
}

function notificationFor(recipient: AcceptanceRecipient, id: string, title: string) {
  const presentation = panelNotification(id)
    .title(title)
    .body('A queued Holo database notification')
    .status('success')
    .action('read', 'Mark read', 'mark-read')
    .action('unread', 'Mark unread', 'mark-unread')
    .action('open', 'Open order', 'navigate', '/orders/42')
    .action('dismiss', 'Dismiss', 'dismiss')
    .presentation()
  return defineNotification<AcceptanceRecipient, {
    readonly broadcast: (target: AcceptanceRecipient) => NotificationBroadcastMessage
    readonly database: (target: AcceptanceRecipient) => { readonly data: NotificationJsonValue }
  }>({
    build: {
      broadcast: () => ({
        data: { panelId: recipient.panelId },
        event: 'panels.notifications.invalidated',
      }),
      database: () => ({
        data: databaseNotificationPayload(presentation, recipient),
      }),
    },
    queue: (_target, channel) => channel === 'database'
      ? { connection: 'acceptance', queue: 'notifications' }
      : false,
    type: 'panels.order-ready',
    via: () => ['database', 'broadcast'],
  })
}

async function waitForClientRefresh(store: ClientNotificationInboxStore, version: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('Notification client did not refresh after broadcast invalidation'))
    }, 1_000)
    const unsubscribe = store.subscribe(state => {
      if (state.version <= version || state.loading || state.items.length === 0) return
      clearTimeout(timeout)
      unsubscribe()
      resolve()
    })
  })
}

export async function runHoloNotificationRuntimeAcceptance(): Promise<NotificationAcceptanceReport> {
  vi.useFakeTimers()
  const queueModule = new DeterministicQueueModule()
  const holoStore = new InMemoryNotificationStore()
  const broadcaster = new InvalidationBroadcaster()
  const inbox = createInbox()
  const contract = await verifyNotificationStoreContract()
  const adminTenantOne: PanelNotificationScope = { actorId: 'user-1', guard: 'admin', panelId: 'commerce', tenantId: 'tenant-1' }
  const adminTenantTwo: PanelNotificationScope = { ...adminTenantOne, tenantId: 'tenant-2' }
  const vendorTenantOne: PanelNotificationScope = { ...adminTenantOne, guard: 'vendor' }
  const recipient: AcceptanceRecipient = {
    broadcastChannels: ['private-user-1'],
    guard: adminTenantOne.guard,
    id: String(adminTenantOne.actorId),
    panelId: adminTenantOne.panelId,
    tenantId: String(adminTenantOne.tenantId),
    type: 'User',
  }
  configureNotificationsRuntime({ broadcaster, store: holoStore })
  notificationsRuntimeInternals.setQueueModuleLoader(async () => queueModule)
  const client = new ClientNotificationInboxStore({
    polling: 1_000,
    realtime: broadcaster,
    transport: {
      delete: ids => inbox.delete(adminTenantOne, ids),
      list: (page, pageSize) => {
        clientListCalls++
        return inbox.list(adminTenantOne, page, pageSize)
      },
      markRead: ids => inbox.markRead(adminTenantOne, ids),
      markUnread: ids => inbox.markUnread(adminTenantOne, ids),
    },
  })
  let clientListCalls = 0

  try {
    await client.start()
    const clientVersion = client.state.version
    const callsBeforeRealtime = clientListCalls
    const refresh = waitForClientRefresh(client, clientVersion)
    const dispatch = await notify(recipient, notificationFor(recipient, 'order.ready', 'Order ready'))
    await refresh
    const realtimeCoalesced = clientListCalls === callsBeforeRealtime + 1
    const duplicateItemsPrevented = client.state.items.filter(item => item.presentation.id === 'order.ready').length === 1
    const callsBeforePolling = clientListCalls
    await vi.advanceTimersByTimeAsync(1_000)
    const pollingContinued = clientListCalls > callsBeforePolling
    await notify({ ...recipient, tenantId: 'tenant-2' }, notificationFor({ ...recipient, tenantId: 'tenant-2' }, 'order.other-tenant', 'Other tenant'))
    await notify({ ...recipient, guard: 'vendor' }, notificationFor({ ...recipient, guard: 'vendor' }, 'order.vendor', 'Vendor order'))

    const initialUnread = client.state.unread
    const notificationId = client.state.items[0]?.id
    if (!notificationId) throw new Error('Queued notification was not visible in the client inbox')
    await client.trigger(notificationId, 'read')
    const markedRead = client.state.items[0]?.read === true
    await client.trigger(notificationId, 'unread')
    const markedUnread = client.state.items[0]?.read === false
    const navigationUrl = await client.trigger(notificationId, 'open')
    const adminItems = await inbox.list(adminTenantOne)
    const otherTenantItems = await inbox.list(adminTenantTwo)
    const vendorItems = await inbox.list(vendorTenantOne)
    let unauthorizedGuardRejected = false
    try {
      await inbox.list({ ...adminTenantOne, guard: 'customer' })
    } catch (error: unknown) {
      unauthorizedGuardRejected = error instanceof PanelNotificationAccessError
    }
    await client.trigger(notificationId, 'dismiss')
    const delivery = queueModule.deliveries[0]
    if (!delivery) throw new Error('Queued notification did not pass through the queue module')

    return Object.freeze({
      adminTenantIsolation: adminItems.items.length === 1
        && adminItems.items[0]?.presentation.id === 'order.ready'
        && otherTenantItems.items.length === 1
        && otherTenantItems.items[0]?.presentation.id === 'order.other-tenant',
      broadcastInvalidations: broadcaster.invalidations,
      clientRefreshes: client.state.version - clientVersion,
      contractAtomicMutationScope: contract.atomicMutationScope,
      contractJsonScalarMatching: contract.jsonScalarMatching,
      contractPagination: contract.pagination,
      deleted: client.state.items.length === 0,
      dispatchQueued: dispatch.channels.some(channel => channel.channel === 'database' && channel.queued && channel.success),
      duplicateItemsPrevented,
      initialUnread,
      markedRead,
      markedUnread,
      navigationUrl,
      pollingContinued,
      queueDelivery: delivery,
      storedCount: holoStore.records.length,
      realtimeCoalesced,
      realtimeDeliveries: broadcaster.realtimeDeliveries,
      unauthorizedGuardRejected,
      vendorGuardIsolation: vendorItems.items.length === 1 && vendorItems.items[0]?.presentation.id === 'order.vendor',
    })
  } finally {
    client.dispose()
    resetNotificationsRuntime()
    vi.useRealTimers()
  }
}
