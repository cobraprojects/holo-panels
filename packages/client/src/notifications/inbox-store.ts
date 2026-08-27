import { notificationExecution, type ActionManifest, type JsonValue, type PanelDatabaseNotificationPage, type PanelNotificationAction } from '@holo-js/panels-core'
import { ClientActionStore } from '../actions/store'
import { isActionManifest } from '../actions/manifest'
import type {
  ClientNotificationInboxListener,
  ClientNotificationInboxOptions,
  ClientNotificationInboxState,
} from './contracts'
import { safeExternalUrl } from '../entries/safety'

function initialState(pageSize: number): ClientNotificationInboxState {
  return Object.freeze({ error: null, items: [], loading: false, page: 1, pageSize, total: 0, unread: 0, version: 0 })
}

function notificationAction(value: JsonValue): value is PanelNotificationAction {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return false
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && (value.kind === 'dismiss' || value.kind === 'mark-read' || value.kind === 'mark-unread' || value.kind === 'navigate')
    && (value.url === null || typeof value.url === 'string')
}

function safeNavigationUrl(value: string): string | null {
  const safe = safeExternalUrl(value)
  if (!safe) return null
  if (safe.startsWith('/')) return safe
  try {
    const url = new URL(safe)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username && !url.password ? safe : null
  } catch {
    return null
  }
}

export class ClientNotificationInboxStore {
  readonly #actions = new Map<string, ClientActionStore>()
  readonly #listeners = new Set<ClientNotificationInboxListener>()
  readonly #options: ClientNotificationInboxOptions
  #active: AbortController | null = null
  #disposed = false
  #invalidationQueued = false
  #mutation: AbortController | null = null
  #pendingInvalidation = false
  #poll: ReturnType<typeof setInterval> | null = null
  #requestVersion = 0
  #state: ClientNotificationInboxState
  #unsubscribeRealtime: (() => void) | null = null

  constructor(options: ClientNotificationInboxOptions) {
    const pageSize = options.pageSize ?? 20
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Notification page size must be between 1 and 100')
    if (options.polling !== false && options.polling !== undefined && (!Number.isInteger(options.polling) || options.polling < 1_000)) {
      throw new Error('Notification polling must be disabled or at least 1000 milliseconds')
    }
    this.#options = options
    this.#state = initialState(pageSize)
  }

  get state(): ClientNotificationInboxState {
    return this.#state
  }

