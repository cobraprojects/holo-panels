import { toJsonValue } from '../../protocol/serialization'
import type { JsonValue } from '../../protocol/json'
import type { AggregateDriver, AggregatePrimitive } from './types'

const identifierPattern = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/iu
const stableIdPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

export function stableId(value: string, label: string): string {
  if (!stableIdPattern.test(value)) throw new Error(`Invalid ${label}: ${value}`)
  return value
}

export function queryColumn(value: string, label: string): string {
  if (!identifierPattern.test(value)) throw new Error(`Invalid ${label}: ${value}`)
  return value
}

export function safeJson(value: unknown, label: string): JsonValue {
  try {
    return toJsonValue(value)
  } catch {
    throw new Error(`${label} must be JSON-safe`)
  }
}

export function normalizeAggregateNumber(value: AggregatePrimitive, driver: AggregateDriver): number | null {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) throw new Error(`${driver} returned a non-finite aggregate value`)
  if (typeof value === 'bigint' && !Number.isSafeInteger(number)) throw new Error(`${driver} aggregate exceeds the safe integer range`)
  return number
}

export function valueAtPath<TRecord>(record: TRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => (
    typeof current === 'object' && current !== null ? Reflect.get(current, segment) : undefined
  ), record)
}
