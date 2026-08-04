import { defineCreatePage, defineEditPage, defineListPage, defineViewPage } from '@holo-js/panels'
import { ExampleActor, type ExampleBlogDomain, type ExampleAdminSnapshot } from '../../../domain/blog'
import PostTag from '../../../models/PostTag'

type ManifestValue = boolean | number | string | null | ManifestValue[] | { readonly [key: string]: ManifestValue }
type ManifestObject = { readonly [key: string]: ManifestValue }

export class ExamplePageServices {
  declare readonly domain: ExampleBlogDomain
}

type ExampleResourceId = 'categories' | 'comments' | 'media' | 'post-tags' | 'tags' | 'users'
type MutableResourceId = Exclude<ExampleResourceId, 'users'>

interface FieldDescriptor {
  readonly label: string
  readonly path: string
  readonly type: 'number' | 'text'
}

interface ResourceDescriptor {
  readonly create: boolean
  readonly fields: readonly FieldDescriptor[]
  readonly label: string
  readonly mutable: boolean
}

const descriptors: Readonly<Record<ExampleResourceId, ResourceDescriptor>> = Object.freeze({
  categories: { create: true, fields: [{ label: 'Name', path: 'name', type: 'text' }, { label: 'Slug', path: 'slug', type: 'text' }], label: 'Categories', mutable: true },
  comments: { create: true, fields: [{ label: 'Post ID', path: 'postId', type: 'text' }, { label: 'Author', path: 'authorName', type: 'text' }, { label: 'Body', path: 'body', type: 'text' }, { label: 'Status', path: 'status', type: 'text' }], label: 'Comments', mutable: true },
  media: { create: false, fields: [{ label: 'Alternative text', path: 'alt', type: 'text' }, { label: 'MIME type', path: 'mime', type: 'text' }, { label: 'Size', path: 'size', type: 'number' }], label: 'Media', mutable: true },
  'post-tags': { create: true, fields: [{ label: 'Post ID', path: 'postId', type: 'text' }, { label: 'Tag ID', path: 'tagId', type: 'text' }], label: 'Post tags', mutable: true },
  tags: { create: true, fields: [{ label: 'Name', path: 'name', type: 'text' }, { label: 'Slug', path: 'slug', type: 'text' }], label: 'Tags', mutable: true },
  users: { create: false, fields: [{ label: 'Name', path: 'name', type: 'text' }, { label: 'Email', path: 'email', type: 'text' }, { label: 'Role', path: 'roleKey', type: 'text' }], label: 'Users', mutable: false },
})

const safeRecords = (snapshot: ExampleAdminSnapshot, resourceId: ExampleResourceId): readonly ManifestObject[] => {
  if (resourceId === 'categories') return snapshot.categories.map(record => ({ id: record.id, name: record.name, slug: record.slug, tenantId: record.tenantId }))
  if (resourceId === 'tags') return snapshot.tags.map(record => ({ id: record.id, name: record.name, slug: record.slug, tenantId: record.tenantId }))
  if (resourceId === 'comments') return snapshot.comments.map(record => ({ authorName: record.authorName, body: record.body, id: record.id, postId: record.postId, status: record.status, tenantId: record.tenantId }))
  if (resourceId === 'media') return snapshot.media.map(record => ({ alt: record.alt, id: record.id, mime: record.mime, size: record.size, tenantId: record.tenantId }))
  if (resourceId === 'post-tags') return snapshot.posts.flatMap(post => post.tagIds.map(tagId => ({ id: `post-tag-${post.id}-${tagId}`, postId: post.id, tagId, tenantId: post.tenantId })))
  const memberships = new Map(snapshot.memberships.map(membership => [membership.userId, membership.roleKey]))
  return snapshot.users.map(record => ({ email: record.email, id: record.id, name: record.name, roleKey: memberships.get(record.id) ?? 'none' }))
}

const canAccess = (domain: ExampleBlogDomain, actor: ExampleActor, tenant: string, resourceId: ExampleResourceId): boolean => {
  if (actor.tenantId !== tenant) return false
  try {
    const snapshot = domain.adminSnapshot(actor)
    return resourceId !== 'users' || snapshot.users.length > 0
  } catch {
    return false
  }
}

const pageData = async (domain: ExampleBlogDomain, actor: ExampleActor, tenant: string, resourceId: ExampleResourceId, recordId?: string): Promise<ManifestObject> => {
  const records = resourceId === 'post-tags'
    ? (await PostTag.query().where('tenantId', tenant).get()).map(record => ({ id: record.id, postId: record.postId, tagId: record.tagId, tenantId: record.tenantId }))
    : safeRecords(domain.adminSnapshot(actor), resourceId)
  if (!recordId) return { operation: 'list', records: [...records], resourceId }
  const record = records.find(candidate => candidate.id === recordId)
  if (!record) throw new Error('The requested record was not found.')
  return { operation: 'view', record, resourceId }
}

