import type {
  ShieldActorGrantQuery,
  ShieldActorGrantSnapshot,
  ShieldEvaluationInput,
  ShieldEvaluator,
  ShieldEvaluatorOptions,
} from './contracts'
import { actorGrantKey, assertShieldActorGrantQuery, assertShieldPermissionKey } from './validation'

export class ShieldAuthorizationError extends Error {
  readonly permission: string

  constructor(permission: string) {
    super(`Shield denied permission "${permission}"`)
    this.name = 'ShieldAuthorizationError'
    this.permission = permission
  }
}

export function createShieldEvaluator(options: ShieldEvaluatorOptions): ShieldEvaluator {
  const cache = new Map<string, Promise<ShieldActorGrantSnapshot>>()
  const directPermissions = options.directPermissions ?? false
  const invalidate = (query?: ShieldActorGrantQuery): void => {
    if (!query) {
      cache.clear()
      return
    }
    cache.delete(actorGrantKey(query))
  }
  const unsubscribe = options.repository.subscribe(query => invalidate(query ?? undefined))

  const load = (query: ShieldActorGrantQuery): Promise<ShieldActorGrantSnapshot> => {
    const key = actorGrantKey(query)
    const cached = cache.get(key)
    if (cached) return cached
    const pending = options.repository.loadActorGrants(query).catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, pending)
    return pending
  }

  const can = async (input: ShieldEvaluationInput): Promise<boolean> => {
    assertShieldActorGrantQuery(input)
    assertShieldPermissionKey(input.permission)
    const grants = await load(input)
    if (grants.roles.some(role => role.superAdmin)) return true
    if (grants.rolePermissionKeys.includes(input.permission)) return true
    return directPermissions && grants.directPermissionKeys.includes(input.permission)
  }

  return Object.freeze({
    async authorize(input: ShieldEvaluationInput) {
      if (!await can(input)) throw new ShieldAuthorizationError(input.permission)
    },
    can,
    dispose() {
      cache.clear()
      unsubscribe()
    },
    invalidate,
  })
}
