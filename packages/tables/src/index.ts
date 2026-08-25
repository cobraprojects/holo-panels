import { createActionFactory, type ActionContract, type ActionFactory, type ActionGroup } from '@holo-js/panels-actions'
import {
  CheckboxColumn as CoreCheckboxColumn,
  ColorColumn as CoreColorColumn,
  IconColumn as CoreIconColumn,
  ImageColumn as CoreImageColumn,
  SelectColumn as CoreSelectColumn,
  TablesRenderHook,
  TextColumn as CoreTextColumn,
  TextInputColumn as CoreTextInputColumn,
  ToggleColumn as CoreToggleColumn,
  type JsonObject,
  type RelatedRecord,
  type RelationPath,
  type RecordPath,
  type RecordPathFor,
  type RecordPathValue,
  type RegisteredPanelRecordForPath,
  type RegisteredPanelRecordForPathValue,
  type RegisteredPanelRecordPath,
  type RegisteredPanelRecordPathFor,
  toJsonValue,
} from '@holo-js/panels-core'

export { TablesRenderHook }
import type { Schema } from '@holo-js/panels-schemas'

export type TableRecordPath<TRecord extends object> = RecordPath<TRecord>
export type TableRecordPathFor<TRecord extends object, TValue> = RecordPathFor<TRecord, TValue>
export type TableAction<TRecord extends object> = ActionContract<TRecord> | ActionGroup<ActionContract<TRecord>>
export type TableActionPosition = 'after-cells' | 'after-columns' | 'before-cells' | 'before-columns'
export type TablePaginationPageOption = 'all' | number
export type TableSortDirection = 'asc' | 'desc'

interface Compilable {
  compile(): object
}

export interface TableColumnContract<TRecord extends object> extends Compilable {
  readonly path: RecordPath<TRecord>
}

export interface TableFilterContract<TRecord extends object> extends Compilable {
  readonly resourceRecordType: TRecord
}

function compiledManifest(value: Compilable): object {
  const compiled = value.compile()
  if ('manifest' in compiled) {
    const manifest = Reflect.get(compiled, 'manifest')
    if (manifest && typeof manifest === 'object') return manifest
  }
  return compiled
}

type BoundRecordPath<TPath extends RegisteredPanelRecordPath> = Extract<TPath, RecordPath<RegisteredPanelRecordForPath<TPath>>>
type BoundValueRecordPath<TPath extends RegisteredPanelRecordPathFor<TValue>, TValue> = Extract<TPath, RecordPathFor<RegisteredPanelRecordForPathValue<TPath, TValue>, TValue>>
type SelectFilterValue<TRecord, TPath extends string> = Extract<NonNullable<RecordPathValue<TRecord, TPath>>, boolean | number | string> extends infer TValue
  ? [TValue] extends [never] ? string : TValue & (boolean | number | string)
  : string

export class TextColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreTextColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): TextColumn<RegisteredPanelRecordForPath<TPath>, BoundRecordPath<TPath>>
  static make<TRecord extends object, const TPath extends RecordPath<TRecord>>(path: TPath): TextColumn<TRecord, TPath>
  static make(path: string): unknown { return new TextColumn(path) }
}

export class IconColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreIconColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): IconColumn<RegisteredPanelRecordForPath<TPath>, BoundRecordPath<TPath>>
  static make<TRecord extends object, const TPath extends RecordPath<TRecord>>(path: TPath): IconColumn<TRecord, TPath>
  static make(path: string): unknown { return new IconColumn(path) }
}

export class ImageColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreImageColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<string>>(path: TPath): ImageColumn<RegisteredPanelRecordForPathValue<TPath, string>, BoundValueRecordPath<TPath, string>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageColumn<TRecord, TPath>
  static make(path: string): unknown { return new ImageColumn<Record<string, string>, string>(path) }
}

export class ColorColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreColorColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<string>>(path: TPath): ColorColumn<RegisteredPanelRecordForPathValue<TPath, string>, BoundValueRecordPath<TPath, string>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorColumn<TRecord, TPath>
  static make(path: string): unknown { return new ColorColumn<Record<string, string>, string>(path) }
}

