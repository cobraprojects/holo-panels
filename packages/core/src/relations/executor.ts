import type { OptionPage, OptionQueryRequest, OptionValue } from '../fields/options'
import { OptionService, ResolverOptionSource } from '../fields/options'
import type {
  RelationManagerContext,
  RelationManagerDefinition,
  RelationListRequest,
  RelationOperation,
  RelationRecordPage,
} from './contracts'
import { toJsonValue } from '../protocol/serialization'

const columnPattern = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/u

export class RelationRecordNotFoundError extends Error {
  constructor() {
    super('The requested related record was not found for this owner.')
    this.name = 'RelationRecordNotFoundError'
  }
}

export class RelationOperationNotAllowedError extends Error {
  constructor(operation: RelationOperation) {
    super(`Relation operation "${operation}" is not allowed.`)
    this.name = 'RelationOperationNotAllowedError'
  }
}

export class RelationPivotInputError extends Error {
  constructor(field: string) {
    super(`Pivot input field "${field}" is not writable.`)
    this.name = 'RelationPivotInputError'
  }
}

export class RelationInputError extends Error {
  constructor(field: string) {
    super(`Related record input field "${field}" is not writable.`)
    this.name = 'RelationInputError'
  }
}

export class RelationListPaginationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RelationListPaginationError'
  }
}

function boundedInteger(value: unknown, fallback: number, maximum: number, name: string): number {
  const candidate = value ?? fallback
  if (!Number.isSafeInteger(candidate) || (candidate as number) < 1 || (candidate as number) > maximum) {
    throw new RelationListPaginationError(`${name} must be a safe integer from 1 through ${maximum}.`)
  }
  return candidate as number
}

function normalizeListRequest(request: RelationListRequest): Readonly<{
  filters: Readonly<Record<string, ReturnType<typeof toJsonValue>>>
  includeTotal: boolean
  page: number
  perPage: number
  search: string
  sort: readonly { readonly column: string, readonly direction: 'asc' | 'desc' }[]
}> {
  if (request === null || Array.isArray(request) || typeof request !== 'object') {
    throw new RelationListPaginationError('Relation list request must be an object.')
  }
  for (const key of Object.keys(request)) {
    if (!['filters', 'includeTotal', 'page', 'perPage', 'search', 'sort'].includes(key)) {
      throw new RelationListPaginationError(`Relation list request property "${key}" is not allowed.`)
    }
  }
  if (typeof request.includeTotal !== 'undefined' && typeof request.includeTotal !== 'boolean') {
    throw new RelationListPaginationError('includeTotal must be a boolean.')
  }
  if (typeof request.search !== 'undefined' && typeof request.search !== 'string') throw new RelationListPaginationError('search must be a string.')
  const search = request.search?.trim() ?? ''
  if (search.length > 500) throw new RelationListPaginationError('search must not exceed 500 characters.')
  if (request.filters !== undefined && (!request.filters || Array.isArray(request.filters) || typeof request.filters !== 'object')) {
    throw new RelationListPaginationError('filters must be an object.')
  }
  const filters = Object.freeze(Object.fromEntries(Object.entries(request.filters ?? {}).map(([key, value]) => {
    if (!columnPattern.test(key)) throw new RelationListPaginationError(`Invalid relation filter "${key}".`)
    return [key, toJsonValue(value)]
  })))
  if (request.sort !== undefined && !Array.isArray(request.sort)) throw new RelationListPaginationError('sort must be an array.')
  const sortColumns = new Set<string>()
  const sort = Object.freeze((request.sort ?? []).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !columnPattern.test(item.column) || !['asc', 'desc'].includes(item.direction) || sortColumns.has(item.column)) {
      throw new RelationListPaginationError('Relation sorting must use unique valid columns and directions.')
    }
    sortColumns.add(item.column)
    return Object.freeze({ column: item.column, direction: item.direction })
  }))
  return Object.freeze({
    filters,
    includeTotal: request.includeTotal ?? true,
    page: boundedInteger(request.page, 1, 1_000_000, 'page'),
    perPage: boundedInteger(request.perPage, 25, 100, 'perPage'),
    search,
    sort,
  })
}

