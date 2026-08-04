import { DISCOVERY_MARKER } from '../discovery/types'
import type { ResourceBuilder } from '../resources/builder'
import type { ResourceModelDefinition, ResourceRecord } from '../resources/contracts'
import type { TableRecordIdentifier } from '../tables/query/contracts'
import type {
  CompiledExportColumn,
  CompiledExportFormat,
  CompiledImportColumn,
  CompiledImportFormat,
  ExportAggregateKind,
  ExportCell,
  ExportColumnBatchContext,
  ExportColumnBatchValueContext,
  ExportColumnOption,
  ExportFormatAdapter,
  ExportPathValue,
  ExportQueryAdapter,
  ExportRecordPath,
  ExportRelationPath,
  ExporterDefinition,
  ImportFormatAdapter,
  ImportLimits,
  ImportMutationAdapter,
  ImportRowExecutionContext,
  ImporterDefinition,
  TransferPolicy,
  TransferInputSource,
  TransferQueueConfiguration,
  TransferRetentionConfiguration,
  TransferStorageConfiguration,
} from './contracts'

const defaultImportLimits: ImportLimits = Object.freeze({
  maxCellBytes: 1_048_576,
  maxColumns: 500,
  maxFileBytes: 10_485_760,
  maxRows: 100_000,
})
const defaultQueue: TransferQueueConfiguration = Object.freeze({})
const defaultRetention: TransferRetentionConfiguration = Object.freeze({
  artifactMilliseconds: 86_400_000,
  operationMilliseconds: 604_800_000,
})
const defaultStorage: TransferStorageConfiguration = Object.freeze({ disk: 'private' })
const allow = (): true => true

function assertIdentifier(value: string, subject: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`[Holo Panels] Invalid ${subject} "${value}".`)
  }
}

function assertText(value: string, subject: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`[Holo Panels] ${subject} cannot be empty.`)
  return normalized
}

function assertPositiveInteger(value: number, subject: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`[Holo Panels] ${subject} must be a positive safe integer.`)
  }
}

