import { isPanelDatabaseNotificationPayload } from '../notifications/inbox'
import type { PanelNotificationAction, PanelNotificationPresentation } from '../notifications/contracts'
import { toJsonValue } from './serialization'

export interface RedirectEffect {
  kind: 'redirect'
  replace?: boolean
  url: string
}

export interface LegacyToastEffect {
  duration?: number
  kind: 'toast'
  level: 'danger' | 'info' | 'success' | 'warning'
  message: string
  title?: string
}

export interface RichToastEffect {
  kind: 'toast'
  presentation: PanelNotificationPresentation
}

export type ToastEffect = LegacyToastEffect | RichToastEffect

export interface CloseModalEffect {
  id?: string
  kind: 'close-modal'
}

export interface RefreshEffect {
  kind: 'refresh'
  target?: 'page' | 'schema'
}

export interface InvalidateTableEffect {
  kind: 'invalidate-table'
  tableId: string
}

export interface DownloadEffect {
  filename?: string
  kind: 'download'
  url: string
}

export interface FocusEffect {
  componentId: string
  kind: 'focus'
}

export type Effect =
  | CloseModalEffect
  | DownloadEffect
  | FocusEffect
  | InvalidateTableEffect
  | RedirectEffect
  | RefreshEffect
  | ToastEffect

export function validatedToastPresentation(value: unknown): Readonly<PanelNotificationPresentation> | null {
  let serialized
  try {
    serialized = toJsonValue(value)
  } catch {
    return null
  }
  const payload = { panel: { guard: 'response', panelId: 'response', presentation: serialized, tenantId: null, version: 1 } }
  if (!isPanelDatabaseNotificationPayload(payload)) return null
  const presentation = payload.panel.presentation
  const normalized: PanelNotificationPresentation = {
    actions: presentation.actions.map(value => {
      const action = value as PanelNotificationAction
      return { id: action.id, kind: action.kind, label: action.label, url: action.url }
    }),
    body: presentation.body,
    closeable: presentation.closeable,
    color: presentation.color,
    duration: presentation.duration,
    icon: presentation.icon,
    id: presentation.id,
    persistent: presentation.persistent,
    status: presentation.status,
    title: presentation.title,
  }
  return frozen(normalized)
}

function frozen<TValue>(value: TValue): Readonly<TValue> {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const nested of Object.values(value)) frozen(nested)
  }
  return value
}
