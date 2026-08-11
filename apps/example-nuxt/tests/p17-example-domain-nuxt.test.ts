import { describe, expect, it, vi } from 'vitest'
import { resolveWidget } from '@holo-js/panels'
import AdminPanel from '../server/admin/AdminPanel'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'
import { exampleActors, exampleDomainRecords, exampleTenants } from '../server/admin/domain/fixtures'
import { exampleAdminResources } from '../server/admin/domain/inventory'
import CategoryResource from '../server/admin/resources/categories/CategoryResource'
import CommentResource from '../server/admin/resources/comments/CommentResource'
import MediaResource from '../server/admin/resources/media/MediaResource'
import MembershipResource from '../server/admin/resources/memberships/MembershipResource'
import PostTagResource from '../server/admin/resources/post-tags/PostTagResource'
import PostResource from '../server/admin/resources/posts/PostResource'
import TagResource from '../server/admin/resources/tags/TagResource'
import UserResource from '../server/admin/resources/users/UserResource'
import ContentOverview from '../server/admin/widgets/ContentOverview'
import { getExampleBlogIndex, getExampleBlogPost } from '../server/blog'
import Category from '../server/models/Category'
import Comment from '../server/models/Comment'
import Media from '../server/models/Media'
import Membership from '../server/models/Membership'
import Post from '../server/models/Post'
import PostTag from '../server/models/PostTag'
import Tag from '../server/models/Tag'
import User from '../server/models/User'

const signal = new AbortController().signal
const widgetQueries = vi.hoisted(() => ({
  comments: vi.fn(() => ({ count: async () => 2 })),
  media: vi.fn(() => ({ count: async () => 1 })),
  posts: vi.fn(() => ({ count: async () => 3 })),
}))

vi.mock('../server/models/Post', async (importOriginal) => {
  const module = await importOriginal<{ default: typeof Post }>()
  const model = Object.create(module.default) as object
  Object.defineProperty(model, 'where', { value: widgetQueries.posts })
  return { ...module, default: model }
})

vi.mock('../server/models/Comment', async (importOriginal) => {
  const module = await importOriginal<{ default: typeof Comment }>()
  const model = Object.create(module.default) as object
  Object.defineProperty(model, 'where', { value: widgetQueries.comments })
  return { ...module, default: model }
})

vi.mock('../server/models/Media', async (importOriginal) => {
  const module = await importOriginal<{ default: typeof Media }>()
  const model = Object.create(module.default) as object
  Object.defineProperty(model, 'where', { value: widgetQueries.media })
  return { ...module, default: model }
})

