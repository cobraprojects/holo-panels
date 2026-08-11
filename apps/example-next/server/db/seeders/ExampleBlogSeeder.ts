import { hashPassword } from '@holo-js/auth'
import { defineSeeder } from '@holo-js/db'
import { exampleSeedData } from '../../domain/blog'
import Category from '../../models/Category'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Membership from '../../models/Membership'
import Post from '../../models/Post'
import PostTag from '../../models/PostTag'
import Tag from '../../models/Tag'
import Tenant from '../../models/Tenant'
import User from '../../models/User'

const tenantCity = (tenantId: string): string => tenantId === 'tenant-acme' ? 'Cairo' : 'London'

export default defineSeeder({
  name: 'ExampleBlogSeeder',
  async run() {
    const password = await hashPassword('panel-secret')
    await Tenant.unguarded(async () => {
      await Tenant.updateOrCreate({ id: 'tenant-acme' }, { name: 'Acme', slug: 'acme' })
      await Tenant.updateOrCreate({ id: 'tenant-globex' }, { name: 'Globex', slug: 'globex' })
    })
    await User.unguarded(async () => {
      for (const user of exampleSeedData.users) {
        const membership = exampleSeedData.memberships.find(value => value.userId === user.id)
        await User.updateOrCreate({ id: user.id }, {
          email: user.email,
          name: user.name,
          password,
          role: membership?.roleKey ?? 'editor',
          tenantId: membership?.tenantId ?? 'tenant-acme',
        })
      }
    })
    await Category.unguarded(async () => {
      for (const category of exampleSeedData.categories) await Category.updateOrCreate({ id: category.id }, { name: category.name, slug: category.slug, tenantId: category.tenantId })
    })
    await Tag.unguarded(async () => {
      for (const tag of exampleSeedData.tags) await Tag.updateOrCreate({ id: tag.id }, { name: tag.name, slug: tag.slug, tenantId: tag.tenantId })
    })
    await Membership.unguarded(async () => {
      for (const membership of exampleSeedData.memberships) await Membership.updateOrCreate({ id: membership.id }, { roleKey: membership.roleKey, tenantId: membership.tenantId, userId: membership.userId })
    })
    await Media.unguarded(async () => {
      for (const media of exampleSeedData.media) await Media.updateOrCreate({ id: media.id }, {
        alt: media.alt,
        disk: media.disk,
        mime: media.mime,
        path: media.path,
        size: media.size,
        tenantId: media.tenantId,
      })
    })
    await Post.unguarded(async () => {
      for (const post of exampleSeedData.posts) await Post.updateOrCreate({ id: post.id }, {
        authorId: post.authorId,
        body: post.body,
        category: post.categoryId.includes('guides') ? 'Guides' : 'News',
        categoryId: post.categoryId,
        city: tenantCity(post.tenantId),
        excerpt: post.excerpt,
        featuredMediaId: post.featuredMediaId,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
        slug: post.slug,
        status: post.status,
        tenantId: post.tenantId,
        title: post.title,
      })
    })
    await Comment.unguarded(async () => {
      for (const comment of exampleSeedData.comments) await Comment.updateOrCreate({ id: comment.id }, {
        authorName: comment.authorName,
        body: comment.body,
        postId: comment.postId,
        status: comment.status,
        tenantId: comment.tenantId,
      })
    })
    await PostTag.unguarded(async () => {
      for (const post of exampleSeedData.posts) {
        for (const [position, tagId] of post.tagIds.entries()) {
          const id = `post-tag-${post.id}-${tagId}`
          await PostTag.updateOrCreate({ id }, { position: position + 1, postId: post.id, tagId, tenantId: post.tenantId })
        }
      }
    })
  },
})
