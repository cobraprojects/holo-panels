const pathSegmentPattern = /^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)$/
const unsafeSegments = new Set(['__proto__', 'constructor', 'prototype'])

export function parseFormPath(path: string): readonly string[] {
  const segments = path.split('.')
  if (!path || segments.some(segment => !pathSegmentPattern.test(segment) || unsafeSegments.has(segment))) {
    throw new Error(`Invalid form path: ${path}`)
  }
  return segments
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function getPathValue(value: unknown, path: string): unknown {
  let current = value
  for (const segment of parseFormPath(path)) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isSafeInteger(index) || index < 0) return undefined
      current = current[index]
    } else if (isObject(current)) {
      current = current[segment]
    } else {
      return undefined
    }
  }
  return current
}

function assignPath(current: unknown, segments: readonly string[], value: unknown): unknown {
  const [segment, ...remaining] = segments
  if (typeof segment === 'undefined') return Object.is(current, value) ? current : value

  if (Array.isArray(current)) {
    const index = Number(segment)
    if (!Number.isSafeInteger(index) || index < 0 || index > current.length) {
      throw new Error(`Invalid array index: ${segment}`)
    }
    const previous = current[index]
    const next = assignPath(previous, remaining, value)
    if (Object.is(previous, next)) return current
    const result = [...current]
    result[index] = next
    return result
  }

  if (!isObject(current)) throw new Error(`Cannot set nested form path through ${String(current)}`)
  const previous = current[segment]
  const next = assignPath(previous, remaining, value)
  if (Object.is(previous, next)) return current
  return { ...current, [segment]: next }
}

export function setPathValue<TValues>(values: TValues, path: string, value: unknown): TValues {
  return assignPath(values, parseFormPath(path), value) as TValues
}

export function updateArrayPath<TValues>(
  values: TValues,
  path: string,
  update: (items: readonly unknown[]) => readonly unknown[],
): TValues {
  const current = getPathValue(values, path)
  if (!Array.isArray(current)) throw new Error(`Form path is not an array: ${path}`)
  const next = update(current)
  return setPathValue(values, path, next)
}

export function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`)
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index]))
  }
  if (isObject(left) && isObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    return keys.every(key => valuesEqual(left[key], right[key]))
  }
  return false
}

export function collectDirtyPaths(current: unknown, initial: unknown, parent = ''): readonly string[] {
  if (valuesEqual(current, initial)) return []
  if (Array.isArray(current) && Array.isArray(initial)) {
    const length = Math.max(current.length, initial.length)
    return Array.from({ length }, (_, index) => collectDirtyPaths(current[index], initial[index], parent ? `${parent}.${index}` : String(index))).flat()
  }
  if (isObject(current) && isObject(initial)) {
    const keys = [...new Set([...Object.keys(current), ...Object.keys(initial)])].sort()
    return keys.flatMap(key => collectDirtyPaths(current[key], initial[key], parent ? `${parent}.${key}` : key))
  }
  return parent ? [parent] : []
}

export function cloneFormValue<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) return value.map(cloneFormValue) as TValue
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneFormValue(item)])) as TValue
  }
  return value
}
