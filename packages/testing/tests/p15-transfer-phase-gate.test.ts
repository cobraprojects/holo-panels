import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DB,
  configureDB,
  createAdapter,
  createConnectionManager,
  createDialect,
  createSchemaService,
  registerDatabaseDriverFactory,
  resetDB,
} from '../../../../holo-js/packages/db/src/index'
import { sqliteDatabaseDriverFactory } from '../../../../holo-js/packages/db-sqlite/src/index'
import { createQueueDbRuntimeOptions } from '../../../../holo-js/packages/queue-db/src/index'
import {
  configureNotificationsRuntime,
  defineNotification,
  resetNotificationsRuntime,
  type NotificationRecord,
  type NotificationStore,
} from '@holo-js/notifications'
import {
  configureQueueRuntime,
  registerQueueJob,
  resetQueueRegistry,
  resetQueueRuntime,
} from '@holo-js/queue'
import {
  configureStorageRuntime,
  resetStorageRuntime,
  type StorageBackend,
} from '@holo-js/storage/runtime'
import {
  csvExportFormat,
  csvImportFormat,
  executeTransferExport,
  ExporterBuilder,
  holoTransferCompletionNotifier,
  transferDefinitionRevision,
  TransferOutboxDispatcher,
  type ExportQueryAdapter,
  type TransferExecutionContext,
  type TransferQueueEnvelope,
  type TransferStoredArtifact,
} from '@holo-js/panels-core'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryTransferStore } from '../../core/tests/helpers/transfer-store'
import { ImportExecutor } from '../../core/src/imports/executor'
import { compileImportMapping } from '../../core/src/imports/mapping'
import { defineHoloTransferQueueJob, HoloTransferQueueAdapter } from '../../core/src/transfers/holo-queue'
import { TransferOperationLifecycle } from '../../core/src/transfers/lifecycle'
import { finalizeTransferExportParts, persistTransferExportPart } from '../../core/src/transfers/parts'
import { loadExampleExport } from './load-example'

interface Actor {
  readonly id: string
  readonly type: string
}

interface Tenant {
  readonly id: string
}

interface Row {
  readonly id: number
  readonly name: string
  readonly tenantId: string
}

interface Query {
  readonly rows: readonly Row[]
}

interface Scope {
  readonly actor: Actor
  readonly tenant: Tenant
}

