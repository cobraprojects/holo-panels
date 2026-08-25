import { TableStateStore } from '@holo-js/panels-client'
import type {
  TableAcceptanceActionRequest,
  TableAcceptanceFixture,
  TableAcceptanceInlineEditRequest,
  TableAcceptanceJourneyReport,
  TableAcceptanceModel,
} from './contracts'

const records: readonly Record<string, unknown>[] = [
  { author: { id: 10, name: 'Amina' }, id: 1, status: 'draft', title: 'Cairo Guide', version: 'v1' },
  { author: { id: 20, name: 'Omar' }, id: 2, status: 'published', title: 'Nile Guide', version: 'v2' },
]

function numberId(record: Readonly<Record<string, unknown>>): number {
  const id = record.id
  if (typeof id !== 'number') throw new Error('Acceptance record ID is not numeric')
  return id
}

function createModel(
  actionRequests: TableAcceptanceActionRequest[],
  inlineEditRequests: TableAcceptanceInlineEditRequest[],
  queryChanges: string[],
): TableAcceptanceModel {
  const store = new TableStateStore<Record<string, unknown>, number>({
    filterMode: 'deferred',
    panelId: 'admin',
    perPage: 2,
    records,
    tableId: 'posts',
    total: 6,
    visibleColumns: ['author.name', 'status', 'title'],
  })
  return {
    actionTransport: { execute: async request => { actionRequests.push(request) } },
    actions: [
      { id: 'posts.export', label: 'Export', scope: 'header' },
      { id: 'posts.publish', label: 'Publish selected', scope: 'bulk' },
      { id: 'posts.view', label: 'View', scope: 'row' },
    ],
    caption: 'Posts',
    columns: [
      { manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: { action: 'posts.rename', kind: 'text-input' }, label: 'Title', path: 'title', sortable: true, toggleable: true, type: 'text', width: null, wrap: true } },
      { manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: 'Author', path: 'author.name', sortable: true, toggleable: true, type: 'text', width: null, wrap: false } },
      { manifest: { alignment: 'center', copyable: false, hidden: false, inlineEditor: null, label: 'Status', path: 'status', sortable: true, toggleable: true, type: 'badge', width: 120, wrap: false } },
    ],
    filters: [{
      manifest: { defaultValue: null, id: 'author_id', label: 'Author', properties: { relationship: 'author' }, type: 'relationship' },
      options: [{ label: 'All authors', value: null }, { label: 'Amina', value: 10 }, { label: 'Omar', value: 20 }],
    }],
    getRecordId: numberId,
    getRecordVersion: record => typeof record.version === 'string' ? record.version : undefined,
    groups: [{
      collapsed: false,
      collapsible: true,
      key: 'draft',
      records: [records[0] as Record<string, unknown>],
      summaries: [{ id: 'draft-count', label: 'Draft count', value: 1 }],
      title: 'Draft posts',
    }],
    inlineEditTransport: { execute: async request => { inlineEditRequests.push(request) } },
    onQueryChange: () => { queryChanges.push(store.toQueryString()) },
    store,
    summaries: [{ id: 'total-posts', label: 'Total posts', value: 6 }],
  }
}

export async function runTableAcceptanceJourney(fixture: TableAcceptanceFixture): Promise<TableAcceptanceJourneyReport> {
  const actionRequests: TableAcceptanceActionRequest[] = []
  const inlineEditRequests: TableAcceptanceInlineEditRequest[] = []
  const queryChanges: string[] = []
  const table = createModel(actionRequests, inlineEditRequests, queryChanges)
  const render = await fixture.render(table)
  const driver = await fixture.mount(table)
  try {
    await driver.input('.hp-table-toolbar input[type="search"]', 'nile')
    await driver.sync(() => { table.store.applyData({ queryVersion: table.store.snapshot.queryVersion, records, total: 6 }) })
    await driver.select('.hp-table-filters select', '20')
    await driver.click('.hp-table-filters button[type="submit"]')
    await driver.sync(() => { table.store.applyData({ queryVersion: table.store.snapshot.queryVersion, records, total: 6 }) })
    await driver.click('th[aria-sort] button')
    await driver.sync(() => { table.store.applyData({ queryVersion: table.store.snapshot.queryVersion, records, total: 6 }) })
    await driver.click('.hp-column-manager')
    await driver.toggleColumn('Status')
    await driver.click('[aria-label="Select page"]')
    await driver.clickText('Select all 6 matching records')
    const markupAfterSelection = driver.markup()
    await driver.clickText('Publish selected')
    await Promise.resolve()
    await driver.click('button[aria-label="Edit Title"]')
    await driver.input('input[aria-label="Title"]', 'Renamed from acceptance')
    await driver.keydown('input[aria-label="Title"]', 'Enter')
    await Promise.resolve()
    await driver.click('.hp-table-group button')
    const collapsedGroupRows = (driver.markup().match(/data-label="Title"/gu) ?? []).length
    await driver.sync(() => { table.store.applyData({ queryVersion: table.store.snapshot.queryVersion, records, total: 6 }) })
    await driver.click('button[aria-label="Next page"]')
    return {
      actionRequests,
      collapsedGroupRows,
      columnVisibility: table.store.snapshot.visibleColumns,
      filter: table.store.snapshot.filters.applied.author_id,
      framework: fixture.framework,
      inlineEditRequests,
      markupAfterSelection,
      page: table.store.snapshot.page,
      render,
      search: table.store.snapshot.search,
      selectionMode: table.store.snapshot.selection.mode,
      sort: table.store.snapshot.sort,
    }
  } finally {
    await driver.dispose()
  }
}
