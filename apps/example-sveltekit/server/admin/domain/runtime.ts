import {
  ResourceExecutor,
  type CompiledPageDefinition,
  type ResourceAuthorization,
  type ResourceExecutionContext,
} from '@holo-js/panels'
import type { JsonObject, JsonValue } from '@holo-js/panels-svelte'
import Category from '../../models/Category'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Membership from '../../models/Membership'
import PostTag from '../../models/PostTag'
import Tag from '../../models/Tag'
import User from '../../models/User'
import { canManageResource, isExampleAdminActor, type ExampleResourceId } from '../access'
import type { AdminActor } from '../panels/AdminPanel'
import CategoryResource, { CategoryPages } from '../resources/categories/CategoryResource'
import CommentResource, { CommentPages } from '../resources/comments/CommentResource'
import MediaResource, { MediaPages } from '../resources/media/MediaResource'
import MembershipResource, { MembershipPages } from '../resources/memberships/MembershipResource'
import PostTagResource, { PostTagPages } from '../resources/post-tags/PostTagResource'
import TagResource, { TagPages } from '../resources/tags/TagResource'
import UserResource, { UserPages } from '../resources/users/UserResource'

type DomainPage = CompiledPageDefinition<JsonObject, AdminActor, string, unknown>

export interface DomainResourceRuntime {
  readonly id: ExampleResourceId
  readonly metadata: JsonObject
  readonly pages: readonly DomainPage[]
  create?(values: JsonObject, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
  delete?(id: number | string, context: ResourceExecutionContext<object, string>): Promise<void>
  list(context: ResourceExecutionContext<object, string>, search: string): Promise<readonly JsonObject[]>
  update?(id: number | string, values: JsonObject, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
  view(id: number | string, context: ResourceExecutionContext<object, string>): Promise<JsonObject>
}

function authorization<TModel, TRecord extends object>(resourceId: ExampleResourceId): ResourceAuthorization<TModel, TRecord, object> {
  const authorize = (actor: object | null): void => {
    if (!isExampleAdminActor(actor) || !canManageResource(actor, resourceId)) {
      throw Object.assign(new Error('Resource policy denied the operation'), { code: 'access-denied' })
    }
  }
  return {
    async authorizeClass(actor): Promise<void> {
      authorize(actor)
    },
    async authorizeRecord(actor): Promise<void> {
      authorize(actor)
    },
  }
}

function descriptorList(value: object | undefined): readonly { readonly key: string, readonly requiredState?: boolean, readonly type: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const key = Reflect.get(item, 'key')
    const type = Reflect.get(item, 'type')
    const requiredState = Reflect.get(item, 'requiredState')
    return typeof key === 'string' && typeof type === 'string'
      ? [{ key, ...(typeof requiredState === 'boolean' ? { requiredState } : {}), type }]
      : []
  })
}

function title(value: string): string {
  return value.split(/[._-]/u).filter(Boolean).map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ')
}

function pagePath(pages: readonly DomainPage[], type: 'create' | 'edit' | 'view'): string | null {
  return pages.find(page => page.manifest.pageType === type)?.manifest.path ?? null
}

interface MetadataResource {
  readonly client: { readonly routeKey: string, readonly slug: string }
  readonly form?: object
  readonly id: string
  readonly model: { readonly definition: { readonly primaryKey: string } }
  readonly navigation: { readonly label?: string }
  readonly table?: object
}

function metadata(
  definition: MetadataResource,
  pages: readonly DomainPage[],
  mutable: boolean,
): JsonObject {
  const fields = descriptorList(definition.form)
  const columns = descriptorList(definition.table)
  const label = definition.navigation.label ?? title(definition.id)
  return {
    actions: mutable ? [{ confirmation: `Delete this ${label.toLocaleLowerCase()} record?`, disabled: false, id: `${definition.id}.delete`, kind: 'delete', label: 'Delete', mount: 'record', schema: null, visible: true }] : [],
    basePath: `/admin/${definition.client.slug}`,
    columns: columns.map(column => ({
      manifest: {
        alignment: 'start',
        copyable: column.key === definition.client.routeKey,
        hidden: false,
        inlineEditor: null,
        label: title(column.key),
        path: column.key,
        sortable: true,
        toggleable: true,
        type: column.type,
        width: null,
        wrap: true,
      },
    })),
    createLabel: `Create ${label.toLocaleLowerCase()}`,
    dependencies: [],
    fields: fields.map(field => ({ label: title(field.key), path: field.key, required: field.requiredState === true, type: field.type })),
    id: definition.id,
    label,
    options: {},
    recordId: definition.model.definition.primaryKey,
    routeKey: definition.client.routeKey,
    routes: { create: pagePath(pages, 'create'), edit: pagePath(pages, 'edit'), view: pagePath(pages, 'view') },
    saveLabel: `Save ${label.toLocaleLowerCase()}`,
  }
}

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return value.toISOString()
  return null
}

