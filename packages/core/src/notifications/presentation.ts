import type { JsonObject } from '../protocol/json'
import type { PanelNotificationExecutionAction, PanelNotificationPresentation, PanelNotificationStatus } from './contracts'
import { panelNotification } from './notification'
import { deepFreeze } from '../builders/deep-freeze'

const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

export function notificationIconColor(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error('Notification icon colors require between 1 and 100 characters')
  return value.trim()
}

export function notificationExecution(value: unknown): PanelNotificationExecutionAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const action = value as Readonly<Record<string, unknown>>
  const reference = action.execution
  if (action.kind !== 'execute' || typeof action.id !== 'string' || !ID.test(action.id) || typeof action.label !== 'string' || !action.label.trim() || action.label.length > 200 || action.url !== null) return null
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return null
  const actionId = Reflect.get(reference, 'actionId')
  const resourceId = Reflect.get(reference, 'resourceId')
  if (actionId !== action.id || typeof resourceId !== 'string' || !ID.test(resourceId)) return null
  const manifest = action.actionManifest
  return { id: action.id, kind: 'execute', label: action.label, url: null, execution: { actionId, resourceId },
    ...(manifest && typeof manifest === 'object' && !Array.isArray(manifest) ? { actionManifest: manifest as JsonObject } : {}),
    ...(typeof action.token === 'string' ? { token: action.token } : {}),
  }
}

export function notificationPresentation(payload: {
  readonly actions: readonly JsonObject[]
  readonly body: string | null
  readonly color: string | null
  readonly duration: number | null
  readonly icon: string | null
  readonly iconColor?: string | null
  readonly id: string
  readonly status: PanelNotificationStatus
  readonly title: string
}): Readonly<PanelNotificationPresentation> {
  const builder = panelNotification(payload.id).title(payload.title).body(payload.body).color(payload.color).icon(payload.icon).status(payload.status).duration(payload.duration)
  if (payload.duration === null) builder.persistent()
  const identifiers = new Set<string>()
  const actions = payload.actions.map(action => {
    const executable = notificationExecution({ ...action, kind: 'execute', url: null })
    if (executable && typeof action.url !== 'string') {
      if (identifiers.has(executable.id)) throw new Error('Notification action IDs must be unique')
      identifiers.add(executable.id)
      return executable
    }
    if (typeof action.id !== 'string' || typeof action.label !== 'string' || typeof action.url !== 'string') throw new Error('Executable notification actions must be declared on a discovered resource')
    if (identifiers.has(action.id)) throw new Error('Notification action IDs must be unique')
    identifiers.add(action.id)
    builder.action(action.id, action.label, 'navigate', action.url)
    return builder.presentation().actions.at(-1)!
  })
  const iconColor = notificationIconColor(payload.iconColor)
  const result = { ...builder.presentation(), actions, ...(iconColor ? { iconColor } : {}) }
  if (JSON.stringify(result).length > 16_384) throw new Error('Notification presentations cannot exceed 16 KiB')
  deepFreeze(result)
  return result
}
