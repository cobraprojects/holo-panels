import { lstat, readdir } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import type { ComponentDefault, ComponentDefaultLayers } from '@holo-js/panels-core'
import { PanelsDiscoveryError } from './error'
import { isDiscoverableBuilder, isDiscoverableDefinition } from './markers'
import type {
  ClientManifestValue,
  DiscoverableDefinition,
  DiscoverableKind,
  DiscoveredDefinition,
  DiscoveryChange,
  DiscoveryCompilerOptions,
  DiscoveryModule,
  DiscoveryResult,
} from './types'
import { renderPanelArtifacts } from '../generated/render'

const supportedExtensions = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'])
const ignoredDirectories = new Set(['coverage', 'dist', 'build', 'node_modules'])
const nestedDirectoryKinds: Readonly<Record<string, DiscoverableKind>> = Object.freeze({
  pages: 'page',
  'relation-managers': 'relation-manager',
  widgets: 'widget',
})

interface LoadedExport {
  readonly exportName: string
  readonly definition: DiscoverableDefinition
}

interface Candidate {
  readonly absolutePath: string
  readonly projectPath: string
  readonly panelId?: string
  readonly expectedKind: DiscoverableKind
}

function componentDefaults(value: unknown): readonly ComponentDefault[] {
  if (typeof value !== 'object' || value === null || !('defaults' in value)) return []
  const defaults = value.defaults
  if (!Array.isArray(defaults)) throw new PanelsDiscoveryError('PANELS_DISCOVERY_DEFAULTS_INVALID', 'Panels configuration defaults must be an array.')
  for (const item of defaults) {
    if (typeof item !== 'object' || item === null || typeof Reflect.get(item, 'apply') !== 'function'
      || typeof Reflect.get(item, 'kind') !== 'string' || typeof Reflect.get(item, 'type') !== 'string') {
      throw new PanelsDiscoveryError('PANELS_DISCOVERY_DEFAULTS_INVALID', 'Panels configuration contains an invalid component default.')
    }
  }
  return defaults as readonly ComponentDefault[]
}

function panelComponentDefaultLayers(
  application: readonly ComponentDefault[],
  panel: DiscoverableDefinition,
): ComponentDefaultLayers {
  const server = panel.server
  if (typeof server !== 'object' || server === null) return { application }
  const panelDefaults = componentDefaults(server)
  const plugins = Reflect.get(server, 'plugins')
  const pluginDefaults = Array.isArray(plugins)
    ? plugins.map((plugin): readonly ComponentDefault[] => {
        if (typeof plugin !== 'object' || plugin === null) return []
        const contributions = Reflect.get(plugin, 'contributions')
        if (!Array.isArray(contributions)) return []
        return contributions.flatMap(contribution => typeof contribution === 'object'
          && contribution !== null
          && Reflect.get(contribution, 'kind') === 'default'
          ? componentDefaults({ defaults: [Reflect.get(contribution, 'default')] })
          : [])
      })
    : []
  return { application, panel: panelDefaults, plugins: pluginDefaults }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeProjectPath(projectRoot: string, absolutePath: string): string {
  return relative(projectRoot, absolutePath).split(sep).join('/')
}

function resolveProjectPath(projectRoot: string, projectPath: string): string {
  const root = resolve(projectRoot)
  const target = resolve(root, projectPath)
  const relativePath = relative(root, target)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || relativePath.length === 0) {
    throw new PanelsDiscoveryError('PANELS_DISCOVERY_PATH_INVALID', `Discovery path must stay within the project: ${projectPath}.`)
  }
  return target
}

function isIgnoredFile(name: string): boolean {
  const extension = extname(name)
  const stem = name.slice(0, name.length - extension.length)
  return !supportedExtensions.has(extension)
    || name.endsWith('.d.ts')
    || name.endsWith('.d.mts')
    || name.endsWith('.d.cts')
    || stem.endsWith('.test')
    || stem.endsWith('.spec')
}

function isIgnoredDirectory(name: string): boolean {
  return name.startsWith('.') || ignoredDirectories.has(name)
}

