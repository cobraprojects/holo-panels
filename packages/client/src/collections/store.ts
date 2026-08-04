export interface CollectionItem<TValue> {
  readonly collapsed: boolean
  readonly key: string
  readonly value: TValue
}

export interface CollectionState<TValue> {
  readonly errors: Readonly<Record<string, readonly string[]>>
  readonly items: readonly CollectionItem<TValue>[]
  readonly version: number
}

export type CollectionStateListener<TValue> = (
  state: CollectionState<TValue>,
  previous: CollectionState<TValue>,
) => void

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value)
}

function freezeValue<TValue>(value: TValue): TValue {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  if (Array.isArray(value)) {
    for (const child of value) freezeValue(child)
    return Object.freeze(value)
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value
  for (const child of Object.values(value)) freezeValue(child)
  return Object.freeze(value)
}

function hash(value: string): string {
  let current = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index)
    current = Math.imul(current, 16_777_619)
  }
  return (current >>> 0).toString(36)
}

export function createStableCollectionKey(value: unknown, index: number, namespace = 'item'): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Collection key indexes must be non-negative integers')
  if (!/^[a-z][a-z0-9-]*$/u.test(namespace)) throw new Error('Collection key namespaces require kebab-case identifiers')
  return `${namespace}-${index}-${hash(JSON.stringify(value) ?? 'undefined')}`
}

function remapErrorPath(path: string, remap: (index: number) => number | undefined): string | undefined {
  const [head, ...tail] = path.split('.')
  const index = Number(head)
  if (!Number.isSafeInteger(index) || index < 0) return path
  const next = remap(index)
  return typeof next === 'number' ? [String(next), ...tail].join('.') : undefined
}

function remapErrors(
  errors: Readonly<Record<string, readonly string[]>>,
  remap: (index: number) => number | undefined,
): Readonly<Record<string, readonly string[]>> {
  return Object.freeze(Object.fromEntries(Object.entries(errors).flatMap(([path, messages]) => {
    const next = remapErrorPath(path, remap)
    return next ? [[next, messages]] : []
  })))
}

function frozenState<TValue>(state: CollectionState<TValue>): CollectionState<TValue> {
  return Object.freeze({
    errors: Object.freeze({ ...state.errors }),
    items: Object.freeze(state.items.map(item => Object.freeze({ ...item, value: freezeValue(item.value) }))),
    version: state.version,
  })
}

export class CollectionStore<TValue> {
  readonly #listeners = new Set<CollectionStateListener<TValue>>()
  readonly #namespace: string
  #state: CollectionState<TValue>
  #sequence = 0

  constructor(values: readonly TValue[] = [], namespace = 'item') {
    this.#namespace = namespace
    this.#state = frozenState({
      errors: {},
      items: values.map((value, index) => ({ collapsed: false, key: createStableCollectionKey(value, index, namespace), value: clone(value) })),
      version: 0,
    })
  }

  get state(): CollectionState<TValue> {
    return this.#state
  }

  get values(): readonly TValue[] {
    return Object.freeze(this.#state.items.map(item => clone(item.value)))
  }

  subscribe(listener: CollectionStateListener<TValue>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  add(value: TValue, index = this.#state.items.length): CollectionItem<TValue> {
    if (!Number.isSafeInteger(index) || index < 0 || index > this.#state.items.length) throw new Error('Collection insertion index is out of bounds')
    const item = Object.freeze({ collapsed: false, key: this.nextKey(value), value: clone(value) })
    const items = [...this.#state.items]
    items.splice(index, 0, item)
    const errors = remapErrors(this.#state.errors, current => current >= index ? current + 1 : current)
    this.publish({ errors, items, version: this.#state.version + 1 })
    return item
  }

  delete(index: number): TValue {
    this.assertIndex(index)
    const items = [...this.#state.items]
    const [removed] = items.splice(index, 1)
    const errors = remapErrors(this.#state.errors, current => current === index ? undefined : current > index ? current - 1 : current)
    this.publish({ errors, items, version: this.#state.version + 1 })
    if (!removed) throw new Error('Collection item was not found')
    return clone(removed.value)
  }

  clone(index: number): CollectionItem<TValue> {
    this.assertIndex(index)
    const source = this.#state.items[index]
    if (!source) throw new Error('Collection item was not found')
    return this.add(clone(source.value), index + 1)
  }

  move(from: number, to: number): void {
    this.assertIndex(from)
    this.assertIndex(to)
    if (from === to) return
    const items = [...this.#state.items]
    const [item] = items.splice(from, 1)
    if (!item) throw new Error('Collection item was not found')
    items.splice(to, 0, item)
    const errors = remapErrors(this.#state.errors, current => {
      if (current === from) return to
      if (from < to && current > from && current <= to) return current - 1
      if (from > to && current >= to && current < from) return current + 1
      return current
    })
    this.publish({ errors, items, version: this.#state.version + 1 })
  }

  toggleCollapsed(index: number, collapsed?: boolean): void {
    this.assertIndex(index)
    const items = this.#state.items.map((item, current) => current === index
      ? { ...item, collapsed: collapsed ?? !item.collapsed }
      : item)
    this.publish({ ...this.#state, items, version: this.#state.version + 1 })
  }

  replace(index: number, value: TValue): void {
    this.assertIndex(index)
    const items = this.#state.items.map((item, current) => current === index
      ? { ...item, value: clone(value) }
      : item)
    this.publish({ ...this.#state, items, version: this.#state.version + 1 })
  }

  setErrors(errors: Readonly<Record<string, string | readonly string[]>>): void {
    const normalized = Object.fromEntries(Object.entries(errors).flatMap(([path, messages]) => {
      const values = (typeof messages === 'string' ? [messages] : messages).map(message => message.trim()).filter(Boolean)
      return values.length > 0 ? [[path, Object.freeze(values)]] : []
    }))
    this.publish({ ...this.#state, errors: normalized, version: this.#state.version + 1 })
  }

  hydrate(values: readonly TValue[]): void {
    const items = values.map((value, index) => ({
      collapsed: false,
      key: createStableCollectionKey(value, index, this.#namespace),
      value: clone(value),
    }))
    this.publish({ errors: {}, items, version: this.#state.version + 1 })
  }

  private assertIndex(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.#state.items.length) throw new Error('Collection index is out of bounds')
  }

  private nextKey(value: TValue): string {
    const existing = new Set(this.#state.items.map(item => item.key))
    let key: string
    do {
      key = `${this.#namespace}-new-${this.#sequence}-${hash(JSON.stringify(value) ?? 'undefined')}`
      this.#sequence += 1
    } while (existing.has(key))
    return key
  }

  private publish(state: CollectionState<TValue>): void {
    const previous = this.#state
    this.#state = frozenState(state)
    for (const listener of this.#listeners) listener(this.#state, previous)
  }
}

export class BuilderCollectionStore<TBlock extends { readonly data: object, readonly type: string }> extends CollectionStore<TBlock> {
  addBlock(block: TBlock, index?: number): CollectionItem<TBlock> {
    return this.add(block, index)
  }
}
