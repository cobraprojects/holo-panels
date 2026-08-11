import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import type {
  ComponentDefault,
  ExtensionTypeId,
  PanelAssetManifest,
  PanelGeneratorTemplate,
  PanelPermissionSubject,
  PanelPluginContributionDefinition,
  PanelPluginIcon,
  PanelRendererFramework,
  PanelTranslationContribution,
  PluginCompatibility,
  RegistryKind,
} from '@holo-js/panels-core'
import { PROTOCOL_VERSION, assertPluginCompatible } from '@holo-js/panels-core'
import type { HoloManagedProjectArtifact } from '@holo-js/kernel'

export interface PanelPluginPreparationInput {
  readonly compatibility: PluginCompatibility
  readonly contributions: readonly PanelPluginContributionDefinition[]
  readonly id: string
  readonly packageName: string
}

export interface PreparePanelPluginsOptions {
  readonly framework: PanelRendererFramework
  readonly plugins: readonly PanelPluginPreparationInput[]
  readonly projectRoot: string
  readonly usedExtensions: readonly ExtensionTypeId[]
}

export interface PreparedPanelPlugins {
  readonly assets: readonly PanelAssetManifest[]
  readonly defaults: readonly ComponentDefault[]
  readonly generatorTemplates: readonly PanelGeneratorTemplate[]
  readonly icons: readonly PanelPluginIcon[]
  readonly managedArtifacts: readonly HoloManagedProjectArtifact[]
  readonly permissions: readonly PanelPermissionSubject[]
  readonly rendererModule: string
  readonly translations: readonly PanelTranslationContribution[]
}

interface PackageManifest {
  readonly exports: Readonly<Record<string, unknown>>
  readonly name: string
}

interface ResolvedPackage {
  readonly manifest: PackageManifest
  readonly root: string
}

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const exportNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/u
const maximumAssetBytes = 10 * 1024 * 1024
const extensionsByKind = Object.freeze({
  font: new Set(['.woff', '.woff2']),
  script: new Set(['.js', '.mjs']),
  style: new Set(['.css']),
})

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function assertInside(root: string, target: string, label: string): void {
  const path = relative(root, target)
  if (!path || path === '..' || path.startsWith(`..${sep}`)) throw new Error(`${label} must remain inside its plugin package`)
}

function parseManifest(value: unknown, packageName: string): PackageManifest {
  if (!isRecord(value) || value.name !== packageName || !isRecord(value.exports)) {
    throw new Error(`Panel plugin package ${packageName} has an invalid manifest`)
  }
  return { exports: value.exports, name: packageName }
}

async function resolvePackage(projectRoot: string, packageName: string): Promise<ResolvedPackage> {
  const require = createRequire(join(projectRoot, 'package.json'))
  const entry = require.resolve(packageName)
  let current = dirname(entry)
  while (true) {
    const manifestPath = join(current, 'package.json')
    try {
      const manifest = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown, packageName)
      return { manifest, root: await realpath(current) }
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') {
        const parent = dirname(current)
        if (parent === current) break
        current = parent
        continue
      }
      if (error instanceof SyntaxError) throw new Error(`Panel plugin package ${packageName} has invalid package metadata`)
      if (error instanceof Error && error.message.includes('invalid manifest')) throw error
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  throw new Error(`Cannot resolve the package root for panel plugin ${packageName}`)
}

async function currentPanelsVersion(): Promise<string> {
  const value = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as unknown
  if (!isRecord(value) || typeof value.version !== 'string') throw new Error('Holo Panels package metadata has an invalid version')
  return value.version
}

function publicModuleSpecifier(plugin: ResolvedPackage, packageName: string, module: `./${string}`): string {
  if (!Object.hasOwn(plugin.manifest.exports, module)) {
    throw new Error(`Panel plugin renderer ${packageName}/${module.slice(2)} is not a public package export`)
  }
  return `${packageName}/${module.slice(2)}`
}

function registryFunction(framework: PanelRendererFramework): string {
  if (framework === 'react') return 'registerReactExtensionRenderer'
  if (framework === 'vue') return 'registerVueExtensionRenderer'
  return 'registerSvelteExtensionRenderer'
}

