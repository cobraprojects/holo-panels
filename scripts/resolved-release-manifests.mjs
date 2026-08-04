import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function packageManifestPaths(root) {
  const packagesRoot = join(root, 'packages')
  const entries = await readdir(packagesRoot, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(packagesRoot, entry.name, 'package.json'))
    .sort()
}

export function resolveReleaseManifest(manifest, catalog, workspaceVersions) {
  const resolvedManifest = structuredClone(manifest)

  for (const sectionName of dependencySections) {
    const dependencies = resolvedManifest[sectionName]
    if (!isRecord(dependencies)) continue

    for (const [packageName, sourceRange] of Object.entries(dependencies)) {
      if (sourceRange === 'catalog:') {
        const catalogRange = catalog[packageName]
        if (typeof catalogRange !== 'string') {
          throw new Error(`Cannot resolve catalog range for ${manifest.name} ${sectionName}.${packageName}`)
        }
        dependencies[packageName] = catalogRange
      } else if (sourceRange === 'workspace:*') {
        const workspaceVersion = workspaceVersions.get(packageName)
        if (typeof workspaceVersion !== 'string') {
          throw new Error(`Cannot resolve workspace range for ${manifest.name} ${sectionName}.${packageName}`)
        }
        dependencies[packageName] = workspaceVersion
      } else if (typeof sourceRange === 'string' && sourceRange.startsWith('workspace:')) {
        throw new Error(`Unsupported workspace range for ${manifest.name} ${sectionName}.${packageName}: ${sourceRange}`)
      }
    }
  }

  return resolvedManifest
}

export async function withResolvedReleaseManifests(callback, options = {}) {
  const root = resolve(options.root ?? fileURLToPath(new URL('../', import.meta.url)))
  const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const catalog = rootManifest.workspaces?.catalog
  if (!isRecord(catalog)) throw new Error('Root package.json is missing workspaces.catalog')

  const manifestPaths = await packageManifestPaths(root)
  const originals = new Map()
  for (const manifestPath of manifestPaths) {
    const contents = await readFile(manifestPath, 'utf8')
    originals.set(manifestPath, contents)
  }

  const manifests = new Map([...originals].map(([manifestPath, contents]) => [
    manifestPath,
    JSON.parse(contents),
  ]))
  const workspaceVersions = new Map([...manifests.values()].map(manifest => {
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      throw new Error('Every release package must declare a name and version')
    }
    return [manifest.name, manifest.version]
  }))
  const resolvedManifests = new Map([...manifests].map(([manifestPath, manifest]) => [
    manifestPath,
    resolveReleaseManifest(manifest, catalog, workspaceVersions),
  ]))

  let operationError
  let operationFailed = false
  let operationResult
  try {
    for (const [manifestPath, manifest] of resolvedManifests) {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    }
    operationResult = await callback()
  } catch (error) {
    operationFailed = true
    operationError = error
  }

  const restorationResults = await Promise.allSettled([...originals].map(([manifestPath, contents]) => (
    writeFile(manifestPath, contents)
  )))
  const restorationErrors = restorationResults.flatMap(result => (
    result.status === 'rejected' ? [result.reason] : []
  ))
  if (restorationErrors.length > 0) {
    throw new AggregateError(
      operationFailed ? [operationError, ...restorationErrors] : restorationErrors,
      `Failed to restore ${restorationErrors.length} release package manifest(s)`,
    )
  }

  if (operationFailed) throw operationError
  return operationResult
}
