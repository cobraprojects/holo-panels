export const unresolvedPublishedRangePrefixes = Object.freeze(['catalog:', 'workspace:', 'file:', 'link:'])

function parseStableVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value)
  return match
    ? match.slice(1).map(part => Number.parseInt(part, 10))
    : undefined
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index]
    if (difference !== 0) return difference
  }
  return 0
}

export function satisfiesCaretRange(range, version) {
  const minimum = typeof range === 'string' && range.startsWith('^')
    ? parseStableVersion(range.slice(1))
    : undefined
  const candidate = parseStableVersion(version)
  if (!minimum || !candidate || compareVersions(candidate, minimum) < 0) return false

  const [major, minor, patch] = minimum
  const maximum = major > 0
    ? [major + 1, 0, 0]
    : minor > 0
      ? [0, minor + 1, 0]
      : [0, 0, patch + 1]
  return compareVersions(candidate, maximum) < 0
}

export function validatePublishedDependencyRanges(packageName, manifest, workspacePackageNames, catalog) {
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dependencyName, range] of Object.entries(manifest[field] ?? {})) {
      if (unresolvedPublishedRangePrefixes.some(prefix => range.startsWith(prefix))) {
        throw new Error(`${packageName} packed ${field}.${dependencyName} has unresolved range ${range}`)
      }
      if (workspacePackageNames.has(dependencyName) && range !== manifest.version) {
        throw new Error(`${packageName} packed internal dependency ${dependencyName} must equal ${manifest.version}`)
      }
      if (dependencyName.startsWith('@holo-js/') && !dependencyName.startsWith('@holo-js/panels')) {
        const expectedRange = catalog[dependencyName]
        if (expectedRange !== undefined && range !== expectedRange) {
          throw new Error(`${packageName} packed Holo dependency ${dependencyName} must use ${expectedRange}`)
        }
      }
    }
  }
}
