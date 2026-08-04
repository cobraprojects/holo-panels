import type { JsonObject, JsonValue } from '../../protocol/json'
import type { ExtensionTypeId } from '../../plugins/type-id'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource } from '../../inference/type-source'
import type { RecordPath, RecordPathFor } from '../columns/types'
import type { TableFilterOperator, TableQueryFilterDefinition, TableQueryScalar } from '../query/contracts'
import { FilterBuilder } from './base'
import type {
  DateRangeFilterValue,
  FilterEncoder,
  FilterExecutionContext,
  FilterServerHandles,
  SelectFilterOption,
  TernaryFilterValue,
  TrashedFilterValue,
} from './types'
import { assertQueryIdentifier, jsonObject } from './validation'

abstract class ColumnFilterBuilder<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TValue extends JsonValue,
  TType extends string,
  TContext,
> extends FilterBuilder<TValue, TType, TContext> {
  readonly path: TPath
  readonly column: string

  protected constructor(id: string, type: TType, path: TPath, column: string, defaultValue: TValue) {
    super(id, type, defaultValue)
    this.path = path
    this.column = assertQueryIdentifier(column, 'filter column')
  }

  protected definition(operators: readonly TableFilterOperator[]): Readonly<Record<string, TableQueryFilterDefinition>> {
    return Object.freeze({ [this.id]: Object.freeze({ column: this.column, operators: Object.freeze([...operators]) }) })
  }
}

export class BooleanFilter<
  TRecord,
  TPath extends RecordPathFor<TRecord, boolean>,
  TContext = unknown,
> extends ColumnFilterBuilder<TRecord, TPath, boolean | null, 'boolean', TContext> {
  constructor(id: string, path: TPath, column: string = path) {
    super(id, 'boolean', path, column, null)
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.definition(['='])
  }

  protected encoder(): FilterEncoder<boolean | null, TContext> {
    return value => value === null ? null : { id: this.id, operator: '=', value }
  }
}

export class SelectFilter<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext = unknown,
  TType extends 'relationship-select' | 'select' = 'select',
> extends ColumnFilterBuilder<TRecord, TPath, JsonValue, TType, TContext> {
  #options: readonly SelectFilterOption[] = []
  #optionResolver?: (context: FilterExecutionContext<TContext>) => readonly SelectFilterOption[] | Promise<readonly SelectFilterOption[]>
  #multiple = false

  constructor(id: string, path: TPath, column: string = path, type: TType = 'select' as TType) {
    super(id, type, path, column, null)
  }

  options(values: readonly SelectFilterOption[]): this {
    this.assertMutable()
    const seen = new Set<TableQueryScalar>()
    this.#options = Object.freeze(values.map(option => {
      if (seen.has(option.value)) throw new Error(`Duplicate select filter option: ${String(option.value)}`)
      if (!option.label.trim()) throw new Error('Select filter option labels cannot be empty')
      seen.add(option.value)
      return Object.freeze({ ...option, label: option.label.trim() })
    }))
    return this
  }

  optionsUsing(resolver: (context: FilterExecutionContext<TContext>) => readonly SelectFilterOption[] | Promise<readonly SelectFilterOption[]>): this {
    this.assertMutable()
    this.#optionResolver = resolver
    return this
  }

  multiple(value = true): this {
    this.assertMutable()
    this.#multiple = value
    return this
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.definition(['=', 'in'])
  }

  protected encoder(): FilterEncoder<JsonValue, TContext> {
    return value => {
      if (value === null || Array.isArray(value) && value.length === 0) return null
      if (this.#multiple) {
        if (!Array.isArray(value)) throw new Error(`Select filter ${this.id} requires an array value`)
        return { id: this.id, operator: 'in', value: value as TableQueryScalar[] }
      }
      if (Array.isArray(value) || typeof value === 'object') throw new Error(`Select filter ${this.id} requires a scalar value`)
      return { id: this.id, operator: '=', value }
    }
  }

  protected override properties(): JsonObject {
    return {
      multiple: this.#multiple,
      options: this.#options.map(option => ({
        value: option.value,
        label: option.label,
        disabled: option.disabled ?? false,
      })),
      dynamicOptions: Boolean(this.#optionResolver),
    }
  }

  protected override additionalServerHandles(): Partial<FilterServerHandles<JsonValue, TContext>> {
    return this.#optionResolver ? { options: this.#optionResolver } : {}
  }
}

