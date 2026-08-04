import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PanelsReact from '@holo-js/panels-react'
import {
  createRequestEnvelope,
  definePanel,
  PanelNotificationAccessError,
  PanelNotificationRequestError,
  TRANSPORT_REQUEST_FIELD,
  type HoloAuth,
  type JsonObject,
  type PanelNotificationOperation,
  type ResponseEnvelope,
} from '@holo-js/panels-core'
import { createPanelOperationRoute } from '../src/operation'
import type { NextPanelsRuntime } from '../src/contracts'

const notificationExecutor = vi.hoisted(() => vi.fn())

class Actor {
  declare readonly id: number
}

vi.mock('@holo-js/panels-react', async importOriginal => ({
  ...await importOriginal<typeof PanelsReact>(),
  executePanelDatabaseNotificationOperation: notificationExecutor,
}))

vi.mock('@holo-js/security/next/server', () => ({
  csrfProtection: () => (request: Request) => request.headers.get('x-csrf-token') === 'valid'
    ? undefined
    : new Response('CSRF token mismatch.', { status: 419 }),
}))

const actor = { id: 7 }
const authorizations: PanelNotificationOperation[] = []
let deniedOperation: PanelNotificationOperation | null = null
const auth: HoloAuth<object> = {
  guard: () => ({
    provider: async () => 'session',
    user: async () => actor,
  }),
}
const panel = definePanel('admin', Actor)
  .guard('web')
  .databaseNotifications()
  .databaseNotificationInbox({
    authorize(operation) {
      authorizations.push(operation)
      return operation !== deniedOperation
    },
    resolve(scope) {
      return {
        realtimeChannel: `panels.admin.${scope.actor.id}`,
        recipient: { id: scope.actor.id, type: 'User' },
        tenantId: 'tenant-a',
      }
    },
  })
  .compile()

function runtime(panelDefinition = panel): NextPanelsRuntime {
  return {
    auth,
    async execute(input) {
      return {
        data: await notificationExecutor({
          panel: panelDefinition,
          payload: input.payload,
          scope: {
            actor: input.scope.actor,
            guard: panelDefinition.guard,
            panelId: input.panelId,
            provider: input.scope.provider,
            signal: input.scope.signal,
          },
        }),
      }
    },
    registry: {
      'admin:panel:admin': async () => panelDefinition,
    },
  }
}

function operationRequest(payload: JsonObject): Request {
  const envelope = createRequestEnvelope({ id: 'request-p13-endpoint', operation: 'notification', panelId: 'admin', payload })
  return new Request('https://example.test/_holo/panels/admin/notification', {
    body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: JSON.stringify(envelope), _token: 'valid' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
    method: 'POST',
  })
}

async function execute(payload: JsonObject, panelDefinition = panel): Promise<{ readonly body: ResponseEnvelope, readonly status: number }> {
  const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime(panelDefinition) })
  const response = await route.POST(operationRequest(payload), {
    params: Promise.resolve({ operation: 'notification', panelId: 'admin' }),
  })
  return { body: await response.json() as ResponseEnvelope, status: response.status }
}

beforeEach(() => {
  authorizations.length = 0
  deniedOperation = null
  notificationExecutor.mockImplementation(async options => {
    const payload = options.payload as Readonly<Record<string, unknown>>
    const action = payload.action
    if (action !== 'list' && action !== 'mark-read' && action !== 'mark-unread' && action !== 'delete') {
      throw new PanelNotificationRequestError('Unknown panel notification operation')
    }
    if (action === 'list' && payload.page !== 1) throw new PanelNotificationRequestError('Notification page must be a positive integer')
    const inbox = options.panel.server.notifications?.inbox
    if (!inbox) throw new PanelNotificationAccessError(action)
    if (!await inbox.authorize(action, options.scope)) throw new PanelNotificationAccessError(action)
    const identity = await inbox.resolve(options.scope)
    if (action === 'list') {
      return {
        items: [],
        page: payload.page,
        pageSize: payload.pageSize,
        total: 0,
        unread: 0,
      }
    }
    if (!Array.isArray(payload.ids) || payload.ids.includes('notification-foreign')) {
      throw new PanelNotificationAccessError(action)
    }
    return { affected: identity.recipient.id === actor.id && identity.tenantId === 'tenant-a' ? 1 : 0 }
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Next database notification endpoint', () => {
  it('lists using only the server-derived recipient, guard, panel, and tenant scope', async () => {
    const result = await execute({
      action: 'list',
      guard: 'attacker',
      page: 1,
      pageSize: 20,
      realtimeChannel: 'panels.attacker',
      recipient: { id: 999, type: 'Admin' },
      tenantId: 'tenant-b',
    })

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      data: { items: [], page: 1, pageSize: 20, total: 0, unread: 0 },
      ok: true,
    })
    expect(authorizations).toEqual(['list'])
    expect(notificationExecutor).toHaveBeenCalledWith(expect.objectContaining({
      panel,
      payload: expect.objectContaining({ recipient: { id: 999, type: 'Admin' }, tenantId: 'tenant-b' }),
      scope: expect.objectContaining({ actor, guard: 'web', panelId: 'admin', provider: 'session' }),
    }))
  })

  it.each(['mark-read', 'mark-unread', 'delete'] as const)('executes the scoped %s mutation through the registered production executor', async action => {
    const result = await execute({ action, ids: ['notification-1'], recipient: { id: 999, type: 'Admin' } })

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ data: { affected: 1 }, ok: true })
    expect(authorizations).toEqual([action])
    expect(notificationExecutor).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: { action, ids: ['notification-1'], recipient: { id: 999, type: 'Admin' } },
      scope: expect.objectContaining({ actor, guard: 'web', panelId: 'admin' }),
    }))
  })

  it('returns bounded failures for malformed, unauthorized, and unconfigured requests', async () => {
    const malformed = await execute({ action: 'list', page: 0, pageSize: 20 })
    expect(malformed.status).toBe(400)
    expect(malformed.body).toMatchObject({ ok: false })

    deniedOperation = 'delete'
    const denied = await execute({ action: 'delete', ids: ['notification-1'] })
    expect(denied.status).toBe(403)
    expect(denied.body).toMatchObject({ ok: false })

    const unconfiguredPanel = definePanel('admin', Actor).compile()
    const unconfigured = await execute({ action: 'list', page: 1, pageSize: 20 }, unconfiguredPanel)
    expect(unconfigured.status).toBe(403)
    expect(unconfigured.body).toMatchObject({ ok: false })
    expect(JSON.stringify([malformed.body, denied.body, unconfigured.body])).not.toContain('tenant-a')
  })

  it('rejects IDs outside the server-scoped visible set before mutation', async () => {
    const result = await execute({ action: 'mark-read', ids: ['notification-foreign'] })

    expect(result.status).toBe(403)
  })
})
