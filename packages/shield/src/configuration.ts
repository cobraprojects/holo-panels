import type { ShieldRoleSeed } from './commands'
import { generateShieldPermissionKeys } from './permissions'
import { assertShieldIdentifier, assertShieldPermissionKey, assertShieldTenantId } from './validation'

export interface ShieldPreparedRegistryDefinition {
  readonly id: string
  readonly kind: 'action' | 'page' | 'resource' | 'widget'
  readonly panelId: string
  readonly permissionKeys: readonly string[]
}

export interface ShieldPreparedRegistry {
  readonly version: 1
  readonly definitions: readonly ShieldPreparedRegistryDefinition[]
}

export interface ShieldCommandConfiguration {
  readonly allowProductionMutations?: boolean
  readonly connection?: string
  readonly seeds?: readonly ShieldRoleSeed[]
}

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const KINDS = new Set<ShieldPreparedRegistryDefinition['kind']>(['action', 'page', 'resource', 'widget'])

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function preparedDefinition(value: unknown): ShieldPreparedRegistryDefinition {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !IDENTIFIER.test(value.id)
    || typeof value.panelId !== 'string'
    || !IDENTIFIER.test(value.panelId)
    || typeof value.kind !== 'string'
    || !KINDS.has(value.kind as ShieldPreparedRegistryDefinition['kind'])
    || !Array.isArray(value.permissionKeys)
    || !value.permissionKeys.every(key => typeof key === 'string')) {
    throw new TypeError('Prepared Shield registry contains an invalid definition')
  }
  return Object.freeze({
    id: value.id,
    kind: value.kind as ShieldPreparedRegistryDefinition['kind'],
    panelId: value.panelId,
    permissionKeys: Object.freeze([...value.permissionKeys] as string[]),
  })
}

export function defineShieldCommandConfiguration<const TConfiguration extends ShieldCommandConfiguration>(
  configuration: TConfiguration,
): Readonly<TConfiguration & { readonly allowProductionMutations: boolean, readonly seeds: readonly ShieldRoleSeed[] }> {
  if (!isRecord(configuration)) throw new TypeError('Shield command configuration must be an object')
  const keys = Object.keys(configuration)
  if (keys.some(key => !['allowProductionMutations', 'connection', 'seeds'].includes(key))) {
    throw new TypeError('Shield command configuration contains unsupported fields')
  }
  if (configuration.allowProductionMutations !== undefined && typeof configuration.allowProductionMutations !== 'boolean') {
    throw new TypeError('Shield production mutation configuration must be boolean')
  }
  if (configuration.connection !== undefined && (!configuration.connection.trim() || !IDENTIFIER.test(configuration.connection))) {
    throw new TypeError('Shield database connection must be a stable identifier')
  }
  if (configuration.seeds !== undefined && !Array.isArray(configuration.seeds)) {
    throw new TypeError('Shield role seeds must be an array')
  }
  const seeds = (configuration.seeds ?? []).map(seed => {
    if (!isRecord(seed)) throw new TypeError('Shield role seeds must be objects')
    if (Object.keys(seed).some(key => !['id', 'name', 'permissionKeys', 'superAdmin', 'tenantId'].includes(key))) {
      throw new TypeError('Shield role seeds contain unsupported fields')
    }
    if (typeof seed.id !== 'string' || typeof seed.name !== 'string') throw new TypeError('Shield role seeds require string IDs and names')
    assertShieldIdentifier(seed.id, 'Shield role IDs')
    assertShieldIdentifier(seed.name, 'Shield role names')
    if (!Array.isArray(seed.permissionKeys) || !seed.permissionKeys.every(key => typeof key === 'string')) throw new TypeError('Shield role seed permissions must be an array')
    for (const key of seed.permissionKeys) assertShieldPermissionKey(key)
    if (seed.superAdmin !== undefined && typeof seed.superAdmin !== 'boolean') throw new TypeError('Shield role seed super-admin state must be boolean')
    const tenantId = seed.tenantId ?? null
    if (tenantId !== null && typeof tenantId !== 'string' && typeof tenantId !== 'number') throw new TypeError('Shield role seed tenant IDs are invalid')
    assertShieldTenantId(tenantId)
    const normalized: ShieldRoleSeed = {
      id: seed.id,
      name: seed.name,
      permissionKeys: Object.freeze([...seed.permissionKeys]),
      ...(typeof seed.superAdmin === 'boolean' ? { superAdmin: seed.superAdmin } : {}),
      ...(tenantId === null ? {} : { tenantId }),
    }
    return Object.freeze(normalized)
  })
  return Object.freeze({
    ...configuration,
    allowProductionMutations: configuration.allowProductionMutations ?? false,
    connection: configuration.connection,
    seeds: Object.freeze(seeds),
  })
}

export function shieldPreparedRegistry(value: unknown): ShieldPreparedRegistry {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.definitions)) {
    throw new TypeError('Prepared Shield registry has an invalid structure')
  }
  const definitions = value.definitions.flatMap(definition => {
    if (!isRecord(definition) || typeof definition.kind !== 'string' || !KINDS.has(definition.kind as ShieldPreparedRegistryDefinition['kind'])) return []
    return [preparedDefinition(definition)]
  })
  const identities = new Set<string>()
  for (const definition of definitions) {
    const identity = `${definition.panelId}:${definition.kind}:${definition.id}`
    if (identities.has(identity)) throw new TypeError('Prepared Shield registry contains a duplicate definition')
    identities.add(identity)
  }
  return Object.freeze({
    version: 1,
    definitions: Object.freeze(definitions),
  })
}

export function permissionKeysFromPreparedRegistry(registry: ShieldPreparedRegistry): readonly string[] {
  const validated = shieldPreparedRegistry(registry)
  const panelIds = [...new Set(validated.definitions.map(definition => definition.panelId))]
  const keys = panelIds.flatMap(panelId => generateShieldPermissionKeys({
    definitions: validated.definitions,
    panelId,
  }))
  for (const key of keys) assertShieldPermissionKey(key)
  return Object.freeze([...new Set(keys)]
    .sort((left, right) => left.localeCompare(right)))
}
