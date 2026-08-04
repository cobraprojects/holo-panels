export class AdminActor {
  declare readonly id: number | string
  declare readonly role: string
}

export function canManageAccess(actor: AdminActor): boolean {
  return ['admin', 'super-admin', 'tenant-admin'].includes(actor.role)
}

export function canManagePosts(actor: AdminActor): boolean {
  return ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(actor.role)
}

export function canManageResource(actor: AdminActor, resourceId: string): boolean {
  return resourceId === 'users' || resourceId === 'memberships'
    ? canManageAccess(actor)
    : canManagePosts(actor)
}
