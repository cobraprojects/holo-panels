import { DB } from '@holo-js/db'
import { forUser } from '@holo-js/authorization'
import type {
  ResourceAuthorization,
  ResourceDefinition,
  ResourceExecutionContext,
  ResourceIdentifier,
  ResourceModel,
  ResourceParentRegistry,
  ResourceQuery,
  ResourceRecord,
  ResourceTransaction,
} from './contracts'

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

function createHoloAuthorization<TModel, TRecord extends object, TActor extends object>(): ResourceAuthorization<TModel, TRecord, TActor> {
  return {
    async authorizeClass(actor, operation, model): Promise<void> {
      await forUser(actor).authorize(operation, model as TModel & { readonly definition: { readonly name: string }, query(): { first(): Promise<object | undefined>, firstOrFail(): Promise<object> } })
    },
    async authorizeRecord(actor, operation, record): Promise<void> {
      await forUser(actor).authorize(operation, record)
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
  readonly transaction?: ResourceTransaction
}

export interface ResourceMutationResult<TRecord> {
  readonly record: TRecord
  readonly redirect: string | null
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
    this.#authorization = options.authorization ?? createHoloAuthorization<TModel, TRecord, TActor>()
    this.#nestedExecution = options.nested
    this.#transaction = options.transaction ?? createHoloTransaction(definition.model)
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
      const tenantBindings = this.#definition.shared ? {} : context.tenantBindings ?? {}
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

  async serialize(id: ResourceIdentifier, context: ResourceExecutionContext<TActor, TTenant>): Promise<Readonly<Record<string, unknown>>> {
    const record = await this.resolveAuthorized(id, 'view', context)
    const serialized: Record<string, unknown> = { ...record.toJSON() }
    for (const hidden of this.#definition.model.definition.hidden ?? []) delete serialized[hidden]
    return serialized
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
