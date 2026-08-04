# P14 public API proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

This proposal is additive. It does not rename, remove, or reshape an existing public API.

## Shield storage and evaluation

```ts
export type ShieldActorId = string | number
export type ShieldTenantId = string | number | null

export interface ShieldActorIdentity {
  readonly type: string
  readonly id: ShieldActorId
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
  readonly roleId: string
  readonly permissionId: string
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
  readonly roles: readonly ShieldRole[]
  readonly rolePermissionKeys: readonly string[]
  readonly directPermissionKeys: readonly string[]
}

export interface ShieldAssignmentWriter {
  saveRole(role: ShieldRole): Promise<void>
  savePermission(permission: ShieldPermission): Promise<void>
  syncRolePermissions(roleId: string, permissionIds: readonly string[]): Promise<void>
  syncActorRoles(query: ShieldActorGrantQuery, roleIds: readonly string[]): Promise<void>
  syncActorPermissions(query: ShieldActorGrantQuery, permissionIds: readonly string[]): Promise<void>
}

export interface ShieldRepository {
  loadActorGrants(query: ShieldActorGrantQuery): Promise<ShieldActorGrantSnapshot>
  transaction<TResult>(operation: (writer: ShieldAssignmentWriter) => Promise<TResult>): Promise<TResult>
  subscribe(listener: (query: ShieldActorGrantQuery | null) => void): () => void
}

export function createInMemoryShieldRepository(): ShieldRepository

export type ShieldPermissionDefinitionKind = 'resource' | 'page' | 'widget'

export interface ShieldPreparedPermissionDefinition {
  readonly kind: ShieldPermissionDefinitionKind
  readonly id: string
  readonly panelId: string
  readonly permissionKeys?: readonly string[]
}

export interface ShieldPermissionGenerationInput {
  readonly panelId: string
  readonly namespace?: string
  readonly definitions: readonly ShieldPreparedPermissionDefinition[]
}

export const SHIELD_RESOURCE_OPERATIONS: readonly [
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
]

export function generateShieldPermissionKeys(input: ShieldPermissionGenerationInput): readonly string[]

export interface ShieldEvaluationInput extends ShieldActorGrantQuery {
  readonly permission: string
}

export interface ShieldEvaluatorOptions {
  readonly repository: ShieldRepository
  readonly directPermissions?: boolean
}

export class ShieldAuthorizationError extends Error {
  readonly permission: string
}

export interface ShieldEvaluator {
  can(input: ShieldEvaluationInput): Promise<boolean>
  authorize(input: ShieldEvaluationInput): Promise<void>
  invalidate(query?: ShieldActorGrantQuery): void
  dispose(): void
}

export function createShieldEvaluator(options: ShieldEvaluatorOptions): ShieldEvaluator

export type ShieldAuthorizationLayer = 'panel' | 'tenant' | 'shield' | 'policy' | 'invariant'

export class ShieldLayerAuthorizationError extends Error {
  readonly layer: ShieldAuthorizationLayer
}

export type ShieldAuthorizationCheck = () => boolean | void | Promise<boolean | void>

export interface ShieldAuthorizationComposition {
  readonly panelAccess: ShieldAuthorizationCheck
  readonly tenantAccess?: ShieldAuthorizationCheck
  readonly shield: ShieldAuthorizationCheck
  readonly policy: ShieldAuthorizationCheck
  readonly invariant: ShieldAuthorizationCheck
}

export function composeShieldAuthorization(composition: ShieldAuthorizationComposition): Promise<void>
```

Repository transactions enforce referential integrity and composite uniqueness and invalidate once after a successful commit. Evaluator caches are scoped by actor type, actor ID, and tenant. Direct permissions default to disabled. Super-admin bypasses only the Shield layer. Wildcards and full authorization bypasses are not included. Authorization order is panel, tenant, Shield, policy, invariant.

## Panel plugin integration

```ts
export interface PanelAuthorizationRequest<TActor, TTenant = unknown> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly permission: string
  readonly tenant: TTenant
  readonly signal: AbortSignal
}

export interface PanelAuthorizationLayer<TActor, TTenant = unknown> {
  readonly id: string
  authorize(request: PanelAuthorizationRequest<TActor, TTenant>): void | Promise<void>
}

export interface PanelPluginInstallation<TActor, TTenant = unknown> {
  readonly id: string
  readonly permissionNamespace: string | null
  readonly authorizationLayer: PanelAuthorizationLayer<TActor, TTenant> | null
}

export interface PanelPlugin<TActor, TTenant = unknown> {
  readonly id: string
  install(panel: { readonly id: string, readonly guard: string }): PanelPluginInstallation<TActor, TTenant>
}

export interface CompiledPanelDefinition<TActor = unknown> {
  readonly server: {
    readonly plugins: readonly PanelPluginInstallation<TActor>[]
  }
}

export class PanelBuilder<TActor = unknown> {
  plugin<TTenant = unknown>(plugin: PanelPlugin<TActor, TTenant>): this
}
```

