export type ShieldActorId = string | number

export type ShieldTenantId = string | number | null

export interface ShieldActorIdentity {
  readonly id: ShieldActorId
  readonly type: string
}

export interface ShieldRole {
  readonly id: string
  readonly name: string
  readonly superAdmin: boolean
  readonly tenantId: ShieldTenantId
}

export interface ShieldPermission {
  readonly id: string
  readonly key: string
}

export interface ShieldRolePermissionAssignment {
  readonly permissionId: string
  readonly roleId: string
}

export interface ShieldActorRoleAssignment {
  readonly actor: ShieldActorIdentity
  readonly roleId: string
  readonly tenantId: ShieldTenantId
}

export interface ShieldActorPermissionAssignment {
  readonly actor: ShieldActorIdentity
  readonly permissionId: string
  readonly tenantId: ShieldTenantId
}

export interface ShieldActorGrantQuery {
  readonly actor: ShieldActorIdentity
  readonly tenantId: ShieldTenantId
}

export interface ShieldActorGrantSnapshot {
  readonly directPermissionKeys: readonly string[]
  readonly rolePermissionKeys: readonly string[]
  readonly roles: readonly ShieldRole[]
}

export interface ShieldAssignmentWriter {
  savePermission(permission: ShieldPermission): Promise<void>
  saveRole(role: ShieldRole): Promise<void>
  syncActorPermissions(query: ShieldActorGrantQuery, permissionIds: readonly string[]): Promise<void>
  syncActorRoles(query: ShieldActorGrantQuery, roleIds: readonly string[]): Promise<void>
  syncRolePermissions(roleId: string, permissionIds: readonly string[]): Promise<void>
}

export interface ShieldRepository {
  loadActorGrants(query: ShieldActorGrantQuery): Promise<ShieldActorGrantSnapshot>
  subscribe(listener: (query: ShieldActorGrantQuery | null) => void): () => void
  transaction<TResult>(operation: (writer: ShieldAssignmentWriter) => Promise<TResult>): Promise<TResult>
}

export type ShieldPermissionDefinitionKind = 'action' | 'page' | 'resource' | 'widget'

export interface ShieldPreparedPermissionDefinition {
  readonly id: string
  readonly kind: ShieldPermissionDefinitionKind
  readonly panelId: string
  readonly permissionKeys?: readonly string[]
}

export interface ShieldPermissionGenerationInput {
  readonly definitions: readonly ShieldPreparedPermissionDefinition[]
  readonly namespace?: string
  readonly panelId: string
}

export interface ShieldEvaluationInput extends ShieldActorGrantQuery {
  readonly permission: string
}

export interface ShieldEvaluatorOptions {
  readonly directPermissions?: boolean
  readonly repository: ShieldRepository
}

export interface ShieldEvaluator {
  authorize(input: ShieldEvaluationInput): Promise<void>
  can(input: ShieldEvaluationInput): Promise<boolean>
  dispose(): void
  invalidate(query?: ShieldActorGrantQuery): void
}

export type ShieldAuthorizationLayer = 'invariant' | 'panel' | 'policy' | 'shield' | 'tenant'

export type ShieldAuthorizationCheck = () => boolean | void | Promise<boolean | void>

export interface ShieldAuthorizationComposition {
  readonly invariant: ShieldAuthorizationCheck
  readonly panelAccess: ShieldAuthorizationCheck
  readonly policy: ShieldAuthorizationCheck
  readonly shield: ShieldAuthorizationCheck
  readonly tenantAccess?: ShieldAuthorizationCheck
}
