import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TableStateStore, type FilterCollectionPresentation } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, hydrate, mount, unmount } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SvelteTableColumn, SvelteTableRendererProps, SvelteTableStore } from '../src/tables/types'
import { SvelteComponentRegistry } from '../src/registry'
import P7GTableFixture from './P7GTableFixture.svelte'
import P7GRatingFilter from './P7GRatingFilter.svelte'
import P7GFilterSlot from './P7GFilterSlot.svelte'

interface Post extends Record<string, unknown> {
  readonly id: number
  readonly status: string
  readonly title: string
  readonly version: string
}

const records: readonly Post[] = [
  { id: 1, status: 'draft', title: 'First', version: 'v1' },
  { id: 2, status: 'published', title: 'Second', version: 'v2' },
]

const columns: readonly SvelteTableColumn<Post>[] = [
  {
    manifest: {
      alignment: 'start',
      copyable: false,
      hidden: false,
      inlineEditor: { action: 'posts.rename', kind: 'text-input' },
      label: 'Title',
      path: 'title',
      sortable: true,
      toggleable: true,
      type: 'text',
      width: null,
      wrap: true,
    },
  },
  {
    manifest: {
      alignment: 'center',
      copyable: false,
      hidden: false,
      inlineEditor: null,
      label: 'Status',
      path: 'status',
      sortable: true,
      toggleable: true,
      type: 'badge',
      width: 120,
      wrap: false,
    },
  },
]

type TableProps = SvelteTableRendererProps<Post, number>
const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let ssrServer: ViteDevServer
let ServerFixture: Component<{ table: TableProps }>
let renderServer: typeof render
let flushClient: typeof flushSync
let hydrateClient: typeof hydrate
let mountClient: typeof mount
let unmountClient: typeof unmount

function createStore(options: { readonly filterMode?: 'deferred' | 'live', readonly perPage?: number, readonly records?: readonly Post[], readonly total?: number } = {}): TableStateStore<Post, number> {
  return new TableStateStore<Post, number>({
    filterMode: options.filterMode,
    panelId: 'admin',
    perPage: options.perPage,
    records: options.records ?? records,
    tableId: 'posts',
    total: options.total ?? 4,
    visibleColumns: ['status', 'title'],
  })
}

function baseTable(store: SvelteTableStore<Post, number>): TableProps {
  return {
    caption: 'Posts',
    columns,
    getRecordId: record => Number(record.id),
    getRecordVersion: record => typeof record.version === 'string' ? record.version : undefined,
    store,
  }
}

function filterPresentation(placement: FilterCollectionPresentation['placement']): FilterCollectionPresentation {
  const component = (id: string) => ({
    children: [], dynamicVisibility: false, extraAttributes: {}, id: `post-filters.filter-${id}`,
    key: `filter-${id}`, kind: 'filter' as const, layout: {},
    properties: { leaf: { definition: { id }, kind: 'filter' as const } }, slots: {},
    statePath: id, type: 'text', visible: true,
  })
  return {
    columns: { default: 1, md: 3 }, id: 'post-filters', placement,
    schema: { components: [component('status'), component('title')], id: 'post-filters', kind: 'schema' },
    slots: {
      after: [{ component: 'filters.after', order: 0, properties: {}, source: 'component' }],
      before: [{ component: 'filters.before', order: 0, properties: {}, source: 'component' }],
    },
  }
}

function mountTable(table: TableProps): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const component = mountClient(P7GTableFixture, { props: { table }, target: container })
  mounted.push({ component, container })
  flushClient()
  return container
}

function setInput(input: HTMLInputElement | null, value: string): void {
  if (!input) return
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  flushClient()
}

beforeAll(async () => {
  ssrServer = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p7g-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  const module = await ssrServer.ssrLoadModule('/tests/P7GTableFixture.svelte')
  ServerFixture = module.default as Component<{ table: TableProps }>
  const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const svelteClient = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  flushClient = svelteClient.flushSync as typeof flushSync
  hydrateClient = svelteClient.hydrate as typeof hydrate
  mountClient = svelteClient.mount as typeof mount
  unmountClient = svelteClient.unmount as typeof unmount
})

