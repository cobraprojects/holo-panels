import { resolveWidget } from '@holo-js/panels'
import { resolveNextPanelPage, type NextPanelOperationInput } from '@holo-js/panels-next'
import { describe, expect, it } from 'vitest'
import { GET as getBlogMedia } from '../app/blog/media/[id]/route'
import { createAdminPanelsRuntime } from '../server/admin/runtime'
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

const signal = new AbortController().signal

const operation = (
  payload: NextPanelOperationInput['payload'],
  actor: object = exampleActors.acmeEditor,
  operationName: NextPanelOperationInput['operation'] = 'action',
): NextPanelOperationInput => ({
  operation: operationName,
  panelId: 'admin',
  payload,
  request: new Request('https://panels.test/admin/_panels/action'),
  scope: {
    actor,
    locale: 'en',
    panelId: 'admin',
    parameters: {},
    provider: 'session',
    request: new Request('https://panels.test/admin/_panels/action'),
    services: {},
    signal,
    tenant: 'tenant-acme',
  },
})

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

  it('executes tenant-safe tag and comment actions through the fixed panel operation runtime', async () => {
    const domain = createExampleBlogDomain()
    const runtime = createAdminPanelsRuntime({ domain })
    const execute = runtime.execute
    if (!execute) throw new Error('The example runtime has no operation executor.')

    const attached = await execute(operation({
      actionId: 'example.tags.attach',
      postId: 'post-acme-release',
      tagId: 'tag-acme-typescript',
    }))
    expect(attached.data).toMatchObject({ id: 'post-acme-release', tagIds: ['tag-acme-holo', 'tag-acme-typescript'] })

    const created = await execute(operation({
      actionId: 'example.comments.create',
      authorName: 'Katherine',
      body: 'Ready for moderation.',
      postId: 'post-acme-release',
    }))
    expect(created.data).toMatchObject({ status: 'pending', tenantId: 'tenant-acme' })

    await expect(execute(operation({
      actionId: 'example.tags.attach',
      postId: 'post-acme-release',
      tagId: 'tag-globex-holo',
    }))).rejects.toThrow('Tag access was denied')
    await expect(execute(operation({ actionId: 'example.tags.attach', postId: 'post-acme-release', tagId: 'tag-acme-holo' }, {
      id: 'user-denied',
      role: 'denied',
      tenantId: 'tenant-acme',
    }))).rejects.toThrow('access was denied')
  })

  it('scopes resource definitions and widget output to the active tenant', async () => {
    for (const resource of [CategoryResource, CommentResource, MediaResource, TagResource]) {
      const definition = resource.compile()
      expect(definition.tenantScope).toBeTypeOf('function')
      expect(await definition.createBindings?.({ actor: {}, signal, tenant: 'tenant-acme' })).toEqual({ tenantId: 'tenant-acme' })
    }

    const domain = createExampleBlogDomain()
    const resolved = await resolveWidget(ContentOverview.compile(), {
      actor: exampleActors.acmeEditor,
      locale: 'en',
      panelId: 'admin',
      services: { domain },
      signal,
      tenant: 'tenant-acme',
    })
    expect(resolved).toMatchObject({
      data: { stats: [{ id: 'posts', value: '3' }, { id: 'pending-comments', value: '1' }] },
      status: 'ready',
    })
    const hidden = await resolveWidget(ContentOverview.compile(), {
      actor: exampleActors.acmeEditor,
      locale: 'en',
      panelId: 'admin',
      services: { domain },
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

  it('resolves overview and administration pages and performs category CRUD through the manual runtime', async () => {
    const domain = createExampleBlogDomain()
    const actor = exampleActors.acmeAdmin
    const runtime = createAdminPanelsRuntime({
      auth: { guard: () => ({ provider: async () => 'session', user: async () => actor }) },
      domain,
      resolveServices: async () => ({ domain }),
      resolveTenant: async () => 'tenant-acme',
    })
    const execute = runtime.execute
    if (!execute) throw new Error('The example runtime has no operation executor.')

    const overview = await resolveNextPanelPage('admin', [], new Request('https://panels.test/admin'), runtime)
    expect(overview.page.manifest.widgets.header).toEqual(['content-overview'])
    expect(overview.page.data).toMatchObject({ status: 'ready' })

    const created = await execute(operation({
      intent: 'create',
      name: 'Culture',
      resourceId: 'categories',
      slug: 'culture',
    }, actor, 'form-submit'))
    expect(created.data).toMatchObject({ id: 'category-acme-culture', tenantId: 'tenant-acme' })

    const categories = await resolveNextPanelPage('admin', ['categories'], new Request('https://panels.test/admin/categories'), runtime)
    expect(categories.page.data.records).toContainEqual(expect.objectContaining({ id: 'category-acme-culture' }))

    await execute(operation({
      intent: 'edit',
      name: 'Culture desk',
      recordId: 'category-acme-culture',
      resourceId: 'categories',
      slug: 'culture-desk',
    }, actor, 'form-submit'))
    await execute(operation({
      actionId: 'delete-record',
      intent: 'delete',
      recordId: 'category-acme-culture',
      resourceId: 'categories',
    }, actor))

    const media = await resolveNextPanelPage('admin', ['media'], new Request('https://panels.test/admin/media'), runtime)
    expect(JSON.stringify(media.page.data)).not.toContain('tenant-acme/posts')
    expect(JSON.stringify(media.page.data)).not.toContain('private')

    const users = await resolveNextPanelPage('admin', ['users'], new Request('https://panels.test/admin/users'), runtime)
    expect(users.page.data.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'user-acme-admin', roleKey: 'tenant-admin' }),
      expect.objectContaining({ id: 'user-acme-editor', roleKey: 'editor' }),
    ]))
    expect(users.page.data.records).not.toContainEqual(expect.objectContaining({ id: 'user-globex-editor' }))
  })
})
