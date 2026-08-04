type Invariant<TState extends object> = (state: Readonly<TState>) => void

export class FinalizedBuilderMutationError extends Error {
  constructor(property: PropertyKey) {
    super(`Cannot change ${String(property)} after the builder has been compiled`)
    this.name = 'FinalizedBuilderMutationError'
  }
}

export class DefinitionWriter<TState extends object> {
  readonly #invariants = new Map<string, Invariant<TState>>()
  readonly #state: TState
  #finalized = false

  constructor(initialState: TState) {
    this.#state = initialState
  }

  get state(): Readonly<TState> {
    return this.#state
  }

  registerInvariant(name: string, invariant: Invariant<TState>): void {
    if (this.#invariants.has(name)) {
      throw new Error(`Builder invariant ${name} is already registered`)
    }

    if (this.#finalized) {
      throw new FinalizedBuilderMutationError(name)
    }

    this.#invariants.set(name, invariant)
  }

  set<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void {
    if (Object.is(this.#state[key], value)) {
      return
    }

    if (this.#finalized) {
      throw new FinalizedBuilderMutationError(key)
    }

    this.#state[key] = value
  }

  finalize(): Readonly<TState> {
    for (const invariant of this.#invariants.values()) {
      invariant(this.#state)
    }

    this.#finalized = true
    return this.#state
  }
}
