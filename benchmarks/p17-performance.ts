import {
  PanelRuntime,
  TableQueryExecutor,
  defineDashboard,
  definePanel,
  defineStatsWidget,
  resolveWidget,
  selectDefaultDashboard,
  type HoloCursorPaginatedResult,
  type HoloPaginatedResult,
  type HoloSimplePaginatedResult,
  type HoloTableQuery,
  type OptionPage,
  type OptionQueryRequest,
  type PanelDatabaseNotificationItem,
  type PanelDatabaseNotificationPage,
  type TableQueryScalar,
  type TableSortDirection,
} from '../packages/core/src/index.ts'
import {
  GlobalSearchEngine,
  globalSearchFor,
} from '../packages/core/src/search/index.ts'
import {
  ClientNotificationInboxStore,
  OptionStore,
} from '../packages/client/src/index.ts'

class BenchmarkRecord {
  declare readonly category: string
  declare readonly id: number
  declare readonly title: string
}

class BenchmarkActor {
  declare readonly id: number
  declare readonly name: string
}

interface BenchmarkMeasurement {
  readonly checksum: number
  readonly iterations: number
  readonly maximumMilliseconds: number
  readonly meanMilliseconds: number
  readonly medianMilliseconds: number
  readonly minimumMilliseconds: number
  readonly name: string
  readonly operationsPerSecond: number
  readonly p95Milliseconds: number
}

interface BenchmarkReport {
  readonly dataset: {
    readonly notifications: number
    readonly records: number
    readonly widgets: number
  }
  readonly measurements: readonly BenchmarkMeasurement[]
  readonly runtime: {
    readonly adapter: 'deterministic-in-memory'
    readonly bun: string
    readonly platform: string
  }
  readonly version: 1
  readonly warmupIterations: number
}

type Predicate = (record: BenchmarkRecord) => boolean

const recordCount = 100_000
const notificationCount = 1_000
const widgetCount = 24
const warmupIterations = integerSetting('P17_BENCH_WARMUP', 3, 1, 20)
const iterations = integerSetting('P17_BENCH_ITERATIONS', 12, 3, 100)

function integerSetting(name: string, fallback: number, minimum: number, maximum: number): number {
  const source = process.env[name]
  if (source === undefined) return fallback
  const value = Number(source)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

function percentile(sorted: readonly number[], proportion: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * proportion) - 1))
  return sorted[index] ?? 0
}

function rounded(value: number): number {
  return Number(value.toFixed(3))
}

async function measure(
  name: string,
  execute: (iteration: number) => Promise<number>,
): Promise<BenchmarkMeasurement> {
  for (let iteration = 0; iteration < warmupIterations; iteration += 1) await execute(iteration)
  const samples: number[] = []
  let checksum = 0
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now()
    checksum = (checksum + await execute(iteration + warmupIterations)) % 2_147_483_647
    samples.push(performance.now() - started)
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const total = samples.reduce((sum, sample) => sum + sample, 0)
  const mean = total / samples.length
  return Object.freeze({
    checksum,
    iterations,
    maximumMilliseconds: rounded(sorted.at(-1) ?? 0),
    meanMilliseconds: rounded(mean),
    medianMilliseconds: rounded(percentile(sorted, 0.5)),
    minimumMilliseconds: rounded(sorted[0] ?? 0),
    name,
    operationsPerSecond: rounded(1_000 / mean),
    p95Milliseconds: rounded(percentile(sorted, 0.95)),
  })
}

function scalar(record: BenchmarkRecord, column: string): TableQueryScalar {
  if (column === 'id') return record.id
  if (column === 'title') return record.title
  if (column === 'category') return record.category
  throw new Error(`Unknown benchmark column ${column}`)
}

function compare(left: TableQueryScalar, right: TableQueryScalar): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function likeNeedle(pattern: string): string {
  return pattern
    .replace(/^%|%$/gu, '')
    .replaceAll('\\%', '%')
    .replaceAll('\\_', '_')
    .replaceAll('\\\\', '\\')
    .toLocaleLowerCase('en')
}

class MemoryQuery implements HoloTableQuery<MemoryQuery, BenchmarkRecord> {
  readonly #records: readonly BenchmarkRecord[]
  readonly #predicates: readonly Predicate[]
  readonly #sorts: readonly { readonly column: string, readonly direction: TableSortDirection }[]
  readonly #maximum: number | null

  constructor(
    records: readonly BenchmarkRecord[],
    predicates: readonly Predicate[] = [],
    sorts: readonly { readonly column: string, readonly direction: TableSortDirection }[] = [],
    maximum: number | null = null,
  ) {
    this.#records = records
    this.#predicates = predicates
    this.#sorts = sorts
    this.#maximum = maximum
  }

