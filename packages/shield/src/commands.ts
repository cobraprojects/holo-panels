import type { ShieldPermission, ShieldRole, ShieldTenantId } from './contracts'
import { shieldAdministrationRepository, type ShieldAdministrationRepository } from './repository'
import { assertShieldIdentifier, assertShieldPermissionKey, assertShieldTenantId } from './validation'

export interface ShieldPermissionDiff {
  readonly missing: readonly string[]
  readonly stale: readonly string[]
  readonly unchanged: readonly string[]
}

export interface ShieldCommandPolicy {
  readonly allowProduction?: boolean
  readonly environment: string
}

export interface ShieldPermissionSyncOptions extends ShieldCommandPolicy {
  readonly confirmed?: boolean
  readonly permissionKeys: readonly string[]
  readonly removeStale?: boolean
  readonly repository: ShieldAdministrationRepository
}

export interface ShieldRoleSeed {
  readonly id: string
  readonly name: string
  readonly permissionKeys: readonly string[]
  readonly superAdmin?: boolean
  readonly tenantId?: ShieldTenantId
}

function uniqueKeys(keys: readonly string[]): readonly string[] {
  for (const key of keys) assertShieldPermissionKey(key)
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right))
}

function permissionRecord(key: string): ShieldPermission {
  return Object.freeze({ id: key, key })
}

function assertMutationAllowed(policy: ShieldCommandPolicy): void {
  if (policy.environment.trim().toLowerCase() === 'production' && policy.allowProduction !== true) {
    throw new Error('Shield mutation commands are disabled in production')
  }
}

export async function diffShieldPermissions(
  repository: ShieldAdministrationRepository,
  permissionKeys: readonly string[],
): Promise<ShieldPermissionDiff> {
  const desired = uniqueKeys(permissionKeys)
  const current = uniqueKeys((await repository.loadAdministration()).permissions.map(permission => permission.key))
  const desiredSet = new Set(desired)
  const currentSet = new Set(current)
  return Object.freeze({
    missing: Object.freeze(desired.filter(key => !currentSet.has(key))),
    stale: Object.freeze(current.filter(key => !desiredSet.has(key))),
    unchanged: Object.freeze(desired.filter(key => currentSet.has(key))),
  })
}

export async function syncShieldPermissions(options: ShieldPermissionSyncOptions): Promise<ShieldPermissionDiff> {
  assertMutationAllowed(options)
  if (options.removeStale && options.confirmed !== true) {
    throw new Error('Removing stale Shield permissions requires explicit confirmation')
  }
  const before = await diffShieldPermissions(options.repository, options.permissionKeys)
  const current = (await options.repository.loadAdministration()).permissions
  await options.repository.transaction(async (writer) => {
    const desired = new Set(uniqueKeys(options.permissionKeys))
    const currentKeys = new Set(current.map(permission => permission.key))
    for (const key of desired) {
      if (!currentKeys.has(key)) await writer.savePermission(permissionRecord(key))
    }
    if (options.removeStale) {
      await writer.deletePermissions(current.filter(permission => !desired.has(permission.key)).map(permission => permission.id))
    }
  })
  return before
}

export async function makeShieldRole(
  repository: ShieldAdministrationRepository,
  name: string,
  policy: ShieldCommandPolicy,
): Promise<ShieldRole> {
  assertMutationAllowed(policy)
  assertShieldIdentifier(name, 'Shield role names')
  const role: ShieldRole = Object.freeze({ id: name, name, superAdmin: false, tenantId: null })
  await repository.transaction(writer => writer.saveRole(role))
  return role
}

export async function seedShieldRoles(
  repository: ShieldAdministrationRepository,
  seeds: readonly ShieldRoleSeed[],
  policy: ShieldCommandPolicy,
): Promise<void> {
  assertMutationAllowed(policy)
  await repository.transaction(async (writer) => {
    for (const seed of seeds) {
      assertShieldIdentifier(seed.id, 'Shield role IDs')
      assertShieldIdentifier(seed.name, 'Shield role names')
      assertShieldTenantId(seed.tenantId ?? null)
      const keys = uniqueKeys(seed.permissionKeys)
      const permissions = keys.map(permissionRecord)
      for (const permission of permissions) await writer.savePermission(permission)
      await writer.saveRole(Object.freeze({
        id: seed.id,
        name: seed.name,
        superAdmin: seed.superAdmin ?? false,
        tenantId: seed.tenantId ?? null,
      }))
      await writer.syncRolePermissions(seed.id, permissions.map(permission => permission.id))
    }
  })
}

export { shieldAdministrationRepository }