function validateRecordPage<TRelated>(
  page: RelationRecordPage<TRelated>,
  request: Readonly<{ includeTotal: boolean, page: number, perPage: number }>,
): RelationRecordPage<TRelated> {
  if (page === null || Array.isArray(page) || typeof page !== 'object') {
    throw new RelationListPaginationError('Relation persistence must return a record page.')
  }
  if (!Array.isArray(page.records) || page.records.length > request.perPage) {
    throw new RelationListPaginationError('Relation persistence returned too many records.')
  }
  if (page.page !== request.page || page.perPage !== request.perPage || typeof page.hasMore !== 'boolean') {
    throw new RelationListPaginationError('Relation persistence returned mismatched page metadata.')
  }
  if (request.includeTotal) {
    if (!Number.isSafeInteger(page.total) || (page.total as number) < 0) {
      throw new RelationListPaginationError('Relation persistence must return a non-negative safe total.')
    }
    if (page.hasMore && request.page * request.perPage >= (page.total as number)) {
      throw new RelationListPaginationError('Relation persistence returned inconsistent continuation metadata.')
    }
  } else if (typeof page.total !== 'undefined') {
    throw new RelationListPaginationError('Relation persistence returned an unrequested total.')
  }
  return Object.freeze({
    hasMore: page.hasMore,
    page: page.page,
    perPage: page.perPage,
    records: Object.freeze([...page.records]),
    ...(typeof page.total === 'number' ? { total: page.total } : {}),
  })
}