```ts
export interface ShieldPluginOptions<TActor, TTenant = unknown> {
  readonly repository: ShieldRepository
  readonly actor: (
    request: PanelAuthorizationRequest<TActor, TTenant>,
  ) => ShieldActorIdentity | Promise<ShieldActorIdentity>
  readonly tenant: (
    request: PanelAuthorizationRequest<TActor, TTenant>,
  ) => ShieldTenantId | Promise<ShieldTenantId>
  readonly namespace?: string
  readonly directPermissions?: boolean
}

export interface ShieldPanelPlugin<TActor, TTenant = unknown> extends PanelPlugin<TActor, TTenant> {
  readonly id: 'shield'
}

export function shield<TActor, TTenant = unknown>(
  options: ShieldPluginOptions<TActor, TTenant>,
): ShieldPanelPlugin<TActor, TTenant>
```

The installed plugin is server-only. Core retains the fixed authorization order; plugins cannot bypass panel access, tenant access, policies, or invariants. Shield defaults its namespace to the panel ID. Actor and tenant resolvers are required because inferring identities from arbitrary actor objects would weaken the security boundary. This intentionally makes the conceptual `shield()` example `shield(options)` in executable code.

## Panel tenancy

```ts
export type PanelTenantIdentifier = string | number

export interface PanelActiveTenantPersistence<TActor, TTenantId extends PanelTenantIdentifier> {
  load(scope: PanelAuthenticatedScope<TActor>): Promise<TTenantId | null>
  save(scope: PanelAuthenticatedScope<TActor>, tenantId: TTenantId): Promise<void>
  clear(scope: PanelAuthenticatedScope<TActor>): Promise<void>
}

export interface PanelTenantPresentationInput {
  readonly avatarUrl?: string | null
  readonly description?: string | null
  readonly label: string
}

export interface PanelTenancyOptions<TActor, TTenant, TTenantId extends PanelTenantIdentifier, TModel> {
  readonly model: TModel
  identify(tenant: TTenant): TTenantId
  routeKey(tenant: TTenant): string
  memberships(scope: PanelAuthenticatedScope<TActor>): readonly TTenant[] | Promise<readonly TTenant[]>
  authorize(tenant: TTenant, scope: PanelAuthenticatedScope<TActor>): boolean | Promise<boolean>
  present(
    tenant: TTenant,
    scope: PanelAuthenticatedScope<TActor>,
  ): PanelTenantPresentationInput | Promise<PanelTenantPresentationInput>
  readonly persistence: PanelActiveTenantPersistence<TActor, TTenantId>
}

export class PanelBuilder<TActor = unknown> {
  tenancy<TTenant, TTenantId extends PanelTenantIdentifier, TModel>(
    options: PanelTenancyOptions<TActor, TTenant, TTenantId, TModel>,
  ): this
}

export interface PanelTenancyManifest {
  readonly enabled: true
}

export interface PanelTenantPresentation extends JsonObject {
  avatarUrl: string | null
  description: string | null
  label: string
  routeKey: string
}

export interface PanelTenantBootstrap {
  readonly active: PanelTenantPresentation | null
  readonly memberships: readonly PanelTenantPresentation[]
}

export interface PanelManifest {
  readonly tenancy: PanelTenancyManifest | null
}

export interface PanelBootstrap {
  readonly tenancy: PanelTenantBootstrap | null
}

export interface PanelTenantIdentity {
  readonly id: PanelTenantIdentifier
  readonly routeKey: string
}

export interface PanelQueuedTenantContext {
  readonly guard: string
  readonly panelId: string
  readonly tenantId: PanelTenantIdentifier
  readonly tenantIdType: 'number' | 'string'
  readonly version: 1
}

export interface CompiledPanelTenancy<TActor> {
  active(scope: PanelAuthenticatedScope<TActor>): Promise<PanelTenantIdentity | null>
  bootstrap(scope: PanelAuthenticatedScope<TActor>): Promise<PanelTenantBootstrap>
  clear(scope: PanelAuthenticatedScope<TActor>): Promise<void>
  queuedContext(
    tenantId: PanelTenantIdentifier,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelQueuedTenantContext>
  resolveQueued(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
  switch(
    routeKey: string,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
}

export interface CompiledPanelDefinition<TActor = unknown> {
  readonly server: {
    readonly tenancy?: CompiledPanelTenancy<TActor>
  }
}
```