async function collectFiles(root: string): Promise<readonly string[]> {
  const metadata = await lstat(root).catch(() => undefined)
  if (!metadata || !metadata.isDirectory() || metadata.isSymbolicLink()) return []

  const files: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  entries.sort((left, right) => compareText(left.name, right.name))
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) {
      if (!isIgnoredDirectory(entry.name)) files.push(...await collectFiles(path))
    } else if (entry.isFile() && !isIgnoredFile(entry.name)) {
      files.push(path)
    }
  }
  return files
}

function selectModuleExport(moduleValue: DiscoveryModule, projectPath: string): LoadedExport | undefined {
  const compile = (value: unknown): DiscoverableDefinition | undefined => {
    const definition = isDiscoverableBuilder(value)
      ? value.compileDiscoveryDefinition()
      : value
    return isDiscoverableDefinition(definition) ? definition : undefined
  }

  for (const [exportName, value] of Object.entries(moduleValue)) {
    if (typeof value === 'object'
      && value !== null
      && 'discoveryMarker' in value
      && value.discoveryMarker === '@holo-js/panels/discovery/v1'
      && !isDiscoverableDefinition(value)
      && !isDiscoverableBuilder(value)) {
      throw new PanelsDiscoveryError('PANELS_DISCOVERY_MARKER_INVALID', 'Marked definition has an invalid discovery contract.', { path: projectPath, exportName })
    }
  }

  const defaultDefinition = compile(moduleValue.default)
  if (defaultDefinition) {
    return { exportName: 'default', definition: defaultDefinition }
  }

  const marked = Object.entries(moduleValue)
    .flatMap(([exportName, value]): readonly LoadedExport[] => {
      const definition = compile(value)
      return exportName !== 'default' && definition
        ? [{ exportName, definition }]
        : []
    })
    .sort((left, right) => compareText(left.exportName, right.exportName))

  if (marked.length > 1) {
    throw new PanelsDiscoveryError(
      'PANELS_DISCOVERY_EXPORT_AMBIGUOUS',
      `Definition module has multiple marked named exports: ${marked.map(item => item.exportName).join(', ')}. Add a marked default export or leave one marked named export.`,
      { path: projectPath },
    )
  }
  return marked[0]
}

function assertClientSafe(
  value: unknown,
  projectPath: string,
  exportName: string,
  seen = new Set<object>(),
  location = 'client',
): asserts value is ClientManifestValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (typeof value !== 'object') {
    throw new PanelsDiscoveryError('PANELS_DISCOVERY_CLIENT_UNSAFE', `Client manifest value ${location} is not JSON-safe.`, { path: projectPath, exportName })
  }
  if (seen.has(value)) {
    throw new PanelsDiscoveryError('PANELS_DISCOVERY_CLIENT_CYCLIC', `Client manifest value ${location} contains a cycle.`, { path: projectPath, exportName })
  }

  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertClientSafe(item, projectPath, exportName, seen, `${location}[${index}]`))
  } else {
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new PanelsDiscoveryError('PANELS_DISCOVERY_CLIENT_UNSAFE', `Client manifest value ${location} must be a plain object.`, { path: projectPath, exportName })
    }
    for (const [key, item] of Object.entries(value)) {
      assertClientSafe(item, projectPath, exportName, seen, `${location}.${key}`)
    }
  }
  seen.delete(value)
}

function definitionDirectoryKind(resourceRoot: string, path: string): DiscoverableKind {
  const segments = normalizeProjectPath(resourceRoot, path).split('/')
  for (const segment of segments.slice(0, -1)) {
    const kind = nestedDirectoryKinds[segment]
    if (kind) return kind
  }
  return 'resource'
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText)
}

function duplicateKeyError(
  keyKind: string,
  key: string,
  first: DiscoveredDefinition,
  second: DiscoveredDefinition,
): never {
  throw new PanelsDiscoveryError(
    `PANELS_DISCOVERY_DUPLICATE_${keyKind.toUpperCase().replaceAll('-', '_')}`,
    `Duplicate ${keyKind} ${JSON.stringify(key)} first declared at ${first.projectPath}#${first.exportName}.`,
    { path: second.projectPath, exportName: second.exportName },
  )
}

