import { describe, expect, it } from 'vitest'
import type { ModelQueryBuilder, TableDefinition } from '@holo-js/db'
import {
  TableQueryExecutor,
  type HoloCursorPaginatedResult,
  type HoloPaginatedResult,
  type HoloSimplePaginatedResult,
  type HoloTableQuery,
  type TableQueryDefinition,
  type TableQueryScalar,
  type TableQueryState,
  type TableSortDirection,
} from '../src/tables/query/index'

interface PostRecord {
  readonly id: number
  readonly tenantId: number
  readonly title: string
  readonly email: string
  readonly status: string
  readonly published: boolean
}

interface QueryContext {
  readonly tenantId: number
}

type PublicHoloQuery = ModelQueryBuilder<TableDefinition>
type PublicHoloRecord = Awaited<ReturnType<PublicHoloQuery['get']>>[number]
type AssertPublicHoloCompatibility<TValue extends HoloTableQuery<PublicHoloQuery, PublicHoloRecord>> = TValue
type PublicHoloQueryCompatibility = AssertPublicHoloCompatibility<PublicHoloQuery>

type QueryOperation = readonly [name: string, ...arguments_: readonly unknown[]]
type Predicate = (record: PostRecord) => boolean

const posts: readonly PostRecord[] = [
  { id: 1, tenantId: 10, title: 'Alpha', email: 'alpha@example.test', status: 'active', published: true },
  { id: 2, tenantId: 10, title: 'Beta', email: 'beta@example.test', status: 'active', published: true },
  { id: 3, tenantId: 10, title: 'Hidden', email: 'hidden@example.test', status: 'active', published: false },
  { id: 4, tenantId: 20, title: 'Other tenant', email: 'other@example.test', status: 'active', published: true },
  { id: 5, tenantId: 10, title: 'Zeta', email: 'zeta@example.test', status: 'archived', published: true },
]

function valueAt(record: PostRecord, column: string): unknown {
  return Reflect.get(record, column)
}

function compare(left: unknown, right: TableQueryScalar): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

class FakeQuery implements HoloTableQuery<FakeQuery, PostRecord> {
  select(...columns: readonly string[]): FakeQuery { return this.next(['select', ...columns], () => true) }
  readonly operations: readonly QueryOperation[]
  readonly #predicates: readonly Predicate[]
  readonly #orders: readonly { readonly column: string, readonly direction: TableSortDirection }[]
  readonly #limit?: number

  constructor(
    operations: readonly QueryOperation[] = [],
    predicates: readonly Predicate[] = [],
    orders: readonly { readonly column: string, readonly direction: TableSortDirection }[] = [],
    limit?: number,
  ) {
    this.operations = operations
    this.#predicates = predicates
    this.#orders = orders
    this.#limit = limit
  }

  where(column: string, operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like', value: TableQueryScalar): FakeQuery {
    return this.next(['where', column, operator, value], record => {
      const candidate = valueAt(record, column)
      if (operator === '=') return candidate === value
      if (operator === '!=') return candidate !== value
      if (operator === '>') return compare(candidate, value) > 0
      if (operator === '>=') return compare(candidate, value) >= 0
      if (operator === '<') return compare(candidate, value) < 0
      if (operator === '<=') return compare(candidate, value) <= 0
      const needle = String(value).slice(1, -1).replaceAll('\\%', '%').replaceAll('\\_', '_').replaceAll('\\\\', '\\').toLowerCase()
      return String(candidate).toLowerCase().includes(needle)
    })
  }

  whereAny(columns: readonly string[], operator: 'like', value: string): FakeQuery {
    const needle = value.slice(1, -1).replaceAll('\\%', '%').replaceAll('\\_', '_').replaceAll('\\\\', '\\').toLowerCase()
    return this.next(['whereAny', columns, operator, value], record => columns.some(column => String(valueAt(record, column)).toLowerCase().includes(needle)))
  }

  whereIn(column: string, values: readonly TableQueryScalar[]): FakeQuery {
    return this.next(['whereIn', column, values], record => values.includes(valueAt(record, column) as TableQueryScalar))
  }

  whereNotIn(column: string, values: readonly TableQueryScalar[]): FakeQuery {
    return this.next(['whereNotIn', column, values], record => !values.includes(valueAt(record, column) as TableQueryScalar))
  }

  whereBetween(column: string, range: readonly [TableQueryScalar, TableQueryScalar]): FakeQuery {
    return this.next(['whereBetween', column, range], record => compare(valueAt(record, column), range[0]) >= 0 && compare(valueAt(record, column), range[1]) <= 0)
  }

  whereNull(column: string): FakeQuery {
    return this.next(['whereNull', column], record => valueAt(record, column) === null)
  }

  whereNotNull(column: string): FakeQuery {
    return this.next(['whereNotNull', column], record => valueAt(record, column) !== null)
  }

