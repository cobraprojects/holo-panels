export const DISCOVERY_MARKER = '@holo-js/panels/discovery/v1' as const

export const DISCOVERABLE_KINDS = [
  'panel',
  'resource',
  'page',
  'widget',
  'cluster',
  'relation-manager',
  'plugin',
  'import',
  'export',
] as const

export type DiscoverableKind = (typeof DISCOVERABLE_KINDS)[number]

export type ClientManifestValue =
  | boolean
  | number
  | string
  | null
  | readonly ClientManifestValue[]
  | { readonly [key: string]: ClientManifestValue }

export interface DiscoveryDirectories {
  readonly clusters?: string
  readonly pages?: string
  readonly relationManagers?: string
  readonly resources?: string
  readonly widgets?: string
}

export interface DiscoverableDefinition<TKind extends DiscoverableKind = DiscoverableKind, TServer = unknown> {
  readonly discoveryMarker: typeof DISCOVERY_MARKER
  readonly kind: TKind
  readonly id: string
  readonly panelId?: string
  readonly route?: string
  readonly permissionKeys?: readonly string[]
  readonly componentKeys?: readonly string[]
  readonly navigationKeys?: readonly string[]
  readonly default?: boolean
  readonly client?: Readonly<Record<string, ClientManifestValue>>
  readonly discover?: Readonly<DiscoveryDirectories>
  readonly server?: TServer
}

export interface DiscoverableBuilder<TKind extends DiscoverableKind = DiscoverableKind> {
  readonly discoveryMarker: typeof DISCOVERY_MARKER
  readonly kind: TKind
  compileDiscoveryDefinition(): DiscoverableDefinition<TKind>
}
