import {
  DISCOVERABLE_KINDS,
  DISCOVERY_MARKER,
  type DiscoverableBuilder,
  type DiscoverableDefinition,
  type DiscoverableKind,
} from './types'

const discoverableKinds = new Set<string>(DISCOVERABLE_KINDS)

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0)
}

function hasOptionalString(value: Readonly<Record<string, unknown>>, key: string): boolean {
  return typeof value[key] === 'undefined' || typeof value[key] === 'string'
}

function isDiscoveryDirectories(value: unknown): boolean {
  if (!isRecord(value)) return false
  return ['clusters', 'pages', 'relationManagers', 'resources', 'widgets']
    .every(key => typeof value[key] === 'undefined' || typeof value[key] === 'string')
}

export function isDiscoverableKind(value: unknown): value is DiscoverableKind {
  return typeof value === 'string' && discoverableKinds.has(value)
}

export function isDiscoverableDefinition(value: unknown): value is DiscoverableDefinition {
  if (!isRecord(value)) return false

  return value.discoveryMarker === DISCOVERY_MARKER
    && isDiscoverableKind(value.kind)
    && typeof value.id === 'string'
    && value.id.length > 0
    && hasOptionalString(value, 'panelId')
    && hasOptionalString(value, 'route')
    && (typeof value.permissionKeys === 'undefined' || isStringArray(value.permissionKeys))
    && (typeof value.componentKeys === 'undefined' || isStringArray(value.componentKeys))
    && (typeof value.navigationKeys === 'undefined' || isStringArray(value.navigationKeys))
    && (typeof value.default === 'undefined' || typeof value.default === 'boolean')
    && (typeof value.client === 'undefined' || isRecord(value.client))
    && (typeof value.discover === 'undefined' || isDiscoveryDirectories(value.discover))
}

export function isDiscoverableBuilder(value: unknown): value is DiscoverableBuilder {
  return (isRecord(value) || typeof value === 'function')
    && Reflect.get(value, 'discoveryMarker') === DISCOVERY_MARKER
    && isDiscoverableKind(Reflect.get(value, 'kind'))
    && typeof Reflect.get(value, 'compileDiscoveryDefinition') === 'function'
}

function isDefinitionKind<TKind extends DiscoverableKind>(
  value: unknown,
  kind: TKind,
): value is DiscoverableDefinition<TKind> {
  return isDiscoverableDefinition(value) && value.kind === kind
}

export function isPanelDefinition(value: unknown): value is DiscoverableDefinition<'panel'> {
  return isDefinitionKind(value, 'panel')
}

export function isResourceDefinition(value: unknown): value is DiscoverableDefinition<'resource'> {
  return isDefinitionKind(value, 'resource')
}

export function isPageDefinition(value: unknown): value is DiscoverableDefinition<'page'> {
  return isDefinitionKind(value, 'page')
}

export function isWidgetDefinition(value: unknown): value is DiscoverableDefinition<'widget'> {
  return isDefinitionKind(value, 'widget')
}

export function isClusterDefinition(value: unknown): value is DiscoverableDefinition<'cluster'> {
  return isDefinitionKind(value, 'cluster')
}

export function isRelationManagerDefinition(value: unknown): value is DiscoverableDefinition<'relation-manager'> {
  return isDefinitionKind(value, 'relation-manager')
}

export function isPluginDefinition(value: unknown): value is DiscoverableDefinition<'plugin'> {
  return isDefinitionKind(value, 'plugin')
}

export function isImportDefinition(value: unknown): value is DiscoverableDefinition<'import'> {
  return isDefinitionKind(value, 'import')
}

export function isExportDefinition(value: unknown): value is DiscoverableDefinition<'export'> {
  return isDefinitionKind(value, 'export')
}

export function markDiscoverableDefinition<TDefinition extends Omit<DiscoverableDefinition, 'discoveryMarker'>>(
  definition: TDefinition,
): Readonly<TDefinition & Pick<DiscoverableDefinition, 'discoveryMarker'>> {
  return Object.freeze({
    ...definition,
    discoveryMarker: DISCOVERY_MARKER,
  })
}
