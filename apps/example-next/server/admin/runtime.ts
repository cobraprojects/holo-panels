import { createNextHoloHelpers } from '@holo-js/adapter-next/runtime'
import {
  executePanelDatabaseNotificationOperation,
  ResourceExecutor,
  type PanelDatabaseNotificationOperationResult,
} from '@holo-js/panels'
import type { NextPanelOperationInput, NextPanelOperationResult, NextPanelsRuntime } from '@holo-js/panels-next'
import { createExampleBlogDomain, ExampleDomainAccessError, type ExampleActor, type ExampleBlogDomain, type ExampleCommentStatus } from '../domain/blog'
import AdminPanel from './AdminPanel'
import OverviewDashboard from './pages/OverviewDashboard'
import CreateCategory from './pages/categories/CreateCategory'
import EditCategory from './pages/categories/EditCategory'
import ListCategories from './pages/categories/ListCategories'
import ViewCategory from './pages/categories/ViewCategory'
import CreateComment from './pages/comments/CreateComment'
import EditComment from './pages/comments/EditComment'
import ListComments from './pages/comments/ListComments'
import ViewComment from './pages/comments/ViewComment'
import EditMedia from './pages/media/EditMedia'
import ListMedia from './pages/media/ListMedia'
import ViewMedia from './pages/media/ViewMedia'
import CategoryResource from './resources/categories/CategoryResource'
import CommentResource from './resources/comments/CommentResource'
import CreatePost from './pages/posts/CreatePost'
import EditPost from './pages/posts/EditPost'
import ListPosts from './pages/posts/ListPosts'
import ViewPost from './pages/posts/ViewPost'
import CreatePostTag from './pages/post-tags/CreatePostTag'
import EditPostTag from './pages/post-tags/EditPostTag'
import ListPostTags from './pages/post-tags/ListPostTags'
import ViewPostTag from './pages/post-tags/ViewPostTag'
import CreateTag from './pages/tags/CreateTag'
import EditTag from './pages/tags/EditTag'
import ListTags from './pages/tags/ListTags'
import ViewTag from './pages/tags/ViewTag'
import ListUsers from './pages/users/ListUsers'
import ViewUser from './pages/users/ViewUser'
import { mutatePost, postExecutionContext, requirePostActor } from './pages/posts/data'
import MediaResource from './resources/media/MediaResource'
import MembershipResource from './resources/memberships/MembershipResource'
import PostResource from './resources/posts/PostResource'
import PostTagResource from './resources/post-tags/PostTagResource'
import TagResource from './resources/tags/TagResource'
import UserResource from './resources/users/UserResource'
import PostExporter from './exports/PostExporter'
import PostImporter from './imports/PostImporter'
import ContentOverview from './widgets/ContentOverview'

const holo = createNextHoloHelpers({ projectRoot: process.cwd() })
const postTagExecutor = new ResourceExecutor(PostTagResource.compile(), {
  authorization: {
    async authorizeClass(actor) {
      if (!actor || !['editor', 'super-admin', 'tenant-admin'].includes(String(Reflect.get(actor, 'role')))) throw new ExampleDomainAccessError('Post tag access was denied.')
    },
    async authorizeRecord(actor) {
      if (!actor || !['editor', 'super-admin', 'tenant-admin'].includes(String(Reflect.get(actor, 'role')))) throw new ExampleDomainAccessError('Post tag access was denied.')
    },
  },
})

interface PostMutation {
  readonly context: ReturnType<typeof postExecutionContext>
  readonly intent: string
  readonly recordId: number | string | null
  readonly values: Readonly<Record<string, string>>
}

function notificationData(result: PanelDatabaseNotificationOperationResult): NonNullable<NextPanelOperationResult['data']> {
  if ('affected' in result) return { affected: result.affected }
  return {
    items: result.items.map(item => ({
      ...item,
      presentation: { ...item.presentation, actions: [...item.presentation.actions] },
    })),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    unread: result.unread,
  }
}

export interface AdminPanelsRuntimeOverrides {
  readonly auth?: NextPanelsRuntime['auth']
  readonly domain?: ExampleBlogDomain
  readonly mutatePost?: (mutation: PostMutation) => Promise<void>
  readonly resolveServices?: NextPanelsRuntime['resolveServices']
  readonly resolveTenant?: NextPanelsRuntime['resolveTenant']
}

function exampleActor(actor: object, tenant: unknown): ExampleActor {
  const id = Reflect.get(actor, 'id')
  const role = Reflect.get(actor, 'role')
  if (typeof id !== 'string' || typeof tenant !== 'string' || (role !== 'super-admin' && role !== 'tenant-admin' && role !== 'editor')) {
    throw new ExampleDomainAccessError('Example domain access was denied.')
  }
  return { id, role, tenantId: tenant }
}