Tenant route keys are validated safe path segments. Switching recomputes membership and authorization. Invalid, absent, non-member, and denied route keys share the same not-found response. Stale persisted tenants are cleared. Queued contexts are versioned and bound to panel, guard, tenant ID, and ID primitive type. Only `enabled: true` is serialized in the manifest; tenant models and callbacks remain server-only.

## Holo Auth multi-factor authentication

These additions belong in the adjacent Holo-JS repository.

```ts
export interface AuthMultiFactorConfiguration {
  readonly issuer?: string
  readonly challengeRoute?: string
  readonly enrollmentTtl?: number | string
  readonly challengeTtl?: number | string
  readonly recoveryCodes?: number
  readonly allowedDriftSteps?: number
}

export interface HoloAuthConfig {
  readonly multiFactor?: boolean | AuthMultiFactorConfiguration
}

export interface AuthMultiFactorStatus {
  readonly enabled: boolean
  readonly recoveryCodesRemaining: number
}

export interface AuthMultiFactorEnrollment {
  readonly expiresAt: Date
  readonly manualKey: string
  readonly otpauthUri: string
}

export interface AuthMultiFactorRecoveryCodes {
  readonly recoveryCodes: readonly string[]
}

export interface AuthMultiFactorCodeInput {
  readonly code: string
}

export type AuthMultiFactorVerificationInput
  = | { readonly method: 'totp', readonly code: string }
    | { readonly method: 'recovery', readonly code: string }

export interface AuthMultiFactorFacade {
  status(): Promise<AuthMultiFactorStatus>
  beginEnrollment(): Promise<AuthMultiFactorEnrollment>
  confirmEnrollment(input: AuthMultiFactorCodeInput): Promise<AuthMultiFactorRecoveryCodes>
  challenge(input: AuthMultiFactorCodeInput): Promise<AuthEstablishedSession>
  recover(input: AuthMultiFactorCodeInput): Promise<AuthEstablishedSession>
  disable(input: AuthMultiFactorVerificationInput): Promise<void>
  regenerateRecoveryCodes(input: AuthMultiFactorVerificationInput): Promise<AuthMultiFactorRecoveryCodes>
}

export interface AuthSessionOnlyFacade {
  readonly multiFactor: AuthMultiFactorFacade
}

export interface AuthMultiFactorChallenge {
  readonly expiresAt: Date
  readonly recoveryAllowed: boolean
  readonly route: string
}

export interface AuthEstablishedSession {
  readonly multiFactorChallenge?: AuthMultiFactorChallenge
}

export interface AuthMultiFactorCredentialRecord {
  readonly provider: string
  readonly userId: string | number
  readonly encryptedSecret: string
  readonly recoveryCodeHashes: readonly string[]
  readonly lastUsedCounter: number | null
  readonly enabledAt: Date
  readonly updatedAt: Date
}

export interface AuthMultiFactorVerificationState {
  readonly lastUsedCounter: number | null
  readonly recoveryCodeHashes: readonly string[]
}

export interface AuthMultiFactorStore {
  find(provider: string, userId: string | number): Promise<AuthMultiFactorCredentialRecord | null>
  save(record: AuthMultiFactorCredentialRecord): Promise<void>
  delete(provider: string, userId: string | number): Promise<void>
  advanceCounter(provider: string, userId: string | number, counter: number): Promise<AuthMultiFactorVerificationState | null>
  consumeRecoveryCode(provider: string, userId: string | number, recoveryCodeHash: string): Promise<AuthMultiFactorVerificationState | null>
  replaceRecoveryCodes(
    provider: string,
    userId: string | number,
    recoveryCodeHashes: readonly string[],
    updatedAt: Date,
    verification: AuthMultiFactorVerificationState,
  ): Promise<boolean>
}

export interface AuthRuntimeBindings {
  readonly multiFactor?: AuthMultiFactorStore
  readonly multiFactorEncryptionKey?: string
}
```

Normalized configuration supplies required defaults. New auth error codes are `multi_factor_runtime_unconfigured`, `multi_factor_encryption_key_missing`, `multi_factor_authentication_required`, `multi_factor_already_enabled`, `multi_factor_not_enabled`, `multi_factor_enrollment_missing`, `multi_factor_enrollment_expired`, `multi_factor_code_invalid`, `multi_factor_challenge_missing`, and `multi_factor_challenge_expired`.

When an enabled credential logs in, the result carries a bounded MFA challenge and the guard remains unauthenticated until challenge or recovery succeeds. Impersonation does not challenge the target. Enrollment state is encrypted in the server session. Core provides the atomic database store and migration. TOTP counters only move forward atomically, recovery codes are consumed atomically, and plaintext enrollment/recovery material is returned only once. MFA is available only on session guards. Challenge and enrollment routes are CSRF-protected and rate-limited. Secrets, hashes, and pending identities never enter client auth state, Panels manifests, logs, or errors.
