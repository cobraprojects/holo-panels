import { TableStateStore, type FilterCollectionPresentation } from '@holo-js/panels-client'
import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  type App,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueTableRenderer } from '../src/tables/renderer'
import { createComponentRegistry } from '../src/registry'
import type { VueCustomFilterProps, VueTableColumn, VueTableRendererProps } from '../src/tables/types'

interface Post {
  readonly id: number
  readonly status: string
  readonly title: string
  readonly version: string
}

const records: readonly Post[] = [
  { id: 1, status: 'draft', title: 'First', version: 'v1' },
  { id: 2, status: 'published', title: 'Second', version: 'v2' },
]

const columns: readonly VueTableColumn<Post>[] = [
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

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function createStore(options: { readonly filterMode?: 'deferred' | 'live', readonly records?: readonly Post[], readonly total?: number } = {}): TableStateStore<Post, number> {
  return new TableStateStore<Post, number>({
    filterMode: options.filterMode,
    panelId: 'admin',
    records: options.records ?? records,
    tableId: 'posts',
    total: options.total ?? 4,
    visibleColumns: ['status', 'title'],
  })
}

function baseProps(store: TableStateStore<Post, number>): VueTableRendererProps<Post, number> {
  return {
    caption: 'Posts',
    columns,
    getRecordId: record => record.id,
    getRecordVersion: record => record.version,
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

function fixture(props: VueTableRendererProps<Post, number>) {
  return defineComponent(() => () => h(VueTableRenderer, { table: props }))
}

function mountTable(props: VueTableRendererProps<Post, number>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(fixture(props))
  app.mount(container)
  mounted.push({ app, container })
  return container
}

async function flush(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function input(inputElement: HTMLInputElement | null, value: string): void {
  if (!inputElement) return
  inputElement.value = value
  inputElement.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.app.unmount()
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P7-F Vue table renderer', () => {
  it('renders schema-ordered responsive dropdown filters with public before and after content', async () => {
    const slot = defineComponent({
      props: ['placement'],
      setup(props) {
        return () => h('p', { 'data-filter-slot': props.placement }, `${String(props.placement)} filters`)
      },
    })
    const registry = createComponentRegistry().register('filters.before', slot).register('filters.after', slot)
    const container = mountTable({
      ...baseProps(createStore()),
      filterPresentation: filterPresentation('dropdown'),
      filters: [
        { manifest: { defaultValue: '', id: 'title', label: 'Title filter', properties: {}, type: 'text' } },
        { manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } },
      ],
      registry,
    })

    expect(container.querySelector('form[aria-label="Table filters"]')).toBeNull()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Filters')?.click()
    await nextTick()
    const form = container.querySelector('form[aria-label="Table filters"]')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(form?.getAttribute('data-filter-placement')).toBe('dropdown')
    expect(form?.getAttribute('style')).toContain('--hp-filter-columns-md: 3')
    expect(Array.from(form?.querySelectorAll('label') ?? []).map(label => label.textContent)).toEqual(['Status filter', 'Title filter'])
    expect(container.querySelector('[data-filter-slot="before"]')?.textContent).toBe('before filters')
    expect(container.querySelector('[data-filter-slot="after"]')?.textContent).toBe('after filters')
  })

  it('mounts an export action with configured format, columns, selection, and progress', async () => {
    const startExport = vi.fn(async () => ({ completed: 0, operationId: 'export-1', status: 'queued' as const, total: 4 }))
    const container = mountTable({
      ...baseProps(createStore()),
      transferTransport: { inspectImport: vi.fn(), startExport, startImport: vi.fn() },
      transfers: [{ columns: [{ id: 'title', label: 'Title', visibleByDefault: true }], formatIds: ['csv'], id: 'posts.export', kind: 'export', label: 'Export posts', maxRows: 100, resourceId: 'posts' }],
    })
    Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Export posts')?.click()
    await flush()
    Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Start export')?.click()
    await flush()
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ columnIds: ['title'], definitionId: 'posts.export', formatId: 'csv', selection: { mode: 'explicit', recordIds: [] } }), expect.any(AbortSignal))
    expect(container.querySelector('progress[aria-label="Transfer progress"]')).not.toBeNull()
  })

  it('renders structured, extension, multi-select, and positioned filters without scalar fallback', async () => {
    const store = createStore({ filterMode: 'live' })
    const RatingFilter = defineComponent({
      props: ['filter', 'update', 'value'],
      setup(componentProps) {
        const filterProps = componentProps as unknown as VueCustomFilterProps
        return () => filterProps.filter.manifest.type === 'custom'
          ? h('div', { 'data-custom-filter-schema': JSON.stringify(filterProps.filter.manifest.properties.schema) })
          : h('button', { 'data-rating-filter': '', type: 'button', onClick: () => filterProps.update(Number(filterProps.value) + 1) }, 'Rating')
      },
    })
    const registry = createComponentRegistry().register('filter.acme.filter.rating', RatingFilter).register('filter.custom', RatingFilter)
    const container = mountTable({
      ...baseProps(store),
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
    await flush()
    expect(store.snapshot.filters.applied.advanced).toEqual({ conditions: [{ column: 'title', operator: '=', value: null }] })
    container.querySelector<HTMLButtonElement>('[data-rating-filter]')?.click()
    await flush()
    expect(store.snapshot.filters.applied.rating).toBe(2)
  })

  it('renders the responsive semantic and accessible table contract', () => {
    const container = mountTable(baseProps(createStore()))
    const region = container.querySelector('[role="region"]')

    expect(container.querySelector('[data-panels-component="table"]')).not.toBeNull()
    expect(container.querySelector('table caption')?.textContent).toBe('Posts')
    expect(region?.getAttribute('aria-label')).toBe('Posts data')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(container.querySelector('th[scope="col"]')).not.toBeNull()
    expect(container.querySelector('td[data-label="Title"]')?.textContent).toBe('First')
    expect(container.querySelector('nav[aria-label="Table pagination"]')).not.toBeNull()
  })

  it('binds search, sorting, live and deferred filters, column visibility, and pagination to TableStateStore', async () => {
    const store = createStore({ filterMode: 'deferred', total: 60 })
    const onQueryChange = vi.fn()
    const container = mountTable({
      ...baseProps(store),
      filters: [{ manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } }],
      onQueryChange,
    })

    input(container.querySelector<HTMLInputElement>('.hp-table-toolbar input[type="search"]'), 'first')
    await nextTick()
    expect(store.snapshot.search).toBe('first')

    container.querySelector<HTMLButtonElement>('th button')?.click()
    await nextTick()
    expect(store.snapshot.sort).toEqual([{ column: 'title', direction: 'asc' }])

    input(container.querySelector<HTMLInputElement>('[id$="-status"]'), 'draft')
    await nextTick()
    expect(store.snapshot.filters.draft.status).toBe('draft')
    expect(store.snapshot.filters.applied.status).toBeUndefined()
    container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click()
    await nextTick()
    expect(store.snapshot.filters.applied.status).toBe('draft')

    container.querySelector<HTMLButtonElement>('.hp-column-manager > button')?.click()
    await nextTick()
    const statusColumn = Array.from(container.querySelectorAll<HTMLInputElement>('.hp-column-manager input'))
      .find(control => control.parentElement?.textContent === 'Status')
    statusColumn?.click()
    await nextTick()
    expect(store.snapshot.visibleColumns).toEqual(['title'])

    store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 60 })
    await nextTick()
    container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click()
    await nextTick()
    expect(store.snapshot.page).toBe(2)
    expect(onQueryChange).toHaveBeenCalled()

    const liveStore = createStore({ filterMode: 'live' })
    const liveQueryChange = vi.fn()
    const live = mountTable({
      ...baseProps(liveStore),
      filters: [{ manifest: { defaultValue: '', id: 'status', label: 'Live status', properties: {}, type: 'text' } }],
      onQueryChange: liveQueryChange,
    })
    input(live.querySelector<HTMLInputElement>('[id$="-status"]'), 'published')
    await nextTick()
    expect(liveStore.snapshot.filters.applied.status).toBe('published')
    expect(liveQueryChange).toHaveBeenCalledOnce()
  })

  it('supports page and all-matching selection with bulk action payloads', async () => {
    const store = createStore({ total: 4 })
    const execute = vi.fn(async () => undefined)
    const container = mountTable({
      ...baseProps(store),
      actions: [
        { id: 'posts.export', label: 'Export', scope: 'header' },
        { id: 'posts.inspect', label: 'Inspect', scope: 'row' },
        { color: 'success', icon: 'check', id: 'posts.publish', label: 'Publish', scope: 'bulk' },
      ],
      actionTransport: { execute },
    })

    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Export')?.click()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Inspect')?.click()
    await flush()
    expect(execute).toHaveBeenCalledWith({ actionId: 'posts.export' }, expect.any(AbortSignal))
    expect(execute).toHaveBeenCalledWith({ actionId: 'posts.inspect', recordId: 1 }, expect.any(AbortSignal))

    container.querySelector<HTMLInputElement>('input[aria-label="Select page"]')?.click()
    await nextTick()
    expect(store.snapshot.selection.selectedRecordIds).toEqual([1, 2])
    const selectAll = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Select all 4 matching records')
    selectAll?.click()
    await nextTick()
    expect(store.snapshot.selection.mode).toBe('all-matching')

    const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Publish')
    expect(publish?.querySelector('[data-icon="check"][data-slot="icon"]')).not.toBeNull()
    expect(publish?.getAttribute('data-color')).toBe('success')
    publish?.click()
    await flush()
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'posts.publish',
      selection: expect.objectContaining({ mode: 'all-matching', excludedRecordIds: [] }),
    }), expect.any(AbortSignal))
  })

  it('executes only compiled inline actions and supports Enter and Escape', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mountTable({
      ...baseProps(createStore()),
      inlineEditTransport: { execute },
    })

    container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')?.click()
    await nextTick()
    const editor = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    input(editor, 'Renamed')
    editor?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await flush()
    expect(execute).toHaveBeenCalledWith({
      action: 'posts.rename',
      columnPath: 'title',
      expectedVersion: 'v1',
      recordId: 1,
      value: 'Renamed',
    }, expect.any(AbortSignal))

    container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')?.click()
    await nextTick()
    const reopened = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    reopened?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await nextTick()
    expect(container.querySelector('input[aria-label="Title"]')).toBeNull()
  })

  it('renders collapsible groups, group summaries, and table summaries', async () => {
    const container = mountTable({
      ...baseProps(createStore()),
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
    await nextTick()
    expect(group?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('td[data-label="Title"]')).toBeNull()
  })

  it('renders loading, empty, and sanitized error states', async () => {
    const emptyStore = createStore({ records: [], total: 0 })
    const emptyMarkup = await renderToString(createSSRApp(fixture({ ...baseProps(emptyStore), emptyMessage: 'Nothing here' })))
    expect(emptyMarkup).toContain('Nothing here')

    const loadingStore = createStore()
    loadingStore.setPage(2)
    const loadingMarkup = await renderToString(createSSRApp(fixture(baseProps(loadingStore))))
    expect(loadingMarkup).toContain('Loading records')
    loadingStore.applyError(loadingStore.snapshot.queryVersion, { code: 'INTERNAL_PATH', message: 'Try again later' })
    const errorMarkup = await renderToString(createSSRApp(fixture(baseProps(loadingStore))))
    expect(errorMarkup).toContain('Try again later')
    expect(errorMarkup).not.toContain('INTERNAL_PATH')
  })

  it('hydrates deterministic server table markup without mismatch diagnostics', async () => {
    const props = baseProps(createStore())
    const Fixture = fixture(props)
    const serverHtml = await renderToString(createSSRApp(Fixture))
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    const normalizedServerHtml = container.innerHTML
    document.body.append(container)
    const warn = vi.fn()
    const app = createSSRApp(Fixture)
    app.config.warnHandler = warn
    app.mount(container)
    mounted.push({ app, container })
    await nextTick()

    expect(warn).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(normalizedServerHtml)
  })
})
