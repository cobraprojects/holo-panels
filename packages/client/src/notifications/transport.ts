import {
  defineTransportOperation,
  isPanelDatabaseNotificationPayload,
  type JsonValue,
  type PanelDatabaseNotificationItem,
  type PanelDatabaseNotificationPage,
  type PanelNotificationPresentation,
  type ResponseEnvelope,
} from '@holo-js/panels-core'
import type { PanelsTransport } from '../transport'
import type { ClientNotificationTransport } from './contracts'
import { publishPanelActionFailure } from './feedback'
import type { ClientActionRequest } from '../actions/contracts'

export interface PanelNotificationTransportOptions {
  readonly applyEffects?: (response: Readonly<ResponseEnvelope>) => Promise<void>
  readonly endpoint: string
  readonly panelId: string
}

const LIST_OPERATION = defineTransportOperation({ data: Object, payload: Object }, {
  kind: 'read',
  name: 'notification',
})
const MUTATION_OPERATION = defineTransportOperation({ data: Object, payload: Object }, {
  kind: 'mutation',
  name: 'notification',
  supportsIdempotency: true,
})
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/u
const PANEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const code = character.codePointAt(0)
    return code !== undefined && (code <= 31 || code === 127)
  })
}

function validateOptions(options: PanelNotificationTransportOptions): PanelNotificationTransportOptions {
  if (
    !options.endpoint.startsWith('/')
    || options.endpoint.includes('//')
    || /[\\?#]/u.test(options.endpoint)
    || hasControlCharacter(options.endpoint)
    || /%(?:2e|2f|3f|5c|23)/iu.test(options.endpoint)
    || options.endpoint.split('/').some(segment => segment === '.' || segment === '..')
  ) {
    throw new Error('[Holo Panels] Notification endpoints must be root-relative same-origin paths.')
  }
  if (!PANEL_ID_PATTERN.test(options.panelId)) {
    throw new Error('[Holo Panels] Notification panel IDs must be canonical identifiers.')
  }
  return Object.freeze({ ...options })
}

function validatePagination(page: number, pageSize: number): void {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('[Holo Panels] Notification pages must be positive integers.')
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('[Holo Panels] Notification page sizes must be integers between 1 and 100.')
  }
  if ((page - 1) * pageSize > 1_000_000) {
    throw new Error('[Holo Panels] Notification pagination offsets cannot exceed 1000000.')
  }
}

function validateIds(ids: readonly string[]): readonly string[] {
  if (!Array.isArray(ids) || ids.length > 100) {
    throw new Error('[Holo Panels] Notification mutations accept at most 100 IDs.')
  }
  if (ids.some(id => typeof id !== 'string' || !IDENTIFIER_PATTERN.test(id))) {
    throw new Error('[Holo Panels] Notification IDs must be canonical identifiers.')
  }
  return Object.freeze([...new Set(ids)])
}

function validPresentation(value: unknown): value is PanelNotificationPresentation {
  try {
    return isPanelDatabaseNotificationPayload({
      panel: {
        guard: 'response',
        panelId: 'response',
        presentation: value,
        tenantId: null,
        version: 1,
      },
    })
  } catch {
    return false
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validateItem(value: unknown): PanelDatabaseNotificationItem {
  if (!isRecord(value) || typeof value.id !== 'string' || !IDENTIFIER_PATTERN.test(value.id)) {
    throw new Error('[Holo Panels] Notification list items require unique canonical IDs.')
  }
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) {
    throw new Error('[Holo Panels] Notification list items require valid creation timestamps.')
  }
  if (typeof value.read !== 'boolean' || typeof value.type !== 'string' || !value.type.trim() || value.type.length > 200) {
    throw new Error('[Holo Panels] Notification list items contain invalid metadata.')
  }
  if (!validPresentation(value.presentation)) {
    throw new Error('[Holo Panels] Notification list items contain invalid presentations.')
  }
  return Object.freeze({
    createdAt: value.createdAt,
    id: value.id,
    presentation: Object.freeze(structuredClone(value.presentation)),
    read: value.read,
    type: value.type,
  })
}

function validatePage(
  value: JsonValue,
  requestedPage: number,
  requestedPageSize: number,
): PanelDatabaseNotificationPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('[Holo Panels] Notification list responses must contain a page.')
  }
  if (value.page !== requestedPage || value.pageSize !== requestedPageSize) {
    throw new Error('[Holo Panels] Notification list responses must match the requested pagination.')
  }
  if (!isNonNegativeInteger(value.total)) {
    throw new Error('[Holo Panels] Notification list totals must be non-negative integers.')
  }
  if (!isNonNegativeInteger(value.unread) || value.unread > value.total) {
    throw new Error('[Holo Panels] Notification unread counts must be valid scoped totals.')
  }
  if (value.items.length > requestedPageSize || value.items.length > value.total) {
    throw new Error('[Holo Panels] Notification list responses exceed the requested page size.')
  }
  const ids = new Set<string>()
  const items = (value.items as readonly unknown[]).map(item => {
    const validated = validateItem(item)
    if (ids.has(validated.id)) {
      throw new Error('[Holo Panels] Notification list items require unique canonical IDs.')
    }
    ids.add(validated.id)
    return validated
  })
  return Object.freeze({
    items: Object.freeze(items),
    page: requestedPage,
    pageSize: requestedPageSize,
    total: value.total,
    unread: value.unread,
  })
}

