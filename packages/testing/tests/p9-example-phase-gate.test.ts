import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSvelteKitHoloHelpers } from '../../../../holo-js/packages/adapter-sveltekit'
import { initializeHoloAdapterProject, resetHoloRuntime, type HoloAdapterProject } from '../../../../holo-js/packages/core'
import type { CompiledPageDefinition } from '@holo-js/panels-core'
import type { JsonObject, PanelAuthenticatedScope } from '@holo-js/panels-svelte'
import type { NextPanelsRuntime } from '../../next/src/contracts'
import { resolveNextPanelPage } from '../../next/src/runtime'
import type { NuxtPanelOperationContext, NuxtPanelRuntime } from '../../nuxt/src/contracts'
import type { PanelOperationInput, PanelPageResolutionInput, SvelteKitPanelEvent, SvelteKitPanelRegistry } from '../../sveltekit/src/contracts'
import { loadExampleExport, loadExampleSchema } from './load-example'

interface PanelAcceptanceFixture {
  readonly pages: readonly CompiledPageDefinition<JsonObject, object, unknown, object>[]
}

interface NextPanelAcceptanceFixture extends PanelAcceptanceFixture {
  createRuntime(overrides: {
    readonly auth?: NextPanelsRuntime['auth']
    readonly resolveServices?: NextPanelsRuntime['resolveServices']
    readonly resolveTenant?: NextPanelsRuntime['resolveTenant']
  }): Promise<NextPanelsRuntime>
}

interface NuxtPanelAcceptanceFixture extends PanelAcceptanceFixture {
  loadRuntime(): Promise<NuxtPanelRuntime>
}

interface SvelteKitPanelAcceptanceFixture extends PanelAcceptanceFixture {
  loadRegistry(): Promise<SvelteKitPanelRegistry>
}

interface StoredPost extends Record<string, unknown> {
  category: string
  city: string
  createdAt?: Date | string
  id: number
  slug: string
  tenantId: string
  title: string
}

interface TestRecord {
  readonly definition?: object
  getRepository?(): { readonly definition: object }
  getRelation(name: string): readonly TestRecord[]
  load(name: string): Promise<TestRecord>
  delete(): Promise<void>
  toJSON(): Readonly<StoredPost>
  update(values: Readonly<Record<string, unknown>>): Promise<TestRecord>
}

