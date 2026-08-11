import { toJsonValue, type JsonValue } from '@holo-js/panels-core'
import type {
  WidgetClientManifest,
  WidgetClientState,
  WidgetLoadResult,
  WidgetLoader,
  WidgetScheduler,
  WidgetStateListener,
} from './contracts'
import type { WidgetFilterPersistence } from './filters'

const defaultScheduler: WidgetScheduler = {
  clear(handle) {
    clearInterval(handle as ReturnType<typeof setInterval>)
  },
  every(callback, interval) {
    return setInterval(callback, interval)
  },
}

function freezeState(state: WidgetClientState): WidgetClientState {
  return Object.freeze({ ...state, filters: Object.freeze({ ...state.filters }) })
}

function errorMessage(error: object): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Unable to load widget'
}

export class WidgetStore {
  readonly #listeners = new Set<WidgetStateListener>()
  readonly #loader: WidgetLoader
  readonly #manifest: WidgetClientManifest
  readonly #persistence: WidgetFilterPersistence | null
  readonly #scheduler: WidgetScheduler
  #controller: AbortController | null = null
  #polling: object | null = null
  #request = 0
  #state: WidgetClientState

  constructor(
    manifest: WidgetClientManifest,
    loader: WidgetLoader,
    options: {
      readonly initialResult?: WidgetLoadResult
      readonly persistence?: WidgetFilterPersistence
      readonly scheduler?: WidgetScheduler
    } = {},
  ) {
    if (manifest.polling.enabled && (manifest.polling.interval === null || manifest.polling.interval < 1)) {
      throw new Error('Enabled widget polling requires a positive interval')
    }
    this.#manifest = manifest
    this.#loader = loader
    this.#persistence = options.persistence ?? null
    this.#scheduler = options.scheduler ?? defaultScheduler
    const initialResult = options.initialResult
    this.#state = freezeState({
      data: initialResult?.data === undefined ? null : toJsonValue(initialResult.data),
      error: null,
      filters: this.#persistence?.read(manifest.filters) ?? Object.fromEntries(manifest.filters.map(filter => [filter.id, filter.defaultValue])),
      loading: false,
      status: initialResult?.status ?? 'idle',
    })
  }

  get snapshot(): WidgetClientState {
    return this.#state
  }

  subscribe(listener: WidgetStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  activate(): Promise<void> {
    this.startPolling()
    return this.load()
  }

  async load(): Promise<void> {
    this.cancelRequest()
    const request = ++this.#request
    const controller = new AbortController()
    this.#controller = controller
    this.update({ error: null, loading: true, status: 'loading' })
    try {
      const result = await this.#loader(this.#manifest.id, this.#state.filters, controller.signal)
      if (controller.signal.aborted || request !== this.#request) return
      const serialized = result.data === undefined ? null : toJsonValue(result.data)
      this.update({ data: serialized, error: null, loading: false, status: result.status })
    } catch (error) {
      if (controller.signal.aborted || request !== this.#request) return
      this.update({ data: null, error: errorMessage(Object(error)), loading: false, status: 'error' })
    } finally {
      if (this.#controller === controller) this.#controller = null
    }
  }

  async setFilter(id: string, value: JsonValue): Promise<void> {
    if (!this.#manifest.filters.some(filter => filter.id === id)) throw new Error(`Unknown widget filter ${id}`)
    const serialized = toJsonValue(value)
    const filters = Object.freeze({ ...this.#state.filters, [id]: serialized })
    this.#persistence?.write(filters, this.#manifest.filters)
    this.update({ filters })
    await this.load()
  }

  async resetFilters(): Promise<void> {
    this.#persistence?.clear()
    const filters = Object.freeze(Object.fromEntries(this.#manifest.filters.map(filter => [filter.id, filter.defaultValue])))
    this.update({ filters })
    await this.load()
  }

  startPolling(): void {
    if (this.#polling || !this.#manifest.polling.enabled || this.#manifest.polling.interval === null) return
    this.#polling = this.#scheduler.every(() => {
      void this.load()
    }, this.#manifest.polling.interval)
  }

  stop(): void {
    this.cancelRequest()
    this.#request += 1
    if (this.#polling) this.#scheduler.clear(this.#polling)
    this.#polling = null
    if (this.#state.loading) this.update({ loading: false, status: 'idle' })
  }

  private cancelRequest(): void {
    this.#controller?.abort()
    this.#controller = null
  }

  private update(changes: Partial<WidgetClientState>): void {
    const previous = this.#state
    this.#state = freezeState({ ...previous, ...changes })
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}
