import { createSvelteKitHoloHelpers } from '@holo-js/adapter-sveltekit'
import {
  PanelRuntime,
  ResourceExecutor,
  executePanelDatabaseNotificationOperation,
  preparePageRoutes,
  resolvePageData,
  type CompiledPageDefinition,
  type HoloAuth,
  type PanelDatabaseNotificationOperationResult,
} from '@holo-js/panels/server'
import type { JsonObject } from '@holo-js/panels-svelte'
import type { PanelOperationInput, PanelOperationResult, PanelPageResolutionInput, SvelteKitPanelRegistry } from '@holo-js/panels-sveltekit'
import Post from '../models/Post'
import OverviewDashboard from './pages/OverviewDashboard'
import CreatePost from './pages/posts/CreatePost'
import EditPost from './pages/posts/EditPost'
import ListPosts from './pages/posts/ListPosts'
import ViewPost from './pages/posts/ViewPost'
import AdminPanel, { type AdminActor } from './panels/AdminPanel'
import PostResource from './resources/posts/PostResource'
import { canBootstrapAdmin, isExampleAdminActor, isExampleRoleKey } from './access'
import { domainPages, domainResource, type DomainResourceRuntime } from './domain/runtime'

const holo = createSvelteKitHoloHelpers()
const panel = AdminPanel.compile()
const resource = PostResource.compile()
const resourceBasePath = `${panel.manifest.path}/${resource.client.slug}`
const pages: readonly CompiledPageDefinition<JsonObject, AdminActor, string, unknown>[] = preparePageRoutes([
  OverviewDashboard.compile(),
  ListPosts.compile(),
  CreatePost.compile(),
  ViewPost.compile(),
  EditPost.compile(),
  ...domainPages,
])

