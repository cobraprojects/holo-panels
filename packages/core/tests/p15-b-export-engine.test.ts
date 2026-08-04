import { describe, expect, it } from 'vitest'
import {
  type ExportDefinition,
  type ExportEngineError,
  executeCsvExport,
  executeExport,
  planExport,
} from '../src/exports/engine'

interface RecordRow {
  readonly allowed: boolean
  readonly customer: { readonly name: string }
  readonly id: number
  readonly status: 'active' | 'paused'
  readonly tenantId: number
  readonly total: number
}

interface ExportContext {
  readonly actorId: number
  readonly tenantId: number
}

interface TestQuery {
  readonly records: readonly RecordRow[]
}

function definition(
  events: string[],
  records: readonly RecordRow[],
  authorized = true,
): ExportDefinition<TestQuery, RecordRow, ExportContext> {
  return {
    columns: [
      { id: 'id', label: 'ID', path: 'id' },
      { id: 'customer_name', label: 'Customer', path: 'customer.name', relation: 'customer' },
      {
        aggregate: { kind: 'sum', relation: 'items', column: 'price' },
        format: ({ value }) => `$${value}`,
        id: 'total',
        label: 'Total',
        state: ({ record }) => record.total,
      },
      {
        id: 'status',
        label: 'Status',
        options: () => [
          { label: '=Enabled', value: 'active' },
          { label: 'Paused', value: 'paused' },
        ],
        path: 'status',
      },
      { id: 'internal', label: 'Internal', path: 'id', visibleByDefault: false },
    ],
    overrideQuery: (query) => {
      events.push('override')
      return query
    },
    query: {
      primaryKey: 'id',
      applyAggregates: (query, aggregates) => {
        events.push(`aggregates:${aggregates.map(aggregate => aggregate.relation).join(',')}`)
        return query
      },
      applyAuthorizationScope: (query) => {
        events.push('authorization-scope')
        return { records: query.records.filter(record => record.allowed) }
      },
      applyRelations: (query, relations) => {
        events.push(`relations:${relations.join(',')}`)
        return query
      },
      applyTenantScope: (query, context) => {
        events.push('tenant-scope')
        return { records: query.records.filter(record => record.tenantId === context.tenantId) }
      },
      authorize: () => {
        events.push('authorize')
        return authorized
      },
      count: (query) => {
        events.push('count')
        return Promise.resolve(query.records.length)
      },
      createQuery: () => {
        events.push('create')
        return { records }
      },
      fetchChunk: (query, offset, limit) => {
        events.push(`fetch:${offset}:${limit}`)
        return Promise.resolve(query.records.slice(offset, offset + limit))
      },
      orderBy: (query, column, direction) => {
        events.push(`order:${column}:${direction}`)
        return { records: [...query.records].sort((left, right) => left.id - right.id) }
      },
    },
  }
}

const records: readonly RecordRow[] = [
  { id: 4, tenantId: 2, allowed: true, customer: { name: 'Other' }, status: 'active', total: 40 },
  { id: 3, tenantId: 1, allowed: false, customer: { name: 'Hidden' }, status: 'active', total: 30 },
  { id: 2, tenantId: 1, allowed: true, customer: { name: 'Lin' }, status: 'paused', total: 20 },
  { id: 1, tenantId: 1, allowed: true, customer: { name: 'Ada' }, status: 'active', total: 10 },
]

const request = {
  chunkSize: 1,
  context: { actorId: 7, tenantId: 1 },
  maxRows: 10,
}

describe('P15-B export planning and execution', () => {
  it('uses visible table columns by default and plans only their query dependencies', () => {
    const plan = planExport(definition([], records), {
      visibleTableColumns: ['customer_name', 'total'],
    })

    expect(plan.headers).toEqual(['Customer', 'Total'])
    expect(plan.columns.map(column => column.id)).toEqual(['customer_name', 'total'])
    expect(plan.relations).toEqual(['customer'])
    expect(plan.aggregates).toEqual([{ kind: 'sum', relation: 'items', column: 'price' }])
  })

  it('allow-lists explicit selections and rejects unknown or duplicate columns', () => {
    expect(() => planExport(definition([], records), { selectedColumns: ['id', 'missing'] })).toThrowError(
      expect.objectContaining<Partial<ExportEngineError>>({ code: 'unknown_column' }),
    )
    expect(() => planExport(definition([], records), { selectedColumns: ['id', 'id'] })).toThrowError(
      expect.objectContaining<Partial<ExportEngineError>>({ code: 'duplicate_column' }),
    )
  })

  it('scopes before overrides, loads, counting, and deterministic chunks', async () => {
    const events: string[] = []
    const chunks: unknown[] = []
    const result = await executeExport(
      definition(events, records),
      { ...request, selectedColumns: ['id', 'customer_name', 'total', 'status'] },
      (chunk) => {
        chunks.push(chunk)
      },
    )

    expect(events).toEqual([
      'authorize',
      'create',
      'authorization-scope',
      'tenant-scope',
      'override',
      'relations:customer',
      'aggregates:items',
      'order:id:asc',
      'count',
      'fetch:0:1',
      'fetch:1:1',
    ])
    expect(result).toEqual({ chunks: 2, columnIds: ['id', 'customer_name', 'total', 'status'], rows: 2 })
    expect(chunks).toEqual([
      { index: 0, offset: 0, rows: [[1, 'Ada', '$10', '=Enabled']], totalRows: 2 },
      { index: 1, offset: 1, rows: [[2, 'Lin', '$20', 'Paused']], totalRows: 2 },
    ])
  })

  it('escapes formula-capable option labels through the CSV adapter by default', async () => {
    const csv = await executeCsvExport(
      definition([], records),
      { ...request, selectedColumns: ['status'] },
    )

    expect(csv).toBe("Status\r\n'=Enabled\r\nPaused\r\n")
  })

  it('rejects unauthorized exports before query creation', async () => {
    const events: string[] = []
    await expect(executeExport(definition(events, records, false), request, () => undefined)).rejects.toMatchObject({
      code: 'unauthorized',
    })
    expect(events).toEqual(['authorize'])
  })

  it('enforces the maximum row count before reading chunks', async () => {
    const events: string[] = []
    await expect(executeExport(
      definition(events, records),
      { ...request, chunkSize: 1, maxRows: 1 },
      () => undefined,
    )).rejects.toMatchObject({ code: 'max_rows_exceeded' })
    expect(events.some(event => event.startsWith('fetch:'))).toBe(false)
  })
})
