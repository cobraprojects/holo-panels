import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonValue } from '../../protocol/json'
import type { TableFilterOperator, TableQueryFilter, TableQueryFilterDefinition, TableQueryScalar } from '../query/contracts'

const identifierPattern = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu
const stableIdPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const operators: readonly TableFilterOperator[] = ['=', '!=', '>', '>=', '<', '<=', 'like', 'in', 'not-in', 'between', 'null', 'not-null']

export function assertFilterId(value: string): string {
  if (!stableIdPattern.test(value)) throw new Error(`Invalid filter ID: ${value}`)
  return value
}

export function assertQueryIdentifier(value: string, label: string): string {
  if (!identifierPattern.test(value)) throw new Error(`Invalid ${label}: ${value}`)
  return value
}

export function jsonValue(value: unknown, label: string): JsonValue {
  try {
    return toJsonValue(value)
  } catch {
    throw new Error(`${label} must be JSON-safe`)
  }
}

export function jsonObject(value: unknown, label: string): JsonObject {
  const serialized = jsonValue(value, label)
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new Error(`${label} must be a JSON object`)
  }
  return serialized
}

export function assertOperator(value: string): asserts value is TableFilterOperator {
  if (!operators.includes(value as TableFilterOperator)) throw new Error(`Unsupported filter operator: ${value}`)
}

function assertScalar(value: unknown, label: string): asserts value is TableQueryScalar {
  if (value !== null && !['boolean', 'number', 'string'].includes(typeof value)) throw new Error(`${label} must be a scalar`)
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

export function validateQueryFilter(
  filter: TableQueryFilter,
  definitions: Readonly<Record<string, TableQueryFilterDefinition>>,
): TableQueryFilter {
  const definition = definitions[filter.id]
  if (!definition) throw new Error(`Filter query references unknown allow-listed filter: ${filter.id}`)
  assertOperator(filter.operator)
  if (!definition.operators.includes(filter.operator)) {
    throw new Error(`Filter ${filter.id} does not allow operator ${filter.operator}`)
  }
  if (filter.operator === 'null' || filter.operator === 'not-null') {
    if (typeof filter.value !== 'undefined') throw new Error(`Operator ${filter.operator} does not accept a value`)
    return Object.freeze({ id: filter.id, operator: filter.operator })
  }
  if (filter.operator === 'in' || filter.operator === 'not-in' || filter.operator === 'between') {
    if (!Array.isArray(filter.value)) throw new Error(`Operator ${filter.operator} requires an array value`)
    if (filter.operator === 'between' && filter.value.length !== 2) throw new Error('Between filters require exactly two values')
    if ((filter.operator === 'in' || filter.operator === 'not-in') && filter.value.length === 0) throw new Error(`Operator ${filter.operator} requires at least one value`)
    for (const value of filter.value) assertScalar(value, `Operator ${filter.operator}`)
    return Object.freeze({ id: filter.id, operator: filter.operator, value: Object.freeze([...filter.value]) })
  }
  assertScalar(filter.value, `Operator ${filter.operator}`)
  return Object.freeze({ id: filter.id, operator: filter.operator, value: filter.value })
}

export function activeValue(value: JsonValue, defaultValue: JsonValue): boolean {
  return JSON.stringify(value) !== JSON.stringify(defaultValue)
}
