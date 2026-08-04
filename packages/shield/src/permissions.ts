import type { ShieldPermissionGenerationInput, ShieldPreparedPermissionDefinition } from './contracts'
import { assertShieldIdentifier, assertShieldPermissionKey } from './validation'

export const SHIELD_RESOURCE_OPERATIONS = Object.freeze([
  'viewAny',
  'view',
  'create',
  'update',
  'delete',
  'deleteAny',
  'restore',
  'restoreAny',
  'forceDelete',
  'forceDeleteAny',
  'replicate',
  'reorder',
  'import',
  'export',
] as const)

function relativePermissionKeys(definition: ShieldPreparedPermissionDefinition): readonly string[] {
  const defaults = definition.kind === 'resource'
    ? SHIELD_RESOURCE_OPERATIONS.map(operation => `${definition.id}.${operation}`)
    : [`${definition.kind}s.${definition.id}.view`]
  return [...defaults, ...(definition.permissionKeys ?? [])]
}

export function generateShieldPermissionKeys(input: ShieldPermissionGenerationInput): readonly string[] {
  assertShieldIdentifier(input.panelId, 'Shield panel IDs')
  const namespace = input.namespace ?? input.panelId
  assertShieldIdentifier(namespace, 'Shield namespaces')
  const keys = new Set<string>()
  for (const definition of input.definitions) {
    if (definition.panelId !== input.panelId) continue
    assertShieldIdentifier(definition.id, `Shield ${definition.kind} IDs`)
    for (const key of relativePermissionKeys(definition)) {
      assertShieldPermissionKey(key)
      const relative = key.startsWith(`${input.panelId}.`) ? key.slice(input.panelId.length + 1) : key
      const namespaced = `${namespace}.${relative}`
      assertShieldPermissionKey(namespaced)
      keys.add(namespaced)
    }
  }
  return Object.freeze([...keys].sort((left, right) => left.localeCompare(right)))
}
