import { spawnSync } from 'node:child_process'
import { readFile, readdir, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

export function orderBuildPackages(packages) {
  const packagesByName = new Map()
  for (const entry of packages) {
    if (packagesByName.has(entry.name)) {
      throw new Error(`Duplicate Holo package name: ${entry.name}`)
    }
    packagesByName.set(entry.name, entry)
  }

  const visiting = new Set()
  const visited = new Set()
  const ordered = []

  function visit(packageName, ancestry) {
    if (visited.has(packageName)) return
    if (visiting.has(packageName)) {
      throw new Error(`Cyclic Holo build dependency: ${[...ancestry, packageName].join(' -> ')}`)
    }

    const entry = packagesByName.get(packageName)
    if (!entry) return
    visiting.add(packageName)
    for (const dependencyName of [...entry.dependencies].sort()) {
      visit(dependencyName, [...ancestry, packageName])
    }
    visiting.delete(packageName)
    visited.add(packageName)
    ordered.push(entry)
  }

  for (const packageName of [...packagesByName.keys()].sort()) {
    visit(packageName, [])
  }
  return ordered
}

export async function loadBuildPackages(holoRoot) {
  const canonicalHoloRoot = await realpath(holoRoot)
  const packagesRoot = resolve(canonicalHoloRoot, 'packages')
  const entries = await readdir(packagesRoot, { withFileTypes: true })
  const packages = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue
    const packageRoot = await realpath(resolve(packagesRoot, entry.name))
    if (!packageRoot.startsWith(`${packagesRoot}${sep}`)) {
      throw new Error(`Holo package escapes its packages directory: ${entry.name}`)
    }
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
    if (!manifest.name?.startsWith('@holo-js/') || typeof manifest.scripts?.build !== 'string') continue
    packages.push({
      dependencies: new Set(Object.keys({
        ...manifest.dependencies,
        ...manifest.optionalDependencies,
        ...manifest.peerDependencies,
      })),
      name: manifest.name,
      packageRoot,
    })
  }

  return orderBuildPackages(packages)
}

export async function buildCompatibleHolo(holoRoot, spawn = spawnSync) {
  const packages = await loadBuildPackages(holoRoot)
  for (const entry of packages) {
    const result = spawn('bun', ['run', 'build'], {
      cwd: entry.packageRoot,
      stdio: 'inherit',
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(`Failed to build ${entry.name} with status ${result.status ?? 'unknown'}`)
    }
  }
  console.log(`Built ${packages.length} Holo packages in dependency order`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (invokedPath === import.meta.url) {
  await buildCompatibleHolo(resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js')))
}
