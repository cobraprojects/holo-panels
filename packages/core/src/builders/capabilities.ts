export interface CapabilityHost<TState extends object> {
  addInvariant(name: string, invariant: (state: Readonly<TState>) => void): void
  change<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void
}

export interface LabelState {
  label: string | null
}

export interface VisibilityState {
  hidden: boolean
}

export class LabelCapability<THost, TState extends LabelState> {
  readonly #host: THost & CapabilityHost<TState>

  constructor(host: THost & CapabilityHost<TState>) {
    this.#host = host
    host.addInvariant('label', state => {
      if (state.label !== null && state.label.trim().length === 0) {
        throw new Error('A label cannot be empty')
      }
    })
  }

  readonly label = (value: string | null): THost => {
    this.#host.change('label', value)
    return this.#host
  }
}

export class VisibilityCapability<THost, TState extends VisibilityState> {
  readonly #host: THost & CapabilityHost<TState>

  constructor(host: THost & CapabilityHost<TState>) {
    this.#host = host
  }

  readonly hidden = (value = true): THost => {
    this.#host.change('hidden', value)
    return this.#host
  }

  readonly visible = (value = true): THost => {
    this.#host.change('hidden', !value)
    return this.#host
  }
}
