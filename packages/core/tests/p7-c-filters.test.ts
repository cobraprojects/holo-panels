import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  AdvancedQueryFilter,
  CustomSchemaFilter,
  asFilterDefinition,
  advancedColumnsFor,
  advancedFilterValue,
  filterCollection,
  filtersFor,
  type AdvancedFilterCondition,
  type FilterExecutionContext,
} from '../src/tables/filters/index'
import {
  TableQueryExecutor,
  type HoloCursorPaginatedResult,
  type HoloPaginatedResult,
  type HoloSimplePaginatedResult,
  type HoloTableQuery,
  type TableQueryScalar,
  type TableSortDirection,
} from '../src/tables/query/index'

class PostRecord {
  declare readonly id: number
  declare readonly tenantId: number
  declare readonly title: string
  declare readonly status: 'archived' | 'draft' | 'published'
  declare readonly published: boolean
  declare readonly score: number
  declare readonly createdAt: Date
  declare readonly deletedAt: string | null
  declare readonly authorId: number
}

class QueryContext {
  declare readonly actorId: number
  declare readonly tenantId: number
}

const factory = filtersFor(PostRecord, QueryContext)

function context(): FilterExecutionContext<QueryContext> {
  return { context: { actorId: 7, tenantId: 42 } }
}

describe('P7-C built-in filter definitions', () => {
  it('compiles boolean, select, relationship, ternary, date-range, and trashed filters', async () => {
    const boolean = factory.boolean('published', 'published').label('Published').live().compile()
    const select = factory.select('status', 'status').options([
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
    ]).compile()
    const relationship = factory.relationshipSelect('author', 'authorId', 'author', 'name', 'author_id')
      .optionsUsing(({ context: queryContext }) => [{ value: queryContext.actorId, label: 'Current actor' }])
      .compile()
    const ternary = factory.ternary('visible', 'published').compile()
    const dateRange = factory.dateRange('created', 'createdAt', 'created_at').compile()
    const trashed = factory.trashed('trashed', 'deletedAt', 'deleted_at').compile()

    expect(boolean.manifest).toEqual(expect.objectContaining({ type: 'boolean', mode: 'live', defaultValue: null }))
    expect(select.manifest.properties.options).toEqual([
      { value: 'draft', label: 'Draft', disabled: false },
      { value: 'published', label: 'Published', disabled: false },
    ])
    expect(relationship.manifest.type).toBe('relationship-select')
    expect(relationship.manifest.properties).toEqual(expect.objectContaining({ relationship: 'author', titleColumn: 'name', dynamicOptions: true }))
    expect(await relationship.server.options?.(context())).toEqual([{ value: 7, label: 'Current actor' }])
    expect(await ternary.server.encode('true', context())).toEqual({ id: 'visible', operator: '=', value: true })
    expect(await dateRange.server.encode({ from: '2026-01-01', to: '2026-01-31' }, context())).toEqual({
      id: 'created',
      operator: 'between',
      value: ['2026-01-01', '2026-01-31'],
    })
    expect(await trashed.server.encode('without', context())).toEqual({ id: 'trashed', operator: 'null' })
    expect(await trashed.server.encode('with', context())).toBeNull()
    expect(JSON.stringify(relationship.manifest)).not.toContain('Current actor')
  })

  it('supports custom schema filters while excluding callbacks from manifests', async () => {
    const custom = new CustomSchemaFilter<{ minimum: number | null }, QueryContext>('score', {
      defaultValue: { minimum: null },
      schema: { fields: [{ type: 'number', name: 'minimum' }] },
      targets: { score_min: { column: 'score', operators: ['>='] } },
      encode: value => {
        const minimum = value.minimum
        return typeof minimum === 'number'
          ? { id: 'score_min', operator: '>=', value: minimum }
          : null
      },
    }).compile()

    expect(custom.manifest.properties).toEqual({ schema: { fields: [{ type: 'number', name: 'minimum' }] } })
    expect(JSON.stringify(custom.manifest)).not.toContain('encode')
    expect(await custom.server.encode({ minimum: 80 }, context())).toEqual({ id: 'score_min', operator: '>=', value: 80 })
  })
})

