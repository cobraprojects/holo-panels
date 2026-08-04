export interface VersionRange {
  maximumExclusive?: string
  minimum: string
}

export interface PluginCompatibility {
  panels: VersionRange
  protocol: VersionRange
}

export class PluginCompatibilityError extends Error {
  readonly pluginId: string

  constructor(pluginId: string, target: 'panels' | 'protocol', expected: VersionRange, actual: string) {
    const maximum = expected.maximumExclusive ? ` and below ${expected.maximumExclusive}` : ''
    super(`${pluginId} requires Holo Panels ${target} ${expected.minimum} or newer${maximum}; received ${actual}`)
    this.name = 'PluginCompatibilityError'
    this.pluginId = pluginId
  }
}

interface ParsedVersion {
  readonly core: readonly number[]
  readonly prerelease: readonly string[]
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value)
  if (!match) return null

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)],
    prerelease: match[4]?.split('.') ?? [],
  }
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    if (left.length === right.length) return 0
    return left.length === 0 ? 1 : -1
  }

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftIdentifier = left[index]
    const rightIdentifier = right[index]
    if (leftIdentifier === undefined || rightIdentifier === undefined) return leftIdentifier === undefined ? -1 : 1
    if (leftIdentifier === rightIdentifier) continue

    const leftNumeric = /^\d+$/u.test(leftIdentifier)
    const rightNumeric = /^\d+$/u.test(rightIdentifier)
    if (leftNumeric && rightNumeric) return Math.sign(Number(leftIdentifier) - Number(rightIdentifier))
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftIdentifier < rightIdentifier ? -1 : 1
  }

  return 0
}

function compareVersions(left: string, right: string): number | null {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)

  if (!leftParts || !rightParts) {
    return null
  }

  for (let index = 0; index < Math.max(leftParts.core.length, rightParts.core.length); index += 1) {
    const difference = (leftParts.core[index] ?? 0) - (rightParts.core[index] ?? 0)

    if (difference !== 0) {
      return Math.sign(difference)
    }
  }

  return comparePrerelease(leftParts.prerelease, rightParts.prerelease)
}

function supportsVersion(actual: string, range: VersionRange): boolean {
  const minimumComparison = compareVersions(actual, range.minimum)

  if (minimumComparison === null || minimumComparison < 0) {
    return false
  }

  if (!range.maximumExclusive) {
    return true
  }

  const maximumComparison = compareVersions(actual, range.maximumExclusive)
  return maximumComparison !== null && maximumComparison < 0
}

export function assertPluginCompatible(
  pluginId: string,
  compatibility: PluginCompatibility,
  actual: { panels: string; protocol: string },
): void {
  if (!supportsVersion(actual.panels, compatibility.panels)) {
    throw new PluginCompatibilityError(pluginId, 'panels', compatibility.panels, actual.panels)
  }

  if (!supportsVersion(actual.protocol, compatibility.protocol)) {
    throw new PluginCompatibilityError(pluginId, 'protocol', compatibility.protocol, actual.protocol)
  }
}
