import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  GroupingState,
  asExecutableSummary,
  createHoloSummaryAdapter,
  executeFullQuerySummaries,
  executeGroupedFullQuery,
  executePageSummaries,
  groupingsFor,
  groupPageRecords,
  normalizeAggregateNumber,
  summariesFor,
  type AggregateDriver,
  type AggregatePrimitive,
  type GroupedAggregateRequest,
  type GroupedSummaryDriverAdapter,
  type HoloAggregateQuery,
} from '../src/tables/grouping/index'

class OrderRecord {
  declare readonly id: number
  declare readonly tenantId: number
  declare readonly status: 'draft' | 'published'
  declare readonly amount: number
  declare readonly sequence: number
  declare readonly createdAt: Date
}

class QueryContext {
  declare readonly tenantId: number
}

const orders: readonly OrderRecord[] = [
  { id: 1, tenantId: 9, status: 'draft', amount: 10, sequence: 3, createdAt: new Date('2026-01-03T00:00:00.000Z') },
  { id: 2, tenantId: 9, status: 'published', amount: 20, sequence: 1, createdAt: new Date('2026-01-01T00:00:00.000Z') },
  { id: 3, tenantId: 9, status: 'draft', amount: 30, sequence: 2, createdAt: new Date('2026-01-02T00:00:00.000Z') },
]

const groups = groupingsFor(OrderRecord, QueryContext)

describe('P7-D grouping definitions and state', () => {
  it('groups page records with typed titles, descriptions, collapse state, and ordering', async () => {
    const definition = groups.group('status', 'status')
      .label('Status')
      .title(({ value }) => value === 'draft' ? 'Draft orders' : 'Published orders')
      .description(({ records }) => `${records.length} orders`)
      .collapsible()
      .order('desc')
      .persistAs('orders-group')
      .compile()
    const state = new GroupingState(definition.manifest)
    state.collapse(JSON.stringify('draft'))
    const grouped = await groupPageRecords(orders, definition, { tenantId: 9 }, state)

    expectTypeOf(definition.manifest.path).toEqualTypeOf<'status'>()
    expect(grouped.map(group => group.value)).toEqual(['published', 'draft'])
    expect(grouped[0]).toEqual(expect.objectContaining({ title: 'Published orders', description: '1 orders', collapsed: false }))
    expect(grouped[1]).toEqual(expect.objectContaining({ title: 'Draft orders', description: '2 orders', collapsed: true }))
    expect(JSON.stringify(definition.manifest)).not.toContain('Draft orders')
  })

  it('round-trips canonical URL state and rejects malformed or oversized persistence input', () => {
    const manifest = groups.group('status', 'status').collapsible().persistAs('orders-group').compile().manifest
    const state = new GroupingState(manifest).order('desc').collapse('z').collapse('a')
    const encoded = state.toUrl()
    const restored = GroupingState.fromUrl(manifest, encoded)

    expect(encoded).toBe('orders-group=desc:a,z')
    expect(restored.snapshot()).toEqual({ order: 'desc', collapsed: ['a', 'z'] })
    expect(restored.toUrl()).toBe(encoded)
    expect(() => GroupingState.fromUrl(manifest, 'orders-group=sideways:a')).toThrow('Invalid grouping URL order')
    expect(() => GroupingState.fromUrl(manifest, `orders-group=asc:${'x'.repeat(4_100)}`)).toThrow('too long')
  })

  it('supports default-collapsed groups and rejects injected definition paths', () => {
    const definition = groups.group('status', 'status').collapsible().collapsed().compile()
    const state = new GroupingState(definition.manifest)

    expect(state.isCollapsed('draft')).toBe(true)
    state.expand('draft')
    expect(state.isCollapsed('draft')).toBe(false)
    state.collapse('draft')
    expect(state.isCollapsed('draft')).toBe(true)
    expect(() => groups.group('status', 'status', 'status;drop table')).toThrow('Invalid group column')
    expect(() => groups.group('../status', 'status')).toThrow('Invalid group ID')
  })
})