  actionHost(notificationId: string): { readonly actions: readonly ActionManifest[], readonly store: ClientActionStore } | null {
    const execute = this.#options.transport.executeAction
    if (!execute || this.#disposed) return null
    const item = this.#state.items.find(candidate => candidate.id === notificationId)
    const actions = item?.presentation.actions.flatMap(value => {
      const action = notificationExecution(value)
      const manifest = value && typeof value === 'object' && !Array.isArray(value) ? value.actionManifest : undefined
      return action && isActionManifest(manifest, action.id) && manifest.mount === 'notification' ? [manifest] : []
    }) ?? []
    if (actions.length === 0) return null
    let store = this.#actions.get(notificationId)
    if (!store) {
      store = new ClientActionStore({ createIdempotencyKey: () => crypto.randomUUID(), transport: { execute: (request, signal) => execute(notificationId, request, signal) } })
      this.#actions.set(notificationId, store)
    }
    return { actions, store }
  }

  subscribe(listener: ClientNotificationInboxListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start(): Promise<void> {
    if (this.#disposed) throw new Error('Notification inbox is disposed')
    if (!this.#unsubscribeRealtime && this.#options.realtime) {
      this.#unsubscribeRealtime = this.#options.realtime.subscribe(() => this.invalidate())
    }
    if (!this.#poll && this.#options.polling !== false && this.#options.polling !== undefined) {
      this.#poll = setInterval(() => this.invalidate(), this.#options.polling)
    }
    return this.refresh()
  }

  async load(page: number): Promise<void> {
    if (!Number.isInteger(page) || page < 1) throw new Error('Notification page must be a positive integer')
    await this.request(page)
  }

  refresh(): Promise<void> {
    return this.request(this.#state.page)
  }

  markRead(ids: readonly string[]): Promise<void> {
    return this.mutate('mark-read', ids, (selected, signal) => this.#options.transport.markRead(selected, signal))
  }

  markUnread(ids: readonly string[]): Promise<void> {
    return this.mutate('mark-unread', ids, (selected, signal) => this.#options.transport.markUnread(selected, signal))
  }

  delete(ids: readonly string[]): Promise<void> {
    return this.mutate('delete', ids, (selected, signal) => this.#options.transport.delete(selected, signal))
  }

  async markAllRead(): Promise<void> {
    const controller = this.beginMutation()
    try {
      const first = await this.#options.transport.list(1, this.#state.pageSize, controller.signal)
      const ids = first.items.filter(item => !item.read).map(item => item.id)
      const pages = Math.ceil(first.total / first.pageSize)
      for (let page = 2; page <= pages; page++) {
        const next = await this.#options.transport.list(page, this.#state.pageSize, controller.signal)
        ids.push(...next.items.filter(item => !item.read).map(item => item.id))
      }
      const unique = [...new Set(ids)]
      for (let index = 0; index < unique.length; index += 100) {
        await this.#options.transport.markRead(unique.slice(index, index + 100), controller.signal)
      }
      if (controller.signal.aborted || this.#disposed) return
      this.publish({
        items: Object.freeze(this.#state.items.map(item => item.read ? item : Object.freeze({ ...item, read: true }))),
        unread: 0,
      })
      await this.refresh()
    } catch (cause: unknown) {
      if (!controller.signal.aborted && !this.#disposed) {
        this.publishMutationError()
        throw cause
      }
    } finally {
      this.finishMutation(controller)
    }
  }

  async trigger(notificationId: string, actionId: string): Promise<string | null> {
    const item = this.#state.items.find(candidate => candidate.id === notificationId)
    const action = item?.presentation.actions.find((candidate): candidate is PanelNotificationAction => notificationAction(candidate) && candidate.id === actionId)
    if (!item || !action) throw new Error(`Unknown notification action: ${actionId}`)
    if (action.kind === 'mark-read') {
      await this.markRead([notificationId])
      return null
    }
    if (action.kind === 'mark-unread') {
      await this.markUnread([notificationId])
      return null
    }
    if (action.kind === 'dismiss') {
      await this.delete([notificationId])
      return null
    }
    const url = action.url ? safeNavigationUrl(action.url) : null
    if (!url) throw new Error('Notification navigation action has an unsafe URL')
    return url
  }

  reconnectRealtime(): Promise<void> {
    if (this.#disposed) throw new Error('Notification inbox is disposed')
    this.#unsubscribeRealtime?.()
    this.#unsubscribeRealtime = this.#options.realtime?.subscribe(() => this.invalidate()) ?? null
    return this.refresh()
  }

  stop(): void {
    for (const store of this.#actions.values()) while (store.activeFrame) store.close()
    this.#actions.clear()
    this.#requestVersion++
    this.#active?.abort()
    this.#active = null
    this.#mutation?.abort()
    this.#mutation = null
    if (this.#poll) clearInterval(this.#poll)
    this.#poll = null
    this.#unsubscribeRealtime?.()
    this.#unsubscribeRealtime = null
  }

  dispose(): void {
    this.#disposed = true
    this.stop()
    this.#listeners.clear()
  }

  private async mutate(
    operation: 'delete' | 'mark-read' | 'mark-unread',
    ids: readonly string[],
    execute: (ids: readonly string[], signal: AbortSignal) => Promise<number>,
  ): Promise<void> {
    const selected = [...new Set(ids)]
    if (selected.length === 0) return
    const controller = this.beginMutation()
    try {
      await execute(selected, controller.signal)
      if (controller.signal.aborted || this.#disposed) return
      this.publishMutation(operation, selected)
      await this.refresh()
    } catch (cause: unknown) {
      if (!controller.signal.aborted && !this.#disposed) {
        this.publishMutationError()
        throw cause
      }
    } finally {
      this.finishMutation(controller)
    }
  }

  private beginMutation(): AbortController {
    if (this.#disposed) throw new Error('Notification inbox is disposed')
    this.#mutation?.abort()
    this.#active?.abort()
    this.#requestVersion++
    const controller = new AbortController()
    this.#mutation = controller
    return controller
  }

  private finishMutation(controller: AbortController): void {
    if (this.#mutation === controller) this.#mutation = null
    if (!this.#pendingInvalidation || this.#disposed) return
    this.#pendingInvalidation = false
    this.invalidate()
  }

  private invalidate(): void {
    if (this.#disposed) return
    if (this.#mutation || this.#active) {
      this.#pendingInvalidation = true
      return
    }
    if (this.#invalidationQueued) return
    this.#invalidationQueued = true
    queueMicrotask(() => {
      this.#invalidationQueued = false
      if (!this.#disposed) void this.refresh()
    })
  }

  private publishMutation(operation: 'delete' | 'mark-read' | 'mark-unread', ids: readonly string[]): void {
    const selected = new Set(ids)
    const selectedItems = this.#state.items.filter(item => selected.has(item.id))
    if (operation === 'delete') {
      this.publish({
        items: Object.freeze(this.#state.items.filter(item => !selected.has(item.id))),
        total: Math.max(0, this.#state.total - selectedItems.length),
        unread: Math.max(0, this.#state.unread - selectedItems.filter(item => !item.read).length),
      })
      return
    }
    const read = operation === 'mark-read'
    const unreadChange = selectedItems.filter(item => item.read !== read).length
    this.publish({
      items: Object.freeze(this.#state.items.map(item => selected.has(item.id) ? Object.freeze({ ...item, read }) : item)),
      unread: read ? Math.max(0, this.#state.unread - unreadChange) : Math.min(this.#state.total, this.#state.unread + unreadChange),
    })
  }

  private publishMutationError(): void {
    this.publish({ error: 'Unable to update notifications', loading: false })
  }

  private async request(page: number): Promise<void> {
    if (this.#disposed) return
    const version = ++this.#requestVersion
    this.#active?.abort()
    const controller = new AbortController()
    this.#active = controller
    this.publish({ error: null, loading: true })
    try {
      const response = await this.#options.transport.list(page, this.#state.pageSize, controller.signal)
      if (this.#disposed || version !== this.#requestVersion) return
      this.publishPage(response)
    } catch {
      if (controller.signal.aborted || this.#disposed || version !== this.#requestVersion) return
      this.publish({ error: 'Notifications failed to load', loading: false })
    } finally {
      if (version === this.#requestVersion) {
        this.#active = null
        if (this.#pendingInvalidation && !this.#mutation) {
          this.#pendingInvalidation = false
          this.invalidate()
        }
      }
    }
  }

  private publishPage(page: PanelDatabaseNotificationPage): void {
    this.publish({ ...page, error: null, items: Object.freeze(page.items.map(item => Object.freeze(structuredClone(item)))), loading: false })
  }

  private publish(changes: Partial<ClientNotificationInboxState>): void {
    if (changes.items) {
      for (const [id, store] of this.#actions) {
        if (changes.items.some(item => item.id === id)) continue
        while (store.activeFrame) store.close()
        this.#actions.delete(id)
      }
    }
    const previous = this.#state
    this.#state = Object.freeze({ ...previous, ...changes, version: previous.version + 1 })
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}
