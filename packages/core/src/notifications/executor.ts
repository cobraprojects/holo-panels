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
import type { ActionExecutionResult, ActionTransaction } from '../actions/contracts'
import type { JsonObject } from '../protocol/json'
import type { GeneratedResourceOperationInput } from '../resources/generated-pages'
import { toJsonValue } from '../protocol/serialization'
import { executeNotificationAction, resolveNotificationActionPresentation } from './action-execution'
import { notificationExecution } from './presentation'
import { actionCacheIdentity } from '../actions/identity'
import { isAuthorizationError } from '@holo-js/authorization'
import { ActionExecutionError } from '../actions/engine'
import { NotificationActionRegistrationError, resolveResourceNotificationAction } from './action-reference'
import { executeToastAction } from './toast-actions'

export interface ExecutePanelDatabaseNotificationOperationOptions<TActor> {
  readonly panel: CompiledPanelDefinition<TActor>
  readonly payload: unknown
  readonly scope: PanelAuthenticatedScope<TActor>
  readonly store?: PanelNotificationStore
  readonly registry?: Readonly<Record<string, () => Promise<object>>>
  readonly context?: GeneratedResourceOperationInput['context']
  readonly transaction?: ActionTransaction
}

export type PanelDatabaseNotificationOperationResult = PanelDatabaseNotificationPage | Readonly<{ affected: number }> | ActionExecutionResult<number | string, unknown>

interface ListRequest {
  readonly action: 'list'
  readonly page: number
  readonly pageSize: number
}

interface MutationRequest {
  readonly action: Exclude<PanelNotificationOperation, 'list'>
  readonly ids: readonly string[]
}

interface ExecuteRequest {
  readonly action: 'execute'
  readonly actionId: string
  readonly idempotencyKey: string
  readonly input: JsonObject
  readonly notificationId: string
}

type NotificationRequest = ListRequest | MutationRequest | ExecuteRequest | Omit<ExecuteRequest, 'action' | 'notificationId'> & { readonly action: 'execute-toast', readonly token: string }
const NOTIFICATION_ID = /^[A-Za-z0-9._:-]{1,200}$/u