afterAll(async () => ssrServer?.close())

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await unmountClient(item.component)
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P7-G Svelte table renderer', () => {
  it('renders schema-ordered responsive modal filters with public before and after content', () => {
    const registry = new SvelteComponentRegistry()
    registry.register({ component: P7GFilterSlot, source: 'test', typeId: 'filters.before' })
    registry.register({ component: P7GFilterSlot, source: 'test', typeId: 'filters.after' })
    const container = mountTable({
      ...baseTable(createStore()),
      filterPresentation: filterPresentation('modal'),
      filters: [
        { manifest: { defaultValue: '', id: 'title', label: 'Title filter', properties: {}, type: 'text' } },
        { manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } },
      ],
      registry,
    })

    expect(container.querySelector('form[aria-label="Table filters"]')).toBeNull()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Filters')?.click()
    flushClient()
    const form = document.querySelector('form[aria-label="Table filters"]')
    expect(document.querySelector('[data-panels-component="modal"]')).not.toBeNull()
    expect(form?.getAttribute('data-filter-placement')).toBe('modal')
    expect(form?.getAttribute('style')).toContain('--hp-filter-columns-md: 3')
    expect(Array.from(form?.querySelectorAll('label') ?? []).map(label => label.textContent)).toEqual(['Status filter', 'Title filter'])
    expect(document.querySelector('[data-filter-slot="before"]')?.textContent).toBe('before filters')
    expect(document.querySelector('[data-filter-slot="after"]')?.textContent).toBe('after filters')
  })

  it('mounts an export action with configured format, columns, selection, and progress', async () => {
    const startExport = vi.fn(async () => ({ completed: 0, operationId: 'export-1', status: 'queued' as const, total: 4 }))
    const container = mountTable({
      ...baseTable(createStore()),
      transferTransport: { inspectImport: vi.fn(), startExport, startImport: vi.fn() },
      transfers: [{ columns: [{ id: 'title', label: 'Title', visibleByDefault: true }], formatIds: ['csv'], id: 'posts.export', kind: 'export', label: 'Export posts', maxRows: 100, resourceId: 'posts' }],
    })
    Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Export posts')?.click()
    flushClient()
    Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Start export')?.click()
    await Promise.resolve()
    flushClient()
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ columnIds: ['title'], definitionId: 'posts.export', formatId: 'csv', selection: { mode: 'explicit', recordIds: [] } }), expect.any(AbortSignal))
    expect(document.querySelector('[role="progressbar"][aria-label="Transfer progress"]')).not.toBeNull()
  })

  it('renders structured, extension, multi-select, and positioned filters without scalar fallback', () => {
    const store = createStore({ filterMode: 'live' })
    const registry = new SvelteComponentRegistry()
    registry.register({ component: P7GRatingFilter, source: 'test', typeId: 'filter.acme.filter.rating' })
    registry.register({ component: P7GRatingFilter, source: 'test', typeId: 'filter.custom' })
    const container = mountTable({
      ...baseTable(store),
      panelId: 'admin',
      registry,
      filters: [
        { manifest: { defaultValue: [], id: 'status', label: 'Status', layout: { columnSpan: { default: 2 }, columnStart: { default: 1 } }, properties: { multiple: true }, type: 'select' }, options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
        { manifest: { defaultValue: { conditions: [] }, id: 'advanced', label: 'Advanced', properties: { columns: [{ id: 'title', operators: ['=', 'like'], path: 'title', scalarType: 'string' }] }, type: 'advanced-query' } },
        { manifest: { defaultValue: { minimum: null }, id: 'custom', label: 'Custom', properties: { schema: { fields: [{ name: 'minimum', type: 'number' }] } }, type: 'custom' } },
        { manifest: { defaultValue: 1, id: 'rating', label: 'Rating', properties: {}, type: 'acme:filter:rating' } },
      ],
    })

    expect(container.querySelector('[data-filter-column-span]')?.getAttribute('data-filter-column-span')).toBe('{"default":2}')
    expect(container.querySelector('[data-filter-column-span]')?.getAttribute('data-filter-column-start')).toBe('{"default":1}')
    expect(container.querySelector<HTMLSelectElement>('select[multiple]')?.multiple).toBe(true)
    expect(container.querySelector('[data-custom-filter-schema]')).not.toBeNull()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Add condition')?.click()
    flushClient()
    expect(store.snapshot.filters.applied.advanced).toEqual({ conditions: [{ column: 'title', operator: '=', value: null }] })
    container.querySelector<HTMLButtonElement>('[data-rating-filter]')?.click()
    flushClient()
    expect(store.snapshot.filters.applied.rating).toBe(2)
  })

  it('renders a responsive semantic and accessible table contract', () => {
    const container = mountTable(baseTable(createStore()))
    const region = container.querySelector('[role="region"]')

    expect(container.querySelector('[data-panels-component="table"]')).not.toBeNull()
    expect(container.querySelector('table caption')?.textContent).toBe('Posts')
    expect(region?.getAttribute('aria-label')).toBe('Posts data')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(container.querySelector('th[scope="col"]')).not.toBeNull()
    expect(container.querySelector('td[data-label="Title"]')?.textContent).toBe('First')
    const statusCell = container.querySelector<HTMLElement>('td[data-label="Status"]')
    expect(statusCell?.style.width).toBe('120px')
    expect(statusCell?.style.whiteSpace).toBe('nowrap')
    expect(container.querySelector('input[aria-label="Select page"]')).toBeNull()
    expect(container.querySelector('nav[aria-label="Table pagination"]')).not.toBeNull()
  })

  it('renders deterministic accessible pagination and locks its controls while loading', () => {
    const store = createStore({ total: 250 })
    const container = mountTable(baseTable(store))

    store.setPage(5)
    flushClient()
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('loading')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Results per page"]')?.disabled).toBe(true)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.hp-table-pagination-pages button')).every(button => button.disabled)).toBe(true)

    store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 250 })
    flushClient()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.hp-table-pagination-pages button[aria-label^="Page "]')).map(button => button.textContent)).toEqual(['1', '4', '5', '6', '10'])
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('5')
    expect(container.querySelector('.hp-table-pagination-info')?.getAttribute('aria-live')).toBe('polite')
  })

  it('preserves arbitrary page sizes and supports legacy stores without page-size mutation', () => {
    const store = createStore({ perPage: 37, total: 250 })
    const container = mountTable(baseTable(store))
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Results per page"]')

    expect(select?.value).toBe('37')
    expect(Array.from(select?.options ?? []).map(option => option.value)).toContain('37')

    const legacyStore = new Proxy(store, {
      get(target, property) {
        if (property === 'setPerPage') return undefined
        const value: unknown = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as SvelteTableStore<Post, number>
    const legacyContainer = mountTable(baseTable(legacyStore))
    expect(legacyContainer.querySelector('select[aria-label="Results per page"]')).toBeNull()
  })

  it('reports an accessible zero-result range', () => {
    const container = mountTable(baseTable(createStore({ records: [], total: 0 })))

    expect(container.querySelector('.hp-table-pagination-info')?.textContent).toBe('Showing 0 to 0 of 0 results')
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('empty')
    expect(container.querySelector('[data-slot="table-empty"]')).not.toBeNull()
  })

  it('supports search, sorting, deferred filters, column visibility, and pagination', () => {
    const store = createStore({ filterMode: 'deferred', total: 60 })
    const onQueryChange = vi.fn()
    const container = mountTable({
      ...baseTable(store),
      filters: [{ manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } }],
      onQueryChange,
    })

    setInput(container.querySelector('.hp-table-toolbar input[type="search"]'), 'first')
    expect(store.snapshot.search).toBe('first')
    store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 60 })
    container.querySelector<HTMLButtonElement>('th button')?.click()
    flushClient()
    expect(store.snapshot.sort).toEqual([{ column: 'title', direction: 'asc' }])

    setInput(container.querySelector('form input[type="search"]'), 'draft')
    expect(store.snapshot.filters.draft.status).toBe('draft')
    expect(store.snapshot.filters.applied.status).toBeUndefined()
    container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click()
    flushClient()
    expect(store.snapshot.filters.applied.status).toBe('draft')

    container.querySelector<HTMLButtonElement>('.hp-column-manager')?.click()
    flushClient()
    const status = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')).find(item => item.textContent?.includes('Status'))
    expect(status?.getAttribute('role')).toBe('menuitemcheckbox')
    expect(status?.getAttribute('aria-checked')).toBe('true')
    status?.click()
    flushClient()
    expect(status?.getAttribute('aria-checked')).toBe('false')
    expect(store.snapshot.visibleColumns).toEqual(['title'])

    store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 60 })
    flushClient()
    container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click()
    flushClient()
    expect(store.snapshot.page).toBe(2)
    expect(onQueryChange).toHaveBeenCalled()

    const liveStore = createStore({ filterMode: 'live' })
    const liveQueryChange = vi.fn()
    const liveContainer = mountTable({
      ...baseTable(liveStore),
      filters: [{ manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } }],
      onQueryChange: liveQueryChange,
    })
    setInput(liveContainer.querySelector('form input[type="search"]'), 'published')
    expect(liveStore.snapshot.filters.applied.status).toBe('published')
    expect(liveQueryChange).toHaveBeenCalledOnce()
  })

  it('supports page and all-matching selection with bulk action payloads', async () => {
    const store = createStore({ total: 4 })
    const execute = vi.fn(async () => undefined)
    const container = mountTable({
      ...baseTable(store),
      actions: [{ color: 'success', icon: 'check', id: 'posts.publish', label: 'Publish', scope: 'bulk' }],
      actionTransport: { execute },
    })

    container.querySelector<HTMLButtonElement>('[data-slot="checkbox"][aria-label="Select page"]')?.click()
    flushClient()
    expect(store.snapshot.selection.selectedRecordIds).toEqual([1, 2])
    const selectAll = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Select all 4 matching records')
    selectAll?.click()
    flushClient()
    expect(store.snapshot.selection.mode).toBe('all-matching')
    const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Publish')
    expect(publish?.querySelector('[data-icon="check"][data-slot="icon"]')).not.toBeNull()
    expect(publish?.getAttribute('data-color')).toBe('success')
    publish?.click()
    await Promise.resolve()
    flushClient()
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'posts.publish',
      selection: expect.objectContaining({ excludedRecordIds: [], mode: 'all-matching' }),
    }), expect.any(AbortSignal))
  })

  it('requires the panel confirmation UI before destructive actions execute', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mountTable({
      ...baseTable(createStore()),
      actions: [{ color: 'danger', confirmation: 'Delete this record?', icon: 'delete', id: 'posts.delete', label: 'Delete', scope: 'row' }],
      actionTransport: { execute },
    })

    const trigger = container.querySelector<HTMLButtonElement>('[data-action="posts.delete"]')
    expect(trigger?.getAttribute('data-variant')).toBe('destructive')
    trigger?.click()
    flushClient()
    expect(execute).not.toHaveBeenCalled()
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('Delete this record?')
    const confirm = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.textContent === 'Confirm')
    confirm?.click()
    await Promise.resolve()
    flushClient()
    expect(execute).toHaveBeenCalledWith({ actionId: 'posts.delete', recordId: 1 }, expect.any(AbortSignal))
  })

  it('executes only compiled inline edits and supports Enter and Escape', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mountTable({ ...baseTable(createStore()), inlineEditTransport: { execute } })
    container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')?.click()
    flushClient()
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    setInput(input, 'Renamed')
    input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await Promise.resolve()
    flushClient()
    expect(execute).toHaveBeenCalledWith({
      action: 'posts.rename',
      columnPath: 'title',
      expectedVersion: 'v1',
      recordId: 1,
      value: 'Renamed',
    }, expect.any(AbortSignal))
    await vi.waitFor(() => {
      flushClient()
      expect(container.querySelector('input[aria-label="Title"]')).toBeNull()
    })

    container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')?.click()
    flushClient()
    const reopened = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    reopened?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    flushClient()
    expect(container.querySelector('input[aria-label="Title"]')).toBeNull()
  })

  it('renders collapsible groups and group/table summaries', () => {
    const container = mountTable({
      ...baseTable(createStore()),
      groups: [{
        collapsed: false,
        collapsible: true,
        key: 'draft',
        records: [records[0] as Post],
        summaries: [{ id: 'draft-count', label: 'Draft count', value: 1 }],
        title: 'Draft posts',
      }],
      summaries: [{ id: 'total', label: 'Total posts', value: 4 }],
    })
    const group = container.querySelector<HTMLButtonElement>('.hp-table-group button')
    expect(group?.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('Draft count: 1')
    expect(container.querySelector('tfoot')?.textContent).toContain('Total posts: 4')
    group?.click()
    flushClient()
    expect(group?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('td[data-label="Title"]')).toBeNull()
  })

  it('renders ungrouped records when the resolved group collection is empty', () => {
    const table = { ...baseTable(createStore()), groups: [] }
    const markup = renderServer(ServerFixture, { props: { table } }).body

    expect(markup).toContain('First')
    expect(markup).toContain('Second')
  })

  it('renders empty, loading, and sanitized error states', () => {
    const empty = baseTable(createStore({ records: [], total: 0 }))
    expect(renderServer(ServerFixture, { props: { table: { ...empty, emptyMessage: 'Nothing here' } } }).body).toContain('Nothing here')
    const loadingStore = createStore()
    loadingStore.setPage(2)
    expect(renderServer(ServerFixture, { props: { table: baseTable(loadingStore) } }).body).toContain('Loading records')
    loadingStore.applyError(loadingStore.snapshot.queryVersion, { code: 'INTERNAL_PATH', message: 'Try again later' })
    const error = renderServer(ServerFixture, { props: { table: baseTable(loadingStore) } }).body
    expect(error).toContain('Try again later')
    expect(error).not.toContain('INTERNAL_PATH')
  })

  it('hydrates independently compiled server markup without mismatch diagnostics', () => {
    const table = baseTable(createStore())
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerFixture, { props: { table } }).body
    document.body.append(container)
    const serverRows = container.querySelectorAll('tbody tr').length
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(P7GTableFixture, { props: { table }, target: container })
    mounted.push({ component, container })
    flushClient()

    expect(container.querySelectorAll('tbody tr')).toHaveLength(serverRows)
    expect(container.querySelector('table caption')?.textContent).toBe('Posts')
    expect(consoleError).not.toHaveBeenCalled()
  })
})
