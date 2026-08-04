import { assertJsonSafe } from '../../protocol/serialization'
import type { FieldResolverContext, FormFieldPath } from '../base'
import type {
  ChoiceOption,
  HoloOptionQuery,
  OptionPage,
  OptionQueryRequest,
  OptionServiceLimits,
  OptionSource,
  OptionValue,
  RelationshipOptionAdapter,
  RelationshipOptionQueryModifier,
} from './contracts'

const identifierPattern = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu
const defaultLimits = Object.freeze({
  maxPage: 10_000,
  maxPerPage: 100,
  maxSearchLength: 250,
  maxSelectedValues: 500,
  maxLabelLength: 500,
})

function assertIdentifier(value: string, name: string): void {
  if (!identifierPattern.test(value)) throw new Error(`[Holo Panels] Invalid option ${name} "${value}".`)
}

function assertLogicalIdentifier(value: string, name: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/iu.test(value)) throw new Error(`[Holo Panels] Invalid option ${name} "${value}".`)
}

function assertValue(value: OptionValue): void {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('[Holo Panels] Invalid option value.')
  }
}

function normalizeLabel(value: string, maximum: number): string {
  const label = value.trim()
  if (!label || label.length > maximum) throw new Error(`[Holo Panels] Option labels must contain 1 to ${maximum} characters.`)
  return label
}

function normalizeOption<TValue extends OptionValue>(option: ChoiceOption<TValue>, maximumLabelLength: number): ChoiceOption<TValue> {
  assertValue(option.value)
  return Object.freeze({
    value: option.value,
    label: normalizeLabel(option.label, maximumLabelLength),
    ...(option.disabled ? { disabled: true } : {}),
  })
}

function normalizeOptions<TValue extends OptionValue>(options: readonly ChoiceOption<TValue>[], maximumLabelLength: number): readonly ChoiceOption<TValue>[] {
  const values = new Set<OptionValue>()
  return Object.freeze(options.map(option => {
    const normalized = normalizeOption(option, maximumLabelLength)
    if (values.has(normalized.value)) throw new Error(`[Holo Panels] Duplicate option value "${String(normalized.value)}".`)
    values.add(normalized.value)
    return normalized
  }))
}

