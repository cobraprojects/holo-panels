import type { ClientSearchOptions, ClientSearchState, ClientSearchStateListener, ClientSearchTransport } from './contracts'

function frozen(state: ClientSearchState): ClientSearchState {
  return Object.freeze({ ...state, results: Object.freeze([...state.results]) })
}

export class GlobalSearchStore {
  readonly #debounceMilliseconds: number
  readonly #maximumLength: number
  readonly #minimumLength: number
  readonly #transport: ClientSearchTransport
  readonly #listeners = new Set<ClientSearchStateListener>()
  #abort: AbortController | null = null
  #sequence = 0
  #state: ClientSearchState = frozen({ error: null, loading: false, open: false, results: [], selectedIndex: 0, term: '' })
  #timer: ReturnType<typeof setTimeout> | null = null

  constructor(transport: ClientSearchTransport, options: ClientSearchOptions = {}) {
    this.#transport = transport
    this.#minimumLength = options.minimumLength ?? 2
    this.#maximumLength = options.maximumLength ?? 200
    this.#debounceMilliseconds = options.debounceMilliseconds ?? 250
    if (!Number.isSafeInteger(this.#minimumLength) || this.#minimumLength < 1) throw new Error('Search minimum length must be a positive integer')
    if (!Number.isSafeInteger(this.#maximumLength) || this.#maximumLength < this.#minimumLength) throw new Error('Search maximum length must not be below the minimum')
    if (!Number.isSafeInteger(this.#debounceMilliseconds) || this.#debounceMilliseconds < 0 || this.#debounceMilliseconds > 5000) throw new Error('Search debounce must be from 0 to 5000 milliseconds')
  }

  get snapshot(): ClientSearchState {
    return this.#state
  }

  input(value: string): void {
    const term = value.trimStart().slice(0, this.#maximumLength)
    this.cancelPending()
    if (term.trim().length < this.#minimumLength) {
      this.#sequence += 1
      this.update({ error: null, loading: false, results: [], selectedIndex: 0, term })
      return
    }
    this.update({ error: null, loading: true, term })
    this.#timer = setTimeout(() => {
      this.#timer = null
      void this.execute(term)
    }, this.#debounceMilliseconds)
  }

  shortcut(key: string, modifier: { readonly ctrl: boolean, readonly meta: boolean }): boolean {
    if (key.toLowerCase() !== 'k' || !modifier.ctrl && !modifier.meta) return false
    this.update({ open: true })
    return true
  }

  close(): void {
    this.cancelPending()
    this.update({ loading: false, open: false })
  }

  move(direction: -1 | 1): void {
    if (this.#state.results.length === 0) return
    const index = (this.#state.selectedIndex + direction + this.#state.results.length) % this.#state.results.length
    this.update({ selectedIndex: index })
  }

  selectedUrl(): string | null {
    return this.#state.results[this.#state.selectedIndex]?.url ?? null
  }

  subscribe(listener: ClientSearchStateListener): () => void {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  private cancelPending(): void {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
    this.#abort?.abort()
    this.#abort = null
  }

  private async execute(term: string): Promise<void> {
    const sequence = ++this.#sequence
    const controller = new AbortController()
    this.#abort?.abort()
    this.#abort = controller
    try {
      const response = await this.#transport.search(term.trim(), controller.signal)
      if (controller.signal.aborted || sequence !== this.#sequence) return
      this.update({ error: null, loading: false, results: response.results, selectedIndex: 0, term })
    } catch (error) {
      if (controller.signal.aborted || sequence !== this.#sequence) return
      this.update({ error: error instanceof Error ? error.message : 'Search failed', loading: false, results: [], selectedIndex: 0 })
    }
  }

  private update(patch: Partial<ClientSearchState>): void {
    this.#state = frozen({ ...this.#state, ...patch })
    for (const listener of this.#listeners) listener(this.#state)
  }
}