describe('P7-D page and full-query summaries', () => {
  const factory = summariesFor(OrderRecord, QueryContext)

  it('executes count, sum, average, min, max, range, and custom page summaries', async () => {
    const definitions = [
      asExecutableSummary(factory.count().compile()),
      asExecutableSummary(factory.sum('total', 'amount').compile()),
      asExecutableSummary(factory.average('average', 'amount').compile()),
      asExecutableSummary(factory.min('first', 'createdAt').compile()),
      asExecutableSummary(factory.max('last', 'sequence').compile()),
      asExecutableSummary(factory.range('spread', 'amount').compile()),
      asExecutableSummary(factory.custom('custom', ({ records }) => records?.filter(order => order.status === 'draft').length ?? 0).compile()),
    ]
    const results = await executePageSummaries(definitions, orders, { tenantId: 9 })

    expect(results).toEqual([
      { id: 'count', kind: 'count', mode: 'page', value: 3 },
      { id: 'total', kind: 'sum', mode: 'page', value: 60 },
      { id: 'average', kind: 'average', mode: 'page', value: 20 },
      { id: 'first', kind: 'min', mode: 'page', value: '2026-01-01T00:00:00.000Z' },
      { id: 'last', kind: 'max', mode: 'page', value: 3 },
      { id: 'spread', kind: 'range', mode: 'page', value: 20 },
      { id: 'custom', kind: 'custom', mode: 'page', value: 2 },
    ])
    expect(JSON.stringify(definitions.map(({ definition }) => definition.manifest))).not.toContain('records')
  })

  it('keeps page and full-query modes distinct while using a scoped aggregate query', async () => {
    const page = asExecutableSummary(factory.count('page-count').page().compile())
    const total = asExecutableSummary(factory.sum('full-total', 'amount').fullQuery().compile())
    const average = asExecutableSummary(factory.average('full-average', 'amount').fullQuery().compile())
    const range = asExecutableSummary(factory.range('full-range', 'amount').fullQuery().compile())
    const query = new DriverQuery('postgres', { scoped: true })
    const adapter = createHoloSummaryAdapter<DriverQuery>('postgres')

    await expect(executePageSummaries([page, total], orders, { tenantId: 9 })).resolves.toEqual([
      { id: 'page-count', kind: 'count', mode: 'page', value: 3 },
    ])
    await expect(executeFullQuerySummaries([page, total, average, range], query, adapter, { tenantId: 9 })).resolves.toEqual([
      { id: 'full-total', kind: 'sum', mode: 'full-query', value: 60 },
      { id: 'full-average', kind: 'average', mode: 'full-query', value: 20 },
      { id: 'full-range', kind: 'range', mode: 'full-query', value: 20 },
    ])
    expect(query.scope).toEqual({ scoped: true })
    expect(query.calls).toEqual(['sum:amount', 'avg:amount', 'min:amount', 'max:amount'])
  })

  it('normalizes representative SQLite, MySQL, and PostgreSQL aggregate values', () => {
    expect(normalizeAggregateNumber(12.5, 'sqlite')).toBe(12.5)
    expect(normalizeAggregateNumber('12.50', 'mysql')).toBe(12.5)
    expect(normalizeAggregateNumber(12n, 'postgres')).toBe(12)
    expect(normalizeAggregateNumber(null, 'postgres')).toBeNull()
    expect(() => normalizeAggregateNumber('not-a-number', 'mysql')).toThrow('non-finite')
    expect(() => normalizeAggregateNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 'postgres')).toThrow('safe integer')
  })

  it('executes grouped aggregates through one driver adapter request with fixed columns', async () => {
    const group = groups.group('status', 'status', 'status').order('asc').compile()
    const summaries = [
      asExecutableSummary(factory.count().fullQuery().compile()),
      asExecutableSummary(factory.sum('total', 'amount', 'amount').fullQuery().compile()),
    ]
    const adapter = new RecordingGroupedAdapter()
    const query = new DriverQuery('sqlite', { scoped: true })
    const result = await executeGroupedFullQuery(query, group, summaries, adapter, 'desc')

    expect(adapter.requests).toEqual([{
      groupColumn: 'status',
      order: 'desc',
      summaries: [
        { id: 'count', kind: 'count', column: null },
        { id: 'total', kind: 'sum', column: 'amount' },
      ],
    }])
    expect(result).toEqual([{ key: 'draft', values: { count: 2, total: 40 } }])
  })
})

class DriverQuery implements HoloAggregateQuery {
  readonly calls: string[] = []

  constructor(
    readonly driver: AggregateDriver,
    readonly scope: { readonly scoped: boolean },
  ) {}

  async count(): Promise<number> {
    this.calls.push('count')
    return 3
  }

  async sum(column: string): Promise<AggregatePrimitive> {
    this.calls.push(`sum:${column}`)
    return this.driver === 'sqlite' ? 60 : '60.00'
  }

  async avg(column: string): Promise<AggregatePrimitive> {
    this.calls.push(`avg:${column}`)
    return this.driver === 'sqlite' ? 20 : '20.00'
  }

  async min(column: string): Promise<AggregatePrimitive> {
    this.calls.push(`min:${column}`)
    return this.driver === 'postgres' ? '10.00' : 10
  }

  async max(column: string): Promise<AggregatePrimitive> {
    this.calls.push(`max:${column}`)
    return this.driver === 'postgres' ? '30.00' : 30
  }
}

class RecordingGroupedAdapter implements GroupedSummaryDriverAdapter<DriverQuery> {
  readonly requests: GroupedAggregateRequest[] = []

  async execute(query: DriverQuery, request: GroupedAggregateRequest) {
    expect(query.scope.scoped).toBe(true)
    this.requests.push(request)
    return [{ key: 'draft', values: { count: 2, total: 40 } }]
  }
}
