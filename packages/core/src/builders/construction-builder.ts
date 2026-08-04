import { deepFreeze, type DeepReadonly } from './deep-freeze'
import { DefinitionWriter } from './definition-writer'
import {
  applyCapturedComponentDefaults,
  captureComponentDefaults,
  type CapturedComponentDefaults,
} from '../defaults/apply-defaults'
import type { DefaultableComponentKind } from '../defaults/component-default'

export abstract class ConstructionBuilder<
  TState extends object,
  TDefinition extends object,
> {
  readonly #writer: DefinitionWriter<TState>
  #defaults?: CapturedComponentDefaults
  #defaultsState: 'applying' | 'applied' | 'pending' = 'applied'
  #definition?: DeepReadonly<TDefinition>

  protected constructor(initialState: TState) {
    this.#writer = new DefinitionWriter(initialState)
  }

  compile(): DeepReadonly<TDefinition> {
    if (this.#definition) {
      return this.#definition
    }

    this.applyDefaults()
    const state = this.#writer.finalize()
    const definition = this.createDefinition(state)
    this.#definition = deepFreeze(definition)
    return this.#definition
  }

  protected abstract createDefinition(state: Readonly<TState>): TDefinition

  protected configureComponentDefaults(kind: DefaultableComponentKind, type: string): void {
    this.#defaults = captureComponentDefaults(kind, type)
    this.#defaultsState = this.#defaults ? 'pending' : 'applied'
  }

  protected readState(): Readonly<TState> {
    this.applyDefaults()
    return this.#writer.state
  }

  protected registerInvariant(name: string, invariant: (state: Readonly<TState>) => void): void {
    this.#writer.registerInvariant(name, invariant)
  }

  protected writeState<TKey extends keyof TState>(key: TKey, value: TState[TKey]): this {
    this.applyDefaults()
    this.#writer.set(key, value)
    return this
  }

  private applyDefaults(): void {
    if (this.#defaultsState !== 'pending') return
    this.#defaultsState = 'applying'
    try {
      const builder = applyCapturedComponentDefaults(this.#defaults, this)
      if (builder !== this) throw new TypeError('Automatically applied component defaults must return the configured builder instance')
      this.#defaultsState = 'applied'
    } catch (error) {
      this.#defaultsState = 'pending'
      throw error
    }
  }
}
