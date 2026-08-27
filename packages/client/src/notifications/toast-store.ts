import {
  panelNotification,
  type PanelNotificationAction,
  type PanelNotificationPresentation,
  type ActionManifest,
  notificationExecution,
} from '@holo-js/panels-core'
import type {
  ClientNotificationActionHandler,
  ClientToast,
  ClientToastState,
  ClientToastStateListener,
  ClientNotificationTransport,
} from './contracts'
import { ClientActionStore } from '../actions/store'
import { actionManifestCollection, isActionManifest } from '../actions/manifest'

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
  readonly #actions = new Map<string, ClientActionStore>()
  #transport: Pick<ClientNotificationTransport, 'executeToastAction'> | undefined
  readonly #handlers = new Set<ClientNotificationActionHandler>()
  readonly #listeners = new Set<ClientToastStateListener>()
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>()
  #state: ClientToastState = freezeState([], '', 0)

  get state(): ClientToastState {
    return this.#state
  }

  connectActions(transport: Pick<ClientNotificationTransport, 'executeToastAction'>): void {
    this.#transport = transport
  }

  actionHost(id: string): { readonly actions: readonly ActionManifest[], readonly store: ClientActionStore } | null {
    const toast = this.#state.items.find(item => item.id === id)
    if (!toast?.trusted || !this.#transport?.executeToastAction) return null
    const attached = toast.actions.flatMap(value => {
      const action = notificationExecution(value)
      if (!action || !value || typeof value !== 'object' || Array.isArray(value) || typeof value.token !== 'string' || !isActionManifest(value.actionManifest, action.id) || value.actionManifest.mount !== 'notification') return []
      return [{ manifest: value.actionManifest, token: value.token }]
    })
    if (!attached.length) return null
    let store = this.#actions.get(id)
    if (!store) {
      store = new ClientActionStore({ createIdempotencyKey: () => crypto.randomUUID(), transport: {
        execute: (request, signal) => {
          const action = attached.find(item => actionManifestCollection([item.manifest]).some(manifest => manifest.id === request.actionId))
          if (!action || !this.#transport?.executeToastAction) throw new Error('The toast action is no longer available')
          return this.#transport.executeToastAction(action.token, request, signal)
        },
      } })
      store.subscribe(state => {
        const timer = this.#timers.get(id)
        if (timer) clearTimeout(timer)
        this.#timers.delete(id)
        const current = this.#state.items.find(item => item.id === id)
        if (state.frames.length === 0 && current) this.schedule(current)
      })
      this.#actions.set(id, store)
    }
    return { actions: attached.map(action => action.manifest), store }
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
    this.#actions.get(presentation.id)?.dispose()
    this.#actions.delete(presentation.id)
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
    this.#actions.get(id)?.dispose()
    this.#actions.delete(id)
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
    for (const store of this.#actions.values()) store.dispose()
    this.#actions.clear()
    this.#transport = undefined
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
