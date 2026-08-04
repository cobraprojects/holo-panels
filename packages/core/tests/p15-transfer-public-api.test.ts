import { describe, expect, it, vi } from 'vitest'
import { ExportColumnBuilder, ExporterBuilder, ImportColumnBuilder, ImporterBuilder } from '../src/transfers/builders'
import { csvExportFormat, csvImportFormat, xlsxExportFormat } from '../src/transfers/formats'
import { executeTransferExport } from '../src/transfers/export-engine'
import { transferDefinitionRevision } from '../src/transfers/revision'
import type { ExportQueryAdapter, TransferArtifactWriter, TransferExecutionContext } from '../src/transfers/contracts'

interface Actor { readonly id: number }
interface Tenant { readonly id: string }
interface Input extends Readonly<Record<string, unknown>> { readonly email: string, readonly name: string }
interface RecordRow { readonly email: string, readonly id: number, readonly name: string, readonly tenantId: string }
interface Query { readonly records: readonly RecordRow[] }

const signal = new AbortController().signal
const context: TransferExecutionContext<Actor, Tenant> = {
  actor: { id: 1 },
  guard: 'admin',
  panelId: 'admin',
  provider: null,
  resourceId: 'users',
  signal,
  tenant: { id: 'tenant-a' },
}

const records: readonly RecordRow[] = [
  { email: 'ada@example.test', id: 1, name: 'Ada', tenantId: 'tenant-a' },
  { email: 'lin@example.test', id: 2, name: 'Lin', tenantId: 'tenant-a' },
]

function queryAdapter(): ExportQueryAdapter<Query, RecordRow, string | number, Actor, Tenant> {
  return {
    primaryKey: 'id',
    applyAggregates: query => query,
    applyAuthorizationScope: query => query,
    applyRelations: query => query,
    applySelection: query => query,
    applyTableState: query => query,
    applyTenantScope: (query, scope) => ({ records: query.records.filter(record => record.tenantId === scope.tenant.id) }),
    authorize: () => true,
    count: query => Promise.resolve(query.records.length),
    createQuery: () => ({ records }),
    fetchChunk: (query, offset, limit) => Promise.resolve(query.records.slice(offset, offset + limit)),
    orderBy: query => query,
  }
}

function storedZipEntry(archive: Uint8Array, expectedName: string): Uint8Array {
  const decoder = new TextDecoder()
  for (let offset = 0; offset + 46 <= archive.length; offset++) {
    const view = new DataView(archive.buffer, archive.byteOffset + offset)
    if (view.getUint32(0, true) !== 0x02014b50) continue
    const compressedLength = view.getUint32(20, true)
    const nameLength = view.getUint16(28, true)
    const name = decoder.decode(archive.slice(offset + 46, offset + 46 + nameLength))
    if (name !== expectedName) continue
    const localOffset = view.getUint32(42, true)
    const local = new DataView(archive.buffer, archive.byteOffset + localOffset)
    const localNameLength = local.getUint16(26, true)
    const extraLength = local.getUint16(28, true)
    const valueOffset = localOffset + 30 + localNameLength + extraLength
    return archive.slice(valueOffset, valueOffset + compressedLength)
  }
  throw new Error(`Missing ZIP entry ${expectedName}`)
}

