import type { ClientSearchOptions, ClientSearchShortcut, ClientSearchState, ClientSearchStateListener, ClientSearchTransport } from './contracts'

function frozen(state: ClientSearchState): ClientSearchState {
  return Object.freeze({ ...state, results: Object.freeze([...state.results]) })
}

function normalizedBinding(value: string): string {
  const parts = value.toLocaleLowerCase().split('+')
  const key = parts.at(-1) ?? ''
  const modifiers = new Set(parts.slice(0, -1))
  return [...['ctrl', 'meta', 'alt', 'shift'].filter(modifier => modifiers.has(modifier)), key].join('+')
}

export class GlobalSearchStore {
  readonly #debounceMilliseconds: number
  readonly #maximumLength: number
  readonly #minimumLength: number
  readonly #keybindings: ReadonlySet<string>
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
    this.#keybindings = new Set((options.keybindings ?? ['meta+k', 'ctrl+k']).map(normalizedBinding))
    if (!Number.isSafeInteger(this.#minimumLength) || this.#minimumLength < 1) throw new Error('Search minimum length must be a positive integer')
    if (!Number.isSafeInteger(this.#maximumLength) || this.#maximumLength < this.#minimumLength) throw new Error('Search maximum length must not be below the minimum')
    if (!Number.isSafeInteger(this.#debounceMilliseconds) || this.#debounceMilliseconds < 0 || this.#debounceMilliseconds > 5000) throw new Error('Search debounce must be from 0 to 5000 milliseconds')
    if (this.#keybindings.size === 0) throw new Error('Search requires at least one key binding')
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

  shortcut(key: string, modifier: ClientSearchShortcut): boolean {
    const binding = normalizedBinding([
      ...(modifier.ctrl ? ['ctrl'] : []),
      ...(modifier.meta ? ['meta'] : []),
      ...(modifier.alt ? ['alt'] : []),
      ...(modifier.shift ? ['shift'] : []),
      key.toLocaleLowerCase(),
    ].join('+'))
    if (!this.#keybindings.has(binding)) return false
    this.open()
    return true
  }

  open(): void {
    this.update({ open: true })
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
