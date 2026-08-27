import { act, createElement, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { TableStateStore, type FilterCollectionPresentation } from '@holo-js/panels-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactTableRenderer } from '../src/tables/renderer'
import { createComponentRegistry } from '../src/registry'
import type { ReactCustomFilterProps, ReactFilterCollectionSlotProps, ReactTableColumn, ReactTableRendererProps } from '../src/tables/types'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

interface Post {
  readonly active: boolean
  readonly color: string
  readonly cover: string
  readonly id: number
  readonly status: string
  readonly title: string
  readonly total: number
  readonly version: string
}

const records: readonly Post[] = [
  { active: true, color: '#123456', cover: '/first.png', id: 1, status: 'draft', title: 'First', total: 12, version: 'v1' },
  { active: false, color: 'javascript:bad', cover: 'javascript:alert(1)', id: 2, status: 'published', title: 'Second', total: 34, version: 'v2' },
]

const columns: readonly ReactTableColumn<Post>[] = [
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

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function createStore(options: { readonly filterMode?: 'deferred' | 'live', readonly perPage?: number, readonly records?: readonly Post[], readonly total?: number, readonly visibleColumns?: readonly string[] } = {}): TableStateStore<Post, number> {
  return new TableStateStore<Post, number>({
    filterMode: options.filterMode,
    panelId: 'admin',
    perPage: options.perPage,
    records: options.records ?? records,
    tableId: 'posts',
    total: options.total ?? 4,
    visibleColumns: options.visibleColumns ?? ['status', 'title'],
  })
}

function TableFixture(props: ReactTableRendererProps<Post, number>): ReactNode {
  return ReactTableRenderer(props)
}

function baseProps(store: TableStateStore<Post, number>): ReactTableRendererProps<Post, number> {
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
    children: [],
    dynamicVisibility: false,
    extraAttributes: {},
    id: `post-filters.filter-${id}`,
    key: `filter-${id}`,
    kind: 'filter' as const,
    layout: {},
    properties: { leaf: { definition: { id }, kind: 'filter' as const } },
    slots: {},
    statePath: id,
    type: 'text',
    visible: true,
  })
  return {
    columns: { default: 1, md: 3 },
    id: 'post-filters',
    placement,
    schema: { components: [component('status'), component('title')], id: 'post-filters', kind: 'schema' },
    slots: {
      after: [{ component: 'filters.after', order: 0, properties: {}, source: 'component' }],
      before: [{ component: 'filters.before', order: 0, properties: {}, source: 'component' }],
    },
  }
}

function mount(props: ReactTableRendererProps<Post, number>): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push({ container, unmount: () => root.unmount() })
  act(() => root.render(createElement(TableFixture, props)))
  return container
}

function changeInput(input: HTMLInputElement | null, value: string): void {
  if (!input) return
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

it('uses the shared action manifest for table visibility and disabled presentation', () => {
  const manifest = { badge: null, color: 'danger', confirmation: null, disabled: true, icon: 'trash', id: 'archive', kind: 'custom' as const, label: 'Archive selected', modal: null, mount: 'page' as const, size: 'medium' as const, tooltip: null, type: 'custom', visible: true }
  const container = mount({ ...baseProps(createStore()), actions: [
    { id: 'archive', label: 'Fallback', scope: 'header', resolveManifest: () => manifest },
    { id: 'hidden', label: 'Hidden fallback', scope: 'header', resolveManifest: () => ({ ...manifest, id: 'hidden', visible: false }) },
  ] })
  const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="archive"]')
  expect(trigger?.textContent).toContain('Archive selected')
  expect(trigger?.disabled).toBe(true)
  expect(container.textContent).not.toContain('Hidden fallback')
})

