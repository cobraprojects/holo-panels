import type { ShieldActorGrantQuery, ShieldActorIdentity, ShieldTenantId } from './contracts'

const IDENTIFIER = /^[a-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u
const PERMISSION_KEY = /^[a-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u
const ACTOR_TYPE = /^[A-Za-z][A-Za-z0-9]*(?:[._:/-][A-Za-z0-9]+)*$/u

export function assertShieldIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new TypeError(`${label} must be a stable identifier`)
}

export function assertShieldPermissionKey(value: string): void {
  if (!PERMISSION_KEY.test(value)) throw new TypeError('Shield permission keys must be stable dot-separated identifiers')
}

export function assertShieldActor(actor: ShieldActorIdentity): void {
  if (!ACTOR_TYPE.test(actor.type)) throw new TypeError('Shield actor types must be stable identifiers')
  if (typeof actor.id === 'string') {
    if (!actor.id.trim() || actor.id.length > 255) throw new TypeError('Shield actor IDs must be non-empty strings of at most 255 characters')
    return
  }
  if (!Number.isSafeInteger(actor.id)) throw new TypeError('Shield actor IDs must be safe integers or non-empty strings')
}

export function assertShieldTenantId(tenantId: ShieldTenantId): void {
  if (tenantId === null) return
  if (typeof tenantId === 'string') {
    if (!tenantId.trim() || tenantId.length > 255) throw new TypeError('Shield tenant IDs must be null or non-empty strings of at most 255 characters')
    return
  }
  if (!Number.isSafeInteger(tenantId)) throw new TypeError('Shield tenant IDs must be null, safe integers, or non-empty strings')
}

export function assertShieldActorGrantQuery(query: ShieldActorGrantQuery): void {
  assertShieldActor(query.actor)
  assertShieldTenantId(query.tenantId)
}

export function actorGrantKey(query: ShieldActorGrantQuery): string {
  assertShieldActorGrantQuery(query)
  return JSON.stringify([typeof query.actor.id, query.actor.id, query.actor.type, typeof query.tenantId, query.tenantId])
}
