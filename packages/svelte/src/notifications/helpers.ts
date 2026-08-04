import { safeExternalUrl } from '@holo-js/panels-client'
import type { SvelteNotificationAction } from './contracts'

export function svelteNotificationRendererName(type: string): string {
  return `notification.${type}`
}

export function notificationActions(values: readonly unknown[]): readonly SvelteNotificationAction[] {
  return values.flatMap(value => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
    const action = value as Record<string, unknown>
    if (typeof action.id !== 'string' || typeof action.label !== 'string') return []
    if (action.kind !== 'dismiss' && action.kind !== 'mark-read' && action.kind !== 'mark-unread' && action.kind !== 'navigate') return []
    return [{ id: action.id, kind: action.kind, label: action.label, url: typeof action.url === 'string' ? action.url : null }]
  })
}

export function notificationUrl(action: SvelteNotificationAction): string | null {
  return action.kind === 'navigate' ? safeExternalUrl(action.url) : null
}
