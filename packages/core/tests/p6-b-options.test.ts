import { field, schema, type InferFormData } from '@holo-js/forms'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { JsonValue } from '../src/protocol/json'
import type { FieldResolverContext, FormFieldPath, FormFieldValue } from '../src/fields/base'
import {
  choiceFields,
  CustomOptionSource,
  OptionService,
  RelationshipOptionSource,
  ResolverOptionSource,
  StaticOptionSource,
  type HoloOptionPage,
  type HoloOptionQuery,
  type OptionQueryRequest,
} from '../src/fields/options'

const locationSchema = schema({
  countryId: field.number().optional(),
  cityId: field.number().optional(),
  cityIds: field.array(field.number()).optional(),
  display: field.string().optional(),
})

type LocationValues = InferFormData<typeof locationSchema>

interface CityRecord {
  readonly id: number
  readonly countryId: number
  readonly tenantId: number
  readonly name: string
  readonly active: boolean
  readonly authorized: boolean
}

type CityContext = FieldResolverContext<LocationValues, 'cityId'> & { readonly tenantId: number }
type QueryOperation = readonly [name: string, ...arguments_: readonly unknown[]]

const cities: readonly CityRecord[] = [
  { id: 1, countryId: 10, tenantId: 1, name: 'Cairo', active: true, authorized: true },
  { id: 2, countryId: 10, tenantId: 1, name: 'Giza', active: true, authorized: true },
  { id: 3, countryId: 20, tenantId: 1, name: 'Paris', active: true, authorized: true },
  { id: 4, countryId: 10, tenantId: 2, name: 'Alexandria', active: true, authorized: true },
  { id: 5, countryId: 10, tenantId: 1, name: 'Restricted', active: true, authorized: false },
  { id: 6, countryId: 10, tenantId: 1, name: 'Disabled', active: false, authorized: true },
]

function read(record: CityRecord, column: string): unknown {
  return Reflect.get(record, column)
}

class CityQuery implements HoloOptionQuery<CityQuery, CityRecord> {
  readonly operations: readonly QueryOperation[]
  readonly #predicates: readonly ((record: CityRecord) => boolean)[]
  readonly #orders: readonly string[]

  constructor(
    operations: readonly QueryOperation[] = [],
    predicates: readonly ((record: CityRecord) => boolean)[] = [],
    orders: readonly string[] = [],
  ) {
    this.operations = operations
    this.#predicates = predicates
    this.#orders = orders
  }

  where(column: string, value: JsonValue): CityQuery {
    return this.next(['where', column, value], record => read(record, column) === value)
  }

  whereIn(column: string, values: readonly (string | number)[]): CityQuery {
    return this.next(['whereIn', column, values], record => values.includes(read(record, column) as string | number))
  }