function assertNonNegativeInteger(value: number, subject: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[Holo Panels] ${subject} must be a non-negative safe integer.`)
  }
}

function normalizeQueueConfiguration(configuration: TransferQueueConfiguration): TransferQueueConfiguration {
  if (configuration.tries !== undefined) assertPositiveInteger(configuration.tries, 'Transfer queue tries')
  const backoff = configuration.backoff
  if (typeof backoff === 'number') assertNonNegativeInteger(backoff, 'Transfer queue backoff')
  if (Array.isArray(backoff)) {
    if (backoff.length === 0) throw new Error('[Holo Panels] Transfer queue backoff cannot be empty.')
    for (const value of backoff) assertNonNegativeInteger(value, 'Transfer queue backoff')
  }
  return Object.freeze({
    ...(backoff === undefined ? {} : { backoff: Array.isArray(backoff) ? Object.freeze([...backoff]) : backoff }),
    ...(configuration.connection === undefined ? {} : { connection: assertText(configuration.connection, 'Transfer queue connection') }),
    ...(configuration.queue === undefined ? {} : { queue: assertText(configuration.queue, 'Transfer queue name') }),
    ...(configuration.tries === undefined ? {} : { tries: configuration.tries }),
  })
}

function normalizeStorageConfiguration(configuration: TransferStorageConfiguration): TransferStorageConfiguration {
  const disk = assertText(configuration.disk, 'Transfer storage disk')
  const directory = configuration.directory?.trim().replace(/^\.\//u, '')
  if (directory !== undefined && (!directory || directory.startsWith('/') || directory.includes('\0') || directory.split('/').includes('..'))) {
    throw new Error('[Holo Panels] Transfer storage directories must be relative paths.')
  }
  return Object.freeze({ ...(directory === undefined ? {} : { directory }), disk })
}

interface ImportColumnState<TValue, TActor extends object, TTenant> {
  readonly example: string | null
  readonly key: string
  readonly label: string
  readonly required: boolean
  readonly parse: (value: string, context: ImportRowExecutionContext<TActor, TTenant>) => TValue | Promise<TValue>
  readonly resolve?: (value: TValue, context: ImportRowExecutionContext<TActor, TTenant>) => TValue | Promise<TValue>
}

export class ImportColumnBuilder<TValue, TActor extends object, TTenant> {
  #compiled?: CompiledImportColumn<TActor, TTenant>
  #state: ImportColumnState<TValue, TActor, TTenant>

  constructor(key: string, state?: ImportColumnState<TValue, TActor, TTenant>) {
    this.#state = state ?? {
      example: null,
      key,
      label: key,
      parse: value => value as TValue,
      required: false,
    }
  }

  label(label: string): this {
    return this.with({ label: assertText(label, 'Import column label') })
  }

  required(required = true): this {
    return this.with({ required })
  }

  example(example: string): this {
    return this.with({ example: assertText(example, 'Import column example') })
  }

  parse(parser: ImportColumnState<TValue, TActor, TTenant>['parse']): this {
    return this.with({ parse: parser })
  }

  resolve(resolver: NonNullable<ImportColumnState<TValue, TActor, TTenant>['resolve']>): this {
    return this.with({ resolve: resolver })
  }

  compile(): CompiledImportColumn<TActor, TTenant> {
    if (this.#compiled) return this.#compiled
    const state = this.#state
    this.#compiled = Object.freeze({
      example: state.example,
      key: state.key,
      label: state.label,
      parse: state.parse,
      required: state.required,
      ...(state.resolve ? { resolve: (value: unknown, context: ImportRowExecutionContext<TActor, TTenant>) => state.resolve!(value as TValue, context) } : {}),
    })
    return this.#compiled
  }

  private with(patch: Partial<ImportColumnState<TValue, TActor, TTenant>>): this {
    this.assertMutable()
    this.#state = { ...this.#state, ...patch }
    return this
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('[Holo Panels] A compiled import column cannot be modified.')
  }
}

interface ImporterState<TRecord, TValues extends Readonly<Record<string, unknown>>, TActor extends object, TTenant> {
  readonly authorize: TransferPolicy<TActor, TTenant>
  readonly authorizeCancellation: TransferPolicy<TActor, TTenant>
  readonly chunkSize: number
  readonly columns: readonly CompiledImportColumn<TActor, TTenant>[]
  readonly formats: readonly CompiledImportFormat[]
  readonly id: string
  readonly label: string
  readonly limits: ImportLimits
  readonly mutation?: ImportMutationAdapter<TRecord, TValues, TActor, TTenant>
  readonly queue: TransferQueueConfiguration
  readonly resourceId: string
  readonly retention: TransferRetentionConfiguration
  readonly storage: TransferStorageConfiguration
}

export class ImporterBuilder<TRecord, TValues extends Readonly<Record<string, unknown>>, TActor extends object, TTenant> {
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'import' as const
  #compiled?: ImporterDefinition<TRecord, TValues, TActor, TTenant>
  #state: ImporterState<TRecord, TValues, TActor, TTenant>

  constructor(id: string, resourceId: string, state?: ImporterState<TRecord, TValues, TActor, TTenant>) {
    assertIdentifier(id, 'importer ID')
    this.#state = state ?? {
      authorize: allow,
      authorizeCancellation: allow,
      chunkSize: 500,
      columns: [],
      formats: [],
      id,
      label: id,
      limits: defaultImportLimits,
      queue: defaultQueue,
      resourceId,
      retention: defaultRetention,
      storage: defaultStorage,
    }
  }

  get id(): string {
    return this.#state.id
  }

  label(label: string): this {
    return this.with({ label: assertText(label, 'Importer label') })
  }

  column<TKey extends Extract<keyof TValues, string>>(
    key: TKey,
    configure: (column: ImportColumnBuilder<TValues[TKey], TActor, TTenant>) => ImportColumnBuilder<TValues[TKey], TActor, TTenant>,
  ): this {
    if (this.#state.columns.some(column => column.key === key)) {
      throw new Error(`[Holo Panels] Import column "${key}" is duplicated.`)
    }
    const column = configure(new ImportColumnBuilder<TValues[TKey], TActor, TTenant>(key)).compile()
    if (column.key !== key) throw new Error('[Holo Panels] Import column callbacks must return the configured column.')
    return this.with({ columns: [...this.#state.columns, column] })
  }

  format<TOptions extends object>(adapter: ImportFormatAdapter<TOptions>, options: TOptions): this {
    assertIdentifier(adapter.id, 'import format ID')
    assertText(adapter.label, 'Import format label')
    if (this.#state.formats.some(format => format.id === adapter.id)) {
      throw new Error(`[Holo Panels] Import format "${adapter.id}" is duplicated.`)
    }
    const compiled: CompiledImportFormat = Object.freeze({
      id: adapter.id,
      inspect: (source: TransferInputSource) => adapter.inspect(source, options),
      label: adapter.label,
      readChunk: (source: TransferInputSource, offset: number, limit: number) => adapter.readChunk(source, options, offset, limit),
    })
    return this.with({ formats: [...this.#state.formats, compiled] })
  }

  limits(limits: ImportLimits): this {
    for (const [name, value] of Object.entries(limits)) assertPositiveInteger(value, `Import ${name}`)
    return this.with({ limits: Object.freeze({ ...limits }) })
  }

  chunkSize(rows: number): this {
    assertPositiveInteger(rows, 'Import chunk size')
    return this.with({ chunkSize: rows })
  }

  queue(configuration: TransferQueueConfiguration): this {
    return this.with({ queue: normalizeQueueConfiguration(configuration) })
  }

  storage(configuration: TransferStorageConfiguration): this {
    return this.with({ storage: normalizeStorageConfiguration(configuration) })
  }

  retention(configuration: TransferRetentionConfiguration): this {
    assertPositiveInteger(configuration.artifactMilliseconds, 'Artifact retention')
    assertPositiveInteger(configuration.operationMilliseconds, 'Operation retention')
    return this.with({ retention: Object.freeze({ ...configuration }) })
  }

  authorize(policy: TransferPolicy<TActor, TTenant>): this {
    return this.with({ authorize: policy })
  }

  authorizeCancellation(policy: TransferPolicy<TActor, TTenant>): this {
    return this.with({ authorizeCancellation: policy })
  }

  mutation(adapter: ImportMutationAdapter<TRecord, TValues, TActor, TTenant>): this {
    return this.with({ mutation: adapter })
  }

  compile(): ImporterDefinition<TRecord, TValues, TActor, TTenant> {
    if (this.#compiled) return this.#compiled
    const state = this.#state
    if (state.columns.length === 0) throw new Error('[Holo Panels] Importers require at least one column.')
    if (state.formats.length === 0) throw new Error('[Holo Panels] Importers require at least one format.')
    if (!state.mutation) throw new Error('[Holo Panels] Importers require a mutation adapter.')
    if (state.chunkSize > state.limits.maxRows) throw new Error('[Holo Panels] Import chunk size cannot exceed the maximum rows.')
    const client = Object.freeze({
      columns: Object.freeze(state.columns.map(({ example, key, label, required }) => Object.freeze({ example, key, label, required }))),
      formatIds: Object.freeze(state.formats.map(format => format.id)),
      id: state.id,
      kind: 'import' as const,
      label: state.label,
      maxFileBytes: state.limits.maxFileBytes,
      maxRows: state.limits.maxRows,
      resourceId: state.resourceId,
    })
    this.#compiled = Object.freeze({
      client,
      discoveryMarker: DISCOVERY_MARKER,
      id: state.id,
      kind: 'import' as const,
      resourceId: state.resourceId,
      server: Object.freeze({
        authorize: state.authorize,
        authorizeCancellation: state.authorizeCancellation,
        chunkSize: state.chunkSize,
        columns: Object.freeze([...state.columns]),
        formats: Object.freeze([...state.formats]),
        limits: state.limits,
        mutation: state.mutation,
        queue: state.queue,
        retention: state.retention,
        storage: state.storage,
      }),
    })
    return this.#compiled
  }

  compileDiscoveryDefinition(): ImporterDefinition<TRecord, TValues, TActor, TTenant> {
    return this.compile()
  }

  private with(patch: Partial<ImporterState<TRecord, TValues, TActor, TTenant>>): this {
    this.assertMutable()
    this.#state = { ...this.#state, ...patch }
    return this
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('[Holo Panels] A compiled importer cannot be modified.')
  }
}

interface ExportColumnState<TRecord, TValue extends ExportCell, TActor extends object, TTenant> {
  readonly aggregate?: { readonly column?: string, readonly kind: ExportAggregateKind, readonly relation: string }
  readonly id: string
  readonly label: string
  readonly path?: ExportRecordPath<TRecord>
  readonly relation?: ExportRelationPath<TRecord>
  readonly visibleByDefault: boolean
  readonly state?: (context: ExportColumnBatchContext<TRecord, TActor, TTenant>) => readonly TValue[] | Promise<readonly TValue[]>
  readonly options?: (context: ExportColumnBatchValueContext<TRecord, TValue, TActor, TTenant>) => readonly ExportColumnOption<TValue>[] | Promise<readonly ExportColumnOption<TValue>[]>
  readonly format?: (context: ExportColumnBatchValueContext<TRecord, TValue, TActor, TTenant>) => readonly ExportCell[] | Promise<readonly ExportCell[]>
}

export class ExportColumnBuilder<TRecord, TValue extends ExportCell, TActor extends object, TTenant> {
  #compiled?: CompiledExportColumn<TRecord, TActor, TTenant>
  #state: ExportColumnState<TRecord, TValue, TActor, TTenant>

  constructor(id: string, path?: ExportRecordPath<TRecord>, state?: ExportColumnState<TRecord, TValue, TActor, TTenant>) {
    this.#state = state ?? { id, label: id, ...(path ? { path } : {}), visibleByDefault: true }
  }

  label(label: string): this {
    return this.with({ label: assertText(label, 'Export column label') })
  }

  visibleByDefault(visible = true): this {
    return this.with({ visibleByDefault: visible })
  }

  relation<TPath extends ExportRelationPath<TRecord>>(path: TPath): this {
    return this.with({ relation: path })
  }

  aggregate<TPath extends ExportRelationPath<TRecord>>(kind: ExportAggregateKind, relation: TPath, column?: string): this {
    return this.with({ aggregate: { ...(column ? { column } : {}), kind, relation } })
  }

  options(resolver: NonNullable<ExportColumnState<TRecord, TValue, TActor, TTenant>['options']>): this {
    return this.with({ options: resolver })
  }

  format(formatter: NonNullable<ExportColumnState<TRecord, TValue, TActor, TTenant>['format']>): this {
    return this.with({ format: formatter })
  }

  compile(): CompiledExportColumn<TRecord, TActor, TTenant> {
    if (this.#compiled) return this.#compiled
    const state = this.#state
    this.#compiled = Object.freeze({
      ...(state.aggregate ? { aggregate: state.aggregate } : {}),
      ...(state.format ? { format: state.format as CompiledExportColumn<TRecord, TActor, TTenant>['format'] } : {}),
      id: state.id,
      label: state.label,
      ...(state.options ? { options: state.options as CompiledExportColumn<TRecord, TActor, TTenant>['options'] } : {}),
      ...(state.path ? { path: state.path } : {}),
      ...(state.relation ? { relation: state.relation } : {}),
      ...(state.state ? { state: state.state as CompiledExportColumn<TRecord, TActor, TTenant>['state'] } : {}),
      visibleByDefault: state.visibleByDefault,
    })
    return this.#compiled
  }

  withState(state: NonNullable<ExportColumnState<TRecord, TValue, TActor, TTenant>['state']>): this {
    return this.with({ state })
  }

  private with(patch: Partial<ExportColumnState<TRecord, TValue, TActor, TTenant>>): this {
    this.assertMutable()
    this.#state = { ...this.#state, ...patch }
    return this
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('[Holo Panels] A compiled export column cannot be modified.')
  }
}

interface ExporterState<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant> {
  readonly authorize: TransferPolicy<TActor, TTenant>
  readonly authorizeCancellation: TransferPolicy<TActor, TTenant>
  readonly chunkSize: number
  readonly columns: readonly CompiledExportColumn<TRecord, TActor, TTenant>[]
  readonly formats: readonly CompiledExportFormat[]
  readonly id: string
  readonly label: string
  readonly maxRows: number
  readonly query?: ExportQueryAdapter<TQuery, TRecord, TRecordId, TActor, TTenant>
  readonly queue: TransferQueueConfiguration
  readonly resourceId: string
  readonly retention: TransferRetentionConfiguration
  readonly storage: TransferStorageConfiguration
}

export class ExporterBuilder<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant> {
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'export' as const
  #compiled?: ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant>
  #state: ExporterState<TQuery, TRecord, TRecordId, TActor, TTenant>

  constructor(id: string, resourceId: string, state?: ExporterState<TQuery, TRecord, TRecordId, TActor, TTenant>) {
    assertIdentifier(id, 'exporter ID')
    this.#state = state ?? {
      authorize: allow,
      authorizeCancellation: allow,
      chunkSize: 500,
      columns: [],
      formats: [],
      id,
      label: id,
      maxRows: 100_000,
      queue: defaultQueue,
      resourceId,
      retention: defaultRetention,
      storage: defaultStorage,
    }
  }

  get id(): string {
    return this.#state.id
  }

  label(label: string): this {
    return this.with({ label: assertText(label, 'Exporter label') })
  }

  column<const TPath extends ExportRecordPath<TRecord>>(
    id: string,
    path: TPath,
    configure?: (column: ExportColumnBuilder<TRecord, Extract<ExportPathValue<TRecord, TPath>, ExportCell>, TActor, TTenant>) => ExportColumnBuilder<TRecord, Extract<ExportPathValue<TRecord, TPath>, ExportCell>, TActor, TTenant>,
  ): this {
    return this.addColumn(id, configure ? configure(new ExportColumnBuilder(id, path)).compile() : new ExportColumnBuilder<TRecord, Extract<ExportPathValue<TRecord, TPath>, ExportCell>, TActor, TTenant>(id, path).compile())
  }

  computed<TValue extends ExportCell>(
    id: string,
    state: (context: ExportColumnBatchContext<TRecord, TActor, TTenant>) => readonly TValue[] | Promise<readonly TValue[]>,
    configure?: (column: ExportColumnBuilder<TRecord, TValue, TActor, TTenant>) => ExportColumnBuilder<TRecord, TValue, TActor, TTenant>,
  ): this {
    const initial = new ExportColumnBuilder<TRecord, TValue, TActor, TTenant>(id).withState(state)
    return this.addColumn(id, (configure ? configure(initial) : initial).compile())
  }

  query(adapter: ExportQueryAdapter<TQuery, TRecord, TRecordId, TActor, TTenant>): this {
    return this.with({ query: adapter })
  }

  format<TOptions extends object>(adapter: ExportFormatAdapter<TOptions>, options: TOptions): this {
    assertIdentifier(adapter.id, 'export format ID')
    assertText(adapter.label, 'Export format label')
    if (this.#state.formats.some(format => format.id === adapter.id)) throw new Error(`[Holo Panels] Export format "${adapter.id}" is duplicated.`)
    const compiled = Object.freeze({
      artifact: Object.freeze({ ...adapter.artifact }),
      id: adapter.id,
      label: adapter.label,
      write: (input: Parameters<CompiledExportFormat['write']>[0], output: Parameters<CompiledExportFormat['write']>[1]) => adapter.write(input, output, options),
    })
    return this.with({ formats: [...this.#state.formats, compiled] })
  }

  maxRows(rows: number): this {
    assertPositiveInteger(rows, 'Export maximum rows')
    return this.with({ maxRows: rows })
  }

  chunkSize(rows: number): this {
    assertPositiveInteger(rows, 'Export chunk size')
    return this.with({ chunkSize: rows })
  }

  queue(configuration: TransferQueueConfiguration): this { return this.with({ queue: normalizeQueueConfiguration(configuration) }) }
  storage(configuration: TransferStorageConfiguration): this { return this.with({ storage: normalizeStorageConfiguration(configuration) }) }
  retention(configuration: TransferRetentionConfiguration): this {
    assertPositiveInteger(configuration.artifactMilliseconds, 'Artifact retention')
    assertPositiveInteger(configuration.operationMilliseconds, 'Operation retention')
    return this.with({ retention: Object.freeze({ ...configuration }) })
  }
  authorize(policy: TransferPolicy<TActor, TTenant>): this { return this.with({ authorize: policy }) }
  authorizeCancellation(policy: TransferPolicy<TActor, TTenant>): this { return this.with({ authorizeCancellation: policy }) }

  compile(): ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant> {
    if (this.#compiled) return this.#compiled
    const state = this.#state
    if (state.columns.length === 0) throw new Error('[Holo Panels] Exporters require at least one column.')
    if (state.formats.length === 0) throw new Error('[Holo Panels] Exporters require at least one format.')
    if (!state.query) throw new Error('[Holo Panels] Exporters require a query adapter.')
    if (state.chunkSize > state.maxRows) throw new Error('[Holo Panels] Export chunk size cannot exceed the maximum rows.')
    const client = Object.freeze({
      columns: Object.freeze(state.columns.map(({ id, label, visibleByDefault }) => Object.freeze({ id, label, visibleByDefault }))),
      formatIds: Object.freeze(state.formats.map(format => format.id)),
      id: state.id,
      kind: 'export' as const,
      label: state.label,
      maxRows: state.maxRows,
      resourceId: state.resourceId,
    })
    this.#compiled = Object.freeze({
      client,
      discoveryMarker: DISCOVERY_MARKER,
      id: state.id,
      kind: 'export' as const,
      resourceId: state.resourceId,
      server: Object.freeze({
        authorize: state.authorize,
        authorizeCancellation: state.authorizeCancellation,
        chunkSize: state.chunkSize,
        columns: Object.freeze([...state.columns]),
        formats: Object.freeze([...state.formats]),
        maxRows: state.maxRows,
        query: state.query,
        queue: state.queue,
        retention: state.retention,
        storage: state.storage,
      }),
    })
    return this.#compiled
  }

  compileDiscoveryDefinition(): ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant> { return this.compile() }

  private addColumn(id: string, column: CompiledExportColumn<TRecord, TActor, TTenant>): this {
    assertIdentifier(id, 'export column ID')
    if (column.id !== id) throw new Error('[Holo Panels] Export column callbacks must return the configured column.')
    if (this.#state.columns.some(existing => existing.id === id)) throw new Error(`[Holo Panels] Export column "${id}" is duplicated.`)
    return this.with({ columns: [...this.#state.columns, column] })
  }

  private with(patch: Partial<ExporterState<TQuery, TRecord, TRecordId, TActor, TTenant>>): this {
    this.assertMutable()
    this.#state = { ...this.#state, ...patch }
    return this
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('[Holo Panels] A compiled exporter cannot be modified.')
  }
}

export function defineImporter<
  TModel extends { readonly definition: ResourceModelDefinition },
  TRecord extends ResourceRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
>(id: string, resource: ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>): ImporterBuilder<TRecord, TInput, TActor, TTenant> {
  return new ImporterBuilder(id, resource.id)
}

export function defineExporter<
  TModel extends { readonly definition: ResourceModelDefinition },
  TRecord extends ResourceRecord,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
>(id: string, resource: ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>): ExporterBuilder<
  TQuery,
  TRecord,
  TModel['definition']['primaryKey'] extends keyof TRecord
    ? Extract<TRecord[TModel['definition']['primaryKey']], TableRecordIdentifier>
    : TableRecordIdentifier,
  TActor,
  TTenant
> {
  return new ExporterBuilder(id, resource.id)
}
