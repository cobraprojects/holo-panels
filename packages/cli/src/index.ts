import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { generatorCommands, publishUiCommand } from './commands'
import type { GeneratorProject } from './generators'
import { watchPanelTheme, writePanelTheme } from './theme'

export {
  planFrameworkArtifacts,
  printFrameworkArtifactConflicts,
} from './framework'
export type {
  DiscoveredPanelAppearance,
  DiscoveredPanelPath,
  ExistingFrameworkArtifact,
  FrameworkArtifactConflict,
  FrameworkArtifactDirectories,
  FrameworkArtifactKind,
  FrameworkArtifactManifest,
  FrameworkArtifactOwnership,
  FrameworkArtifactPlan,
  FrameworkArtifactWrite,
  PlanFrameworkArtifactsInput,
} from './framework'
export {
  DiscoveryCompiler,
  PanelsDiscoveryError,
  createProjectDiscoveryModuleLoader,
} from './discovery'
export type {
  DiscoveredDefinition,
  DiscoveryChange,
  DiscoveryCompilerOptions,
  DiscoveryModule,
  DiscoveryModuleLoader,
  DiscoveryResult,
  GeneratedPanelArtifact,
  DiscoveredRelationManagerTypeBinding,
  DiscoveredResourceTypeBinding,
} from './discovery'
export {
  PANEL_ARTIFACT_NAMES,
  loadGeneratedPanelsRegistry,
  parseGeneratedPanelsRegistry,
  renderPanelArtifacts,
} from './generated'
export type { GeneratedPanelsRegistry } from './generated'
export { buildPanelTheme, PANEL_THEME_ARTIFACT_PATH, PANEL_THEME_CUSTOMIZATION_PATH } from './theme'

const PANELS_PACKAGE = '@holo-js/panels'
const OWNERSHIP_PATH = '.holo-js/panels/install.json'
const FRAMEWORK_DESCRIPTOR_PATH = '.holo-js/framework/project.json'
const LOCKFILE_PATHS = Object.freeze(['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'])

export type FrameworkId = 'next' | 'nuxt' | 'sveltekit'
type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

type CommandFlagValue = string | boolean | number | readonly string[]

type PanelsCommandContext = {
  readonly projectRoot: string
  readonly cwd: string
  readonly args: readonly string[]
  readonly flags: Readonly<Record<string, CommandFlagValue>>
  loadProject(): Promise<GeneratorProject>
}

type PanelsCommand = {
  readonly name: string
  readonly description: string
  readonly usage: string
  run(context: PanelsCommandContext): Promise<void>
}

