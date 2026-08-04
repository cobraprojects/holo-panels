import {
  panelNotification,
  type PanelNotificationAction,
  type PanelNotificationPresentation,
} from '@holo-js/panels-core'
import type {
  ClientNotificationActionHandler,
  ClientToast,
  ClientToastState,
  ClientToastStateListener,
} from './contracts'

function freezeState(items: readonly ClientToast[], liveMessage: string, version: number): ClientToastState {
  return Object.freeze({ items: Object.freeze(items.map(item => Object.freeze(structuredClone(item)))), liveMessage, version })
}

function safeClientPresentation(presentation: Readonly<PanelNotificationPresentation>): PanelNotificationPresentation {
  const builder = panelNotification(presentation.id)
    .title(presentation.title)
    .body(presentation.body)
    .status(presentation.status)
    .icon(presentation.icon)
    .color(presentation.color)
    .closeable(presentation.closeable)
  if (presentation.persistent) builder.persistent()
  else builder.duration(presentation.duration)
  for (const value of presentation.actions) {
    if (value === null || Array.isArray(value) || typeof value !== 'object') continue
    if (value.kind !== 'dismiss' && value.kind !== 'navigate') continue
    if (typeof value.id !== 'string' || typeof value.label !== 'string') continue
    if (value.url !== null && typeof value.url !== 'string') continue
    try {
      builder.action(value.id, value.label, value.kind, value.url)
    } catch {
      continue
    }
  }
  return builder.presentation()
}

export class ClientToastStore {
  readonly #handlers = new Set<ClientNotificationActionHandler>()
  readonly #listeners = new Set<ClientToastStateListener>()
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>()
  #state: ClientToastState = freezeState([], '', 0)

  get state(): ClientToastState {
    return this.#state
  }

  subscribe(listener: ClientToastStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  onAction(handler: ClientNotificationActionHandler): () => void {
    this.#handlers.add(handler)
    return () => this.#handlers.delete(handler)
  }

  push(presentation: Readonly<PanelNotificationPresentation>, trusted = true): void {
    const normalized = trusted ? structuredClone(presentation) : safeClientPresentation(presentation)
    const item: ClientToast = {
      ...normalized,
      announced: true,
      createdAt: Date.now(),
      trusted,
    }
    const items = [...this.#state.items.filter(existing => existing.id !== item.id), item]
    this.publish(items, [item.title, item.body].filter(Boolean).join('. '))
    this.schedule(item)
  }

  dismiss(id: string): void {
    const timer = this.#timers.get(id)
    if (timer) clearTimeout(timer)
    this.#timers.delete(id)
    this.publish(this.#state.items.filter(item => item.id !== id), '')
  }

  async trigger(notificationId: string, actionId: string): Promise<void> {
    const toast = this.#state.items.find(item => item.id === notificationId)
    const action = toast?.actions.find((value): value is PanelNotificationAction => value !== null
      && !Array.isArray(value)
      && typeof value === 'object'
      && value.id === actionId)
    if (!toast || !action) throw new Error('Unknown notification action')
    if (!toast.trusted && action.kind !== 'dismiss' && action.kind !== 'navigate') throw new Error('Untrusted notifications cannot execute server actions')
    if (action.kind === 'dismiss') this.dismiss(toast.id)
    for (const handler of this.#handlers) await handler(action, toast)
  }

  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
    this.#listeners.clear()
    this.#handlers.clear()
  }

  private schedule(item: ClientToast): void {
    const existing = this.#timers.get(item.id)
    if (existing) clearTimeout(existing)
    if (item.persistent || item.duration === null) return
    const timer = setTimeout(() => this.dismiss(item.id), item.duration)
    this.#timers.set(item.id, timer)
  }

  private publish(items: readonly ClientToast[], liveMessage: string): void {
    const previous = this.#state
    this.#state = freezeState(items, liveMessage, previous.version + 1)
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}
