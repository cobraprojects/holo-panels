import type User from '../models/User'

export const exampleRoleKeys = ['super-admin', 'tenant-admin', 'editor', 'denied'] as const

export type ExampleRoleKey = typeof exampleRoleKeys[number]
export type ExampleResourceId = 'categories' | 'comments' | 'media' | 'memberships' | 'posts' | 'post-tags' | 'tags' | 'users'
export type ExampleAdminActor = Pick<Awaited<ReturnType<typeof User.create>>, 'id' | 'name' | 'roleKey' | 'tenantId'> & {
  readonly canManagePosts?: boolean
  readonly tenantIds?: readonly string[]
}
export type PanelActor = Awaited<ReturnType<typeof User.create>> & Pick<ExampleAdminActor, 'canManagePosts' | 'tenantIds'>

const contentResources = new Set<ExampleResourceId>(['categories', 'comments', 'media', 'posts', 'post-tags', 'tags'])

export function canBootstrapAdmin(actor: ExampleAdminActor): boolean {
  return actor.roleKey !== 'denied' && (actor.canManagePosts === true || actor.roleKey === 'editor' || actor.roleKey === 'tenant-admin' || actor.roleKey === 'super-admin')
}

export function canAccessTenant(actor: ExampleAdminActor, tenantId: string): boolean {
  if (!canBootstrapAdmin(actor)) return false
  if (actor.roleKey === 'super-admin') return actor.tenantIds?.includes(tenantId) ?? actor.tenantId === tenantId
  return actor.tenantId === tenantId && (actor.tenantIds?.includes(tenantId) ?? true)
}

export function canManageResource(actor: ExampleAdminActor, resourceId: ExampleResourceId): boolean {
  if (!canBootstrapAdmin(actor)) return false
  if (actor.roleKey === 'super-admin' || actor.roleKey === 'tenant-admin') return true
  return (actor.roleKey === 'editor' || actor.canManagePosts === true) && contentResources.has(resourceId)
}