describe('P7-C constrained advanced query builder', () => {
  const advancedFactory = advancedColumnsFor(PostRecord)
  const columns = {
    title: advancedFactory.column('title', 'title', 'title', 'string', ['=', 'like'] as const),
    score: advancedFactory.column('score', 'score', 'score', 'number', ['=', '>', 'between'] as const),
    published: advancedFactory.column('published', 'published', 'published', 'boolean', ['='] as const),
    created: advancedFactory.column('created', 'createdAt', 'created_at', 'date', ['>=', '<='] as const),
  }

  it('preserves column-specific operator inference', () => {
    type Condition = AdvancedFilterCondition<typeof columns>
    expectTypeOf<Extract<Condition, { column: 'title' }>['operator']>().toEqualTypeOf<'=' | 'like'>()
    expectTypeOf<Extract<Condition, { column: 'score' }>['operator']>().toEqualTypeOf<'=' | '>' | 'between'>()

    const value = advancedFilterValue<typeof columns>([
      { column: 'title', operator: 'like', value: 'launch' },
      { column: 'score', operator: '>', value: 75 },
    ])
    expect(value.conditions).toHaveLength(2)
  })

  it('emits only fixed allow-listed P7-A filter IDs, columns, and operators', async () => {
    const advanced = new AdvancedQueryFilter<PostRecord, typeof columns>('advanced', columns).compile()
    const value = advancedFilterValue<typeof columns>([
      { column: 'title', operator: 'like', value: 'launch' },
      { column: 'score', operator: 'between', value: [50, 100] },
    ])

    expect(await advanced.server.encode(value, context())).toEqual([
      { id: 'advanced_title', operator: 'like', value: 'launch' },
      { id: 'advanced_score', operator: 'between', value: [50, 100] },
    ])
    expect(advanced.queryDefinitions).toEqual(expect.objectContaining({
      advanced_title: { column: 'title', operators: ['=', 'like'] },
      advanced_score: { column: 'score', operators: ['=', '>', 'between'] },
    }))
  })

  it('rejects injected paths, operators, malformed values, and repeated columns', async () => {
    const advanced = new AdvancedQueryFilter<PostRecord, typeof columns>('advanced', columns).compile()

    await expect(Promise.resolve().then(() => advanced.server.encode({ conditions: [{ column: 'title;drop table', operator: '=', value: 'x' }] }, context()))).rejects.toThrow('Unknown advanced filter column')
    await expect(Promise.resolve().then(() => advanced.server.encode({ conditions: [{ column: 'title', operator: '>', value: 'x' }] }, context()))).rejects.toThrow('does not allow operator')
    await expect(Promise.resolve().then(() => advanced.server.encode({ conditions: [{ column: 'score', operator: '>', value: 'NaN' }] }, context()))).rejects.toThrow('finite number')
    await expect(Promise.resolve().then(() => advanced.server.encode({ conditions: [
      { column: 'score', operator: '=', value: 1 },
      { column: 'score', operator: '>', value: 2 },
    ] }, context()))).rejects.toThrow('Duplicate advanced filter column')
    expect(() => advancedFactory.column('unsafe', 'title', 'title;drop', 'string', ['='])).toThrow('Invalid advanced filter column')
  })
})

describe('P7-C filter state and P7-A compatibility', () => {
  it('composes a responsive schema tree with placement and ordered public content slots', () => {
    const published = factory.boolean('published', 'published')
      .label('Published')
      .columnSpan({ default: 1, lg: 2 })
      .columnStart({ lg: 3 })
      .compile()
    const status = factory.select('status', 'status').label('Status').compile()
    const presentation = filterCollection(
      asFilterDefinition(published),
      asFilterDefinition(status),
    )
      .columns({ default: 1, md: 2, xl: 4 })
      .modal()
      .before({ component: 'filters-help', order: 2, properties: { message: 'Help' } })
      .before({ component: 'filters-summary', order: -1 })
      .after('filters-footer')
      .presentation('post-filters')

    expect(presentation).toMatchObject({
      columns: { default: 1, md: 2, xl: 4 },
      id: 'post-filters',
      placement: 'modal',
      schema: { id: 'post-filters', kind: 'schema' },
    })
    expect(presentation.schema.components.map(component => component.kind)).toEqual(['filter', 'filter'])
    expect(presentation.schema.components[0]).toMatchObject({
      layout: { columnSpan: { default: 1, lg: 2 }, columnStart: { lg: 3 } },
      properties: { leaf: { kind: 'filter' } },
      statePath: 'published',
    })
    expect(presentation.slots.before?.map(reference => reference.component)).toEqual(['filters-summary', 'filters-help'])
    expect(presentation.slots.after?.[0]?.component).toBe('filters-footer')
    expect(JSON.stringify(presentation)).not.toContain('=>')
  })

  it('tracks live and deferred values, indicators, reset, and remove-all behavior', async () => {
    const published = factory.boolean('published', 'published')
      .label('Published')
      .live()
      .indicator(value => value ? 'Published only' : 'Unpublished only')
      .compile()
    const status = factory.select('status', 'status').label('Status').deferred().compile()
    const collection = filterCollection(
      asFilterDefinition(published),
      asFilterDefinition(status),
    )
    const state = collection.state()

    state.update('published', true).update('status', 'draft')
    expect(state.snapshot()).toEqual({
      draft: { published: true, status: 'draft' },
      applied: { published: true, status: null },
    })
    await expect(state.indicators(context())).resolves.toEqual([
      { filterId: 'published', label: 'Published only', value: true },
    ])
    state.applyDeferred()
    await expect(state.indicators(context())).resolves.toEqual([
      { filterId: 'published', label: 'Published only', value: true },
      { filterId: 'status', label: 'Status', value: 'draft' },
    ])
    state.remove('published')
    expect(state.snapshot().applied.published).toBeNull()
    state.removeAll()
    expect(state.snapshot()).toEqual({
      draft: { published: null, status: null },
      applied: { published: null, status: null },
    })
  })

  it('rejects custom callback injection before reaching P7-A', async () => {
    const malicious = new CustomSchemaFilter('custom', {
      defaultValue: null,
      schema: {},
      targets: { safe: { column: 'status', operators: ['='] } },
      encode: () => ({ id: 'unsafe', operator: '=', value: 'published' }),
    }).compile()
    const collection = filterCollection(asFilterDefinition(malicious))

    await expect(collection.state({ custom: 'active' }).compile(context())).rejects.toThrow('unknown allow-listed filter')
  })

  it('feeds only validated filters into a query whose mandatory scopes remain first', async () => {
    const status = factory.select('status', 'status').compile()
    const collection = filterCollection(asFilterDefinition(status))
    const compatibility = await collection.state({ status: 'published' }).compile(context())
    const executor = new TableQueryExecutor<RecordingQuery, PostRecord, QueryContext>({
      primaryKey: 'id',
      columns: { id: { column: 'id' } },
      filters: compatibility.definitions,
      createQuery: () => new RecordingQuery(),
      applyResourceScope: query => query.where('published', '=', true),
      applyTenantScope: (query, queryContext) => query.where('tenantId', '=', queryContext.tenantId),
    })

    const query = executor.compile({ pagination: 'page', filters: compatibility.filters }, context().context)
    expect(query.operations.slice(0, 3)).toEqual([
      ['where', 'published', '=', true],
      ['where', 'tenantId', '=', 42],
      ['where', 'status', '=', 'published'],
    ])
  })
})