  whereAny(columns: readonly string[], operator: 'like', value: string): CityQuery {
    const needle = value.slice(1, -1).replaceAll('\\%', '%').replaceAll('\\_', '_').toLowerCase()
    return this.next(['whereAny', columns, operator, value], record => columns.some(column => String(read(record, column)).toLowerCase().includes(needle)))
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): CityQuery {
    return new CityQuery([...this.operations, ['orderBy', column, direction]], this.#predicates, [...this.#orders, column])
  }

  async paginate(perPage: number, page: number): Promise<HoloOptionPage<CityRecord>> {
    const records = this.records()
    const offset = (page - 1) * perPage
    return {
      data: records.slice(offset, offset + perPage),
      meta: {
        total: records.length,
        currentPage: page,
        perPage,
        hasMorePages: offset + perPage < records.length,
      },
    }
  }

  async get(): Promise<readonly CityRecord[]> {
    return this.records()
  }

  private next(operation: QueryOperation, predicate: (record: CityRecord) => boolean): CityQuery {
    return new CityQuery([...this.operations, operation], [...this.#predicates, predicate], this.#orders)
  }

  private records(): readonly CityRecord[] {
    return cities
      .filter(record => this.#predicates.every(predicate => predicate(record)))
      .sort((left, right) => this.#orders.reduce((result, column) => result || String(read(left, column)).localeCompare(String(read(right, column))), 0))
  }
}

function context(countryId: number, tenantId = 1): CityContext {
  const values: LocationValues = { countryId, cityId: undefined, cityIds: undefined, display: undefined }
  return {
    operation: 'edit',
    path: 'cityId',
    value: undefined,
    values,
    tenantId,
    get: path => path.split('.').reduce<unknown>((current, segment) => (
      typeof current === 'object' && current !== null ? Reflect.get(current, segment) : undefined
    ), values) as FormFieldValue<LocationValues, typeof path>,
  }
}

function request(overrides: Partial<OptionQueryRequest<number>> = {}): OptionQueryRequest<number> {
  return {
    panelId: 'admin',
    resourceId: 'locations',
    fieldId: 'city_id',
    tenantKey: 'tenant:1',
    locale: 'en',
    dependencies: { countryId: 10 },
    search: '',
    page: 1,
    perPage: 25,
    ...overrides,
  }
}

function relationshipSource(): RelationshipOptionSource<LocationValues, 'cityId', unknown, CityQuery, CityRecord, number, CityContext> {
  return new RelationshipOptionSource<LocationValues, 'cityId', unknown, CityQuery, CityRecord, number, CityContext>({
    valueColumn: 'id',
    labelColumn: 'name',
    searchColumns: ['name'],
    createQuery: () => new CityQuery(),
    applyAuthorizationScope: query => query.where('authorized', true),
    applyTenantScope: (query, fieldContext) => query.where('tenantId', fieldContext.tenantId),
    value: city => city.id,
    label: city => city.name,
    disabled: city => !city.active,
    create: async (label, fieldContext) => ({ id: 7, countryId: fieldContext.get('countryId') ?? 0, tenantId: fieldContext.tenantId, name: label, active: true, authorized: true }),
    edit: async (value, label, fieldContext) => ({ id: value, countryId: fieldContext.get('countryId') ?? 0, tenantId: fieldContext.tenantId, name: label, active: true, authorized: true }),
  })
    .constrainedBy('countryId', 'countryId')
    .optionsQuery(({ query }) => query.where('active', true))
}

describe('P6-B choice field builders', () => {
  it('preserves scalar and multiple option inference without serializing server sources', () => {
    const select = choiceFields(locationSchema).select('cityId')
      .relationship('city', 'name', relationshipSource())
      .dependsOn('countryId')
      .searchable()
      .preload()
      .createOption()
      .editOption()
      .preserveWhenDependencyChanges()
      .compile()
    const multiple = choiceFields(locationSchema).multiselect('cityIds').options([{ value: 1, label: 'Cairo' }]).compile()

    expectTypeOf(select.defaultValue).toEqualTypeOf<number | undefined>()
    expectTypeOf(multiple.defaultValue).toEqualTypeOf<number[] | undefined>()
    expect(select.properties).toEqual({
      optionSource: 'relationship',
      searchable: true,
      preload: true,
      paginated: true,
      multiple: false,
      canCreateOption: true,
      canEditOption: true,
      preserveOnDependencyChange: true,
      relationship: 'city',
      relationshipTitleColumn: 'name',
    })
    expect(select.dependencies).toEqual(['countryId'])
    expect(JSON.stringify(select.properties)).not.toContain('optionsQuery')
    expect(select.server.options.kind).toBe('relationship')
  })

  it('supports static, resolver, relationship, and custom sources', async () => {
    const staticService = new OptionService(new StaticOptionSource<number, CityContext>([
      { value: 1, label: 'Cairo' },
      { value: 2, label: 'Giza' },
    ]))
    const resolverService = new OptionService(new ResolverOptionSource<number, CityContext>(
      async optionRequest => ({ options: [{ value: 1, label: optionRequest.search || 'Cairo' }], page: optionRequest.page, perPage: optionRequest.perPage, hasMore: false }),
      async (_optionRequest, values) => values.map(value => ({ value, label: `City ${value}` })),
    ))
    const customService = new OptionService(new CustomOptionSource<number, CityContext>({
      list: async optionRequest => ({ options: [], page: optionRequest.page, perPage: optionRequest.perPage, hasMore: false }),
      hydrateSelected: async (_optionRequest, values) => values.map(value => ({ value, label: `Custom ${value}` })),
    }))

    await expect(staticService.list(request({ search: 'gi' }), context(10))).resolves.toMatchObject({ options: [{ value: 2, label: 'Giza' }] })
    await expect(resolverService.list(request({ search: 'Found' }), context(10))).resolves.toMatchObject({ options: [{ value: 1, label: 'Found' }] })
    await expect(customService.hydrateSelected(request(), [2], context(10))).resolves.toEqual([{ value: 2, label: 'Custom 2' }])
  })
})

describe('P6-B constrained option execution', () => {
  it('applies authorization and tenant scopes before constraints, modifiers, search, and pagination', async () => {
    const source = relationshipSource()
    const service = new OptionService(source)

    await expect(service.list(request({ search: 'ca', perPage: 1 }), context(10))).resolves.toEqual({
      options: [{ value: 1, label: 'Cairo' }],
      page: 1,
      perPage: 1,
      hasMore: false,
      total: 1,
    })
    const query = source.optionsQuery(({ query }) => {
      expect(query.operations.slice(0, 4)).toEqual([
        ['where', 'authorized', true],
        ['where', 'tenantId', 1],
        ['where', 'countryId', 10],
        ['where', 'active', true],
      ])
      return query
    })
    await new OptionService(query).list(request(), context(10))
  })

  it('hydrates labels and reuses the constrained source for submission validation', async () => {
    const service = new OptionService(relationshipSource())

    await expect(service.hydrateSelected(request(), [1, 4], context(10))).resolves.toEqual([{ value: 1, label: 'Cairo' }])
    await expect(service.validateSubmission(request(), [1], context(10))).resolves.toEqual([{ value: 1, label: 'Cairo' }])
    await expect(service.validateSubmission(request(), [4], context(10))).rejects.toThrow(/unavailable or unauthorized/u)
    await expect(service.validateSubmission(request(), [3], context(10))).rejects.toThrow(/unavailable or unauthorized/u)
    await expect(service.validateSubmission(request(), [999], context(10))).rejects.toThrow(/unavailable or unauthorized/u)
    await expect(service.validateSubmission(request(), [6], context(10))).rejects.toThrow(/unavailable or unauthorized/u)
  })

  it('rejects option cache identities from a previously active tenant', async () => {
    const service = new OptionService(relationshipSource())
    const trusted = { ...context(10), tenantCacheKey: 'admin:web:number:1' }

    await expect(service.list(request({ tenantKey: trusted.tenantCacheKey }), trusted)).resolves.toMatchObject({ total: 2 })
    await expect(service.list(request({ tenantKey: 'admin:web:number:2' }), trusted)).rejects.toThrow(/stale or invalid/u)
  })

  it('enforces request caps and rejects malicious option identifiers and source responses', async () => {
    const service = new OptionService(relationshipSource(), { maxPage: 5, maxPerPage: 10, maxSearchLength: 20, maxSelectedValues: 2 })
    const maliciousDependencies: Record<string, JsonValue> = {}
    Reflect.set(maliciousDependencies, 'countryId', () => 10)

    await expect(service.list(request({ page: 6, perPage: 10 }), context(10))).rejects.toThrow(/1 to 5/u)
    await expect(service.list(request({ perPage: 11 }), context(10))).rejects.toThrow(/1 to 10/u)
    await expect(service.list(request({ search: 'x'.repeat(21), perPage: 10 }), context(10))).rejects.toThrow(/20 character/u)
    await expect(service.list(request({ fieldId: 'city;drop table users', perPage: 10 }), context(10))).rejects.toThrow(/Invalid option field identifier/u)
    await expect(service.list(request({ dependencies: maliciousDependencies, perPage: 10 }), context(10))).rejects.toThrow(/JSON-safe/u)
    await expect(service.hydrateSelected(request({ perPage: 10 }), [1, 1], context(10))).rejects.toThrow(/Duplicate selected/u)
    await expect(service.hydrateSelected(request({ perPage: 10 }), [1, 2, 3], context(10))).rejects.toThrow(/2 value limit/u)

    const malicious = new OptionService(new ResolverOptionSource<number, CityContext>(
      async optionRequest => ({ options: [{ value: Number.NaN, label: 'Bad' }], page: optionRequest.page, perPage: optionRequest.perPage, hasMore: false }),
      async () => [{ value: 999, label: 'Injected' }],
    ))
    await expect(malicious.list(request(), context(10))).rejects.toThrow(/Invalid option value/u)
    await expect(malicious.hydrateSelected(request(), [1], context(10))).rejects.toThrow(/unrequested selected value/u)
  })

  it('supports authorized create and identity-preserving edit operations', async () => {
    const service = new OptionService(relationshipSource())

    await expect(service.create('Luxor', request(), context(10))).resolves.toEqual({ value: 7, label: 'Luxor' })
    await expect(service.edit(1, 'New Cairo', request(), context(10))).resolves.toEqual({ value: 1, label: 'New Cairo' })
  })
})
