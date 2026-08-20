import { createActionFactory, type ActionContract, type ActionFactory, type ActionGroup } from '@holo-js/panels-actions'
import {
  CheckboxColumn as CoreCheckboxColumn,
  ColorColumn as CoreColorColumn,
  IconColumn as CoreIconColumn,
  ImageColumn as CoreImageColumn,
  SelectColumn as CoreSelectColumn,
  TextColumn as CoreTextColumn,
  TextInputColumn as CoreTextInputColumn,
  ToggleColumn as CoreToggleColumn,
  type JsonObject,
  type RecordPath,
  type RecordPathFor,
  toJsonValue,
} from '@holo-js/panels-core'
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
  readonly resourceRecordType: TRecord
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

export class TextColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreTextColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>>(path: TPath): TextColumn<TRecord, TPath> { return new TextColumn(path) }
}

export class IconColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreIconColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>>(path: TPath): IconColumn<TRecord, TPath> { return new IconColumn(path) }
}

export class ImageColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreImageColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>>(path: TPath): ImageColumn<TRecord, TPath> { return new ImageColumn(path) }
}

export class ColorColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreColorColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>>(path: TPath): ColorColumn<TRecord, TPath> { return new ColorColumn(path) }
}

export class SelectColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>> extends CoreSelectColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPath<TRecord> = RecordPath<TRecord>>(path: TPath): SelectColumn<TRecord, TPath> { return new SelectColumn(path) }
}

export class ToggleColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>> extends CoreToggleColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>>(path: TPath): ToggleColumn<TRecord, TPath> { return new ToggleColumn(path) }
}

export class TextInputColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>> extends CoreTextInputColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, string> = RecordPathFor<TRecord, string>>(path: TPath): TextInputColumn<TRecord, TPath> { return new TextInputColumn(path) }
}

export class CheckboxColumn<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>> extends CoreCheckboxColumn<TRecord, TPath> {
  static make<TRecord extends object = Record<string, unknown>, TPath extends RecordPathFor<TRecord, boolean> = RecordPathFor<TRecord, boolean>>(path: TPath): CheckboxColumn<TRecord, TPath> { return new CheckboxColumn(path) }
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

export class SelectFilter<TRecord extends object = Record<string, unknown>, TValue extends boolean | number | string = string> extends BaseFilter<TRecord, TValue | null> {
  #multiple = false
  #options: Readonly<Record<string, string>> = {}
  #preload = false
  #relationship: Readonly<{ name: string, titleAttribute: string }> | null = null
  #searchable = false
  private constructor(id: string) { super(id) }
  static make<TRecord extends object = Record<string, unknown>, TValue extends boolean | number | string = string>(name: string): SelectFilter<TRecord, TValue> { return new SelectFilter(name) }
  multiple(value = true): this { this.#multiple = value; return this }
  options(value: Readonly<Record<string, string>>): this { this.#options = Object.freeze({ ...value }); return this }
  preload(value = true): this { this.#preload = value; return this }
  relationship(name: string, titleAttribute: string): this { this.#relationship = Object.freeze({ name, titleAttribute }); return this }
  searchable(value = true): this { this.#searchable = value; return this }
  override compile(): ReturnType<BaseFilter<TRecord, TValue | null>['compile']> {
    const compiled = super.compile()
    return Object.freeze({ ...compiled, manifest: Object.freeze({ ...compiled.manifest, multiple: this.#multiple, options: this.#options, preload: this.#preload, relationship: this.#relationship, searchable: this.#searchable, type: 'select' }) })
  }
}

export class TernaryFilter<TRecord extends object = Record<string, unknown>> extends BaseFilter<TRecord, boolean | null> {
  #falseLabel = 'No'
  #nullable = false
  #placeholder = 'All'
  #trueLabel = 'Yes'
  private constructor(id: string) { super(id) }
  static make<TRecord extends object = Record<string, unknown>>(name: string): TernaryFilter<TRecord> { return new TernaryFilter(name) }
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
  select<TValue extends boolean | number | string = string>(name: string): SelectFilter<TRecord, TValue>
  ternary(name: string): TernaryFilter<TRecord>
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
    select: <TValue extends boolean | number | string = string>(name: string) => SelectFilter.make<TRecord, TValue>(name),
    ternary: (name: string) => TernaryFilter.make<TRecord>(name),
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

  columns<const TColumns extends readonly TableColumnContract<TRecord>[]>(configure: (column: ColumnFactory<TRecord>) => TColumns): this { this.#columns = Object.freeze([...configure(createColumnFactory<TRecord>())]); return this }
  defaultSort(column: RecordPath<TRecord>, direction: TableSortDirection = 'asc'): this { this.#defaultSort = Object.freeze({ column, direction }); return this }
  deferFilters(value = true): this { this.#deferFilters = value; return this }
  emptyStateActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this { this.#emptyStateActions = Object.freeze([...actions(this.#actionFactory)]); return this }
  emptyStateDescription(value: string | null): this { this.#emptyStateDescription = value; return this }
  emptyStateHeading(value: string | null): this { this.#emptyStateHeading = value; return this }
  emptyStateIcon(value: string | null): this { this.#emptyStateIcon = value; return this }
  filters<const TFilters extends readonly TableFilterContract<TRecord>[]>(configure: (filter: FilterFactory<TRecord>) => TFilters): this { this.#filters = Object.freeze([...configure(createFilterFactory<TRecord>())]); return this }
  filtersFormColumns(value: number): this { this.#filtersFormColumns = value; return this }
  groups(groups: readonly Compilable[]): this { this.#groups = Object.freeze([...groups]); return this }
  headerActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this { this.#headerActions = Object.freeze([...actions(this.#actionFactory)]); return this }
  paginated(value: boolean | readonly TablePaginationPageOption[] = true): this { if (typeof value !== 'boolean') this.#paginationPageOptions = Object.freeze([...value]); else this.#paginated = value; return this }
  paginationPageOptions(options: readonly TablePaginationPageOption[]): this { this.#paginationPageOptions = Object.freeze([...options]); return this }
  persistFiltersInSession(value = true): this { this.#persistFiltersInSession = value; return this }
  persistSearchInSession(value = true): this { this.#persistSearchInSession = value; return this }
  persistSortInSession(value = true): this { this.#persistSortInSession = value; return this }
  recordActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[], position: TableActionPosition = 'after-columns'): this { this.#recordActions = Object.freeze([...actions(this.#actionFactory)]); this.#actionsPosition = position; return this }
  recordClasses(value: string | ((record: TRecord) => string | null) | null): this { this.#recordClasses = value; return this }
  recordUrl(value: string | ((record: TRecord) => string | null) | null): this { this.#recordUrl = value; return this }
  searchable(value = true): this { this.#searchable = value; return this }
  striped(value = true): this { this.#striped = value; return this }
  toolbarActions(actions: (action: ActionFactory<TRecord, TData, object, unknown, object, TActionSchemaFactory>) => readonly TableAction<TRecord>[]): this { this.#toolbarActions = Object.freeze([...actions(this.#actionFactory)]); return this }

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
