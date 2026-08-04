import { access, lstat, mkdir, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url))

export function catalogHoloPackageNames(manifest) {
  const catalog = manifest.workspaces?.catalog
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Panels package.json must declare a workspace catalog')
  const packageNames = Object.keys(catalog)
    .filter(name => name.startsWith('@holo-js/'))
    .sort()
  if (packageNames.length === 0) throw new Error('Panels workspace catalog must declare Holo packages')
  for (const packageName of packageNames) {
    if (!/^@holo-js\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(packageName)) throw new Error(`Unsafe Holo catalog package name: ${packageName}`)
  }
  return Object.freeze(packageNames)
}

const defaultPanelsManifest = JSON.parse(await readFile(join(defaultRepositoryRoot, 'package.json'), 'utf8'))
export const localHoloPackageNames = catalogHoloPackageNames(defaultPanelsManifest)

function assertContainedPath(root, target, message) {
  const pathFromRoot = relative(root, target)
  if (pathFromRoot === '' || pathFromRoot === '..' || pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(pathFromRoot)) {
    throw new Error(`${message}: ${target}`)
  }
}

function validateBinName(name, packageName) {
  if (!/^[A-Za-z0-9._-]+$/u.test(name)) throw new Error(`${packageName} has an unsafe executable name: ${name}`)
}

async function validateSourcePath(packageRoot, source, packageName) {
  const resolvedSource = resolve(packageRoot, source)
  assertContainedPath(packageRoot, resolvedSource, `${packageName} executable must stay inside its package`)
  await access(resolvedSource)
  return resolvedSource
}

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

async function validateTargetParent(target, nodeModulesRoot, allowMissingParent) {
  const resolvedTarget = resolve(target)
  assertContainedPath(nodeModulesRoot, resolvedTarget, 'Refusing local Holo link outside node_modules')
  const parent = dirname(resolvedTarget)

  try {
    const realParent = await realpath(parent)
    assertContainedPath(nodeModulesRoot, realParent, 'Refusing local Holo link through a parent outside node_modules')
    return null
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT' || !allowMissingParent) throw error
    assertContainedPath(nodeModulesRoot, parent, 'Refusing to create a local Holo link parent outside node_modules')
    return parent
  }
}

async function declaredWorkspaceRoots(repositoryRoot, patterns) {
  const roots = []

  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || !/^[^*]+\/\*$/u.test(pattern)) throw new Error(`Unsupported workspace pattern for local Holo linking: ${String(pattern)}`)
    const container = resolve(repositoryRoot, pattern.slice(0, -2))
    assertContainedPath(repositoryRoot, container, 'Workspace container must stay inside the Panels repository')

    for (const entry of await readdir(container, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const workspaceRoot = await realpath(join(container, entry.name))
      assertContainedPath(repositoryRoot, workspaceRoot, 'Workspace must stay inside the Panels repository')
      if (await pathExists(join(workspaceRoot, 'package.json'))) roots.push(workspaceRoot)
    }
  }

  return roots
}

