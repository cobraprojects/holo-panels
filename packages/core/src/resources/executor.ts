import { DB } from '@holo-js/db'
import type { JsonObject } from '../protocol/json'
import { TableQueryExecutor, type HoloTableQuery, type TableQueryColumnDefinition, type TableQueryFilterDefinition, type TableQueryState } from '../tables/query'
import type {
  ResourceAuthorization,
  ResourceDefinition,
  ResourceExecutionContext,
  ResourceIdentifier,
  ResourceModel,
  ResourceModelDefinition,
  ResourceParentRegistry,
  ResourceQuery,
  ResourceRecord,
  ResourceTransaction,
} from './contracts'
import { serializeResourceRecord } from './resource-serialization'
import { authorizeHoloPolicy } from './holo-authorization'

export class ResourceRecordNotFoundError extends Error {
  constructor() {
    super('The requested resource record was not found.')
    this.name = 'ResourceRecordNotFoundError'
  }
}

export class ResourceInputError extends Error {
  constructor(attribute: string) {
    super(`Resource input attribute "${attribute}" is not writable.`)
    this.name = 'ResourceInputError'
  }
}

function createHoloAuthorization<TModel, TRecord extends object, TActor extends object>(strict: boolean): ResourceAuthorization<TModel, TRecord, TActor> {
  return {
    async authorizeClass(actor, operation, model): Promise<void> {
      await authorizeHoloPolicy(actor, operation, model as TModel & { readonly definition: { readonly name: string }, query(): { first(): Promise<object | undefined>, firstOrFail(): Promise<object> } }, strict)
    },
    async authorizeRecord(actor, operation, record): Promise<void> {
      await authorizeHoloPolicy(actor, operation, record, strict)
    },
  }
}

function createHoloTransaction(model: { getConnectionName(): string | undefined }): ResourceTransaction {
  return {
    run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
      const connectionName = model.getConnectionName()
      return connectionName
        ? DB.writeTransaction(async () => operation(), connectionName)
        : DB.writeTransaction(async () => operation())
    },
  }
}

export interface ResourceNestedExecution<TActor extends object, TTenant> {
  readonly parentIdentifier: ResourceIdentifier
  readonly registry: ResourceParentRegistry<TActor, TTenant>
}

export interface ResourceExecutorOptions<TModel, TRecord extends object, TActor extends object, TTenant> {
  readonly authorization?: ResourceAuthorization<TModel, TRecord, TActor>
  readonly nested?: ResourceNestedExecution<TActor, TTenant>
  readonly strictAuthorization?: boolean
  readonly transaction?: ResourceTransaction
}

export interface ResourceMutationResult<TRecord> {
  readonly record: TRecord
  readonly redirect: string | null
}

export interface ResourceTableResult {
  readonly hasMore: boolean
  readonly page: number
  readonly perPage: number
  readonly records: readonly Readonly<Record<string, unknown>>[]
  readonly recordPresentations?: readonly JsonObject[]
  readonly total: number
}

function tableMember(value: object | undefined, key: string): readonly object[] {
  if (!value || !(key in value)) return Object.freeze([])
  const member = Reflect.get(value, key)
  return Array.isArray(member) ? member.filter(item => item && typeof item === 'object') : Object.freeze([])
}

function camelCaseColumn(column: string): string {
  return column.replace(/_([a-z0-9])/gu, (_match, character: string) => character.toUpperCase())
}

function modelTenantBindings(
  definition: ResourceModelDefinition,
  bindings: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const columns = definition.table?.columns
  if (!columns) return bindings
  const normalized: Record<string, unknown> = {}
  for (const [binding, value] of Object.entries(bindings)) {
    const attribute: string = binding in columns ? binding : camelCaseColumn(binding)
    if (!(attribute in columns)) throw new Error(`Tenant binding "${binding}" does not match model "${definition.name}".`)
    if (attribute in normalized && normalized[attribute] !== value) throw new Error(`Tenant binding "${binding}" conflicts on model "${definition.name}".`)
    normalized[attribute] = value
  }
  return Object.freeze(normalized)
}

export class ResourceExecutor<
  TModel extends ResourceModel<TRecord, TQuery>,
  TRecord extends ResourceRecord,
  TQuery extends ResourceQuery<TQuery, TRecord>,
  TInput extends Readonly<Record<string, unknown>>,
  TActor extends object,
  TTenant,
  TSoftDeletes extends boolean,
