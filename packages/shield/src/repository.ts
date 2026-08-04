import type {
  ShieldActorGrantQuery,
  ShieldActorPermissionAssignment,
  ShieldActorRoleAssignment,
  ShieldAssignmentWriter,
  ShieldPermission,
  ShieldRepository,
  ShieldRole,
  ShieldRolePermissionAssignment,
} from './contracts'
import {
  actorGrantKey,
  assertShieldActorGrantQuery,
  assertShieldIdentifier,
  assertShieldPermissionKey,
  assertShieldTenantId,
} from './validation'

interface RepositoryState {
  readonly actorPermissions: Map<string, ShieldActorPermissionAssignment>
  readonly actorRoles: Map<string, ShieldActorRoleAssignment>
  readonly permissions: Map<string, ShieldPermission>
  readonly rolePermissions: Map<string, ShieldRolePermissionAssignment>
  readonly roles: Map<string, ShieldRole>
}

export interface ShieldAdministrationWriter extends ShieldAssignmentWriter {
  deletePermissions(permissionIds: readonly string[]): Promise<void>
  deleteRoles(roleIds: readonly string[]): Promise<void>
}

export interface ShieldPermissionAdministrationSnapshot {
  readonly permissions: readonly ShieldPermission[]
  readonly roles: readonly ShieldRole[]
}

export interface ShieldAdministrationRepository extends ShieldRepository {
  loadAdministration(): Promise<ShieldPermissionAdministrationSnapshot>
  transaction<TResult>(operation: (writer: ShieldAdministrationWriter) => Promise<TResult>): Promise<TResult>
}

function emptyState(): RepositoryState {
  return {
    actorPermissions: new Map(),
    actorRoles: new Map(),
    permissions: new Map(),
    rolePermissions: new Map(),
    roles: new Map(),
  }
}

