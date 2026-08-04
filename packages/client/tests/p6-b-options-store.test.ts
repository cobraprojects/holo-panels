import type { ChoiceOption, OptionPage, OptionQueryRequest } from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import { createOptionCacheKey, OptionCache, OptionStore, type OptionTransport } from '../src/options'

function page(request: OptionQueryRequest<number>, options: readonly ChoiceOption<number>[]): OptionPage<number> {
  return {
    options,
    page: request.page,
    perPage: request.perPage,
    hasMore: false,
    total: options.length,
  }
}

function request(overrides: Partial<OptionQueryRequest<number>> = {}): OptionQueryRequest<number> {
  return {
    panelId: 'admin',
    resourceId: 'locations',
    fieldId: 'city_id',
    tenantKey: 'tenant:1',
    locale: 'en',
    dependencies: { countryId: 10, regionId: 2 },
    search: '',
    page: 1,
    perPage: 25,
    ...overrides,
  }
}

function deferred<TValue>(): {
  readonly promise: Promise<TValue>
  resolve(value: TValue): void
  reject(reason: Error): void
} {
  let resolvePromise: (value: TValue) => void = () => undefined
  let rejectPromise: (reason: Error) => void = () => undefined
  const promise = new Promise<TValue>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('P6-B option cache', () => {
  it('keys every scope dimension and canonicalizes dependency order', () => {
    const base = request()
    const reordered = request({ dependencies: { regionId: 2, countryId: 10 } })

    expect(createOptionCacheKey(base)).toBe(createOptionCacheKey(reordered))
    for (const changed of [
      request({ panelId: 'staff' }),
      request({ resourceId: 'offices' }),
      request({ fieldId: 'office_id' }),
      request({ dependencies: { countryId: 20 } }),
      request({ search: 'ca' }),
      request({ locale: 'ar' }),
      request({ tenantKey: 'tenant:2' }),
      request({ page: 2 }),
    ]) expect(createOptionCacheKey(changed)).not.toBe(createOptionCacheKey(base))
  })

  it('expires, bounds, and invalidates field entries', () => {
    const cache = new OptionCache<number>({ maximumEntries: 2, timeToLiveMilliseconds: 10 })
    const first = request()
    const second = request({ page: 2 })
    const third = request({ page: 3 })
    cache.set(first, page(first, [{ value: 1, label: 'Cairo' }]), 0)
    cache.set(second, page(second, [{ value: 2, label: 'Giza' }]), 1)
    cache.set(third, page(third, [{ value: 3, label: 'Paris' }]), 2)

    expect(cache.get(first, 3)).toBeUndefined()
    expect(cache.get(second, 3)?.options[0]?.value).toBe(2)
    expect(cache.get(second, 12)).toBeUndefined()
    cache.clearField(third)
    expect(cache.get(third, 3)).toBeUndefined()
  })
})

describe('P6-B option store', () => {
  it('disables unresolved dependencies, clears by default, preloads, paginates, and caches', async () => {
    const requests: OptionQueryRequest<number>[] = []
    const transport: OptionTransport<number> = {
      list: async optionRequest => {
        requests.push(optionRequest)
        return page(optionRequest, [{ value: optionRequest.page, label: `Page ${optionRequest.page}` }])
      },
      hydrateSelected: async (_optionRequest, values) => values.map(value => ({ value, label: `City ${value}` })),
      validateSelection: async () => true,
    }
    const store = new OptionStore({
      panelId: 'admin',
      resourceId: 'locations',
      fieldId: 'city_id',
      tenantKey: 'tenant:1',
      locale: 'en',
      dependencies: {},
      requiredDependencies: ['countryId'],
      transport,
    })

    await expect(store.preload()).resolves.toBe('disabled')
    await expect(store.updateDependencies({ countryId: 10 }, 1)).resolves.toEqual({ selection: null, status: 'cleared' })
    await expect(store.preload()).resolves.toBe('applied')
    await expect(store.load('', 1)).resolves.toBe('cached')
    await expect(store.load('', 2)).resolves.toBe('applied')

    expect(requests).toHaveLength(2)
    expect(store.state.options).toEqual([{ value: 2, label: 'Page 2' }])
    expect(store.state.page).toBe(2)
    expect(store.state.disabled).toBe(false)
  })

  it('preserves and revalidates selections after dependency changes', async () => {
    const validated: number[][] = []
    const transport: OptionTransport<number> = {
      list: async optionRequest => page(optionRequest, []),
      hydrateSelected: async (_optionRequest, values) => values.map(value => ({ value, label: `City ${value}` })),
      validateSelection: async (optionRequest, values) => {
        validated.push([...values])
        return optionRequest.dependencies.countryId === 20 && values[0] === 1
      },
    }
    const store = new OptionStore({
      panelId: 'admin',
      resourceId: 'locations',
      fieldId: 'city_id',
      tenantKey: 'tenant:1',
      locale: 'en',
      dependencies: { countryId: 10 },
      requiredDependencies: ['countryId'],
      preserveWhenDependencyChanges: true,
      transport,
    })

    await expect(store.updateDependencies({ countryId: 20 }, 1)).resolves.toEqual({ selection: 1, status: 'preserved' })
    expect(store.state.selectedOptions).toEqual([{ value: 1, label: 'City 1' }])
    await expect(store.updateDependencies({ countryId: 30 }, 1)).resolves.toEqual({ selection: null, status: 'cleared' })
    expect(validated).toEqual([[1], [1]])
  })

  it('ignores stale searches and selected-label hydration responses', async () => {
    const oldSearch = deferred<OptionPage<number>>()
    const oldLabels = deferred<readonly ChoiceOption<number>[]>()
    const transport: OptionTransport<number> = {
      list: optionRequest => optionRequest.search === 'old'
        ? oldSearch.promise
        : Promise.resolve(page(optionRequest, [{ value: 2, label: 'New' }])),
      hydrateSelected: (_optionRequest, values) => values[0] === 1
        ? oldLabels.promise
        : Promise.resolve([{ value: 2, label: 'New label' }]),
      validateSelection: async () => true,
    }
    const store = new OptionStore({
      panelId: 'admin', resourceId: 'locations', fieldId: 'city_id', tenantKey: 'tenant:1', locale: 'en', transport,
    })

    const staleSearch = store.load('old')
    await expect(store.load('new')).resolves.toBe('applied')
    oldSearch.resolve(page(request({ search: 'old' }), [{ value: 1, label: 'Old' }]))
    await expect(staleSearch).resolves.toBe('stale')
    expect(store.state.options).toEqual([{ value: 2, label: 'New' }])

    const staleLabels = store.hydrateSelected([1])
    await expect(store.hydrateSelected([2])).resolves.toBe('applied')
    oldLabels.reject(new Error('aborted request'))
    await expect(staleLabels).resolves.toBe('stale')
    expect(store.state.selectedOptions).toEqual([{ value: 2, label: 'New label' }])
  })

  it('rejects malicious IDs, response metadata, oversized requests, and identity-changing edits', async () => {
    const transport: OptionTransport<number> = {
      list: async optionRequest => ({ ...page(optionRequest, [{ value: Number.NaN, label: 'Bad' }]), page: optionRequest.page + 1 }),
      hydrateSelected: async () => [{ value: 999, label: 'Injected' }],
      validateSelection: async () => true,
      edit: async (_optionRequest, value) => ({ value: value + 1, label: 'Changed' }),
    }
    const store = new OptionStore({
      panelId: 'admin', resourceId: 'locations', fieldId: 'city_id', tenantKey: 'tenant:1', locale: 'en', transport,
      maxPage: 5, maxPerPage: 10, perPage: 10, maxSearchLength: 20,
    })

    await expect(store.load('', 6)).rejects.toThrow(/1 to 5/u)
    await expect(store.load('x'.repeat(21))).rejects.toThrow(/20 character/u)
    await expect(store.load()).rejects.toThrow(/pagination does not match/u)
    await expect(store.hydrateSelected([1])).rejects.toThrow(/unrequested value/u)
    await expect(store.edit(1, 'Changed')).rejects.toThrow(/identity cannot change/u)
  })
})