  orderBy(column: string, direction: TableSortDirection): FakeQuery {
    return new FakeQuery(
      [...this.operations, ['orderBy', column, direction]],
      this.#predicates,
      [...this.#orders, { column, direction }],
      this.#limit,
    )
  }

  with(...relations: readonly string[]): FakeQuery {
    return this.record(['with', ...relations])
  }

  withCount(...relations: readonly string[]): FakeQuery {
    return this.record(['withCount', ...relations])
  }

  withExists(...relations: readonly string[]): FakeQuery {
    return this.record(['withExists', ...relations])
  }

  withSum(relation: string, column: string): FakeQuery {
    return this.record(['withSum', relation, column])
  }

  withAvg(relation: string, column: string): FakeQuery {
    return this.record(['withAvg', relation, column])
  }

  withMin(relation: string, column: string): FakeQuery {
    return this.record(['withMin', relation, column])
  }

  withMax(relation: string, column: string): FakeQuery {
    return this.record(['withMax', relation, column])
  }

  limit(value: number): FakeQuery {
    return new FakeQuery([...this.operations, ['limit', value]], this.#predicates, this.#orders, value)
  }

  async get(): Promise<readonly PostRecord[]> {
    return this.records()
  }

  async first(): Promise<PostRecord | undefined> {
    return this.records()[0]
  }

  async count(): Promise<number> {
    return this.records(false).length
  }

  async paginate(perPage: number, page: number): Promise<HoloPaginatedResult<PostRecord>> {
    const records = this.records(false)
    const offset = (page - 1) * perPage
    return {
      data: records.slice(offset, offset + perPage),
      meta: {
        total: records.length,
        perPage,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(records.length / perPage)),
        hasMorePages: offset + perPage < records.length,
      },
    }
  }

  async simplePaginate(perPage: number, page: number): Promise<HoloSimplePaginatedResult<PostRecord>> {
    const records = this.records(false)
    const offset = (page - 1) * perPage
    return {
      data: records.slice(offset, offset + perPage),
      meta: { perPage, currentPage: page, hasMorePages: offset + perPage < records.length },
    }
  }

  async cursorPaginate(perPage: number, cursor: string | null): Promise<HoloCursorPaginatedResult<PostRecord>> {
    const offset = cursor ? Number(cursor) : 0
    const records = this.records(false)
    const data = records.slice(offset, offset + perPage)
    return {
      data,
      perPage,
      nextCursor: offset + data.length < records.length ? String(offset + data.length) : null,
      prevCursor: offset > 0 ? String(Math.max(0, offset - perPage)) : null,
    }
  }

  private next(operation: QueryOperation, predicate: Predicate): FakeQuery {
    return new FakeQuery([...this.operations, operation], [...this.#predicates, predicate], this.#orders, this.#limit)
  }

  private record(operation: QueryOperation): FakeQuery {
    return new FakeQuery([...this.operations, operation], this.#predicates, this.#orders, this.#limit)
  }

  private records(applyLimit = true): readonly PostRecord[] {
    const filtered = posts.filter(record => this.#predicates.every(predicate => predicate(record)))
    const ordered = [...filtered].sort((left, right) => {
      for (const order of this.#orders) {
        const result = compare(valueAt(left, order.column), valueAt(right, order.column) as TableQueryScalar)
        if (result !== 0) return order.direction === 'asc' ? result : -result
      }
      return 0
    })
    return applyLimit && typeof this.#limit === 'number' ? ordered.slice(0, this.#limit) : ordered
  }
}

function definition(overrides: Partial<TableQueryDefinition<FakeQuery, QueryContext>> = {}): TableQueryDefinition<FakeQuery, QueryContext> {
  return {
    primaryKey: 'id',
    columns: {
      id: { column: 'id', sortable: true },
      title: { column: 'title', searchable: true, sortable: true },
      email: { column: 'email', searchable: true },
      author: { column: 'author_id', relation: 'author' },
      comment_count: { column: 'id', aggregate: { kind: 'count', relation: 'comments' } },
      line_total: { column: 'id', aggregate: { kind: 'sum', relation: 'lineItems', column: 'amount' } },
    },
    filters: {
      status: { column: 'status', operators: ['=', '!=', 'in'] },
    },
    eagerLoads: ['category'],
    defaultSort: [{ column: 'title', direction: 'asc' }],
    createQuery: () => new FakeQuery(),
    applyResourceScope: query => query.where('published', '=', true),
    applyTenantScope: (query, context) => query.where('tenantId', '=', context.tenantId),
    ...overrides,
  }
}

function state(overrides: Partial<TableQueryState> = {}): TableQueryState {
  return {
    pagination: 'page',
    page: 1,
    perPage: 25,
    ...overrides,
  }
}

describe('P7-A table query execution', () => {
  it('applies mandatory scopes before allow-listed search, filters, ordering, and load plans', () => {
    const executor = new TableQueryExecutor(definition())
    const query = executor.compile(state({
      search: 'alpha',
      filters: [{ id: 'status', operator: '=', value: 'active' }],
      sort: [{ column: 'title', direction: 'desc' }],
      visibleColumns: ['title', 'author', 'comment_count', 'line_total'],
    }), { tenantId: 10 })

    expect(query.operations).toEqual([
      ['where', 'published', '=', true],
      ['where', 'tenantId', '=', 10],
      ['whereAny', ['title', 'email'], 'like', '%alpha%'],
      ['where', 'status', '=', 'active'],
      ['orderBy', 'title', 'desc'],
      ['orderBy', 'id', 'asc'],
      ['with', 'category', 'author'],
      ['withCount', 'comments'],
      ['withSum', 'lineItems', 'amount'],
    ])
  })

  it('executes page, simple, cursor, all-record, and total-count modes', async () => {
    const executor = new TableQueryExecutor(definition({ allowAll: true, maxAllRecords: 10 }))
    const context = { tenantId: 10 }

    await expect(executor.execute(state({ perPage: 1 }), context)).resolves.toMatchObject({
      mode: 'page', records: [{ id: 1 }], total: 3, page: 1, perPage: 1, hasMore: true,
    })
    await expect(executor.execute(state({ pagination: 'simple', perPage: 1, includeTotal: true }), context)).resolves.toMatchObject({
      mode: 'simple', total: 3, perPage: 1, hasMore: true,
    })
    await expect(executor.execute(state({ pagination: 'cursor', perPage: 1 }), context)).resolves.toMatchObject({
      mode: 'cursor', perPage: 1, nextCursor: '1', previousCursor: null,
    })
    await expect(executor.execute(state({ pagination: 'all', perPage: 'all' }), context)).resolves.toMatchObject({
      mode: 'all', total: 3,
    })
  })

  it('never accepts client columns, operators, paths, or search text as query structure', () => {
    const executor = new TableQueryExecutor(definition())
    const injectedSearch = executor.compile(state({ search: "%' OR 1=1 --" }), { tenantId: 10 })

    expect(injectedSearch.operations[2]).toEqual(['whereAny', ['title', 'email'], 'like', "%\\%' OR 1=1 --%"])
    expect(() => executor.compile(state({ sort: [{ column: 'title; drop table users', direction: 'asc' }] }), { tenantId: 10 })).toThrow(/Unknown or unsortable/u)
    expect(() => executor.compile(state({ visibleColumns: ['author.password'] }), { tenantId: 10 })).toThrow(/Unknown visible/u)
    expect(() => executor.compile(state({ filters: [{ id: 'status', operator: 'like', value: '%' }] }), { tenantId: 10 })).toThrow(/does not allow operator/u)
    expect(() => new TableQueryExecutor(definition({ eagerLoads: ['author;drop'] }))).toThrow(/Invalid eager-load relation/u)
  })

  it('resolves actions and selections through the same resource and tenant scopes', async () => {
    const executor = new TableQueryExecutor(definition({ maxSelectionRecords: 2 }))
    const context = { tenantId: 10 }

    await expect(executor.resolveRowAction(state(), 1, context)).resolves.toMatchObject({ id: 1 })
    await expect(executor.resolveRowAction(state(), 3, context)).resolves.toBeUndefined()
    await expect(executor.resolveRowAction(state(), 4, context)).resolves.toBeUndefined()
    await expect(executor.resolveRowAction(state(), 999, context)).resolves.toBeUndefined()
    await expect(executor.executeSelection(state(), { mode: 'explicit', recordIds: [1, 4] }, context)).resolves.toEqual([posts[0]])
    await expect(executor.executeSelection(state(), { mode: 'all-matching', excludedRecordIds: [2] }, context)).resolves.toEqual([posts[0], posts[4]])
  })

  it('rejects unbounded pages, selections, search, and all-record queries', async () => {
    const executor = new TableQueryExecutor(definition({
      maxPerPage: 50,
      maxPage: 500,
      maxSearchLength: 20,
      allowAll: true,
      maxAllRecords: 2,
      maxSelectionRecords: 1,
    }))
    const context = { tenantId: 10 }

    await expect(executor.execute(state({ perPage: 51 }), context)).rejects.toThrow(/1 to 50/u)
    await expect(executor.execute(state({ page: 501 }), context)).rejects.toThrow(/1 to 500/u)
    await expect(executor.execute(state({ search: 'x'.repeat(21) }), context)).rejects.toThrow(/20 character/u)
    await expect(executor.execute(state({ pagination: 'cursor', cursor: 'x'.repeat(2_049) }), context)).rejects.toThrow(/cursor exceeds/u)
    await expect(executor.execute(state({ pagination: 'offset' as TableQueryState['pagination'] }), context)).rejects.toThrow(/Invalid table pagination mode/u)
    await expect(executor.execute(state({ pagination: 'all', perPage: 'all' }), context)).rejects.toThrow(/exceeds the 2 record/u)
    await expect(executor.executeSelection(state(), { mode: 'explicit', recordIds: [1, 2] }, context)).rejects.toThrow(/exceeds the 1 record/u)
    await expect(executor.resolveRowAction(state(), Number.NaN, context)).rejects.toThrow(/Invalid table record identifier/u)
    await expect(new TableQueryExecutor(definition()).execute(state({ pagination: 'all', perPage: 'all' }), context)).rejects.toThrow(/disabled/u)
  })
})
