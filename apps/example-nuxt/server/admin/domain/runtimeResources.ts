import {
  ResourceExecutor,
  type ResourceAuthorization,
  type ResourceExecutionContext,
} from '@holo-js/panels'
import type { NuxtPanelJsonObject as JsonObject, NuxtPanelJsonValue as JsonValue } from '@holo-js/panels-nuxt'
import { canManageResource, type AdminActor } from '../pages/posts/access'
import CategoryResource from '../resources/categories/CategoryResource'
import CommentResource from '../resources/comments/CommentResource'
import MediaResource from '../resources/media/MediaResource'
import MembershipResource from '../resources/memberships/MembershipResource'
import PostTagResource from '../resources/post-tags/PostTagResource'
import TagResource from '../resources/tags/TagResource'
import UserResource from '../resources/users/UserResource'
import Category from '../../models/Category'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Membership from '../../models/Membership'
import PostTag from '../../models/PostTag'
import Tag from '../../models/Tag'
import User from '../../models/User'

interface RuntimeRecord {
  toJSON(): object
}

interface RuntimeExecutor<TInput extends Readonly<Record<string, unknown>>> {
  create(input: TInput, context: ResourceExecutionContext<object, string>): Promise<{ readonly record: RuntimeRecord }>
  delete(id: number | string, context: ResourceExecutionContext<object, string>): Promise<void>
  serialize(id: number | string, context: ResourceExecutionContext<object, string>): Promise<Readonly<Record<string, unknown>>>
  update(id: number | string, input: TInput, context: ResourceExecutionContext<object, string>): Promise<{ readonly record: RuntimeRecord }>
}

interface RuntimeQuery {
  get(): Promise<readonly RuntimeRecord[]>
  where(column: string, operator: '=' | 'like', value: string): RuntimeQuery
}

export interface DomainRuntimeResource {
  readonly id: string
  readonly navigation: RuntimeNavigation
  readonly schema: JsonObject
  create(input: JsonObject, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
  delete(id: number | string, context: ResourceExecutionContext<object, string>): Promise<void>
  list(context: ResourceExecutionContext<object, string>, search: string): Promise<readonly JsonObject[]>
  serialize(id: number | string, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
  update(id: number | string, input: JsonObject, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
}

interface RuntimeNavigation {
  readonly group?: string
  readonly icon?: string
  readonly label?: string
  readonly sort?: number
}

interface ResourceComponentDescriptor {
  readonly key: string
  readonly requiredState?: boolean
  readonly type: string
}

interface RuntimeResourceDefinition {
  readonly client: {
    readonly navigation: RuntimeNavigation
  }
  readonly form?: object
  readonly recordTitle: string
  readonly routeKey: string
  readonly slug: string
  readonly table?: object
}

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => jsonValue(item))
  if (!value || typeof value !== 'object') throw new Error('Resource output must be JSON serializable')
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
}

function jsonObject(value: object): JsonObject {
  return jsonValue(value) as JsonObject
}

function components(value: object | undefined, resourceId: string): readonly ResourceComponentDescriptor[] {
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object' && typeof item.key === 'string' && typeof item.type === 'string')) {
    throw new Error(`The ${resourceId} resource requires compiled form and table components`)
  }
  return value as readonly ResourceComponentDescriptor[]
}

function renderSchema(resource: RuntimeResourceDefinition): JsonObject {
  return {
    actions: [
      { id: `view-${resource.slug}`, kind: 'view', label: 'View', scope: 'row' },
      { id: `edit-${resource.slug}`, kind: 'edit', label: 'Edit', scope: 'row' },
      { confirmation: `Delete this ${resource.slug} record?`, id: `delete-${resource.slug}`, kind: 'delete', label: 'Delete', scope: 'row' },
    ],
    basePath: `/admin/${resource.slug}`,
    columns: components(resource.table, resource.slug).map(component => ({
      manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: component.key, path: component.key, sortable: true, toggleable: true, type: component.type, width: null, wrap: true },
    })),
    fields: components(resource.form, resource.slug).map(component => ({
      disabled: false,
      helperText: null,
      hint: null,
      label: component.key,
      path: component.key,
      placeholder: null,
      properties: {},
      readOnly: false,
      required: component.requiredState === true,
      type: component.type,
      visible: true,
    })),
    filters: [],
    kind: 'resource',
    recordTitle: resource.recordTitle,
    resourceId: resource.slug,
    routeKey: resource.routeKey,
  }
}

function requiredString(input: JsonObject, key: string): string {
  const value = input[key]
  if (typeof value !== 'string' || value.trim().length === 0) throw Object.assign(new Error(`${key} is required`), { statusCode: 422 })
  return value.trim()
}

