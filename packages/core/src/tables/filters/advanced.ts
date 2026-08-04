import type { JsonObject, JsonValue } from '../../protocol/json'
import type { RecordTypeSource, RecordTypeValue } from '../../inference/type-source'
import type { RecordPath, RecordPathValue } from '../columns/types'
import type { TableFilterOperator, TableQueryFilter, TableQueryFilterDefinition, TableQueryScalar } from '../query/contracts'
import { FilterBuilder } from './base'
import type {
  AdvancedColumnMap,
  AdvancedFilterColumn,
  AdvancedFilterCondition,
  AdvancedFilterValue,
  AdvancedOperatorFor,
  AdvancedScalarType,
  FilterEncoder,
} from './types'
import { assertFilterId, assertQueryIdentifier, jsonObject } from './validation'

function targetId(filterId: string, columnId: string): string {
  return `${filterId}_${columnId.replaceAll('.', '_').replaceAll('-', '_')}`
}

export function advancedColumn<
  TRecord,
  TPath extends RecordPath<TRecord>,
  const TOperators extends readonly AdvancedOperatorFor<RecordPathValue<TRecord, TPath>>[],
>(
  id: string,
  path: TPath,
  column: string,
  scalarType: AdvancedScalarType,
  operators: TOperators,
): AdvancedFilterColumn<TRecord, TPath, TOperators> {
  assertFilterId(id)
  assertQueryIdentifier(column, 'advanced filter column')
  if (operators.length === 0) throw new Error(`Advanced filter column ${id} requires at least one operator`)
  return Object.freeze({ id, path, column, scalarType, operators: Object.freeze([...operators]) as TOperators })
}

export class AdvancedColumnFactory<TRecord> {
  column<
    TPath extends RecordPath<TRecord>,
    const TOperators extends readonly AdvancedOperatorFor<RecordPathValue<TRecord, TPath>>[],
  >(
    id: string,
    path: TPath,
    column: string,
    scalarType: AdvancedScalarType,
    operators: TOperators,
  ): AdvancedFilterColumn<TRecord, TPath, TOperators> {
    return advancedColumn(id, path, column, scalarType, operators)
  }
}

export type AdvancedColumnRecordSource<TRecord extends object> = RecordTypeSource & (
  | { readonly prototype: TRecord }
  | { create(...parameters: never[]): TRecord | Promise<TRecord> }
)

export function advancedColumnsFor<TSource extends RecordTypeSource>(source: TSource): AdvancedColumnFactory<RecordTypeValue<TSource>>
export function advancedColumnsFor<TSource extends RecordTypeSource>(_source: TSource): AdvancedColumnFactory<RecordTypeValue<TSource>> {
  return new AdvancedColumnFactory()
}

function requireScalar(value: JsonValue | undefined, type: AdvancedScalarType, operator: TableFilterOperator): TableQueryScalar {
  if (value === null) return null
  if (Array.isArray(value) || typeof value === 'object' || typeof value === 'undefined') {
    throw new Error(`Advanced operator ${operator} requires a scalar value`)
  }
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Advanced number filter requires a finite number')
  if (type === 'boolean' && typeof value !== 'boolean') throw new Error('Advanced boolean filter requires a boolean')
  if ((type === 'string' || type === 'date') && typeof value !== 'string') throw new Error(`Advanced ${type} filter requires a string`)
  if (type === 'date' && Number.isNaN(Date.parse(value as string))) throw new Error('Advanced date filter requires a valid date')
  if (operator === 'like' && typeof value !== 'string') throw new Error('Advanced like filter requires a string')
  return value
}

function queryValue(
  value: JsonValue | undefined,
  column: { readonly scalarType: AdvancedScalarType },
  operator: TableFilterOperator,
): TableQueryFilter['value'] {
  if (operator === 'null' || operator === 'not-null') {
    if (typeof value !== 'undefined') throw new Error(`Advanced operator ${operator} does not accept a value`)
    return undefined
  }
  if (operator === 'in' || operator === 'not-in' || operator === 'between') {
    if (!Array.isArray(value)) throw new Error(`Advanced operator ${operator} requires an array`)
    if (operator === 'between' && value.length !== 2) throw new Error('Advanced between filters require exactly two values')
    if ((operator === 'in' || operator === 'not-in') && value.length === 0) throw new Error(`Advanced operator ${operator} requires values`)
    return value.map(item => requireScalar(item, column.scalarType, operator))
  }
  return requireScalar(value, column.scalarType, operator)
}

export function advancedFilterValue<TColumns extends Readonly<Record<string, unknown>>>(
  conditions: readonly AdvancedFilterCondition<TColumns>[],
): AdvancedFilterValue {
  return {
    conditions: conditions.map(condition => jsonObject(condition, 'Advanced filter condition')),
  }
}

export class AdvancedQueryFilter<
  TRecord,
  TColumns extends AdvancedColumnMap<TRecord>,
  TContext = unknown,
> extends FilterBuilder<AdvancedFilterValue, 'advanced-query', TContext> {
  readonly #columns: TColumns

  constructor(id: string, columns: TColumns) {
    super(id, 'advanced-query', { conditions: [] })
    if (Object.keys(columns).length === 0) throw new Error('Advanced query filters require allow-listed columns')
    const seenTargets = new Set<string>()
    for (const [key, column] of Object.entries(columns)) {
      if (key !== column.id) throw new Error(`Advanced filter column key ${key} must match its ID ${column.id}`)
      const target = targetId(id, column.id)
      if (seenTargets.has(target)) throw new Error(`Advanced filter target collision: ${target}`)
      seenTargets.add(target)
    }
    this.#columns = columns
  }

  protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>> {
    return Object.freeze(Object.fromEntries(Object.values(this.#columns).map(column => [
      targetId(this.id, column.id),
      Object.freeze({ column: column.column, operators: Object.freeze([...column.operators]) }),
    ])))
  }

  protected encoder(): FilterEncoder<AdvancedFilterValue, TContext> {
    return value => {
      const seenColumns = new Set<string>()
      return value.conditions.map(rawCondition => {
        const columnId = rawCondition.column
        const operator = rawCondition.operator
        if (typeof columnId !== 'string' || typeof operator !== 'string') throw new Error('Advanced filter conditions require column and operator strings')
        const column = this.#columns[columnId]
        if (!column) throw new Error(`Unknown advanced filter column: ${columnId}`)
        if (seenColumns.has(columnId)) throw new Error(`Duplicate advanced filter column: ${columnId}`)
        seenColumns.add(columnId)
        if (!column.operators.includes(operator as TableFilterOperator)) throw new Error(`Advanced column ${columnId} does not allow operator ${operator}`)
        const queryFilter: TableQueryFilter = {
          id: targetId(this.id, column.id),
          operator: operator as TableFilterOperator,
          ...((operator === 'null' || operator === 'not-null')
            ? {}
            : { value: queryValue(rawCondition.value, column, operator as TableFilterOperator) }),
        }
        return queryFilter
      })
    }
  }

  protected override properties(): JsonObject {
    return {
      columns: Object.values(this.#columns).map(column => ({
        id: column.id,
        path: column.path,
        scalarType: column.scalarType,
        operators: [...column.operators],
      })),
    }
  }
}

export function advancedQueryFilter<
  TRecord,
  TColumns extends AdvancedColumnMap<TRecord>,
  TContext = unknown,
>(id: string, columns: TColumns): AdvancedQueryFilter<TRecord, TColumns, TContext> {
  return new AdvancedQueryFilter(id, columns)
}
