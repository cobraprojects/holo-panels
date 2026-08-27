import { deepFreeze } from '../builders/deep-freeze'
import type { JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type {
  PanelDatabaseNotificationPayload,
  PanelNotificationAction,
  PanelNotificationActionKind,
  PanelNotificationPresentation,
  PanelNotificationScope,
  PanelNotificationStatus,
} from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u
const NOTIFICATION_STATUSES: readonly PanelNotificationStatus[] = ['danger', 'info', 'success', 'warning']

function requiredText(value: string, name: string, maximum: number): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${name} cannot be empty`)
  if (normalized.length > maximum) throw new Error(`${name} cannot exceed ${maximum} characters`)
  return normalized
}

function optionalText(value: string | null, name: string, maximum: number): string | null {
  return value === null ? null : requiredText(value, name, maximum)
}

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
  })
}

function safeUrl(value: string): string {
  if (value.includes('\\') || hasControlCharacter(value)) throw new Error('Notification action URLs must be safe credential-free HTTP URLs or root-relative paths')
  const normalized = value.trim()
  if (normalized.startsWith('/')) {
    if (normalized.startsWith('//')) throw new Error('Notification action URLs must be safe credential-free HTTP URLs or root-relative paths')
    return normalized
  }
  try {
    const parsed = new URL(normalized)
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname && !parsed.username && !parsed.password) return parsed.href
  } catch {
    throw new Error('Notification action URLs must be safe credential-free HTTP URLs or root-relative paths')
  }
  throw new Error('Notification action URLs must be safe credential-free HTTP URLs or root-relative paths')
}

export class PanelNotification {
  readonly #actions: PanelNotificationAction[] = []
  #body: string | null = null
  #closeable = true
  #color: string | null = null
  #duration: number | null = 5_000
  #icon: string | null = null
  #persistent = false
  #status: PanelNotificationStatus = 'info'
  #title = ''

  constructor(readonly id: string) {
    if (!IDENTIFIER.test(id) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(id)) throw new Error('Notification IDs require stable dot or dash separated identifiers')
  }

  title(value: string): this {
    this.#title = requiredText(value, 'Notification titles', 200)
    return this
  }

  body(value: string | null): this {
    this.#body = optionalText(value, 'Notification bodies', 2_000)
    return this
  }

  status(value: PanelNotificationStatus): this {
    if (!NOTIFICATION_STATUSES.includes(value)) throw new Error(`Unknown notification status: ${String(value)}`)
    this.#status = value
    return this
  }

  icon(value: string | null): this {
    this.#icon = optionalText(value, 'Notification icons', 100)
    return this
  }

  color(value: string | null): this {
    this.#color = optionalText(value, 'Notification colors', 100)
    return this
  }

  duration(milliseconds: number | null): this {
    if (milliseconds !== null && (!Number.isInteger(milliseconds) || milliseconds < 1_000 || milliseconds > 300_000)) {
      throw new Error('Notification duration must be between 1000 and 300000 milliseconds')
    }
    this.#duration = milliseconds
    if (milliseconds !== null) this.#persistent = false
    return this
  }

  persistent(value = true): this {
    this.#persistent = value
    if (value) this.#duration = null
    return this
  }

  closeable(value = true): this {
    this.#closeable = value
    return this
  }

  action(id: string, label: string, kind: PanelNotificationActionKind, url: string | null = null): this {
    if (kind === 'execute') throw new Error('Executable notifications require a resource action reference')
    if (!IDENTIFIER.test(id)) throw new Error('Notification action IDs require stable identifiers')
    if (this.#actions.some(action => action.id === id)) throw new Error(`Duplicate notification action: ${id}`)
    if (kind === 'navigate' && url === null) throw new Error('Navigate notification actions require a URL')
    if (kind !== 'navigate' && url !== null) throw new Error('Only navigate notification actions may define a URL')
    this.#actions.push({ id, kind, label: requiredText(label, 'Notification action labels', 100), url: url === null ? null : safeUrl(url) })
    return this
  }

  presentation(): Readonly<PanelNotificationPresentation> {
    const presentation: PanelNotificationPresentation = {
      actions: this.#actions.map(action => ({ ...action })),
      body: this.#body,
      closeable: this.#closeable,
      color: this.#color,
      duration: this.#duration,
      icon: this.#icon,
      id: this.id,
      persistent: this.#persistent,
      status: this.#status,
      title: requiredText(this.#title, 'Notification titles', 200),
    }
    toJsonValue(presentation)
    if (JSON.stringify(presentation).length > 16_384) throw new Error('Notification presentations cannot exceed 16 KiB')
    return deepFreeze(presentation)
  }
}

export function panelNotification(id: string): PanelNotification {
  return new PanelNotification(id)
}

export function databaseNotificationPayload(
  presentation: Readonly<PanelNotificationPresentation>,
  scope: Pick<PanelNotificationScope, 'guard' | 'panelId' | 'tenantId'>,
): Readonly<PanelDatabaseNotificationPayload> {
  const tenantId = scope.tenantId === null ? null : requiredText(String(scope.tenantId), 'Panel notification tenant IDs', 200)
  const payload: PanelDatabaseNotificationPayload = {
    panel: {
      guard: requiredText(scope.guard, 'Panel notification guards', 100),
      panelId: requiredText(scope.panelId, 'Panel IDs', 100),
      presentation,
      tenantId,
      version: 1,
    },
  }
  deepFreeze(payload as JsonValue)
  return payload
}
