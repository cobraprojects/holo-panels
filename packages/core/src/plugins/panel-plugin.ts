import type { ComponentDefault } from '../defaults/component-default'
import { DISCOVERY_MARKER, type DiscoverableDefinition } from '../discovery/types'
import type { CompiledPageDefinition } from '../pages/contracts'
import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type { CompiledWidgetDefinition } from '../widgets/contracts'
import type { PluginCompatibility } from './compatibility'
import type { ExtensionRegistration } from './registry'
import type { ContextTypeSources, OptionalRuntimeTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import type { ExtensionTypeId } from './type-id'

export interface PanelAuthorizationRequest<TActor, TTenant = unknown> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly permission: string
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface PanelAuthorizationLayer<TActor, TTenant = unknown> {
  readonly id: string
  authorize(request: PanelAuthorizationRequest<TActor, TTenant>): void | Promise<void>
}

export interface PanelPackageModuleContribution {
  readonly exportName: string
  readonly id: string
  readonly module: `./${string}`
}

export type PanelAssetKind = 'font' | 'script' | 'style'

export interface PanelPluginAsset {
  readonly id: string
  readonly kind: PanelAssetKind
  readonly load: 'eager' | 'lazy'
  readonly source: `./${string}`
}

export interface PanelAssetManifest extends JsonObject {
  readonly id: string
  readonly kind: PanelAssetKind
  readonly load: 'eager' | 'lazy'
  readonly publicPath: string
}

export interface PanelIconPath {
  readonly fill?: 'currentColor' | 'none'
  readonly path: string
  readonly stroke?: 'currentColor' | 'none'
  readonly strokeWidth?: number
}

export interface PanelIconDefinition {
  readonly name: string
  readonly paths: readonly PanelIconPath[]
  readonly viewBox: `${number} ${number} ${number} ${number}`
}

export interface PanelPluginIcon {
  readonly definition: PanelIconDefinition
  readonly id: string
}

export type PanelRendererFramework = 'react' | 'svelte' | 'vue'

export interface PanelRendererRegistration {
  readonly exportName: string
  readonly framework: PanelRendererFramework
  readonly module: `./${string}`
  readonly typeId: ExtensionTypeId
}

export interface PanelTranslationContribution {
  readonly catalog: Readonly<Record<string, string>>
  readonly locale: string
  readonly namespace: string
}

export interface PanelPermissionSubject {
  readonly id: string
  readonly operations: readonly string[]
  readonly subject: 'action' | 'page' | 'resource' | 'widget'
}

export interface PanelGeneratorTemplate {
  readonly exportName: string
  readonly generator: 'action' | 'column' | 'entry' | 'field' | 'filter' | 'page' | 'resource' | 'widget'
  readonly module: `./${string}`
}

export type PanelPluginContributionDefinition =
  | { readonly definition: DiscoverableDefinition<'cluster'>, readonly kind: 'cluster' }
  | { readonly definition: DiscoverableDefinition<'page'>, readonly kind: 'page' }
  | { readonly definition: DiscoverableDefinition<'resource'>, readonly kind: 'resource' }
  | { readonly definition: DiscoverableDefinition<'widget'>, readonly kind: 'widget' }
  | { readonly kind: 'extension', readonly registration: ExtensionRegistration }
  | { readonly kind: 'renderer', readonly registration: PanelRendererRegistration }
  | { readonly kind: 'translation', readonly registration: PanelTranslationContribution }
  | { readonly kind: 'icon', readonly registration: PanelPluginIcon }
  | { readonly kind: 'asset', readonly registration: PanelPluginAsset }
  | { readonly default: ComponentDefault, readonly kind: 'default' }
  | { readonly kind: 'permission-subject', readonly subject: PanelPermissionSubject }
  | { readonly kind: 'generator-template', readonly template: PanelGeneratorTemplate }
  | { readonly command: PanelPackageModuleContribution, readonly kind: 'cli-command' }
  | { readonly kind: 'migration', readonly migration: PanelPackageModuleContribution }

export type PanelPluginContribution = PanelPluginContributionDefinition['kind']

export interface PanelPluginInstallation<TActor, TTenant = unknown> {
  readonly authorizationLayer: PanelAuthorizationLayer<TActor, TTenant> | null
  readonly contributions: readonly PanelPluginContributionDefinition[]
  readonly id: string
  readonly permissionNamespace: string | null
}

export interface PanelPlugin<TActor, TTenant = unknown> {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
  install(panel: { readonly guard: string, readonly id: string }): PanelPluginInstallation<TActor, TTenant>
}

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/u
const exportNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/u

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`${label} requires a stable identifier`)
}

function assertPackageName(value: string): void {
  if (!packageNamePattern.test(value) || value.length > 214) throw new Error('Panel plugins require a valid npm package name')
}

function assertPackageModule(value: string, label: string): asserts value is `./${string}` {
  if (!value.startsWith('./') || value.includes('\\') || value.includes('?') || value.includes('#') || /%(?:2e|2f|5c)/iu.test(value)) {
    throw new Error(`${label} must be a safe package-relative module`)
  }
  const segments = value.slice(2).split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`${label} must be a safe package-relative module`)
  }
}