async function existingBunStoreNodeModulesRoots(nodeModulesRoot) {
  const bunStoreCandidate = join(nodeModulesRoot, '.bun')
  if (!await pathExists(bunStoreCandidate)) return []
  const bunStoreRoot = await realpath(bunStoreCandidate)
  assertContainedPath(nodeModulesRoot, bunStoreRoot, 'Bun package store must stay inside node_modules')
  const candidates = [join(bunStoreRoot, 'node_modules')]

  for (const entry of await readdir(bunStoreRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    candidates.push(join(bunStoreRoot, entry.name, 'node_modules'))
  }

  const roots = []
  for (const candidate of candidates) {
    if (!await pathExists(candidate)) continue
    const storeNodeModulesRoot = await realpath(candidate)
    assertContainedPath(bunStoreRoot, storeNodeModulesRoot, 'Bun package node_modules must stay inside its store')
    if (!roots.includes(storeNodeModulesRoot)) roots.push(storeNodeModulesRoot)
  }

  return roots
}

async function existingNodeModulesRoots(repositoryRoot, workspacePatterns) {
  const rootNodeModules = await realpath(join(repositoryRoot, 'node_modules'))
  const roots = [{ nodeModulesRoot: rootNodeModules, root: true }]

  for (const nodeModulesRoot of await existingBunStoreNodeModulesRoots(rootNodeModules)) {
    roots.push({ nodeModulesRoot, root: false })
  }

  for (const workspaceRoot of await declaredWorkspaceRoots(repositoryRoot, workspacePatterns)) {
    const candidate = join(workspaceRoot, 'node_modules')
    if (!await pathExists(candidate)) continue
    const nodeModulesRoot = await realpath(candidate)
    assertContainedPath(workspaceRoot, nodeModulesRoot, 'Workspace node_modules must stay inside its workspace')
    if (!roots.some(entry => entry.nodeModulesRoot === nodeModulesRoot)) roots.push({ nodeModulesRoot, root: false })
  }

  return roots
}

export async function replaceNodeModulesEntry(source, target, nodeModulesRoot, type = 'dir') {
  const resolvedTarget = resolve(target)
  assertContainedPath(nodeModulesRoot, resolvedTarget, 'Refusing local Holo link outside node_modules')
  const targetParent = await realpath(dirname(resolvedTarget))
  assertContainedPath(nodeModulesRoot, targetParent, 'Refusing local Holo link through a parent outside node_modules')

  try {
    await lstat(resolvedTarget)
    await rm(resolvedTarget, { force: true, recursive: true })
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  }

  await symlink(source, resolvedTarget, process.platform === 'win32' && type === 'dir' ? 'junction' : type)
}

export async function createLocalHoloLinkPlan(options = {}) {
  const repositoryRoot = await realpath(resolve(options.repositoryRoot ?? defaultRepositoryRoot))
  const holoRoot = resolve(options.holoRoot ?? process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js'))
  const panelsManifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  const packageNames = catalogHoloPackageNames(panelsManifest)
  if (options.packageNames) throw new Error('Local Holo package selection is derived from the Panels workspace catalog')
  const holoPackagesRoot = await realpath(join(holoRoot, 'packages'))
  const workspacePatterns = panelsManifest.workspaces?.packages
  if (!Array.isArray(workspacePatterns)) throw new Error('Panels package.json must declare workspace package patterns')
  const nodeModulesRoots = await existingNodeModulesRoots(repositoryRoot, workspacePatterns)
  const packages = []

  for (const packageName of packageNames) {
    const directory = packageName.slice('@holo-js/'.length)
    const packageRoot = await realpath(join(holoPackagesRoot, directory))
    assertContainedPath(holoPackagesRoot, packageRoot, `${packageName} source must stay inside the Holo packages directory`)
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    if (manifest.name !== packageName) throw new Error(`Expected ${packageName} at ${packageRoot}`)
    const catalogVersion = panelsManifest.workspaces?.catalog?.[packageName]
    if (catalogVersion !== `^${manifest.version}`) throw new Error(`${packageName} ${manifest.version} does not match Panels catalog ${catalogVersion ?? '(missing)'}`)
    const bins = []
    for (const [name, executable] of Object.entries(manifest.bin ?? {})) {
      validateBinName(name, packageName)
      if (typeof executable !== 'string') throw new Error(`${packageName} executable ${name} must be a package-relative path`)
      bins.push(Object.freeze({ name, source: await validateSourcePath(packageRoot, executable, packageName) }))
    }
    packages.push(Object.freeze({ bins: Object.freeze(bins), directory, packageName, packageRoot }))
  }

  const links = []
  const parentsToCreate = new Set()
  for (const nodeModules of nodeModulesRoots) {
    for (const packageEntry of packages) {
      const packageTarget = join(nodeModules.nodeModulesRoot, '@holo-js', packageEntry.directory)
      if (nodeModules.root || await pathExists(packageTarget)) {
        const missingParent = await validateTargetParent(packageTarget, nodeModules.nodeModulesRoot, nodeModules.root)
        if (missingParent) parentsToCreate.add(missingParent)
        links.push(Object.freeze({
          nodeModulesRoot: nodeModules.nodeModulesRoot,
          packageName: packageEntry.packageName,
          source: packageEntry.packageRoot,
          target: packageTarget,
          type: 'dir',
        }))
      }

      for (const bin of packageEntry.bins) {
        const binTarget = join(nodeModules.nodeModulesRoot, '.bin', bin.name)
        if (!nodeModules.root && !await pathExists(binTarget)) continue
        const missingParent = await validateTargetParent(binTarget, nodeModules.nodeModulesRoot, nodeModules.root)
        if (missingParent) parentsToCreate.add(missingParent)
        links.push(Object.freeze({
          nodeModulesRoot: nodeModules.nodeModulesRoot,
          packageName: packageEntry.packageName,
          source: bin.source,
          target: binTarget,
          type: 'file',
        }))
      }
    }
  }

  return Object.freeze({
    holoRoot,
    links: Object.freeze(links),
    nodeModulesCount: nodeModulesRoots.length,
    packageCount: packages.length,
    parentsToCreate: Object.freeze([...parentsToCreate]),
  })
}

export async function linkLocalHolo(options = {}) {
  const plan = await createLocalHoloLinkPlan(options)
  for (const parent of plan.parentsToCreate) await mkdir(parent, { recursive: true })

  for (const link of plan.links) {
    await replaceNodeModulesEntry(link.source, link.target, link.nodeModulesRoot, link.type)
  }

  return Object.freeze({ holoRoot: plan.holoRoot, linkCount: plan.links.length, nodeModulesCount: plan.nodeModulesCount, packageCount: plan.packageCount })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await linkLocalHolo()
  console.log(`Linked ${result.linkCount} adjacent Holo-JS entries across ${result.nodeModulesCount} node_modules trees from ${result.holoRoot}`)
}
