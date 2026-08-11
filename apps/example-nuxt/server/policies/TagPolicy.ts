import { definePolicy } from '@holo-js/authorization'
import Tag from '../models/Tag'

function canManage(actor: object | null): boolean {
  const role = actor ? Reflect.get(actor, 'role') : null
  const roleKey = actor ? Reflect.get(actor, 'roleKey') : null
  return ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(String(role ?? roleKey ?? '')) || Reflect.get(actor ?? {}, 'canManagePosts') === true
}

export default definePolicy('example-nuxt-tags', Tag, {
  class: { create: ({ user }) => canManage(user), viewAny: ({ user }) => canManage(user) },
  record: { create: ({ user }) => canManage(user), delete: ({ user }) => canManage(user), forceDelete: ({ user }) => canManage(user), restore: ({ user }) => canManage(user), update: ({ user }) => canManage(user), view: ({ user }) => canManage(user), viewAny: ({ user }) => canManage(user) },
})