const resourceProperties = (resourceId: MutableResourceId): ManifestObject => {
  const descriptor = descriptors[resourceId]
  const editableFields = resourceId === 'media' ? descriptor.fields.filter(field => field.path === 'alt') : descriptor.fields
  const deleteActions = resourceId === 'media' ? [] : [{ confirmation: 'Delete this record?', disabled: false, id: 'delete-record', kind: 'delete', label: 'Delete', mount: 'record', schema: null, visible: true }]
  return {
    resource: {
      actions: deleteActions,
      capabilities: { delete: resourceId !== 'media', forceDelete: false, restore: false },
      form: {
        dependencies: [],
        fields: editableFields.map(field => ({
          disabled: false,
          helperText: null,
          hint: null,
          label: field.label,
          path: field.path,
          placeholder: null,
          properties: {},
          readOnly: false,
          required: true,
          type: field.type,
          visible: true,
        })),
      },
      id: resourceId,
      infolist: {
        entries: descriptor.fields.map(field => ({ actions: [], copyable: false, id: `${resourceId}-${field.path}`, inlineLabel: false, label: field.label, path: field.path, placeholder: null, properties: {}, type: 'text' })),
      },
      labels: { create: `Create ${descriptor.label.toLowerCase().replace(/s$/u, '')}`, deleted: 'Record deleted.', edit: 'Edit record', plural: descriptor.label, save: 'Save', saved: 'Saved.', saving: 'Saving…' },
      recordTitle: descriptor.fields[0]?.path ?? 'id',
      routeKey: 'id',
      slug: resourceId,
      table: {
        actions: resourceId === 'media' ? [] : [{ id: 'delete-record', kind: 'delete', label: 'Delete', removesRecord: true, scope: 'row' }],
        columns: descriptor.fields.map(field => ({ alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: field.label, path: field.path, sortable: true, toggleable: true, type: field.type, width: null, wrap: true })),
        filterMode: 'live',
        recordLink: 'id',
      },
    },
  }
}

export const createResourceListPage = (resourceId: MutableResourceId) => defineListPage(resourceId, {
  actor: ExampleActor,
  load: context => pageData(context.services.domain, context.actor, context.tenant, resourceId),
  services: ExamplePageServices,
  tenant: String,
})
  .path(`/admin/${resourceId}`)
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, resourceId))
  .title(descriptors[resourceId].label)
  .heading(descriptors[resourceId].label)
  .navigation({ icon: resourceId === 'media' ? 'photo' : resourceId === 'comments' ? 'chat-bubble-left-right' : resourceId === 'tags' ? 'tag' : resourceId === 'post-tags' ? 'link' : 'folder', label: descriptors[resourceId].label, sort: resourceId === 'categories' ? 20 : resourceId === 'tags' ? 30 : resourceId === 'post-tags' ? 35 : resourceId === 'comments' ? 40 : 50 })
  .body(resourceId === 'media' ? 'readonly-records' : 'resource-page', resourceId === 'media' ? {} : { ...resourceProperties(resourceId), operation: 'list' })

export const createResourceCreatePage = (resourceId: Exclude<MutableResourceId, 'media'>) => defineCreatePage(`${resourceId}-create`, {
  actor: ExampleActor,
  load: () => ({ operation: 'create', resourceId }),
  services: ExamplePageServices,
  tenant: String,
})
  .path(`/admin/${resourceId}/create`)
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, resourceId))
  .title(`Create ${descriptors[resourceId].label.toLowerCase().replace(/s$/u, '')}`)
  .heading(`Create ${descriptors[resourceId].label.toLowerCase().replace(/s$/u, '')}`)
  .breadcrumbs([{ label: descriptors[resourceId].label, path: `/admin/${resourceId}` }])
  .body('resource-page', { ...resourceProperties(resourceId), operation: 'create' })

export const createResourceViewPage = (resourceId: MutableResourceId) => defineViewPage(`${resourceId}-view`, {
  actor: ExampleActor,
  load: context => pageData(context.services.domain, context.actor, context.tenant, resourceId, context.parameters.record),
  services: ExamplePageServices,
  tenant: String,
})
  .path(`/admin/${resourceId}/:record`)
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, resourceId))
  .title(descriptors[resourceId].label)
  .heading(`View ${descriptors[resourceId].label.toLowerCase().replace(/s$/u, '')}`)
  .breadcrumbs([{ label: descriptors[resourceId].label, path: `/admin/${resourceId}` }])
  .body('resource-page', { ...resourceProperties(resourceId), operation: 'view' })

export const createResourceEditPage = (resourceId: MutableResourceId) => defineEditPage(`${resourceId}-edit`, {
  actor: ExampleActor,
  load: context => pageData(context.services.domain, context.actor, context.tenant, resourceId, context.parameters.record),
  services: ExamplePageServices,
  tenant: String,
})
  .path(`/admin/${resourceId}/:record/edit`)
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, resourceId))
  .title(`Edit ${descriptors[resourceId].label.toLowerCase().replace(/s$/u, '')}`)
  .heading(`Edit ${descriptors[resourceId].label.toLowerCase().replace(/s$/u, '')}`)
  .breadcrumbs([{ label: descriptors[resourceId].label, path: `/admin/${resourceId}` }])
  .body('resource-page', { ...resourceProperties(resourceId), operation: 'edit' })

export const createUsersListPage = () => defineListPage('users', {
  actor: ExampleActor,
  load: context => pageData(context.services.domain, context.actor, context.tenant, 'users'),
  services: ExamplePageServices,
  tenant: String,
})
  .path('/admin/users')
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, 'users'))
  .title('Users and memberships')
  .heading('Users and memberships')
  .navigation({ icon: 'users', label: 'Users', sort: 60 })

export const createUsersViewPage = () => defineViewPage('users-view', {
  actor: ExampleActor,
  load: context => pageData(context.services.domain, context.actor, context.tenant, 'users', context.parameters.record),
  services: ExamplePageServices,
  tenant: String,
})
  .path('/admin/users/:record')
  .authorize(context => canAccess(context.services.domain, context.actor, context.tenant, 'users'))
  .title('User membership')
  .heading('User membership')
  .breadcrumbs([{ label: 'Users', path: '/admin/users' }])
