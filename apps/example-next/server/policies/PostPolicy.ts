import { definePolicy } from '@holo-js/authorization'
import Post from '../models/Post'

function canManage(actor: object | null): boolean {
  const role = actor ? Reflect.get(actor, 'role') : null
  const roleKey = actor ? Reflect.get(actor, 'roleKey') : null
  return role === 'admin' || role === 'editor' || role === 'super-admin' || role === 'tenant-admin' || roleKey === 'admin' || roleKey === 'editor' || roleKey === 'super-admin' || roleKey === 'tenant-admin' || Reflect.get(actor ?? {}, 'canManagePosts') === true
}

export default definePolicy('example-next-posts', Post, {
  class: {
    create: ({ user }) => canManage(user),
    viewAny: ({ user }) => canManage(user),
  },
  record: {
    create: ({ user }) => canManage(user),
    delete: ({ user }) => canManage(user),
    forceDelete: ({ user }) => canManage(user),
    restore: ({ user }) => canManage(user),
    update: ({ user }) => canManage(user),
    view: ({ user }) => canManage(user),
    viewAny: ({ user }) => canManage(user),
  },
})