function validateDefinitions(definitions: readonly DiscoveredDefinition[]): void {
  const defaultPanels = definitions.filter(definition => definition.kind === 'panel' && definition.default)
  if (defaultPanels.length > 1) duplicateKeyError('default-panel', 'default', defaultPanels[0]!, defaultPanels[1]!)

  const idOwners = new Map<string, DiscoveredDefinition>()
  const routeOwners = new Map<string, DiscoveredDefinition>()
  const permissionOwners = new Map<string, DiscoveredDefinition>()
  const componentOwners = new Map<string, DiscoveredDefinition>()
  const navigationOwners = new Map<string, DiscoveredDefinition>()

  for (const definition of definitions) {
    const idKey = definition.kind === 'panel' ? definition.id : `${definition.panelId}\0${definition.kind}\0${definition.id}`
    const currentId = idOwners.get(idKey)
    if (currentId) duplicateKeyError('id', definition.id, currentId, definition)
    idOwners.set(idKey, definition)

    const scopedValues: readonly [string, readonly string[], Map<string, DiscoveredDefinition>][] = [
      ['permission', definition.permissionKeys, permissionOwners],
      ['component-key', definition.componentKeys, componentOwners],
      ['navigation-key', definition.navigationKeys, navigationOwners],
    ]
    if (definition.route) {
      const routeKey = `${definition.panelId}\0${definition.route}`
      const owner = routeOwners.get(routeKey)
      if (owner) duplicateKeyError('route', definition.route, owner, definition)
      routeOwners.set(routeKey, definition)
    }
    for (const [keyKind, values, owners] of scopedValues) {
      for (const value of values) {
        const scopedKey = `${definition.panelId}\0${value}`
        const owner = owners.get(scopedKey)
        if (owner) duplicateKeyError(keyKind, value, owner, definition)
        owners.set(scopedKey, definition)
      }
    }
  }
}

function convertDefinition(candidate: Candidate, loaded: LoadedExport): DiscoveredDefinition {
  const { definition, exportName } = loaded
  if (definition.kind !== candidate.expectedKind) {
    throw new PanelsDiscoveryError(
      'PANELS_DISCOVERY_KIND_MISMATCH',
      `Expected a ${candidate.expectedKind} definition but found ${definition.kind}.`,
      { path: candidate.projectPath, exportName },
    )
  }

  const panelId = definition.kind === 'panel' ? definition.id : definition.panelId ?? candidate.panelId
  if (!panelId) {
    throw new PanelsDiscoveryError('PANELS_DISCOVERY_PANEL_MISSING', `Definition ${definition.id} is not associated with a panel.`, { path: candidate.projectPath, exportName })
  }
  if (candidate.panelId && definition.panelId && definition.panelId !== candidate.panelId) {
    throw new PanelsDiscoveryError('PANELS_DISCOVERY_PANEL_MISMATCH', `Definition declares panel ${definition.panelId} but was discovered under panel ${candidate.panelId}.`, { path: candidate.projectPath, exportName })
  }

  assertClientSafe(definition.client ?? {}, candidate.projectPath, exportName)
  return Object.freeze({
    kind: definition.kind,
    id: definition.id,
    panelId,
    projectPath: candidate.projectPath,
    exportName,
    ...(definition.route ? { route: definition.route } : {}),
    permissionKeys: uniqueSorted(definition.permissionKeys ?? []),
    componentKeys: uniqueSorted(definition.componentKeys ?? []),
    navigationKeys: uniqueSorted(definition.navigationKeys ?? []),
    default: definition.default ?? false,
    client: definition.client ?? {},
    ...(typeof definition.server === 'undefined' ? {} : { server: definition.server }),
  })
}

export class DiscoveryCompiler {
  readonly #options: DiscoveryCompilerOptions
  readonly #moduleCache = new Map<string, LoadedExport | null>()
  readonly #artifactCache = new Map<string, string>()
  #applicationDefaults: readonly ComponentDefault[] | undefined
  #configurationPath: string | undefined

  constructor(options: DiscoveryCompilerOptions) {
    this.#options = options
  }