> {
  readonly #authorization: ResourceAuthorization<TModel, TRecord, TActor>
  readonly #definition: ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>
  readonly #nestedExecution: ResourceNestedExecution<TActor, TTenant> | undefined
  readonly #transaction: ResourceTransaction

  constructor(
    definition: ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>,
    options: ResourceExecutorOptions<TModel, TRecord, TActor, TTenant> = {},
  ) {
    this.#definition = definition
    this.#authorization = options.authorization ?? createHoloAuthorization<TModel, TRecord, TActor>(options.strictAuthorization ?? false)
    this.#nestedExecution = options.nested
    this.#transaction = options.transaction ?? createHoloTransaction(definition.model)
  }

  async authorizeCreate(context: ResourceExecutionContext<TActor, TTenant>): Promise<void> {
    this.assertTenantScope(context)
    if (this.#definition.singular !== null) throw new Error('Singular resources do not support create operations.')
    await this.#authorization.authorizeClass(context.actor, 'create', this.#definition.model)
    await this.resolveNestedParent(context)
  }

  async authorizeViewAny(context: ResourceExecutionContext<TActor, TTenant>): Promise<void> {
    this.assertTenantScope(context)
    await this.#authorization.authorizeClass(context.actor, 'viewAny', this.#definition.model)
    await this.resolveNestedParent(context)
  }

  async authorizeUpdate(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<void> {
    await this.resolveAuthorized(id, 'update', context)
  }

  async create(input: TInput, context: ResourceExecutionContext<TActor, TTenant>): Promise<ResourceMutationResult<TRecord>> {
    this.assertMutable()
    this.assertTenantScope(context)
    if (this.#definition.singular !== null) throw new Error('Singular resources do not support create operations.')
    return this.#transaction.run(async () => {
      await this.#authorization.authorizeClass(context.actor, 'create', this.#definition.model)
      await this.resolveNestedParent(context)
      const clientInput = await this.prepareInput(input, context)
      const bindings = await this.#definition.createBindings?.(context) ?? {}
      const tenantBindings = this.#definition.shared ? {} : modelTenantBindings(this.#definition.model.definition, context.tenantBindings ?? {})
      const prepared = { ...clientInput, ...bindings, ...tenantBindings } as TInput
      await this.#definition.lifecycle.beforeCreate?.(prepared, context)
      await this.#definition.lifecycle.beforeSave?.(prepared, context)
      const record = this.#definition.persistence
        ? await this.#definition.persistence.create(prepared, context)
        : await this.#definition.model.unguarded(() => (this.#definition.model.create as (values: TInput) => Promise<TRecord>)(prepared))
      await this.#definition.lifecycle.afterCreate?.(record, context)
      await this.#definition.lifecycle.afterSave?.(record, context)
      return { record, redirect: await this.resolveRedirect(record, context) }
    })
  }

  async delete(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<void> {
    this.assertMutable()
    return this.#transaction.run(async () => {
      const record = await this.resolveAuthorized(id, 'delete', context)
      await this.#definition.lifecycle.beforeDelete?.(record, context)
      if (this.#definition.persistence) await this.#definition.persistence.delete(record, context)
      else await record.delete()
      await this.#definition.lifecycle.afterDelete?.(record, context)
    })
  }

  async forceDelete(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<void> {
    this.assertMutable()
    if (!this.#definition.softDeletes) throw new Error('This resource does not support force deletion.')
    return this.#transaction.run(async () => {
      const record = await this.resolveAuthorized(id, 'forceDelete', context, true)
      if (this.#definition.persistence) await this.#definition.persistence.forceDelete(record, context)
      else await record.forceDelete()
    })
  }

  async list(context: ResourceExecutionContext<TActor, TTenant>): Promise<readonly Readonly<Record<string, unknown>>[]> {
    await this.#authorization.authorizeClass(context.actor, 'viewAny', this.#definition.model)
    if (context.signal.aborted) throw context.signal.reason
    let query = await this.createScopedQuery(context, false)
    const eagerLoads = this.tableEagerLoads()
    const queryWithRelations = query as TQuery & { with?(relations: readonly string[]): TQuery }
    if (eagerLoads.length > 0 && queryWithRelations.with) query = queryWithRelations.with(eagerLoads)
    const listQuery = query as TQuery & { get?(): Promise<readonly TRecord[]> }
    if (!listQuery.get) throw new Error(`Resource "${this.#definition.id}" does not support collection queries.`)
    const records = await listQuery.get()
    return Object.freeze(await Promise.all(records.map(async record => {
      await this.#authorization.authorizeRecord(context.actor, 'view', record)
      return this.serializeRecord(record)
    })))
  }

  async table(state: TableQueryState, context: ResourceExecutionContext<TActor, TTenant>, presentRecord?: (record: TRecord) => Promise<JsonObject>): Promise<ResourceTableResult> {
    const executor = await this.tableExecutor(context)
    const result = await executor.execute(state, context)
    const records = Object.freeze(await Promise.all(result.records.map(async (record) => {
      await this.#authorization.authorizeRecord(context.actor, 'view', record)
      return this.serializeRecord(record)
    })))
    const recordPresentations = presentRecord ? await Promise.all(result.records.map(presentRecord)) : undefined
    const page = 'page' in result ? result.page : 1
    const perPage = 'perPage' in result ? result.perPage : records.length
    const total = 'total' in result && typeof result.total === 'number' ? result.total : records.length
    const hasMore = 'hasMore' in result ? result.hasMore : false
    return Object.freeze({ hasMore, page, perPage, records, ...(recordPresentations ? { recordPresentations: Object.freeze(recordPresentations) } : {}), total })
  }

  async selectTableRecords(state: TableQueryState, excludedRecordIds: readonly ResourceIdentifier[], context: ResourceExecutionContext<TActor, TTenant>): Promise<readonly ResourceIdentifier[]> {
    const executor = await this.tableExecutor(context)
    const records = await executor.executeSelection(state, { mode: 'all-matching', excludedRecordIds }, context, true)
    const identifiers = records.map(record => {
      const id: unknown = Reflect.get(record.toJSON(), this.#definition.routeKey)
      if (typeof id !== 'number' && typeof id !== 'string') throw new Error('Selected resource records require stable route identifiers')
      return id
    })
    const authorized: ResourceIdentifier[] = []
    for (let offset = 0; offset < identifiers.length; offset += 250) {
      const batch = identifiers.slice(offset, offset + 250)
      const resolved = await this.resolveActionRecords(batch, context)
      authorized.push(...batch.filter(id => resolved.has(id)))
    }
    return authorized
  }

  private async tableExecutor(context: ResourceExecutionContext<TActor, TTenant>) {
    await this.#authorization.authorizeClass(context.actor, 'viewAny', this.#definition.model)
    if (context.signal.aborted) throw context.signal.reason
    const scoped = await this.createScopedQuery(context, false)
    type RuntimeTableQuery = HoloTableQuery<RuntimeTableQuery, TRecord>
    const query = scoped as unknown as RuntimeTableQuery
    const columns: Record<string, TableQueryColumnDefinition> = {}
    const filters: Record<string, TableQueryFilterDefinition> = {}
    for (const column of tableMember(this.#definition.table, 'serverColumns')) {
      const manifestValue = Reflect.get(column, 'manifest')
      const manifest = manifestValue && typeof manifestValue === 'object' ? manifestValue : column
      const path = Reflect.get(manifest, 'path')
      if (typeof path !== 'string') continue
      const relation = path.includes('.') ? path.split('.')[0] : undefined
      columns[path] = Object.freeze({
        column: path,
        ...(relation ? { relation } : {}),
        searchable: Reflect.get(manifest, 'searchable') === true,
        sortable: Reflect.get(manifest, 'sortable') === true,
      })
      filters[path] = Object.freeze({ column: path, operators: Object.freeze(['=' as const]) })
    }
    for (const filter of tableMember(this.#definition.table, 'serverFilters')) {
      const definitions = Reflect.get(filter, 'queryDefinitions')
      if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) continue
      for (const [id, value] of Object.entries(definitions)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue
        const column = Reflect.get(value, 'column')
        const operators = Reflect.get(value, 'operators')
        if (typeof column !== 'string' || !Array.isArray(operators)) continue
        filters[id] = value as TableQueryFilterDefinition
      }
    }
    return new TableQueryExecutor<RuntimeTableQuery, TRecord, ResourceExecutionContext<TActor, TTenant>>({
      applyResourceScope: value => value,
      applyTenantScope: value => value,
      columns: Object.freeze(columns),
      createQuery: () => query,
      eagerLoads: this.tableEagerLoads(),
      filters: Object.freeze(filters),
      maxSelectionRecords: 10_000,
      primaryKey: this.#definition.routeKey,
    })
  }

  async restore(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<ResourceMutationResult<TRecord>> {
    this.assertMutable()
    if (!this.#definition.softDeletes) throw new Error('This resource does not support restoration.')
    return this.#transaction.run(async () => {
      const record = await this.resolveAuthorized(id, 'restore', context, true)
      const restored = this.#definition.persistence
        ? await this.#definition.persistence.restore(record, context)
        : await record.restore()
      return { record: restored, redirect: await this.resolveRedirect(restored, context) }
    })
  }

  async resolveActionRecord(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<TRecord | null> {
    try {
      return await this.resolveAuthorized(id, 'view', context)
    } catch (error) {
      if (error instanceof ResourceRecordNotFoundError) return null
      throw error
    }
  }

  async resolveActionRecords(ids: readonly ResourceIdentifier[], context: ResourceExecutionContext<TActor, TTenant>): Promise<ReadonlyMap<ResourceIdentifier, TRecord>> {
    if (ids.length === 0) return new Map()
    if (ids.length > 250) throw new Error('Action record batches cannot exceed 250 identifiers')
    await this.#authorization.authorizeClass(context.actor, 'viewAny', this.#definition.model)
    if (context.signal.aborted) throw context.signal.reason
    const query = await this.createScopedQuery(context, false)
    const batchQuery = query as TQuery & { whereIn(column: string, values: readonly ResourceIdentifier[]): TQuery, limit(size: number): TQuery, get(): Promise<readonly TRecord[]> }
    batchQuery.whereIn(this.#definition.routeKey, ids)
    batchQuery.limit(ids.length)
    const requested = new Map(ids.map(id => [String(id), id]))
    const authorized = new Map<ResourceIdentifier, TRecord>()
    for (const record of await batchQuery.get()) {
      if (context.signal.aborted) throw context.signal.reason
      const id = requested.get(String(Reflect.get(record.toJSON(), this.#definition.routeKey)))
      if (id === undefined) continue
      try {
        await this.#authorization.authorizeRecord(context.actor, 'view', record)
        authorized.set(id, record)
      } catch {
        if (context.signal.aborted) throw context.signal.reason
      }
    }
    return authorized
  }

  runInTransaction<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    return this.#transaction.run(operation)
  }

  async serialize(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<Readonly<Record<string, unknown>>> {
    const record = await this.resolveAuthorized(id, 'view', context)
    return this.serializeRecord(record)
  }

  private serializeRecord(record: TRecord): Readonly<Record<string, unknown>> {
    const serialized: Record<string, unknown> = { ...serializeResourceRecord(record) }
    for (const hidden of this.#definition.model.definition.hidden ?? []) delete serialized[hidden]
    return serialized
  }

  private tableEagerLoads(): readonly string[] {
    const table = this.#definition.table
    if (!table || !('serverColumns' in table) || !Array.isArray(table.serverColumns)) return Object.freeze([])
    const relations = table.serverColumns.flatMap(column => {
      if (!column || typeof column !== 'object' || !('manifest' in column) || !column.manifest || typeof column.manifest !== 'object') return []
      const path = Reflect.get(column.manifest, 'path')
      if (typeof path !== 'string' || !path.includes('.')) return []
      return [path.split('.')[0]!]
    })
    return Object.freeze([...new Set(relations)].sort())
  }

  async update(id: ResourceIdentifier, input: TInput, context: ResourceExecutionContext<TActor, TTenant>): Promise<ResourceMutationResult<TRecord>> {
    this.assertMutable()
    return this.#transaction.run(async () => {
      const record = await this.resolveAuthorized(id, 'update', context)
      const prepared = await this.prepareInput(input, context)
      await this.#definition.lifecycle.beforeSave?.(prepared, context)
      const saved = this.#definition.persistence
        ? await this.#definition.persistence.update(record, prepared, context)
        : await (record.update as (values: TInput) => Promise<TRecord>)(prepared)
      await this.#definition.lifecycle.afterSave?.(saved, context)
      return { record: saved, redirect: await this.resolveRedirect(saved, context) }
    })
  }

  private async createScopedQuery(context: ResourceExecutionContext<TActor, TTenant>, includeTrashed: boolean): Promise<TQuery> {
    let query = this.#definition.model.query()
    if (includeTrashed) {
      if (!query.withTrashed) throw new Error('This resource query does not support soft-deleted records.')
      query = query.withTrashed()
    }
    query = this.#definition.baseQuery(query, context)
    if (!this.#definition.shared) {
      if (this.#definition.tenantScope) query = this.#definition.tenantScope(query, context)
      else if (context.scopeTenantQuery) query = context.scopeTenantQuery(query)
      else throw new Error(`Resource "${this.#definition.id}" requires an authenticated tenant scope.`)
    }
    const parent = await this.resolveNestedParent(context)
    if (parent && this.#definition.nested) query = this.#definition.nested.options.scope(query, parent, context)
    return query
  }

  private assertMutable(): void {
    if (!this.#definition.capabilities.delete) throw new ResourceInputError('This resource is read-only.')
  }

  private assertTenantScope(context: ResourceExecutionContext<TActor, TTenant>): void {
    if (!this.#definition.shared && !this.#definition.tenantScope && !context.scopeTenantQuery) {
      throw new Error(`Resource "${this.#definition.id}" requires an authenticated tenant scope.`)
    }
  }

  private async prepareInput(input: TInput, context: ResourceExecutionContext<TActor, TTenant>): Promise<TInput> {
    this.assertWritableInput(input)
    let prepared = { ...input } as TInput
    if (this.#definition.lifecycle.beforeFill) prepared = await this.#definition.lifecycle.beforeFill(prepared, context)
    if (this.#definition.lifecycle.afterFill) prepared = await this.#definition.lifecycle.afterFill(prepared, context)
    this.assertWritableInput(prepared)
    await this.#definition.lifecycle.beforeValidate?.(prepared, context)
    await this.#definition.validation?.validate(prepared, context)
    await this.#definition.lifecycle.afterValidate?.(prepared, context)
    return prepared
  }

  private assertWritableInput(input: Readonly<Record<string, unknown>>): void {
    const allowed = new Set<string>(this.#definition.writableAttributes)
    for (const attribute of Object.keys(input)) {
      if (!allowed.has(attribute)) throw new ResourceInputError(attribute)
    }
  }

  private async resolveAuthorized(
    id: ResourceIdentifier,
    operation: 'delete' | 'forceDelete' | 'restore' | 'update' | 'view',
    context: ResourceExecutionContext<TActor, TTenant>,
    includeTrashed = false,
  ): Promise<TRecord> {
    await this.#authorization.authorizeClass(context.actor, 'viewAny', this.#definition.model)
    if (context.signal.aborted) throw context.signal.reason
    const query = await this.createScopedQuery(context, includeTrashed)
    if (this.#definition.singular !== null) {
      const record = await this.#definition.singular.resolve(query, context)
      if (!record) throw new ResourceRecordNotFoundError()
      await this.#authorization.authorizeRecord(context.actor, operation, record)
      return record
    }
    const constrained = (query as TQuery & {
      where(column: string, operator: '=', value: ResourceIdentifier): TQuery
    }).where(this.#definition.routeKey, '=', id)
    const record = await constrained.first()
    if (!record) throw new ResourceRecordNotFoundError()
    await this.#authorization.authorizeRecord(context.actor, operation, record)
    return record
  }

  private async resolveRedirect(record: TRecord, context: ResourceExecutionContext<TActor, TTenant>): Promise<string | null> {
    return await this.#definition.lifecycle.beforeRedirect?.(record, context) ?? null
  }

  private async resolveNestedParent(context: ResourceExecutionContext<TActor, TTenant>): Promise<ResourceRecord | null> {
    const nested = this.#definition.nested
    if (!nested) return null
    const execution = this.#nestedExecution
    if (!execution) throw new Error('Nested resource execution requires an authorized parent registry and parent identifier.')
    if (context.signal.aborted) throw context.signal.reason
    const parent = await execution.registry.resolveAuthorized(nested.parent, execution.parentIdentifier, context)
    if (!parent) throw new ResourceRecordNotFoundError()
    return parent
  }
}