export class SelectColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreSelectColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): SelectColumn<RegisteredPanelRecordForPath<TPath>, BoundRecordPath<TPath>>
  static make<TRecord extends object, const TPath extends RecordPath<TRecord>>(path: TPath): SelectColumn<TRecord, TPath>
  static make(path: string): unknown { return new SelectColumn(path) }
}

export class ToggleColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>> extends CoreToggleColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<boolean>>(path: TPath): ToggleColumn<RegisteredPanelRecordForPathValue<TPath, boolean>, BoundValueRecordPath<TPath, boolean>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): ToggleColumn<TRecord, TPath>
  static make(path: string): unknown { return new ToggleColumn<Record<string, boolean>, string>(path) }
}

export class TextInputColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreTextInputColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<string>>(path: TPath): TextInputColumn<RegisteredPanelRecordForPathValue<TPath, string>, BoundValueRecordPath<TPath, string>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, string>>(path: TPath): TextInputColumn<TRecord, TPath>
  static make(path: string): unknown { return new TextInputColumn<Record<string, string>, string>(path) }
}

export class CheckboxColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>> extends CoreCheckboxColumn<TRecord, TPath> {
  readonly path: TPath
  private constructor(path: TPath) { super(path); this.path = path }
  static make<const TPath extends RegisteredPanelRecordPathFor<boolean>>(path: TPath): CheckboxColumn<RegisteredPanelRecordForPathValue<TPath, boolean>, BoundValueRecordPath<TPath, boolean>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): CheckboxColumn<TRecord, TPath>
  static make(path: string): unknown { return new CheckboxColumn<Record<string, boolean>, string>(path) }
}

class BaseFilter<TRecord extends object = Record<string, unknown>, TValue = boolean> {
  declare readonly resourceRecordType: TRecord
  declare readonly filterValueType: TValue
  readonly id: string
  #defaultValue: TValue | null = null
  #form: Schema<TRecord> | null = null
  #indicator: string | null = null
  #label: string | null = null
  #query: ((query: object, value: TValue) => object) | null = null

  protected constructor(id: string) {
    this.id = id
  }

