import type { JsonValue, OptionPage, OptionQueryRequest, OptionValue } from '@holo-js/panels-core'

interface CacheEntry<TValue extends OptionValue> {
  readonly expiresAt: number
  readonly identity: string
  readonly page: OptionPage<TValue>
}

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalJson(item)]))
  }
  return value
}

export function createOptionIdentity(request: Pick<OptionQueryRequest, 'fieldId' | 'panelId' | 'resourceId'>): string {
  return `${request.panelId}:${request.resourceId}:${request.fieldId}`
}

export function createOptionCacheKey(request: OptionQueryRequest): string {
  return JSON.stringify({
    panel: request.panelId,
    resource: request.resourceId,
    field: request.fieldId,
    dependencies: canonicalJson(request.dependencies),
    search: request.search,
    locale: request.locale,
    tenant: request.tenantKey,
    page: request.page,
    perPage: request.perPage,
  })
}

export class OptionCache<TValue extends OptionValue = OptionValue> {
  readonly #entries = new Map<string, CacheEntry<TValue>>()
  readonly #maximumEntries: number
  readonly #timeToLiveMilliseconds: number

  constructor(options: { readonly maximumEntries?: number, readonly timeToLiveMilliseconds?: number } = {}) {
    this.#maximumEntries = options.maximumEntries ?? 200
    this.#timeToLiveMilliseconds = options.timeToLiveMilliseconds ?? 60_000
    if (!Number.isSafeInteger(this.#maximumEntries) || this.#maximumEntries < 1) throw new Error('[Holo Panels] Option cache size must be a positive integer.')
    if (!Number.isSafeInteger(this.#timeToLiveMilliseconds) || this.#timeToLiveMilliseconds < 0) throw new Error('[Holo Panels] Option cache lifetime must be a non-negative integer.')
  }

  get(request: OptionQueryRequest<TValue>, now = Date.now()): OptionPage<TValue> | undefined {
    const key = createOptionCacheKey(request)
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= now) {
      this.#entries.delete(key)
      return undefined
    }
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry.page
  }

  set(request: OptionQueryRequest<TValue>, page: OptionPage<TValue>, now = Date.now()): void {
    const key = createOptionCacheKey(request)
    this.#entries.delete(key)
    this.#entries.set(key, {
      expiresAt: now + this.#timeToLiveMilliseconds,
      identity: createOptionIdentity(request),
      page,
    })
    while (this.#entries.size > this.#maximumEntries) {
      const oldest = this.#entries.keys().next().value
      if (typeof oldest !== 'string') break
      this.#entries.delete(oldest)
    }
  }

  clearField(request: Pick<OptionQueryRequest, 'fieldId' | 'panelId' | 'resourceId'>): void {
    const identity = createOptionIdentity(request)
    for (const [key, entry] of this.#entries) {
      if (entry.identity === identity) this.#entries.delete(key)
    }
  }

  clear(): void {
    this.#entries.clear()
  }
}