describe('P7-E React table renderer', () => {
  it('renders schema-ordered responsive modal filters with public before and after content', async () => {
    const registry = createComponentRegistry()
      .register('filters.before', ({ placement }: ReactFilterCollectionSlotProps) => createElement('p', { 'data-filter-slot': placement }, 'Before filters'))
      .register('filters.after', ({ placement }: ReactFilterCollectionSlotProps) => createElement('p', { 'data-filter-slot': placement }, 'After filters'))
    const container = mount({
      ...baseProps(createStore()),
      filterPresentation: filterPresentation('modal'),
      filters: [
        { manifest: { defaultValue: '', id: 'title', label: 'Title filter', properties: {}, type: 'text' } },
        { manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } },
      ],
      registry,
    })

    expect(container.querySelector('form[aria-label="Table filters"]')).toBeNull()
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Filters')?.click())
    await vi.waitFor(() => expect(document.querySelector('form[aria-label="Table filters"]')).not.toBeNull())
    const form = document.querySelector('form[aria-label="Table filters"]')
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull()
    expect(form?.getAttribute('data-filter-placement')).toBe('modal')
    expect(form?.getAttribute('style')).toContain('--hp-filter-columns-md: 3')
    expect(Array.from(form?.querySelectorAll('label') ?? []).map(label => label.textContent)).toEqual(['Status filter', 'Title filter'])
    expect(document.querySelector('[data-filter-slot="before"]')?.textContent).toBe('Before filters')
    expect(document.querySelector('[data-filter-slot="after"]')?.textContent).toBe('After filters')
  })

  it('mounts import and export actions with allow-listed inputs, selection, and progress', async () => {
    const inspectImport = vi.fn(async () => ({ headers: ['Title'], uploadId: 'upload-1' }))
    const startImport = vi.fn(async () => ({ completed: 0, operationId: 'import-1', status: 'queued' as const, total: 4 }))
    const startExport = vi.fn(async () => ({ completed: 0, operationId: 'export-1', status: 'queued' as const, total: 4 }))
    const container = mount({
      ...baseProps(createStore()),
      transferTransport: { inspectImport, startExport, startImport },
      transfers: [
        { columns: [{ example: 'Hello', key: 'title', label: 'Title', required: true }], formatIds: ['csv'], id: 'posts.import', kind: 'import', label: 'Import posts', maxFileBytes: 1024, maxRows: 100, resourceId: 'posts' },
        { columns: [{ id: 'title', label: 'Title', visibleByDefault: true }], formatIds: ['csv'], id: 'posts.export', kind: 'export', label: 'Export posts', maxRows: 100, resourceId: 'posts' },
      ],
    })
    act(() => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Export posts')?.click())
    await vi.waitFor(() => expect(Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Start export')).toBe(true))
    await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Start export')?.click())
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ columnIds: ['title'], definitionId: 'posts.export', formatId: 'csv', selection: { mode: 'explicit', recordIds: [] } }), expect.any(AbortSignal))
    expect(document.querySelector('[role="progressbar"][aria-label="Transfer progress"]')).not.toBeNull()
    act(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Close')?.click())
    act(() => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Import posts')?.click())
    await vi.waitFor(() => expect(document.querySelector('input[type="file"]')).not.toBeNull())
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [{ arrayBuffer: async () => new ArrayBuffer(1), name: 'posts.csv', size: 12, type: 'text/csv' }] })
    await act(async () => fileInput?.dispatchEvent(new Event('change', { bubbles: true })))
    const mapping = Array.from(document.querySelectorAll('select')).find(select => select.options[0]?.textContent === 'Do not import')
    act(() => {
      if (mapping) {
        mapping.value = 'Title'
        mapping.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Start import')?.click())
    expect(startImport).toHaveBeenCalledWith(expect.objectContaining({ definitionId: 'posts.import', mappings: [{ column: 'title', header: 'Title' }], uploadId: 'upload-1' }), expect.any(AbortSignal))
  })

  it('renders a responsive semantic and accessible shared table contract', () => {
    const container = mount(baseProps(createStore()))
    const region = container.querySelector('[role="region"]')

    expect(container.querySelector('[data-panels-component="table"]')).not.toBeNull()
    expect(region?.getAttribute('data-panels-component')).toBe('data-table')
    expect(region?.classList.contains('hp-table-responsive')).toBe(true)
    expect(container.querySelector('table caption')?.textContent).toBe('Posts')
    expect(region?.getAttribute('aria-label')).toBe('Posts data')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(container.querySelector('th[scope="col"]')).not.toBeNull()
    expect(container.querySelector('td[data-label="Title"]')?.textContent).toBe('First')
    expect(container.querySelector('input[aria-label="Select page"]')).toBeNull()
    expect(container.querySelector('nav[aria-label="Table pagination"]')).not.toBeNull()
  })

  it('executes a record action from a compact row menu', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mount({
      ...baseProps(createStore()),
      actions: [{ icon: 'view', id: 'posts.inspect', label: 'Inspect', scope: 'row' }],
      actionTransport: { execute },
    })
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
    expect(trigger).not.toBeNull()
    expect(container.querySelector('[data-action="posts.inspect"]')).toBeNull()
    act(() => {
      trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      trigger?.click()
    })
    await vi.waitFor(() => expect(document.querySelector('[role="menuitem"][data-action="posts.inspect"]')).not.toBeNull())
    await act(async () => document.querySelector<HTMLElement>('[role="menuitem"][data-action="posts.inspect"]')?.click())
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'posts.inspect', recordId: 1, input: {}, mount: 'record', idempotencyKey: expect.any(String) }), expect.any(AbortSignal))
  })

  it('renders deterministic accessible pagination and locks its controls while loading', () => {
    const store = createStore({ total: 250 })
    const container = mount(baseProps(store))

    act(() => store.setPage(5))
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('loading')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Results per page"]')?.disabled).toBe(true)
    expect([...container.querySelectorAll<HTMLButtonElement>('.hp-table-pagination-pages button')].every(button => button.disabled)).toBe(true)

    act(() => store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 250 }))
    expect([...container.querySelectorAll<HTMLButtonElement>('.hp-table-pagination-pages button[aria-label^="Page "]')].map(button => button.textContent)).toEqual(['1', '4', '5', '6', '10'])
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('5')
    expect(container.querySelector('.hp-table-pagination-info')?.getAttribute('aria-live')).toBe('polite')
  })

  it('preserves an arbitrary valid per-page value in the selector', () => {
    const store = createStore({ perPage: 37, total: 250 })
    const container = mount(baseProps(store))
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Results per page"]')

    expect(select?.value).toBe('37')
    expect([...select?.options ?? []].map(option => option.value)).toContain('37')
  })

  it('reports an accessible zero-result range', () => {
    const container = mount(baseProps(createStore({ records: [], total: 0 })))

    expect(container.querySelector('.hp-table-pagination-info')?.textContent).toBe('Showing 0 to 0 of 0 results')
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('empty')
    expect(container.querySelector('[data-slot="table-empty"]')).not.toBeNull()
  })

  it('renders built-in column semantics and formatter manifests without unsafe HTML or URLs', async () => {
    const execute = vi.fn(async () => undefined)
    const formattedManifest = {
      alignment: 'end' as const,
      copyable: false,
      formatters: [{ currency: 'USD', kind: 'money' }, { kind: 'prefix', value: 'Total: ' }, { kind: 'badge', value: true }, { kind: 'icon', name: 'banknotes' }, { kind: 'color', value: 'primary' }, { kind: 'tooltip', value: 'Gross total' }, { kind: 'action', value: 'posts.total' }],
      hidden: false,
      inlineEditor: null,
      label: 'Total',
      lineClamp: 1,
      path: 'total',
      sortable: false,
      toggleable: true,
      type: 'text',
      width: null,
      wrap: false,
    }
    const booleanManifest = { ...formattedManifest, formatters: [], label: 'Active', lineClamp: null, path: 'active', type: 'boolean' }
    const imageManifest = { ...formattedManifest, formatters: [{ kind: 'size', pixels: 32 }], label: 'Cover', lineClamp: null, path: 'cover', type: 'image' }
    const colorManifest = { ...formattedManifest, formatters: [], label: 'Color', lineClamp: null, path: 'color', type: 'color' }
    const semanticColumns: readonly ReactTableColumn<Post>[] = [
      { manifest: formattedManifest },
      { manifest: booleanManifest },
      { manifest: imageManifest },
      { manifest: colorManifest },
    ]
    const container = mount({
      ...baseProps(createStore({ visibleColumns: ['active', 'color', 'cover', 'total'] })),
      actionTransport: { execute },
      columns: semanticColumns,
    })

    expect(container.querySelector('.hp-table-badge')?.textContent).toContain('Total: $12.00')
    expect(container.querySelector('.hp-table-badge [data-icon="banknotes"]')).not.toBeNull()
    expect(container.querySelector('.hp-table-badge [data-color="primary"]')).not.toBeNull()
    expect(container.querySelector('[title="Gross total"]')).not.toBeNull()
    expect(container.querySelector('[data-icon="check"]')?.getAttribute('aria-label')).toBe('Yes')
    expect(container.querySelector<HTMLImageElement>('img')?.src).toContain('/first.png')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('.hp-table-color')?.getAttribute('style')).toContain('background-color')
    expect(container.innerHTML).not.toContain('<script')
    expect(container.innerHTML).not.toContain('javascript:alert')
    await act(async () => container.querySelector<HTMLButtonElement>('td[data-label="Total"] button')?.click())
    expect(execute).toHaveBeenCalledWith({ actionId: 'posts.total', recordId: 1 }, expect.any(AbortSignal))
  })

  it('supports sorting, deferred filters, column management, and pagination through TableStateStore', async () => {
    const store = createStore({ filterMode: 'deferred', total: 60 })
    const onQueryChange = vi.fn()
    const container = mount({
      ...baseProps(store),
      filters: [{ manifest: { defaultValue: '', id: 'status', label: 'Status filter', properties: {}, type: 'text' } }],
      onQueryChange,
    })

    act(() => container.querySelector<HTMLButtonElement>('th button')?.click())
    expect(store.snapshot.sort).toEqual([{ column: 'title', direction: 'asc' }])

    const filter = container.querySelector<HTMLInputElement>('#hp-filter-status')
    act(() => changeInput(filter, 'draft'))
    expect(store.snapshot.filters.draft.status).toBe('draft')
    expect(store.snapshot.filters.applied.status).toBeUndefined()
    act(() => container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click())
    expect(store.snapshot.filters.applied.status).toBe('draft')

    act(() => {
      const trigger = container.querySelector<HTMLButtonElement>('.hp-column-manager')
      trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      trigger?.click()
    })
    await vi.waitFor(() => expect(document.querySelector('#hp-column-status')).not.toBeNull())
    const statusColumn = document.querySelector<HTMLButtonElement>('#hp-column-status')
    expect(statusColumn).not.toBeNull()
    act(() => statusColumn?.click())
    expect(store.snapshot.visibleColumns).toEqual(['title'])

    act(() => store.applyData({ queryVersion: store.snapshot.queryVersion, records, total: 60 }))
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click())
    expect(store.snapshot.page).toBe(2)
    expect(onQueryChange).toHaveBeenCalled()
  })

  it('renders dedicated ternary, trashed, and date-range controls using existing filter values', () => {
    const store = createStore({ filterMode: 'live' })
    const onQueryChange = vi.fn()
    const container = mount({
      ...baseProps(store),
      filters: [
        { manifest: { defaultValue: 'all', id: 'featured', label: 'Featured', properties: {}, type: 'ternary' } },
        { manifest: { defaultValue: 'without', id: 'deleted', label: 'Deleted', properties: {}, type: 'trashed' } },
        { manifest: { defaultValue: { from: null, to: null }, id: 'published', label: 'Published', properties: {}, type: 'date-range' } },
      ],
      onQueryChange,
    })

    const ternary = container.querySelector<HTMLSelectElement>('#hp-filter-featured')
    const trashed = container.querySelector<HTMLSelectElement>('#hp-filter-deleted')
    const from = container.querySelector<HTMLInputElement>('#hp-filter-published-from')
    const to = container.querySelector<HTMLInputElement>('#hp-filter-published-to')
    act(() => {
      if (ternary) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(ternary, 'true')
        ternary.dispatchEvent(new Event('change', { bubbles: true }))
      }
      if (trashed) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(trashed, 'only')
        trashed.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    act(() => changeInput(from, '2026-01-01'))
    act(() => changeInput(to, '2026-01-31'))

    expect(store.snapshot.filters.applied).toMatchObject({
      deleted: 'only',
      featured: 'true',
      published: { from: '2026-01-01', to: '2026-01-31' },
    })
    expect(onQueryChange).toHaveBeenCalledTimes(4)
  })

  it('renders structured, extension, multi-select, and positioned filters without scalar fallback', () => {
    const store = createStore({ filterMode: 'live' })
    const registry = createComponentRegistry()
      .register('filter.acme.filter.rating', ({ update, value }: ReactCustomFilterProps) => createElement('button', { 'data-rating-filter': true, onClick: () => update(Number(value) + 1), type: 'button' }, 'Rating'))
      .register('filter.custom', ({ filter }: ReactCustomFilterProps) => createElement('div', { 'data-custom-filter-schema': JSON.stringify(filter.manifest.properties.schema) }))
    const container = mount({
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

    const positioned = container.querySelector('[data-filter-column-span]')
    expect(positioned?.getAttribute('data-filter-column-span')).toBe('{"default":2}')
    expect(positioned?.getAttribute('data-filter-column-start')).toBe('{"default":1}')
    expect(container.querySelector<HTMLSelectElement>('#hp-filter-status')?.multiple).toBe(true)
    expect(container.querySelector('[data-custom-filter-schema]')).not.toBeNull()
    act(() => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Add condition')?.click())
    expect(store.snapshot.filters.applied.advanced).toEqual({ conditions: [{ column: 'title', operator: '=', value: null }] })
    act(() => container.querySelector<HTMLButtonElement>('[data-rating-filter]')?.click())
    expect(store.snapshot.filters.applied.rating).toBe(2)
  })

  it('supports page and all-matching selection with bulk action payloads', async () => {
    const store = createStore({ total: 4 })
    const execute = vi.fn(async () => undefined)
    const container = mount({
      ...baseProps(store),
      actions: [{ color: 'success', icon: 'check', id: 'posts.publish', label: 'Publish', scope: 'bulk' }],
      actionTransport: { execute },
    })

    act(() => container.querySelector<HTMLButtonElement>('[role="checkbox"][aria-label="Select page"]')?.click())
    expect(store.snapshot.selection.selectedRecordIds).toEqual([1, 2])
    act(() => container.querySelector<HTMLButtonElement>('button')?.dispatchEvent(new Event('blur')))
    const selectAll = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Select all 4 matching records')
    act(() => selectAll?.click())
    expect(store.snapshot.selection.mode).toBe('all-matching')

    const publish = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Publish')
    expect(publish?.querySelector('[data-icon="check"][data-slot="icon"]')).not.toBeNull()
    expect(publish?.getAttribute('data-color')).toBe('success')
    await act(async () => publish?.click())
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'posts.publish',
      selection: expect.objectContaining({ mode: 'all-matching', excludedRecordIds: [] }),
    }), expect.any(AbortSignal))
  })

  it('requires the panel confirmation UI before executing destructive table actions', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mount({
      ...baseProps(createStore()),
      actions: [{ color: 'danger', confirmation: 'Delete this record?', icon: 'delete', id: 'posts.delete', label: 'Delete', scope: 'row' }],
      actionTransport: { execute },
    })

    act(() => {
      const menu = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
      menu?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      menu?.click()
    })
    const trigger = document.querySelector<HTMLElement>('[role="menuitem"][data-action="posts.delete"]')
    expect(trigger?.getAttribute('data-variant')).toBe('destructive')
    expect(trigger?.querySelector('[data-icon="delete"]')).not.toBeNull()
    act(() => trigger?.click())
    expect(execute).not.toHaveBeenCalled()
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('Delete this record?')
    const confirm = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.textContent === 'Confirm')
    expect(confirm?.className).toContain('hp:bg-destructive')
    expect(confirm?.querySelector('[data-icon="delete"]')).not.toBeNull()
    await act(async () => confirm?.click())
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'posts.delete', recordId: 1, input: {}, mount: 'record', idempotencyKey: expect.any(String) }), expect.any(AbortSignal))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('executes only the compiled inline action and supports Enter and Escape keyboard behavior', async () => {
    const execute = vi.fn(async () => undefined)
    const container = mount({
      ...baseProps(createStore()),
      inlineEditTransport: { execute },
    })
    const edit = container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')
    act(() => edit?.click())
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    act(() => changeInput(input, 'Renamed'))
    await act(async () => input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })))
    expect(execute).toHaveBeenCalledWith({
      action: 'posts.rename',
      columnPath: 'title',
      expectedVersion: 'v1',
      recordId: 1,
      value: 'Renamed',
    }, expect.any(AbortSignal))

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Edit Title"]')?.click())
    const reopened = container.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    act(() => reopened?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(container.querySelector('input[aria-label="Title"]')).toBeNull()
  })

  it('renders collapsible groups, group summaries, and table summaries', () => {
    const container = mount({
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
    act(() => group?.click())
    expect(group?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('td[data-label="Title"]')).toBeNull()
  })

  it('renders empty, loading, and error states without leaking error codes', () => {
    const emptyStore = createStore({ records: [], total: 0 })
    expect(renderToString(createElement(TableFixture, { ...baseProps(emptyStore), emptyMessage: 'Nothing here' }))).toContain('Nothing here')

    const loadingStore = createStore()
    loadingStore.setPage(2)
    expect(renderToString(createElement(TableFixture, baseProps(loadingStore)))).toContain('Loading records')
    loadingStore.applyError(loadingStore.snapshot.queryVersion, { code: 'INTERNAL_PATH', message: 'Try again later' })
    const errorMarkup = renderToString(createElement(TableFixture, baseProps(loadingStore)))
    expect(errorMarkup).toContain('Try again later')
    expect(errorMarkup).not.toContain('INTERNAL_PATH')
  })

  it('hydrates deterministic server table markup without mismatch diagnostics', async () => {
    const props = baseProps(createStore())
    const container = document.createElement('div')
    container.innerHTML = renderToString(createElement(TableFixture, props))
    document.body.append(container)
    const markup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined

    await act(async () => {
      root = hydrateRoot(container, createElement(TableFixture, props))
      await Promise.resolve()
    })
    if (!root) throw new Error('React hydration did not create a root.')
    roots.push({ container, unmount: () => root?.unmount() })
    expect(container.innerHTML).toBe(markup)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
