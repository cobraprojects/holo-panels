import type { CompiledPanelDefinition, PanelAuthenticatedScope } from '../panels/contracts'
import type {
  PanelDatabaseNotificationPage,
  PanelNotificationOperation,
  PanelNotificationRecipient,
  PanelNotificationScope,
  PanelNotificationStore,
} from './contracts'
import { holoNotificationStore } from './holo-store'
import { PanelNotificationAccessError, PanelNotificationInbox } from './inbox'

export interface ExecutePanelDatabaseNotificationOperationOptions<TActor> {
  readonly panel: CompiledPanelDefinition<TActor>
  readonly payload: unknown
  readonly scope: PanelAuthenticatedScope<TActor>
  readonly store?: PanelNotificationStore
}

export type PanelDatabaseNotificationOperationResult = PanelDatabaseNotificationPage | Readonly<{ affected: number }>

interface ListRequest {
  readonly action: 'list'
  readonly page: number
  readonly pageSize: number
}

interface MutationRequest {
  readonly action: Exclude<PanelNotificationOperation, 'list'>
  readonly ids: readonly string[]
}

type NotificationRequest = ListRequest | MutationRequest
const NOTIFICATION_ID = /^[A-Za-z0-9._:-]{1,200}$/u

export class PanelNotificationRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PanelNotificationRequestError'
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function parseRequest(payload: unknown): NotificationRequest {
  if (!isRecord(payload)) throw new PanelNotificationRequestError('Panel notification requests require an object payload')
  if (payload.action === 'list') {
    if (!Number.isSafeInteger(payload.page) || (payload.page as number) < 1) {
      throw new PanelNotificationRequestError('Notification page must be a positive integer')
    }
    if (!Number.isSafeInteger(payload.pageSize) || (payload.pageSize as number) < 1 || (payload.pageSize as number) > 100) {
      throw new PanelNotificationRequestError('Notification page size must be between 1 and 100')
    }
    const page = payload.page as number
    const pageSize = payload.pageSize as number
    if ((page - 1) * pageSize > 1_000_000) throw new PanelNotificationRequestError('Notification pagination offset cannot exceed 1000000')
    return Object.freeze({ action: 'list', page, pageSize })
  }
  if (payload.action !== 'delete' && payload.action !== 'mark-read' && payload.action !== 'mark-unread') {
    throw new PanelNotificationRequestError('Unknown panel notification operation')
  }
  if (!Array.isArray(payload.ids)) throw new PanelNotificationRequestError('Panel notification mutations require notification IDs')
  if (payload.ids.length > 100) throw new PanelNotificationRequestError('Panel notification mutations accept at most 100 IDs')
  if (payload.ids.some(id => typeof id !== 'string' || !NOTIFICATION_ID.test(id))) {
    throw new PanelNotificationRequestError('Panel notification IDs must be canonical identifiers')
  }
  return Object.freeze({ action: payload.action, ids: Object.freeze([...payload.ids]) as readonly string[] })
}

function validateRecipient(value: unknown, operation: PanelNotificationOperation): PanelNotificationRecipient {
  if (!isRecord(value)) throw new PanelNotificationAccessError(operation)
  if (
    (typeof value.id !== 'string' && typeof value.id !== 'number')
    || typeof value.id === 'number' && !Number.isFinite(value.id)
    || !String(value.id).trim()
  ) {
    throw new PanelNotificationAccessError(operation)
  }
  if (typeof value.type !== 'string' || value.type !== value.type.trim() || !value.type || value.type.length > 200) {
    throw new PanelNotificationAccessError(operation)
  }
  return Object.freeze({ id: value.id, type: value.type })
}

function notificationScope(
  panel: Pick<CompiledPanelDefinition<unknown>, 'guard' | 'manifest'>,
  identity: { readonly recipient: PanelNotificationRecipient, readonly tenantId: string | number | null },
): PanelNotificationScope {
  return Object.freeze({
    actorId: identity.recipient.id,
    guard: panel.guard,
    panelId: panel.manifest.id,
    tenantId: identity.tenantId,
  })
}

export async function executePanelDatabaseNotificationOperation<TActor>(
  options: ExecutePanelDatabaseNotificationOperationOptions<TActor>,
): Promise<PanelDatabaseNotificationOperationResult> {
  const request = parseRequest(options.payload)
  const inboxOptions = options.panel.server.notifications?.inbox
  if (!inboxOptions || options.panel.manifest.databaseNotifications === null) {
    throw new PanelNotificationAccessError(request.action)
  }
  if (!await inboxOptions.authorize(request.action, options.scope)) throw new PanelNotificationAccessError(request.action)
  const resolved = await inboxOptions.resolve(options.scope)
  if (!isRecord(resolved)) throw new PanelNotificationAccessError(request.action)
  const recipient = validateRecipient(resolved.recipient, request.action)
  if (
    resolved.tenantId !== null
    && (
      typeof resolved.tenantId !== 'string'
      && typeof resolved.tenantId !== 'number'
      || typeof resolved.tenantId === 'number' && !Number.isFinite(resolved.tenantId)
    )
  ) {
    throw new PanelNotificationAccessError(request.action)
  }
  const scope = notificationScope(options.panel, { recipient, tenantId: resolved.tenantId })
  const inbox = new PanelNotificationInbox({
    authorization: { authorize: () => true },
    recipients: { resolve: () => recipient },
    store: options.store ?? holoNotificationStore(),
  })
  if (request.action === 'list') return await inbox.list(scope, request.page, request.pageSize)
  const affected = request.action === 'delete'
    ? await inbox.delete(scope, request.ids)
    : request.action === 'mark-read'
      ? await inbox.markRead(scope, request.ids)
      : await inbox.markUnread(scope, request.ids)
  return Object.freeze({ affected })
}
