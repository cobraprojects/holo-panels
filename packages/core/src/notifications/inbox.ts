import type { JsonObject } from '../protocol/json'
import type {
  PanelDatabaseNotificationItem,
  PanelDatabaseNotificationPage,
  PanelDatabaseNotificationPayload,
  PanelNotificationAuthorization,
  PanelNotificationOperation,
  PanelNotificationPresentation,
  PanelNotificationRecipientResolver,
  PanelNotificationRecord,
  PanelNotificationScope,
  PanelNotificationStore,
  PanelNotificationStoreQuery,
} from './contracts'
import { PanelNotification } from './notification'

const NOTIFICATION_TYPE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u

export class PanelNotificationAccessError extends Error {
  constructor(operation: PanelNotificationOperation) {
    super(`Panel notification operation denied: ${operation}`)
    this.name = 'PanelNotificationAccessError'
  }
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
  })
}

function isSafeNavigationUrl(value: string): boolean {
  if (value.includes('\\') || hasControlCharacter(value)) return false
  if (value.startsWith('/')) return !value.startsWith('//')
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

function parsedPresentation(value: unknown): PanelNotificationPresentation | null {
  if (!isObject(value)) return null
  const presentation = value
  if (typeof presentation.id !== 'string' || typeof presentation.title !== 'string' || !Array.isArray(presentation.actions)) return null
  if (presentation.body !== null && typeof presentation.body !== 'string') return null
  if (presentation.icon !== null && typeof presentation.icon !== 'string') return null
  if (presentation.color !== null && typeof presentation.color !== 'string') return null
  if (presentation.duration !== null && typeof presentation.duration !== 'number') return null
  if (typeof presentation.closeable !== 'boolean' || typeof presentation.persistent !== 'boolean') return null
  if (presentation.status !== 'danger' && presentation.status !== 'info' && presentation.status !== 'success' && presentation.status !== 'warning') return null
  try {
    const builder = new PanelNotification(presentation.id)
      .title(presentation.title)
      .body(presentation.body)
      .icon(presentation.icon)
      .color(presentation.color)
      .status(presentation.status)
      .closeable(presentation.closeable)
      .duration(presentation.duration)
      .persistent(presentation.persistent)
    for (const value of presentation.actions) {
      if (!isObject(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return null
      if (value.kind !== 'dismiss' && value.kind !== 'mark-read' && value.kind !== 'mark-unread' && value.kind !== 'navigate') return null
      if (value.url !== null && typeof value.url !== 'string') return null
      if (value.kind === 'navigate' && (typeof value.url !== 'string' || !isSafeNavigationUrl(value.url))) return null
      if (value.kind !== 'navigate' && value.url !== null) return null
      builder.action(value.id, value.label, value.kind, value.url)
    }
    return builder.presentation()
  } catch {
    return null
  }
}

function parsedPayload(value: unknown): PanelDatabaseNotificationPayload | null {
  if (!isObject(value) || !isObject(value.panel)) return null
  const panel = value.panel
  if (panel.version !== 1 || typeof panel.panelId !== 'string' || !panel.panelId.trim()) return null
  if (typeof panel.guard !== 'string' || !panel.guard.trim()) return null
  if (panel.tenantId !== null && (
    typeof panel.tenantId !== 'string'
    || panel.tenantId !== panel.tenantId.trim()
    || panel.tenantId.length === 0
    || panel.tenantId.length > 200
  )) return null
  const presentation = parsedPresentation(panel.presentation)
  if (!presentation) return null
  return {
    panel: {
      guard: panel.guard,
      panelId: panel.panelId,
      presentation,
      tenantId: panel.tenantId,
      version: 1,
    },
  }
}

function createdAtIso(value: unknown): string | null {
  if (!(value instanceof Date)) return null
  try {
    const timestamp = Date.prototype.getTime.call(value)
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
  } catch {
    return null
  }
}

function notificationType(value: unknown): string | null {
  if (value === undefined) return 'default'
  if (typeof value !== 'string' || value.length > 200 || !NOTIFICATION_TYPE.test(value)) return null
  return value
}

function presentationFrom(record: PanelNotificationRecord, query: PanelNotificationStoreQuery): PanelNotificationPresentation | null {
  const payload = parsedPayload(record.data)
  if (!payload || payload.panel.version !== query.version) return null
  if (payload.panel.panelId !== query.panelId || payload.panel.guard !== query.guard) return null
  return payload.panel.tenantId === query.tenantId ? payload.panel.presentation : null
}

function frozen<TValue>(value: TValue): Readonly<TValue> {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const nested of Object.values(value)) frozen(nested)
  }
  return value
}

export class PanelNotificationInbox {
  readonly #authorization: PanelNotificationAuthorization
  readonly #recipients: PanelNotificationRecipientResolver
  readonly #store: PanelNotificationStore

  constructor(options: {
    readonly authorization: PanelNotificationAuthorization
    readonly recipients: PanelNotificationRecipientResolver
    readonly store: PanelNotificationStore
  }) {
    this.#authorization = options.authorization
    this.#recipients = options.recipients
    this.#store = options.store
  }

  async list(scope: PanelNotificationScope, page = 1, pageSize = 20): Promise<PanelDatabaseNotificationPage> {
    await this.authorize('list', scope)
    if (!Number.isInteger(page) || page < 1) throw new Error('Notification page must be a positive integer')
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Notification page size must be between 1 and 100')
    const query = await this.resolveQuery(scope, 'list')
    const result = await this.#store.list(query, { limit: pageSize, offset: (page - 1) * pageSize })
    return Object.freeze({
      items: this.itemsFrom(result.records, query),
      page,
      pageSize,
      total: result.total,
      unread: result.unread,
    })
  }

  markRead(scope: PanelNotificationScope, ids: readonly string[]): Promise<number> {
    return this.mutate('mark-read', scope, ids, (query, selected) => this.#store.markAsRead(query, selected))
  }

  markUnread(scope: PanelNotificationScope, ids: readonly string[]): Promise<number> {
    return this.mutate('mark-unread', scope, ids, (query, selected) => this.#store.markAsUnread(query, selected))
  }

  delete(scope: PanelNotificationScope, ids: readonly string[]): Promise<number> {
    return this.mutate('delete', scope, ids, (query, selected) => this.#store.delete(query, selected))
  }

  async markAllRead(scope: PanelNotificationScope): Promise<number> {
    const first = await this.list(scope, 1, 100)
    const ids = first.items.filter(item => !item.read).map(item => item.id)
    const pages = Math.ceil(first.total / first.pageSize)
    for (let page = 2; page <= pages; page++) {
      const next = await this.list(scope, page, 100)
      ids.push(...next.items.filter(item => !item.read).map(item => item.id))
    }
    let updated = 0
    for (let index = 0; index < ids.length; index += 100) {
      updated += await this.markRead(scope, ids.slice(index, index + 100))
    }
    return updated
  }

  private async authorize(operation: PanelNotificationOperation, scope: PanelNotificationScope): Promise<void> {
    if (!await this.#authorization.authorize(operation, scope)) throw new PanelNotificationAccessError(operation)
  }

  private itemsFrom(
    records: readonly PanelNotificationRecord[],
    query: PanelNotificationStoreQuery,
  ): readonly PanelDatabaseNotificationItem[] {
    const seen = new Set<string>()
    return Object.freeze(records.flatMap((record): PanelDatabaseNotificationItem[] => {
      if (record.notifiableType !== query.recipient.type || String(record.notifiableId) !== String(query.recipient.id)) return []
      if (!/^[A-Za-z0-9._:-]{1,200}$/u.test(record.id) || seen.has(record.id)) return []
      const createdAt = createdAtIso(record.createdAt)
      const type = notificationType(record.type)
      if (!createdAt || !type) return []
      const presentation = presentationFrom(record, query)
      if (!presentation) return []
      seen.add(record.id)
      return [{
        createdAt,
        id: record.id,
        presentation: frozen(structuredClone(presentation)),
        read: record.readAt != null,
        type,
      }]
    }))
  }

  private async mutate(
    operation: PanelNotificationOperation,
    scope: PanelNotificationScope,
    ids: readonly string[],
    execute: (query: PanelNotificationStoreQuery, ids: readonly string[]) => Promise<number>,
  ): Promise<number> {
    await this.authorize(operation, scope)
    const requested = [...new Set(ids)]
    if (requested.length > 100) throw new Error('At most 100 notifications may be mutated at once')
    if (requested.some(id => !/^[A-Za-z0-9._:-]{1,200}$/u.test(id))) throw new Error('Invalid notification ID')
    if (requested.length === 0) return 0
    const query = await this.resolveQuery(scope, operation)
    const allowed = new Set<string>()
    let offset = 0
    let total = 0
    do {
      const visible = await this.#store.list(query, { limit: 100, offset })
      total = visible.total
      for (const item of this.itemsFrom(visible.records, query)) allowed.add(item.id)
      offset += 100
    } while (offset < total)
    if (requested.some(id => !allowed.has(id))) {
      throw new PanelNotificationAccessError(operation)
    }
    return await execute(query, requested)
  }

  private async resolveQuery(
    scope: PanelNotificationScope,
    operation: PanelNotificationOperation,
  ): Promise<PanelNotificationStoreQuery> {
    const recipient = await this.#recipients.resolve(scope)
    if ((typeof recipient.id !== 'string' && typeof recipient.id !== 'number') || !String(recipient.id).trim()) {
      throw new PanelNotificationAccessError(operation)
    }
    if (typeof recipient.type !== 'string' || recipient.type !== recipient.type.trim() || !recipient.type || recipient.type.length > 200) {
      throw new PanelNotificationAccessError(operation)
    }
    if (String(recipient.id) !== String(scope.actorId)) throw new PanelNotificationAccessError(operation)
    const guard = typeof scope.guard === 'string' ? scope.guard.trim() : ''
    const panelId = typeof scope.panelId === 'string' ? scope.panelId.trim() : ''
    const tenantId = scope.tenantId === null ? null : String(scope.tenantId).trim()
    if (!guard || guard.length > 100 || !panelId || panelId.length > 100) throw new PanelNotificationAccessError(operation)
    if (tenantId !== null && (!tenantId || tenantId.length > 200)) throw new PanelNotificationAccessError(operation)
    return Object.freeze({ guard, panelId, recipient: Object.freeze({ ...recipient }), tenantId, version: 1 })
  }
}

export function isPanelDatabaseNotificationPayload(value: unknown): value is PanelDatabaseNotificationPayload {
  return parsedPayload(value) !== null
}
