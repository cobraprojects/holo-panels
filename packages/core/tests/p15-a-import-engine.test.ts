import { describe, expect, it } from 'vitest'
import {
  ImportExecutor,
  ImportRowError,
  type ImportExecutionContext,
  type ImportIdempotency,
  type ImportIdempotencyResult,
  type ImportRowContext,
} from '../src/imports/executor'
import {
  compileImportMapping,
  type ImportColumnDefinition,
  type ImportMappingError,
  type ImportValues,
} from '../src/imports/mapping'

interface Actor {
  readonly id: string
}

interface Tenant {
  readonly id: string
}

interface RecordValue {
  readonly email: string
  readonly id: number
  readonly name: string
  readonly tenantId: string
}

type RowContext = ImportRowContext<Actor, Tenant>

function context(tenantId = 'tenant-1'): ImportExecutionContext<Actor, Tenant> {
  return {
    actor: { id: 'actor-1' },
    importId: 'import-1',
    signal: new AbortController().signal,
    tenant: { id: tenantId },
  }
}

function columns(events: string[] = []): readonly ImportColumnDefinition<RowContext>[] {
  return [
    {
      key: 'email',
      parse: value => value.trim().toLowerCase(),
      required: true,
    },
    {
      key: 'name',
      parse: value => value.trim(),
      required: true,
      resolve: (value, current) => {
        events.push(`resolve:${current.context.tenant.id}`)
        return value
      },
    },
  ]
}

function mapping(events: string[] = []) {
  return compileImportMapping<RowContext>(['Email', 'Full name'], columns(events), [
    { column: 'email', header: 'Email' },
    { column: 'name', header: 'Full name' },
  ])
}

class MemoryIdempotency implements ImportIdempotency {
  readonly completed = new Set<string>()

  async run<TResult>(key: string, operation: () => Promise<TResult>): Promise<ImportIdempotencyResult<TResult>> {
    if (this.completed.has(key)) return { status: 'duplicate' }
    const value = await operation()
    this.completed.add(key)
    return { status: 'executed', value }
  }
}

function executor(options: {
  readonly deniedTenant?: string
  readonly events?: string[]
  readonly idempotency?: MemoryIdempotency
  readonly records?: RecordValue[]
} = {}) {
  const events = options.events ?? []
  const idempotency = options.idempotency ?? new MemoryIdempotency()
  const records = options.records ?? []
  let nextId = records.length + 1
  const instance = new ImportExecutor<RecordValue, Actor, Tenant>({
    duplicateKey: values => String(values.email),
    idempotency,
    mapping: mapping(events),
    persistence: {
      async choose(values, current) {
        events.push(`choose:${current.tenant.id}`)
        const record = records.find(candidate => candidate.email === values.email && candidate.tenantId === current.tenant.id)
        return record ? { kind: 'update', record } : { kind: 'create' }
      },
      async create(values, current) {
        events.push('create')
        const record = {
          email: String(values.email),
          id: nextId,
          name: String(values.name),
          tenantId: current.tenant.id,
        }
        nextId += 1
        records.push(record)
        return record
      },
      async update(record, values) {
        events.push('update')
        const updated = { ...record, name: String(values.name) }
        records.splice(records.indexOf(record), 1, updated)
        return updated
      },
    },
    security: {
      authorizeCreate() {
        events.push('authorize:create')
      },
      authorizeTenant(current) {
        events.push(`authorize:tenant:${current.tenant.id}`)
        if (current.tenant.id === options.deniedTenant) throw new ImportRowError('tenant_denied', 'Tenant access denied')
      },
      authorizeUpdate(record) {
        events.push(`authorize:update:${record.id}`)
      },
    },
    transaction: {
      async run(operation) {
        events.push('transaction:start')
        try {
          const result = await operation()
          events.push('transaction:commit')
          return result
        } catch (error) {
          events.push('transaction:rollback')
          throw error
        }
      },
    },
    validator: {
      validate(values) {
        events.push('validate')
        if (!String(values.email).includes('@')) throw new ImportRowError('validation', 'Email is invalid')
      },
    },
  })
  return { events, idempotency, instance, records }
}

function expectMappingFailure(operation: () => unknown, code: ImportMappingError['code']): void {
  expect(operation).toThrowError(expect.objectContaining<Partial<ImportMappingError>>({ code }))
}

describe('P15-A import column mapping', () => {
  it('rejects unknown, duplicate, and missing required mappings before processing rows', () => {
    expectMappingFailure(
      () => compileImportMapping(['Email'], columns(), [{ column: 'missing', header: 'Email' }]),
      'unknown_column',
    )
    expectMappingFailure(
      () => compileImportMapping(['Email'], columns(), [{ column: 'email', header: 'Missing' }]),
      'unknown_header',
    )
    expectMappingFailure(
      () => compileImportMapping(['Email', 'Email'], columns(), []),
      'duplicate_header',
    )
    expectMappingFailure(
      () => compileImportMapping(['Email'], [...columns(), columns()[0]!], []),
      'duplicate_column',
    )
    expectMappingFailure(
      () => compileImportMapping(['Email', 'Full name'], columns(), [
        { column: 'email', header: 'Email' },
        { column: 'name', header: 'Email' },
      ]),
      'duplicate_mapping',
    )
    expectMappingFailure(
      () => compileImportMapping(['Email'], columns(), [{ column: 'email', header: 'Email' }]),
      'missing_required_mapping',
    )
  })

  it('maps only allow-listed headers and resolves relationship values with row context', async () => {
    const events: string[] = []
    const compiled = mapping(events)
    const rowContext = { ...context(), row: 7 }

    await expect(compiled.map(
      { Email: ' USER@EXAMPLE.COM ', 'Full name': ' Ada ', Ignored: 'hostile' },
      { context: rowContext, row: 7 },
    )).resolves.toEqual({ email: 'user@example.com', name: 'Ada' })
    expect(events).toEqual(['resolve:tenant-1'])
  })
})

