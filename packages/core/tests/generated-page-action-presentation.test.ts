import { describe, expect, it, vi } from 'vitest'
import { definePanel } from '../src/panels'
import type { ActionPresentationContext } from '../src/actions'
import { resolvePageData } from '../src/pages'
import { createGeneratedResourcePage, executeGeneratedResourceOperation, generatedResourcePageManifests } from '../src/resources/generated-pages'

describe('generated page action presentation', () => {
  it('executes all-matching bulk selection using scoped route keys and exclusions', async () => {
    const records = [{ id: 1, slug: 'first', tenantId: 'one' }, { id: 2, slug: 'excluded', tenantId: 'one' }, { id: 3, slug: 'foreign', tenantId: 'two' }].map(value => ({ ...value, toJSON: () => value }))
    type RecordValue = (typeof records)[number]
    class Query {
      private values = [...records]
      where(key: keyof RecordValue, operatorOrValue: unknown, value?: unknown): this { this.values = this.values.filter(record => record[key] === (value ?? operatorOrValue)); return this }
      whereNotIn(key: keyof RecordValue, excluded: readonly unknown[]): this { this.values = this.values.filter(record => !excluded.includes(record[key])); return this }
      async count(): Promise<number> { return this.values.length }
      limit(): this { return this }
      orderBy(): this { return this }
      async get(): Promise<readonly RecordValue[]> { return this.values }
      async first(): Promise<RecordValue | null> { return this.values[0] ?? null }
    }
    const executed: string[] = []
    const resource = { actions: [{ authorize: () => true, handle: (_input: object, { record }: { record: RecordValue }) => { executed.push(record.slug) }, id: 'publish', kind: 'custom', label: 'Publish', mount: 'bulk', source: 'table', transactional: false }], baseQuery: (query: Query) => query.where('tenantId', 'one'), id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => new Query() }, routeKey: 'slug', shared: true, singular: null, table: { columns: [], serverColumns: [] } }
    const result = await executeGeneratedResourceOperation(resource, { context: { actor: {}, signal: new AbortController().signal, tenant: null }, operation: 'action', panelId: 'admin', payload: { actionId: 'publish', idempotencyKey: 'all-matching', input: {}, mount: 'bulk', resourceId: 'posts', selection: { mode: 'all-matching', excludedRecordIds: ['excluded'], query: {} }, source: 'table' } })
    expect(result.data.status).toBe('succeeded')
    expect(executed).toEqual(['first'])
  })
  it('requires ancestor and built-in operation permissions at execution', async () => {
    const handle = vi.fn(() => null)
    const child = { authorize: () => true, handle, id: 'child', kind: 'custom', label: 'Child', mount: 'page', transactional: false }
    const parent = { ...child, id: 'parent', modal: { nestedActions: ['child'] }, nestedActions: [child], source: 'list' }
    const resource = { actions: [parent], baseQuery: (query: object) => query, id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => ({}) }, shared: true, writableAttributes: [] }
    let denied = 'actions.parent.view'
    const checked: string[] = []
    const panel = definePanel('admin', Object).plugin({
      id: 'shield', packageName: '@holo-js/panels-shield', compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } },
      install: () => ({ id: 'shield', contributions: [], permissionNamespace: 'admin', authorizationLayer: { id: 'shield', authorize: async ({ permission }) => { checked.push(permission); if (permission === denied) throw new Error('Shield denied') } } }),
    }).compile()
    const input = { context: { actor: {}, signal: new AbortController().signal, tenant: null }, operation: 'action' as const, panel, panelId: 'admin', payload: { actionId: 'child', idempotencyKey: 'nested-permission', input: {}, mount: 'page', resourceId: 'posts', source: 'list' } }
    await expect(executeGeneratedResourceOperation(resource, input)).rejects.toThrow('Shield denied')
    expect(handle).not.toHaveBeenCalled()
    denied = 'posts.create'
    const creating = { ...child, id: 'create', kind: 'create', source: 'list', usesDefaultHandler: false }
    await expect(executeGeneratedResourceOperation({ ...resource, actions: [creating] }, { ...input, payload: { ...input.payload, actionId: 'create' } })).rejects.toThrow('Shield denied')
    expect(checked).toContain('posts.create')
    expect(handle).not.toHaveBeenCalled()
  })
  it('rejects an unregistered legacy deletion even when the resource supports deletion', async () => {
    const remove = vi.fn()
    const record = { id: 7, delete: remove, toJSON: () => ({ id: 7 }) }
    const query = { where: () => query, first: async () => record }
    const resource = { actions: [], baseQuery: (value: typeof query) => value, capabilities: { delete: true }, id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query }, shared: true }
    await expect(executeGeneratedResourceOperation(resource, { context: { actor: {}, signal: new AbortController().signal, tenant: null }, operation: 'action', panelId: 'admin', payload: { actionId: 'delete-record', intent: 'delete', recordId: 7, resourceId: 'posts' } })).rejects.toThrow('not registered')
    expect(remove).not.toHaveBeenCalled()
  })
  it('uses the resource form for simple-resource create and row edit modals', async () => {
    const record = { id: 7, title: 'Draft', toJSON: () => ({ id: 7, title: 'Draft' }) }
    const query = { orderBy: () => query, paginate: async () => ({ data: [record], meta: { currentPage: 1, hasMorePages: false, lastPage: 1, perPage: 25, total: 1 } }) }
    const resource = {
      actions: ['create', 'edit'].map(kind => ({ authorize: () => true, handle: () => undefined, id: kind, kind, label: kind, mount: kind === 'create' ? 'page' : 'record', source: 'table' })),
      baseQuery: (value: typeof query) => value,
      form: { fields: [{ kind: 'field', label: 'Title', path: 'title', properties: {}, required: true, type: 'text' }] },
      id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query },
      pages: [{ actions: [], pageType: 'list', path: '/' }], routeKey: 'id', shared: true, table: { actions: [{ id: 'create', scope: 'header' }, { id: 'edit', scope: 'row' }], columns: [] }, writableAttributes: ['title'],
    }
    const manifest = generatedResourcePageManifests({ panelPath: '/admin', resource })[0]!
    const result = await resolvePageData(createGeneratedResourcePage(resource, manifest), { actor: {}, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal: new AbortController().signal, tenant: null })
    expect(result.data.tableActions).toMatchObject([{ id: 'create', modal: { schema: { fields: [{ kind: 'field', path: 'title', required: true }] } } }, { id: 'edit' }])
    expect(result.data.rowActions).toMatchObject([{ actions: [{ id: 'create' }, { id: 'edit', modal: { schema: { fields: [{ defaultValue: 'Draft', path: 'title' }] } } }], recordId: 7 }])
  })
  it('submits registered form actions with input and rejects omitted form actions', async () => {
    const saved: string[] = []
    const action = { authorize: (_context: object, input: { title: string }) => input.title !== 'denied', handle: (input: { title: string }) => { saved.push(input.title); return { record: { id: 9, title: input.title } } }, id: 'save', kind: 'custom', label: 'Save', mount: 'page', source: 'create:form', transactional: false }
    const resource = { actions: [action], baseQuery: (query: object) => query, id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => ({}) }, pages: [{ actions: [], pageType: 'create', path: '/create' }], shared: true, singular: null, writableAttributes: ['title'] }
    const input = { context: { actor: {}, signal: new AbortController().signal, tenant: null }, operation: 'form-submit' as const, panelId: 'admin', payload: { actionId: 'save', idempotencyKey: 'save-form', resourceId: 'posts', title: 'Draft' } }
    const result = await executeGeneratedResourceOperation(resource, input)
    expect(result.data).toMatchObject({ record: { id: 9, title: 'Draft' }, status: 'succeeded' })
    expect(saved).toEqual(['Draft'])
    await expect(executeGeneratedResourceOperation(resource, { ...input, payload: { ...input.payload, idempotencyKey: 'denied-save', title: 'denied' } })).rejects.toThrow('not authorized')
    await expect(executeGeneratedResourceOperation({ ...resource, actions: [] }, input)).rejects.toThrow('not registered')
  })

  it('deduplicates resource action retries across requests and rechecks current authorization', async () => {
    let executions = 0
    let allowed = true
    const action = { authorize: () => allowed, handle: () => ++executions, id: 'publish', kind: 'custom', label: 'Publish', mount: 'page', source: 'list', transactional: false }
    const resource = { actions: [action], baseQuery: (query: object) => query, id: 'posts', kind: 'resource', model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => ({}) }, shared: true, singular: null, writableAttributes: [] }
    const request = () => ({ context: { actor: { id: 'editor' }, signal: new AbortController().signal, tenant: null }, operation: 'action' as const, panelId: 'admin', payload: { actionId: 'publish', idempotencyKey: 'same-request', input: {}, mount: 'page', resourceId: 'posts', source: 'list' } })
    expect((await executeGeneratedResourceOperation(resource, request())).data.result).toBe(1)
    expect((await executeGeneratedResourceOperation(resource, request())).data.result).toBe(1)
    expect(executions).toBe(1)
    allowed = false
    await expect(executeGeneratedResourceOperation(resource, request())).rejects.toThrow('not authorized')
  })

  it('reauthorizes a navigation action through its lifecycle without creating a record', async () => {
    const events: string[] = []
    const action = { authorize: () => { events.push('authorize'); return true }, handle: () => { events.push('handle') }, id: 'create', kind: 'create', label: 'Create', lifecycle: { before: () => { events.push('before') }, after: () => { events.push('after') } }, mount: 'page', source: 'list', transactional: false }
    const resource = {
      actions: [action], baseQuery: (query: object) => query, capabilities: { create: true }, id: 'posts', kind: 'resource', lifecycle: {},
      model: { create: () => { throw new Error('Navigation must not persist records') }, definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => ({}) },
      pages: [{ actions: [], pageType: 'list', path: '/' }, { actions: [], pageType: 'create', path: '/create' }], shared: true, singular: null, slug: 'posts', writableAttributes: [],
    }
    const input = { context: { actor: {}, signal: new AbortController().signal, tenant: null }, operation: 'action' as const, panelId: 'admin', payload: { actionId: 'create', idempotencyKey: 'create-link', input: {}, mount: 'page', resourceId: 'posts', source: 'list' } }
    const result = await executeGeneratedResourceOperation(resource, input)
    expect(result.effects).toContainEqual({ kind: 'redirect', url: '/admin/posts/create' })
    expect(events).toEqual(['authorize', 'before', 'handle', 'after'])
    await expect(executeGeneratedResourceOperation({ ...resource, actions: [{ ...action, authorize: () => false }] }, input)).rejects.toThrow('not authorized')
    await expect(executeGeneratedResourceOperation({ ...resource, actions: [] }, input)).rejects.toThrow('not registered')
  })

  it('resolves table header and bulk presentation without a record', async () => {
    const action = {
      authorize: () => true,
      disabled: () => true,
      handle: () => null,
      icon: () => 'check',
      id: 'publish',
      kind: 'custom',
      label: ({ actor, record }: { actor: { name: string }, record: object | null }) => `${actor.name}: ${record === null ? 'all posts' : 'one post'}`,
      modal: { heading: () => 'Publish posts' },
      mount: 'page',
      source: 'table',
      visible: () => false,
    }
    const query = {
      orderBy: () => query,
      paginate: async () => ({ data: [], meta: { currentPage: 1, hasMorePages: false, lastPage: 1, perPage: 25, total: 0 } }),
    }
    const resource = {
      actions: [action, { ...action, id: 'publish-many', mount: 'bulk' }],
      baseQuery: (value: typeof query) => value,
      id: 'posts',
      kind: 'resource',
      model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query },
      pages: [{ actions: [], pageType: 'list', path: '/' }],
      shared: true,
      table: { actions: [{ id: 'publish', scope: 'header' }, { id: 'publish-many', scope: 'bulk' }], columns: [] },
    }
    const manifest = generatedResourcePageManifests({ panelPath: '/admin', resource })[0]!
    const result = await resolvePageData(createGeneratedResourcePage(resource, manifest), {
      actor: { name: 'Ada' }, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal: new AbortController().signal, tenant: null,
    })
    expect(result.data.tableActions).toMatchObject([
      { disabled: true, icon: 'check', id: 'publish', label: 'Ada: all posts', modal: { heading: 'Publish posts' }, mount: 'page', scope: 'header', visible: false },
      { disabled: true, id: 'publish-many', mount: 'bulk', scope: 'bulk', visible: false },
    ])
  })

  it('resolves each row action against its authorized model instance', async () => {
    const record = { id: 7, title: 'Draft', toJSON: () => ({ id: 7, title: 'Draft' }) }
    const query = { orderBy: () => query, paginate: async () => ({ data: [record], meta: { currentPage: 1, hasMorePages: false, lastPage: 1, perPage: 25, total: 1 } }) }
    const resource = {
      actions: [{ authorize: () => true, handle: () => null, id: 'publish', kind: 'custom', label: ({ record: current }: { record: typeof record }) => `Publish ${current.toJSON().title}`, mount: 'record', source: 'table' }],
      baseQuery: (value: typeof query) => value,
      id: 'posts', kind: 'resource',
      model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query },
      pages: [{ actions: [], pageType: 'list', path: '/' }], shared: true,
      table: { actions: [{ id: 'publish', scope: 'row' }], columns: [] },
    }
    const manifest = generatedResourcePageManifests({ panelPath: '/admin', resource })[0]!
    const result = await resolvePageData(createGeneratedResourcePage(resource, manifest), { actor: {}, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal: new AbortController().signal, tenant: null })
    expect(result.data.rowActions).toEqual([{ recordId: 7, actions: [expect.objectContaining({ id: 'publish', label: 'Publish Draft', mount: 'record', scope: 'row' })] }])
  })

  it.each(['create', 'list'] as const)('resolves %s page callbacks for the requesting actor without serializing server callbacks', async (pageType) => {
    const label = vi.fn(({ actor, data, record }: ActionPresentationContext<object, { title: string }, { name: string }, null, object>) => {
      expect(record).toBeNull()
      expect(data).toBeUndefined()
      return `Create for ${actor.name}`
    })
    const action = {
      authorize: () => true,
      color: 'success',
      disabled: () => true,
      handle: () => null,
      icon: 'plus',
      id: 'create-post',
      kind: 'custom',
      label,
      modal: { heading: ({ actor }: { actor: { name: string } }) => `New post for ${actor.name}` },
      mount: 'page',
      source: pageType,
      visible: () => false,
    }
    const query = {
      orderBy: () => query,
      paginate: async () => ({ data: [], meta: { currentPage: 1, hasMorePages: false, lastPage: 1, perPage: 25, total: 0 } }),
    }
    const resource = {
      actions: [action, { ...action, label: 'Bulk create', mount: 'bulk' }],
      baseQuery: (value: typeof query) => value,
      form: { fields: [] },
      id: 'posts',
      kind: 'resource',
      model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query },
      pages: [{
        actions: {
          footer: [],
          header: [{ manifest: () => ({
            buttonStyle: 'link',
            extraAttributes: { 'data-custom': 'kept' },
            iconPosition: 'after',
            id: action.id,
            kind: action.kind,
            label: 'Create post',
            mount: 'page',
            scope: 'header',
            url: '/posts',
            urlInNewTab: true,
          }) }],
        },
        pageType,
        path: pageType === 'create' ? '/create' : '/',
      }],
      shared: true,
      table: { columns: [] },
    }
    const [manifest] = generatedResourcePageManifests({ panelPath: '/admin', resource })
    if (!manifest) throw new Error('Expected a generated page')
    const page = createGeneratedResourcePage(resource, manifest)
    const result = await resolvePageData(page, {
      actor: { name: 'Ada' },
      locale: 'en',
      panelId: 'admin',
      parameters: {},
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })
    expect(result.manifest.body?.properties.resource).toMatchObject({
      actions: [{
        buttonStyle: 'link',
        disabled: true,
        extraAttributes: { 'data-custom': 'kept' },
        iconPosition: 'after',
        label: 'Create for Ada',
        modal: { heading: 'New post for Ada' },
        mount: 'page',
        scope: 'header',
        url: '/posts',
        urlInNewTab: true,
        visible: false,
      }],
    })
    expect(label).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toContain('authorize')
    expect(manifest.body?.properties.resource).not.toEqual(result.manifest.body?.properties.resource)
  })
})
