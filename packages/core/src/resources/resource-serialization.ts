function serializeResourceValue(value: unknown, ancestors: Set<object>): unknown {
  if (value instanceof Date) return value.toISOString()
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Resource records require finite numeric values.')
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value !== 'object') {
    if (typeof value === 'undefined') return undefined
    throw new TypeError(`Resource records cannot serialize ${typeof value} values.`)
  }
  if (ancestors.has(value)) throw new TypeError('Resource records cannot contain circular values.')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map(item => serializeResourceValue(item, ancestors) ?? null)
    const toJSON = Reflect.get(value, 'toJSON')
    if (typeof toJSON === 'function') {
      const serialized = Reflect.apply(toJSON, value, [])
      if (serialized !== value) return serializeResourceValue(serialized, ancestors)
    }
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const item = serializeResourceValue(Reflect.get(value, key), ancestors)
      if (typeof item !== 'undefined') result[key] = item
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

export function serializeResourceRecord(record: { toJSON(): object }): Readonly<Record<string, unknown>> {
  const value = serializeResourceValue(record.toJSON(), new Set())
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Resource records must serialize to objects.')
  return value as Readonly<Record<string, unknown>>
}
