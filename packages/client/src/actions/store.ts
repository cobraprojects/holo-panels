import type { ActionExecutionResult, ActionManifest, JsonObject } from '@holo-js/panels-core'
import type { FormStore } from '../forms/store'
import { actionFormSchema, createActionForm, createActionOptions, type ActionFormField } from './form'
import type { OptionStore } from '../options/store'
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
  readonly #forms = new Map<string, { readonly store: FormStore<JsonObject>, readonly unsubscribe: () => void }>()
  readonly #options = new Map<string, Map<string, OptionStore<number | string>>>()
  readonly #createOptionStore: ClientActionStoreOptions<TResult>['createOptionStore']
  readonly #createIdempotencyKey: () => string
  readonly #listeners = new Set<ClientActionStateListener<TResult>>()
  readonly #transport: ClientActionStoreOptions<TResult>['transport']
  #state: ClientActionState<TResult> = freezeState([], 0)

  constructor(options: ClientActionStoreOptions<TResult>) {
    this.#createOptionStore = options.createOptionStore
    this.#createIdempotencyKey = options.createIdempotencyKey
    this.#transport = options.transport
  }

  get state(): ClientActionState<TResult> {
    return this.#state
  }

  get activeFrame(): ClientActionFrame<TResult> | null {
    return this.#state.frames.at(-1) ?? null
  }

  get activeForm(): FormStore<JsonObject> | null {
    const id = this.activeFrame?.manifest.id
    return id ? this.#forms.get(id)?.store ?? null : null
  }

  optionStore(field: ActionFormField): OptionStore<number | string> | undefined {
    const frame = this.requiredFrame()
    const stores = this.#options.get(frame.manifest.id) ?? new Map<string, OptionStore<number | string>>()
    const store = stores.get(field.path) ?? this.#createOptionStore?.(field, frame.manifest.id) ?? createActionOptions(field, frame.manifest.id)
    if (store && !stores.has(field.path)) {
      stores.set(field.path, store)
      if (field.properties?.preload) void store.load('', 1)
    }
    this.#options.set(frame.manifest.id, stores)
    return store
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
    const schema = actionFormSchema(manifest.modal?.schema ?? null, manifest.id)
    const form = schema ? createActionForm(schema, input) : null
    if (form) this.#forms.set(manifest.id, {
      store: form,
      unsubscribe: form.subscribe(state => {
        if (this.activeFrame?.manifest.id === manifest.id) this.setInput({ ...state.values })
      }),
    })
    const phase = manifest.confirmation ? 'confirming' : manifest.modal?.schema ? 'collecting' : 'ready'
    this.publish([...this.#state.frames, {
      error: null,
      input: form ? { ...form.state.values } : input,
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
    this.#forms.get(frame.manifest.id)?.unsubscribe()
    this.#forms.get(frame.manifest.id)?.store.cancelRequests()
    this.#forms.delete(frame.manifest.id)
    for (const options of this.#options.get(frame.manifest.id)?.values() ?? []) options.cancelRequests()
    this.#options.delete(frame.manifest.id)
    this.publish(this.#state.frames.slice(0, -1))
  }

  dispose(): void {
    this.#listeners.clear()
    while (this.activeFrame) this.close()
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
    let request: Promise<ActionExecutionResult<number | string, TResult>>
    try {
      request = this.#transport.execute({
      actionId: frame.manifest.id,
      idempotencyKey: this.#createIdempotencyKey(),
      input: frame.input,
      mount: frame.manifest.mount,
      ...(recordIds ? { recordIds } : {}),
      }, controller.signal)
    } catch (cause) {
      request = Promise.reject(cause)
    }
    const execution = request.then(result => {
      this.settle(frame.manifest.id, requestVersion, controller, { phase: 'succeeded', result })
      return result
    }).catch((cause: unknown) => {
      this.settle(frame.manifest.id, requestVersion, controller, {
        error: 'The action could not be completed.',
        phase: 'failed',
      })
      if (!frame.manifest.modal && this.#controllers.get(frame.manifest.id) === controller && !controller.signal.aborted && this.activeFrame?.manifest.id === frame.manifest.id && this.activeFrame.requestVersion === requestVersion) this.close()
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
