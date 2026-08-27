import {
  panelNotification,
  type JsonValue,
} from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import {
  createPanelNotificationTransport,
  ClientNotificationInboxStore,
  createTransportRecorder,
  PanelsTransport,
} from '../src'

const requestId = '00000000-0000-4000-8000-000000000001'

function success(data: JsonValue) {
  return {
    status: 200,
    body: {
      data,
      effects: [],
      id: requestId,
      ok: true as const,
      protocolVersion: '1.0',
    },
  }
}

function createClient(steps: readonly ReturnType<typeof success>[]) {
  const recorder = createTransportRecorder(steps)
  const transport = new PanelsTransport({
    adapter: recorder,
    createId: () => requestId,
    csrfProvider: { getField: () => ({ name: '_token', value: 'signed' }) },
  })
  return {
    notifications: createPanelNotificationTransport(transport, {
      endpoint: '/holo/panels/notifications',
      panelId: 'commerce',
    }),
    recorder,
  }
}

function payloads(requests: readonly { readonly body: string }[]): unknown[] {
  return requests.map(request => {
    const encoded = new URLSearchParams(request.body).get('request')
    if (!encoded) throw new Error('Missing request envelope')
    return JSON.parse(encoded).payload
  })
}

describe('panel notification transport', () => {
  it('does not expose executable actions with incomplete modal manifests', async () => {
    const presentation = { ...panelNotification('notice').title('Publishing failed').presentation(), actions: [{ actionManifest: { confirmation: null, disabled: false, id: 'retry', kind: 'custom', label: 'Retry', modal: {}, mount: 'notification', type: 'custom', visible: true }, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', url: null }] }
    const { notifications } = createClient([success({ items: [{ createdAt: '2026-07-28T00:00:00.000Z', id: 'saved-1', presentation, read: false, type: 'notification' }], page: 1, pageSize: 20, total: 1, unread: 1 })])
    const inbox = new ClientNotificationInboxStore({ transport: notifications })
    await inbox.start()
    expect(inbox.actionHost('saved-1')).toBeNull()
    inbox.dispose()
  })

  it('confirms a notification action before sending its input through the shared action store', async () => {
    const manifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: null, id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    const presentation = { ...panelNotification('notice').title('Publishing failed').presentation(), actions: [{ actionManifest: manifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', url: null }] }
    const { notifications, recorder } = createClient([
      success({ items: [{ createdAt: '2026-07-28T00:00:00.000Z', id: 'saved-1', presentation, read: false, type: 'notification' }], page: 1, pageSize: 20, total: 1, unread: 1 }),
      success({ items: [], result: { retried: true }, status: 'succeeded' }),
    ])
    const inbox = new ClientNotificationInboxStore({ transport: notifications })
    await inbox.start()
    const host = inbox.actionHost('saved-1')!
    host.store.mount(host.actions[0]!)
    expect(host.store.activeFrame?.phase).toBe('confirming')
    expect(recorder.requests).toHaveLength(1)
    host.store.confirm()
    host.store.setInput({ reason: 'Try again' })
    await host.store.submit()
    expect(host.store.activeFrame?.phase).toBe('succeeded')
    expect(payloads(recorder.requests)[1]).toEqual({ action: 'execute', actionId: 'retry', idempotencyKey: expect.any(String), input: { reason: 'Try again' }, notificationId: 'saved-1' })
    inbox.stop()
    expect(host.store.activeFrame).toBeNull()
  })

  it('sends only allow-listed pagination and mutation payloads', async () => {
    const presentation = panelNotification('order.ready').title('Order ready').presentation()
    const page = {
      items: [{
        createdAt: '2026-07-28T00:00:00.000Z',
        id: 'notification-1',
        presentation,
        read: false,
        type: 'panels.order-ready',
      }],
      page: 2,
      pageSize: 20,
      total: 21,
      unread: 4,
    }
    const { notifications, recorder } = createClient([
      success(page),
      success({ affected: 1 }),
      success({ affected: 1 }),
      success({ affected: 1 }),
    ])
    const signal = new AbortController().signal

    await expect(notifications.list(2, 20, signal)).resolves.toEqual(page)
    await expect(notifications.markRead(['notification-1'], signal)).resolves.toBe(1)
    await expect(notifications.markUnread(['notification-1'], signal)).resolves.toBe(1)
    await expect(notifications.delete(['notification-1'], signal)).resolves.toBe(1)

    expect(payloads(recorder.requests)).toEqual([
      { action: 'list', page: 2, pageSize: 20 },
      { action: 'mark-read', ids: ['notification-1'] },
      { action: 'mark-unread', ids: ['notification-1'] },
      { action: 'delete', ids: ['notification-1'] },
    ])
    for (const request of recorder.requests) {
      const encoded = new URLSearchParams(request.body).get('request')
      expect(JSON.parse(encoded!)).toMatchObject({ operation: 'notification', panelId: 'commerce' })
      expect(encoded).not.toMatch(/guard|tenant|recipient|channel/u)
    }
  })

  it('validates request inputs and response page/count shapes before exposing them', async () => {
    const malformedPage = createClient([success({ items: [], page: 2, pageSize: 20, total: 0, unread: 0 })])
    const signal = new AbortController().signal

    await expect(malformedPage.notifications.list(1, 20, signal)).rejects.toThrow('requested pagination')
    expect(() => createPanelNotificationTransport(new PanelsTransport({
      adapter: malformedPage.recorder,
      createId: () => requestId,
      csrfProvider: { getField: () => ({ name: '_token', value: 'signed' }) },
    }), { endpoint: 'https://example.com/notifications', panelId: 'commerce' })).toThrow('root-relative')
    for (const endpoint of [
      '/holo/panels/../admin',
      '/holo%2fpanels/notifications',
      '/holo/panels/notifications?tenant=other',
      '/holo/panels/notifications#other',
    ]) {
      expect(() => createPanelNotificationTransport(new PanelsTransport({
        adapter: malformedPage.recorder,
        createId: () => requestId,
        csrfProvider: { getField: () => ({ name: '_token', value: 'signed' }) },
      }), { endpoint, panelId: 'commerce' })).toThrow('root-relative')
    }

    const invalidInputs = createClient([])
    await expect(invalidInputs.notifications.list(0, 20, signal)).rejects.toThrow('Notification pages')
    await expect(invalidInputs.notifications.list(10_002, 100, signal)).rejects.toThrow('offsets')
    await expect(invalidInputs.notifications.markRead(['../../foreign'], signal)).rejects.toThrow('canonical identifiers')
    expect(invalidInputs.recorder.requests).toHaveLength(0)

    const invalidCount = createClient([success({ affected: 2 })])
    await expect(invalidCount.notifications.delete(['notification-1'], signal)).rejects.toThrow('affected count')

    const validPresentation = panelNotification('order.ready').title('Order ready').presentation()
    const hostileItems = [
      {
        createdAt: '2026-07-28T00:00:00.000Z',
        id: 42,
        presentation: validPresentation,
        read: false,
        type: 'panels.order-ready',
      },
      {
        createdAt: '2026-07-28T00:00:00.000Z',
        id: 'notification-2',
        presentation: {
          ...validPresentation,
          actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'javascript:alert(1)' }],
        },
        read: false,
        type: 'panels.order-ready',
      },
    ]
    for (const item of hostileItems) {
      const hostile = createClient([success({ items: [item], page: 1, pageSize: 20, total: 1, unread: 1 })])
      await expect(hostile.notifications.list(1, 20, signal)).rejects.toThrow()
    }
  })
})