describe('P15-A import row execution', () => {
  it('validates and authorizes create or tenant-scoped update inside a per-row transaction', async () => {
    const records: RecordValue[] = [{ email: 'ada@example.com', id: 1, name: 'Old', tenantId: 'tenant-1' }]
    const { events, instance } = executor({ records })
    const result = await instance.execute([
      { Email: 'new@example.com', 'Full name': 'New' },
      { Email: 'ada@example.com', 'Full name': 'Ada' },
    ], context())

    expect(result).toMatchObject({ failures: [], skipped: 0 })
    expect(result.created).toHaveLength(1)
    expect(result.updated).toEqual([{ email: 'ada@example.com', id: 1, name: 'Ada', tenantId: 'tenant-1' }])
    expect(events).toEqual([
      'authorize:tenant:tenant-1', 'resolve:tenant-1', 'transaction:start', 'authorize:tenant:tenant-1',
      'validate', 'choose:tenant-1', 'authorize:create', 'create', 'transaction:commit',
      'authorize:tenant:tenant-1', 'resolve:tenant-1', 'transaction:start', 'authorize:tenant:tenant-1',
      'validate', 'choose:tenant-1', 'authorize:update:1', 'update', 'transaction:commit',
    ])
  })

  it('enforces tenant access before relationship resolution, matching, and mutation', async () => {
    const { events, instance } = executor({ deniedTenant: 'tenant-2' })
    const result = await instance.execute([{ Email: 'user@example.com', 'Full name': 'User' }], context('tenant-2'))

    expect(result.failures).toEqual([{
      code: 'tenant_denied',
      message: 'Tenant access denied',
      row: 1,
      source: { Email: 'user@example.com', 'Full name': 'User' },
    }])
    expect(events).toEqual(['authorize:tenant:tenant-2'])
  })

  it('collects safe failures, rolls back failed rows, and continues later rows', async () => {
    const { events, instance } = executor()
    const result = await instance.execute([
      { Email: 'invalid', 'Full name': 'Invalid' },
      { Email: 'valid@example.com', 'Full name': 'Valid' },
    ], context())

    expect(result.failures).toEqual([{
      code: 'validation',
      message: 'Email is invalid',
      row: 1,
      source: { Email: 'invalid', 'Full name': 'Invalid' },
    }])
    expect(result.created).toHaveLength(1)
    expect(events).toContain('transaction:rollback')
    expect(events.at(-1)).toBe('transaction:commit')
  })

  it('uses a stable import and duplicate key to skip duplicates within a batch and on retry', async () => {
    const idempotency = new MemoryIdempotency()
    const records: RecordValue[] = []
    const first = executor({ idempotency, records }).instance
    const second = executor({ idempotency, records }).instance
    const rows = [
      { Email: 'same@example.com', 'Full name': 'First' },
      { Email: 'same@example.com', 'Full name': 'Duplicate' },
    ]

    await expect(first.execute(rows, context())).resolves.toMatchObject({ skipped: 1, failures: [] })
    await expect(second.execute(rows, context())).resolves.toMatchObject({ skipped: 2, failures: [] })
    expect(records).toHaveLength(1)
  })

  it('does not retain an idempotency claim when a row transaction fails', async () => {
    const idempotency = new MemoryIdempotency()
    const invalid = executor({ idempotency }).instance
    const valid = executor({ idempotency }).instance

    expect((await invalid.execute([{ Email: 'invalid', 'Full name': 'Name' }], context())).failures).toHaveLength(1)
    expect(idempotency.completed).toEqual(new Set())
    expect((await valid.execute([{ Email: 'valid@example.com', 'Full name': 'Name' }], context())).created).toHaveLength(1)
  })

  it('sanitizes unexpected row failures without exposing internal messages', async () => {
    const base = mapping()
    const instance = new ImportExecutor<RecordValue, Actor, Tenant>({
      duplicateKey: values => String(values.email),
      idempotency: new MemoryIdempotency(),
      mapping: base,
      persistence: {
        choose: async () => {
          throw new Error('database password and stack')
        },
        create: async () => Promise.reject(new Error('unreachable')),
        update: async () => Promise.reject(new Error('unreachable')),
      },
      security: {
        authorizeCreate: () => undefined,
        authorizeTenant: () => undefined,
        authorizeUpdate: () => undefined,
      },
      transaction: { run: operation => operation() },
      validator: { validate: () => undefined },
    })

    const result = await instance.execute([{ Email: 'user@example.com', 'Full name': 'User' }], context())
    expect(result.failures).toEqual([{
      code: 'row_failed',
      message: 'Import row failed',
      row: 1,
      source: { Email: 'user@example.com', 'Full name': 'User' },
    }])
  })
})