function label(key: string): string {
  return key.split(/[._-]/u).filter(Boolean).map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ')
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

function descriptors(value: object | undefined): readonly { readonly key: string, readonly requiredState?: boolean, readonly type: string }[] {
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

function pagePath(type: 'create' | 'edit' | 'view'): string | null {
  return pages.find(page => page.manifest.id.startsWith(`${resource.id}.`) && page.manifest.pageType === type)?.manifest.path ?? null
}

const resourceMetadata: JsonObject = Object.freeze({
  actions: [{ confirmation: 'Delete this post?', disabled: false, id: `${resource.id}.delete`, kind: 'delete', label: 'Delete', mount: 'record', schema: null, visible: true }],
  basePath: resourceBasePath,
  columns: descriptors(resource.table).map(definition => ({
    manifest: {
      alignment: 'start',
      copyable: definition.key === resource.client.routeKey,
      hidden: false,
      inlineEditor: null,
      label: label(definition.key),
      path: definition.key,
      sortable: true,
      toggleable: true,
      type: definition.type,
      width: null,
      wrap: definition.key !== resource.client.routeKey,
    },
  })),
  createLabel: 'Create post',
  dependencies: [
    { id: `${resource.id}.slug`, kind: 'slug', source: 'title', target: 'slug' },
    { id: `${resource.id}.city`, kind: 'clear', source: 'category', target: 'city' },
  ],
  fields: descriptors(resource.form).map(definition => ({
    label: label(definition.key),
    path: definition.key,
    required: definition.requiredState === true,
    type: definition.key === 'category' || definition.key === 'city' ? 'select' : definition.type,
  })),
  id: resource.id,
  label: resource.navigation.label ?? label(resource.id),
  options: {
    category: { values: ['engineering', 'news'] },
    city: { dependsOn: 'category', valuesByDependency: { engineering: ['Cairo', 'London'], news: ['Cairo', 'New York'] } },
  },
  recordId: resource.model.definition.primaryKey,
  routeKey: resource.client.routeKey,
  routes: { create: pagePath('create'), edit: pagePath('edit'), view: pagePath('view') },
  saveLabel: 'Save post',
})

function actor(value: unknown): AdminActor | null {
  if (!value || typeof value !== 'object' || !isExampleAdminActor(value)) return null
  const roleKey = Reflect.get(value, 'roleKey')
  if (!isExampleRoleKey(roleKey)) return null
  const resolved = {
    id: value.id,
    name: value.name,
    roleKey,
    tenantId: value.tenantId,
    tenantIds: roleKey === 'super-admin' ? ['tenant-acme', 'tenant-globex'] : [value.tenantId],
  }
  return { ...resolved, canManagePosts: canBootstrapAdmin(resolved) }
}

const auth: HoloAuth<AdminActor> = {
  guard(name) {
    return {
      async provider() {
        const runtime = await holo.getAuth()
        const guard = runtime?.guard(name)
        if (!guard || typeof Reflect.get(guard, 'provider') !== 'function') return null
        const value: unknown = await Reflect.apply(Reflect.get(guard, 'provider') as (...parameters: readonly unknown[]) => unknown, guard, [])
        return typeof value === 'string' ? value : null
      },
      async user() {
        const runtime = await holo.getAuth()
        const guard = runtime?.guard(name)
        return actor(await guard?.refreshUser())
      },
    }
  },
}

function matchPage(path: string): { readonly definition: CompiledPageDefinition<JsonObject, AdminActor, string, unknown>, readonly parameters: Readonly<Record<string, string>> } | undefined {
  const pathSegments = path.split('/').filter(Boolean)
  for (const definition of pages) {
    const routeSegments = definition.manifest.path.split('/').filter(Boolean)
    if (routeSegments.length !== pathSegments.length) continue
    const parameters: Record<string, string> = {}
    const matches = routeSegments.every((segment, index) => {
      const value = pathSegments[index]
      if (!value) return false
      if (segment.startsWith(':')) {
        parameters[segment.slice(1)] = value
        return true
      }
      return segment === value
    })
    if (matches) return { definition, parameters: Object.freeze(parameters) }
  }
  return undefined
}

function resourceContext(scope: { readonly actor: AdminActor, readonly signal: AbortSignal }) {
  return { actor: scope.actor, signal: scope.signal, tenant: scope.actor.tenantId }
}

function ensureValues(value: unknown): { readonly category: string, readonly city: string, readonly slug: string, readonly title: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('Invalid post values'), { status: 422 })
  const title = Reflect.get(value, 'title')
  const slug = Reflect.get(value, 'slug')
  const category = Reflect.get(value, 'category')
  const city = Reflect.get(value, 'city')
  if (![title, slug, category, city].every(field => typeof field === 'string' && field.trim())) throw Object.assign(new Error('Post fields are required'), { status: 422 })
  const normalizedSlug = String(slug).normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
  const allowedCities: Readonly<Record<string, readonly string[]>> = { engineering: ['Cairo', 'London'], news: ['Cairo', 'New York'] }
  if (!allowedCities[String(category)]?.includes(String(city))) throw Object.assign(new Error('City is unavailable for the selected category'), { status: 422 })
  return { category: String(category), city: String(city), slug: normalizedSlug, title: String(title).trim() }
}

function operationRecord(record: Readonly<Record<string, unknown>>): JsonObject {
  return {
    category: String(record.category ?? ''),
    city: String(record.city ?? ''),
    id: String(record.id ?? ''),
    slug: String(record.slug ?? ''),
    title: String(record.title ?? ''),
  }
}

const executor = new ResourceExecutor(resource, {
  authorization: {
    async authorizeClass(currentActor) {
      if (!actor(currentActor)?.canManagePosts) throw Object.assign(new Error('Post policy denied the operation'), { code: 'access-denied' })
    },
    async authorizeRecord(currentActor) {
      if (!actor(currentActor)?.canManagePosts) throw Object.assign(new Error('Post policy denied the operation'), { code: 'access-denied' })
    },
  },
})

async function recordsFor(input: PanelPageResolutionInput<AdminActor>, parameters: Readonly<Record<string, string>>): Promise<JsonObject> {
  const search = input.event.url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? ''
  if (parameters.record) {
    const record = await executor.serialize(parameters.record, resourceContext(input.scope))
    return { record: { category: String(record.category ?? ''), city: String(record.city ?? ''), id: String(record.id ?? ''), slug: String(record.slug ?? ''), title: String(record.title ?? '') }, resource: resourceMetadata }
  }
  if (input.path !== resourceBasePath) return { resource: resourceMetadata }
  if (!input.scope.actor.canManagePosts) throw Object.assign(new Error('Post policy denied the operation'), { code: 'access-denied' })
  const records = await Post.query().where('tenantId', input.scope.actor.tenantId).get()
  const serialized = records.map(record => record.toJSON()).filter(record => !search || String(record.title ?? '').toLocaleLowerCase().includes(search)).map(record => ({
    category: String(record.category ?? ''),
    city: String(record.city ?? ''),
    id: String(record.id ?? ''),
    slug: String(record.slug ?? ''),
    title: String(record.title ?? ''),
  }))
  return { filters: { search }, records: serialized, resource: resourceMetadata }
}

async function domainRecordsFor(input: PanelPageResolutionInput<AdminActor>, parameters: Readonly<Record<string, string>>, runtime: DomainResourceRuntime): Promise<JsonObject> {
  const context = resourceContext(input.scope)
  if (parameters.record) return { record: await runtime.view(parameters.record, context), resource: runtime.metadata }
  if (input.path !== `/admin/${runtime.id}`) return { resource: runtime.metadata }
  const search = input.event.url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? ''
  return { filters: { search }, records: [...await runtime.list(context, search)], resource: runtime.metadata }
}

async function resolvePage(input: PanelPageResolutionInput<AdminActor>) {
  const matched = matchPage(input.path)
  if (!matched) throw Object.assign(new Error('Panel page not found'), { code: 'panel-not-found' })
  const resolved = await resolvePageData(matched.definition, {
    actor: input.scope.actor,
    locale: input.event.request.headers.get('accept-language')?.split(',')[0]?.trim() || 'en',
    panelId: input.panelId,
    parameters: matched.parameters,
    services: await input.holo.getProject(),
    signal: input.scope.signal,
    tenant: input.scope.actor.tenantId,
  })
  const runtime = domainResource(matched.definition.manifest.id.split('.')[0])
  return { ...resolved, data: runtime ? await domainRecordsFor(input, matched.parameters, runtime) : await recordsFor(input, matched.parameters) }
}

async function mutateDomain(input: PanelOperationInput<AdminActor>, runtime: DomainResourceRuntime): Promise<PanelOperationResult> {
  const context = resourceContext(input.scope)
  const payload = input.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Object.assign(new Error('Invalid operation payload'), { status: 422 })
  const intent = Reflect.get(payload, 'intent')
  const recordId = Reflect.get(payload, 'recordId')
  const recordIds = Reflect.get(payload, 'recordIds')
  const actionRecordId = Array.isArray(recordIds) ? recordIds[0] : undefined
  if (intent === 'delete' && (typeof actionRecordId === 'number' || typeof actionRecordId === 'string') && runtime.delete) {
    await runtime.delete(actionRecordId, context)
    return { data: { deleted: true }, effects: [{ kind: 'redirect', url: `/admin/${runtime.id}` }] }
  }
  const values = Reflect.get(payload, 'values')
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw Object.assign(new Error('Invalid resource values'), { status: 422 })
  if (intent === 'create' && runtime.create) {
    return { data: { record: await runtime.create(values as JsonObject, context) }, effects: [{ kind: 'redirect', url: `/admin/${runtime.id}` }] }
  }
  if (intent === 'update' && (typeof recordId === 'number' || typeof recordId === 'string') && runtime.update) {
    return { data: { record: await runtime.update(recordId, values as JsonObject, context) }, effects: [{ kind: 'redirect', url: `/admin/${runtime.id}` }] }
  }
  throw Object.assign(new Error('Unsupported resource mutation'), { status: 422 })
}

async function mutate(input: PanelOperationInput<AdminActor>): Promise<PanelOperationResult> {
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) throw Object.assign(new Error('Invalid operation payload'), { status: 422 })
  const domainRuntime = domainResource(Reflect.get(input.payload, 'resourceId'))
  if (domainRuntime) return mutateDomain(input, domainRuntime)
  if (Reflect.get(input.payload, 'resourceId') !== resource.id) throw Object.assign(new Error('Unknown resource'), { status: 404 })
  const intent = Reflect.get(input.payload, 'intent')
  const recordId = Reflect.get(input.payload, 'recordId')
  const context = resourceContext(input.scope)
  const recordIds = Reflect.get(input.payload, 'recordIds')
  const actionId = Reflect.get(input.payload, 'actionId')
  const actionRecordId = Array.isArray(recordIds) ? recordIds[0] : undefined
  if (input.operation === 'action' && actionId === `${resource.id}.delete` && (typeof actionRecordId === 'number' || typeof actionRecordId === 'string')) {
    await executor.delete(actionRecordId, context)
    return { data: { deleted: true }, effects: [{ kind: 'redirect', url: resourceBasePath }] }
  }
  const values = ensureValues(Reflect.get(input.payload, 'values'))
  if (intent === 'create') {
    const result = await executor.create(values, context)
    return { data: { record: operationRecord(result.record.toJSON()) }, effects: [{ kind: 'redirect', url: `${resourceBasePath}/${values.slug}` }] }
  }
  if (intent === 'update' && (typeof recordId === 'number' || typeof recordId === 'string')) {
    const result = await executor.update(recordId, values, context)
    return { data: { record: operationRecord(result.record.toJSON()) }, effects: [{ kind: 'redirect', url: `${resourceBasePath}/${values.slug}` }] }
  }
  throw Object.assign(new Error('Unsupported post mutation'), { status: 422 })
}

