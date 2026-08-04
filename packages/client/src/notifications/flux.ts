import type { FluxClient } from '@holo-js/flux'
import type { ClientNotificationRealtime } from './contracts'

const TRUSTED_NOTIFICATION_CHANNEL_PATTERN = /^[A-Z\d][A-Z\d._:@,;=-]{0,199}$/i

function validateNotificationChannel(channel: string): string {
  if (
    channel !== channel.trim()
    || !TRUSTED_NOTIFICATION_CHANNEL_PATTERN.test(channel)
    || channel.startsWith('private-')
    || channel.startsWith('presence-')
  ) {
    throw new Error('Flux notification channels must be trusted, canonical server-provided identifiers.')
  }

  return channel
}

export function fluxNotificationRealtime(
  client: FluxClient,
  channel: string,
): ClientNotificationRealtime {
  const trustedChannel = validateNotificationChannel(channel)

  return Object.freeze({
    subscribe(invalidate: () => void) {
      const subscription = client.private(trustedChannel).notification(() => invalidate())
      let active = true

      return () => {
        if (!active) return
        active = false
        subscription.leaveChannel()
      }
    },
  })
}
