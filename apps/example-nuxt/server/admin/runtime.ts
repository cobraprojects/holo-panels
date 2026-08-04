import {
  ResourceExecutor,
  executePanelDatabaseNotificationOperation,
  type CompiledPageDefinition,
  type PanelDatabaseNotificationOperationResult,
  type ResourceAuthorization,
  type ResourceExecutionContext,
} from '@holo-js/panels'
import type { NuxtPanelJsonObject as JsonObject, NuxtPanelOperationContext, NuxtPanelRuntime } from '@holo-js/panels-nuxt'
import AdminPanel from './AdminPanel'
import { domainRuntimeResources, type DomainRuntimeResource } from './domain/runtimeResources'
import OverviewDashboard from './pages/OverviewDashboard'
import CreatePost from './pages/posts/CreatePost'
import EditPost from './pages/posts/EditPost'
import ListPosts from './pages/posts/ListPosts'
import ViewPost from './pages/posts/ViewPost'
import { canManagePosts, canManageResource, type AdminActor } from './pages/posts/access'
import PostResource from './resources/posts/PostResource'
import CategoryPages from './runtime-pages/CategoryPages'
import CommentPages from './runtime-pages/CommentPages'
import MediaPages from './runtime-pages/MediaPages'
import MembershipPages from './runtime-pages/MembershipPages'
import PostTagPages from './runtime-pages/PostTagPages'
import TagPages from './runtime-pages/TagPages'
import UserPages from './runtime-pages/UserPages'

interface RuntimeActor extends AdminActor {
  readonly email: string
  readonly tenantId: string | null
}

const panel = AdminPanel.compile()
const resource = PostResource.compile()
const pages = [
  { definition: OverviewDashboard.compile(), resourceId: 'posts' },
  { definition: CreatePost.compile(), resourceId: 'posts' },
  { definition: EditPost.compile(), resourceId: 'posts' },
  { definition: ListPosts.compile(), resourceId: 'posts' },
  { definition: ViewPost.compile(), resourceId: 'posts' },
  ...[CategoryPages, TagPages, CommentPages, MediaPages, UserPages, MembershipPages, PostTagPages].flatMap(definitions => [
    { definition: definitions.create.compile(), resourceId: definitions.list.compile().manifest.id },
    { definition: definitions.edit.compile(), resourceId: definitions.list.compile().manifest.id },
    { definition: definitions.list.compile(), resourceId: definitions.list.compile().manifest.id },
    { definition: definitions.view.compile(), resourceId: definitions.list.compile().manifest.id },
  ]),
]
const categoryOptions = [{ label: 'Engineering', value: 'engineering' }, { label: 'Product', value: 'product' }]
const cityOptions = {
  engineering: [{ label: 'Cairo', value: 'Cairo' }, { label: 'Giza', value: 'Giza' }],
  product: [{ label: 'Alexandria', value: 'Alexandria' }, { label: 'Mansoura', value: 'Mansoura' }],
}

interface ResourceComponentDescriptor {
  readonly key: string
  readonly requiredState?: boolean
  readonly type: string
}

function notificationData(result: PanelDatabaseNotificationOperationResult): JsonObject {
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

function resourceComponents(value: object | undefined): readonly ResourceComponentDescriptor[] {
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object' && typeof item.key === 'string' && typeof item.type === 'string')) {
    throw new Error('The Post resource requires compiled form and table components')
  }
  return value as readonly ResourceComponentDescriptor[]
}

export const adminResourceRenderSchema = {
  actions: [
    { id: `view-${resource.slug}`, kind: 'view', label: 'View', scope: 'row' },
    { id: `edit-${resource.slug}`, kind: 'edit', label: 'Edit', scope: 'row' },
    { confirmation: 'Delete this post?', id: `delete-${resource.slug}`, kind: 'delete', label: 'Delete', scope: 'row' },
  ],
  basePath: `${panel.manifest.path}/${resource.slug}`,
  columns: resourceComponents(resource.table).map(component => ({
    manifest: { alignment: 'start', copyable: component.key === 'slug', hidden: false, inlineEditor: null, label: component.key[0]?.toUpperCase() + component.key.slice(1), path: component.key, sortable: true, toggleable: true, type: component.type, width: null, wrap: true },
  })),
  fields: resourceComponents(resource.form).map(component => ({
    disabled: false,
    helperText: null,
    hint: null,
    label: component.key[0]?.toUpperCase() + component.key.slice(1),
    path: component.key,
    placeholder: null,
    properties: component.key === 'category' || component.key === 'city' ? { paginated: false, preload: true, searchable: false } : {},
    readOnly: false,
    required: component.requiredState === true,
    type: component.key === 'category' || component.key === 'city' ? 'select' : component.type,
    visible: true,
    ...(component.key === 'slug' ? { reactive: { source: 'title', transform: 'slug' } } : {}),
    ...(component.key === 'category' ? { defaultValue: 'engineering', optionSource: { options: categoryOptions } } : {}),
    ...(component.key === 'city' ? { optionSource: { dependency: 'category', options: [], optionsByDependency: cityOptions } } : {}),
  })),
  filters: [{ manifest: { defaultValue: null, id: 'category', label: 'Category', properties: {}, type: 'select' }, options: [{ label: 'All', value: null }, ...categoryOptions] }],
  kind: 'resource',
  recordTitle: resource.recordTitle,
  resourceId: resource.slug,
  routeKey: resource.routeKey,
}

