import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FormStore, TableStateStore, type ExtensionTypeId } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, mount, unmount } from 'svelte'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SvelteTableColumn, SvelteTableRendererProps } from '../src/tables/types'
import { registerSvelteExtensionRenderer, SvelteComponentRegistry } from '../src/registry'
import P16FieldFixture from './P16FieldFixture.svelte'
import P16TableFixture, { type P16Record } from './P16TableFixture.svelte'
import P16MoneyColumn from './P16MoneyColumn.svelte'

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let server: ViteDevServer
let flushClient: typeof flushSync
let mountClient: typeof mount
let unmountClient: typeof unmount

function mountComponent<TProps extends Record<string, unknown>>(component: Component<TProps>, props: TProps): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const instance = mountClient(component, { props, target: container })
  mounted.push({ component: instance, container })
  flushClient()
  return container
}

function column(path: Extract<keyof P16Record, string>, type: string, options: {
  readonly copyable?: boolean
  readonly formatters?: readonly Readonly<Record<string, unknown>>[]
} = {}): SvelteTableColumn<P16Record> {
  const manifest = {
    alignment: 'start' as const,
    copyable: options.copyable ?? false,
    formatters: options.formatters ?? [],
    hidden: false,
    inlineEditor: null,
    label: path,
    lineClamp: null,
    path,
    sortable: false,
    toggleable: false,
    type,
    width: null,
    wrap: true,
  }
  return { manifest }
}

function tableFixture(options: {
  readonly columns: readonly SvelteTableColumn<P16Record>[]
  readonly filters?: SvelteTableRendererProps<P16Record, number>['filters']
  readonly registry?: SvelteTableRendererProps<P16Record, number>['registry']
}): { readonly container: HTMLDivElement, readonly store: TableStateStore<P16Record, number> } {
  const store = new TableStateStore<P16Record, number>({
    filterMode: 'live',
    panelId: 'admin',
    records: [{ active: true, avatar: 'javascript:alert(1)', id: 1, title: '<img src=x onerror=alert(1)>' }],
    tableId: 'records',
    total: 1,
  })
  const table: SvelteTableRendererProps<P16Record, number> = {
    caption: 'Records',
    columns: options.columns,
    filters: options.filters,
    getRecordId: record => record.id,
    panelId: 'admin',
    registry: options.registry,
    store,
  }
  return { container: mountComponent(P16TableFixture, { table }), store }
}

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p16-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  await server.ssrLoadModule('/tests/P16FieldFixture.svelte')
  await server.ssrLoadModule('/tests/P16TableFixture.svelte')
  await server.ssrLoadModule('/tests/P16MoneyColumn.svelte')
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const client = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  flushClient = client.flushSync as typeof flushSync
  mountClient = client.mount as typeof mount
  unmountClient = client.unmount as typeof unmount
})

