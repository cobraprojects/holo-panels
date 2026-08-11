import { generatedResourcePageManifests, resolveWidget, type RuntimeTypeValue } from '@holo-js/panels'
import { describe, expect, it } from 'vitest'
import { GET as getBlogMedia } from '../app/blog/media/[id]/route'
import AdminPanel from '../server/admin/AdminPanel'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'
import CategoryResource from '../server/admin/resources/categories/CategoryResource'
import CommentResource from '../server/admin/resources/comments/CommentResource'
import MediaResource from '../server/admin/resources/media/MediaResource'
import MembershipResource from '../server/admin/resources/memberships/MembershipResource'
import PostTagResource from '../server/admin/resources/post-tags/PostTagResource'
import PostResource from '../server/admin/resources/posts/PostResource'
import TagResource from '../server/admin/resources/tags/TagResource'
import UserResource from '../server/admin/resources/users/UserResource'
import ContentOverview from '../server/admin/widgets/ContentOverview'
import { createExampleBlogDomain, exampleActors } from '../server/domain/blog'
import type User from '../server/models/User'

const signal = new AbortController().signal
const panelActor = {
  createdAt: new Date(),
  email: 'editor@acme.example.test',
  id: 'user-acme-editor',
  name: 'Acme Editor',
  password: 'hidden',
  role: 'editor',
  tenantId: 'tenant-acme',
  updatedAt: new Date(),
} satisfies RuntimeTypeValue<typeof User>

describe('Next example blog domain', () => {
  it('registers the complete administration slice with notifications and transfers', () => {
    expect([
      PostResource,
      CategoryResource,
      TagResource,
      CommentResource,
      MediaResource,
      UserResource,
      MembershipResource,
      PostTagResource,
    ].map(resource => resource.compile().id)).toEqual([
      'posts',
      'categories',
      'tags',
      'comments',
      'media',
      'users',
      'memberships',
      'post-tags',
    ])
    expect(AdminPanel.compile().manifest.databaseNotifications).toEqual({ placement: 'topbar', polling: 30_000, realtime: true })
    expect(PostImporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-import', kind: 'import', resourceId: 'posts' })
    expect(PostExporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-export', kind: 'export', resourceId: 'posts' })
  })

  it('returns only published tenant posts with safe category and tag filtering', () => {
    const domain = createExampleBlogDomain()

    expect(domain.listPublishedPosts('tenant-acme').map(post => post.id)).toEqual([
      'post-acme-panels',
      'post-acme-release',
    ])
    expect(domain.listPublishedPosts('tenant-acme', { categorySlug: 'guides' }).map(post => post.id)).toEqual(['post-acme-panels'])
    expect(domain.listPublishedPosts('tenant-globex').map(post => post.id)).toEqual(['post-globex-platform', 'post-globex-roadmap'])

    expect(domain.listPublishedPosts('tenant-acme', { tagSlug: 'holo' }).map(post => post.title)).toEqual([
      'Building with Holo Panels',
      'Acme release',
    ])
  })

  it('enforces tenant-safe tag and comment behavior', () => {
    const domain = createExampleBlogDomain()
    const attached = domain.attachTag(exampleActors.acmeEditor, 'post-acme-release', 'tag-acme-typescript')
    expect(attached).toMatchObject({ id: 'post-acme-release', tagIds: ['tag-acme-holo', 'tag-acme-typescript'] })
    const created = domain.createComment(exampleActors.acmeEditor, 'post-acme-release', 'Katherine', 'Ready for moderation.')
    expect(created).toMatchObject({ status: 'pending', tenantId: 'tenant-acme' })
    expect(() => domain.attachTag(exampleActors.acmeEditor, 'post-acme-release', 'tag-globex-holo')).toThrow('Tag access was denied')
    expect(() => domain.attachTag({
      id: 'user-denied',
      role: 'denied',
      tenantId: 'tenant-acme',
    }, 'post-acme-release', 'tag-acme-holo')).toThrow('access was denied')
  })

  it('scopes resource definitions and widget access to the active tenant', async () => {
    for (const resource of [CategoryResource, CommentResource, MediaResource, TagResource]) {
      const definition = resource.compile()
      expect(definition.tenantScope).toBeTypeOf('function')
      expect(await definition.createBindings?.({ actor: panelActor, signal, tenant: 'tenant-acme' })).toEqual({ tenantId: 'tenant-acme' })
    }

    const hidden = await resolveWidget(ContentOverview.compile(), {
      actor: panelActor,
      locale: 'en',
      panelId: 'admin',
      services: undefined,
      signal,
      tenant: 'tenant-globex',
    })
    expect(hidden.status).toBe('unauthorized')
  })

  it('serves only allow-listed published media without exposing private storage paths', async () => {
    const response = await getBlogMedia(new Request('https://panels.test/blog/media/media-acme-cover'), {
      params: Promise.resolve({ id: 'media-acme-cover' }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).not.toContain('tenant-acme/posts')

    const denied = await getBlogMedia(new Request('https://panels.test/blog/media/media-globex-cover'), {
      params: Promise.resolve({ id: 'media-globex-cover' }),
    })
    expect(denied.status).toBe(404)
  })

  it('derives the complete Post CRUD route set and preserves tenant category behavior', () => {
    const domain = createExampleBlogDomain()
    const actor = exampleActors.acmeAdmin
    const pages = generatedResourcePageManifests({ panelPath: '/admin', resource: PostResource })
    expect(pages.map(page => page.path)).toEqual([
      '/admin/posts',
      '/admin/posts/create',
      '/admin/posts/:record',
      '/admin/posts/:record/edit',
    ])
    const resource = pages[0]?.body?.properties.resource
    const table = resource && typeof resource === 'object' && !Array.isArray(resource) ? resource.table : null
    const actions = table && typeof table === 'object' && !Array.isArray(table) && Array.isArray(table.actions) ? table.actions : []
    expect(actions).toContainEqual(expect.objectContaining({
      id: 'publish-selected',
      label: 'Publish selected',
      scope: 'bulk',
    }))
    const created = domain.saveCategory(actor, null, 'Culture', 'culture')
    expect(created).toMatchObject({ id: 'category-acme-culture', tenantId: 'tenant-acme' })
    domain.deleteCategory(actor, created.id)
    expect(domain.adminSnapshot(actor).categories).not.toContainEqual(expect.objectContaining({ id: created.id }))
  })
})