function createPersistence(definition?: object): { readonly create: (values: Readonly<Record<string, unknown>>) => Promise<TestRecord>, readonly query: () => object, readonly records: StoredPost[] } {
  const records: StoredPost[] = [
    { category: 'News', city: 'Cairo', id: 1, slug: 'first-post', tenantId: 'tenant-a', title: 'First post' },
    { category: 'Guides', city: 'Giza', id: 2, slug: 'engineering-notes', tenantId: 'tenant-a', title: 'Engineering notes' },
    { category: 'News', city: 'Alexandria', id: 3, slug: 'other-tenant', tenantId: 'tenant-b', title: 'Other tenant' },
  ]
  const wrap = (stored: StoredPost): TestRecord => ({
    ...(definition ? { definition } : {}),
    ...(definition ? { getRepository: () => ({ definition }) } : {}),
    async delete() {
      const index = records.indexOf(stored)
      if (index >= 0) records.splice(index, 1)
    },
    getRelation: () => Object.freeze([]),
    async load() {
      return this
    },
    toJSON: () => Object.freeze({ ...stored }),
    async update(values) {
      Object.assign(stored, values)
      return this
    },
  })
  const create = async (values: Readonly<Record<string, unknown>>): Promise<TestRecord> => {
    const stored = { category: '', city: '', createdAt: new Date('2026-08-05T00:00:00.000Z'), id: records.length + 1, slug: '', tenantId: '', title: '', ...values } as StoredPost
    records.push(stored)
    return wrap(stored)
  }
  const query = (): object => {
    const predicates: ((record: StoredPost) => boolean)[] = []
    const orders: { readonly column: string, readonly direction: 'asc' | 'desc' }[] = []
    const matching = (): StoredPost[] => records.filter(record => predicates.every(predicate => predicate(record))).sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.column]
        const rightValue = right[order.column]
        const comparison = typeof leftValue === 'number' && typeof rightValue === 'number' ? leftValue - rightValue : String(leftValue ?? '').localeCompare(String(rightValue ?? ''))
        if (comparison !== 0) return order.direction === 'desc' ? -comparison : comparison
      }
      return 0
    })
    const builder = {
      async count() {
        return matching().length
      },
      async first() {
        const stored = matching()[0]
        return stored ? wrap(stored) : undefined
      },
      async get() {
        return matching().map(wrap)
      },
      orderBy(column: string, direction: 'asc' | 'desc') {
        orders.push({ column, direction })
        return builder
      },
      async paginate(perPage: number, page: number) {
        const available = matching()
        const offset = (page - 1) * perPage
        return {
          data: available.slice(offset, offset + perPage).map(wrap),
          meta: { currentPage: page, hasMorePages: offset + perPage < available.length, lastPage: Math.max(1, Math.ceil(available.length / perPage)), perPage, total: available.length },
        }
      },
      where(attribute: string, operator: string, value: unknown) {
        const comparison = value === undefined ? operator : value
        const comparisonOperator = value === undefined ? '=' : operator
        predicates.push((record) => comparisonOperator === 'like'
          ? String(record[attribute]).toLocaleLowerCase().includes(String(comparison).replaceAll('%', '').toLocaleLowerCase())
          : attribute === 'id' ? String(record.id) === String(comparison) : record[attribute] === comparison)
        return builder
      },
      whereAny(attributes: readonly string[], _operator: 'like', value: string) {
        const search = value.replaceAll('%', '').toLocaleLowerCase()
        predicates.push(record => attributes.some(attribute => String(record[attribute] ?? '').toLocaleLowerCase().includes(search)))
        return builder
      },
      with(..._relations: readonly string[]) {
        return builder
      },
    }
    return builder
  }
  return { create, query, records }
}

async function mockPersistence(path: string, specifier = path): Promise<StoredPost[]> {
  const module: object = await import(path)
  const model = Reflect.get(module, 'default')
  if (!model || typeof model !== 'object') throw new Error(`Missing example Post model: ${path}`)
  const definition = Reflect.get(model, 'definition')
  const persistence = createPersistence(definition && typeof definition === 'object' ? definition : undefined)
  const replacement = Object.create(model) as object
  Object.defineProperties(replacement, {
    create: { configurable: true, value: persistence.create },
    query: { configurable: true, value: persistence.query },
  })
  vi.doMock(specifier, () => {
    if (!module || typeof module !== 'object') throw new Error(`Missing example Post model: ${path}`)
    return { ...module, default: replacement }
  })
  if (specifier !== path) vi.doMock(path, () => ({ ...module, default: replacement }))
  return persistence.records
}

