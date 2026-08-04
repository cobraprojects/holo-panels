import { DB, TableQueryBuilder, type DatabaseContext } from '@holo-js/db'
import type {
  ShieldActorGrantQuery,
  ShieldActorId,
  ShieldPermission,
  ShieldRole,
  ShieldTenantId,
} from '../contracts'
import type { ShieldAdministrationRepository, ShieldAdministrationWriter } from '../repository'
import {
  actorGrantKey,
  assertShieldActorGrantQuery,
  assertShieldIdentifier,
  assertShieldPermissionKey,
  assertShieldTenantId,
} from '../validation'

type PrimitiveKind = 'null' | 'number' | 'string'

interface PrimitiveColumns {
  readonly kind: PrimitiveKind
  readonly value: string
}

interface RoleRow extends Record<string, unknown> {
  readonly id: string
  readonly name: string
  readonly super_admin: boolean | number
  readonly tenant_id_kind: PrimitiveKind
  readonly tenant_id_value: string
}

interface PermissionRow extends Record<string, unknown> {
  readonly id: string
  readonly permission_key: string
}

interface RolePermissionRow extends Record<string, unknown> {
  readonly permission_id: string
  readonly role_id: string
}

interface ActorRoleRow extends Record<string, unknown> {
  readonly role_id: string
}

interface ActorPermissionRow extends Record<string, unknown> {
  readonly permission_id: string
}

const rolesTable = 'panel_shield_roles'
const permissionsTable = 'panel_shield_permissions'
const rolePermissionsTable = 'panel_shield_role_permissions'
const actorRolesTable = 'panel_shield_actor_roles'
const actorPermissionsTable = 'panel_shield_actor_permissions'

function encodePrimitive(value: ShieldActorId | ShieldTenantId): PrimitiveColumns {
  if (value === null) return { kind: 'null', value: '' }
  if (typeof value === 'number') return { kind: 'number', value: String(value) }
  return { kind: 'string', value }
}

function decodeTenant(kind: PrimitiveKind, value: string): ShieldTenantId {
  if (kind === 'null') return null
  if (kind === 'number') {
    const decoded = Number(value)
    if (!Number.isFinite(decoded)) throw new Error('Stored Shield tenant ID is not a finite number')
    return decoded
  }
  return value
}

function table(context: DatabaseContext, name: string): TableQueryBuilder<string> {
  return new TableQueryBuilder(name, context)
}

function scopedTable(context: DatabaseContext, name: string, query: ShieldActorGrantQuery): TableQueryBuilder<string> {
  const actorId = encodePrimitive(query.actor.id)
  const tenantId = encodePrimitive(query.tenantId)
  return table(context, name)
    .where('actor_type', query.actor.type)
    .where('actor_id_kind', actorId.kind)
    .where('actor_id_value', actorId.value)
    .where('tenant_id_kind', tenantId.kind)
    .where('tenant_id_value', tenantId.value)
}

function roleFromRow(row: RoleRow): ShieldRole {
  return Object.freeze({
    id: row.id,
    name: row.name,
    superAdmin: row.super_admin === true || row.super_admin === 1,
    tenantId: decodeTenant(row.tenant_id_kind, row.tenant_id_value),
  })
}

