import { describe, expect, it } from 'vitest'
import { canAccessTenant, canBootstrapAdmin, canManageResource } from '../server/admin/access'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'
import AdminPanel from '../server/admin/panels/AdminPanel'
import CategoryResource, { CategoryPages } from '../server/admin/resources/categories/CategoryResource'
import CommentResource from '../server/admin/resources/comments/CommentResource'
import MediaResource from '../server/admin/resources/media/MediaResource'
import MembershipResource from '../server/admin/resources/memberships/MembershipResource'
import PostTagResource from '../server/admin/resources/post-tags/PostTagResource'
import PostResource from '../server/admin/resources/posts/PostResource'
import TagResource from '../server/admin/resources/tags/TagResource'
import UserResource from '../server/admin/resources/users/UserResource'
import { ContentDashboard, ContentOverviewWidget } from '../server/admin/widgets/ContentOverview'
import { getBlogIndex, getBlogPost } from '../server/blog'
import {
  exampleActors,
  exampleCategories,
  exampleComments,
  exampleMedia,
  exampleMemberships,
  examplePosts,
  exampleTags,
  recordsForTenant,
} from '../server/fixtures/example-domain'

describe('P17 SvelteKit example domain contract', () => {
  it('uses the frozen identities, tenant boundaries, and minimum seed inventory', () => {
    expect(Object.keys(exampleActors)).toEqual([
      'user-super-admin',
      'user-acme-admin',
      'user-acme-editor',
      'user-globex-editor',
      'user-denied',
    ])
    for (const tenantId of ['tenant-acme', 'tenant-globex']) {
      expect(recordsForTenant(examplePosts, tenantId)).toHaveLength(3)
      expect(recordsForTenant(exampleCategories, tenantId)).toHaveLength(2)
      expect(recordsForTenant(exampleTags, tenantId)).toHaveLength(3)
      expect(recordsForTenant(exampleComments, tenantId).map(comment => comment.status).sort()).toEqual(['approved', 'pending'])
      expect(recordsForTenant(exampleMedia, tenantId)).toHaveLength(1)
    }
    expect(exampleMemberships.some(membership => membership.tenantId === 'tenant-globex' && membership.userId === 'user-acme-admin')).toBe(false)
    expect(AdminPanel.compile().manifest.databaseNotifications).toEqual({ placement: 'topbar', polling: 30_000, realtime: true })
    expect(PostImporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-import', kind: 'import', resourceId: 'posts' })
    expect(PostExporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-export', kind: 'export', resourceId: 'posts' })
  })

  it('enforces role and membership intent without granting denied or cross-tenant access', () => {
    const superAdmin = exampleActors['user-super-admin']
    const acmeAdmin = exampleActors['user-acme-admin']
    const acmeEditor = exampleActors['user-acme-editor']
    const denied = exampleActors['user-denied']
    expect(superAdmin && canAccessTenant(superAdmin, 'tenant-globex')).toBe(true)
    expect(acmeAdmin && canAccessTenant(acmeAdmin, 'tenant-globex')).toBe(false)
    expect(acmeEditor && canManageResource(acmeEditor, 'comments')).toBe(true)
    expect(acmeEditor && canManageResource(acmeEditor, 'memberships')).toBe(false)
    expect(denied && canBootstrapAdmin(denied)).toBe(false)
  })

  it('compiles every current-slice resource and tenant-scoped page under stable IDs', async () => {
    const definitions = [
      PostResource.compile(),
      CategoryResource.compile(),
      TagResource.compile(),
      PostTagResource.compile(),
      CommentResource.compile(),
      MediaResource.compile(),
      MembershipResource.compile(),
      UserResource.compile(),
    ]
    expect(definitions.map(definition => definition.id)).toEqual([
      'posts',
      'categories',
      'tags',
      'post-tags',
      'comments',
      'media',
      'memberships',
      'users',
    ])
    expect(definitions.slice(0, 7).every(definition => typeof definition.tenantScope === 'function')).toBe(true)
    expect(definitions[7]?.shared).toBe(true)
    expect(CategoryPages.list.compile().manifest.path).toBe('/admin/categories')
    expect(await CategoryPages.list.compile().server.authorize({
      actor: exampleActors['user-acme-editor'],
      locale: 'en',
      panelId: 'admin',
      parameters: {},
      services: {},
      signal: new AbortController().signal,
      tenant: 'tenant-acme',
    })).toBe(true)
  })

  it('serves tenant-safe public content and registers the inferred dashboard widget', () => {
    expect(getBlogIndex({ tenant: 'acme' }).posts.map(post => post.slug)).toEqual(['building-with-holo-panels', 'acme-release'])
    expect(getBlogIndex({ category: 'guides', tenant: 'acme' }).posts.map(post => post.slug)).toEqual(['building-with-holo-panels'])
    expect(getBlogIndex({ tag: 'holo', tenant: 'globex' }).posts.map(post => post.slug)).toEqual(['globex-platform'])
    expect(getBlogPost('building-with-holo-panels', { tenant: 'globex' })).toBeNull()
    expect(getBlogPost('building-with-holo-panels', { tenant: 'acme' })?.comments.map(comment => comment.id)).toEqual(['comment-acme-approved'])
    expect(getBlogPost('building-with-holo-panels', { tenant: 'acme' })?.post.media).toEqual({
      alt: 'Layered translucent panels',
      private: true,
      url: null,
    })
    expect(ContentDashboard.compile().manifest.widgets).toEqual(['content-overview'])
    expect(ContentOverviewWidget.compile().manifest.type).toBe('panels.widgets.stats')
  })
})