const signal = new AbortController().signal
const admin = Object.freeze({ createdAt: new Date(), email: 'admin@example.test', id: '1', name: 'Admin', password: 'hidden', role: 'admin', tenantId: 'tenant-a', tenants: [{ id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a' }], updatedAt: new Date() })
const denied = Object.freeze({ createdAt: new Date(), email: 'viewer@example.test', id: '2', name: 'Viewer', password: 'hidden', role: 'viewer', tenantId: 'tenant-a', tenants: [{ id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a' }], updatedAt: new Date() })
const svelteAdmin = Object.freeze({ canManagePosts: true, createdAt: new Date(), email: 'editor@example.test', id: 'user-acme-editor', name: 'Acme Editor', password: 'hidden', roleKey: 'editor' as const, tenantId: 'tenant-a', tenantIds: ['tenant-a'], updatedAt: new Date() })
const svelteDenied = Object.freeze({ canManagePosts: false, createdAt: new Date(), email: 'denied@example.test', id: 'user-denied', name: 'Denied User', password: 'hidden', roleKey: 'denied' as const, tenantId: 'tenant-a', tenantIds: [], updatedAt: new Date() })
type SvelteActor = typeof svelteAdmin | typeof svelteDenied
const restorations: (() => void)[] = []

async function configureTestDatabase(): Promise<void> {
  const databasePackage = pathToFileURL(resolve(process.cwd(), '../../node_modules/@holo-js/db/dist/index.mjs')).href
  const module: object = await import(databasePackage)
  const configure = Reflect.get(module, 'configureDB')
  const reset = Reflect.get(module, 'resetDB')
  if (typeof configure !== 'function' || typeof reset !== 'function') throw new Error('Missing Holo database configuration')
  const connection = {
    getConnectionName: () => 'p9-test',
    transaction: async <TResult>(operation: (transaction: object) => Promise<TResult>): Promise<TResult> => operation(connection),
    writeTransaction: async <TResult>(operation: (transaction: object) => Promise<TResult>): Promise<TResult> => operation(connection),
  }
  Reflect.apply(configure, undefined, [{ connection: () => connection }])
  restorations.push(() => Reflect.apply(reset, undefined, []))
}

function nuxtContext(operation: NuxtPanelOperationContext['operation'], actor: object, input: JsonObject, project: HoloAdapterProject): NuxtPanelOperationContext<object, unknown> {
  return {
    actor,
    event: {} as NuxtPanelOperationContext<object, unknown>['event'],
    getApp: async () => project,
    getAuth: async () => undefined,
    input,
    operation,
    panelId: 'admin',
    provider: 'session',
    requestId: 'p9-nuxt-request',
    signal,
    tenant: typeof Reflect.get(actor, 'tenantId') === 'string' ? Reflect.get(actor, 'tenantId') : undefined,
  }
}

function svelteEvent(path: string): SvelteKitPanelEvent {
  const url = new URL(path, 'https://panels.test')
  return {
    cookies: { get: () => undefined, set: () => undefined },
    locals: {},
    params: {},
    request: new Request(url),
    url,
  }
}

function svelteScope(actor: SvelteActor): PanelAuthenticatedScope<SvelteActor> {
  return { actor, guard: 'web', panelId: 'admin', provider: 'session', signal }
}

afterEach(async () => {
  for (const restore of restorations.splice(0)) restore()
  await resetHoloRuntime()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('P9 example phase gate', () => {
  it('loads the generated Post List/Create/View/Edit definitions in every example', async () => {
    await Promise.all(['next', 'nuxt', 'sveltekit'].map(framework => loadExampleSchema(framework as 'next' | 'nuxt' | 'sveltekit')))
    const fixtures = await Promise.all([
      loadExampleExport<NextPanelAcceptanceFixture>('next', 'p9-panel-acceptance-next', 'nextPanelAcceptanceFixture'),
      loadExampleExport<NuxtPanelAcceptanceFixture>('nuxt', 'p9-panel-acceptance-nuxt', 'nuxtPanelAcceptanceFixture'),
      loadExampleExport<SvelteKitPanelAcceptanceFixture>('sveltekit', 'p9-panel-acceptance-sveltekit', 'svelteKitPanelAcceptanceFixture'),
    ])
    for (const fixture of fixtures) {
      expect(fixture.pages.map(page => page.manifest.pageType)).toEqual(['list', 'create', 'view', 'edit'])
      expect(fixture.pages.map(page => page.manifest.path)).toEqual([
        '/admin/posts',
        '/admin/posts/create',
        '/admin/posts/:record',
        '/admin/posts/:record/edit',
      ])
      expect(fixture.pages.find(page => page.manifest.pageType === 'create')?.manifest.body).toMatchObject({
        properties: { resource: { form: { fields: expect.arrayContaining([
          expect.objectContaining({ label: 'Title', path: 'title' }),
          expect.objectContaining({ label: 'Slug', path: 'slug' }),
        ]) } } },
      })
    }
  })

  it('executes Next create, list, view, edit, delete, and tenant isolation through the exported example runtime and page resolver', async () => {
    await loadExampleSchema('next')
    const modelPath = pathToFileURL(resolve(process.cwd(), '../../apps/example-next/server/models/Post.ts')).href
    const userModelPath = pathToFileURL(resolve(process.cwd(), '../../apps/example-next/server/models/User.ts')).href
    const records = await mockPersistence(modelPath, '~/server/models/Post')
    await mockPersistence(userModelPath, '~/server/models/User')
    await initializeHoloAdapterProject(resolve(process.cwd(), '../../apps/example-next'), { processEnv: { ...process.env, DB_URL: ':memory:' } })
    await configureTestDatabase()
    const nextPanelAcceptanceFixture = await loadExampleExport<NextPanelAcceptanceFixture>('next', 'p9-panel-acceptance-next', 'nextPanelAcceptanceFixture')
    const auth = { guard: () => ({ provider: async () => 'session', user: async () => admin }) }
    const runtime = await nextPanelAcceptanceFixture.createRuntime({ auth, resolveServices: async () => ({}), resolveTenant: async () => 'tenant-a' }) as NextPanelsRuntime
    const execute = runtime.execute
    expect(execute).toBeTypeOf('function')
    const scope = { actor: admin, locale: 'en', panelId: 'admin', parameters: {}, provider: 'session', request: new Request('https://panels.test/admin/posts'), services: {}, signal, tenant: 'tenant-a' }
    const invoke = (payload: JsonObject) => execute?.({ operation: 'form-submit', panelId: 'admin', payload, request: scope.request, scope })
    const created = await invoke({ category: 'News', city: 'Cairo', intent: 'create', resourceId: 'posts', slug: 'created-post', title: 'Created post' })
    expect(created).toMatchObject({ data: { record: { createdAt: '2026-08-05T00:00:00.000Z' } } })
    const list = await resolveNextPanelPage('admin', ['posts'], new Request('https://panels.test/admin/posts'), runtime)
    expect(list.page.data.records).toEqual([
      expect.objectContaining({ id: 1, title: 'First post' }),
      expect.objectContaining({ id: 2, title: 'Engineering notes' }),
      expect.objectContaining({ id: 4, slug: 'created-post', title: 'Created post' }),
    ])
    const table = await runtime.execute?.({
      operation: 'table-data',
      panelId: 'admin',
      payload: { page: 1, perPage: 1, resourceId: 'posts', search: 'engineering', sort: [{ column: 'title', direction: 'desc' }] },
      request: scope.request,
      scope,
    })
    expect(table).toMatchObject({ data: { records: [expect.objectContaining({ id: 2, title: 'Engineering notes' })], total: 1 }, effects: [] })
    const options = await runtime.execute?.({ operation: 'options', panelId: 'admin', payload: { action: 'list', fieldId: 'city', page: 1, perPage: 25, resourceId: 'posts', search: 'cai' }, request: scope.request, scope })
    expect(options).toMatchObject({ data: { options: [{ label: 'Cairo', value: 'Cairo' }], total: 1 }, effects: [] })
    await expect(runtime.execute?.({ operation: 'table-data', panelId: 'admin', payload: { resourceId: 'posts', sort: [{ column: 'password', direction: 'asc' }] }, request: scope.request, scope })).rejects.toThrow(/unsortable/u)
    const view = await resolveNextPanelPage('admin', ['posts', '4'], new Request('https://panels.test/admin/posts/4'), runtime)
    expect(view.page.data.record).toEqual(expect.objectContaining({ id: 4, slug: 'created-post' }))
    await invoke({ category: 'News', city: 'Cairo', intent: 'update', recordId: 4, resourceId: 'posts', slug: 'edited-post', title: 'Edited post' })
    const edit = await resolveNextPanelPage('admin', ['posts', '4', 'edit'], new Request('https://panels.test/admin/posts/4/edit'), runtime)
    expect(edit.page.data.record).toEqual(expect.objectContaining({ id: 4, slug: 'edited-post', title: 'Edited post' }))
    await expect(resolveNextPanelPage('admin', ['posts', '3'], new Request('https://panels.test/admin/posts/3'), runtime)).rejects.toThrow('not found')
    await runtime.execute?.({ operation: 'action', panelId: 'admin', payload: { actionId: 'delete', input: {}, mount: 'record', recordIds: [4], resourceId: 'posts' }, request: scope.request, scope })
    const afterDelete = await resolveNextPanelPage('admin', ['posts'], new Request('https://panels.test/admin/posts'), runtime)
    expect(afterDelete.page.data.records).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ])
    expect(records).toContainEqual(expect.objectContaining({ id: 3, tenantId: 'tenant-b' }))
  })

  it('executes Nuxt list filters, view, CRUD, policy denial, and safe validation through the exported runtime', async () => {
    await loadExampleSchema('nuxt')
    const modelPath = pathToFileURL(resolve(process.cwd(), '../../apps/example-nuxt/server/models/Post.ts')).href
    const records = await mockPersistence(modelPath)
    const project = await initializeHoloAdapterProject(resolve(process.cwd(), '../../apps/example-nuxt'), { processEnv: { ...process.env, DB_URL: ':memory:' } })
    await configureTestDatabase()
    const nuxtPanelAcceptanceFixture = await loadExampleExport<NuxtPanelAcceptanceFixture>('nuxt', 'p9-panel-acceptance-nuxt', 'nuxtPanelAcceptanceFixture')
    const runtime = await nuxtPanelAcceptanceFixture.loadRuntime()
    const context = (operation: NuxtPanelOperationContext['operation'], actor: object, input: JsonObject) => nuxtContext(operation, actor, input, project)
    const list = await runtime.execute(context('page-data', admin, { path: '/admin/posts?search=first&category=News' }))
    const listPayload = list.data as { readonly page: { readonly data: JsonObject } }
    expect(listPayload.page.data.category).toBe('News')
    expect(listPayload.page.data.search).toBe('first')
    expect(listPayload.page.data.records).toEqual([expect.objectContaining({ title: 'First post' })])
    const table = await runtime.execute(context('table-data', admin, { filters: { category: 'Guides' }, resourceId: 'posts', sort: [{ column: 'title', direction: 'asc' }] }))
    expect(table).toMatchObject({ data: { records: [expect.objectContaining({ title: 'Engineering notes' })], total: 1 }, effects: [] })
    const options = await runtime.execute(context('options', admin, { action: 'list', fieldId: 'city', page: 1, perPage: 25, resourceId: 'posts', search: 'giz' }))
    expect(options).toMatchObject({ data: { options: [{ label: 'Giza', value: 'Giza' }], total: 1 }, effects: [] })
    const view = await runtime.execute(context('page-data', admin, { path: '/admin/posts/1' }))
    expect(view.data).toMatchObject({ page: { data: { record: { slug: 'first-post' } } } })
    await runtime.execute(context('form-submit', admin, { authorId: '1', body: 'Body', category: 'News', categoryId: 'news', city: 'Cairo', excerpt: 'Excerpt', mutation: 'create', resourceId: 'posts', slug: 'created-post', status: 'draft', title: 'Created post' }))
    await runtime.execute(context('form-submit', admin, { category: 'Guides', city: 'Giza', mutation: 'update', record: 4, resourceId: 'posts', slug: 'edited-post', title: 'Edited post' }))
    await runtime.execute(context('action', admin, { actionId: 'delete', input: {}, mount: 'record', recordIds: [4], resourceId: 'posts' }))
    await expect(runtime.execute(context('form-submit', denied, { authorId: '2', body: 'Body', category: 'News', categoryId: 'news', city: 'Cairo', excerpt: 'Excerpt', mutation: 'create', resourceId: 'posts', slug: 'denied', status: 'draft', title: 'Denied' }))).rejects.toThrow()
    await expect(runtime.execute(context('form-submit', admin, { mutation: 'create', resourceId: 'posts', title: 'secret stack marker' }))).rejects.toThrow()
    expect(records.some(record => record.slug === 'edited-post')).toBe(false)
  })

  it('executes SvelteKit list filters, view, CRUD, dependencies, policy denial, and safe validation through the exported registry', async () => {
    await loadExampleSchema('sveltekit')
    const modelPath = pathToFileURL(resolve(process.cwd(), '../../apps/example-sveltekit/server/models/Post.ts')).href
    const records = await mockPersistence(modelPath)
    const projectRoot = resolve(process.cwd(), '../../apps/example-sveltekit')
    await initializeHoloAdapterProject(projectRoot, { processEnv: { ...process.env, DB_URL: ':memory:' } })
    const holo = createSvelteKitHoloHelpers({ projectRoot })
    await configureTestDatabase()
    const fixture = await loadExampleExport<SvelteKitPanelAcceptanceFixture>('sveltekit', 'p9-panel-acceptance-sveltekit', 'svelteKitPanelAcceptanceFixture')
    const registry = await fixture.loadRegistry()
    const pageInput = (path: string, actor: SvelteActor = svelteAdmin): PanelPageResolutionInput<SvelteActor> => ({
      event: svelteEvent(path),
      holo,
      panelId: 'admin',
      parameters: {},
      path: new URL(path, 'https://panels.test').pathname,
      scope: svelteScope(actor),
      tenant: 'tenant-a',
    })
    const list = await registry.resolvePage(pageInput('/admin/posts?search=first'))
    expect(list.data.filters).toEqual({ search: 'first' })
    expect(list.data.records).toEqual([expect.objectContaining({ title: 'First post' })])
    const table = await registry.operations?.['table-data']?.({
      event: svelteEvent('/holo/panels/admin/table-data'),
      holo,
      operation: 'table-data',
      panelId: 'admin',
      payload: { page: 1, perPage: 1, resourceId: 'posts', search: 'engineering', sort: [{ column: 'title', direction: 'asc' }] },
      scope: svelteScope(svelteAdmin),
      tenant: 'tenant-a',
    })
    expect(table).toMatchObject({ data: { records: [expect.objectContaining({ title: 'Engineering notes' })], total: 1 }, effects: [] })
    const options = await registry.operations?.options?.({
      event: svelteEvent('/holo/panels/admin/options'),
      holo,
      operation: 'options',
      panelId: 'admin',
      payload: { action: 'list', fieldId: 'city', page: 1, perPage: 25, resourceId: 'posts', search: 'giz' },
      scope: svelteScope(svelteAdmin),
      tenant: 'tenant-a',
    })
    expect(options).toMatchObject({ data: { options: [{ label: 'Giza', value: 'Giza' }], total: 1 }, effects: [] })
    const view = await registry.resolvePage(pageInput('/admin/posts/1'))
    expect(view.data).toMatchObject({ record: { slug: 'first-post' } })
    const operation = registry.operations?.['form-submit']
    const invoke = (actor: SvelteActor, payload: JsonObject): Promise<unknown> => {
      const event = svelteEvent('/holo/panels/admin/form-submit')
      const input: PanelOperationInput<SvelteActor, string> = { event, holo, operation: 'form-submit', panelId: 'admin', payload, scope: svelteScope(actor), tenant: 'tenant-a' }
      return Promise.resolve(operation?.(input))
    }
    await invoke(svelteAdmin, { intent: 'create', recordId: '', resourceId: 'posts', values: { category: 'News', city: 'Cairo', slug: 'created-post', title: 'Created Post' } })
    expect(records.some(record => record.slug === 'created-post')).toBe(true)
    await invoke(svelteAdmin, { intent: 'update', recordId: 4, resourceId: 'posts', values: { category: 'Guides', city: 'Giza', slug: 'edited-post', title: 'Edited Post' } })
    await registry.operations?.action?.({ event: svelteEvent('/holo/panels/admin/action'), holo, operation: 'action', panelId: 'admin', payload: { actionId: 'delete', input: {}, mount: 'record', recordIds: [4], resourceId: 'posts' }, scope: svelteScope(svelteAdmin), tenant: 'tenant-a' })
    await expect(invoke(svelteDenied, { intent: 'create', resourceId: 'posts', values: { category: 'News', city: 'Cairo', slug: 'denied', title: 'Denied' } })).rejects.toThrow()
    await expect(invoke(svelteAdmin, { intent: 'create', resourceId: 'posts', values: { category: 'Guides', city: 'Atlantis', slug: 'invalid-city', title: 'private implementation detail' } })).rejects.toThrow()
    expect(records.some(record => record.slug === 'edited-post')).toBe(false)
  })
})