function cloneState(state: RepositoryState): RepositoryState {
  return {
    actorPermissions: new Map(state.actorPermissions),
    actorRoles: new Map(state.actorRoles),
    permissions: new Map(state.permissions),
    rolePermissions: new Map(state.rolePermissions),
    roles: new Map(state.roles),
  }
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function assignmentKey(scopeKey: string, assignedId: string): string {
  return JSON.stringify([scopeKey, assignedId])
}

function validateRole(role: ShieldRole, state: RepositoryState): void {
  assertShieldIdentifier(role.id, 'Shield role IDs')
  assertShieldIdentifier(role.name, 'Shield role names')
  assertShieldTenantId(role.tenantId)
  if (typeof role.superAdmin !== 'boolean') throw new TypeError('Shield role superAdmin must be boolean')
  const duplicate = [...state.roles.values()].find(candidate => candidate.id !== role.id && candidate.name === role.name && candidate.tenantId === role.tenantId)
  if (duplicate) throw new Error(`Shield role name "${role.name}" is already assigned in this tenant scope`)
  const incompatibleAssignment = [...state.actorRoles.values()].find(assignment => assignment.roleId === role.id
    && role.tenantId !== null
    && assignment.tenantId !== role.tenantId)
  if (incompatibleAssignment) throw new Error(`Shield role "${role.id}" cannot move to a different tenant scope while assigned`)
}

function validatePermission(permission: ShieldPermission, state: RepositoryState): void {
  assertShieldIdentifier(permission.id, 'Shield permission IDs')
  assertShieldPermissionKey(permission.key)
  const duplicate = [...state.permissions.values()].find(candidate => candidate.id !== permission.id && candidate.key === permission.key)
  if (duplicate) throw new Error(`Shield permission key "${permission.key}" is already assigned`)
}

function assertPermissionIds(state: RepositoryState, permissionIds: readonly string[]): readonly string[] {
  const unique = sortedUnique(permissionIds)
  for (const permissionId of unique) {
    assertShieldIdentifier(permissionId, 'Shield permission IDs')
    if (!state.permissions.has(permissionId)) throw new Error(`Shield permission "${permissionId}" does not exist`)
  }
  return unique
}

function createWriter(state: RepositoryState, invalidations: Map<string, ShieldActorGrantQuery | null>): ShieldAdministrationWriter {
  return {
    async deletePermissions(permissionIds) {
      const desired = sortedUnique(permissionIds)
      for (const permissionId of desired) {
        assertShieldIdentifier(permissionId, 'Shield permission IDs')
        state.permissions.delete(permissionId)
      }
      const removed = new Set(desired)
      for (const [key, assignment] of state.rolePermissions) {
        if (removed.has(assignment.permissionId)) state.rolePermissions.delete(key)
      }
      for (const [key, assignment] of state.actorPermissions) {
        if (removed.has(assignment.permissionId)) state.actorPermissions.delete(key)
      }
      if (removed.size > 0) invalidations.set('*', null)
    },
    async deleteRoles(roleIds) {
      const desired = sortedUnique(roleIds)
      for (const roleId of desired) {
        assertShieldIdentifier(roleId, 'Shield role IDs')
        state.roles.delete(roleId)
      }
      const removed = new Set(desired)
      for (const [key, assignment] of state.rolePermissions) {
        if (removed.has(assignment.roleId)) state.rolePermissions.delete(key)
      }
      for (const [key, assignment] of state.actorRoles) {
        if (removed.has(assignment.roleId)) state.actorRoles.delete(key)
      }
      if (removed.size > 0) invalidations.set('*', null)
    },
    async savePermission(permission) {
      validatePermission(permission, state)
      state.permissions.set(permission.id, Object.freeze({ ...permission }))
      invalidations.set('*', null)
    },
    async saveRole(role) {
      validateRole(role, state)
      state.roles.set(role.id, Object.freeze({ ...role }))
      invalidations.set('*', null)
    },
    async syncActorPermissions(query, permissionIds) {
      assertShieldActorGrantQuery(query)
      const scopeKey = actorGrantKey(query)
      const desired = assertPermissionIds(state, permissionIds)
      for (const [key, assignment] of state.actorPermissions) {
        if (actorGrantKey(assignment) === scopeKey) state.actorPermissions.delete(key)
      }
      for (const permissionId of desired) {
        state.actorPermissions.set(assignmentKey(scopeKey, permissionId), Object.freeze({
          actor: Object.freeze({ ...query.actor }),
          permissionId,
          tenantId: query.tenantId,
        }))
      }
      invalidations.set(scopeKey, Object.freeze({ actor: Object.freeze({ ...query.actor }), tenantId: query.tenantId }))
    },
    async syncActorRoles(query, roleIds) {
      assertShieldActorGrantQuery(query)
      const scopeKey = actorGrantKey(query)
      const desired = sortedUnique(roleIds)
      for (const roleId of desired) {
        assertShieldIdentifier(roleId, 'Shield role IDs')
        const role = state.roles.get(roleId)
        if (!role) throw new Error(`Shield role "${roleId}" does not exist`)
        if (role.tenantId !== null && role.tenantId !== query.tenantId) {
          throw new Error(`Shield role "${roleId}" belongs to a different tenant scope`)
        }
      }
      for (const [key, assignment] of state.actorRoles) {
        if (actorGrantKey(assignment) === scopeKey) state.actorRoles.delete(key)
      }
      for (const roleId of desired) {
        state.actorRoles.set(assignmentKey(scopeKey, roleId), Object.freeze({
          actor: Object.freeze({ ...query.actor }),
          roleId,
          tenantId: query.tenantId,
        }))
      }
      invalidations.set(scopeKey, Object.freeze({ actor: Object.freeze({ ...query.actor }), tenantId: query.tenantId }))
    },
    async syncRolePermissions(roleId, permissionIds) {
      assertShieldIdentifier(roleId, 'Shield role IDs')
      if (!state.roles.has(roleId)) throw new Error(`Shield role "${roleId}" does not exist`)
      const desired = assertPermissionIds(state, permissionIds)
      for (const [key, assignment] of state.rolePermissions) {
        if (assignment.roleId === roleId) state.rolePermissions.delete(key)
      }
      for (const permissionId of desired) {
        state.rolePermissions.set(assignmentKey(roleId, permissionId), Object.freeze({ permissionId, roleId }))
      }
      invalidations.set('*', null)
    },
  }
}

export function createInMemoryShieldRepository(): ShieldRepository {
  let state = emptyState()
  let transactionQueue = Promise.resolve()
  const listeners = new Set<(query: ShieldActorGrantQuery | null) => void>()

  const repository: ShieldAdministrationRepository = {
    async loadActorGrants(query) {
      assertShieldActorGrantQuery(query)
      const scopeKey = actorGrantKey(query)
      const roleIds = [...state.actorRoles.values()]
        .filter(assignment => actorGrantKey(assignment) === scopeKey)
        .map(assignment => assignment.roleId)
      const roles = roleIds
        .flatMap(roleId => state.roles.get(roleId) ?? [])
        .sort((left, right) => left.id.localeCompare(right.id))
      const roleIdSet = new Set(roleIds)
      const rolePermissionKeys = [...state.rolePermissions.values()]
        .filter(assignment => roleIdSet.has(assignment.roleId))
        .flatMap(assignment => state.permissions.get(assignment.permissionId)?.key ?? [])
      const directPermissionKeys = [...state.actorPermissions.values()]
        .filter(assignment => actorGrantKey(assignment) === scopeKey)
        .flatMap(assignment => state.permissions.get(assignment.permissionId)?.key ?? [])
      return Object.freeze({
        directPermissionKeys: Object.freeze(sortedUnique(directPermissionKeys)),
        rolePermissionKeys: Object.freeze(sortedUnique(rolePermissionKeys)),
        roles: Object.freeze(roles.map(role => Object.freeze({ ...role }))),
      })
    },
    async loadAdministration() {
      return Object.freeze({
        permissions: Object.freeze([...state.permissions.values()]
          .sort((left, right) => left.key.localeCompare(right.key))
          .map(permission => Object.freeze({ ...permission }))),
        roles: Object.freeze([...state.roles.values()]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map(role => Object.freeze({ ...role }))),
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async transaction<TResult>(operation: (writer: ShieldAdministrationWriter) => Promise<TResult>): Promise<TResult> {
      let release!: () => void
      const previous = transactionQueue
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        const next = cloneState(state)
        const invalidations = new Map<string, ShieldActorGrantQuery | null>()
        const result = await operation(createWriter(next, invalidations))
        state = next
        const committedInvalidations = invalidations.has('*') ? [null] : [...invalidations.values()]
        for (const query of committedInvalidations) {
          for (const listener of listeners) {
            try {
              listener(query)
            } catch (error) {
              void error
            }
          }
        }
        return result
      } finally {
        release()
      }
    },
  }
  return repository
}

export function shieldAdministrationRepository(repository: ShieldRepository): ShieldAdministrationRepository {
  if (!('loadAdministration' in repository) || typeof repository.loadAdministration !== 'function') {
    throw new TypeError('Shield administration requires a repository with administration capabilities')
  }
  return repository as ShieldAdministrationRepository
}