function validateAffected(value: JsonValue, requested: number): number {
  if (!isRecord(value) || !isNonNegativeInteger(value.affected) || value.affected > requested) {
    throw new Error('[Holo Panels] Notification mutation responses require a valid affected count.')
  }
  return value.affected
}

function requireSuccess(response: Awaited<ReturnType<PanelsTransport['execute']>>): JsonValue {
  if (!response.ok) throw new Error(`[Holo Panels] Notification request failed: ${response.error.message}`)
  return response.data
}

export function createPanelNotificationTransport(
  transport: PanelsTransport,
  options: PanelNotificationTransportOptions,
): ClientNotificationTransport {
  const resolved = validateOptions(options)

  const mutate = async (
    action: 'delete' | 'mark-read' | 'mark-unread',
    ids: readonly string[],
    signal: AbortSignal,
  ): Promise<number> => {
    const selected = validateIds(ids)
    if (selected.length === 0) return 0
    const response = await transport.execute(MUTATION_OPERATION, {
      endpoint: resolved.endpoint,
      panelId: resolved.panelId,
      payload: { action, ids: [...selected] },
      signal,
    })
    return validateAffected(requireSuccess(response), selected.length)
  }

  const execute = async (target: { readonly notificationId: string } | { readonly token: string }, request: ClientActionRequest, signal: AbortSignal) => {
      validateIds([request.actionId])
      if ('notificationId' in target) validateIds([target.notificationId])
      if (request.mount !== 'notification' || request.recordIds?.length) throw new Error('Notification actions require a notification mount without record IDs')
      const response = await transport.execute(MUTATION_OPERATION, {
        endpoint: resolved.endpoint,
        idempotencyKey: request.idempotencyKey,
        panelId: resolved.panelId,
        payload: { action: 'token' in target ? 'execute-toast' : 'execute', actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, ...target },
        signal,
      }).catch((cause: unknown) => {
        if (!signal.aborted) publishPanelActionFailure(resolved.panelId)
        throw cause
      })
      if (signal.aborted) throw signal.reason
      try {
        await resolved.applyEffects?.(response)
      } catch (cause: unknown) {
        publishPanelActionFailure(resolved.panelId, response.effects)
        throw cause
      }
      if (!response.ok) {
        publishPanelActionFailure(resolved.panelId, response.effects)
        throw new Error(response.error.message)
      }
      const data = response.data
      if (!isRecord(data) || data.status !== 'succeeded') {
        publishPanelActionFailure(resolved.panelId, response.effects)
        throw new Error('The notification action could not be completed')
      }
      return { effects: [], items: [], result: data.result, status: 'succeeded' as const }
  }

  return Object.freeze({
    delete: (ids: readonly string[], signal: AbortSignal) => mutate('delete', ids, signal),
    executeAction: (notificationId: string, request: ClientActionRequest, signal: AbortSignal) => execute({ notificationId }, request, signal),
    executeToastAction: (token: string, request: ClientActionRequest, signal: AbortSignal) => execute({ token }, request, signal),
    async list(page: number, pageSize: number, signal: AbortSignal): Promise<PanelDatabaseNotificationPage> {
      validatePagination(page, pageSize)
      const response = await transport.execute(LIST_OPERATION, {
        endpoint: resolved.endpoint,
        panelId: resolved.panelId,
        payload: { action: 'list', page, pageSize },
        signal,
      })
      return validatePage(requireSuccess(response), page, pageSize)
    },
    markRead: (ids: readonly string[], signal: AbortSignal) => mutate('mark-read', ids, signal),
    markUnread: (ids: readonly string[], signal: AbortSignal) => mutate('mark-unread', ids, signal),
  })
}
