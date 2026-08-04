import { toJsonValue, type JsonValue } from '@holo-js/panels-core'
import type {
  EntryActionHandler,
  EntryClientManifest,
  EntryClientObject,
  EntryHydration,
  EntrySnapshot,
  EntryStateListener,
} from './contracts'
import { formatEntryState } from './formatting'
import { safeExternalUrl } from './safety'

function identifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value)) throw new Error(`[Holo Panels] Invalid ${label} ID: ${value}`)
}

function freezeSnapshot(snapshot: EntrySnapshot): EntrySnapshot {
  return Object.freeze({
    ...snapshot,
    actions: Object.freeze([...snapshot.actions]),
    extraAttributes: Object.freeze({ ...snapshot.extraAttributes }),
    layout: Object.freeze({ ...snapshot.layout }),
    properties: Object.freeze({ ...snapshot.properties }),
    slots: Object.freeze({ ...snapshot.slots }),
  })
}

export class EntryStateStore {
  readonly #formatters: readonly EntryClientObject[]
  readonly #listeners = new Set<EntryStateListener>()
  readonly #locale: string
  #hydrationController: AbortController | null = null
  #hydrationVersion = 0
  #snapshot: EntrySnapshot

  constructor(id: string, manifest: EntryClientManifest, locale = 'en') {
    identifier(id, 'entry')
    if (!/^[a-z][a-z0-9.-]*(?::entry:[a-z][a-z0-9._-]*)?$/u.test(manifest.type)) {
      throw new Error(`[Holo Panels] Invalid entry type: ${manifest.type}`)
    }
    for (const action of manifest.actions) identifier(action, 'entry action')
    const initialState = manifest.defaultValue ?? manifest.placeholder
    this.#formatters = manifest.formatters
    this.#locale = locale
    this.#snapshot = freezeSnapshot({
      actions: manifest.actions,
      copyable: manifest.copyable,
      error: null,
      extraAttributes: manifest.extraAttributes ?? {},
      formattedState: formatEntryState(initialState, manifest.formatters, locale),
      id,
      inlineLabel: manifest.inlineLabel,
      label: manifest.label,
      layout: manifest.layout ?? {},
      pending: false,
      placeholder: manifest.placeholder,
      properties: manifest.properties,
      slots: manifest.slots ?? {},
      state: initialState,
      tooltip: null,
      type: manifest.type,
      url: null,
      visible: manifest.visible ?? true,
    })
  }

  get snapshot(): EntrySnapshot {
    return this.#snapshot
  }

  subscribe(listener: EntryStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setState(value: JsonValue): void {
    this.#invalidateHydration()
    const state = toJsonValue(value)
    this.#publish({
      ...this.#snapshot,
      state,
      formattedState: formatEntryState(state, this.#formatters, this.#locale),
      error: null,
    })
  }

  setResolved(hydration: EntryHydration): void {
    this.#invalidateHydration()
    this.#applyResolved(hydration)
  }

  async hydrate(resolve: (signal: AbortSignal) => EntryHydration | Promise<EntryHydration>): Promise<void> {
    this.#hydrationController?.abort()
    const controller = new AbortController()
    const version = ++this.#hydrationVersion
    this.#hydrationController = controller
    this.#publish({ ...this.#snapshot, pending: true, error: null })
    try {
      const hydration = await resolve(controller.signal)
      if (!this.#isCurrentHydration(version, controller)) return
      this.#applyResolved(hydration)
      this.#publish({ ...this.#snapshot, pending: false })
    } catch (error) {
      if (!this.#isCurrentHydration(version, controller)) return
      this.#publish({
        ...this.#snapshot,
        pending: false,
        error: error instanceof Error ? error.message : 'Unable to resolve entry state.',
      })
    } finally {
      if (this.#isCurrentHydration(version, controller)) this.#hydrationController = null
    }
  }

  #applyResolved(hydration: EntryHydration): void {
    const state = hydration.state === undefined ? this.#snapshot.state : hydration.state
    this.#publish({
      ...this.#snapshot,
      state,
      formattedState: formatEntryState(state, this.#formatters, this.#locale),
      tooltip: hydration.tooltip === undefined ? this.#snapshot.tooltip : hydration.tooltip,
      url: hydration.url === undefined ? this.#snapshot.url : safeExternalUrl(hydration.url),
      visible: hydration.visible === undefined ? this.#snapshot.visible : hydration.visible,
      error: null,
    })
  }

  #invalidateHydration(): void {
    this.#hydrationController?.abort()
    this.#hydrationController = null
    this.#hydrationVersion += 1
  }

  #isCurrentHydration(version: number, controller: AbortController): boolean {
    return version === this.#hydrationVersion && this.#hydrationController === controller && !controller.signal.aborted
  }

  async invokeAction(action: string, handler: EntryActionHandler): Promise<void> {
    if (!this.#snapshot.actions.includes(action)) throw new Error(`[Holo Panels] Entry action "${action}" is not allowed.`)
    await handler(action, this.#snapshot)
  }

  #publish(snapshot: EntrySnapshot): void {
    const previous = this.#snapshot
    this.#snapshot = freezeSnapshot(snapshot)
    for (const listener of this.#listeners) listener(this.#snapshot, previous)
  }
}