type Operation = readonly [string, ...unknown[]]

class RecordingQuery implements HoloTableQuery<RecordingQuery, PostRecord> {
  select(...columns: readonly string[]): RecordingQuery { return this.record('select', ...columns) }
  constructor(readonly operations: readonly Operation[] = []) {}

  where(column: string, operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like', value: TableQueryScalar): RecordingQuery {
    return this.record('where', column, operator, value)
  }

  whereAny(columns: readonly string[], operator: 'like', value: string): RecordingQuery {
    return this.record('whereAny', columns, operator, value)
  }

  whereIn(column: string, values: readonly TableQueryScalar[]): RecordingQuery {
    return this.record('whereIn', column, values)
  }

  whereNotIn(column: string, values: readonly TableQueryScalar[]): RecordingQuery {
    return this.record('whereNotIn', column, values)
  }

  whereBetween(column: string, range: readonly [TableQueryScalar, TableQueryScalar]): RecordingQuery {
    return this.record('whereBetween', column, range)
  }

  whereNull(column: string): RecordingQuery {
    return this.record('whereNull', column)
  }

  whereNotNull(column: string): RecordingQuery {
    return this.record('whereNotNull', column)
  }

  orderBy(column: string, direction: TableSortDirection): RecordingQuery {
    return this.record('orderBy', column, direction)
  }

  with(...relations: readonly string[]): RecordingQuery {
    return this.record('with', ...relations)
  }

  withCount(...relations: readonly string[]): RecordingQuery {
    return this.record('withCount', ...relations)
  }

  withExists(...relations: readonly string[]): RecordingQuery {
    return this.record('withExists', ...relations)
  }

  withSum(relation: string, column: string): RecordingQuery {
    return this.record('withSum', relation, column)
  }

  withAvg(relation: string, column: string): RecordingQuery {
    return this.record('withAvg', relation, column)
  }

  withMin(relation: string, column: string): RecordingQuery {
    return this.record('withMin', relation, column)
  }

  withMax(relation: string, column: string): RecordingQuery {
    return this.record('withMax', relation, column)
  }

  limit(value: number): RecordingQuery {
    return this.record('limit', value)
  }

  async get(): Promise<readonly PostRecord[]> {
    return []
  }

  async first(): Promise<PostRecord | undefined> {
    return undefined
  }

  async count(): Promise<number> {
    return 0
  }

  async paginate(_perPage: number, _page: number): Promise<HoloPaginatedResult<PostRecord>> {
    return { data: [], meta: { total: 0, perPage: 25, currentPage: 1, lastPage: 1, hasMorePages: false } }
  }

  async simplePaginate(_perPage: number, _page: number): Promise<HoloSimplePaginatedResult<PostRecord>> {
    return { data: [], meta: { perPage: 25, currentPage: 1, hasMorePages: false } }
  }

  async cursorPaginate(_perPage: number, _cursor: string | null): Promise<HoloCursorPaginatedResult<PostRecord>> {
    return { data: [], perPage: 25, nextCursor: null, prevCursor: null }
  }

  private record(name: string, ...arguments_: unknown[]): RecordingQuery {
    return new RecordingQuery([...this.operations, [name, ...arguments_]])
  }
}