function assertExportName(value: string, label: string): void {
  if (!exportNamePattern.test(value)) throw new Error(`${label} requires a static export name`)
}

function discoverablePage<TActor, TTenant, TServices>(
  definition: CompiledPageDefinition<JsonObject, TActor, TTenant, TServices>,
): DiscoverableDefinition<'page'> {
  const client = toJsonValue(definition.manifest)
  if (client === null || Array.isArray(client) || typeof client !== 'object') throw new TypeError('Plugin pages require a JSON-safe manifest')
  return Object.freeze({
    client,
    discoveryMarker: DISCOVERY_MARKER,
    id: definition.manifest.id,
    kind: 'page',
    navigationKeys: definition.manifest.navigation === null ? [] : [definition.manifest.id],
    route: definition.manifest.path,
  })
}

function discoverableWidget<TActor, TTenant, TServices>(
  definition: CompiledWidgetDefinition<JsonValue, TActor, TTenant, TServices>,
): DiscoverableDefinition<'widget'> {
  const client = toJsonValue(definition.manifest)
  if (client === null || Array.isArray(client) || typeof client !== 'object') throw new TypeError('Plugin widgets require a JSON-safe manifest')
  return Object.freeze({
    client,
    discoveryMarker: DISCOVERY_MARKER,
    id: definition.manifest.id,
    kind: 'widget',
  })
}

export class PanelPluginBuilder<TActor = unknown, TTenant = unknown> implements PanelPlugin<TActor, TTenant> {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
  readonly #contributionKeys = new Set<string>()
  readonly #contributions: PanelPluginContributionDefinition[] = []
  #authorizationLayer: PanelAuthorizationLayer<TActor, TTenant> | null = null
  #installed = false
  #permissionNamespace: string | null = null

  constructor(options: { readonly compatibility: PluginCompatibility, readonly id: string, readonly packageName: string }) {
    assertIdentifier(options.id, 'Panel plugin IDs')
    assertPackageName(options.packageName)
    this.compatibility = Object.freeze({ panels: Object.freeze({ ...options.compatibility.panels }), protocol: Object.freeze({ ...options.compatibility.protocol }) })
    this.id = options.id
    this.packageName = options.packageName
  }

