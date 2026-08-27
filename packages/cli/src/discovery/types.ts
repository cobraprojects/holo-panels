import type {
  ClientManifestValue,
  ComponentDefaultLayers,
  DiscoverableKind,
} from '@holo-js/panels-core'

export {
  DISCOVERABLE_KINDS,
  DISCOVERY_MARKER,
  type ClientManifestValue,
  type DiscoverableBuilder,
  type DiscoverableDefinition,
  type DiscoverableKind,
  type DiscoveryDirectories,
} from '@holo-js/panels-core'

export interface DiscoveredDefinition {
  readonly kind: DiscoverableKind
  readonly id: string
  readonly panelId: string
  readonly projectPath: string
  readonly exportName: string
  readonly route?: string
  readonly permissionKeys: readonly string[]
  readonly permissionReferences?: readonly string[]
  readonly componentKeys: readonly string[]
  readonly navigationKeys: readonly string[]
  readonly default: boolean
  readonly client: Readonly<Record<string, ClientManifestValue>>
  readonly server?: unknown
  readonly registeredFrom?: {
    readonly index: number
    readonly exportName: string
  }
  readonly generatedResourcePage?: {
    readonly manifest: Readonly<Record<string, ClientManifestValue>>
    readonly resourceExportName: string
  }
}

export interface DiscoveryModule {
  readonly [exportName: string]: unknown
  readonly default?: unknown
}

export interface DiscoveryModuleLoadContext {
  readonly componentDefaults?: ComponentDefaultLayers
}

export type DiscoveryModuleLoader = (
  absolutePath: string,
  context?: DiscoveryModuleLoadContext,
) => DiscoveryModule | Promise<DiscoveryModule>

export interface DiscoveryChange {
  readonly kind: 'created' | 'changed' | 'deleted'
  readonly path: string
}

export interface DiscoveryCompilerOptions {
  readonly projectRoot: string
  readonly loadModule: DiscoveryModuleLoader
  readonly panelRoots?: readonly string[]
  readonly panelEntries?: readonly string[]
}

export interface GeneratedPanelArtifact {
  readonly path: string
  readonly contents: string
}

export interface DiscoveredResourceTypeBinding {
  readonly exportName: string
  readonly modelName: string
  readonly projectPath: string
  readonly tableName: string
}

export interface DiscoveredRelationManagerTypeBinding {
  readonly exportName: string
  readonly ownerResourceExportName: string
  readonly ownerResourceProjectPath: string
  readonly projectPath: string
  readonly relationship: string
}

export interface DiscoveryResult {
  readonly definitions: readonly DiscoveredDefinition[]
  readonly artifacts: readonly GeneratedPanelArtifact[]
  readonly changedArtifacts: readonly GeneratedPanelArtifact[]
  readonly invalidatedPaths: readonly string[]
  readonly relationManagerTypeBindings: readonly DiscoveredRelationManagerTypeBinding[]
  readonly resourceTypeBindings: readonly DiscoveredResourceTypeBinding[]
  readonly watchRoots: readonly string[]
}