function project(record: object, keys: readonly string[]): JsonObject {
  const source = typeof Reflect.get(record, 'toJSON') === 'function'
    ? Reflect.apply(Reflect.get(record, 'toJSON') as (...parameters: readonly unknown[]) => unknown, record, [])
    : record
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  return Object.freeze(Object.fromEntries(keys.map(key => [key, jsonValue(Reflect.get(source, key))])))
}

function stringValues(value: JsonObject, keys: readonly string[]): JsonObject {
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw Object.assign(new Error('Unsupported resource field'), { status: 422 })
  const entries = keys.map((key) => {
    const field = value[key]
    if (typeof field !== 'string' || !field.trim()) throw Object.assign(new Error('Resource fields are required'), { status: 422 })
    return [key, field.trim()] as const
  })
  return Object.freeze(Object.fromEntries(entries))
}

function matchesSearch(record: JsonObject, search: string, keys: readonly string[]): boolean {
  return !search || keys.some(key => String(record[key] ?? '').toLocaleLowerCase().includes(search))
}

const categoryDefinition = CategoryResource.compile()
const categoryPages = [CategoryPages.list.compile(), CategoryPages.create.compile(), CategoryPages.view.compile(), CategoryPages.edit.compile()]
const categoryExecutor = new ResourceExecutor(categoryDefinition, { authorization: authorization('categories') })
const tagDefinition = TagResource.compile()
const tagPages = [TagPages.list.compile(), TagPages.create.compile(), TagPages.view.compile(), TagPages.edit.compile()]
const tagExecutor = new ResourceExecutor(tagDefinition, { authorization: authorization('tags') })
const postTagDefinition = PostTagResource.compile()
const postTagPages = [PostTagPages.list.compile(), PostTagPages.create.compile(), PostTagPages.view.compile(), PostTagPages.edit.compile()]
const postTagExecutor = new ResourceExecutor(postTagDefinition, { authorization: authorization('post-tags') })
const commentDefinition = CommentResource.compile()
const commentPages = [CommentPages.list.compile(), CommentPages.create.compile(), CommentPages.view.compile(), CommentPages.edit.compile()]
const commentExecutor = new ResourceExecutor(commentDefinition, { authorization: authorization('comments') })
const mediaDefinition = MediaResource.compile()
const mediaPages = [MediaPages.list.compile(), MediaPages.view.compile()]
const mediaExecutor = new ResourceExecutor(mediaDefinition, { authorization: authorization('media') })
const membershipDefinition = MembershipResource.compile()
const membershipPages = [MembershipPages.list.compile(), MembershipPages.view.compile()]
const membershipExecutor = new ResourceExecutor(membershipDefinition, { authorization: authorization('memberships') })
const userDefinition = UserResource.compile()
const userPages = [UserPages.list.compile(), UserPages.view.compile()]

const categoryRuntime: DomainResourceRuntime = {
  id: 'categories',
  metadata: metadata(categoryDefinition, categoryPages, true),
  pages: categoryPages,
  async create(values, context) {
    return project((await categoryExecutor.create(stringValues(values, ['name', 'slug']), context)).record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])
  },
  async delete(id, context) {
    await categoryExecutor.delete(id, context)
  },
  async list(context, search) {
    const records = await Category.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['name', 'slug']))
  },
  async update(id, values, context) {
    return project((await categoryExecutor.update(id, stringValues(values, ['name', 'slug']), context)).record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])
  },
  view: (id, context) => categoryExecutor.serialize(id, context) as Promise<JsonObject>,
}

const tagRuntime: DomainResourceRuntime = {
  id: 'tags',
  metadata: metadata(tagDefinition, tagPages, true),
  pages: tagPages,
  async create(values, context) {
    return project((await tagExecutor.create(stringValues(values, ['name', 'slug']), context)).record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])
  },
  async delete(id, context) {
    await tagExecutor.delete(id, context)
  },
  async list(context, search) {
    const records = await Tag.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['name', 'slug']))
  },
  async update(id, values, context) {
    return project((await tagExecutor.update(id, stringValues(values, ['name', 'slug']), context)).record, ['id', 'name', 'slug', 'createdAt', 'updatedAt'])
  },
  view: (id, context) => tagExecutor.serialize(id, context) as Promise<JsonObject>,
}