describe('P15 transfer public API', () => {
  it('preserves concrete builder subtypes and locks cached definitions after compilation', () => {
    class UserImporter extends ImporterBuilder<RecordRow, Input, Actor, Tenant> {
      usersOnly(): this {
        return this.label('Users')
      }
    }

    class UserExporter extends ExporterBuilder<Query, RecordRow, string | number, Actor, Tenant> {
      usersOnly(): this {
        return this.label('Users')
      }
    }

    const importer = new UserImporter('users', 'users')
    expect(importer.usersOnly()).toBe(importer)
    importer
      .column('email', column => column.required())
      .format(csvImportFormat(), { limits: { maxBytes: 1000, maxCellBytes: 100, maxColumns: 3, maxRows: 10 } })
      .mutation({
        choose: () => Promise.resolve({ kind: 'create' }),
        create: values => Promise.resolve({ ...values, id: 1, tenantId: 'tenant-a' }),
        duplicateKey: values => values.email,
        transaction: operation => operation(),
        update: (record, values) => Promise.resolve({ ...record, ...values }),
        validate: () => undefined,
      })
    const compiledImporter = importer.compile()
    expect(transferDefinitionRevision(compiledImporter)).toMatch(/^[a-f0-9]{64}$/u)
    expect(importer.compile()).toBe(compiledImporter)
    expect(() => importer.label('Changed')).toThrow('compiled importer cannot be modified')

    const exporter = new UserExporter('users', 'users')
    expect(exporter.usersOnly()).toBe(exporter)
    exporter.column('id', 'id').query(queryAdapter()).format(csvExportFormat(), {})
    const compiledExporter = exporter.compile()
    expect(transferDefinitionRevision(compiledExporter)).toMatch(/^[a-f0-9]{64}$/u)
    expect(exporter.compileDiscoveryDefinition()).toBe(compiledExporter)
    expect(() => exporter.maxRows(10)).toThrow('compiled exporter cannot be modified')

    const importColumn = new ImportColumnBuilder<string, Actor, Tenant>('email').required()
    expect(importColumn.compile()).toBe(importColumn.compile())
    expect(() => importColumn.label('Changed')).toThrow('compiled import column cannot be modified')

    const exportColumn = new ExportColumnBuilder<RecordRow, string, Actor, Tenant>('email', 'email').visibleByDefault()
    expect(exportColumn.compile()).toBe(exportColumn.compile())
    expect(() => exportColumn.label('Changed')).toThrow('compiled export column cannot be modified')
  })

  it('compiles an importer into separate JSON-safe client and server definitions', () => {
    const importer = new ImporterBuilder<RecordRow, Input, Actor, Tenant>('users', 'users')
      .label('Users')
      .column('name', column => column.required().label('Name'))
      .column('email', column => column.parse(value => value.toLowerCase()))
      .format(csvImportFormat(), { limits: { maxBytes: 1000, maxCellBytes: 100, maxColumns: 3, maxRows: 10 } })
      .mutation({
        choose: () => Promise.resolve({ kind: 'create' }),
        create: values => Promise.resolve({ ...values, id: 1, tenantId: 'tenant-a' }),
        duplicateKey: values => values.email,
        transaction: operation => operation(),
        update: (record, values) => Promise.resolve({ ...record, ...values }),
        validate: () => undefined,
      })
      .compile()

    expect(importer.client).toMatchObject({
      columns: [
        { key: 'name', label: 'Name', required: true },
        { key: 'email', required: false },
      ],
      formatIds: ['csv'],
      kind: 'import',
      resourceId: 'users',
    })
    expect(JSON.stringify(importer.client)).not.toContain('mutation')
    expect(importer.server.mutation).toBeTypeOf('object')
    expect(Object.isFrozen(importer.client)).toBe(true)
  })

  it('rejects unsafe transfer configuration and substituted configured columns', () => {
    const importer = new ImporterBuilder<RecordRow, Input, Actor, Tenant>('users', 'users')
    expect(() => importer.queue({ backoff: [] })).toThrow('backoff cannot be empty')
    expect(() => importer.queue({ tries: 0 })).toThrow('positive safe integer')
    expect(() => importer.storage({ directory: '../foreign', disk: 'private' })).toThrow('relative paths')
    expect(() => importer.column('email', () => new ImportColumnBuilder<string, Actor, Tenant>('name'))).toThrow('configured column')

    const exporter = new ExporterBuilder<Query, RecordRow, string | number, Actor, Tenant>('users', 'users')
    expect(() => exporter.column('email', 'email', () => new ExportColumnBuilder<RecordRow, string, Actor, Tenant>('name', 'name'))).toThrow('configured column')
  })

  it('invokes computed, option, and format resolvers once per bounded chunk', async () => {
    const computed = vi.fn(({ records: batch }: { readonly records: readonly Readonly<RecordRow>[] }) => batch.map(record => record.name))
    const options = vi.fn(() => records.map(record => ({ label: record.name.toUpperCase(), value: record.name })))
    const format = vi.fn(({ values }: { readonly values: readonly string[] }) => values.map(value => `[${value}]`))
    const exporter = new ExporterBuilder<Query, RecordRow, string | number, Actor, Tenant>('users', 'users')
      .column('id', 'id')
      .computed('display-name', computed, column => column.options(options).format(format))
      .query(queryAdapter())
      .format(csvExportFormat(), {})
      .chunkSize(2)
      .compile()
    const chunks: unknown[] = []

    const result = await executeTransferExport(exporter, {
      context,
      selection: { mode: 'all-matching', excludedRecordIds: [] },
      tableState: { pagination: 'page' },
    }, (chunk) => { chunks.push(chunk) })

    expect(result).toMatchObject({ chunks: 1, rows: 2 })
    expect(computed).toHaveBeenCalledTimes(1)
    expect(options).toHaveBeenCalledTimes(1)
    expect(format).toHaveBeenCalledTimes(1)
    expect(chunks).toEqual([expect.objectContaining({ rows: [[1, '[ADA]'], [2, '[LIN]']] })])
  })

  it('fails closed when a batch resolver returns the wrong number of values', async () => {
    const exporter = new ExporterBuilder<Query, RecordRow, string | number, Actor, Tenant>('users', 'users')
      .computed('name', () => ['only-one'])
      .query(queryAdapter())
      .format(csvExportFormat(), {})
      .chunkSize(2)
      .compile()

    await expect(executeTransferExport(exporter, {
      context,
      selection: { mode: 'explicit', recordIds: [1, 2] },
      tableState: { pagination: 'page' },
    }, () => undefined)).rejects.toMatchObject({ code: 'inconsistent_resolver' })
  })

  it('streams escaped CSV output and closes the private artifact writer', async () => {
    const written: Uint8Array[] = []
    const writer: TransferArtifactWriter = {
      abort: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve({ contentType: 'text/csv', digest: { algorithm: 'sha256' as const, value: 'a'.repeat(64) }, disk: 'private', filename: 'export.csv', path: 'exports/1.csv', size: 1 })),
      write: chunk => { written.push(chunk); return Promise.resolve() },
    }
    const format = csvExportFormat()

    await format.write({
      headers: ['Name'],
      rows: (async function * () { yield [['=SUM(A1:A2)']] })(),
    }, writer, {})

    expect(new TextDecoder().decode(Uint8Array.from(written.flatMap(chunk => [...chunk])))).toBe("Name\r\n'=SUM(A1:A2)\r\n")
    expect(writer.close).toHaveBeenCalledTimes(1)
    expect(writer.abort).not.toHaveBeenCalled()
  })

  it('writes a valid XLSX archive with literal hostile text and configured dates', async () => {
    const written: Uint8Array[] = []
    const writer: TransferArtifactWriter = {
      abort: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', digest: { algorithm: 'sha256' as const, value: 'a'.repeat(64) }, disk: 'private', filename: 'export.xlsx', path: 'exports/1.xlsx', size: 1 })),
      write: chunk => { written.push(chunk); return Promise.resolve() },
    }

    await xlsxExportFormat({ dateFormat: 'yyyy-mm-dd', sheetName: 'People & Dates' }).write({
      headers: ['Name', 'Created'],
      rows: (async function * () { yield [['=HYPERLINK("https://example.test")', new Date('2026-07-29T00:00:00.000Z')]] })(),
    }, writer, {})

    const archive = Uint8Array.from(written.flatMap(chunk => [...chunk]))
    const worksheet = new TextDecoder().decode(storedZipEntry(archive, 'xl/worksheets/sheet1.xml'))
    const workbook = new TextDecoder().decode(storedZipEntry(archive, 'xl/workbook.xml'))
    const styles = new TextDecoder().decode(storedZipEntry(archive, 'xl/styles.xml'))
    expect(worksheet).toContain('t="inlineStr"')
    expect(worksheet).toContain('=HYPERLINK(&quot;https://example.test&quot;)')
    expect(worksheet).not.toContain('<f>')
    expect(worksheet).toContain('s="1"')
    expect(workbook).toContain('People &amp; Dates')
    expect(styles).toContain('formatCode="yyyy-mm-dd"')
    expect(writer.close).toHaveBeenCalledTimes(1)
    expect(writer.abort).not.toHaveBeenCalled()
  })
})
