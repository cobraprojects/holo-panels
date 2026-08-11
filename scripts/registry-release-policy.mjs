export function minimumHoloPatch(holoCompatibilityRange) {
  const match = /^>=0\.3\.(\d+)$/u.exec(holoCompatibilityRange)
  if (match === null) {
    throw new Error(`Registry acceptance requires an unbounded Holo-JS compatibility floor, received ${holoCompatibilityRange}`)
  }
  return Number.parseInt(match[1], 10)
}

export function isCompatibleHoloVersion(version, holoCompatibilityRange) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version)
  if (match === null) return false
  const candidate = match.slice(1).map(part => Number.parseInt(part, 10))
  const minimum = [0, 3, minimumHoloPatch(holoCompatibilityRange)]
  for (let index = 0; index < minimum.length; index += 1) {
    if (candidate[index] !== minimum[index]) return candidate[index] > minimum[index]
  }
  return true
}

export function assertRegistryDependencyGraph(projectName, lockfile, overrides) {
  if (typeof overrides !== 'undefined') {
    throw new Error(`Registry fixture ${projectName} must not use dependency overrides`)
  }
  if (/(?:file|link|workspace):/u.test(lockfile)) {
    throw new Error(`Registry fixture ${projectName} contains a local dependency reference`)
  }
}

export function assertRegistryPackageVersion(packageName, version, panelsVersion, holoCompatibilityRange) {
  if (packageName.startsWith('@holo-js/panels')) {
    if (version !== panelsVersion) {
      throw new Error(`${packageName} resolved to ${version} instead of ${panelsVersion}`)
    }
    return
  }
  if (!isCompatibleHoloVersion(version, holoCompatibilityRange)) {
    throw new Error(`${packageName} ${version} is outside ${holoCompatibilityRange}`)
  }
}
