import type { notificationPresentation } from './presentation'

export type PanelNotificationMessage = Parameters<typeof notificationPresentation>[0]
export type PanelNotificationDelivery = { readonly kind: 'toast' }
  | { readonly kind: 'database', readonly recipients: readonly object[], readonly broadcast: boolean }
  | { readonly kind: 'broadcast', readonly recipients: readonly object[] }

type NotificationDispatcher = (message: PanelNotificationMessage, delivery: PanelNotificationDelivery, actions: readonly object[]) => Promise<void>
let dispatcher: NotificationDispatcher | undefined

export function registerPanelNotificationDispatcher(value: NotificationDispatcher): void {
  dispatcher = value
}

export async function dispatchPanelNotification(message: PanelNotificationMessage, delivery: PanelNotificationDelivery, actions: readonly object[] = []): Promise<void> {
  if (!dispatcher) throw new Error('Panel notifications require an active server panel request or a configured sender')
  await dispatcher(message, delivery, actions)
}