type PackageManifest = {
  readonly packageManager?: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

type MutablePackageManifest = {
  packageManager?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type InstallOwnership = {
  readonly version: 1
  readonly adapter: string
  readonly adapterSpecifier: string
  readonly dependencySection: 'dependencies'
  readonly dependencyOwned: boolean
  readonly managedArtifacts: readonly string[]
}

type FileSnapshot = {
  readonly path: string
  readonly contents?: Uint8Array
}

type FrameworkDefinition = {
  readonly adapter: string
  readonly packages: readonly string[]
}

const FRAMEWORKS: Readonly<Record<FrameworkId, FrameworkDefinition>> = Object.freeze({
  next: Object.freeze({
    adapter: '@holo-js/panels-next',
    packages: Object.freeze(['next', '@holo-js/adapter-next']),
  }),
  nuxt: Object.freeze({
    adapter: '@holo-js/panels-nuxt',
    packages: Object.freeze(['nuxt', '@holo-js/adapter-nuxt']),
  }),
  sveltekit: Object.freeze({
    adapter: '@holo-js/panels-sveltekit',
    packages: Object.freeze(['@sveltejs/kit', '@holo-js/adapter-sveltekit']),
  }),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePackageManifest(contents: string): MutablePackageManifest {
  const value = JSON.parse(contents) as unknown
  if (!isRecord(value)) throw new Error('[Holo Panels] package.json must contain an object.')

  const manifest = value as MutablePackageManifest
  for (const key of ['dependencies', 'devDependencies'] as const) {
    const dependencies = manifest[key]
    if (typeof dependencies !== 'undefined' && !isRecord(dependencies)) {
      throw new Error(`[Holo Panels] package.json ${key} must contain an object.`)
    }
  }
  return manifest
}

function allDependencies(manifest: PackageManifest): Readonly<Record<string, string>> {
  return Object.freeze({
    ...manifest.devDependencies,
    ...manifest.dependencies,
  })
}

function frameworksFromDependencies(manifest: PackageManifest): readonly FrameworkId[] {
  const dependencies = allDependencies(manifest)
  return (Object.entries(FRAMEWORKS) as readonly [FrameworkId, FrameworkDefinition][])
    .filter(([, definition]) => definition.packages.some(packageName => packageName in dependencies))
    .map(([framework]) => framework)
}

function detectFrameworkFromDependencies(manifest: PackageManifest): FrameworkId {
  const detected = frameworksFromDependencies(manifest)

  if (detected.length === 0) {
    throw new Error('[Holo Panels] Cannot detect Next.js, Nuxt, or SvelteKit from project dependencies.')
  }
  if (detected.length > 1) {
    throw new Error(`[Holo Panels] Multiple frameworks detected: ${detected.join(', ')}.`)
  }
  return detected[0]!
}

function detectPackageManager(manifest: PackageManifest, existingFiles: ReadonlySet<string>): PackageManager {
  if (manifest.packageManager) {
    const name = manifest.packageManager.split('@', 1)[0]
    if (name === 'bun' || name === 'npm' || name === 'pnpm' || name === 'yarn') return name
    throw new Error(`[Holo Panels] Unsupported package manager: ${name}.`)
  }

  const lockfiles: readonly [PackageManager, string][] = [
    ['bun', 'bun.lock'],
    ['bun', 'bun.lockb'],
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['npm', 'package-lock.json'],
  ]
  return lockfiles.find(([, lockfile]) => existingFiles.has(lockfile))?.[0] ?? 'bun'
}

function isExactVersion(value: string): boolean {
  const number = '(?:0|[1-9]\\d*)'
  const identifier = '(?:0|[1-9]\\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)'
  const buildIdentifier = '[0-9A-Za-z-]+'
  return new RegExp(`^${number}\\.${number}\\.${number}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+${buildIdentifier}(?:\\.${buildIdentifier})*)?$`).test(value)
}

async function installedPackageVersion(projectRoot: string, packageName: string): Promise<string> {
  const packageJsonPath = resolveProjectPath(projectRoot, `node_modules/${packageName}/package.json`)
  const contents = await readOptional(packageJsonPath)
  if (!contents) throw new Error(`[Holo Panels] Cannot read the installed ${packageName} package manifest.`)
  const manifest = JSON.parse(contents) as unknown
  const name = isRecord(manifest) && typeof manifest.name === 'string' ? manifest.name.trim() : ''
  const version = isRecord(manifest) && typeof manifest.version === 'string' ? manifest.version.trim() : ''
  if (name !== packageName || !isExactVersion(version)) {
    throw new Error(`[Holo Panels] Installed ${packageName} package manifest has an invalid name or version.`)
  }
  return version
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeOutput(message: string): void {
  process.stdout.write(`${message}\n`)
}

async function atomicWrite(projectRoot: string, path: string, contents: string | Uint8Array): Promise<void> {
  await assertNoSymlinks(projectRoot, path)
  await mkdir(dirname(path), { recursive: true })
  await assertNoSymlinks(projectRoot, path)
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

function resolveProjectPath(projectRoot: string, projectRelativePath: string): string {
  const root = resolve(projectRoot)
  const target = resolve(root, projectRelativePath)
  const relativePath = relative(root, target)
  if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    throw new Error(`[Holo Panels] Invalid project-relative path: ${projectRelativePath}.`)
  }
  return target
}

async function assertNoSymlinks(projectRoot: string, targetPath: string): Promise<void> {
  const root = resolve(projectRoot)
  const target = resolveProjectPath(root, targetPath)
  const pathSegments = relative(root, target).split(sep)
  let currentPath = root
  for (const [index, segment] of pathSegments.entries()) {
    currentPath = join(currentPath, segment)
    try {
      const metadata = await lstat(currentPath)
      if (metadata.isSymbolicLink()) {
        throw new Error(`[Holo Panels] Refusing symlinked project path: ${relative(root, currentPath)}.`)
      }
      if (index < pathSegments.length - 1 && !metadata.isDirectory()) {
        throw new Error(`[Holo Panels] Project path parent is not a directory: ${relative(root, currentPath)}.`)
      }
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function existingProjectFiles(projectRoot: string): Promise<ReadonlySet<string>> {
  const existing = await Promise.all(LOCKFILE_PATHS.map(async (candidate) => {
    try {
      await access(resolveProjectPath(projectRoot, candidate), constants.F_OK)
      return candidate
    } catch {
      return undefined
    }
  }))
  return new Set(existing.filter((value): value is string => typeof value === 'string'))
}

async function detectFramework(projectRoot: string, manifest: PackageManifest): Promise<FrameworkId> {
  const descriptorPath = resolveProjectPath(projectRoot, FRAMEWORK_DESCRIPTOR_PATH)
  await assertNoSymlinks(projectRoot, descriptorPath)
  const descriptorContents = await readOptional(descriptorPath)
  if (!descriptorContents) return detectFrameworkFromDependencies(manifest)

  let descriptor: unknown
  try {
    descriptor = JSON.parse(descriptorContents) as unknown
  } catch {
    throw new Error(`[Holo Panels] Invalid framework descriptor JSON at ${FRAMEWORK_DESCRIPTOR_PATH}.`)
  }
  const framework = isRecord(descriptor) ? descriptor.framework : undefined
  if (framework !== 'next' && framework !== 'nuxt' && framework !== 'sveltekit') {
    throw new Error(`[Holo Panels] Invalid framework descriptor at ${FRAMEWORK_DESCRIPTOR_PATH}.`)
  }
  const dependencyFrameworks = frameworksFromDependencies(manifest)
  if (dependencyFrameworks.length > 1) {
    throw new Error(`[Holo Panels] Multiple frameworks detected: ${dependencyFrameworks.join(', ')}.`)
  }
  if (dependencyFrameworks.length === 1 && dependencyFrameworks[0] !== framework) {
    throw new Error(`[Holo Panels] Framework descriptor ${framework} conflicts with detected ${dependencyFrameworks[0]} dependency.`)
  }
  return framework
}

async function resolveAppConfigPath(projectRoot: string, manifestPath?: string): Promise<string> {
  if (manifestPath) return resolveProjectPath(projectRoot, manifestPath)
  for (const candidate of ['config/app.ts', 'config/app.mts', 'config/app.js', 'config/app.mjs']) {
    const path = resolveProjectPath(projectRoot, candidate)
    if (await readOptional(path)) return path
  }
  throw new Error('[Holo Panels] Missing config/app.(ts|mts|js|mjs). Run holo plugin:add @holo-js/panels first.')
}

async function assertPanelsActivation(projectRoot: string, manifestPath?: string): Promise<void> {
  const appConfigPath = await resolveAppConfigPath(projectRoot, manifestPath)
  const contents = await readOptional(appConfigPath)
  if (!contents) throw new Error(`[Holo Panels] App config does not exist: ${appConfigPath}.`)
  const pluginBlocks = [...contents.matchAll(/(?:^|[\n,{])\s*(?:"plugins"|plugins):\s*\[([\s\S]*?)\]/g)]
  const pluginNames = pluginBlocks.flatMap(match => [...(match[1] ?? '').matchAll(/(['"])(.*?)\1/g)])
    .map(match => match[2]?.trim())
  if (pluginBlocks.length !== 1 || pluginNames.filter(name => name === PANELS_PACKAGE).length !== 1) {
    throw new Error(`[Holo Panels] ${PANELS_PACKAGE} must appear exactly once in config/app.ts plugins. Run holo plugin:add ${PANELS_PACKAGE} first.`)
  }
}

async function runPackageInstall(projectRoot: string, packageManager: PackageManager): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(packageManager, ['install'], {
      cwd: projectRoot,
      shell: false,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(`[Holo Panels] ${packageManager} install failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`))
    })
  })
}

async function readOwnership(projectRoot: string, umbrellaVersion: string): Promise<InstallOwnership | undefined> {
  const ownershipPath = resolveProjectPath(projectRoot, OWNERSHIP_PATH)
  await assertNoSymlinks(projectRoot, ownershipPath)
  const contents = await readOptional(ownershipPath)
  if (!contents) return undefined
  const value = JSON.parse(contents) as unknown
  if (!isRecord(value)
    || value.version !== 1
    || typeof value.adapter !== 'string'
    || !Object.values(FRAMEWORKS).some(framework => framework.adapter === value.adapter)
    || typeof value.adapterSpecifier !== 'string'
    || !isExactVersion(value.adapterSpecifier)
    || value.adapterSpecifier !== umbrellaVersion
    || value.dependencySection !== 'dependencies'
    || typeof value.dependencyOwned !== 'boolean'
    || !Array.isArray(value.managedArtifacts)
    || value.managedArtifacts.length !== 0) {
    throw new Error(`[Holo Panels] Invalid install ownership state at ${OWNERSHIP_PATH}.`)
  }
  return value as InstallOwnership
}

async function assertInstalledAdapter(projectRoot: string, adapter: string, umbrellaVersion: string): Promise<void> {
  const version = await installedPackageVersion(projectRoot, adapter)
  if (version !== umbrellaVersion) {
    throw new Error(`[Holo Panels] Installed ${adapter} version ${version} does not match ${PANELS_PACKAGE} ${umbrellaVersion}.`)
  }
}

async function snapshotFiles(projectRoot: string): Promise<readonly FileSnapshot[]> {
  const paths = ['package.json', OWNERSHIP_PATH, ...LOCKFILE_PATHS]
  return await Promise.all(paths.map(async (projectPath) => {
    const path = resolveProjectPath(projectRoot, projectPath)
    await assertNoSymlinks(projectRoot, path)
    try {
      return Object.freeze({ path, contents: new Uint8Array(await readFile(path)) })
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return Object.freeze({ path })
      throw error
    }
  }))
}

async function restoreFiles(projectRoot: string, snapshots: readonly FileSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    await assertNoSymlinks(projectRoot, snapshot.path)
    if (snapshot.contents) await atomicWrite(projectRoot, snapshot.path, snapshot.contents)
    else await rm(snapshot.path, { force: true })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function recoverOriginalInstall(
  projectRoot: string,
  packageManager: PackageManager,
  snapshots: readonly FileSnapshot[],
  operationError: unknown,
): Promise<never> {
  try {
    await restoreFiles(projectRoot, snapshots)
    await runPackageInstall(projectRoot, packageManager)
  } catch (recoveryError) {
    throw new Error(`[Holo Panels] Operation failed and dependency recovery failed: ${errorMessage(recoveryError)}. Original error: ${errorMessage(operationError)}`)
  }
  throw operationError
}

function removeOwnedDependency(manifest: MutablePackageManifest, ownership: InstallOwnership): boolean {
  if (manifest.dependencies?.[ownership.adapter] === ownership.adapterSpecifier) {
    delete manifest.dependencies[ownership.adapter]
    if (Object.keys(manifest.dependencies).length === 0) delete manifest.dependencies
    return true
  }
  return false
}

async function install(context: PanelsCommandContext): Promise<void> {
  const projectRoot = resolve(context.projectRoot)
  const project = await context.loadProject()
  await assertPanelsActivation(projectRoot, project.manifestPath)
  const packageJsonPath = resolveProjectPath(projectRoot, 'package.json')
  await assertNoSymlinks(projectRoot, packageJsonPath)
  const originalPackageJson = await readFile(packageJsonPath, 'utf8')
  const manifest = parsePackageManifest(originalPackageJson)
  const framework = await detectFramework(projectRoot, manifest)
  const adapter = FRAMEWORKS[framework].adapter
  const otherAdapters = Object.values(FRAMEWORKS).map(item => item.adapter).filter(name => name !== adapter)
  const dependencies = allDependencies(manifest)
  const conflictingAdapter = otherAdapters.find(name => name in dependencies)
  if (conflictingAdapter) {
    throw new Error(`[Holo Panels] ${conflictingAdapter} conflicts with detected ${framework} framework.`)
  }

  const umbrellaVersion = await installedPackageVersion(projectRoot, PANELS_PACKAGE)
  const existingOwnership = await readOwnership(projectRoot, umbrellaVersion)
  if (existingOwnership && existingOwnership.adapter !== adapter) {
    throw new Error(`[Holo Panels] Existing installation owns ${existingOwnership.adapter}; uninstall it before changing frameworks.`)
  }

  const dependencyOwned = !(adapter in dependencies)
  const specifier = existingOwnership?.adapterSpecifier ?? umbrellaVersion
  if (!dependencyOwned) await assertInstalledAdapter(projectRoot, adapter, umbrellaVersion)
  const ownership: InstallOwnership = Object.freeze({
    version: 1,
    adapter,
    adapterSpecifier: specifier,
    dependencySection: 'dependencies',
    dependencyOwned: existingOwnership?.dependencyOwned ?? dependencyOwned,
    managedArtifacts: Object.freeze([...(existingOwnership?.managedArtifacts ?? [])]),
  })
  const ownershipContents = serializeJson(ownership)
  const ownershipPath = resolveProjectPath(projectRoot, OWNERSHIP_PATH)
  const oldOwnershipContents = await readOptional(ownershipPath)

  if (!dependencyOwned && oldOwnershipContents === ownershipContents) {
    writeOutput(`[Holo Panels] Already installed for ${framework}; no changes.`)
    return
  }

  if (dependencyOwned) {
    manifest.dependencies = { ...manifest.dependencies, [adapter]: specifier }
    manifest.dependencies = Object.fromEntries(Object.entries(manifest.dependencies).sort(([left], [right]) => left.localeCompare(right)))
  }

  const packageManager = detectPackageManager(manifest, await existingProjectFiles(projectRoot))
  const snapshots = await snapshotFiles(projectRoot)
  try {
    if (dependencyOwned) {
      await atomicWrite(projectRoot, packageJsonPath, serializeJson(manifest))
      await runPackageInstall(projectRoot, packageManager)
      await assertInstalledAdapter(projectRoot, adapter, umbrellaVersion)
    }
    await atomicWrite(projectRoot, ownershipPath, ownershipContents)
  } catch (error) {
    await recoverOriginalInstall(projectRoot, packageManager, snapshots, error)
  }

  writeOutput(`[Holo Panels] Installed ${adapter} for ${framework}.`)
}

async function uninstall(context: PanelsCommandContext): Promise<void> {
  const projectRoot = resolve(context.projectRoot)
  await context.loadProject()
  const umbrellaVersion = await installedPackageVersion(projectRoot, PANELS_PACKAGE)
  const ownership = await readOwnership(projectRoot, umbrellaVersion)
  if (!ownership) {
    writeOutput('[Holo Panels] No owned installation changes found. Preserved plugin activation and user files.')
    return
  }

  const packageJsonPath = resolveProjectPath(projectRoot, 'package.json')
  await assertNoSymlinks(projectRoot, packageJsonPath)
  const manifest = parsePackageManifest(await readFile(packageJsonPath, 'utf8'))
  const dependencyRemoved = ownership.dependencyOwned && removeOwnedDependency(manifest, ownership)

  const packageManager = detectPackageManager(manifest, await existingProjectFiles(projectRoot))
  const snapshots = await snapshotFiles(projectRoot)
  try {
    if (dependencyRemoved) {
      await atomicWrite(projectRoot, packageJsonPath, serializeJson(manifest))
      await runPackageInstall(projectRoot, packageManager)
    }
    const ownershipPath = resolveProjectPath(projectRoot, OWNERSHIP_PATH)
    await assertNoSymlinks(projectRoot, ownershipPath)
    await rm(ownershipPath, { force: true })
  } catch (error) {
    await recoverOriginalInstall(projectRoot, packageManager, snapshots, error)
  }

  const adapterResult = dependencyRemoved
    ? `Removed owned ${ownership.adapter} installation.`
    : `Preserved modified or externally owned ${ownership.adapter} dependency.`
  writeOutput(`[Holo Panels] ${adapterResult} Preserved ${PANELS_PACKAGE} activation, panel/resource files, and published UI.`)
}

export const commands: readonly PanelsCommand[] = Object.freeze([
  Object.freeze({
    name: 'panels:install',
    description: 'Install Holo Panels for the detected application framework.',
    usage: 'holo panels:install',
    run: install,
  }),
  Object.freeze({
    name: 'panels:uninstall',
    description: 'Remove only files and dependencies owned by the Holo Panels installer.',
    usage: 'holo panels:uninstall',
    run: uninstall,
  }),
  Object.freeze({
    name: 'panels:theme:build',
    description: 'Build the isolated Holo Panels stylesheet.',
    usage: 'holo panels:theme:build',
    async run(context: PanelsCommandContext) {
      const output = await writePanelTheme({ projectRoot: context.projectRoot })
      writeOutput(`[Holo Panels] Built panel theme at ${relative(context.projectRoot, output)}.`)
    },
  }),
  Object.freeze({
    name: 'panels:theme:watch',
    description: 'Watch panel customization sources and rebuild the isolated stylesheet.',
    usage: 'holo panels:theme:watch',
    run: (context: PanelsCommandContext) => watchPanelTheme({ projectRoot: context.projectRoot }),
  }),
  publishUiCommand,
  ...generatorCommands,
])

export default commands
