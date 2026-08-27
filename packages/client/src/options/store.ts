import type {
  ChoiceOption,
  JsonValue,
  OptionDependencies,
  OptionPage,
  OptionQueryRequest,
  OptionValue,
} from '@holo-js/panels-core'
import { createOptionCacheKey, OptionCache } from './cache'

export interface OptionTransport<TValue extends OptionValue> {
  list(request: OptionQueryRequest<TValue>, signal: AbortSignal): Promise<OptionPage<TValue>>
  hydrateSelected(request: OptionQueryRequest<TValue>, values: readonly TValue[], signal: AbortSignal): Promise<readonly ChoiceOption<TValue>[]>
  validateSelection(request: OptionQueryRequest<TValue>, values: readonly TValue[], signal: AbortSignal): Promise<boolean>
  create?(request: OptionQueryRequest<TValue>, label: string, signal: AbortSignal): Promise<ChoiceOption<TValue>>
  edit?(request: OptionQueryRequest<TValue>, value: TValue, label: string, signal: AbortSignal): Promise<ChoiceOption<TValue>>
}

export interface OptionStoreIdentity {
  readonly panelId: string
  readonly resourceId: string
  readonly fieldId: string
  readonly tenantKey: string
  readonly locale: string
}

export interface OptionStoreOptions<TValue extends OptionValue> extends OptionStoreIdentity {
  readonly transport: OptionTransport<TValue>
  readonly cache?: OptionCache<TValue>
  readonly dependencies?: OptionDependencies
  readonly requiredDependencies?: readonly string[]
  readonly multiple?: boolean
  readonly preserveWhenDependencyChanges?: boolean
  readonly perPage?: number
  readonly maxPage?: number
  readonly maxPerPage?: number
  readonly maxSearchLength?: number
}

export interface OptionStoreState<TValue extends OptionValue> {
  readonly options: readonly ChoiceOption<TValue>[]
  readonly selectedOptions: readonly ChoiceOption<TValue>[]
  readonly dependencies: OptionDependencies
  readonly search: string
  readonly page: number
  readonly hasMore: boolean
  readonly total?: number
  readonly loading: boolean
  readonly disabled: boolean
  readonly error: string | null
  readonly requestVersion: number
}

export interface OptionDependencyUpdate<TValue extends OptionValue> {
  readonly selection: TValue | readonly TValue[] | null
  readonly status: 'cleared' | 'preserved' | 'stale' | 'unchanged'
}

export type OptionStateListener<TValue extends OptionValue> = (
  state: OptionStoreState<TValue>,
  previous: OptionStoreState<TValue>,
) => void

function frozenOptions<TValue extends OptionValue>(options: readonly ChoiceOption<TValue>[]): readonly ChoiceOption<TValue>[] {
  const seen = new Set<OptionValue>()
  return Object.freeze(options.map(option => {
    if ((typeof option.value !== 'string' && typeof option.value !== 'number') || option.value === '' || (typeof option.value === 'number' && !Number.isFinite(option.value))) {
      throw new Error('[Holo Panels] Option response contains an invalid value.')
    }
    if (seen.has(option.value)) throw new Error(`[Holo Panels] Option response contains duplicate value "${String(option.value)}".`)
    seen.add(option.value)
    const label = option.label.trim()
    if (!label) throw new Error('[Holo Panels] Option response labels cannot be empty.')
    return Object.freeze({ value: option.value, label, ...(option.disabled ? { disabled: true } : {}) })
  }))
}

function freezeDependencies(dependencies: OptionDependencies): OptionDependencies {
  return Object.freeze({ ...dependencies })
}

function dependencyReady(value: JsonValue | undefined): boolean {
  return typeof value !== 'undefined' && value !== null && value !== ''
}

function selectedValues<TValue extends OptionValue>(selection: TValue | readonly TValue[] | null): readonly TValue[] {
  if (selection === null) return []
  return Array.isArray(selection) ? selection : [selection as TValue]
}

export class OptionStore<TValue extends OptionValue> {
  readonly #identity: OptionStoreIdentity
  readonly #transport: OptionTransport<TValue>
  readonly #cache: OptionCache<TValue>
  readonly #requiredDependencies: readonly string[]
  readonly #multiple: boolean
  readonly #preserveWhenDependencyChanges: boolean
  readonly #perPage: number
  readonly #maxPage: number
  readonly #maxPerPage: number
  readonly #maxSearchLength: number
  readonly #listeners = new Set<OptionStateListener<TValue>>()
  #state: OptionStoreState<TValue>
  #requestSequence = 0
  #activeRequest?: AbortController

