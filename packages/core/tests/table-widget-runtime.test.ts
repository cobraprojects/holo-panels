import { describe, expect, it } from 'vitest'
import { column, configureDB, createAdapter, createConnectionManager, createDialect, createSchemaService, DB, defineGeneratedTable, defineModel, registerDatabaseDriverFactory, resetDB } from '@holo-js/db'
import { sqliteDatabaseDriverFactory } from '@holo-js/db-sqlite'
import { definePolicy } from '@holo-js/authorization'
import { definePanel } from '../src/panels'
import { defineCustomPage } from '../src/pages'
import { defineTableWidget } from '../src/widgets/builder'
import { executeWidgetDataOperation } from '../src/widgets/page-data'
import { resolvePageWidgetGroup } from '../src/widgets/page-widgets'
import { executeWidgetTableOperation } from '../src/widgets/table-operation'

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
      const definition = defineTableWidget('recent').authorize(() => allowed).compile()
      const widget = { ...definition, server: { ...definition.server, table: { resource: () => resource } } }
      const panel = definePanel('admin').compile()
      const page = defineCustomPage('overview').headerWidgets('recent').compile()
      const context = { actor: {}, locale: 'en', panelId: 'admin', services: undefined, signal: new AbortController().signal, tenant: 'one' }
      const request = { pageId: 'overview', widgetId: 'recent' }
      const registry = { 'admin:page:overview': async () => page, 'admin:widget:recent': async () => widget, 'admin:resource:posts': async () => ({ ...resource, baseQuery: (query: ReturnType<typeof model.query>) => query }) }
      const refreshed = await executeWidgetDataOperation(registry, { ...request, widgetTableQuery: { search: 'Second' } }, context, panel)
      expect(refreshed).toMatchObject({ status: 'ready', data: { result: { records: [{ id: 'second' }] } } })
      const initial = await resolvePageWidgetGroup(['recent'], [widget], context, null, 'header', { pageId: 'overview' }, {}, panel)
      expect(initial[0]).toMatchObject({ status: 'ready', data: { tableId: 'posts', result: { records: [{ id: 'first' }, { id: 'second' }], resource: { id: 'posts', table: { columns: [{ path: 'title' }] } } } } })
      expect(JSON.stringify(initial)).not.toMatch(/Foreign post|Hidden post|baseQuery|serverColumns/)
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
