export const exampleRoleKeys = ['super-admin', 'tenant-admin', 'editor', 'denied'] as const

export type ExampleRoleKey = typeof exampleRoleKeys[number]
export type ExampleResourceId = 'categories' | 'comments' | 'media' | 'memberships' | 'posts' | 'post-tags' | 'tags' | 'users'

export class ExampleAdminActor {
  declare readonly canManagePosts?: boolean
  declare readonly id: number | string
  declare readonly name: string
  declare readonly roleKey?: ExampleRoleKey
  declare readonly tenantId: string
  declare readonly tenantIds?: readonly string[]
}

const contentResources = new Set<ExampleResourceId>(['categories', 'comments', 'media', 'posts', 'post-tags', 'tags'])
const administrativeResources = new Set<ExampleResourceId>(['memberships', 'users'])

export function isExampleRoleKey(value: unknown): value is ExampleRoleKey {
  return typeof value === 'string' && (exampleRoleKeys as readonly string[]).includes(value)
}

export function isExampleAdminActor(value: object | null): value is ExampleAdminActor {
  if (!value) return false
  const id = Reflect.get(value, 'id')
  return (typeof id === 'number' || typeof id === 'string')
    && typeof Reflect.get(value, 'name') === 'string'
    && typeof Reflect.get(value, 'tenantId') === 'string'
}

export function canBootstrapAdmin(actor: ExampleAdminActor): boolean {
  if (actor.roleKey === 'denied') return false
  return actor.canManagePosts === true || actor.roleKey === 'editor' || actor.roleKey === 'tenant-admin' || actor.roleKey === 'super-admin'
}

export function canAccessTenant(actor: ExampleAdminActor, tenantId: string): boolean {
  if (!canBootstrapAdmin(actor)) return false
  if (actor.roleKey === 'super-admin') return actor.tenantIds?.includes(tenantId) ?? actor.tenantId === tenantId
  return actor.tenantId === tenantId && (actor.tenantIds?.includes(tenantId) ?? true)
}

export function canManageResource(actor: ExampleAdminActor, resourceId: ExampleResourceId): boolean {
  if (!canBootstrapAdmin(actor)) return false
  if (actor.roleKey === 'super-admin' || actor.roleKey === 'tenant-admin') return true
  if (actor.roleKey === 'editor') return contentResources.has(resourceId)
  if (actor.canManagePosts === true) return contentResources.has(resourceId) && !administrativeResources.has(resourceId)
  return false
}