interface TenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & TenantScopedQuery<TQuery>
}

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
  if (payload.action === 'execute-toast') {
    if (typeof payload.token !== 'string' || payload.token.length > 100_000) throw new PanelNotificationRequestError('Toast actions require a signed token')
    const execution = parseRequest({ ...payload, action: 'execute', notificationId: 'toast' })
    if (execution.action !== 'execute') throw new PanelNotificationRequestError('Invalid toast action')
    return { action: 'execute-toast', actionId: execution.actionId, idempotencyKey: execution.idempotencyKey, input: execution.input, token: payload.token }
  }
  if (payload.action === 'execute') {
    if (typeof payload.notificationId !== 'string' || !NOTIFICATION_ID.test(payload.notificationId)
      || typeof payload.actionId !== 'string' || !NOTIFICATION_ID.test(payload.actionId)
      || typeof payload.idempotencyKey !== 'string' || !payload.idempotencyKey.trim() || payload.idempotencyKey.length > 200
      || !isRecord(payload.input)) throw new PanelNotificationRequestError('Notification execution requires notification and action IDs, input, and an idempotency key')
    const input = toJsonValue(payload.input)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PanelNotificationRequestError('Notification actions require JSON input')
    return { action: 'execute', actionId: payload.actionId, idempotencyKey: payload.idempotencyKey, input, notificationId: payload.notificationId }
  }
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
  if (request.action === 'execute-toast') return executeToastAction({ ...options, panel: options.panel as CompiledPanelDefinition<object>, scope: options.scope as PanelAuthenticatedScope<object> }, request)
  const operation = request.action === 'execute' ? 'list' : request.action
  const inboxOptions = options.panel.server.notifications?.inbox
  if (!inboxOptions || options.panel.manifest.databaseNotifications === null) {
    throw new PanelNotificationAccessError(operation)
  }
  if (!await inboxOptions.authorize(operation, options.scope)) throw new PanelNotificationAccessError(operation)
  const resolved = await inboxOptions.resolve(options.scope)
  if (!isRecord(resolved)) throw new PanelNotificationAccessError(operation)
  const recipient = validateRecipient(resolved.recipient, operation)
  if (
    resolved.tenantId !== null
    && (
      typeof resolved.tenantId !== 'string'
      && typeof resolved.tenantId !== 'number'
      || typeof resolved.tenantId === 'number' && !Number.isFinite(resolved.tenantId)
    )
  ) {
    throw new PanelNotificationAccessError(operation)
  }
  const scope = notificationScope(options.panel, { recipient, tenantId: resolved.tenantId })
  const inbox = new PanelNotificationInbox({
    authorization: { authorize: () => true },
    recipients: { resolve: () => recipient },
    store: options.store ?? holoNotificationStore(),
  })
  const actionContext = async (): Promise<GeneratedResourceOperationInput['context']> => {
    const actor = options.scope.actor
    if (!actor || typeof actor !== 'object' || options.scope.panelId !== options.panel.manifest.id || options.scope.guard !== options.panel.guard) throw new PanelNotificationAccessError('list')
    const tenancy = await options.panel.server.tenancy?.activeContext(options.scope)
    if (tenancy && String(tenancy.tenantId) !== String(resolved.tenantId)) throw new PanelNotificationAccessError('list')
    return {
      ...options.context,
      actor,
      signal: options.scope.signal,
      tenant: tenancy?.tenant ?? options.context?.tenant ?? resolved.tenantId,
      ...(tenancy ? {
        scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>),
        tenantBindings: tenancy.tenantBindings,
      } : {}),
    }
  }
  if (request.action === 'list') {
    const page = await inbox.list(scope, request.page, request.pageSize)
    if (!options.registry) return page
    const context = await actionContext()
    const items = await Promise.all(page.items.map(async item => {
      const actions = await Promise.all(item.presentation.actions.map(async value => {
        const action = notificationExecution(value)
        if (!action) return value
        try {
          return await resolveNotificationActionPresentation({ action, context, panel: options.panel as CompiledPanelDefinition<object>, registry: options.registry! })
        } catch (error: unknown) {
          if (error instanceof NotificationActionRegistrationError || error instanceof ActionExecutionError && error.code === 'denied' || isAuthorizationError(error)) return null
          throw error
        }
      }))
      return { ...item, presentation: { ...item.presentation, actions: actions.filter(value => value !== null) } }
    }))
    return { ...page, items }
  }
  if (request.action === 'execute') {
    if (!options.registry) throw new PanelNotificationAccessError('list')
    const context = await actionContext()
    if (options.scope.signal.aborted) throw options.scope.signal.reason
    const item = await inbox.find(scope, request.notificationId)
    const attached = item?.presentation.actions.flatMap(value => notificationExecution(value) ?? []) ?? []
    let action = attached.find(candidate => candidate.id === request.actionId)
    if (!action) {
      for (const candidate of attached) {
        const reference = candidate.execution
        const loader = reference ? options.registry[`${scope.panelId}:resource:${reference.resourceId}`] : undefined
        if (!loader || !reference) continue
        try {
          resolveResourceNotificationAction(await loader(), reference, request.actionId)
          if (action) throw new PanelNotificationAccessError('list')
          action = candidate
        } catch (error: unknown) {
          if (!(error instanceof NotificationActionRegistrationError)) throw error
        }
      }
    }
    if (!item || !action) throw new PanelNotificationAccessError('list')
    const actor = actionCacheIdentity(context.actor)
    const tenant = JSON.stringify([scope.panelId, scope.guard, options.scope.provider, scope.tenantId, recipient, item.id])
    return executeNotificationAction({ action, actionId: request.actionId, context, panel: options.panel as CompiledPanelDefinition<object>, registry: options.registry, transaction: options.transaction }, request.input, request.idempotencyKey, actor === null ? null : { actor, tenant })
  }
  const affected = request.action === 'delete'
    ? await inbox.delete(scope, request.ids)
    : request.action === 'mark-read'
      ? await inbox.markRead(scope, request.ids)
      : await inbox.markUnread(scope, request.ids)
  return Object.freeze({ affected })
}