interface TransferAcceptanceFixture {
  readonly exporterId: string
  readonly framework: string
  readonly importerId: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const now = new Date('2026-07-29T12:00:00.000Z')
const fixtures = await Promise.all([
  loadExampleExport<TransferAcceptanceFixture>('next', 'p15-transfer-acceptance-next', 'nextTransferAcceptanceFixture'),
  loadExampleExport<TransferAcceptanceFixture>('nuxt', 'p15-transfer-acceptance-nuxt', 'nuxtTransferAcceptanceFixture'),
  loadExampleExport<TransferAcceptanceFixture>('sveltekit', 'p15-transfer-acceptance-sveltekit', 'svelteKitTransferAcceptanceFixture'),
])

function notificationStore(records: Map<string, NotificationRecord>): NotificationStore {
  return {
    async create(record) {
      const existing = records.get(record.id)
      if (!existing) {
        records.set(record.id, record)
        return
      }
      if (existing.notifiableId !== record.notifiableId || existing.notifiableType !== record.notifiableType || existing.type !== record.type) {
        throw new Error('Notification deduplication collision')
      }
    },
    delete: async () => 0,
    list: async (_query, pagination) => ({ records: [], limit: pagination.limit, offset: pagination.offset, total: 0, unread: 0 }),
    markAsRead: async () => 0,
    markAsUnread: async () => 0,
    unread: async (_query, pagination) => ({ records: [], limit: pagination.limit, offset: pagination.offset, total: 0, unread: 0 }),
  }
}

function transferNotification(status: 'completed' | 'failed', operationId: string) {
  return defineNotification({
    type: `transfer-${status}`,
    via(_actor: Actor) {
      return ['database']
    },
    build: {
      database() {
        return { data: { operationId, status } }
      },
    },
  })
}

function backendPath(root: string, key: string): string {
  return join(root, Buffer.from(key).toString('base64url'))
}

function storageBytes(value: string | Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (typeof value === 'string') return encoder.encode(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(value)
}

function localBackend(root: string): StorageBackend {
  return {
    async getItem<TValue>(key: string): Promise<TValue | null> {
      const value = await this.getItemRaw(key)
      if (value === null) return null
      return JSON.parse(typeof value === 'string' ? value : decoder.decode(storageBytes(value))) as TValue
    },
    async getItemRaw(key) {
      try {
        return await readFile(backendPath(root, key))
      } catch (error) {
        if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'ENOENT') return null
        throw error
      }
    },
    async setItem(key, value) {
      await writeFile(backendPath(root, key), JSON.stringify(value))
    },
    async setItemRaw(key, value) {
      await writeFile(backendPath(root, key), storageBytes(value))
    },
    async hasItem(key) {
      return (await this.getItemRaw(key)) !== null
    },
    async removeItem(key) {
      try {
        await unlink(backendPath(root, key))
      } catch (error) {
        if (typeof error !== 'object' || error === null || Reflect.get(error, 'code') !== 'ENOENT') throw error
      }
    },
    getKeys: async () => [],
    async getItemStream(key) {
      const value = await this.getItemRaw(key)
      if (value === null) return null
      const bytes = storageBytes(value)
      return (async function * () {
        for (let offset = 0; offset < bytes.length; offset += 4096) yield bytes.slice(offset, offset + 4096)
      })()
    },
    async setItemStream(key, source, options) {
      if (!options.overwrite && await this.hasItem(key)) throw new Error('Storage destination exists')
      const chunks: Uint8Array[] = []
      for await (const chunk of source) chunks.push(chunk)
      await writeFile(backendPath(root, key), Buffer.concat(chunks))
    },
  }
}

function queryAdapter(rows: readonly Row[]): ExportQueryAdapter<Query, Row, number, Actor, Tenant> {
  return {
    primaryKey: 'id',
    applyAggregates: query => query,
    applyAuthorizationScope: query => query,
    applyRelations: query => query,
    applySelection: query => query,
    applyTableState: query => query,
    applyTenantScope: (query, context) => ({ rows: query.rows.filter(row => row.tenantId === context.tenant.id) }),
    authorize: () => true,
    count: query => Promise.resolve(query.rows.length),
    createQuery: () => ({ rows }),
    fetchChunk: (query, offset, limit) => Promise.resolve(query.rows.slice(offset, offset + limit)),
    orderBy: query => query,
  }
}

function lifecycle(store: MemoryTransferStore<number>) {
  let sequence = 0
  return new TransferOperationLifecycle<Scope, number>({
    authorizeCancellation: () => true,
    authorizeDownload: () => true,
    clock: () => now,
    identifyActor: scope => scope.actor.id,
    identifyGuard: () => 'admin',
    identifyPanel: () => 'admin',
    identifyProvider: () => 'admins',
    identifyTenant: scope => scope.tenant.id,
    makeId: () => `transfer-${++sequence}`,
    maxChunkRetries: 2,
    retentionMilliseconds: 60_000,
    signDownload: () => 'signed-download',
    store,
    verifyDownload: () => null,
  })
}

function queuedEnvelope(store: MemoryTransferStore<number>, revision: number): TransferQueueEnvelope {
  const event = [...store.outbox.values()].find(record => record.operationRevision === revision && record.event.kind === 'queue')?.event
  if (!event || event.kind !== 'queue') throw new Error('Queued transfer envelope is unavailable')
  return event.envelope
}

async function configureDatabaseQueue(): Promise<ReturnType<typeof createConnectionManager>> {
  registerDatabaseDriverFactory(sqliteDatabaseDriverFactory)
  const manager = createConnectionManager({
    defaultConnection: 'default',
    connections: { default: { adapter: createAdapter('sqlite', { database: ':memory:' }), dialect: createDialect('sqlite') } },
  })
  configureDB(manager)
  await manager.initializeAll()
  await createSchemaService(DB.connection()).createTable('jobs', (table) => {
    table.string('id').primaryKey()
    table.string('job')
    table.string('connection')
    table.string('queue')
    table.text('payload')
    table.integer('attempts').default(0)
    table.integer('max_attempts').default(1)
    table.bigInteger('available_at')
    table.bigInteger('reserved_at').nullable()
    table.string('reservation_id').nullable()
    table.bigInteger('created_at')
  })
  configureQueueRuntime({
    config: {
      default: 'database',
      failed: false,
      connections: { database: { connection: 'default', driver: 'database', queue: 'transfers', table: 'jobs' } },
    },
    ...createQueueDbRuntimeOptions(),
  })
  return manager
}

afterEach(() => {
  resetNotificationsRuntime()
  resetQueueRegistry()
  resetQueueRuntime()
  resetStorageRuntime()
  resetDB()
})

describe('P15 transfer phase gate', () => {
  it.each(fixtures)('completes the equivalent import/export journey in $framework', async (fixture) => {
    const root = await mkdtemp(join(tmpdir(), 'holo-panels-p15-'))
    const manager = await configureDatabaseQueue()
    const notifications = new Map<string, NotificationRecord>()
    configureNotificationsRuntime({ store: notificationStore(notifications) })
    configureStorageRuntime({
      getRuntimeConfig: () => ({
        holoStorage: {
          defaultDisk: 'private',
          diskNames: ['private'],
          routePrefix: '/storage',
          disks: { private: { driver: 'local', name: 'private', root, visibility: 'private' } },
        },
      }),
      getStorage: () => localBackend(root),
    })

    try {
      const { createHoloTransferStorage } = await import('@holo-js/panels-core')
      const storage = createHoloTransferStorage()
      const inputWriter = await storage.writer({ contentType: 'text/csv', disk: 'private', filename: 'posts.csv', operationId: `${fixture.framework}-upload`, purpose: 'input' })
      await inputWriter.write(encoder.encode('Name\r\nAda\r\nLin\r\n'))
      const inputArtifact = await inputWriter.close()
      const source = await storage.source(inputArtifact)
      if (!source) throw new Error('Import source is unavailable')
      const inputChunks: Uint8Array[] = []
      for await (const chunk of source.chunks({ chunkBytes: 4096 })) inputChunks.push(chunk)
      expect(decoder.decode(Buffer.concat(inputChunks))).toBe('Name\r\nAda\r\nLin\r\n')
      const repeatedChunks: Uint8Array[] = []
      for await (const chunk of source.chunks()) repeatedChunks.push(chunk)
      expect(decoder.decode(Buffer.concat(repeatedChunks))).toBe('Name\r\nAda\r\nLin\r\n')

      const format = csvImportFormat({ limits: { maxBytes: 4096, maxCellBytes: 256, maxColumns: 4, maxRows: 10 } })
      const inspection = await format.inspect(source, { limits: { maxBytes: 4096, maxCellBytes: 256, maxColumns: 4, maxRows: 10 } })
      const rows = await format.readChunk(source, { limits: { maxBytes: 4096, maxCellBytes: 256, maxColumns: 4, maxRows: 10 } }, 0, 10)
      const records: Row[] = []
      const completedKeys = new Set<string>()
      const importExecutor = new ImportExecutor<Row, Actor, Tenant>({
        duplicateKey: values => String(values.name),
        idempotency: {
          async run(key, operation) {
            if (completedKeys.has(key)) return { status: 'duplicate' }
            const value = await operation()
            completedKeys.add(key)
            return { status: 'executed', value }
          },
        },
        mapping: compileImportMapping(['Name'], [{ key: 'name', required: true, parse: value => value.trim() }], [{ column: 'name', header: 'Name' }]),
        persistence: {
          choose: () => Promise.resolve({ kind: 'create' }),
          create(values, context) {
            const record = { id: records.length + 1, name: String(values.name), tenantId: context.tenant.id }
            records.push(record)
            return Promise.resolve(record)
          },
          update: (record) => Promise.resolve(record),
        },
        security: { authorizeCreate: () => undefined, authorizeTenant: () => undefined, authorizeUpdate: () => undefined },
        transaction: { run: operation => operation() },
        validator: { validate: () => undefined },
      })

      const job = defineHoloTransferQueueJob(() => undefined)
      registerQueueJob(job, { name: `holo-panels.transfer.${fixture.framework}` })
      const queue = new HoloTransferQueueAdapter(job)
      const notifier = holoTransferCompletionNotifier({
        completed: operation => transferNotification('completed', operation.id),
        failed: operation => transferNotification('failed', operation.id),
      })
      const scope: Scope = { actor: { id: `${fixture.framework}-admin`, type: 'admins' }, tenant: { id: 'tenant-a' } }
      const context: TransferExecutionContext<Actor, Tenant> = {
        actor: scope.actor,
        guard: 'admin',
        panelId: 'admin',
        provider: 'admins',
        resourceId: 'posts',
        signal: new AbortController().signal,
        tenant: scope.tenant,
      }

      const importStore = new MemoryTransferStore<number>()
      const importLifecycle = lifecycle(importStore)
      const importOperation = await importLifecycle.create({
        definitionId: fixture.importerId,
        definitionRevision: 'a'.repeat(64),
        input: { formatId: 'csv', kind: 'import', mappings: [{ column: 'name', header: 'Name' }], source: inputArtifact },
        kind: 'import',
        queue: { connection: 'database', queue: 'transfers' },
        resourceId: 'posts',
        total: inspection.rows,
      }, scope)
      const importEnvelope = queuedEnvelope(importStore, importOperation.revision)
      await queue.enqueue(importEnvelope, { connection: 'database', queue: 'transfers' })
      await importLifecycle.claim(importEnvelope)
      const imported = await importExecutor.execute(rows, { actor: scope.actor, importId: importOperation.id, signal: context.signal, tenant: scope.tenant })
      await importLifecycle.progress(importOperation.id, { completed: inspection.rows, kind: 'import', next: null })
      await importLifecycle.complete(importOperation.id, null)

      const exporter = new ExporterBuilder<Query, Row, number, Actor, Tenant>(fixture.exporterId, 'posts')
        .column('id', 'id', column => column.label('ID'))
        .column('name', 'name', column => column.label('Name'))
        .query(queryAdapter([...records, { id: 3, name: 'Foreign', tenantId: 'tenant-b' }]))
        .format(csvExportFormat(), {})
        .chunkSize(2)
        .storage({ disk: 'private' })
        .compile()
      const exportStore = new MemoryTransferStore<number>()
      const exportLifecycle = lifecycle(exportStore)
      const exportOperation = await exportLifecycle.create({
        definitionId: exporter.id,
        definitionRevision: transferDefinitionRevision(exporter),
        input: { columnIds: ['id', 'name'], formatId: 'csv', kind: 'export', selection: { mode: 'all-matching', excludedRecordIds: [] }, tableState: { pagination: 'page' } },
        kind: 'export',
        queue: { connection: 'database', queue: 'transfers' },
        resourceId: 'posts',
        total: records.length,
      }, scope)
      const exportEnvelope = queuedEnvelope(exportStore, exportOperation.revision)
      await queue.enqueue(exportEnvelope, { connection: 'database', queue: 'transfers' })
      await exportLifecycle.claim(exportEnvelope)
      await executeTransferExport(exporter, {
        context,
        selection: { mode: 'all-matching', excludedRecordIds: [] },
        tableState: { pagination: 'page' },
      }, async chunk => {
        await persistTransferExportPart({
          chunk: chunk.index,
          chunkSize: exporter.server.chunkSize,
          columnCount: 2,
          completed: chunk.offset + chunk.rows.length,
          disk: 'private',
          lifecycle: exportLifecycle,
          next: { chunk: chunk.index + 1, configuration: { connection: 'database', queue: 'transfers' } },
          operationId: exportOperation.id,
          rows: chunk.rows,
          storage,
        })
      })
      const advanced = await exportLifecycle.get(exportOperation.id)
      const claimed = await exportLifecycle.claim(queuedEnvelope(exportStore, advanced.revision))
      const completed = await finalizeTransferExportParts({ context, definition: exporter, lifecycle: exportLifecycle, operation: claimed, storage })

      const dispatchNotifications = async (store: MemoryTransferStore<number>) => new TransferOutboxDispatcher({
        clock: () => now,
        notifier,
        queue,
        resolveContext: () => Promise.resolve(context),
        store,
      }).run(10)
      await dispatchNotifications(importStore)
      await dispatchNotifications(exportStore)
      const resultSource = await storage.source(completed.artifact as TransferStoredArtifact)
      const resultChunks: Uint8Array[] = []
      for await (const chunk of resultSource?.chunks({ chunkBytes: 4096 }) ?? []) resultChunks.push(chunk)
      const databaseJobs = await DB.connection().queryCompiled<{ readonly count: number }>({ sql: 'SELECT COUNT(*) AS count FROM jobs', source: 'p15:phase-gate:jobs' })

      expect(imported).toMatchObject({ failures: [], skipped: 0 })
      expect(records.map(record => record.name)).toEqual(['Ada', 'Lin'])
      expect(decoder.decode(Buffer.concat(resultChunks))).toBe('ID,Name\r\n1,Ada\r\n2,Lin\r\n')
      expect(completed).toMatchObject({ artifact: { disk: 'private' }, status: 'completed' })
      expect(databaseJobs.rows[0]?.count).toBeGreaterThanOrEqual(2)
      expect([...notifications.values()].map(record => record.id)).toHaveLength(2)
    } finally {
      await manager.disconnectAll()
      await rm(root, { force: true, recursive: true })
    }
  })
})
