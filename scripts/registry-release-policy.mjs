export function minimumHoloPatch(holoCompatibilityRange) {
  const match = /^\^0\.3\.(\d+)$/u.exec(holoCompatibilityRange)
  if (match === null) {
    throw new Error(`Registry acceptance requires a bounded Holo-JS 0.3.x compatibility range, received ${holoCompatibilityRange}`)
  }
  return Number.parseInt(match[1], 10)
}

export function isCompatibleHoloVersion(version, holoCompatibilityRange) {
  const match = /^0\.3\.(\d+)$/u.exec(version)
  return match !== null && Number.parseInt(match[1], 10) >= minimumHoloPatch(holoCompatibilityRange)
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