function escapeSearch(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function tenantCacheKey(context: unknown): string | null {
  if (context === null || typeof context !== 'object') return null
  const value = Reflect.get(context, 'tenantCacheKey') ?? Reflect.get(context, 'cacheKey')
  return typeof value === 'string' ? value : null
}

export class OptionService<TValue extends OptionValue, TContext> {
  readonly #source: OptionSource<TValue, TContext>
  readonly #limits: Required<OptionServiceLimits>

  constructor(source: OptionSource<TValue, TContext>, limits: OptionServiceLimits = {}) {
    this.#source = source
    this.#limits = Object.freeze({ ...defaultLimits, ...limits })
  }

  async list(request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal): Promise<OptionPage<TValue>> {
    this.validateRequest(request)
    this.validateTenantContext(request, context)
    const page = await this.#source.list(request, context, signal)
    if (page.page !== request.page || page.perPage !== request.perPage) {
      throw new Error('[Holo Panels] Option source returned mismatched pagination metadata.')
    }
    if (page.options.length > request.perPage) throw new Error('[Holo Panels] Option source exceeded the requested page size.')
    if (typeof page.total === 'number' && (!Number.isSafeInteger(page.total) || page.total < 0)) {
      throw new Error('[Holo Panels] Option source returned an invalid total.')
    }
    return Object.freeze({ ...page, options: normalizeOptions(page.options, this.#limits.maxLabelLength) })
  }

  async hydrateSelected(
    request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    context: TContext,
    signal?: AbortSignal,
  ): Promise<readonly ChoiceOption<TValue>[]> {
    this.validateRequest(request)
    this.validateTenantContext(request, context)
    this.validateSelected(selectedValues)
    const options = normalizeOptions(
      await this.#source.hydrateSelected(request, selectedValues, context, signal),
      this.#limits.maxLabelLength,
    )
    const requested = new Set<OptionValue>(selectedValues)
    if (options.some(option => !requested.has(option.value))) {
      throw new Error('[Holo Panels] Option source returned an unrequested selected value.')
    }
    return options
  }

  async validateSubmission(
    request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    context: TContext,
    signal?: AbortSignal,
  ): Promise<readonly ChoiceOption<TValue>[]> {
    const options = await this.hydrateSelected(request, selectedValues, context, signal)
    const available = new Set<OptionValue>(options.filter(option => !option.disabled).map(option => option.value))
    if (selectedValues.some(value => !available.has(value))) {
      throw new Error('[Holo Panels] One or more selected options are unavailable or unauthorized.')
    }
    return options
  }

  async create(label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>> {
    this.validateRequest(request)
    this.validateTenantContext(request, context)
    if (!this.#source.create) throw new Error('[Holo Panels] Creating options is disabled for this field.')
    return normalizeOption(await this.#source.create(normalizeLabel(label, this.#limits.maxLabelLength), request, context), this.#limits.maxLabelLength)
  }

  async edit(value: TValue, label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>> {
    this.validateRequest(request)
    this.validateTenantContext(request, context)
    assertValue(value)
    if (!this.#source.edit) throw new Error('[Holo Panels] Editing options is disabled for this field.')
    const option = normalizeOption(await this.#source.edit(value, normalizeLabel(label, this.#limits.maxLabelLength), request, context), this.#limits.maxLabelLength)
    if (option.value !== value) throw new Error('[Holo Panels] Edited option identity cannot change.')
    return option
  }

  private validateRequest(request: OptionQueryRequest<TValue>): void {
    for (const [name, value] of Object.entries({
      panel: request.panelId,
      resource: request.resourceId,
      field: request.fieldId,
    })) assertLogicalIdentifier(value, `${name} identifier`)
    if (!request.tenantKey.trim() || request.tenantKey.length > 256 || !request.locale.trim() || request.locale.length > 100) {
      throw new Error('[Holo Panels] Option tenant and locale context are invalid.')
    }
    Intl.getCanonicalLocales(request.locale)
    assertJsonSafe(request.dependencies)
    if (!Number.isSafeInteger(request.page) || request.page < 1 || request.page > this.#limits.maxPage) {
      throw new Error(`[Holo Panels] Option page must be an integer from 1 to ${this.#limits.maxPage}.`)
    }
    if (!Number.isSafeInteger(request.perPage) || request.perPage < 1 || request.perPage > this.#limits.maxPerPage) {
      throw new Error(`[Holo Panels] Option page size must be an integer from 1 to ${this.#limits.maxPerPage}.`)
    }
    if (request.search.length > this.#limits.maxSearchLength) {
      throw new Error(`[Holo Panels] Option search exceeds the ${this.#limits.maxSearchLength} character limit.`)
    }
    if (request.selectedValues) this.validateSelected(request.selectedValues)
  }

  private validateTenantContext(request: OptionQueryRequest<TValue>, context: TContext): void {
    const trustedTenantKey = tenantCacheKey(context)
    if (trustedTenantKey !== null && request.tenantKey !== trustedTenantKey) {
      throw new Error('[Holo Panels] Option tenant context is stale or invalid.')
    }
  }

  private validateSelected(values: readonly TValue[]): void {
    if (values.length > this.#limits.maxSelectedValues) {
      throw new Error(`[Holo Panels] Selected options exceed the ${this.#limits.maxSelectedValues} value limit.`)
    }
    const seen = new Set<OptionValue>()
    for (const value of values) {
      assertValue(value)
      if (seen.has(value)) throw new Error(`[Holo Panels] Duplicate selected option "${String(value)}".`)
      seen.add(value)
    }
  }
}

export class StaticOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
  readonly kind = 'static'
  readonly #options: readonly ChoiceOption<TValue>[]

  constructor(options: readonly ChoiceOption<TValue>[]) {
    this.#options = normalizeOptions(options, defaultLimits.maxLabelLength)
  }

  async list(request: OptionQueryRequest<TValue>, _context: TContext): Promise<OptionPage<TValue>> {
    const search = request.search.trim().toLocaleLowerCase(request.locale)
    const matching = search ? this.#options.filter(option => option.label.toLocaleLowerCase(request.locale).includes(search)) : this.#options
    const offset = (request.page - 1) * request.perPage
    return Object.freeze({
      options: Object.freeze(matching.slice(offset, offset + request.perPage)),
      page: request.page,
      perPage: request.perPage,
      hasMore: offset + request.perPage < matching.length,
      total: matching.length,
    })
  }

  async hydrateSelected(
    _request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    _context: TContext,
  ): Promise<readonly ChoiceOption<TValue>[]> {
    const selected = new Set<OptionValue>(selectedValues)
    return Object.freeze(this.#options.filter(option => selected.has(option.value)))
  }
}

export type OptionResolver<TValue extends OptionValue, TContext> = (
  request: OptionQueryRequest<TValue>,
  context: TContext,
  signal?: AbortSignal,
) => Promise<OptionPage<TValue>>

export type SelectedOptionResolver<TValue extends OptionValue, TContext> = (
  request: OptionQueryRequest<TValue>,
  selectedValues: readonly TValue[],
  context: TContext,
  signal?: AbortSignal,
) => Promise<readonly ChoiceOption<TValue>[]>

export class ResolverOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
  readonly kind = 'resolver'

  constructor(
    readonly resolve: OptionResolver<TValue, TContext>,
    readonly resolveSelected: SelectedOptionResolver<TValue, TContext>,
  ) {}

  list(request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal): Promise<OptionPage<TValue>> {
    return this.resolve(request, context, signal)
  }

  hydrateSelected(
    request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    context: TContext,
    signal?: AbortSignal,
  ): Promise<readonly ChoiceOption<TValue>[]> {
    return this.resolveSelected(request, selectedValues, context, signal)
  }
}

export interface CustomOptionSourceHandlers<TValue extends OptionValue, TContext> {
  readonly list: OptionSource<TValue, TContext>['list']
  readonly hydrateSelected: OptionSource<TValue, TContext>['hydrateSelected']
  readonly create?: OptionSource<TValue, TContext>['create']
  readonly edit?: OptionSource<TValue, TContext>['edit']
}

export class CustomOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
  readonly kind = 'custom'
  readonly list: OptionSource<TValue, TContext>['list']
  readonly hydrateSelected: OptionSource<TValue, TContext>['hydrateSelected']
  readonly create?: OptionSource<TValue, TContext>['create']
  readonly edit?: OptionSource<TValue, TContext>['edit']

  constructor(handlers: CustomOptionSourceHandlers<TValue, TContext>) {
    this.list = handlers.list
    this.hydrateSelected = handlers.hydrateSelected
    this.create = handlers.create
    this.edit = handlers.edit
  }
}

interface RelationshipConstraint<TValues> {
  readonly dependency: FormFieldPath<TValues>
  readonly column: string
}

export class RelationshipOptionSource<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TRecord,
  TQuery extends HoloOptionQuery<TQuery, TOptionRecord>,
  TOptionRecord,
  TValue extends OptionValue,
  TContext extends FieldResolverContext<TValues, TPath, TRecord>,
> implements OptionSource<TValue, TContext> {
  readonly kind = 'relationship'
  readonly #adapter: RelationshipOptionAdapter<TQuery, TOptionRecord, TValue, TContext>
  readonly #modifiers: readonly RelationshipOptionQueryModifier<TValues, TPath, TRecord, TQuery>[]
  readonly #constraints: readonly RelationshipConstraint<TValues>[]

  constructor(
    adapter: RelationshipOptionAdapter<TQuery, TOptionRecord, TValue, TContext>,
    modifiers: readonly RelationshipOptionQueryModifier<TValues, TPath, TRecord, TQuery>[] = [],
    constraints: readonly RelationshipConstraint<TValues>[] = [],
  ) {
    assertIdentifier(adapter.valueColumn, 'value column')
    assertIdentifier(adapter.labelColumn, 'label column')
    for (const column of adapter.searchColumns) assertIdentifier(column, 'search column')
    this.#adapter = adapter
    this.#modifiers = modifiers
    this.#constraints = constraints
  }

  optionsQuery(modifier: RelationshipOptionQueryModifier<TValues, TPath, TRecord, TQuery>): RelationshipOptionSource<TValues, TPath, TRecord, TQuery, TOptionRecord, TValue, TContext> {
    return new RelationshipOptionSource(this.#adapter, [...this.#modifiers, modifier], this.#constraints)
  }

  constrainedBy<TDependencyPath extends FormFieldPath<TValues>>(
    dependency: TDependencyPath,
    column: string,
  ): RelationshipOptionSource<TValues, TPath, TRecord, TQuery, TOptionRecord, TValue, TContext> {
    assertIdentifier(column, 'constraint column')
    return new RelationshipOptionSource(this.#adapter, this.#modifiers, [...this.#constraints, { dependency, column }])
  }

  async list(request: OptionQueryRequest<TValue>, context: TContext): Promise<OptionPage<TValue>> {
    let query = this.scopedQuery(context)
    const search = request.search.trim()
    if (search) {
      if (this.#adapter.searchColumns.length === 0) throw new Error('[Holo Panels] Relationship options are not searchable.')
      query = query.whereAny(this.#adapter.searchColumns, 'like', `%${escapeSearch(search)}%`)
    }
    query = query.orderBy(this.#adapter.labelColumn, 'asc')
    const page = await query.paginate(request.perPage, request.page)
    return Object.freeze({
      options: Object.freeze(page.data.map(record => this.option(record))),
      page: page.meta.currentPage,
      perPage: page.meta.perPage,
      hasMore: page.meta.hasMorePages,
      total: page.meta.total,
    })
  }

  async hydrateSelected(
    _request: OptionQueryRequest<TValue>,
    selectedValues: readonly TValue[],
    context: TContext,
  ): Promise<readonly ChoiceOption<TValue>[]> {
    if (selectedValues.length === 0) return Object.freeze([])
    const records = await this.scopedQuery(context).whereIn(this.#adapter.valueColumn, selectedValues).get()
    return Object.freeze(records.map(record => this.option(record)))
  }

  async create(label: string, _request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>> {
    if (!this.#adapter.create) throw new Error('[Holo Panels] Creating relationship options is disabled.')
    return this.option(await this.#adapter.create(label, context))
  }

  async edit(value: TValue, label: string, _request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>> {
    if (!this.#adapter.edit) throw new Error('[Holo Panels] Editing relationship options is disabled.')
    return this.option(await this.#adapter.edit(value, label, context))
  }

  private scopedQuery(context: TContext): TQuery {
    let query = this.#adapter.applyAuthorizationScope(this.#adapter.createQuery(context), context)
    query = this.#adapter.applyTenantScope(query, context)
    for (const constraint of this.#constraints) {
      const value = context.get(constraint.dependency)
      try {
        assertJsonSafe(value)
      } catch {
        throw new Error(`[Holo Panels] Dependency "${constraint.dependency}" is not query-safe.`)
      }
      query = query.where(constraint.column, value)
    }
    for (const modifier of this.#modifiers) {
      query = modifier({ query, field: context, get: path => context.get(path) })
    }
    return query
  }

  private option(record: TOptionRecord): ChoiceOption<TValue> {
    return Object.freeze({
      value: this.#adapter.value(record),
      label: this.#adapter.label(record),
      ...(this.#adapter.disabled?.(record) ? { disabled: true } : {}),
    })
  }
}
