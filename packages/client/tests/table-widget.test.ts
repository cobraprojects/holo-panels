import { expect, it } from 'vitest'
import { WidgetStore } from '../src/widgets/store'
import { WidgetTableController } from '../src/widgets/table'

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
