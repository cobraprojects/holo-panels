import { hashPassword } from '@holo-js/auth'
import { defineSeeder } from '@holo-js/db'
import {
  exampleCategories,
  exampleComments,
  exampleMedia,
  exampleMemberships,
  examplePosts,
  examplePostTags,
  exampleTags,
  exampleTenants,
} from '../../fixtures/example-domain'
import Category from '../../models/Category'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Membership from '../../models/Membership'
import Post from '../../models/Post'
import PostTag from '../../models/PostTag'
import Tag from '../../models/Tag'
import Tenant from '../../models/Tenant'
import User from '../../models/User'

const actors = [
  { email: 'super@example.test', id: 'user-super-admin', name: 'Super Admin', roleKey: 'super-admin', tenantId: 'tenant-acme' },
  { email: 'admin@acme.example.test', id: 'user-acme-admin', name: 'Acme Admin', roleKey: 'tenant-admin', tenantId: 'tenant-acme' },
  { email: 'editor@acme.example.test', id: 'user-acme-editor', name: 'Acme Editor', roleKey: 'editor', tenantId: 'tenant-acme' },
  { email: 'editor@globex.example.test', id: 'user-globex-editor', name: 'Globex Editor', roleKey: 'editor', tenantId: 'tenant-globex' },
] as const

export default defineSeeder({
  name: 'AuthExampleSeeder',
  async run() {
    const password = await hashPassword('panel-secret')
    const timestamp = new Date('2026-07-29T00:00:00.000Z')
    await Tenant.unguarded(async () => {
      for (const tenant of exampleTenants) await Tenant.updateOrCreate({ id: tenant.id }, { name: tenant.name, slug: tenant.routeKey })
    })
    await User.unguarded(async () => {
      for (const actor of actors) await User.updateOrCreate({ id: actor.id }, { ...actor, createdAt: timestamp, password, updatedAt: timestamp })
    })
    await Category.unguarded(async () => {
      for (const record of exampleCategories) await Category.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await Tag.unguarded(async () => {
      for (const record of exampleTags) await Tag.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await Membership.unguarded(async () => {
      for (const record of exampleMemberships) await Membership.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await Media.unguarded(async () => {
      for (const record of exampleMedia) await Media.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await Post.unguarded(async () => {
      for (const record of examplePosts) await Post.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await Comment.unguarded(async () => {
      for (const record of exampleComments) await Comment.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
    await PostTag.unguarded(async () => {
      for (const record of examplePostTags) await PostTag.updateOrCreate({ id: record.id }, { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) })
    })
  },
})