async function tableData(input: PanelOperationInput<AdminActor>): Promise<PanelOperationResult> {
  if (!input.scope.actor.canManagePosts) throw Object.assign(new Error('Post policy denied the operation'), { code: 'access-denied' })
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) throw Object.assign(new Error('Unknown resource'), { status: 404 })
  const search = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) && typeof input.payload.search === 'string'
    ? input.payload.search.trim().toLocaleLowerCase()
    : ''
  const domainRuntime = domainResource(input.payload.resourceId)
  if (domainRuntime) {
    const records = [...await domainRuntime.list(resourceContext(input.scope), search)]
    return { data: { records, total: records.length } }
  }
  if (input.payload.resourceId !== resource.id) throw Object.assign(new Error('Unknown resource'), { status: 404 })
  const records = await Post.query().where('tenantId', input.scope.actor.tenantId).get()
  const serialized = records.map(record => record.toJSON()).filter(record => !search || String(record.title ?? '').toLocaleLowerCase().includes(search)).map(record => ({
    category: String(record.category ?? ''),
    city: String(record.city ?? ''),
    id: String(record.id ?? ''),
    slug: String(record.slug ?? ''),
    title: String(record.title ?? ''),
  }))
  return { data: { records: serialized, total: serialized.length } }
}

async function notification(input: PanelOperationInput<AdminActor>): Promise<PanelOperationResult> {
  return { data: notificationData(await executePanelDatabaseNotificationOperation({ panel, payload: input.payload, scope: input.scope })) }
}

export const adminPanelRegistry: SvelteKitPanelRegistry<AdminActor> = Object.freeze({
  operations: Object.freeze({ action: mutate, 'form-submit': mutate, notification, 'table-data': tableData }),
  panels: Object.freeze({ admin: panel }),
  resolvePage,
  runtime: new PanelRuntime(auth, [panel]),
})
