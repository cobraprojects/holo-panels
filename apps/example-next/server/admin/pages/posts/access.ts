import { postFormSchema, postResourceMetadata, postTableSchema } from '../../resources/posts/schema'

type ManifestValue = boolean | number | string | null | ManifestValue[] | { readonly [key: string]: ManifestValue }
export type ManifestObject = { readonly [key: string]: ManifestValue }

export class AdminActor {
  declare readonly id: number | string
  declare readonly role: string
}

export type PostRecord = ManifestObject & {
  readonly category: string
  readonly city: string
  readonly id: number | string
  readonly slug: string
  readonly title: string
}

interface ComponentDescriptor {
  readonly key: string
  readonly requiredState?: boolean
  readonly type: string
}

function descriptors(value: object | undefined, subject: string): readonly ComponentDescriptor[] {
  if (!Array.isArray(value)) throw new Error(`The Post resource requires a compiled ${subject} schema.`)
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error(`The Post resource ${subject} schema contains an invalid component.`)
    const key = Reflect.get(item, 'key')
    const type = Reflect.get(item, 'type')
    if (typeof key !== 'string' || typeof type !== 'string') throw new Error(`The Post resource ${subject} schema contains an invalid component.`)
    return { key, requiredState: Reflect.get(item, 'requiredState') === true, type }
  })
}

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const form = descriptors(postFormSchema, 'form')
const table = descriptors(postTableSchema, 'table')
const categories = [{ label: 'News', value: 'News' }, { label: 'Guides', value: 'Guides' }]
const cities = {
  Guides: [{ label: 'Cairo', value: 'Cairo' }, { label: 'Giza', value: 'Giza' }],
  News: [{ label: 'Alexandria', value: 'Alexandria' }, { label: 'Cairo', value: 'Cairo' }],
}

function fieldProperties(key: string): ManifestObject {
  if (key === 'category') return { options: categories }
  if (key === 'city') return { optionSource: { dependency: 'category', kind: 'dependent-map', options: cities } }
  return {}
}

export const postResourceProperties: ManifestObject = Object.freeze({
  resource: {
    actions: [{ confirmation: 'Delete this post?', disabled: false, id: 'delete-post', kind: 'delete', label: 'Delete post', mount: 'record', schema: null, visible: true }],
    capabilities: {
      delete: true,
      forceDelete: false,
      restore: false,
    },
    form: {
      dependencies: [
        { id: 'post-slug', patches: [{ path: 'slug', resolver: { input: { source: 'title' }, name: 'slug' } }], paths: ['title'] },
        { id: 'post-city', patches: [{ path: 'city', resolver: { name: 'clear' } }], paths: ['category'] },
      ],
      fields: form.map((field): ManifestObject => ({
        disabled: false,
        helperText: null,
        hint: null,
        label: label(field.key),
        path: field.key,
        placeholder: null,
        properties: fieldProperties(field.key),
        readOnly: false,
        required: field.requiredState === true,
        type: field.key === 'category' ? 'radio' : field.key === 'city' ? 'select' : field.key === 'slug' ? 'slug' : field.type,
        visible: true,
      })),
    },
    id: postResourceMetadata.id,
    infolist: {
      entries: form.filter(field => field.key !== postResourceMetadata.recordTitle).map(field => ({
        actions: [],
        copyable: false,
        id: `post-${field.key}`,
        inlineLabel: false,
        label: label(field.key),
        path: field.key,
        placeholder: null,
        properties: {},
        type: 'text',
      })),
    },
    labels: { create: 'Create post', deleted: 'Post deleted.', edit: 'Edit post', plural: 'Posts', save: 'Save post', saved: 'Post saved.', saving: 'Saving…' },
    recordTitle: postResourceMetadata.recordTitle,
    routeKey: postResourceMetadata.routeKey,
    slug: postResourceMetadata.slug,
    table: {
      actions: [{ id: 'delete-post', kind: 'delete', label: 'Delete', removesRecord: true, scope: 'row' }],
      columns: table.map(column => ({ alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: label(column.key), path: column.key, sortable: true, toggleable: true, type: column.type, width: null, wrap: true })),
      filterMode: 'live',
      recordLink: postResourceMetadata.recordTitle,
    },
  },
})

export function canManagePosts(actor: AdminActor): boolean {
  return actor.role === 'admin' || actor.role === 'editor' || actor.role === 'super-admin' || actor.role === 'tenant-admin'
}
