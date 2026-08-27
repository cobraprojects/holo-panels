import { AsyncLocalStorage } from 'node:async_hooks'
import type { Effect } from '../protocol/effects'
import { registerPanelNotificationDispatcher } from './dispatch'
import { databaseNotificationPayload } from './notification'
import { notificationPresentation } from './presentation'
import type { PanelNotificationScope } from './contracts'
import { prepareToastActions, type ToastActionScope } from './toast-actions'

type DeliveryScope = Pick<PanelNotificationScope, 'guard' | 'panelId' | 'tenantId'>
interface NotificationContext {
  active: boolean
  readonly effects: Effect[]
  readonly resolveScope: () => Promise<DeliveryScope>
  readonly actions?: ToastActionScope
}

const contexts = new AsyncLocalStorage<NotificationContext>()

registerPanelNotificationDispatcher(async (message, delivery, sources) => {
  const context = contexts.getStore()
  if (!context?.active) throw new Error('Panel notifications require an active server panel request or a configured sender')
  let presentation = notificationPresentation(message)
  if (delivery.kind === 'toast') {
    if (presentation.actions.some(action => action && typeof action === 'object' && !Array.isArray(action) && action.kind === 'execute')) {
      if (!context.actions) throw new Error('Executable notification actions require an authenticated panel request')
      presentation = await prepareToastActions(presentation, sources, context.actions)
    }
    if (context.effects.length >= 20) throw new Error('Panel requests cannot send more than 20 notification effects')
    context.effects.push({ kind: 'toast', presentation })
    return
  }
  const scope = await context.resolveScope()
  const data = databaseNotificationPayload(presentation, scope)
  const { defineNotification, notifyMany } = await import('@holo-js/notifications')
  const channels = delivery.kind === 'broadcast' ? ['broadcast'] as const : delivery.broadcast ? ['database', 'broadcast'] as const : ['database'] as const
  const definition = defineNotification({
    type: 'panels.notification',
    via: (_recipient: object) => channels,
    build: { database: () => ({ data }), broadcast: () => ({ data }) },
  })
  const result = await notifyMany(delivery.recipients, definition).dispatch()
  if (result.channels.some(channel => !channel.success)) throw new Error('The panel notification could not be delivered')
})

export async function withPanelNotificationContext<TResult>(resolveScope: () => Promise<DeliveryScope>, operation: () => TResult | Promise<TResult>, actions?: ToastActionScope): Promise<TResult> {
  const context: NotificationContext = { active: true, actions, effects: [], resolveScope }
  return contexts.run(context, async () => {
    try {
      return await operation()
    } finally {
      context.active = false
    }
  })
}

export function takePanelNotificationEffects(): readonly Effect[] {
  const context = contexts.getStore()
  return context?.active ? context.effects.splice(0) : []
}