function authorizationFor<TModel, TRecord>(resourceId: string): ResourceAuthorization<TModel, TRecord, object> {
  const authorize = (current: object | null): void => {
    if (!current || !canManageResource(current as AdminActor, resourceId)) {
      throw Object.assign(new Error('Denied'), { code: 'access-denied', name: 'PanelRuntimeError' })
    }
  }
  return {
    async authorizeClass(current): Promise<void> {
      authorize(current)
    },
    async authorizeRecord(current): Promise<void> {
      authorize(current)
    },
  }
}

function listRecords(
  query: RuntimeQuery,
  context: ResourceExecutionContext<object, string>,
  search: string,
  searchColumn: string,
  shared = false,
): Promise<readonly RuntimeRecord[]> {
  let scoped = shared ? query : query.where('tenantId', '=', context.tenant)
  if (search) scoped = scoped.where(searchColumn, 'like', `%${search}%`)
  return scoped.get()
}

function runtimeResource<TInput extends Readonly<Record<string, unknown>>>(options: {
  readonly definition: RuntimeResourceDefinition
  readonly executor: RuntimeExecutor<TInput>
  readonly list: (context: ResourceExecutionContext<object, string>, search: string) => Promise<readonly RuntimeRecord[]>
  readonly writable: (input: JsonObject) => TInput
}): DomainRuntimeResource {
  return Object.freeze({
    async create(input: JsonObject, context: ResourceExecutionContext<object, string>) {
      return jsonObject((await options.executor.create(options.writable(input), context)).record.toJSON())
    },
    async delete(id: number | string, context: ResourceExecutionContext<object, string>) {
      await options.executor.delete(id, context)
    },
    id: options.definition.slug,
    async list(context: ResourceExecutionContext<object, string>, search: string) {
      return (await options.list(context, search)).map(record => jsonObject(record.toJSON()))
    },
    navigation: options.definition.client.navigation,
    schema: renderSchema(options.definition),
    async serialize(id: number | string, context: ResourceExecutionContext<object, string>) {
      return jsonObject(await options.executor.serialize(id, context))
    },
    async update(id: number | string, input: JsonObject, context: ResourceExecutionContext<object, string>) {
      return jsonObject((await options.executor.update(id, options.writable(input), context)).record.toJSON())
    },
  })
}

const category = CategoryResource.compile()
const tag = TagResource.compile()
const comment = CommentResource.compile()
const media = MediaResource.compile()
const user = UserResource.compile()
const membership = MembershipResource.compile()
const postTag = PostTagResource.compile()

export const domainRuntimeResources = Object.freeze({
  categories: runtimeResource({
    definition: category,
    executor: new ResourceExecutor(category, { authorization: authorizationFor('categories') }),
    list: (context, search) => listRecords(Category.query(), context, search, 'name'),
    writable: input => ({ name: requiredString(input, 'name'), slug: requiredString(input, 'slug') }),
  }),
  comments: runtimeResource({
    definition: comment,
    executor: new ResourceExecutor(comment, { authorization: authorizationFor('comments') }),
    list: (context, search) => listRecords(Comment.query(), context, search, 'authorName'),
    writable: input => ({ authorName: requiredString(input, 'authorName'), body: requiredString(input, 'body'), postId: requiredString(input, 'postId'), status: requiredString(input, 'status') }),
  }),
  media: runtimeResource({
    definition: media,
    executor: new ResourceExecutor(media, { authorization: authorizationFor('media') }),
    list: (context, search) => listRecords(Media.query(), context, search, 'alt'),
    writable: input => ({ alt: requiredString(input, 'alt') }),
  }),
  memberships: runtimeResource({
    definition: membership,
    executor: new ResourceExecutor(membership, { authorization: authorizationFor('memberships') }),
    list: (context, search) => listRecords(Membership.query(), context, search, 'userId'),
    writable: input => ({ roleKey: requiredString(input, 'roleKey'), userId: requiredString(input, 'userId') }),
  }),
  'post-tags': runtimeResource({
    definition: postTag,
    executor: new ResourceExecutor(postTag, { authorization: authorizationFor('post-tags') }),
    list: (context, search) => listRecords(PostTag.query(), context, search, 'postId'),
    writable: input => ({ postId: requiredString(input, 'postId'), tagId: requiredString(input, 'tagId') }),
  }),
  tags: runtimeResource({
    definition: tag,
    executor: new ResourceExecutor(tag, { authorization: authorizationFor('tags') }),
    list: (context, search) => listRecords(Tag.query(), context, search, 'name'),
    writable: input => ({ name: requiredString(input, 'name'), slug: requiredString(input, 'slug') }),
  }),
  users: runtimeResource({
    definition: user,
    executor: new ResourceExecutor(user, { authorization: authorizationFor('users') }),
    list: (context, search) => listRecords(User.query(), context, search, 'name', true),
    writable: input => ({ email: requiredString(input, 'email'), name: requiredString(input, 'name') }),
  }),
})