function actor(value: unknown): RuntimeActor {
  const id = value && typeof value === 'object' ? (value as { readonly id?: unknown }).id : undefined
  const tenantId = value && typeof value === 'object' ? (value as { readonly tenantId?: unknown }).tenantId : undefined
  if (!value || typeof value !== 'object' || (typeof id !== 'number' && typeof id !== 'string') || typeof (value as { readonly role?: unknown }).role !== 'string' || tenantId !== null && typeof tenantId !== 'string') {
    throw Object.assign(new Error('Authentication is required'), { code: 'unauthenticated', name: 'PanelRuntimeError' })
  }
  return {
    ...(value as AdminActor),
    email: typeof (value as { readonly email?: unknown }).email === 'string' ? (value as { readonly email: string }).email : '',
    tenantId,
  }
}

function route(definition: CompiledPageDefinition<JsonObject, AdminActor, unknown, unknown>, path: string): Readonly<Record<string, string>> | null {
  const expected = definition.manifest.path.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const parameters: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const expectedSegment = expected[index]
    const actualSegment = actual[index]
    if (!expectedSegment || !actualSegment) return null
    if (expectedSegment.startsWith(':')) parameters[expectedSegment.slice(1)] = actualSegment
    else if (expectedSegment !== actualSegment) return null
  }
  return parameters
}

function executionContext(context: NuxtPanelOperationContext): ResourceExecutionContext<RuntimeActor, string> {
  const current = actor(context.actor)
  return { actor: current, signal: context.signal, tenant: current.tenantId ?? 'default' }
}

function domainResource(resourceId: string): DomainRuntimeResource | undefined {
  const candidate = Reflect.get(domainRuntimeResources, resourceId) as unknown
  return candidate && typeof candidate === 'object' && 'id' in candidate && candidate.id === resourceId
    ? candidate as DomainRuntimeResource
    : undefined
}

const authorization: ResourceAuthorization<typeof resource.model, Awaited<ReturnType<typeof resource.model.create>>, RuntimeActor> = {
  async authorizeClass(current): Promise<void> {
    if (!current || !canManagePosts(current)) throw Object.assign(new Error('Denied'), { code: 'access-denied', name: 'PanelRuntimeError' })
  },
  async authorizeRecord(current): Promise<void> {
    if (!current || !canManagePosts(current)) throw Object.assign(new Error('Denied'), { code: 'access-denied', name: 'PanelRuntimeError' })
  },
}

const executor = new ResourceExecutor(resource, { authorization })

function writableInput(input: JsonObject, actorId: string): {
  readonly authorId: string
  readonly body: string
  readonly category: string
  readonly categoryId: string
  readonly city: string
  readonly excerpt: string
  readonly featuredMediaId: string | null
  readonly slug: string
  readonly status: string
  readonly title: string
} {
  if (typeof input.title !== 'string' || typeof input.slug !== 'string' || typeof input.category !== 'string' || typeof input.city !== 'string') {
    throw Object.assign(new Error('Post fields are required'), { statusCode: 422 })
  }
  return {
    authorId: typeof input.authorId === 'string' ? input.authorId : actorId,
    body: typeof input.body === 'string' ? input.body : '',
    category: input.category,
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : input.category,
    city: input.city,
    excerpt: typeof input.excerpt === 'string' ? input.excerpt : input.title,
    featuredMediaId: typeof input.featuredMediaId === 'string' ? input.featuredMediaId : null,
    slug: input.slug,
    status: typeof input.status === 'string' ? input.status : 'draft',
    title: input.title,
  }
}