function rendererPackage(framework: PanelRendererFramework): string {
  return `@holo-js/panels-${framework}`
}

function rendererRegistryType(framework: PanelRendererFramework): string {
  return framework === 'svelte' ? 'SvelteComponentRegistry' : 'ComponentRegistry'
}

function contributionKey(pluginId: string, contribution: PanelPluginContributionDefinition): string {
  if (contribution.kind === 'extension') return `${contribution.kind}:${contribution.registration.typeId}`
  if (contribution.kind === 'renderer') return `${contribution.kind}:${contribution.registration.framework}:${contribution.registration.typeId}`
  if (contribution.kind === 'translation') return `${contribution.kind}:${contribution.registration.namespace}:${contribution.registration.locale}`
  if (contribution.kind === 'icon') return `${contribution.kind}:${pluginId}.${contribution.registration.id}`
  if (contribution.kind === 'asset') return `${contribution.kind}:${pluginId}.${contribution.registration.id}`
  if (contribution.kind === 'permission-subject') return `${contribution.kind}:${contribution.subject.subject}:${contribution.subject.id}`
  if (contribution.kind === 'generator-template') return `${contribution.kind}:${contribution.template.generator}`
  if ('definition' in contribution) return `${contribution.kind}:${contribution.definition.id}`
  if ('command' in contribution) return `${contribution.kind}:${contribution.command.id}`
  if ('migration' in contribution) return `${contribution.kind}:${contribution.migration.id}`
  if ('default' in contribution) return `${contribution.kind}:${contribution.default.kind}:${contribution.default.type}`
  throw new TypeError('Unknown panel plugin contribution')
}

async function prepareAsset(
  pluginId: string,
  plugin: ResolvedPackage,
  contribution: Extract<PanelPluginContributionDefinition, { readonly kind: 'asset' }>,
): Promise<{ readonly artifact: HoloManagedProjectArtifact, readonly manifest: PanelAssetManifest }> {
  const source = contribution.registration.source
  const unresolved = resolve(plugin.root, source.slice(2))
  assertInside(plugin.root, unresolved, 'Panel plugin assets')
  const resolved = await realpath(unresolved)
  assertInside(plugin.root, resolved, 'Panel plugin assets')
  const metadata = await lstat(resolved)
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximumAssetBytes) throw new Error('Panel plugin assets must be bounded regular files')
  const extension = extname(resolved).toLowerCase()
  if (!extensionsByKind[contribution.registration.kind].has(extension) || extension === '.map') {
    throw new Error(`Panel plugin ${contribution.registration.kind} assets use an unsupported extension`)
  }
  const contents = new Uint8Array(await readFile(resolved))
  const digest = createHash('sha256').update(contents).digest('hex').slice(0, 16)
  const filename = `${digest}-${basename(resolved)}`
  const publicPath = `/holo/panels/plugins/${pluginId}/${filename}`
  return {
    artifact: { contents, path: `public${publicPath}` },
    manifest: Object.freeze({
      id: `${pluginId}.${contribution.registration.id}`,
      kind: contribution.registration.kind,
      load: contribution.registration.load,
      publicPath,
    }),
  }
}