export class RelationManagerExecutor<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  readonly #definition: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>

  constructor(definition: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>) {
    this.#definition = definition
  }

  isVisible(context: RelationManagerContext<TOwner, TActor, TTenant>): boolean | Promise<boolean> {
    return this.#definition.visible(context)
  }

  badge(context: RelationManagerContext<TOwner, TActor, TTenant>): string | number | Promise<string | number> | null {
    return this.#definition.badge?.(context) ?? null
  }

  async list(
    request: RelationListRequest,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<RelationRecordPage<TRelated>> {
    this.assertOperation('list')
    await this.assertOwner('list', context)
    const normalized = normalizeListRequest(request)
    const page = await this.#definition.persistence.list(this.createScopedQuery(context), normalized)
    if (context.signal.aborted) throw context.signal.reason
    return validateRecordPage(page, normalized)
  }

  async view(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated> {
    this.assertOperation('view')
    await this.assertOwner('view', context)
    return this.resolveAuthorized(id, 'view', context)
  }

  async resolveActionRecord(id: TValue, operation: RelationOperation, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated> {
    await this.assertOwner(operation, context)
    return this.resolveAuthorized(id, operation, context)
  }

  async create(input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated> {
    this.assertOperation('create')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('create', context)
      this.assertInput(input)
      await this.#definition.inputValidation?.validate(input, context)
      const related = await this.#definition.persistence.create(input, context)
      await this.#definition.authorization.authorizeRelated('create', related, context)
      return related
    })
  }

  async edit(id: TValue, input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated> {
    this.assertOperation('edit')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('edit', context)
      const related = await this.resolveAuthorized(id, 'edit', context)
      this.assertInput(input)
      await this.#definition.inputValidation?.validate(input, context)
      return this.#definition.persistence.update(related, input, context)
    })
  }

  async delete(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('delete')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('delete', context)
      const related = await this.resolveAuthorized(id, 'delete', context)
      await this.#definition.persistence.delete(related, context)
    })
  }

  async associate(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('associate')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('associate', context)
      const related = await this.resolveOption(id, context)
      await this.#definition.authorization.authorizeRelated('associate', related, context)
      await this.#definition.persistence.associate?.(related, context)
    })
  }

  async dissociate(id: TValue | undefined, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('dissociate')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('dissociate', context)
      const related = typeof id === 'undefined' ? undefined : await this.resolveAuthorized(id, 'dissociate', context)
      await this.#definition.persistence.dissociate?.(related, context)
    })
  }

  async attach(id: TValue, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('attach')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('attach', context)
      const related = await this.resolveOption(id, context)
      await this.#definition.authorization.authorizeRelated('attach', related, context)
      this.assertPivotInput(pivot)
      await this.#definition.pivotValidation?.validate(pivot, context)
      await this.#definition.persistence.attach?.(related, pivot, context)
    })
  }

  async detach(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('detach')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('detach', context)
      const related = await this.resolveAuthorized(id, 'detach', context)
      await this.#definition.persistence.detach?.(related, context)
    })
  }

  async editPivot(id: TValue, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void> {
    this.assertOperation('editPivot')
    return this.#definition.transaction.run(async () => {
      await this.assertOwner('editPivot', context)
      const related = await this.resolveAuthorized(id, 'editPivot', context)
      this.assertPivotInput(pivot)
      await this.#definition.pivotValidation?.validate(pivot, context)
      await this.#definition.persistence.updatePivot?.(related, pivot, context)
    })
  }

  optionService(): OptionService<TValue, RelationManagerContext<TOwner, TActor, TTenant>> {
    const persistence = this.#definition.persistence
    if (!persistence.listOptions || !persistence.hydrateOptions || !persistence.optionValue || !persistence.optionLabel) {
      throw new Error('[Holo Panels] Relation option selection is not configured.')
    }
    return new OptionService(new ResolverOptionSource(
      async (request, context, signal): Promise<OptionPage<TValue>> => {
        await this.assertOwner('select', context)
        const page = await persistence.listOptions!(request, context, signal)
        return {
          options: page.records.map(record => ({
            value: persistence.optionValue!(record),
            label: persistence.optionLabel!(record),
          })),
          page: page.page,
          perPage: page.perPage,
          hasMore: page.hasMore,
          ...(typeof page.total === 'number' ? { total: page.total } : {}),
        }
      },
      async (request, selected, context, signal) => {
        await this.assertOwner('select', context)
        const records = await persistence.hydrateOptions!(request, selected, context, signal)
        return records.map(record => ({
          value: persistence.optionValue!(record),
          label: persistence.optionLabel!(record),
        }))
      },
    ))
  }

  private assertOperation(operation: RelationOperation): void {
    if (!this.#definition.operations.includes(operation)) throw new RelationOperationNotAllowedError(operation)
  }

  private async assertOwner(
    operation: RelationOperation,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<void> {
    if (context.signal.aborted) throw context.signal.reason
    await this.#definition.authorization.authorizeOwner(operation, context)
  }

  private createScopedQuery(context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery {
    const persistence = this.#definition.persistence
    let query = persistence.createQuery(context)
    query = persistence.scopeToOwner(query, context)
    query = persistence.applyTenantScope(query, context)
    return persistence.applyAuthorizationScope(query, context)
  }

  private async resolveAuthorized(
    id: TValue,
    operation: RelationOperation,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<TRelated> {
    const related = await this.#definition.persistence.find(this.createScopedQuery(context), id)
    if (!related) throw new RelationRecordNotFoundError()
    await this.#definition.authorization.authorizeRelated(operation, related, context)
    return related
  }

  private async resolveOption(
    id: TValue,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<TRelated> {
    const persistence = this.#definition.persistence
    if (!persistence.hydrateOptions || !persistence.optionValue) {
      throw new Error('[Holo Panels] Relation option selection is not configured.')
    }
    const request: OptionQueryRequest<TValue> = {
      panelId: 'relation.manager',
      resourceId: this.#definition.id,
      fieldId: 'relation',
      tenantKey: String(context.tenant),
      locale: 'en',
      dependencies: {},
      search: '',
      page: 1,
      perPage: 1,
      selectedValues: [id],
    }
    const records = await persistence.hydrateOptions(request, [id], context, context.signal)
    const related = records.find(record => persistence.optionValue!(record) === id)
    if (!related) throw new RelationRecordNotFoundError()
    return related
  }

  private assertPivotInput(pivot: TPivot): void {
    const writable = new Set<string>(this.#definition.writablePivotFields)
    for (const field of Object.keys(pivot)) {
      if (!writable.has(field)) throw new RelationPivotInputError(field)
    }
  }

  private assertInput(input: TInput): void {
    const writable = new Set<string>(this.#definition.writableInputFields)
    for (const field of Object.keys(input)) {
      if (!writable.has(field)) throw new RelationInputError(field)
    }
  }
}
