import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JsonObject, PanelAuthenticatedScope } from '@holo-js/panels-svelte'
import type { NextPanelsRuntime } from '../../next/src/contracts'
import { resolveNextPanelPage } from '../../next/src/runtime'
import type { NuxtPanelOperationContext } from '../../nuxt/src/contracts'
import type { PanelOperationInput, PanelPageResolutionInput, SvelteKitPanelEvent } from '../../sveltekit/src/contracts'
import { nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'
import { nuxtPanelAcceptanceFixture } from '../../../apps/example-nuxt/tests/p9-panel-acceptance-nuxt'
import { svelteKitPanelAcceptanceFixture } from '../../../apps/example-sveltekit/tests/p9-panel-acceptance-sveltekit'

vi.mock('@holo-js/authorization', async (importOriginal) => {
  const actual = await importOriginal()
  if (!actual || typeof actual !== 'object') throw new Error('Unable to load Holo authorization')
  return { ...actual, forUser: () => ({ authorize: async () => undefined }) }
})

interface StoredPost extends Record<string, unknown> {
  category: string
  city: string
  id: number
  slug: string
  tenantId: string
  title: string
}

interface TestRecord {
  delete(): Promise<void>
  toJSON(): Readonly<StoredPost>
  update(values: Readonly<Record<string, unknown>>): Promise<TestRecord>
}

function createPersistence(): { readonly create: (values: Readonly<Record<string, unknown>>) => Promise<TestRecord>, readonly query: () => object, readonly records: StoredPost[] } {
  const records: StoredPost[] = [
    { category: 'news', city: 'Cairo', id: 1, slug: 'first-post', tenantId: 'tenant-a', title: 'First post' },
    { category: 'engineering', city: 'London', id: 2, slug: 'engineering-notes', tenantId: 'tenant-a', title: 'Engineering notes' },
    { category: 'news', city: 'New York', id: 3, slug: 'other-tenant', tenantId: 'tenant-b', title: 'Other tenant' },
  ]
  const wrap = (stored: StoredPost): TestRecord => ({
    async delete() {
      const index = records.indexOf(stored)
      if (index >= 0) records.splice(index, 1)
    },
    toJSON: () => Object.freeze({ ...stored }),
    async update(values) {
      Object.assign(stored, values)
      return this
    },
  })
  const create = async (values: Readonly<Record<string, unknown>>): Promise<TestRecord> => {
    const stored = { category: '', city: '', id: records.length + 1, slug: '', tenantId: '', title: '', ...values } as StoredPost
    records.push(stored)
    return wrap(stored)
  }
  const query = (): object => {
    const predicates: ((record: StoredPost) => boolean)[] = []
    const builder = {
      async first() {
        const stored = records.find(record => predicates.every(predicate => predicate(record)))
        return stored ? wrap(stored) : undefined
      },
      async get() {
        return records.filter(record => predicates.every(predicate => predicate(record))).map(wrap)
      },
      where(attribute: string, operator: string, value: unknown) {
        const comparison = value === undefined ? operator : value
        const comparisonOperator = value === undefined ? '=' : operator
        predicates.push((record) => comparisonOperator === 'like'
          ? String(record[attribute]).toLocaleLowerCase().includes(String(comparison).replaceAll('%', '').toLocaleLowerCase())
          : attribute === 'id' ? String(record.id) === String(comparison) : record[attribute] === comparison)
        return builder
      },
    }
    return builder
  }
  return { create, query, records }
}

async function mockPersistence(path: string, specifier = path): Promise<StoredPost[]> {
  const persistence = createPersistence()
  const module: object = await import(path)
  const model = Reflect.get(module, 'default')
  if (!model || typeof model !== 'object') throw new Error(`Missing example Post model: ${path}`)
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
const admin = Object.freeze({ email: 'admin@example.test', id: 1, role: 'admin', tenantId: 'tenant-a' })
const denied = Object.freeze({ email: 'viewer@example.test', id: 2, role: 'viewer', tenantId: 'tenant-a' })
const svelteAdmin = Object.freeze({ canManagePosts: true, id: 'user-acme-editor', name: 'Acme Editor', roleKey: 'editor' as const, tenantId: 'tenant-a', tenantIds: ['tenant-a'] })
const svelteDenied = Object.freeze({ canManagePosts: false, id: 'user-denied', name: 'Denied User', roleKey: 'denied' as const, tenantId: 'tenant-a', tenantIds: [] })
type SvelteActor = typeof svelteAdmin | typeof svelteDenied
const restorations: (() => void)[] = []

async function configureTestDatabase(): Promise<void> {
  const databasePackage = new URL('../../../node_modules/@holo-js/db/dist/index.mjs', import.meta.url).href
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

function nuxtContext(operation: NuxtPanelOperationContext['operation'], actor: object, input: JsonObject): NuxtPanelOperationContext {
  return {
    actor,
    event: {} as NuxtPanelOperationContext['event'],
    getApp: (async () => ({})) as NuxtPanelOperationContext['getApp'],
    getAuth: async () => undefined,
    input,
    operation,
    panelId: 'admin',
    provider: 'session',
    requestId: 'p9-nuxt-request',
    signal,
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

afterEach(() => {
  for (const restore of restorations.splice(0)) restore()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('P9 example phase gate', () => {
  it('loads the real Post List/Create/View/Edit definitions and authorization boundaries in every example', async () => {
    for (const fixture of [nextPanelAcceptanceFixture, nuxtPanelAcceptanceFixture, svelteKitPanelAcceptanceFixture]) {
      expect(fixture.pages.map(page => page.manifest.pageType)).toEqual(['list', 'create', 'view', 'edit'])
      expect(fixture.pages.map(page => page.manifest.path)).toEqual([
        '/admin/posts',
        '/admin/posts/create',
        '/admin/posts/:record',
        '/admin/posts/:record/edit',
      ])
    }
    const context = { actor: denied, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal, tenant: 'tenant-a' }
    expect(await nextPanelAcceptanceFixture.pages[0]?.server.authorize(context)).toBe(false)
    expect(await nuxtPanelAcceptanceFixture.pages[0]?.server.authorize(context)).toBe(false)
    expect(await svelteKitPanelAcceptanceFixture.pages[0]?.server.authorize({ ...context, actor: svelteDenied })).toBe(false)
  })

  it('executes Next create, list, view, edit, delete, and tenant isolation through the exported example runtime and page resolver', async () => {
    const modelPath = new URL('../../../apps/example-next/server/models/Post.ts', import.meta.url).href
    const userModelPath = new URL('../../../apps/example-next/server/models/User.ts', import.meta.url).href
    const records = await mockPersistence(modelPath, '~/server/models/Post')
    await mockPersistence(userModelPath, '~/server/models/User')
    await configureTestDatabase()
    const auth = { guard: () => ({ provider: async () => 'session', user: async () => admin }) }
    const runtime = await nextPanelAcceptanceFixture.createRuntime({ auth, resolveServices: async () => ({}), resolveTenant: async () => 'tenant-a' }) as NextPanelsRuntime
    const execute = runtime.execute
    expect(execute).toBeTypeOf('function')
    const scope = { actor: admin, locale: 'en', panelId: 'admin', parameters: {}, provider: 'session', request: new Request('https://panels.test/admin/posts'), services: {}, signal, tenant: 'tenant-a' }
    const invoke = (payload: JsonObject) => execute?.({ operation: 'form-submit', panelId: 'admin', payload, request: scope.request, scope })
    await invoke({ category: 'news', city: 'Cairo', intent: 'create', resourceId: 'posts', slug: 'created-post', title: 'Created post' })
    const list = await resolveNextPanelPage('admin', ['posts'], new Request('https://panels.test/admin/posts'), runtime)
    expect(list.page.data.records).toEqual([
      expect.objectContaining({ id: 1, title: 'First post' }),
      expect.objectContaining({ id: 2, title: 'Engineering notes' }),
      expect.objectContaining({ id: 4, slug: 'created-post', title: 'Created post' }),
    ])
    const view = await resolveNextPanelPage('admin', ['posts', '4'], new Request('https://panels.test/admin/posts/4'), runtime)
    expect(view.page.data.record).toEqual(expect.objectContaining({ id: 4, slug: 'created-post' }))
    await invoke({ category: 'news', city: 'Cairo', intent: 'update', recordId: 4, resourceId: 'posts', slug: 'edited-post', title: 'Edited post' })
    const edit = await resolveNextPanelPage('admin', ['posts', '4', 'edit'], new Request('https://panels.test/admin/posts/4/edit'), runtime)
    expect(edit.page.data.record).toEqual(expect.objectContaining({ id: 4, slug: 'edited-post', title: 'Edited post' }))
    await expect(resolveNextPanelPage('admin', ['posts', '3'], new Request('https://panels.test/admin/posts/3'), runtime)).rejects.toThrow('not found')
    await invoke({ intent: 'delete', recordId: 4, resourceId: 'posts' })
    const afterDelete = await resolveNextPanelPage('admin', ['posts'], new Request('https://panels.test/admin/posts'), runtime)
    expect(afterDelete.page.data.records).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ])
    expect(records).toContainEqual(expect.objectContaining({ id: 3, tenantId: 'tenant-b' }))
  })

  it('executes Nuxt list filters, view, CRUD, policy denial, and safe validation through the exported runtime', async () => {
    const modelPath = new URL('../../../apps/example-nuxt/server/models/Post.ts', import.meta.url).href
    const records = await mockPersistence(modelPath)
    await configureTestDatabase()
    const runtime = await nuxtPanelAcceptanceFixture.loadRuntime()
    const list = await runtime.execute(nuxtContext('page-data', admin, { path: '/admin/posts?search=first&category=news' }))
    const listPayload = list.data as { readonly page: { readonly data: JsonObject } }
    expect(listPayload.page.data.category).toBe('news')
    expect(listPayload.page.data.search).toBe('first')
    expect(listPayload.page.data.records).toEqual([expect.objectContaining({ title: 'First post' })])
    const view = await runtime.execute(nuxtContext('page-data', admin, { path: '/admin/posts/first-post' }))
    expect(view.data).toMatchObject({ page: { data: { record: { slug: 'first-post' } } } })
    await runtime.execute(nuxtContext('form-submit', admin, { category: 'news', city: 'Cairo', mutation: 'create', slug: 'created-post', title: 'Created post' }))
    await runtime.execute(nuxtContext('form-submit', admin, { category: 'engineering', city: 'London', mutation: 'update', record: 'created-post', slug: 'edited-post', title: 'Edited post' }))
    await runtime.execute(nuxtContext('form-submit', admin, { mutation: 'delete', record: 'edited-post' }))
    await expect(runtime.execute(nuxtContext('form-submit', denied, { category: 'news', city: 'Cairo', mutation: 'create', slug: 'denied', title: 'Denied' }))).rejects.toMatchObject({ code: 'access-denied' })
    await expect(runtime.execute(nuxtContext('form-submit', admin, { mutation: 'create', title: 'secret stack marker' }))).rejects.toMatchObject({ statusCode: 422 })
    expect(records.some(record => record.slug === 'edited-post')).toBe(false)
  })

  it('executes SvelteKit list filters, view, CRUD, dependencies, policy denial, and safe validation through the exported registry', async () => {
    const modelPath = new URL('../../../apps/example-sveltekit/server/models/Post.ts', import.meta.url).href
    const records = await mockPersistence(modelPath)
    await configureTestDatabase()
    const fixture = svelteKitPanelAcceptanceFixture
    const registry = await fixture.loadRegistry()
    const pageInput = (path: string, actor: SvelteActor = svelteAdmin): PanelPageResolutionInput<SvelteActor> => ({
      event: svelteEvent(path),
      holo: { getProject: async () => ({}) } as PanelPageResolutionInput<SvelteActor>['holo'],
      panelId: 'admin',
      parameters: {},
      path: new URL(path, 'https://panels.test').pathname,
      scope: svelteScope(actor),
    })
    const list = await registry.resolvePage(pageInput('/admin/posts?search=first'))
    expect(list.data.filters).toEqual({ search: 'first' })
    expect(list.data.records).toEqual([expect.objectContaining({ title: 'First post' })])
    const view = await registry.resolvePage(pageInput('/admin/posts/first-post'))
    expect(view.data).toMatchObject({ record: { slug: 'first-post' } })
    const operation = registry.operations?.['form-submit']
    const invoke = (actor: SvelteActor, payload: JsonObject): Promise<unknown> => {
      const event = svelteEvent('/_holo/panels/admin/form-submit')
      const input: PanelOperationInput<SvelteActor> = { event, holo: {} as PanelOperationInput<SvelteActor>['holo'], operation: 'form-submit', panelId: 'admin', payload, scope: svelteScope(actor) }
      return Promise.resolve(operation?.(input))
    }
    await invoke(svelteAdmin, { intent: 'create', resourceId: 'posts', values: { category: 'news', city: 'Cairo', slug: 'Created Post', title: 'Created Post' } })
    expect(records.some(record => record.slug === 'created-post')).toBe(true)
    await invoke(svelteAdmin, { intent: 'update', recordId: 'created-post', resourceId: 'posts', values: { category: 'engineering', city: 'London', slug: 'Edited Post', title: 'Edited Post' } })
    await registry.operations?.action?.({ event: svelteEvent('/_holo/panels/admin/action'), holo: {} as PanelOperationInput['holo'], operation: 'action', panelId: 'admin', payload: { actionId: 'posts.delete', input: {}, recordIds: ['edited-post'], resourceId: 'posts' }, scope: svelteScope(svelteAdmin) })
    await expect(invoke(svelteDenied, { intent: 'create', resourceId: 'posts', values: { category: 'news', city: 'Cairo', slug: 'denied', title: 'Denied' } })).rejects.toMatchObject({ code: 'access-denied' })
    await expect(invoke(svelteAdmin, { intent: 'create', resourceId: 'posts', values: { category: 'engineering', city: 'New York', slug: 'invalid-city', title: 'private implementation detail' } })).rejects.toMatchObject({ status: 422 })
    expect(records.some(record => record.slug === 'edited-post')).toBe(false)
  })
})