export async function preparePanelPlugins(options: PreparePanelPluginsOptions): Promise<PreparedPanelPlugins> {
  const panelsVersion = await currentPanelsVersion()
  const preparedPackages = new Map<string, Promise<ResolvedPackage>>()
  const contributionOwners = new Map<string, string>()
  const extensionKinds = new Map<ExtensionTypeId, RegistryKind>()
  const renderers = new Map<ExtensionTypeId, { readonly exportName: string, readonly module: string }>()
  const assets: PanelAssetManifest[] = []
  const defaults: ComponentDefault[] = []
  const generatorTemplates: PanelGeneratorTemplate[] = []
  const icons: PanelPluginIcon[] = []
  const managedArtifacts: HoloManagedProjectArtifact[] = []
  const permissions: PanelPermissionSubject[] = []
  const translations: PanelTranslationContribution[] = []

  for (const input of options.plugins) {
    if (!identifierPattern.test(input.id)) throw new Error('Panel plugin preparation requires stable plugin IDs')
    assertPluginCompatible(input.id, input.compatibility, { panels: panelsVersion, protocol: PROTOCOL_VERSION })
    const inputContributionKeys = new Set<string>()
    const inputOwner = `${input.packageName}#${input.id}`
    const plugin = await (preparedPackages.get(input.packageName) ?? (() => {
      const resolving = resolvePackage(options.projectRoot, input.packageName)
      preparedPackages.set(input.packageName, resolving)
      return resolving
    })())
    for (const contribution of input.contributions) {
      const key = contributionKey(input.id, contribution)
      if (inputContributionKeys.has(key)) throw new Error(`Panel plugin contribution ${key} is duplicated by ${input.packageName}`)
      inputContributionKeys.add(key)
      const owner = contributionOwners.get(key)
      if (owner === inputOwner) continue
      if (owner) throw new Error(`Panel plugin contribution ${key} conflicts between ${owner} and ${input.packageName}`)
      contributionOwners.set(key, inputOwner)
      if (contribution.kind === 'extension') {
        extensionKinds.set(contribution.registration.typeId, contribution.registration.kind)
      } else if (contribution.kind === 'renderer' && contribution.registration.framework === options.framework) {
        if (!exportNamePattern.test(contribution.registration.exportName)) throw new Error('Panel plugin renderers require static export names')
        renderers.set(contribution.registration.typeId, {
          exportName: contribution.registration.exportName,
          module: publicModuleSpecifier(plugin, input.packageName, contribution.registration.module),
        })
      } else if (contribution.kind === 'asset') {
        const prepared = await prepareAsset(input.id, plugin, contribution)
        assets.push(prepared.manifest)
        managedArtifacts.push(prepared.artifact)
      } else if (contribution.kind === 'translation') {
        translations.push(contribution.registration)
      } else if (contribution.kind === 'icon') {
        icons.push(Object.freeze({
          definition: Object.freeze({ ...contribution.registration.definition, name: `${input.id}.${contribution.registration.id}` }),
          id: `${input.id}.${contribution.registration.id}`,
        }))
      } else if (contribution.kind === 'default') {
        defaults.push(contribution.default)
      } else if (contribution.kind === 'permission-subject') {
        permissions.push(contribution.subject)
      } else if (contribution.kind === 'generator-template') {
        generatorTemplates.push(contribution.template)
      }
    }
  }

  for (const typeId of options.usedExtensions) {
    if (!extensionKinds.has(typeId)) throw new Error(`Panel extension ${typeId} is not registered by an installed plugin`)
    if (!renderers.has(typeId)) throw new Error(`Panel extension ${typeId} has no ${options.framework} renderer`)
  }

  const register = registryFunction(options.framework)
  const registryType = rendererRegistryType(options.framework)
  const imports = [`import { createExtensionTypeId, ${register}, type ${registryType} } from '${rendererPackage(options.framework)}'`]
  const calls: string[] = []
  let index = 0
  for (const typeId of [...options.usedExtensions].sort()) {
    const renderer = renderers.get(typeId)!
    const [namespace, kind, name] = typeId.split(':')
    if (!namespace || !kind || !name || kind !== extensionKinds.get(typeId)) {
      throw new Error(`Panel extension ${typeId} has an invalid registered type ID`)
    }
    const component = `Renderer${index}`
    imports.push(`import { ${renderer.exportName} as ${component} } from '${renderer.module}'`)
    calls.push(`  ${register}(registry, ${JSON.stringify(kind)}, createExtensionTypeId(${JSON.stringify(namespace)}, ${JSON.stringify(kind)}, ${JSON.stringify(name)}), ${component}, ${JSON.stringify(renderer.module)})`)
    index += 1
  }
  const rendererModule = [
    ...imports,
    '',
    `export function registerPanelPluginRenderers(registry: ${registryType}): ${registryType} {`,
    ...calls,
    '  return registry',
    '}',
    '',
  ].join('\n')

  return Object.freeze({
    assets: Object.freeze(assets),
    defaults: Object.freeze(defaults),
    generatorTemplates: Object.freeze(generatorTemplates),
    icons: Object.freeze(icons),
    managedArtifacts: Object.freeze(managedArtifacts),
    permissions: Object.freeze(permissions),
    rendererModule,
    translations: Object.freeze(translations),
  })
}