export class RelationshipSelectFilter<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext = unknown,
> extends SelectFilter<TRecord, TPath, TContext, 'relationship-select'> {
  readonly #relationship: string
  readonly #titleColumn: string

  constructor(id: string, path: TPath, relationship: string, titleColumn: string, column: string = path) {
    super(id, path, column, 'relationship-select')
    this.#relationship = assertQueryIdentifier(relationship, 'filter relationship')
    this.#titleColumn = assertQueryIdentifier(titleColumn, 'relationship title column')
  }

  protected override properties(): JsonObject {
    return {
      ...super.properties(),
      relationship: this.#relationship,
      titleColumn: this.#titleColumn,
    }
  }
}

export class TernaryFilter<
  TRecord,
  TPath extends RecordPathFor<TRecord, boolean>,
  TContext = unknown,
> extends ColumnFilterBuilder<TRecord, TPath, TernaryFilterValue, 'ternary', TContext> {
  constructor(id: string, path: TPath, column: string = path) {
    super(id, 'ternary', path, column, 'all')
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.definition(['='])
  }

  protected encoder(): FilterEncoder<TernaryFilterValue, TContext> {
    return value => {
      if (value === 'all') return null
      if (value !== 'true' && value !== 'false') throw new Error(`Invalid ternary filter value: ${value}`)
      return { id: this.id, operator: '=', value: value === 'true' }
    }
  }
}

export class DateRangeFilter<
  TRecord,
  TPath extends RecordPathFor<TRecord, Date | string>,
  TContext = unknown,
> extends ColumnFilterBuilder<TRecord, TPath, DateRangeFilterValue, 'date-range', TContext> {
  constructor(id: string, path: TPath, column: string = path) {
    super(id, 'date-range', path, column, { from: null, to: null })
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.definition(['>=', '<=', 'between'])
  }

  protected encoder(): FilterEncoder<DateRangeFilterValue, TContext> {
    return value => {
      const from = value.from === null ? null : normalizeDate(value.from, 'from')
      const to = value.to === null ? null : normalizeDate(value.to, 'to')
      if (from && to && from > to) throw new Error('Date range start cannot be after its end')
      if (from && to) return { id: this.id, operator: 'between', value: [from, to] }
      if (from) return { id: this.id, operator: '>=', value: from }
      if (to) return { id: this.id, operator: '<=', value: to }
      return null
    }
  }
}

function normalizeDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z?)?$/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid date range ${label} value`)
  }
  return value
}

export class TrashedFilter<TRecord, TContext = unknown>
  extends ColumnFilterBuilder<TRecord, RecordPath<TRecord>, TrashedFilterValue, 'trashed', TContext> {
  constructor(id: string, deletedAtPath: RecordPath<TRecord>, column: string = deletedAtPath) {
    super(id, 'trashed', deletedAtPath, column, 'without')
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.definition(['null', 'not-null'])
  }

  protected encoder(): FilterEncoder<TrashedFilterValue, TContext> {
    return value => {
      if (value === 'with') return null
      if (value === 'without') return { id: this.id, operator: 'null' }
      if (value === 'only') return { id: this.id, operator: 'not-null' }
      throw new Error(`Invalid trashed filter value: ${value}`)
    }
  }
}

export interface CustomFilterOptions<TValue extends JsonValue, TContext> {
  readonly defaultValue: TValue
  readonly schema: JsonObject
  readonly targets: Readonly<Record<string, TableQueryFilterDefinition>>
  readonly encode: FilterEncoder<TValue, TContext>
}

export class CustomSchemaFilter<TValue extends JsonValue, TContext = unknown>
  extends FilterBuilder<TValue, 'custom', TContext> {
  readonly #schema: JsonObject
  readonly #targets: Readonly<Record<string, TableQueryFilterDefinition>>
  readonly #encode: FilterEncoder<TValue, TContext>

  constructor(id: string, options: CustomFilterOptions<TValue, TContext>) {
    super(id, 'custom', options.defaultValue)
    this.#schema = jsonObject(options.schema, 'Custom filter schema')
    this.#targets = options.targets
    this.#encode = options.encode
    for (const [target, definition] of Object.entries(this.#targets)) {
      assertQueryIdentifier(target, 'custom filter target')
      assertQueryIdentifier(definition.column, 'custom filter column')
      if (definition.operators.length === 0) throw new Error(`Custom filter target ${target} requires operators`)
    }
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.#targets
  }

  protected encoder(): FilterEncoder<TValue, TContext> {
    return this.#encode
  }

  protected override properties(): JsonObject {
    return { schema: this.#schema }
  }
}

export interface ExtensionFilterOptions<TValue extends JsonValue, TContext> {
  readonly defaultValue: TValue
  readonly encode: FilterEncoder<TValue, TContext>
  readonly properties?: JsonObject
  readonly targets: Readonly<Record<string, TableQueryFilterDefinition>>
}

export class ExtensionFilterBuilder<
  TValue extends JsonValue,
  TType extends ExtensionTypeId<'filter'>,
  TContext = unknown,
> extends FilterBuilder<TValue, TType, TContext> {
  readonly #encode: FilterEncoder<TValue, TContext>
  readonly #properties: JsonObject
  readonly #targets: Readonly<Record<string, TableQueryFilterDefinition>>

  constructor(id: string, typeId: TType, options: ExtensionFilterOptions<TValue, TContext>) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*:filter:[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(typeId)) {
      throw new Error('Extension filter type IDs must use namespace:filter:name')
    }
    super(id, typeId, options.defaultValue)
    this.#encode = options.encode
    this.#properties = jsonObject(options.properties ?? {}, 'Extension filter properties')
    this.#targets = options.targets
    for (const [target, definition] of Object.entries(this.#targets)) {
      assertQueryIdentifier(target, 'extension filter target')
      assertQueryIdentifier(definition.column, 'extension filter column')
      if (definition.operators.length === 0) throw new Error(`Extension filter target ${target} requires operators`)
    }
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return this.#targets
  }

  protected encoder(): FilterEncoder<TValue, TContext> {
    return this.#encode
  }

  protected override properties(): JsonObject {
    return this.#properties
  }
}

export function booleanFilter<TRecord, TPath extends RecordPathFor<TRecord, boolean>, TContext = unknown>(
  id: string,
  path: TPath,
  column: string = path,
): BooleanFilter<TRecord, TPath, TContext> {
  return new BooleanFilter(id, path, column)
}

export function customFilter<TValue extends JsonValue, TContext = unknown>(
  id: string,
  options: CustomFilterOptions<TValue, TContext>,
): CustomSchemaFilter<TValue, TContext> {
  return new CustomSchemaFilter(id, options)
}

export function extensionFilter<
  TValue extends JsonValue,
  const TType extends ExtensionTypeId<'filter'>,
  TContext = unknown,
>(
  id: string,
  typeId: TType,
  options: ExtensionFilterOptions<TValue, TContext>,
): ExtensionFilterBuilder<TValue, TType, TContext> {
  return new ExtensionFilterBuilder(id, typeId, options)
}

export class ExtensionFilterFactory<TContext = unknown> {
  create<TValue extends JsonValue, const TType extends ExtensionTypeId<'filter'>>(
    id: string,
    typeId: TType,
    options: ExtensionFilterOptions<TValue, TContext>,
  ): ExtensionFilterBuilder<TValue, TType, TContext> {
    return new ExtensionFilterBuilder(id, typeId, options)
  }
}

export function extensionFiltersFor<TContextSource extends RuntimeTypeSource | undefined = undefined>(
  _context?: TContextSource,
): ExtensionFilterFactory<OptionalRuntimeTypeValue<TContextSource>> {
  return new ExtensionFilterFactory()
}

export class FilterFactory<TRecord, TContext = unknown> {
  boolean<TPath extends RecordPathFor<TRecord, boolean>>(id: string, path: TPath, column: string = path): BooleanFilter<TRecord, TPath, TContext> {
    return new BooleanFilter(id, path, column)
  }

  select<TPath extends RecordPath<TRecord>>(id: string, path: TPath, column: string = path): SelectFilter<TRecord, TPath, TContext> {
    return new SelectFilter(id, path, column)
  }

  relationshipSelect<TPath extends RecordPath<TRecord>>(
    id: string,
    path: TPath,
    relationship: string,
    titleColumn: string,
    column: string = path,
  ): RelationshipSelectFilter<TRecord, TPath, TContext> {
    return new RelationshipSelectFilter(id, path, relationship, titleColumn, column)
  }

  ternary<TPath extends RecordPathFor<TRecord, boolean>>(id: string, path: TPath, column: string = path): TernaryFilter<TRecord, TPath, TContext> {
    return new TernaryFilter(id, path, column)
  }

  dateRange<TPath extends RecordPathFor<TRecord, Date | string>>(id: string, path: TPath, column: string = path): DateRangeFilter<TRecord, TPath, TContext> {
    return new DateRangeFilter(id, path, column)
  }

  trashed(id: string, deletedAtPath: RecordPath<TRecord>, column: string = deletedAtPath): TrashedFilter<TRecord, TContext> {
    return new TrashedFilter(id, deletedAtPath, column)
  }
}

export type FilterTypeSource<TValue extends object> = RecordTypeSource & (
  | { readonly prototype: TValue }
  | { create(...parameters: never[]): TValue | Promise<TValue> }
)

export function filtersFor<TRecordSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_record: TRecordSource, _context?: TContextSource): FilterFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>> {
  return new FilterFactory()
}