async function records(context: NuxtPanelOperationContext, search: string, category: string): Promise<JsonObject[]> {
  const scope = executionContext(context)
  await authorization.authorizeClass(actor(context.actor), 'viewAny', resource.model)
  let query = resource.tenantScope?.(resource.baseQuery(resource.model.query(), scope), scope) ?? resource.baseQuery(resource.model.query(), scope)
  if (search) query = query.where('title', 'like', `%${search}%`)
  if (category) query = query.where('category', '=', category)
  const result = await query.get()
  return result.map((record: Awaited<ReturnType<typeof resource.model.create>>) => record.toJSON() as JsonObject)
}

async function pageData(context: NuxtPanelOperationContext): Promise<unknown> {
  const location = typeof context.input.path === 'string' ? context.input.path : '/admin'
  const url = new URL(location, 'http://panels.local')
  const match = pages.flatMap(page => {
    const parameters = route(page.definition, url.pathname)
    return parameters ? [{ ...page, parameters }] : []
  })[0]
  if (!match) throw Object.assign(new Error('Missing'), { name: 'ResourceRecordNotFoundError' })
  const current = actor(context.actor)
  const pageContext = {
    actor: current,
    locale: 'en',
    panelId: 'admin',
    parameters: match.parameters,
    services: {},
    signal: context.signal,
    tenant: current.tenantId ?? 'default',
  }
  if (!await match.definition.server.authorize(pageContext)) throw Object.assign(new Error('Denied'), { name: 'PageAccessError' })
  const loaded = await match.definition.server.load?.(pageContext) ?? {}
  const title = typeof match.definition.server.title === 'function' ? await match.definition.server.title(pageContext) : match.definition.server.title ?? match.definition.manifest.id
  const heading = typeof match.definition.server.heading === 'function' ? await match.definition.server.heading(pageContext) : match.definition.server.heading ?? null
  const subheading = typeof match.definition.server.subheading === 'function' ? await match.definition.server.subheading(pageContext) : match.definition.server.subheading ?? null
  const breadcrumbs = typeof match.definition.server.breadcrumbs === 'function' ? await match.definition.server.breadcrumbs(pageContext) : match.definition.server.breadcrumbs ?? []
  const selectedResource = domainResource(match.resourceId)
  const selectedSchema = selectedResource?.schema ?? adminResourceRenderSchema
  const resolved = { breadcrumbs, data: loaded, heading, manifest: match.definition.manifest, schema: selectedSchema, subheading, title }
  const search = url.searchParams.get('search') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const scope = executionContext(context)
  const data: JsonObject = match.definition.manifest.pageType === 'list'
    ? { ...resolved.data, category, records: selectedResource ? [...await selectedResource.list(scope, search)] : await records(context, search, category), search }
    : match.parameters.record
      ? { ...resolved.data, record: selectedResource ? await selectedResource.serialize(match.parameters.record, scope) : await executor.serialize(match.parameters.record, scope) as JsonObject }
      : resolved.data
  const navigation = [
    { badge: null, group: 'Content', icon: 'document-text', id: 'posts', label: 'Posts', parent: null, path: '/admin/posts', sort: 10 },
    ...Object.values(domainRuntimeResources)
      .filter(item => item.navigation && canManageResource(current, item.id))
      .map(item => ({
        badge: null,
        group: typeof item.navigation?.group === 'string' ? item.navigation.group : null,
        icon: typeof item.navigation?.icon === 'string' ? item.navigation.icon : null,
        id: item.id,
        label: typeof item.navigation?.label === 'string' ? item.navigation.label : item.id,
        parent: null,
        path: `/admin/${item.id}`,
        sort: typeof item.navigation?.sort === 'number' ? item.navigation.sort : 100,
      })),
  ]
  return {
    bootstrap: {
      actor: await panel.server.presentActor(current),
      manifest: { ...panel.manifest, navigation },
      provider: context.provider,
    },
    page: { ...resolved, data },
    path: location,
  }
}

async function mutation(context: NuxtPanelOperationContext): Promise<JsonObject> {
  const action = context.input.mutation
  const scope = executionContext(context)
  const resourceId = typeof context.input.resourceId === 'string' ? context.input.resourceId : 'posts'
  const selectedResource = domainResource(resourceId)
  if (resourceId !== 'posts' && !selectedResource) throw Object.assign(new Error('Unknown resource'), { statusCode: 404 })
  if (action === 'create') {
    if (selectedResource) return { record: await selectedResource.create(context.input, scope) }
    const result = await executor.create(writableInput(context.input, String(actor(context.actor).id)), scope)
    return { record: result.record.toJSON() as JsonObject }
  }
  const record = context.input.record
  if (typeof record !== 'string' && typeof record !== 'number') throw Object.assign(new Error('Record is required'), { statusCode: 422 })
  if (action === 'update') {
    if (selectedResource) return { record: await selectedResource.update(record, context.input, scope) }
    const result = await executor.update(record, writableInput(context.input, String(actor(context.actor).id)), scope)
    return { record: result.record.toJSON() as JsonObject }
  }
  if (action === 'delete') {
    if (selectedResource) {
      await selectedResource.delete(record, scope)
      return { deleted: true }
    }
    await executor.delete(record, scope)
    return { deleted: true }
  }
  throw Object.assign(new Error('Unsupported mutation'), { statusCode: 422 })
}

