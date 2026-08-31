import { expect, it } from 'vitest'
import { WidgetStore } from '../src/widgets/store'
import { WidgetTableController } from '../src/widgets/table'
import { createWidgetRuntime } from '../src/widgets/runtime'
import { PanelsTransport } from '../src/transport'

it('presents the effective initial query in its shared controls', () => {
  const manifest = { filters: [], id: 'recent', layout: { columnSpan: 1, columnStart: null }, lazy: false, polling: { enabled: false, interval: null } }
  const result = { status: 'ready' as const, data: { tableId: 'posts', result: { records: [{ id: 'second' }], total: 10, query: { page: 2, perPage: 5, search: 'Post', sort: [{ column: 'title', direction: 'desc' }], filters: { category: 'news' }, grouping: { column: 'category', direction: 'asc' } }, resource: { id: 'posts', table: { filterMode: 'deferred', columns: [{ path: 'title', type: 'text', label: 'Title' }] } } } } }
  const widget = new WidgetStore(manifest, async () => result, { initialResult: result })
  const table = new WidgetTableController(widget, { panelId: 'admin', request: () => ({}), execute: async () => ({}) })
  expect(table.presentation!.store.snapshot).toMatchObject({ page: 2, perPage: 5, search: 'Post', sort: [{ column: 'title', direction: 'desc' }], filters: { applied: { category: 'news' }, draft: { category: 'news' } }, grouping: { column: 'category', direction: 'asc' } })
  table.dispose()
})

it('resumes table synchronization and actions after an effect cleanup and restart', async () => {
  const manifest = { family: 'table' as const, filters: [], id: 'recent', layout: { columnSpan: 1, columnStart: null }, lazy: false, polling: { enabled: false, interval: null } }
  let records = [{ id: 'first' }]
  const data = () => ({ tableId: 'posts', result: { records, total: 2, resource: { id: 'posts', table: { columns: [{ path: 'id', type: 'text', label: 'ID' }] } } } })
  const signals: AbortSignal[] = []
  const transport = new PanelsTransport({ createId: () => 'widget-response', csrfProvider: { getField: () => ({ name: '_token', value: 'csrf-token' }) }, adapter: { async send(request) {
    if (request.signal) signals.push(request.signal)
    return { body: { data: request.url.endsWith('/action') ? {} : { data: data(), status: 'ready' }, effects: [], id: 'widget-response', ok: true, protocolVersion: '1.0' }, status: 200 }
  } } })
  const runtime = createWidgetRuntime({ applyEffects: () => undefined, panelId: 'admin', transport, widget: { data: data(), manifest, status: 'ready' } })
  runtime.dispose()
  runtime.start()
  records = [{ id: 'second' }]
  await runtime.store.load()
  expect(runtime.table!.presentation!.store.snapshot.records).toEqual(records)
  await runtime.table!.presentation!.actionTransport.execute({ actionId: 'queue', mount: 'bulk', selection: { mode: 'explicit', recordIds: ['second'] } }, new AbortController().signal)
  expect(signals.every(signal => !signal.aborted)).toBe(true)
  runtime.dispose()
})

it('retains shared table selection and query state across widget polling', async () => {
  const manifest = { filters: [], id: 'recent', layout: { columnSpan: 1, columnStart: null }, lazy: false, polling: { enabled: false, interval: null } }
  let records = [{ id: 'one', title: 'First' }]
  const result = () => ({ status: 'ready' as const, data: { tableId: 'posts', result: { records, total: 2, resource: { id: 'posts', routeKey: 'id', labels: { plural: 'Posts' }, table: { columns: [{ path: 'title', type: 'text', label: 'Title' }] } } } } })
  const widget = new WidgetStore(manifest, async () => result(), { initialResult: result() })
  const table = new WidgetTableController(widget, { panelId: 'admin', request: () => ({ pageId: 'overview', widgetId: 'recent' }), execute: async () => ({}) })
  const state = table.presentation!.store
  state.selectRecord('one', true)
  state.setPage(2)
  records = [{ id: 'two', title: 'Second' }]
  await widget.load()
  expect(table.presentation!.store).toBe(state)
  expect(state.snapshot).toMatchObject({ page: 2, records: [{ id: 'two' }], selection: { selectedRecordIds: ['one'] } })
  expect(table.query).toMatchObject({ page: 2, selection: { mode: 'explicit', recordIds: ['one'] } })
  table.dispose()
})

it('clears removed grouping and preserves unapplied filter edits during polling', async () => {
  const manifest = { filters: [], id: 'recent', layout: { columnSpan: 1, columnStart: null }, lazy: false, polling: { enabled: false, interval: null } }
  let grouped = true
  const result = () => ({ status: 'ready' as const, data: { tableId: 'posts', result: { records: [{ id: 'one' }], total: 1, query: { grouping: grouped ? { column: 'category', direction: 'asc' } : null, filters: { status: 'active', category: 'news' } }, resource: { id: 'posts', table: { filterMode: 'deferred', columns: [{ path: 'id', type: 'text' }] } } } } })
  const widget = new WidgetStore(manifest, async () => result(), { initialResult: result() })
  const table = new WidgetTableController(widget, { panelId: 'admin', request: () => ({}), execute: async () => ({}) })
  table.presentation!.store.setFilter('category', 'draft')
  grouped = false
  await widget.load()
  expect(table.presentation!.store.snapshot).toMatchObject({ grouping: null, filters: { applied: { category: 'news', status: 'active' }, draft: { category: 'draft', status: 'active' } } })
  table.dispose()
})