afterAll(async () => server?.close())

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await unmountClient(item.component)
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('Svelte renderer parity', () => {
  it('renders emitted text, textarea, toggle, and date properties', () => {
    const form = new FormStore<Record<string, unknown>>({
      biography: 'Hello',
      date: '2026-07-28T14:35:00.000Z',
      dateTime: '2026-07-28T14:35:00.000Z',
      enabled: false,
      secret: 'hidden-value',
      time: '2026-07-28T14:35:00.000Z',
    })
    const container = mountComponent(P16FieldFixture, { form })
    const secret = container.querySelector<HTMLInputElement>('#hp-field-secret')

    expect(secret?.type).toBe('password')
    expect(secret?.closest('[data-slot="input-group"]')).not.toBeNull()
    expect(secret?.dataset.mask).toBe('credential')
    expect(secret?.autocomplete).toBe('current-password')
    expect(container.querySelector('.hp-field-prefix')?.textContent).toBe('@')
    expect(container.querySelector('.hp-field-suffix')?.textContent).toBe('.internal')
    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value'))).toEqual(['alpha', 'beta'])
    container.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click()
    flushClient()
    expect(container.querySelector<HTMLInputElement>('#hp-field-secret')?.type).toBe('text')

    const textarea = container.querySelector<HTMLTextAreaElement>('#hp-field-biography')
    if (!textarea) throw new Error('Expected textarea')
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 96 })
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()
    expect(textarea.dataset.autosize).toBe('true')
    expect(textarea.style.height).toBe('96px')
    expect(textarea.getAttribute('rows')).toBe('3')
    expect(container.querySelector('.hp-field-toggle-label')?.textContent).toBe('Disabled')
    container.querySelector<HTMLInputElement>('#hp-field-enabled')?.click()
    flushClient()
    expect(container.querySelector('.hp-field-toggle-label')?.textContent).toBe('Enabled')
    expect(container.querySelector<HTMLInputElement>('#hp-field-date')?.value).toBe('2026-07-28')
    expect(container.querySelector<HTMLInputElement>('#hp-field-time')?.value).toBe('14:35')
    expect(container.querySelector<HTMLInputElement>('#hp-field-dateTime')?.value).toBe('2026-07-28T14:35')
    expect(container.querySelector<HTMLInputElement>('#hp-field-dateTime')?.type).toBe('datetime-local')
  })

  it('renders semantic formatter presentation and rejects unsafe URLs and markup', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = tableFixture({
      columns: [
        column('title', 'badge', { copyable: true, formatters: [{ kind: 'limit', characters: 8 }, { kind: 'prefix', value: '[' }, { kind: 'suffix', value: ']' }, { kind: 'url', value: 'javascript:alert(1)' }] }),
        column('active', 'boolean', { formatters: [{ kind: 'boolean-icons', truthy: 'check-circle', falsy: 'x-circle' }] }),
        column('avatar', 'image', { formatters: [{ kind: 'size', pixels: 48 }] }),
      ],
    })

    expect(container.querySelector('.hp-table-badge')?.textContent).toBe('[<img src…]')
    expect(container.querySelector('[role="img"]')?.getAttribute('data-icon')).toBe('check-circle')
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy title"]')
    expect(copyButton?.classList.contains('hp-table-copy')).toBe(true)
    expect(copyButton?.querySelector('[data-icon="copy"]')).not.toBeNull()
    expect(copyButton?.textContent).toBe('')
    copyButton?.click()
    await Promise.resolve()
    flushClient()
    expect(writeText).toHaveBeenCalledWith('[<img src…]')
    await vi.waitFor(() => expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied'))
  })

  it('renders custom columns through the shared extension registry', () => {
    const type = 'holo.money:column:money' as ExtensionTypeId<'column'>
    const registry = new SvelteComponentRegistry()
    registerSvelteExtensionRenderer(registry, 'column', type, P16MoneyColumn)
    const custom = column('id', type) as SvelteTableColumn<P16Record> & { readonly manifest: Record<string, unknown> }
    const configured = { ...custom, manifest: { ...custom.manifest, formatters: [{ configuration: { currency: 'EUR' }, kind: 'custom' }] } } as SvelteTableColumn<P16Record>
    const { container } = tableFixture({ columns: [configured], registry })

    expect(container.querySelector('.money')?.textContent).toBe('EUR 1')
  })

  it('uses dedicated ternary, trashed, and date-range controls', () => {
    const { container, store } = tableFixture({
      columns: [column('title', 'text')],
      filters: [
        { manifest: { defaultValue: 'all', id: 'active', label: 'Active', properties: {}, type: 'ternary' } },
        { manifest: { defaultValue: 'without', id: 'trashed', label: 'Deleted', properties: {}, type: 'trashed' } },
        { manifest: { defaultValue: { from: null, to: null }, id: 'created', label: 'Created', properties: {}, type: 'date-range' } },
      ],
    })
    const selects = container.querySelectorAll<HTMLSelectElement>('.hp-table-filters select')
    selects[0]!.value = 'true'
    selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    selects[1]!.value = 'only'
    selects[1]!.dispatchEvent(new Event('change', { bubbles: true }))
    const dates = container.querySelectorAll<HTMLInputElement>('.hp-table-filters input[type="date"]')
    dates[0]!.value = '2026-07-01'
    dates[0]!.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()

    expect(store.snapshot.filters.applied.active).toBe('true')
    expect(store.snapshot.filters.applied.trashed).toBe('only')
    expect(store.snapshot.filters.applied.created).toEqual({ from: '2026-07-01', to: null })
    expect(Array.from(selects[0]!.options).map(option => option.value)).toEqual(['all', 'true', 'false'])
    expect(Array.from(selects[1]!.options).map(option => option.value)).toEqual(['without', 'with', 'only'])
  })
})