const postTagRuntime: DomainResourceRuntime = {
  id: 'post-tags',
  metadata: metadata(postTagDefinition, postTagPages, true),
  pages: postTagPages,
  async create(values, context) {
    return project((await postTagExecutor.create(stringValues(values, ['postId', 'tagId']), context)).record, ['id', 'postId', 'tagId'])
  },
  async delete(id, context) {
    await postTagExecutor.delete(id, context)
  },
  async list(context, search) {
    const records = await PostTag.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'postId', 'tagId'])).filter(record => matchesSearch(record, search, ['postId', 'tagId']))
  },
  async update(id, values, context) {
    return project((await postTagExecutor.update(id, stringValues(values, ['postId', 'tagId']), context)).record, ['id', 'postId', 'tagId'])
  },
  view: (id, context) => postTagExecutor.serialize(id, context) as Promise<JsonObject>,
}

const commentRuntime: DomainResourceRuntime = {
  id: 'comments',
  metadata: metadata(commentDefinition, commentPages, true),
  pages: commentPages,
  async create(values, context) {
    return project((await commentExecutor.create(stringValues(values, ['postId', 'authorName', 'body', 'status']), context)).record, ['id', 'postId', 'authorName', 'body', 'status', 'createdAt', 'updatedAt'])
  },
  async delete(id, context) {
    await commentExecutor.delete(id, context)
  },
  async list(context, search) {
    const records = await Comment.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'postId', 'authorName', 'body', 'status', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['authorName', 'body', 'status']))
  },
  async update(id, values, context) {
    return project((await commentExecutor.update(id, stringValues(values, ['postId', 'authorName', 'body', 'status']), context)).record, ['id', 'postId', 'authorName', 'body', 'status', 'createdAt', 'updatedAt'])
  },
  view: (id, context) => commentExecutor.serialize(id, context) as Promise<JsonObject>,
}

const mediaRuntime: DomainResourceRuntime = {
  id: 'media',
  metadata: metadata(mediaDefinition, mediaPages, false),
  pages: mediaPages,
  async list(context, search) {
    const records = await Media.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'alt', 'mime', 'size', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['alt', 'mime']))
  },
  async view(id, context) {
    return project(await mediaExecutor.serialize(id, context), ['id', 'alt', 'mime', 'size', 'createdAt', 'updatedAt'])
  },
}

const membershipRuntime: DomainResourceRuntime = {
  id: 'memberships',
  metadata: metadata(membershipDefinition, membershipPages, false),
  pages: membershipPages,
  async list(context, search) {
    const records = await Membership.query().where('tenantId', context.tenant).get()
    return records.map(record => project(record, ['id', 'userId', 'roleKey', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['userId', 'roleKey']))
  },
  async view(id, context) {
    return project(await membershipExecutor.serialize(id, context), ['id', 'userId', 'roleKey', 'createdAt', 'updatedAt'])
  },
}

const userRuntime: DomainResourceRuntime = {
  id: 'users',
  metadata: metadata(userDefinition, userPages, false),
  pages: userPages,
  async list(context, search) {
    if (!isExampleAdminActor(context.actor) || !canManageResource(context.actor, 'users')) throw Object.assign(new Error('Resource policy denied the operation'), { code: 'access-denied' })
    const memberships = await Membership.query().where('tenantId', context.tenant).get()
    const allowed = new Set(memberships.map(record => String(record.userId)))
    const records = await User.query().get()
    return records.filter(record => allowed.has(String(record.id))).map(record => project(record, ['id', 'name', 'email', 'createdAt', 'updatedAt'])).filter(record => matchesSearch(record, search, ['name', 'email']))
  },
  async view(id, context) {
    const records = await this.list(context, '')
    const record = records.find(item => String(item.id) === String(id))
    if (!record) throw Object.assign(new Error('The requested resource record was not found.'), { code: 'not-found' })
    return record
  },
}

export const domainResourceRuntimes = Object.freeze([
  categoryRuntime,
  tagRuntime,
  postTagRuntime,
  commentRuntime,
  mediaRuntime,
  membershipRuntime,
  userRuntime,
])

export const domainPages = Object.freeze(domainResourceRuntimes.flatMap(runtime => runtime.pages))

export function domainResource(resourceId: unknown): DomainResourceRuntime | undefined {
  return typeof resourceId === 'string' ? domainResourceRuntimes.find(runtime => runtime.id === resourceId) : undefined
}
