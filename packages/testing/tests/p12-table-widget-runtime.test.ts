import { describe, expect, it } from 'vitest'
import { column, configureDB, createAdapter, createConnectionManager, createDialect, createSchemaService, DB, defineGeneratedTable, defineModel, registerDatabaseDriverFactory, resetDB } from '@holo-js/db'
import { sqliteDatabaseDriverFactory } from '@holo-js/db-sqlite'
import { definePolicy } from '@holo-js/authorization'
import { definePanel, defineCustomPage, defineTableWidget, type JsonObject } from '@holo-js/panels-core'
import { executeWidgetDataOperation, resolvePageWidgetGroup, executeWidgetTableOperation } from '@holo-js/panels-core/server'
import { WidgetStore, WidgetTableController } from '@holo-js/panels-client'

describe('registered table widgets', () => {
  it('uses the resource query, record authorization and client-safe table manifest for initial and refreshed data', async () => {
    registerDatabaseDriverFactory(sqliteDatabaseDriverFactory)
    const manager = createConnectionManager({ defaultConnection: 'default', connections: { default: { adapter: createAdapter('sqlite', { database: ':memory:' }), dialect: createDialect('sqlite') } } })
    configureDB(manager)
    await manager.initializeAll()
    try {
      await createSchemaService(DB.connection()).createTable('widget_posts', table => { table.string('id').primaryKey(); table.string('title'); table.string('tenantId') })
      const model = defineModel(defineGeneratedTable('widget_posts', { id: column.string().primaryKey(), title: column.string(), tenantId: column.string() }), { timestamps: false, guarded: [] })
      await model.create({ id: 'first', title: 'First post', tenantId: 'one' })
      await model.create({ id: 'second', title: 'Second post', tenantId: 'one' })
      await model.create({ id: 'foreign', title: 'Foreign post', tenantId: 'two' })
      definePolicy('widget-posts', model, { class: { viewAny: () => true }, record: { view: (_context, record) => record.id !== 'hidden' } })
      const resource = {
        actions: [{ authorize: () => true, bulk: { fetchRecords: false }, handle: (_input: object, scope: { readonly selectedRecordIds: readonly (number | string)[] }) => ({ queued: [...scope.selectedRecordIds] }), id: 'queue', kind: 'custom', label: 'Queue', mount: 'bulk', source: 'table', transactional: false }],
        baseQuery: (query: ReturnType<typeof model.query>) => query.where('tenantId', '=', 'one'),
        id: 'posts', kind: 'resource', model, routeKey: 'id', shared: true, singular: null,
        table: { columns: [{ path: 'title', type: 'text', label: 'Title', searchable: true, sortable: true }], serverColumns: [{ path: 'title', searchable: true, sortable: true }] },
      }
      let allowed = true
      let boundQuery: JsonObject = {}
      const definition = defineTableWidget('recent').table({ compile: () => resource }).authorize(() => allowed).compile()
      const widget = { ...definition, server: { ...definition.server, table: { resource: () => resource, query: () => boundQuery } } }
      const panel = definePanel('admin').compile()
      const page = defineCustomPage('overview').headerWidgets('recent').compile()
      const context = { actor: {}, locale: 'en', panelId: 'admin', services: undefined, signal: new AbortController().signal, tenant: 'one' }
      const request = { pageId: 'overview', widgetId: 'recent' }
      const registry = { 'admin:page:overview': async () => page, 'admin:widget:recent': async () => widget, 'admin:resource:posts': async () => ({ ...resource, baseQuery: (query: ReturnType<typeof model.query>) => query }) }
      const initial = await resolvePageWidgetGroup(['recent'], [widget], context, null, 'header', { pageId: 'overview' }, {}, panel)
      expect(initial[0]).toMatchObject({ status: 'ready', data: { tableId: 'posts', result: { records: [{ id: 'first' }, { id: 'second' }], resource: { id: 'posts', table: { columns: [{ path: 'title' }] } } } } })
      expect(JSON.stringify(initial)).not.toMatch(/Foreign post|Hidden post|baseQuery|serverColumns/)
      const store = new WidgetStore(definition.manifest, async () => {
        const refreshed = await executeWidgetDataOperation(registry, { ...request, widgetTableQuery: controller.query }, context, panel)
        if (refreshed.status !== 'ready') throw new Error('Widget did not resolve')
        return { status: 'ready', data: refreshed.data ?? null }
      }, { initialResult: { status: 'ready', data: initial[0]!.data } })
      const controller = new WidgetTableController(store, { panelId: 'admin', request: () => request, execute: async (_operation, payload) => (await executeWidgetTableOperation(registry, 'action', payload, context, panel)).data })
      controller.presentation!.store.setSearch('Second')
      await store.load()
      expect(store.snapshot.status).toBe('ready')
      expect(controller.presentation!.store.snapshot.records).toMatchObject([{ id: 'second' }])
      boundQuery = { search: 'First' }
      await store.load()
      expect(controller.presentation!.store.snapshot).toMatchObject({ search: 'First', records: [{ id: 'first' }] })
      controller.presentation!.store.selectAllMatching()
      const selectedAction = { widgetTable: request, actionId: 'queue', mount: 'bulk', resourceId: 'posts', source: 'table', tableQuery: controller.query, selection: controller.query.selection! }
      expect((await executeWidgetTableOperation(registry, 'action', selectedAction, context, panel)).data).toMatchObject({ items: [{ recordId: 'first', result: { queued: ['first'] } }] })
      await expect(executeWidgetTableOperation(registry, 'action', { ...selectedAction, selection: { mode: 'all-matching', query: { search: '' }, excludedRecordIds: [] } }, context, panel)).rejects.toThrow('selection scope changed')
      boundQuery = { search: '' }
      await expect(executeWidgetTableOperation(registry, 'action', selectedAction, context, panel)).rejects.toThrow('selection scope changed')
      await store.load()
      expect(store.snapshot.status).toBe('ready')
      expect(controller.presentation!.store.snapshot.records).toHaveLength(2)
      expect(controller.presentation!.store.selectedCount).toBe(0)
      controller.dispose()
      boundQuery = {}
      await expect(executeWidgetDataOperation(registry, { ...request, widgetTableQuery: { intent: 'relation', managerId: 'comments', ownerId: 'foreign' } }, context, panel)).rejects.toThrow('query field')
      const action = { widgetTable: request, actionId: 'queue', mount: 'bulk', recordIds: ['first', 'foreign'], resourceId: 'posts', source: 'table' }
      expect((await executeWidgetTableOperation(registry, 'action', action, context, panel)).data).toMatchObject({ status: 'partial', items: [{ recordId: 'first', result: { queued: ['first'] }, status: 'succeeded' }, { recordId: 'foreign', status: 'denied' }] })
      await expect(executeWidgetTableOperation(registry, 'action', { ...action, resourceId: 'users' }, context, panel)).rejects.toThrow('does not belong')
      await model.create({ id: 'hidden', title: 'Hidden post', tenantId: 'one' })
      await expect(executeWidgetDataOperation(registry, request, context, panel)).rejects.toThrow()
      allowed = false
      expect(await executeWidgetDataOperation(registry, request, context, panel)).toMatchObject({ status: 'unauthorized', data: null })
      await expect(executeWidgetTableOperation(registry, 'action', action, context, panel)).rejects.toThrow('not available')
    } finally {
      await manager.disconnectAll()
      resetDB()
    }
  })
})

describe('table widget operation boundaries', () => {
  it('rejects unregistered widget pages before resource lookup', async () => {
    const panel = definePanel('admin').compile()
    const context = { actor: {}, locale: 'en', panelId: 'admin', services: undefined, signal: new AbortController().signal, tenant: 'one' }
    await expect(executeWidgetTableOperation({}, 'action', { widgetTable: { pageId: 'private', widgetId: 'recent' }, resourceId: 'posts' }, context, panel)).rejects.toThrow('page is not registered')
  })
})