function requiredString(payload: Readonly<Record<string, unknown>>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${key} is required.`)
  return value.trim()
}

function exampleDomainAction(
  domain: ExampleBlogDomain,
  input: NextPanelOperationInput,
): NextPanelOperationResult | null {
  if (input.operation !== 'action' || typeof input.payload.actionId !== 'string' || !input.payload.actionId.startsWith('example.')) return null
  const actor = exampleActor(input.scope.actor, input.scope.tenant)
  const postId = typeof input.payload.postId === 'string' ? input.payload.postId : ''

  if (input.payload.actionId === 'example.tags.attach') {
    const post = domain.attachTag(actor, postId, requiredString(input.payload, 'tagId'))
    return { data: { ...post, tagIds: [...post.tagIds] } }
  }
  if (input.payload.actionId === 'example.tags.detach') {
    const post = domain.detachTag(actor, postId, requiredString(input.payload, 'tagId'))
    return { data: { ...post, tagIds: [...post.tagIds] } }
  }
  if (input.payload.actionId === 'example.comments.create') {
    return { data: { ...domain.createComment(actor, postId, requiredString(input.payload, 'authorName'), requiredString(input.payload, 'body')) } }
  }
  if (input.payload.actionId === 'example.comments.moderate') {
    const status = requiredString(input.payload, 'status')
    if (status !== 'approved' && status !== 'pending' && status !== 'spam') throw new TypeError('Comment status is invalid.')
    return { data: { ...domain.moderateComment(actor, requiredString(input.payload, 'commentId'), status satisfies ExampleCommentStatus) } }
  }
  throw new TypeError('Unknown example action.')
}

async function exampleResourceOperation(
  domain: ExampleBlogDomain,
  input: NextPanelOperationInput,
): Promise<NextPanelOperationResult | null> {
  const resourceId = input.payload.resourceId
  if (resourceId !== 'categories' && resourceId !== 'tags' && resourceId !== 'comments' && resourceId !== 'media' && resourceId !== 'post-tags') return null
  if (input.operation !== 'form-submit' && input.operation !== 'action') throw new TypeError('The example resource operation is invalid.')
  const actor = exampleActor(input.scope.actor, input.scope.tenant)
  const intent = requiredString(input.payload, 'intent')
  const recordId = typeof input.payload.recordId === 'string' ? input.payload.recordId : null
  const resourceContext = { actor, signal: input.scope.signal, tenant: actor.tenantId }
  let data: NextPanelOperationResult['data']

  if (intent === 'delete') {
    if (!recordId) throw new TypeError('recordId is required.')
    if (resourceId === 'categories') domain.deleteCategory(actor, recordId)
    else if (resourceId === 'tags') domain.deleteTag(actor, recordId)
    else if (resourceId === 'comments') domain.deleteComment(actor, recordId)
    else if (resourceId === 'post-tags') await postTagExecutor.delete(recordId, resourceContext)
    else throw new ExampleDomainAccessError('Media deletion requires the approved upload workflow.')
    data = { deleted: true, id: recordId, resourceId }
  } else if (resourceId === 'categories') {
    data = { ...domain.saveCategory(actor, recordId, requiredString(input.payload, 'name'), requiredString(input.payload, 'slug')) }
  } else if (resourceId === 'tags') {
    data = { ...domain.saveTag(actor, recordId, requiredString(input.payload, 'name'), requiredString(input.payload, 'slug')) }
  } else if (resourceId === 'comments') {
    const status = requiredString(input.payload, 'status')
    if (status !== 'approved' && status !== 'pending' && status !== 'spam') throw new TypeError('Comment status is invalid.')
    data = { ...domain.saveComment(actor, recordId, {
      authorName: requiredString(input.payload, 'authorName'),
      body: requiredString(input.payload, 'body'),
      postId: requiredString(input.payload, 'postId'),
      status,
    }) }
  } else if (resourceId === 'post-tags') {
    const postId = requiredString(input.payload, 'postId')
    const tagId = requiredString(input.payload, 'tagId')
    const relation = recordId
      ? (await postTagExecutor.update(recordId, { postId, tagId }, resourceContext)).record
      : (await postTagExecutor.create({ postId, tagId }, resourceContext)).record
    const serialized = relation.toJSON()
    data = { id: String(Reflect.get(serialized, 'id')), postId, tagId }
  } else {
    if (!recordId) throw new ExampleDomainAccessError('Media creation requires the approved upload workflow.')
    const media = domain.updateMediaAlt(actor, recordId, requiredString(input.payload, 'alt'))
    data = { alt: media.alt, id: media.id, mime: media.mime, size: media.size, tenantId: media.tenantId }
  }

  return {
    data,
    effects: [{ kind: 'toast', level: 'success', message: intent === 'delete' ? 'Record deleted.' : 'Record saved.' }],
  }
}

export function adaptPanelAuthGuard<TGuard extends object>(guard: TGuard) {
  const refreshUser = Reflect.get(guard, 'refreshUser')
  const user = Reflect.get(guard, 'user')
  return Object.freeze({
    ...guard,
    async user(): Promise<object | null> {
      const actor = typeof refreshUser === 'function'
        ? await Reflect.apply(refreshUser, guard, [])
        : typeof user === 'function' ? await Reflect.apply(user, guard, []) : null
      return typeof actor === 'object' && actor !== null ? actor : null
    },
  })
}

async function panelAuth() {
  const binding = await holo.getAuth()
  if (!binding) throw new Error('[Holo Panels] Holo Auth must be configured before serving the Admin panel.')
  return Object.freeze({
    ...binding,
    guard(name: string) {
      return adaptPanelAuthGuard(binding.guard(name))
    },
  })
}

export function createAdminPanelsRuntime(overrides: AdminPanelsRuntimeOverrides = {}): NextPanelsRuntime {
  const panel = AdminPanel.compile()
  const domain = overrides.domain ?? createExampleBlogDomain()
  return Object.freeze({
    auth: overrides.auth ?? panelAuth,
    async execute(input: NextPanelOperationInput) {
    if (input.operation === 'notification') {
      const actor = exampleActor(input.scope.actor, input.scope.tenant)
      return {
        data: notificationData(await executePanelDatabaseNotificationOperation({
          panel,
          payload: input.payload,
          scope: {
            actor,
            guard: panel.guard,
            panelId: panel.manifest.id,
            provider: input.scope.provider,
            signal: input.scope.signal,
          },
        })),
      }
    }
    const domainResult = exampleDomainAction(domain, input)
    if (domainResult) return domainResult
    const resourceResult = await exampleResourceOperation(domain, input)
    if (resourceResult) return resourceResult
    requirePostActor(input.scope.actor)
    const intent = typeof input.payload.intent === 'string' ? input.payload.intent : input.operation
    const context = postExecutionContext(input.scope.actor, input.scope.signal, input.scope.tenant)
    const recordId = input.payload.recordId
    const values = {
      ...(typeof input.payload.category === 'string' ? { category: input.payload.category } : {}),
      ...(typeof input.payload.city === 'string' ? { city: input.payload.city } : {}),
      ...(typeof input.payload.slug === 'string' ? { slug: input.payload.slug } : {}),
      ...(typeof input.payload.title === 'string' ? { title: input.payload.title } : {}),
    }
    const mutation = {
      context,
      intent,
      recordId: typeof recordId === 'string' || typeof recordId === 'number' ? recordId : null,
      values,
    }
    if (overrides.mutatePost) await overrides.mutatePost(mutation)
    else await mutatePost(mutation.intent, mutation.recordId, mutation.values, mutation.context)
    return {
      data: { intent, resourceId: input.payload.resourceId ?? null, saved: true },
      effects: [{ kind: 'toast' as const, level: 'success' as const, message: intent === 'delete' ? 'Post deleted.' : 'Post saved.' }],
    }
    },
    registry: Object.freeze({
      'admin:page:categories': async () => ListCategories,
      'admin:page:categories-create': async () => CreateCategory,
      'admin:page:categories-edit': async () => EditCategory,
      'admin:page:categories-view': async () => ViewCategory,
      'admin:page:comments': async () => ListComments,
      'admin:page:comments-create': async () => CreateComment,
      'admin:page:comments-edit': async () => EditComment,
      'admin:page:comments-view': async () => ViewComment,
      'admin:page:media': async () => ListMedia,
      'admin:page:media-edit': async () => EditMedia,
      'admin:page:media-view': async () => ViewMedia,
      'admin:page:overview': async () => OverviewDashboard,
      'admin:page:posts': async () => ListPosts,
      'admin:page:posts-create': async () => CreatePost,
      'admin:page:posts-edit': async () => EditPost,
      'admin:page:posts-view': async () => ViewPost,
      'admin:page:post-tags': async () => ListPostTags,
      'admin:page:post-tags-create': async () => CreatePostTag,
      'admin:page:post-tags-edit': async () => EditPostTag,
      'admin:page:post-tags-view': async () => ViewPostTag,
      'admin:page:tags': async () => ListTags,
      'admin:page:tags-create': async () => CreateTag,
      'admin:page:tags-edit': async () => EditTag,
      'admin:page:tags-view': async () => ViewTag,
      'admin:page:users': async () => ListUsers,
      'admin:page:users-view': async () => ViewUser,
      'admin:panel:admin': async () => AdminPanel,
      'admin:export:post-export': async () => PostExporter,
      'admin:import:post-import': async () => PostImporter,
      'admin:resource:categories': async () => CategoryResource,
      'admin:resource:comments': async () => CommentResource,
      'admin:resource:media': async () => MediaResource,
      'admin:resource:memberships': async () => MembershipResource,
      'admin:resource:posts': async () => PostResource,
      'admin:resource:post-tags': async () => PostTagResource,
      'admin:resource:tags': async () => TagResource,
      'admin:resource:users': async () => UserResource,
      'admin:widget:content-overview': async () => ContentOverview,
    }),
    resolveServices: overrides.resolveServices ?? (async () => ({ domain, holo: (await holo.getApp()).runtime })),
    resolveTenant: overrides.resolveTenant ?? (async () => {
      const actor = await (await holo.getAuth())?.user()
      if (typeof actor !== 'object' || actor === null) return null
      const tenantId = Reflect.get(actor, 'tenantId')
      return typeof tenantId === 'string' ? tenantId : null
    }),
  })
}

export const adminPanelsRuntime = createAdminPanelsRuntime()
