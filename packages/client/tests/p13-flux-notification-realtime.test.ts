import {
  createFluxClient,
  type FluxConnector,
  type FluxConnectorChannel,
} from '@holo-js/flux'
import { describe, expect, it, vi } from 'vitest'
import { fluxNotificationRealtime } from '../src/notifications'

type NotificationPayload = Parameters<Parameters<FluxConnectorChannel['onNotification']>[0]>[0]

function createConnectorFixture() {
  let notify: ((payload: NotificationPayload) => void) | undefined
  const detach = vi.fn()
  const leave = vi.fn()
  const subscribe = vi.fn((channel: string, kind: 'public' | 'private' | 'presence') => ({
    name: channel,
    kind,
    members: [],
    onEvent: vi.fn(() => vi.fn()),
    onMembersChange: vi.fn(() => vi.fn()),
    onNotification(callback: (payload: NotificationPayload) => void) {
      notify = callback
      return detach
    },
    onWhisper: vi.fn(() => vi.fn()),
    sendWhisper: vi.fn(async () => undefined),
    leave,
  }))
  const connector: FluxConnector = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getStatus: vi.fn(() => 'connected' as const),
    onStatusChange: vi.fn(() => vi.fn()),
    subscribe,
  }

  return {
    connector,
    detach,
    emitNotification() {
      notify?.({ id: 'notification-1' })
    },
    leave,
    subscribe,
  }
}

describe('Flux notification realtime adapter', () => {
  it('invalidates from a private notification and leaves the channel on cleanup', () => {
    const fixture = createConnectorFixture()
    const client = createFluxClient({ connector: fixture.connector })
    const invalidate = vi.fn()
    const cleanup = fluxNotificationRealtime(client, 'panels.notifications.user-42')
      .subscribe(invalidate)

    expect(fixture.subscribe).toHaveBeenCalledWith('panels.notifications.user-42', 'private')

    fixture.emitNotification()
    expect(invalidate).toHaveBeenCalledTimes(1)

    cleanup()
    cleanup()
    expect(fixture.detach).toHaveBeenCalledTimes(1)
    expect(fixture.leave).toHaveBeenCalledTimes(1)

    fixture.emitNotification()
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it.each([
    '',
    ' panels.notifications.user-42',
    'panels.notifications.user-42 ',
    'panels/notifications/user-42',
    'panels.notifications?tenant=other',
    'private-panels.notifications.user-42',
    'presence-panels.notifications.user-42',
    `panels.${'x'.repeat(194)}`,
  ])('rejects an untrusted channel identifier without subscribing: %j', (channel) => {
    const fixture = createConnectorFixture()
    const client = createFluxClient({ connector: fixture.connector })

    expect(() => fluxNotificationRealtime(client, channel)).toThrow(
      'trusted, canonical server-provided identifiers',
    )
    expect(fixture.subscribe).not.toHaveBeenCalled()
  })
})