function permissionFromRow(row: PermissionRow): ShieldPermission {
  return Object.freeze({ id: row.id, key: row.permission_key })
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

async function assertPermissionIds(context: DatabaseContext, permissionIds: readonly string[]): Promise<readonly string[]> {
  const unique = sortedUnique(permissionIds)
  for (const permissionId of unique) assertShieldIdentifier(permissionId, 'Shield permission IDs')
  if (unique.length === 0) return unique
  const rows = await table(context, permissionsTable).whereIn('id', unique).select('id').get<{ id: string }>()
  const found = new Set(rows.map(row => row.id))
  for (const permissionId of unique) {
    if (!found.has(permissionId)) throw new Error(`Shield permission "${permissionId}" does not exist`)
  }
  return unique
}

async function loadPermissions(context: DatabaseContext): Promise<readonly ShieldPermission[]> {
  const rows = await table(context, permissionsTable)
    .select('id', 'permission_key')
    .orderBy('permission_key')
    .get<PermissionRow>()
  return Object.freeze(rows.map(permissionFromRow))
}

async function loadRoles(context: DatabaseContext): Promise<readonly ShieldRole[]> {
  const rows = await table(context, rolesTable)
    .select('id', 'name', 'super_admin', 'tenant_id_kind', 'tenant_id_value')
    .orderBy('id')
    .get<RoleRow>()
  return Object.freeze(rows.map(roleFromRow))
}

function createWriter(
  context: DatabaseContext,
  invalidations: Map<string, ShieldActorGrantQuery | null>,
): ShieldAdministrationWriter {
  return {
    async deletePermissions(permissionIds) {
      const desired = sortedUnique(permissionIds)
      for (const permissionId of desired) assertShieldIdentifier(permissionId, 'Shield permission IDs')
      if (desired.length === 0) return
      await table(context, permissionsTable).whereIn('id', desired).delete()
      invalidations.set('*', null)
    },
    async deleteRoles(roleIds) {
      const desired = sortedUnique(roleIds)
      for (const roleId of desired) assertShieldIdentifier(roleId, 'Shield role IDs')
      if (desired.length === 0) return
      await table(context, actorRolesTable).whereIn('role_id', desired).delete()
      await table(context, rolePermissionsTable).whereIn('role_id', desired).delete()
      await table(context, rolesTable).whereIn('id', desired).delete()
      invalidations.set('*', null)
    },
    async savePermission(permission) {
      assertShieldIdentifier(permission.id, 'Shield permission IDs')
      assertShieldPermissionKey(permission.key)
      const duplicate = await table(context, permissionsTable)
        .where('permission_key', permission.key)
        .where('id', '!=', permission.id)
        .first<PermissionRow>()
      if (duplicate) throw new Error(`Shield permission key "${permission.key}" is already assigned`)
      await table(context, permissionsTable).upsert({
        id: permission.id,
        permission_key: permission.key,
      }, ['id'], ['permission_key'])
      invalidations.set('*', null)
    },
    async saveRole(role) {
      assertShieldIdentifier(role.id, 'Shield role IDs')
      assertShieldIdentifier(role.name, 'Shield role names')
      assertShieldTenantId(role.tenantId)
      if (typeof role.superAdmin !== 'boolean') throw new TypeError('Shield role superAdmin must be boolean')
      const tenantId = encodePrimitive(role.tenantId)
      const duplicate = await table(context, rolesTable)
        .where('name', role.name)
        .where('tenant_id_kind', tenantId.kind)
        .where('tenant_id_value', tenantId.value)
        .where('id', '!=', role.id)
        .first<RoleRow>()
      if (duplicate) throw new Error(`Shield role name "${role.name}" is already assigned in this tenant scope`)
      if (role.tenantId !== null) {
        const assignments = await table(context, actorRolesTable)
          .where('role_id', role.id)
          .select('tenant_id_kind', 'tenant_id_value')
          .get<{ tenant_id_kind: PrimitiveKind, tenant_id_value: string }>()
        const incompatible = assignments.some(assignment => (
          assignment.tenant_id_kind !== tenantId.kind || assignment.tenant_id_value !== tenantId.value
        ))
        if (incompatible) throw new Error(`Shield role "${role.id}" cannot move to a different tenant scope while assigned`)
      }
      await table(context, rolesTable).upsert({
        id: role.id,
        name: role.name,
        super_admin: role.superAdmin ? 1 : 0,
        tenant_id_kind: tenantId.kind,
        tenant_id_value: tenantId.value,
      }, ['id'], ['name', 'super_admin', 'tenant_id_kind', 'tenant_id_value'])
      invalidations.set('*', null)
    },
    async syncActorPermissions(query, permissionIds) {
      assertShieldActorGrantQuery(query)
      const desired = await assertPermissionIds(context, permissionIds)
      await scopedTable(context, actorPermissionsTable, query).delete()
      if (desired.length > 0) {
        const actorId = encodePrimitive(query.actor.id)
        const tenantId = encodePrimitive(query.tenantId)
        await table(context, actorPermissionsTable).insert(desired.map(permissionId => ({
          actor_type: query.actor.type,
          actor_id_kind: actorId.kind,
          actor_id_value: actorId.value,
          permission_id: permissionId,
          tenant_id_kind: tenantId.kind,
          tenant_id_value: tenantId.value,
        })))
      }
      invalidations.set(actorGrantKey(query), Object.freeze({
        actor: Object.freeze({ ...query.actor }),
        tenantId: query.tenantId,
      }))
    },
    async syncActorRoles(query, roleIds) {
      assertShieldActorGrantQuery(query)
      const desired = sortedUnique(roleIds)
      for (const roleId of desired) assertShieldIdentifier(roleId, 'Shield role IDs')
      const rows = desired.length === 0 ? [] : await table(context, rolesTable).whereIn('id', desired).get<RoleRow>()
      const found = new Map(rows.map(row => [row.id, roleFromRow(row)]))
      for (const roleId of desired) {
        const role = found.get(roleId)
        if (!role) throw new Error(`Shield role "${roleId}" does not exist`)
        if (role.tenantId !== null && role.tenantId !== query.tenantId) {
          throw new Error(`Shield role "${roleId}" belongs to a different tenant scope`)
        }
      }
      await scopedTable(context, actorRolesTable, query).delete()
      if (desired.length > 0) {
        const actorId = encodePrimitive(query.actor.id)
        const tenantId = encodePrimitive(query.tenantId)
        await table(context, actorRolesTable).insert(desired.map(roleId => ({
          actor_type: query.actor.type,
          actor_id_kind: actorId.kind,
          actor_id_value: actorId.value,
          role_id: roleId,
          tenant_id_kind: tenantId.kind,
          tenant_id_value: tenantId.value,
        })))
      }
      invalidations.set(actorGrantKey(query), Object.freeze({
        actor: Object.freeze({ ...query.actor }),
        tenantId: query.tenantId,
      }))
    },
    async syncRolePermissions(roleId, permissionIds) {
      assertShieldIdentifier(roleId, 'Shield role IDs')
      if (!await table(context, rolesTable).where('id', roleId).exists()) {
        throw new Error(`Shield role "${roleId}" does not exist`)
      }
      const desired = await assertPermissionIds(context, permissionIds)
      await table(context, rolePermissionsTable).where('role_id', roleId).delete()
      if (desired.length > 0) {
        await table(context, rolePermissionsTable).insert(desired.map(permissionId => ({ permission_id: permissionId, role_id: roleId })))
      }
      invalidations.set('*', null)
    },
  }
}

function notifyListeners(
  listeners: ReadonlySet<(query: ShieldActorGrantQuery | null) => void>,
  invalidations: ReadonlyMap<string, ShieldActorGrantQuery | null>,
): void {
  const committed = invalidations.has('*') ? [null] : [...invalidations.values()]
  for (const query of committed) {
    for (const listener of listeners) {
      try {
        listener(query)
      } catch (error) {
        void error
      }
    }
  }
}

export function createHoloShieldRepository(connectionName?: string): ShieldAdministrationRepository {
  const listeners = new Set<(query: ShieldActorGrantQuery | null) => void>()
  const context = (): DatabaseContext => DB.connection(connectionName)
  const repository: ShieldAdministrationRepository = {
    async loadActorGrants(query) {
      assertShieldActorGrantQuery(query)
      const actorRoleRows = await scopedTable(context(), actorRolesTable, query).select('role_id').get<ActorRoleRow>()
      const roleIds = sortedUnique(actorRoleRows.map(row => row.role_id))
      const roles = roleIds.length === 0
        ? []
        : (await table(context(), rolesTable).whereIn('id', roleIds).orderBy('id').get<RoleRow>()).map(roleFromRow)
      const rolePermissionRows = roleIds.length === 0
        ? []
        : await table(context(), rolePermissionsTable).whereIn('role_id', roleIds).get<RolePermissionRow>()
      const directPermissionRows = await scopedTable(context(), actorPermissionsTable, query)
        .select('permission_id')
        .get<ActorPermissionRow>()
      const rolePermissionIds = sortedUnique(rolePermissionRows.map(row => row.permission_id))
      const directPermissionIds = sortedUnique(directPermissionRows.map(row => row.permission_id))
      const allPermissionIds = sortedUnique([...rolePermissionIds, ...directPermissionIds])
      const permissionRows = allPermissionIds.length === 0
        ? []
        : await table(context(), permissionsTable).whereIn('id', allPermissionIds).get<PermissionRow>()
      const permissionKeys = new Map(permissionRows.map(row => [row.id, row.permission_key]))
      return Object.freeze({
        directPermissionKeys: Object.freeze(sortedUnique(directPermissionIds.flatMap(id => permissionKeys.get(id) ?? []))),
        rolePermissionKeys: Object.freeze(sortedUnique(rolePermissionIds.flatMap(id => permissionKeys.get(id) ?? []))),
        roles: Object.freeze(roles),
      })
    },
    async loadAdministration() {
      const [permissions, roles] = await Promise.all([
        loadPermissions(context()),
        loadRoles(context()),
      ])
      return Object.freeze({ permissions, roles })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async transaction<TResult>(operation: (writer: ShieldAdministrationWriter) => Promise<TResult>): Promise<TResult> {
      const invalidations = new Map<string, ShieldActorGrantQuery | null>()
      const execute = async (transactionContext: DatabaseContext): Promise<TResult> => operation(createWriter(transactionContext, invalidations))
      const result = typeof connectionName === 'string'
        ? await DB.writeTransaction(execute, connectionName)
        : await DB.writeTransaction(execute)
      notifyListeners(listeners, invalidations)
      return result
    },
  }
  return repository
}
