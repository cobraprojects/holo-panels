import type { ActionExecutionResult, ActionManifest, JsonObject } from '@holo-js/panels-core'
import type {
  ClientActionFrame,
  ClientActionState,
  ClientActionStateListener,
  ClientActionStoreOptions,
} from './contracts'

function freezeFrame<TResult>(frame: ClientActionFrame<TResult>): ClientActionFrame<TResult> {
  return Object.freeze({ ...frame, input: Object.freeze(structuredClone(frame.input)) })
}

function freezeState<TResult>(frames: readonly ClientActionFrame<TResult>[], version: number): ClientActionState<TResult> {
  return Object.freeze({ frames: Object.freeze(frames.map(freezeFrame)), version })
}

export class ClientActionStore<TResult = unknown> {
  readonly #active = new Map<string, Promise<ActionExecutionResult<number | string, TResult>>>()
  readonly #controllers = new Map<string, AbortController>()
  readonly #createIdempotencyKey: () => string
  readonly #listeners = new Set<ClientActionStateListener<TResult>>()
  readonly #transport: ClientActionStoreOptions<TResult>['transport']
  #state: ClientActionState<TResult> = freezeState([], 0)

  constructor(options: ClientActionStoreOptions<TResult>) {
    this.#createIdempotencyKey = options.createIdempotencyKey
    this.#transport = options.transport
  }

  get state(): ClientActionState<TResult> {
    return this.#state
  }

  get activeFrame(): ClientActionFrame<TResult> | null {
    return this.#state.frames.at(-1) ?? null
  }

  subscribe(listener: ClientActionStateListener<TResult>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  mount(manifest: Readonly<ActionManifest>, input: JsonObject = {}): void {
    if (this.#state.frames.some(frame => frame.manifest.id === manifest.id)) {
      throw new Error('The same action cannot mount recursively')
    }
    const parentId = this.activeFrame?.manifest.id ?? null
    const phase = manifest.confirmation ? 'confirming' : manifest.modal?.schema ? 'collecting' : 'ready'
    this.publish([...this.#state.frames, {
      error: null,
      input,
      manifest,
      parentId,
      phase,
      requestVersion: 0,
    }])
  }

  confirm(): void {
    const frame = this.requiredFrame()
    if (frame.phase !== 'confirming') return
    this.replace(frame, { phase: frame.manifest.modal?.schema ? 'collecting' : 'ready' })
  }

  setInput(input: JsonObject): void {
    const frame = this.requiredFrame()
    if (frame.phase === 'submitting') return
    this.replace(frame, { input })
  }

  close(): void {
    const frame = this.activeFrame
    if (!frame) return
    this.#controllers.get(frame.manifest.id)?.abort()
    this.#controllers.delete(frame.manifest.id)
    this.#active.delete(frame.manifest.id)
    this.publish(this.#state.frames.slice(0, -1))
  }

  submit(recordIds?: readonly (number | string)[]): Promise<ActionExecutionResult<number | string, TResult>> {
    const frame = this.requiredFrame()
    const active = this.#active.get(frame.manifest.id)
    if (active) return active
    if (frame.phase === 'confirming') throw new Error('The action must be confirmed before submission')
    const requestVersion = frame.requestVersion + 1
    const controller = new AbortController()
    this.#controllers.set(frame.manifest.id, controller)
    this.replace(frame, { error: null, phase: 'submitting', requestVersion })
    const request = this.#transport.execute({
      actionId: frame.manifest.id,
      idempotencyKey: this.#createIdempotencyKey(),
      input: frame.input,
      mount: frame.manifest.mount,
      ...(recordIds ? { recordIds } : {}),
    }, controller.signal)
    const execution = request.then(result => {
      this.settle(frame.manifest.id, requestVersion, controller, { phase: 'succeeded', result })
      return result
    }).catch((cause: unknown) => {
      this.settle(frame.manifest.id, requestVersion, controller, {
        error: cause instanceof Error ? cause.message : 'Action failed',
        phase: 'failed',
      })
      throw cause
    }).finally(() => {
      if (this.#active.get(frame.manifest.id) === execution) this.#active.delete(frame.manifest.id)
      if (this.#controllers.get(frame.manifest.id) === controller) this.#controllers.delete(frame.manifest.id)
    })
    this.#active.set(frame.manifest.id, execution)
    return execution
  }

  private requiredFrame(): ClientActionFrame<TResult> {
    const frame = this.activeFrame
    if (!frame) throw new Error('No action is mounted')
    return frame
  }

  private replace(frame: ClientActionFrame<TResult>, changes: Partial<ClientActionFrame<TResult>>): void {
    this.publish(this.#state.frames.map(candidate => candidate === frame ? { ...candidate, ...changes } : candidate))
  }

  private settle(id: string, requestVersion: number, controller: AbortController, changes: Partial<ClientActionFrame<TResult>>): void {
    if (this.#controllers.get(id) !== controller || controller.signal.aborted) return
    const frame = this.activeFrame
    if (!frame || frame.manifest.id !== id || frame.requestVersion !== requestVersion) return
    this.replace(frame, changes)
  }

  private publish(frames: readonly ClientActionFrame<TResult>[]): void {
    const previous = this.#state
    this.#state = freezeState(frames, previous.version + 1)
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}
