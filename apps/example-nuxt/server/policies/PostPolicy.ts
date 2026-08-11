import { definePolicy } from '@holo-js/authorization'
import Post from '../models/Post'

function canManage(actor: object | null): boolean {
  const role = actor ? Reflect.get(actor, 'role') : null
  return role === 'admin' || role === 'editor' || role === 'super-admin' || role === 'tenant-admin'
}

export default definePolicy('example-nuxt-posts', Post, {
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
