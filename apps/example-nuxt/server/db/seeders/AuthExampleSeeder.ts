import { hashPassword } from '@holo-js/auth'
import { defineSeeder } from '@holo-js/db'
import { exampleActors, exampleDomainRecords, exampleTenants } from '../../admin/domain/fixtures'
import Category from '../../models/Category'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Membership from '../../models/Membership'
import Post from '../../models/Post'
import PostTag from '../../models/PostTag'
import Tag from '../../models/Tag'
import Tenant from '../../models/Tenant'
import User from '../../models/User'

export default defineSeeder({
  name: 'AuthExampleSeeder',
  async run() {
    const password = await hashPassword('panel-secret')
    await Tenant.unguarded(async () => {
      for (const tenant of exampleTenants) await Tenant.updateOrCreate({ id: tenant.id }, { name: tenant.name, slug: tenant.key })
    })
    await User.unguarded(async () => {
      for (const actor of exampleActors) {
        await User.updateOrCreate({ id: actor.id }, {
          email: actor.email,
          name: actor.id.split('-').slice(1).join(' '),
          password,
          role: actor.role,
          tenantId: actor.tenantId,
        })
      }
    })
    await Category.unguarded(async () => {
      for (const record of exampleDomainRecords.categories) await Category.updateOrCreate({ id: record.id }, { name: record.name, slug: record.slug, tenantId: record.tenantId })
    })
    await Tag.unguarded(async () => {
      for (const record of exampleDomainRecords.tags) await Tag.updateOrCreate({ id: record.id }, { name: record.name, slug: record.slug, tenantId: record.tenantId })
    })
    await Membership.unguarded(async () => {
      for (const record of exampleDomainRecords.memberships) await Membership.updateOrCreate({ id: record.id }, { roleKey: record.roleKey, tenantId: record.tenantId, userId: record.userId })
    })
    await Media.unguarded(async () => {
      for (const record of exampleDomainRecords.media) await Media.updateOrCreate({ id: record.id }, { alt: record.alt, disk: record.disk, mime: record.mime, path: record.path, size: record.size, tenantId: record.tenantId })
    })
    await Post.unguarded(async () => {
      for (const record of exampleDomainRecords.posts) await Post.updateOrCreate({ id: record.id }, {
        authorId: record.authorId,
        body: record.body,
        category: record.category,
        categoryId: record.categoryId,
        city: record.city,
        excerpt: record.excerpt,
        featuredMediaId: record.featuredMediaId,
        slug: record.slug,
        status: record.status,
        tenantId: record.tenantId,
        title: record.title,
      })
    })
    await Comment.unguarded(async () => {
      for (const record of exampleDomainRecords.comments) await Comment.updateOrCreate({ id: record.id }, { authorName: record.authorName, body: record.body, postId: record.postId, status: record.status, tenantId: record.tenantId })
    })
    await PostTag.unguarded(async () => {
      for (const record of exampleDomainRecords.postTags) await PostTag.updateOrCreate({ id: record.id }, { position: record.position, postId: record.postId, tagId: record.tagId, tenantId: record.tenantId })
    })
  },
})