  authorization(layer: PanelAuthorizationLayer<TActor, TTenant>): this {
    this.assertMutable()
    assertIdentifier(layer.id, 'Panel authorization layers')
    if (typeof layer.authorize !== 'function') throw new TypeError('Panel authorization layers require an authorize method')
    if (this.#authorizationLayer !== null) throw new Error('Panel plugin authorization is already configured')
    this.#authorizationLayer = layer
    return this
  }

  permissionNamespace(namespace: string | null): this {
    this.assertMutable()
    if (namespace !== null) assertIdentifier(namespace, 'Panel plugin permission namespaces')
    this.#permissionNamespace = namespace
    return this
  }

  resources(...definitions: readonly DiscoverableDefinition<'resource'>[]): this {
    for (const definition of definitions) this.addDefinition('resource', definition)
    return this
  }

  pages(...definitions: readonly CompiledPageDefinition<JsonObject, TActor, TTenant, unknown>[]): this {
    for (const definition of definitions) this.addDefinition('page', discoverablePage(definition))
    return this
  }

  widgets(...definitions: readonly CompiledWidgetDefinition<JsonValue, TActor, TTenant, unknown>[]): this {
    for (const definition of definitions) this.addDefinition('widget', discoverableWidget(definition))
    return this
  }

  clusters(...definitions: readonly DiscoverableDefinition<'cluster'>[]): this {
    for (const definition of definitions) this.addDefinition('cluster', definition)
    return this
  }

  extension(registration: ExtensionRegistration): this {
    if (registration.kind !== registration.typeId.split(':')[1]) throw new Error(`Registration kind ${registration.kind} does not match ${registration.typeId}`)
    return this.add(`extension:${registration.typeId}`, { kind: 'extension', registration })
  }

  renderer(registration: PanelRendererRegistration): this {
    assertPackageModule(registration.module, 'Panel renderer modules')
    assertExportName(registration.exportName, 'Panel renderer exports')
    return this.add(`renderer:${registration.framework}:${registration.typeId}`, { kind: 'renderer', registration: Object.freeze({ ...registration }) })
  }

  translation(registration: PanelTranslationContribution): this {
    assertIdentifier(registration.namespace, 'Panel translation namespaces')
    if (!registration.locale.trim()) throw new Error('Panel translations require a locale')
    for (const value of Object.values(registration.catalog)) {
      if (typeof value !== 'string') throw new TypeError('Panel translation catalogs contain strings only')
    }
    const normalized = Object.freeze({ ...registration, catalog: Object.freeze({ ...registration.catalog }), locale: registration.locale.trim() })
    return this.add(`translation:${normalized.locale}:${normalized.namespace}`, { kind: 'translation', registration: normalized })
  }

  icon(registration: PanelPluginIcon): this {
    assertIdentifier(registration.id, 'Panel plugin icon IDs')
    if (!registration.definition.name.trim() || registration.definition.paths.length === 0) throw new Error('Panel plugin icons require a named definition with paths')
    return this.add(`icon:${registration.id}`, { kind: 'icon', registration })
  }

  asset(registration: PanelPluginAsset): this {
    assertIdentifier(registration.id, 'Panel plugin asset IDs')
    assertPackageModule(registration.source, 'Panel plugin asset sources')
    const extension = registration.source.slice(registration.source.lastIndexOf('.')).toLowerCase()
    const valid = registration.kind === 'style'
      ? extension === '.css'
      : registration.kind === 'script'
        ? extension === '.js' || extension === '.mjs'
        : extension === '.woff' || extension === '.woff2'
    if (!valid) throw new Error(`Panel plugin ${registration.kind} assets use an unsupported extension`)
    return this.add(`asset:${registration.id}`, { kind: 'asset', registration: Object.freeze({ ...registration }) })
  }

  defaults(...defaults: readonly ComponentDefault[]): this {
    for (const value of defaults) this.add(`default:${value.kind}:${value.type}`, { default: value, kind: 'default' })
    return this
  }

  permissionSubject(subject: PanelPermissionSubject): this {
    assertIdentifier(subject.id, 'Panel permission subject IDs')
    if (new Set(subject.operations).size !== subject.operations.length || subject.operations.some(operation => !identifierPattern.test(operation))) {
      throw new Error('Panel permission subject operations require unique stable identifiers')
    }
    return this.add(`permission-subject:${subject.subject}:${subject.id}`, {
      kind: 'permission-subject',
      subject: Object.freeze({ ...subject, operations: Object.freeze([...subject.operations]) }),
    })
  }

  generatorTemplate(template: PanelGeneratorTemplate): this {
    assertPackageModule(template.module, 'Panel generator template modules')
    assertExportName(template.exportName, 'Panel generator template exports')
    return this.add(`generator-template:${template.generator}`, { kind: 'generator-template', template: Object.freeze({ ...template }) })
  }

  cliCommand(command: PanelPackageModuleContribution): this {
    this.assertPackageContribution(command, 'Panel CLI commands')
    return this.add(`cli-command:${command.id}`, { command: Object.freeze({ ...command }), kind: 'cli-command' })
  }

  migration(migration: PanelPackageModuleContribution): this {
    this.assertPackageContribution(migration, 'Panel migrations')
    return this.add(`migration:${migration.id}`, { kind: 'migration', migration: Object.freeze({ ...migration }) })
  }

  install(_panel: { readonly guard: string, readonly id: string }): PanelPluginInstallation<TActor, TTenant> {
    this.#installed = true
    return Object.freeze({
      authorizationLayer: this.#authorizationLayer,
      contributions: Object.freeze([...this.#contributions]),
      id: this.id,
      permissionNamespace: this.#permissionNamespace,
    })
  }

  private addDefinition<TKind extends 'cluster' | 'page' | 'resource' | 'widget'>(
    kind: TKind,
    definition: DiscoverableDefinition<TKind>,
  ): void {
    if (definition.kind !== kind || definition.discoveryMarker !== DISCOVERY_MARKER) throw new Error(`Panel plugin ${kind} contributions must be discoverable definitions`)
    if (kind === 'cluster') this.add(`${kind}:${definition.id}`, { definition: definition as DiscoverableDefinition<'cluster'>, kind })
    if (kind === 'page') this.add(`${kind}:${definition.id}`, { definition: definition as DiscoverableDefinition<'page'>, kind })
    if (kind === 'resource') this.add(`${kind}:${definition.id}`, { definition: definition as DiscoverableDefinition<'resource'>, kind })
    if (kind === 'widget') this.add(`${kind}:${definition.id}`, { definition: definition as DiscoverableDefinition<'widget'>, kind })
  }

  private add(key: string, contribution: PanelPluginContributionDefinition): this {
    this.assertMutable()
    if (this.#contributionKeys.has(key)) throw new Error(`Duplicate panel plugin contribution "${key}"`)
    this.#contributionKeys.add(key)
    this.#contributions.push(Object.freeze(contribution))
    return this
  }

  private assertMutable(): void {
    if (this.#installed) throw new Error(`Panel plugin "${this.id}" is immutable after installation`)
  }

  private assertPackageContribution(contribution: PanelPackageModuleContribution, label: string): void {
    assertIdentifier(contribution.id, label)
    assertPackageModule(contribution.module, `${label} modules`)
    assertExportName(contribution.exportName, `${label} exports`)
  }
}

export function definePanelPlugin<
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
>(options: {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
} & ContextTypeSources<TActorSource, TTenantSource>): PanelPluginBuilder<RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>>
export function definePanelPlugin(options: {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
}): PanelPluginBuilder<unknown, unknown>
export function definePanelPlugin<TActor = unknown, TTenant = unknown>(options: {
  readonly compatibility: PluginCompatibility
  readonly id: string
  readonly packageName: string
}): PanelPluginBuilder<TActor, TTenant> {
  return new PanelPluginBuilder(options)
}
