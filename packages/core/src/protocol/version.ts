const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const PROTOCOL_VERSION = '1.0' as const

export interface ProtocolVersion {
  major: number
  minor: number
}

export class ProtocolCompatibilityError extends Error {
  readonly actual: string
  readonly expected: string

  constructor(expected: string, actual: string) {
    super(`Incompatible Holo Panels protocol version: expected ${expected}, received ${actual}`)
    this.name = 'ProtocolCompatibilityError'
    this.expected = expected
    this.actual = actual
  }
}

export function parseProtocolVersion(version: string): ProtocolVersion | null {
  const match = VERSION_PATTERN.exec(version)

  if (!match) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  }
}

export function isProtocolCompatible(
  actual: string,
  expected: string = PROTOCOL_VERSION,
): boolean {
  const actualVersion = parseProtocolVersion(actual)
  const expectedVersion = parseProtocolVersion(expected)

  if (!actualVersion || !expectedVersion) {
    return false
  }

  return actualVersion.major === expectedVersion.major
    && actualVersion.minor <= expectedVersion.minor
}

export function assertProtocolCompatible(
  actual: string,
  expected: string = PROTOCOL_VERSION,
): void {
  if (!isProtocolCompatible(actual, expected)) {
    throw new ProtocolCompatibilityError(expected, actual)
  }
}