  constructor(options: OptionStoreOptions<TValue>) {
    this.#identity = Object.freeze({
      panelId: options.panelId,
      resourceId: options.resourceId,
      fieldId: options.fieldId,
      tenantKey: options.tenantKey,
      locale: options.locale,
    })
    this.#transport = options.transport
    this.#cache = options.cache ?? new OptionCache<TValue>()
    this.#requiredDependencies = Object.freeze([...(options.requiredDependencies ?? [])])
    this.#multiple = options.multiple ?? false
    this.#preserveWhenDependencyChanges = options.preserveWhenDependencyChanges ?? false
    this.#perPage = options.perPage ?? 25
    this.#maxPage = options.maxPage ?? 10_000
    this.#maxPerPage = options.maxPerPage ?? 100
    this.#maxSearchLength = options.maxSearchLength ?? 250
    this.assertRequestBounds('', 1, this.#perPage)
    const dependencies = freezeDependencies(options.dependencies ?? {})
    this.#state = Object.freeze({
      options: Object.freeze([]),
      selectedOptions: Object.freeze([]),
      dependencies,
      search: '',
      page: 1,
      hasMore: false,
      loading: false,
      disabled: !this.dependenciesReady(dependencies),
      error: null,
      requestVersion: 0,
    })
  }

  get state(): OptionStoreState<TValue> {
    return this.#state
  }

  cancelRequests(): void {
    this.abortActiveRequest()
  }

  subscribe(listener: OptionStateListener<TValue>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async load(search = '', page = 1): Promise<'applied' | 'cached' | 'disabled' | 'stale'> {
    this.assertRequestBounds(search, page, this.#perPage)
    if (!this.dependenciesReady(this.#state.dependencies)) {
      this.publish({ ...this.#state, disabled: true, loading: false })
      return 'disabled'
    }
    const request = this.request(search, page)
    const cached = this.#cache.get(request)
    if (cached) {
      this.applyPage(request, cached)
      return 'cached'
    }
    const { controller, version } = this.startRequest()
    this.publish({ ...this.#state, search, page, loading: true, disabled: false, error: null, requestVersion: version })
    try {
      const response = this.validatePage(await this.#transport.list(request, controller.signal), request)
      if (!this.isCurrent(controller, version)) return 'stale'
      this.#cache.set(request, response)
      this.applyPage(request, response)
      return 'applied'
    } catch (error) {
      if (!this.isCurrent(controller, version)) return 'stale'
      if (controller.signal.aborted) return 'stale'
      this.publish({ ...this.#state, loading: false, error: error instanceof Error ? error.message : 'Unable to load options.' })
      throw error
    }
  }

  preload(): Promise<'applied' | 'cached' | 'disabled' | 'stale'> {
    return this.load('', 1)
  }

  async hydrateSelected(values: readonly TValue[]): Promise<'applied' | 'disabled' | 'stale'> {
    if (values.length === 0) {
      this.publish({ ...this.#state, selectedOptions: Object.freeze([]) })
      return 'applied'
    }
    if (!this.dependenciesReady(this.#state.dependencies)) return 'disabled'
    const { controller, version } = this.startRequest()
    const request = this.request('', 1, values)
    try {
      const options = frozenOptions(await this.#transport.hydrateSelected(request, values, controller.signal))
      if (!this.isCurrent(controller, version)) return 'stale'
      const requested = new Set<OptionValue>(values)
      if (options.some(option => !requested.has(option.value))) throw new Error('[Holo Panels] Selected-label response contains an unrequested value.')
      this.publish({ ...this.#state, selectedOptions: options, requestVersion: version })
      return 'applied'
    } catch (error) {
      if (!this.isCurrent(controller, version) || controller.signal.aborted) return 'stale'
      throw error
    }
  }

  async updateDependencies(
    dependencies: OptionDependencies,
    selection: TValue | readonly TValue[] | null,
  ): Promise<OptionDependencyUpdate<TValue>> {
    const nextDependencies = freezeDependencies(dependencies)
    if (createOptionCacheKey(this.request('', 1)) === createOptionCacheKey(this.request('', 1, undefined, nextDependencies))) {
      return Object.freeze({ selection, status: 'unchanged' })
    }
    this.abortActiveRequest()
    this.#cache.clearField(this.#identity)
    const disabled = !this.dependenciesReady(nextDependencies)
    this.publish({
      ...this.#state,
      dependencies: nextDependencies,
      options: Object.freeze([]),
      selectedOptions: Object.freeze([]),
      page: 1,
      hasMore: false,
      disabled,
      loading: false,
      error: null,
      requestVersion: ++this.#requestSequence,
    })
    const values = selectedValues(selection)
    if (!this.#preserveWhenDependencyChanges || values.length === 0 || disabled) {
      return Object.freeze({ selection: this.emptySelection(), status: 'cleared' })
    }
    const { controller, version } = this.startRequest()
    try {
      const valid = await this.#transport.validateSelection(this.request('', 1, values), values, controller.signal)
      if (!this.isCurrent(controller, version)) return Object.freeze({ selection, status: 'stale' })
      if (!valid) return Object.freeze({ selection: this.emptySelection(), status: 'cleared' })
      const hydration = await this.hydrateSelected(values)
      return Object.freeze({ selection, status: hydration === 'applied' ? 'preserved' : 'stale' })
    } catch (error) {
      if (!this.isCurrent(controller, version) || controller.signal.aborted) return Object.freeze({ selection, status: 'stale' })
      throw error
    }
  }

  async create(label: string): Promise<ChoiceOption<TValue>> {
    if (!this.#transport.create) throw new Error('[Holo Panels] Creating options is disabled for this field.')
    const controller = new AbortController()
    const option = frozenOptions([await this.#transport.create(this.request('', 1), label, controller.signal)])[0]
    if (!option) throw new Error('[Holo Panels] Option creation returned no option.')
    this.#cache.clearField(this.#identity)
    return option
  }

  async edit(value: TValue, label: string): Promise<ChoiceOption<TValue>> {
    if (!this.#transport.edit) throw new Error('[Holo Panels] Editing options is disabled for this field.')
    const controller = new AbortController()
    const option = frozenOptions([await this.#transport.edit(this.request('', 1), value, label, controller.signal)])[0]
    if (!option || option.value !== value) throw new Error('[Holo Panels] Edited option identity cannot change.')
    this.#cache.clearField(this.#identity)
    return option
  }

  private request(
    search: string,
    page: number,
    values?: readonly TValue[],
    dependencies = this.#state.dependencies,
  ): OptionQueryRequest<TValue> {
    return Object.freeze({
      ...this.#identity,
      dependencies,
      search,
      page,
      perPage: this.#perPage,
      ...(values ? { selectedValues: Object.freeze([...values]) } : {}),
    })
  }

  private validatePage(page: OptionPage<TValue>, request: OptionQueryRequest<TValue>): OptionPage<TValue> {
    if (page.page !== request.page || page.perPage !== request.perPage || page.options.length > request.perPage) {
      throw new Error('[Holo Panels] Option response pagination does not match the request.')
    }
    return Object.freeze({ ...page, options: frozenOptions(page.options) })
  }

  private applyPage(request: OptionQueryRequest<TValue>, page: OptionPage<TValue>): void {
    this.publish({
      ...this.#state,
      options: page.options,
      search: request.search,
      page: page.page,
      hasMore: page.hasMore,
      ...(typeof page.total === 'number' ? { total: page.total } : {}),
      loading: false,
      disabled: false,
      error: null,
    })
  }

  private startRequest(): { readonly controller: AbortController, readonly version: number } {
    this.abortActiveRequest()
    const controller = new AbortController()
    this.#activeRequest = controller
    return { controller, version: ++this.#requestSequence }
  }

  private abortActiveRequest(): void {
    this.#activeRequest?.abort()
    this.#activeRequest = undefined
  }

  private isCurrent(controller: AbortController, version: number): boolean {
    return this.#activeRequest === controller && this.#requestSequence === version
  }

  private dependenciesReady(dependencies: OptionDependencies): boolean {
    return this.#requiredDependencies.every(path => dependencyReady(dependencies[path]))
  }

  private emptySelection(): readonly TValue[] | null {
    return this.#multiple ? Object.freeze([]) : null
  }

  private assertRequestBounds(search: string, page: number, perPage: number): void {
    if (search.length > this.#maxSearchLength) throw new Error(`[Holo Panels] Option search exceeds the ${this.#maxSearchLength} character limit.`)
    if (!Number.isSafeInteger(page) || page < 1 || page > this.#maxPage) throw new Error(`[Holo Panels] Option page must be an integer from 1 to ${this.#maxPage}.`)
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > this.#maxPerPage) throw new Error(`[Holo Panels] Option page size must be an integer from 1 to ${this.#maxPerPage}.`)
  }

  private publish(state: OptionStoreState<TValue>): void {
    if (state === this.#state) return
    const previous = this.#state
    this.#state = Object.freeze(state)
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}