function actionInput(context: NuxtPanelOperationContext): JsonObject {
  const input = context.input.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Action input is required'), { statusCode: 422 })
  return input
}

async function relationAction(context: NuxtPanelOperationContext): Promise<JsonObject> {
  const actionId = context.input.actionId
  if (typeof actionId !== 'string') throw Object.assign(new Error('Action is required'), { statusCode: 422 })
  const scope = executionContext(context)
  const resourceId = context.input.resourceId
  const selectedResource = typeof resourceId === 'string' ? domainResource(resourceId) : undefined
  const recordIds = context.input.recordIds
  const recordId = Array.isArray(recordIds) ? recordIds[0] : undefined
  if (selectedResource && actionId === `delete-${resourceId}` && (typeof recordId === 'number' || typeof recordId === 'string')) {
    await selectedResource.delete(recordId, scope)
    return { deleted: true }
  }
  if (resourceId === resource.slug && actionId === `delete-${resource.slug}` && (typeof recordId === 'number' || typeof recordId === 'string')) {
    await executor.delete(recordId, scope)
    return { deleted: true }
  }
  const input = actionInput(context)
  if (actionId === 'tags.attach') {
    const postId = typeof input.postId === 'string' ? input.postId : ''
    const tagId = typeof input.tagId === 'string' ? input.tagId : ''
    if (!postId || !tagId) throw Object.assign(new Error('Post and tag are required'), { statusCode: 422 })
    await executor.serialize(postId, scope)
    await domainRuntimeResources.tags.serialize(tagId, scope)
    return { relation: await domainRuntimeResources['post-tags'].create({ postId, tagId }, scope) }
  }
  if (actionId === 'tags.detach') {
    const relationId = typeof input.relationId === 'string' ? input.relationId : ''
    if (!relationId) throw Object.assign(new Error('Relation is required'), { statusCode: 422 })
    await domainRuntimeResources['post-tags'].delete(relationId, scope)
    return { detached: true }
  }
  if (actionId === 'comments.create') {
    const postId = typeof input.postId === 'string' ? input.postId : ''
    if (!postId) throw Object.assign(new Error('Post is required'), { statusCode: 422 })
    await executor.serialize(postId, scope)
    return { comment: await domainRuntimeResources.comments.create({ ...input, postId, status: 'pending' }, scope) }
  }
  if (actionId === 'comments.moderate') {
    const commentId = typeof input.commentId === 'string' ? input.commentId : ''
    const status = input.status === 'approved' || input.status === 'rejected' ? input.status : ''
    if (!commentId || !status) throw Object.assign(new Error('Comment and moderation status are required'), { statusCode: 422 })
    const comment = await domainRuntimeResources.comments.serialize(commentId, scope)
    return { comment: await domainRuntimeResources.comments.update(commentId, { ...comment, status }, scope) }
  }
  throw Object.assign(new Error('Unsupported action'), { statusCode: 404 })
}

export const adminPanelRuntime: NuxtPanelRuntime = {
  panels: {
    admin: { access: ({ actor: value }) => canManagePosts(actor(value)), definition: panel, guard: panel.guard },
  },
  async execute(context) {
    if (context.operation === 'notification') {
      const authenticatedActor = actor(context.actor)
      return {
        data: notificationData(await executePanelDatabaseNotificationOperation({
          panel,
          payload: context.input,
          scope: {
            actor: authenticatedActor,
            guard: panel.guard,
            panelId: panel.manifest.id,
            provider: context.provider,
            signal: context.signal,
          },
        })),
      }
    }
    if (context.operation === 'page-data' || context.operation === 'bootstrap') return { data: await pageData(context) }
    if (context.operation === 'form-submit') return { data: await mutation(context), effects: [{ kind: 'toast', level: 'success', message: 'Record saved' }] }
    if (context.operation === 'action') return { data: await relationAction(context), effects: [{ kind: 'toast', level: 'success', message: 'Action completed' }] }
    throw Object.assign(new Error('Unsupported operation'), { statusCode: 404 })
  },
}
