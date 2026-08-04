const SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

function normalizeSegment(value: string | number): string {
  const segment = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/[._-]+$/, '')

  if (!segment || !SEGMENT_PATTERN.test(segment)) {
    throw new Error(`Cannot create a stable ID segment from ${String(value)}`)
  }

  return segment
}

function normalizePosition(value: string | number): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Cannot create a stable position from ${String(value)}`)
    }

    return String(value)
  }

  return normalizeSegment(value)
}

export function assignStableKey(
  kind: string,
  explicitKey: string | undefined,
  position: readonly (number | string)[],
): string {
  if (explicitKey) {
    return normalizeSegment(explicitKey)
  }

  if (position.length === 0) {
    throw new Error(`A key or stable schema position is required for ${kind}`)
  }

  return [normalizeSegment(kind), ...position.map(normalizePosition)].join('-')
}

export function assignStableId(namespace: string, kind: string, key: string): string {
  return `${normalizeSegment(namespace)}:${normalizeSegment(kind)}:${normalizeSegment(key)}`
}