  default(value: TValue | null): this { this.#defaultValue = value; return this }
  form(schema: Schema<TRecord>): this { this.#form = schema; return this }
  indicator(value: string | null): this { this.#indicator = value; return this }
  label(value: string | null): this { this.#label = value; return this }
  query(callback: (query: object, value: TValue) => object): this { this.#query = callback; return this }

  compile(): Readonly<{ readonly manifest: JsonObject, readonly query: ((query: object, value: TValue) => object) | null }> {
    return Object.freeze({
      manifest: Object.freeze({
        defaultValue: toJsonValue(this.#defaultValue),
        id: this.id,
        indicator: this.#indicator,
        label: this.#label,
        schema: this.#form ? toJsonValue(this.#form.compile()) : null,
        type: 'custom',
      }),
      query: this.#query,
    })
  }
}

export class Filter<TRecord extends object = Record<string, unknown>, TValue = boolean> extends BaseFilter<TRecord, TValue> {
  private constructor(id: string) { super(id) }
  static make<TRecord extends object = Record<string, unknown>, TValue = boolean>(name: string): Filter<TRecord, TValue> { return new Filter(name) }
}

export class SelectFilter<
  TRecord extends object = Record<string, unknown>,
  TPath extends RecordPath<TRecord> = RecordPath<TRecord>,
  TValue extends boolean | number | string = SelectFilterValue<TRecord, TPath>,
> extends BaseFilter<TRecord, TValue | null> {
  readonly path: TPath
  #multiple = false
  #options: Readonly<Record<string, string>> = {}
  #preload = false
  #relationship: Readonly<{ name: string, titleAttribute: string }> | null = null
  #searchable = false
  private constructor(path: TPath) { super(path); this.path = path }
  static make<TRecord extends object, const TPath extends RecordPath<TRecord>>(path: TPath): SelectFilter<TRecord, TPath>
  static make<const TPath extends RegisteredPanelRecordPath>(path: TPath): SelectFilter<
    RegisteredPanelRecordForPath<TPath>,
    BoundRecordPath<TPath>,
    SelectFilterValue<RegisteredPanelRecordForPath<TPath>, BoundRecordPath<TPath>>
  >
  static make<TRecord extends object, const TPath extends RecordPath<TRecord>>(path: TPath): SelectFilter<TRecord, TPath> { return new SelectFilter(path) }
  multiple(value = true): this { this.#multiple = value; return this }
  options(value: Readonly<Record<string, string>>): this { this.#options = Object.freeze({ ...value }); return this }
  preload(value = true): this { this.#preload = value; return this }
  relationship<
    const TRelation extends RelationPath<TRecord>,
  >(name: TRelation, titleAttribute: RecordPath<RelatedRecord<RecordPathValue<TRecord, TRelation>>>): this { this.#relationship = Object.freeze({ name, titleAttribute }); return this }
  searchable(value = true): this { this.#searchable = value; return this }
  override compile(): ReturnType<BaseFilter<TRecord, TValue | null>['compile']> {
    const compiled = super.compile()
    return Object.freeze({ ...compiled, manifest: Object.freeze({ ...compiled.manifest, multiple: this.#multiple, options: this.#options, preload: this.#preload, relationship: this.#relationship, searchable: this.#searchable, type: 'select' }) })
  }
}

export class TernaryFilter<
  TRecord extends object = Record<string, unknown>,
  TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>,
> extends BaseFilter<TRecord, boolean | null> {
  readonly path: TPath
  #falseLabel = 'No'
  #nullable = false
  #placeholder = 'All'
  #trueLabel = 'Yes'
  private constructor(path: TPath) { super(path); this.path = path }
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): TernaryFilter<TRecord, TPath>
  static make<const TPath extends RegisteredPanelRecordPathFor<boolean>>(path: TPath): TernaryFilter<RegisteredPanelRecordForPathValue<TPath, boolean>, BoundValueRecordPath<TPath, boolean>>
  static make<TRecord extends object, const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): TernaryFilter<TRecord, TPath> { return new TernaryFilter(path) }
  falseLabel(value: string): this { this.#falseLabel = value; return this }
  nullable(value = true): this { this.#nullable = value; return this }
  placeholder(value: string): this { this.#placeholder = value; return this }
  trueLabel(value: string): this { this.#trueLabel = value; return this }
  queries(_trueQuery: (query: object) => object, _falseQuery: (query: object) => object, _blankQuery?: (query: object) => object): this { return this }
  override compile(): ReturnType<BaseFilter<TRecord, boolean | null>['compile']> {
    const compiled = super.compile()
    return Object.freeze({ ...compiled, manifest: Object.freeze({ ...compiled.manifest, falseLabel: this.#falseLabel, nullable: this.#nullable, placeholder: this.#placeholder, trueLabel: this.#trueLabel, type: 'ternary' }) })
  }
}

export interface ColumnFactory<TRecord extends object> {
  checkbox<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): CheckboxColumn<TRecord, TPath>
  color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorColumn<TRecord, TPath>
  icon<const TPath extends RecordPath<TRecord>>(path: TPath): IconColumn<TRecord, TPath>
  image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageColumn<TRecord, TPath>
  select<const TPath extends RecordPath<TRecord>>(path: TPath): SelectColumn<TRecord, TPath>
  text<const TPath extends RecordPath<TRecord>>(path: TPath): TextColumn<TRecord, TPath>
  textInput<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): TextInputColumn<TRecord, TPath>
  toggle<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): ToggleColumn<TRecord, TPath>
}

export interface FilterFactory<TRecord extends object> {
  make<TValue = boolean>(name: string): Filter<TRecord, TValue>
  select<const TPath extends RecordPath<TRecord>>(path: TPath): SelectFilter<TRecord, TPath>
  ternary<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): TernaryFilter<TRecord, TPath>
}

function createColumnFactory<TRecord extends object>(): ColumnFactory<TRecord> {
  return Object.freeze({
    checkbox: <const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath) => CheckboxColumn.make<TRecord, TPath>(path),
    color: <const TPath extends RecordPathFor<TRecord, string>>(path: TPath) => ColorColumn.make<TRecord, TPath>(path),
    icon: <const TPath extends RecordPath<TRecord>>(path: TPath) => IconColumn.make<TRecord, TPath>(path),
    image: <const TPath extends RecordPathFor<TRecord, string>>(path: TPath) => ImageColumn.make<TRecord, TPath>(path),
    select: <const TPath extends RecordPath<TRecord>>(path: TPath) => SelectColumn.make<TRecord, TPath>(path),
    text: <const TPath extends RecordPath<TRecord>>(path: TPath) => TextColumn.make<TRecord, TPath>(path),
    textInput: <const TPath extends RecordPathFor<TRecord, string>>(path: TPath) => TextInputColumn.make<TRecord, TPath>(path),
    toggle: <const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath) => ToggleColumn.make<TRecord, TPath>(path),
  })
}

function createFilterFactory<TRecord extends object>(): FilterFactory<TRecord> {
  return Object.freeze({
    make: <TValue = boolean>(name: string) => Filter.make<TRecord, TValue>(name),
    select: <const TPath extends RecordPath<TRecord>>(path: TPath) => SelectFilter.make<TRecord, TPath>(path),
    ternary: <const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath) => TernaryFilter.make<TRecord, TPath>(path),
  })
}

export class Table<
  TRecord extends object = Record<string, unknown>,
  TData extends object = object,
  TActionSchemaFactory = undefined,
> {
  declare readonly resourceRecordType: TRecord
  readonly definitionKind = 'table' as const
  #actionsPosition: TableActionPosition = 'after-columns'
  #columns: readonly Compilable[] = []
  #defaultSort: Readonly<{ column: RecordPath<TRecord>, direction: TableSortDirection }> | null = null
  #deferFilters = false
  #emptyStateActions: readonly TableAction<TRecord>[] = []
  #emptyStateDescription: string | null = null
  #emptyStateHeading: string | null = null
  #emptyStateIcon: string | null = null
  #filters: readonly Compilable[] = []
  #filtersFormColumns = 1
  #groups: readonly Compilable[] = []
  #headerActions: readonly TableAction<TRecord>[] = []
  #paginated = true
  #paginationPageOptions: readonly TablePaginationPageOption[] = [10, 25, 50, 100]
  #persistFiltersInSession = false
  #persistSearchInSession = false
  #persistSortInSession = false
  #recordActions: readonly TableAction<TRecord>[] = []
  #recordClasses: string | ((record: TRecord) => string | null) | null = null
  #recordUrl: string | ((record: TRecord) => string | null) | null = null
  #searchable = true
  #striped = false
  #toolbarActions: readonly TableAction<TRecord>[] = []
  readonly #actionFactory: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>

  constructor(actionSchemaFactory?: TActionSchemaFactory) {
    this.#actionFactory = createActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>(actionSchemaFactory)
  }

  columns(columns: readonly TableColumnContract<TRecord>[]): this
  columns<const TColumns extends readonly TableColumnContract<TRecord>[]>(configure: (column: ColumnFactory<TRecord>) => TColumns): this
  columns<const TColumns extends readonly TableColumnContract<TRecord>[]>(columns: TColumns | ((column: ColumnFactory<TRecord>) => TColumns)): this {
    const resolved = typeof columns === 'function' ? columns(createColumnFactory<TRecord>()) : columns
    this.#columns = Object.freeze([...resolved])
    return this
  }
  defaultSort(column: RecordPath<TRecord>, direction: TableSortDirection = 'asc'): this { this.#defaultSort = Object.freeze({ column, direction }); return this }
  deferFilters(value = true): this { this.#deferFilters = value; return this }
  emptyStateActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this { this.#emptyStateActions = Object.freeze([...actions(this.#actionFactory)]); return this }
  emptyStateDescription(value: string | null): this { this.#emptyStateDescription = value; return this }
  emptyStateHeading(value: string | null): this { this.#emptyStateHeading = value; return this }
  emptyStateIcon(value: string | null): this { this.#emptyStateIcon = value; return this }
  filters(filters: readonly TableFilterContract<TRecord>[]): this
  filters<const TFilters extends readonly TableFilterContract<TRecord>[]>(configure: (filter: FilterFactory<TRecord>) => TFilters): this
  filters<const TFilters extends readonly TableFilterContract<TRecord>[]>(filters: readonly TableFilterContract<TRecord>[] | ((filter: FilterFactory<TRecord>) => TFilters)): this {
    const resolved = typeof filters === 'function' ? filters(createFilterFactory<TRecord>()) : filters
    this.#filters = Object.freeze([...resolved])
    return this
  }
  filtersFormColumns(value: number): this { this.#filtersFormColumns = value; return this }
  groups(groups: readonly Compilable[]): this { this.#groups = Object.freeze([...groups]); return this }
  headerActions(actions: readonly TableAction<TRecord>[]): this
  headerActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this
  headerActions(actions: readonly TableAction<TRecord>[] | ((action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[])): this { this.#headerActions = Object.freeze([...(typeof actions === 'function' ? actions(this.#actionFactory) : actions)]); return this }
  paginated(value: boolean | readonly TablePaginationPageOption[] = true): this { if (typeof value !== 'boolean') this.#paginationPageOptions = Object.freeze([...value]); else this.#paginated = value; return this }
  paginationPageOptions(options: readonly TablePaginationPageOption[]): this { this.#paginationPageOptions = Object.freeze([...options]); return this }
  persistFiltersInSession(value = true): this { this.#persistFiltersInSession = value; return this }
  persistSearchInSession(value = true): this { this.#persistSearchInSession = value; return this }
  persistSortInSession(value = true): this { this.#persistSortInSession = value; return this }
  recordActions(actions: readonly TableAction<TRecord>[], position?: TableActionPosition): this
  recordActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[], position?: TableActionPosition): this
  recordActions(actions: readonly TableAction<TRecord>[] | ((action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]), position: TableActionPosition = 'after-columns'): this { this.#recordActions = Object.freeze([...(typeof actions === 'function' ? actions(this.#actionFactory) : actions)]); this.#actionsPosition = position; return this }
  recordClasses(value: string | ((record: TRecord) => string | null) | null): this { this.#recordClasses = value; return this }
  recordUrl(value: string | ((record: TRecord) => string | null) | null): this { this.#recordUrl = value; return this }
  searchable(value = true): this { this.#searchable = value; return this }
  striped(value = true): this { this.#striped = value; return this }
  toolbarActions(actions: readonly TableAction<TRecord>[]): this
  toolbarActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this
  toolbarActions(actions: readonly TableAction<TRecord>[] | ((action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[])): this { this.#toolbarActions = Object.freeze([...(typeof actions === 'function' ? actions(this.#actionFactory) : actions)]); return this }

  getActions(): readonly TableAction<TRecord>[] {
    return Object.freeze([...this.#recordActions, ...this.#headerActions, ...this.#toolbarActions])
  }

  compile(): Readonly<Record<string, unknown>> {
    const columns = this.#columns.map(compiledManifest)
    const filters = this.#filters.map(compiledManifest)
    const groups = this.#groups.map(compiledManifest)
    const actions = [
      ...this.#recordActions.map(action => action.manifest('row')),
      ...this.#headerActions.map(action => action.manifest('header')),
      ...this.#toolbarActions.map(action => action.manifest('bulk')),
    ]
    return Object.freeze({
      actions: Object.freeze(actions),
      actionsPosition: this.#actionsPosition,
      columns: Object.freeze(columns),
      defaultSort: this.#defaultSort,
      emptyState: Object.freeze({ actions: this.#emptyStateActions.map(action => action.manifest('header')), description: this.#emptyStateDescription, heading: this.#emptyStateHeading, icon: this.#emptyStateIcon }),
      filterMode: this.#deferFilters ? 'deferred' : 'live',
      filters: Object.freeze(filters),
      filtersFormColumns: this.#filtersFormColumns,
      groups: Object.freeze(groups),
      paginated: this.#paginated,
      paginationPageOptions: this.#paginationPageOptions,
      persistFiltersInSession: this.#persistFiltersInSession,
      persistSearchInSession: this.#persistSearchInSession,
      persistSortInSession: this.#persistSortInSession,
      recordClasses: typeof this.#recordClasses === 'string' ? this.#recordClasses : null,
      recordUrl: typeof this.#recordUrl === 'string' ? this.#recordUrl : null,
      searchable: this.#searchable,
      serverColumns: Object.freeze(this.#columns.map(column => column.compile())),
      serverFilters: Object.freeze(this.#filters.map(filter => filter.compile())),
      serverGroups: Object.freeze(this.#groups.map(group => group.compile())),
      serverSummaries: Object.freeze([]),
      striped: this.#striped,
      summaries: Object.freeze([]),
    })
  }
}

export {
  AdvancedQueryFilter as QueryBuilder,
  GroupBuilder as Group,
  SummaryBuilder as Summarizer,
} from '@holo-js/panels-core'
