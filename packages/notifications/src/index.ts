import type { ActionColor } from '@holo-js/panels-actions'
import { dispatchPanelNotification, notificationActionReference, type JsonObject, type PanelNotificationStatus } from '@holo-js/panels-core'

export type NotificationStatus = PanelNotificationStatus
export type NotificationVerticalAlignment = 'center' | 'end' | 'start'
export type NotificationAlignment = 'center' | 'end' | 'start'

export interface NotificationPayload {
  readonly actions: readonly JsonObject[]
  readonly body: string | null
  readonly color: string | null
  readonly duration: number | null
  readonly icon: string | null
  readonly iconColor: string | null
  readonly id: string
  readonly status: NotificationStatus
  readonly title: string
}

export interface NotificationSender {
  send(notification: NotificationPayload): void | Promise<void>
  sendToDatabase?(recipients: readonly object[], notification: NotificationPayload, isEventDispatched: boolean): void | Promise<void>
  broadcast?(recipients: readonly object[], notification: NotificationPayload): void | Promise<void>
}

export interface NotificationAction {
  manifest(scope: 'notification'): JsonObject
}

let notificationSender: NotificationSender | null = null

export function configureNotificationSender(sender: NotificationSender | null): void {
  notificationSender = sender
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export class Notification {
  readonly id: string
  #actions: readonly NotificationAction[] = []
  #body: string | null = null
  #color: ActionColor | null = null
  #duration: number | null = 6000
  #icon: string | null = null
  #iconColor: ActionColor | null = null
  #status: NotificationStatus = 'info'
  #title = ''

  private constructor(id?: string) {
    this.id = id ?? randomId()
  }

  static make(id?: string): Notification {
    return new Notification(id)
  }

  actions(actions: readonly NotificationAction[]): this { this.#actions = Object.freeze([...actions]); return this }
  body(value: string | null): this { this.#body = value; return this }
  color(value: ActionColor | null): this { this.#color = value; return this }
  duration(milliseconds: number | null): this { this.#duration = milliseconds; return this }
  seconds(seconds: number): this { return this.duration(seconds * 1000) }
  persistent(value = true): this { this.#duration = value ? null : 6000; return this }
  icon(value: string | null): this { this.#icon = value; return this }
  iconColor(value: ActionColor | null): this { this.#iconColor = value; return this }
  status(value: NotificationStatus): this { this.#status = value; return this }
  danger(): this { return this.status('danger') }
  info(): this { return this.status('info') }
  success(): this { return this.status('success') }
  warning(): this { return this.status('warning') }
  title(value: string): this { this.#title = value; return this }

  async send(): Promise<this> {
    if (notificationSender) await notificationSender.send(this.toPayload())
    else await dispatchPanelNotification(this.toPayload(), { kind: 'toast' })
    return this
  }

  async sendToDatabase(recipients: object | readonly object[], isEventDispatched = false): Promise<this> {
    if (notificationSender && !notificationSender.sendToDatabase) throw new Error('The configured notification sender does not support database delivery')
    const targets = Array.isArray(recipients) ? recipients : [recipients]
    if (notificationSender?.sendToDatabase) await notificationSender.sendToDatabase(targets, this.toPayload(), isEventDispatched)
    else await dispatchPanelNotification(this.toPayload(), { broadcast: isEventDispatched, kind: 'database', recipients: targets })
    return this
  }

  async broadcast(recipients: object | readonly object[]): Promise<this> {
    if (notificationSender && !notificationSender.broadcast) throw new Error('The configured notification sender does not support broadcast delivery')
    const targets = Array.isArray(recipients) ? recipients : [recipients]
    if (notificationSender?.broadcast) await notificationSender.broadcast(targets, this.toPayload())
    else await dispatchPanelNotification(this.toPayload(), { kind: 'broadcast', recipients: targets })
    return this
  }

  toPayload(): NotificationPayload {
    const title = this.#title.trim()
    if (!title) throw new Error('Notifications require a title')
    return Object.freeze({
      actions: Object.freeze(this.#actions.map(action => {
        const execution = notificationActionReference(action)
        return { ...action.manifest('notification'), ...(execution ? { execution } : {}) }
      })),
      body: this.#body,
      color: this.#color,
      duration: this.#duration,
      icon: this.#icon,
      iconColor: this.#iconColor,
      id: this.id,
      status: this.#status,
      title,
    })
  }
}