  where(column: string, operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like', value: TableQueryScalar): MemoryQuery {
    if (operator === 'like') {
      const needle = likeNeedle(String(value))
      return this.predicate(record => String(scalar(record, column)).toLocaleLowerCase('en').includes(needle))
    }
    return this.predicate(record => {
      const result = compare(scalar(record, column), value)
      if (operator === '=') return result === 0
      if (operator === '!=') return result !== 0
      if (operator === '>') return result > 0
      if (operator === '>=') return result >= 0
      if (operator === '<') return result < 0
      return result <= 0
    })
  }

  whereAny(columns: readonly string[], _operator: 'like', value: string): MemoryQuery {
    const needle = likeNeedle(value)
    return this.predicate(record => columns.some(column => String(scalar(record, column)).toLocaleLowerCase('en').includes(needle)))
  }

  whereIn(column: string, values: readonly TableQueryScalar[]): MemoryQuery {
    const selected = new Set(values)
    return this.predicate(record => selected.has(scalar(record, column)))
  }

  whereNotIn(column: string, values: readonly TableQueryScalar[]): MemoryQuery {
    const selected = new Set(values)
    return this.predicate(record => !selected.has(scalar(record, column)))
  }

  whereBetween(column: string, range: readonly [TableQueryScalar, TableQueryScalar]): MemoryQuery {
    return this.predicate(record => compare(scalar(record, column), range[0]) >= 0 && compare(scalar(record, column), range[1]) <= 0)
  }

  whereNull(column: string): MemoryQuery {
    return this.predicate(record => scalar(record, column) === null)
  }

  whereNotNull(column: string): MemoryQuery {
    return this.predicate(record => scalar(record, column) !== null)
  }