  async compile(changes: readonly DiscoveryChange[] = []): Promise<DiscoveryResult> {
    const projectRoot = resolve(this.#options.projectRoot)
    const invalidatedPaths = uniqueSorted(changes.map(change => normalizeProjectPath(projectRoot, resolveProjectPath(projectRoot, change.path))))
    if (invalidatedPaths.some(path => /^panels\.config\.(?:[cm]?[jt]s)$/u.test(path))) {
      this.#applicationDefaults = undefined
      this.#configurationPath = undefined
      this.#moduleCache.clear()
    }
    for (const path of invalidatedPaths) this.#moduleCache.delete(path)

    const applicationDefaults = await this.#loadApplicationDefaults(projectRoot)
    const panelCandidates = await this.#panelCandidates(projectRoot)
    if (panelCandidates.some(candidate => invalidatedPaths.includes(candidate.projectPath))) this.#moduleCache.clear()
    const loadedPanels = await this.#loadCandidates(panelCandidates, () => ({ application: applicationDefaults }))
    const panels = loadedPanels.map(({ candidate, loaded }) => ({
      candidate,
      loaded,
      definition: convertDefinition(candidate, loaded),
    }))
    const candidates = [...panelCandidates]
    for (const panel of panels) candidates.push(...await this.#panelDefinitionCandidates(projectRoot, panel.candidate, panel.loaded.definition))

    const deduplicated = [...new Map(candidates.map(candidate => [candidate.projectPath, candidate])).values()]
      .sort((left, right) => compareText(left.projectPath, right.projectPath))
    const layersByPanel = new Map(panels.map(panel => [
      panel.definition.panelId,
      panelComponentDefaultLayers(applicationDefaults, panel.loaded.definition),
    ]))
    const activePaths = new Set(deduplicated.map(candidate => candidate.projectPath))
    for (const cachedPath of this.#moduleCache.keys()) {
      if (!activePaths.has(cachedPath)) this.#moduleCache.delete(cachedPath)
    }

    const definitions = (await this.#loadCandidates(deduplicated, candidate => candidate.expectedKind === 'panel'
      ? { application: applicationDefaults }
      : layersByPanel.get(candidate.panelId ?? '')))
      .map(({ candidate, loaded }) => convertDefinition(candidate, loaded))
      .sort((left, right) => compareText(left.projectPath, right.projectPath) || compareText(left.exportName, right.exportName))
    validateDefinitions(definitions)

    const artifacts = renderPanelArtifacts(definitions)
    const changedArtifacts = artifacts.filter(artifact => this.#artifactCache.get(artifact.path) !== artifact.contents)
    this.#artifactCache.clear()
    for (const artifact of artifacts) this.#artifactCache.set(artifact.path, artifact.contents)

    return Object.freeze({
      definitions: Object.freeze(definitions),
      artifacts: Object.freeze(artifacts),
      changedArtifacts: Object.freeze(changedArtifacts),
      invalidatedPaths,
      watchRoots: Object.freeze(uniqueSorted([
        ...(this.#options.panelRoots ?? ['server']),
        ...(this.#options.panelEntries ?? []).map(path => dirname(path).split(sep).join('/')),
      ])),
    })
  }

  async #loadApplicationDefaults(projectRoot: string): Promise<readonly ComponentDefault[]> {
    if (this.#applicationDefaults) return this.#applicationDefaults
    const candidates = await Promise.all(['ts', 'mts', 'js', 'mjs'].map(async extension => {
      const absolutePath = resolve(projectRoot, `panels.config.${extension}`)
      const metadata = await lstat(absolutePath).catch(() => undefined)
      return metadata?.isFile() && !metadata.isSymbolicLink() ? absolutePath : undefined
    }))
    const paths = candidates.filter((path): path is string => path !== undefined)
    if (paths.length > 1) {
      throw new PanelsDiscoveryError('PANELS_DISCOVERY_CONFIG_AMBIGUOUS', 'Only one panels.config module may exist.')
    }
    this.#configurationPath = paths[0]
    if (!this.#configurationPath) {
      this.#applicationDefaults = Object.freeze([])
      return this.#applicationDefaults
    }
    const moduleValue = await this.#options.loadModule(this.#configurationPath)
    this.#applicationDefaults = Object.freeze([...componentDefaults(moduleValue.default)])
    return this.#applicationDefaults
  }

  async #panelCandidates(projectRoot: string): Promise<readonly Candidate[]> {
    const candidates: Candidate[] = []
    for (const panelRoot of this.#options.panelRoots ?? ['server']) {
      const absoluteRoot = resolveProjectPath(projectRoot, panelRoot)
      for (const absolutePath of await collectFiles(absoluteRoot)) {
        const extension = extname(absolutePath)
        if (!absolutePath.slice(0, -extension.length).endsWith('Panel')) continue
        candidates.push({
          absolutePath,
          projectPath: normalizeProjectPath(projectRoot, absolutePath),
          expectedKind: 'panel',
        })
      }
    }
    for (const panelEntry of this.#options.panelEntries ?? []) {
      const absolutePath = resolveProjectPath(projectRoot, panelEntry)
      if (isIgnoredFile(absolutePath)) continue
      const metadata = await lstat(absolutePath).catch(() => undefined)
      if (metadata?.isFile() && !metadata.isSymbolicLink()) {
        candidates.push({ absolutePath, projectPath: normalizeProjectPath(projectRoot, absolutePath), expectedKind: 'panel' })
      }
    }
    return [...new Map(candidates.map(candidate => [candidate.projectPath, candidate])).values()]
      .sort((left, right) => compareText(left.projectPath, right.projectPath))
  }

  async #panelDefinitionCandidates(
    projectRoot: string,
    panelCandidate: Candidate,
    panel: DiscoverableDefinition,
  ): Promise<readonly Candidate[]> {
    const panelRoot = dirname(panelCandidate.absolutePath)
    const configured = panel.discover
    const directoryEntries: readonly [keyof NonNullable<DiscoverableDefinition['discover']>, string, DiscoverableKind][] = [
      ['resources', 'resources', 'resource'],
      ['pages', 'pages', 'page'],
      ['widgets', 'widgets', 'widget'],
      ['clusters', 'clusters', 'cluster'],
    ]
    const candidates: Candidate[] = []
    for (const [key, conventionalPath, expectedKind] of directoryEntries) {
      if (configured && typeof configured[key] === 'undefined') continue
      const relativeDirectory = configured?.[key] ?? conventionalPath
      const absoluteRoot = resolveProjectPath(projectRoot, normalizeProjectPath(projectRoot, resolve(panelRoot, relativeDirectory)))
      for (const absolutePath of await collectFiles(absoluteRoot)) {
        candidates.push({
          absolutePath,
          projectPath: normalizeProjectPath(projectRoot, absolutePath),
          panelId: panel.id,
          expectedKind: expectedKind === 'resource' ? definitionDirectoryKind(absoluteRoot, absolutePath) : expectedKind,
        })
      }
    }
    return candidates
  }

  async #loadCandidates(
    candidates: readonly Candidate[],
    layers: (candidate: Candidate) => ComponentDefaultLayers | undefined,
  ): Promise<readonly { candidate: Candidate, loaded: LoadedExport }[]> {
    const loadedCandidates: { candidate: Candidate, loaded: LoadedExport }[] = []
    for (const candidate of candidates) {
      let loaded = this.#moduleCache.get(candidate.projectPath)
      if (typeof loaded === 'undefined') {
        let moduleValue: DiscoveryModule
        try {
          moduleValue = await this.#options.loadModule(candidate.absolutePath, { componentDefaults: layers(candidate) })
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          throw new PanelsDiscoveryError('PANELS_DISCOVERY_MODULE_LOAD_FAILED', `Cannot load definition module: ${reason}`, { path: candidate.projectPath })
        }
        loaded = selectModuleExport(moduleValue, candidate.projectPath) ?? null
        this.#moduleCache.set(candidate.projectPath, loaded)
      }
      if (loaded) loadedCandidates.push({ candidate, loaded })
    }
    return loadedCandidates
  }
}