describe('Nuxt P17 example domain', () => {
  it('matches the frozen resource, tenant, actor, and minimum-record inventory', () => {
    expect(exampleTenants.map(tenant => tenant.id)).toEqual(['tenant-acme', 'tenant-globex'])
    expect(exampleActors.map(actor => actor.id)).toEqual([
      'user-super-admin',
      'user-acme-admin',
      'user-acme-editor',
      'user-globex-editor',
      'user-denied',
    ])
    expect(exampleAdminResources.map(resource => resource.compile().slug)).toEqual([
      'posts',
      'categories',
      'tags',
      'comments',
      'media',
      'users',
      'memberships',
      'post-tags',
    ])
    for (const tenantId of ['tenant-acme', 'tenant-globex']) {
      expect(exampleDomainRecords.posts.filter(record => record.tenantId === tenantId)).toHaveLength(3)
      expect(exampleDomainRecords.categories.filter(record => record.tenantId === tenantId)).toHaveLength(2)
      expect(exampleDomainRecords.tags.filter(record => record.tenantId === tenantId)).toHaveLength(3)
      expect(exampleDomainRecords.comments.filter(record => record.tenantId === tenantId).map(record => record.status).sort()).toEqual(['approved', 'pending'])
      expect(exampleDomainRecords.media.filter(record => record.tenantId === tenantId)).toHaveLength(1)
    }
    expect(AdminPanel.compile().manifest.databaseNotifications).toEqual({ placement: 'topbar', polling: 30_000, realtime: true })
    expect(PostImporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-import', kind: 'import', resourceId: 'posts' })
    expect(PostExporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-export', kind: 'export', resourceId: 'posts' })
  })

  it('keeps fixture relationships inside one tenant and media private by default', () => {
    for (const post of exampleDomainRecords.posts) {
      expect(exampleDomainRecords.categories).toContainEqual(expect.objectContaining({ id: post.categoryId, tenantId: post.tenantId }))
      expect(exampleDomainRecords.users).toContainEqual(expect.objectContaining({ id: post.authorId }))
      if (post.featuredMediaId) {
        expect(exampleDomainRecords.media).toContainEqual(expect.objectContaining({ id: post.featuredMediaId, tenantId: post.tenantId }))
      }
    }
    for (const comment of exampleDomainRecords.comments) {
      expect(exampleDomainRecords.posts).toContainEqual(expect.objectContaining({ id: comment.postId, tenantId: comment.tenantId }))
    }
    for (const relation of exampleDomainRecords.postTags) {
      expect(exampleDomainRecords.posts).toContainEqual(expect.objectContaining({ id: relation.postId, tenantId: relation.tenantId }))
      expect(exampleDomainRecords.tags).toContainEqual(expect.objectContaining({ id: relation.tagId, tenantId: relation.tenantId }))
    }
    expect(exampleDomainRecords.media.every(record => record.disk === 'private')).toBe(true)
    expect(exampleDomainRecords.media.every(record => record.path.startsWith(`${record.tenantId}/`))).toBe(true)
    expect(JSON.stringify(MediaResource.compile().client)).not.toContain('path')
  })

  it('serves the equivalent tenant-safe public blog inventory', () => {
    const acme = getExampleBlogIndex({ tenant: 'acme' })
    expect(acme.posts.map(post => post.slug)).toEqual(['building-with-holo-panels', 'acme-release'])
    expect(getExampleBlogIndex({ category: 'guides', tenant: 'acme' }).posts.map(post => post.slug)).toEqual(['building-with-holo-panels'])
    expect(getExampleBlogIndex({ tag: 'holo', tenant: 'globex' }).posts.map(post => post.slug)).toEqual(['globex-platform'])
    expect(getExampleBlogPost('building-with-holo-panels', { tenant: 'globex' })).toBeNull()
    expect(getExampleBlogPost('building-with-holo-panels', { tenant: 'acme' })?.comments.map(comment => comment.id)).toEqual(['comment-acme-approved'])
  })

  it('guards identity, tenant, and server-owned media attributes from mass assignment', () => {
    expect(Post.definition.guarded).toEqual(['id', 'tenantId'])
    expect(Category.definition.guarded).toEqual(['id', 'tenantId'])
    expect(Tag.definition.guarded).toEqual(['id', 'tenantId'])
    expect(Comment.definition.guarded).toEqual(['id', 'tenantId'])
    expect(Membership.definition.guarded).toEqual(['id', 'tenantId'])
    expect(PostTag.definition.guarded).toEqual(['id', 'tenantId'])
    expect(User.definition.guarded).toEqual(['id'])
    expect(Media.definition.guarded).toEqual(['id', 'tenantId', 'disk', 'path', 'mime', 'size'])
    expect(Media.definition.fillable).toEqual(['alt'])
  })

  it('applies tenant scopes and bindings to every tenant-owned resource', () => {
    const context = { actor: {}, signal, tenant: 'tenant-acme' }
    for (const builder of [
      PostResource,
      CategoryResource,
      TagResource,
      CommentResource,
      MediaResource,
      MembershipResource,
      PostTagResource,
    ]) {
      const resource = builder.compile()
      expect(resource.createBindings?.(context)).toEqual(expect.objectContaining({ tenantId: 'tenant-acme' }))
      expect(resource.tenantScope).toBeTypeOf('function')
    }
    expect(UserResource.compile().tenantScope).toBeUndefined()
  })

  it('keeps panel actor projection allow-listed and denies the frozen denied identity', async () => {
    const panel = AdminPanel.compile()
    const allowed = exampleActors.find(actor => actor.id === 'user-acme-editor')
    const denied = exampleActors.find(actor => actor.id === 'user-denied')
    if (!allowed || !denied) throw new Error('Missing frozen example actors')

    expect(await panel.server.access({ actor: allowed, signal })).toBe(true)
    expect(await panel.server.access({ actor: denied, signal })).toBe(false)
    expect(await panel.server.presentActor(allowed)).toMatchObject({ email: allowed.email, id: allowed.id, role: allowed.role })
    expect(JSON.stringify(await panel.server.presentActor(allowed))).not.toContain('tenantIds')
  })

  it('resolves widget metrics through tenant-bound, allow-listed resource IDs', async () => {
    const queries = [widgetQueries.posts, widgetQueries.comments, widgetQueries.media]
    const actor = { id: 'user-acme-editor', role: 'editor' }
    const result = await resolveWidget(ContentOverview.compile(), {
      actor,
      locale: 'en',
      panelId: 'admin',
      services: {},
      signal,
      tenant: 'tenant-acme',
    })

    expect(result.status).toBe('ready')
    expect(result.data?.stats.map(stat => [stat.id, stat.value])).toEqual([['posts', 3], ['comments', 2], ['media', 1]])
    for (const query of queries) expect(query).toHaveBeenCalledWith('tenantId', 'tenant-acme')
    const denied = await resolveWidget(ContentOverview.compile(), {
      actor: { id: 'user-denied', role: 'denied' },
      locale: 'en',
      panelId: 'admin',
      services: {},
      signal,
      tenant: 'tenant-acme',
    })
    expect(denied.status).toBe('unauthorized')
    for (const query of queries) expect(query).toHaveBeenCalledTimes(1)
  })
})