  orderBy(column: string, direction: TableSortDirection): MemoryQuery {
    return new MemoryQuery(this.#records, this.#predicates, [...this.#sorts, { column, direction }], this.#maximum)
  }

  with(..._relations: readonly string[]): MemoryQuery {
    return this
  }

  withCount(..._relations: readonly string[]): MemoryQuery {
    return this
  }

  withExists(..._relations: readonly string[]): MemoryQuery {
    return this
  }

  withSum(_relation: string, _column: string): MemoryQuery {
    return this
  }

  withAvg(_relation: string, _column: string): MemoryQuery {
    return this
  }

  withMin(_relation: string, _column: string): MemoryQuery {
    return this
  }

  withMax(_relation: string, _column: string): MemoryQuery {
    return this
  }

  limit(value: number): MemoryQuery {
    return new MemoryQuery(this.#records, this.#predicates, this.#sorts, value)
  }

  async get(): Promise<readonly BenchmarkRecord[]> {
    return this.materialize()
  }

  async first(): Promise<BenchmarkRecord | undefined> {
    return this.materialize()[0]
  }

  async count(): Promise<number> {
    return this.filtered().length
  }

  async paginate(perPage: number, page: number): Promise<HoloPaginatedResult<BenchmarkRecord>> {
    const records = this.materialize()
    const total = records.length
    const start = (page - 1) * perPage
    return {
      data: records.slice(start, start + perPage),
      meta: {
        currentPage: page,
        hasMorePages: start + perPage < total,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
        perPage,
        total,
      },
    }
  }

  async simplePaginate(perPage: number, page: number): Promise<HoloSimplePaginatedResult<BenchmarkRecord>> {
    const records = this.materialize()
    const start = (page - 1) * perPage
    return {
      data: records.slice(start, start + perPage),
      meta: { currentPage: page, hasMorePages: start + perPage < records.length, perPage },
    }
  }

  async cursorPaginate(perPage: number, cursor: string | null): Promise<HoloCursorPaginatedResult<BenchmarkRecord>> {
    const start = cursor === null ? 0 : Number(cursor)
    const records = this.materialize()
    return {
      data: records.slice(start, start + perPage),
      nextCursor: start + perPage < records.length ? String(start + perPage) : null,
      perPage,
      prevCursor: start > 0 ? String(Math.max(0, start - perPage)) : null,
    }
  }

  private predicate(predicate: Predicate): MemoryQuery {
    return new MemoryQuery(this.#records, [...this.#predicates, predicate], this.#sorts, this.#maximum)
  }

  private filtered(): BenchmarkRecord[] {
    if (this.#predicates.length === 0) return [...this.#records]
    return this.#records.filter(record => this.#predicates.every(predicate => predicate(record)))
  }

  private materialize(): BenchmarkRecord[] {
    const records = this.filtered()
    if (this.#sorts.length > 0) {
      records.sort((left, right) => {
        for (const sort of this.#sorts) {
          const result = compare(scalar(left, sort.column), scalar(right, sort.column))
          if (result !== 0) return sort.direction === 'asc' ? result : -result
        }
        return 0
      })
    }
    return this.#maximum === null ? records : records.slice(0, this.#maximum)
  }
}

function createRecords(): readonly BenchmarkRecord[] {
  return Object.freeze(Array.from({ length: recordCount }, (_, index) => Object.freeze({
    category: `category-${index % 50}`,
    id: index + 1,
    title: `Record ${String(index + 1).padStart(6, '0')}`,
  })))
}

function createTableExecutor(records: readonly BenchmarkRecord[]): TableQueryExecutor<MemoryQuery, BenchmarkRecord, { readonly tenant: string }> {
  return new TableQueryExecutor({
    applyResourceScope: query => query,
    applyTenantScope: query => query,
    columns: {
      category: { column: 'category', searchable: true, sortable: true },
      id: { column: 'id', sortable: true },
      title: { column: 'title', searchable: true, sortable: true },
    },
    createQuery: () => new MemoryQuery(records),
    maxPage: 10_000,
    maxPerPage: 100,
    primaryKey: 'id',
  })
}

function createPanelRuntime(): { readonly ids: readonly string[], readonly runtime: PanelRuntime<BenchmarkActor> } {
  const actor: BenchmarkActor = Object.freeze({ id: 7, name: 'Benchmark Actor' })
  const ids = Array.from({ length: 8 }, (_, index) => `benchmark-${index + 1}`)
  const panels = ids.map((id, index) => definePanel(id, BenchmarkActor)
    .guard(index % 2 === 0 ? 'web' : 'vendor')
    .presentActor(current => ({ id: current.id, name: current.name }))
    .compile())
  return {
    ids,
    runtime: new PanelRuntime({
      guard: () => ({
        provider: async () => 'benchmark',
        user: async () => actor,
      }),
    }, panels),
  }
}

function optionPage(
  records: readonly BenchmarkRecord[],
  request: OptionQueryRequest<number>,
): OptionPage<number> {
  const term = request.search.toLocaleLowerCase('en')
  const matches = term
    ? records.filter(record => record.title.toLocaleLowerCase('en').includes(term))
    : records
  const start = (request.page - 1) * request.perPage
  return {
    hasMore: start + request.perPage < matches.length,
    options: matches.slice(start, start + request.perPage).map(record => ({ label: record.title, value: record.id })),
    page: request.page,
    perPage: request.perPage,
    total: matches.length,
  }
}

function createOptionStore(records: readonly BenchmarkRecord[]): OptionStore<number> {
  return new OptionStore({
    fieldId: 'record_id',
    locale: 'en',
    panelId: 'benchmark-1',
    resourceId: 'records',
    tenantKey: 'tenant-1',
    transport: {
      hydrateSelected: async (_request, values) => records
        .filter(record => values.includes(record.id))
        .map(record => ({ label: record.title, value: record.id })),
      list: async request => optionPage(records, request),
      validateSelection: async (_request, values) => values.every(value => value >= 1 && value <= records.length),
    },
  })
}

function createGlobalSearch(records: readonly BenchmarkRecord[]): GlobalSearchEngine<BenchmarkActor, string> {
  const defineBenchmarkSearch = globalSearchFor({ actor: BenchmarkActor, query: MemoryQuery, record: BenchmarkRecord, tenant: String })
  const resources = Array.from({ length: 4 }, (_, resourceIndex) => {
    const partition = records.filter(record => record.id % 4 === resourceIndex)
    return defineBenchmarkSearch({
      applySearch: (query, term, attributes) => query.whereAny(attributes, 'like', `%${term}%`),
      attributes: ['title'],
      authorizeResource: async () => true,
      authorizeResults: async matches => matches.map(() => ({ actions: [], page: true, result: true })),
      createQuery: () => new MemoryQuery(partition),
      execute: async (query, limit) => query.limit(limit).get(),
      guard: 'web',
      id: `records-${resourceIndex + 1}`,
      panelId: 'benchmark-1',
      resultId: 'id',
      resultUrl: record => `/benchmark-1/records/${record.id}`,
      scopeAuthorization: query => query,
      scopeTenant: query => query,
      title: 'title',
    })
  })
  return new GlobalSearchEngine(resources, {
    authorizeGuard: async () => true,
    authorizePanel: async () => true,
  })
}

function createWidgetDashboard() {
  const widgets = Array.from({ length: widgetCount }, (_, index) => defineStatsWidget(`metric-${index + 1}`)
    .data(() => ({
      stats: [{
        action: null,
        chart: [index, index + 1, index + 2],
        color: 'primary',
        description: `Metric ${index + 1}`,
        icon: 'check',
        id: `metric-${index + 1}`,
        label: `Metric ${index + 1}`,
        trend: 'up',
        url: null,
        value: index * 10,
      }],
    }))
    .compile())
  const dashboard = defineDashboard('performance')
    .default()
    .widgets(...widgets.map(widget => widget.manifest.id))
    .compile()
  return { dashboard, widgets }
}

function notificationItem(index: number): PanelDatabaseNotificationItem {
  return Object.freeze({
    createdAt: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
    id: `notification-${index + 1}`,
    presentation: Object.freeze({
      actions: [],
      body: `Notification body ${index + 1}`,
      closeable: true,
      color: null,
      duration: null,
      icon: null,
      id: `notification-${index + 1}`,
      persistent: true,
      status: 'info',
      title: `Notification ${index + 1}`,
    }),
    read: index % 3 === 0,
    type: 'benchmark',
  })
}

function createNotificationStore(): ClientNotificationInboxStore {
  const items = Object.freeze(Array.from({ length: notificationCount }, (_, index) => notificationItem(index)))
  const list = async (page: number, pageSize: number): Promise<PanelDatabaseNotificationPage> => {
    const start = (page - 1) * pageSize
    return Object.freeze({
      items: Object.freeze(items.slice(start, start + pageSize)),
      page,
      pageSize,
      total: items.length,
      unread: items.filter(item => !item.read).length,
    })
  }
  return new ClientNotificationInboxStore({
    pageSize: 50,
    polling: false,
    transport: {
      delete: async ids => ids.length,
      list: (page, pageSize) => list(page, pageSize),
      markRead: async ids => ids.length,
      markUnread: async ids => ids.length,
    },
  })
}

async function run(): Promise<BenchmarkReport> {
  const records = createRecords()
  const table = createTableExecutor(records)
  const panels = createPanelRuntime()
  const options = createOptionStore(records)
  const globalSearch = createGlobalSearch(records)
  const dashboard = createWidgetDashboard()
  const notifications = createNotificationStore()
  const signal = new AbortController().signal
  const measurements: BenchmarkMeasurement[] = []

  measurements.push(await measure('panel-bootstrap-8-panels-2-guards', async () => {
    const result = await panels.runtime.bootstrap(panels.ids, signal)
    return result.length + result.reduce((sum, panel) => sum + Number(panel.actor.id ?? 0), 0)
  }))

  measurements.push(await measure('table-pagination-100k', async iteration => {
    const result = await table.execute({ page: iteration % 100 + 1, pagination: 'page', perPage: 50 }, { tenant: 'tenant-1' })
    return result.records.reduce((sum, record) => sum + record.id, result.total ?? 0)
  }))

  measurements.push(await measure('table-search-100k', async iteration => {
    const result = await table.execute({ page: 1, pagination: 'page', perPage: 50, search: String(9_900 + iteration) }, { tenant: 'tenant-1' })
    return result.records.reduce((sum, record) => sum + record.id, result.total ?? 0)
  }))

  measurements.push(await measure('option-search-100k', async iteration => {
    const status = await options.load(String(8_800 + iteration), 1)
    return options.state.options.reduce((sum, option) => sum + option.value, status === 'applied' ? 1 : 0)
  }))

  measurements.push(await measure('global-search-4-resources-100k', async iteration => {
    const response = await globalSearch.search({
      actor: { id: 7, name: 'Benchmark Actor' },
      guard: 'web',
      panelId: 'benchmark-1',
      panelPath: '/benchmark-1',
      signal,
      tenant: 'tenant-1',
      term: String(7_700 + iteration),
    })
    return response.results.reduce((sum, result) => sum + Number(result.id), response.results.length)
  }))

  measurements.push(await measure('widget-dashboard-24-widgets', async () => {
    const context = { actor: { id: 7 }, locale: 'en', panelId: 'benchmark-1', services: {}, signal, tenant: 'tenant-1' }
    const selected = await selectDefaultDashboard([dashboard.dashboard], context)
    const resolved = await Promise.all(dashboard.widgets.map(widget => resolveWidget(widget, context)))
    return (selected?.manifest.widgets.length ?? 0) + resolved.filter(widget => widget.status === 'ready').length
  }))

  measurements.push(await measure('notification-poll-cycle-1000', async iteration => {
    await notifications.load(iteration % 20 + 1)
    return notifications.state.items.length + notifications.state.total + notifications.state.unread
  }))
  notifications.dispose()

  return Object.freeze({
    dataset: { notifications: notificationCount, records: recordCount, widgets: widgetCount },
    measurements: Object.freeze(measurements),
    runtime: {
      adapter: 'deterministic-in-memory' as const,
      bun: String(Reflect.get(process.versions, 'bun') ?? 'unknown'),
      platform: `${process.platform}-${process.arch}`,
    },
    version: 1,
    warmupIterations,
  })
}

process.stdout.write(`${JSON.stringify(await run(), null, 2)}\n`)
