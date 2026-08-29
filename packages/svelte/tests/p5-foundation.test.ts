import { resolve } from 'node:path'
import { mount as mountClient, unmount as unmountClient, type Component } from 'svelte'
import type { render } from 'svelte/server'
import { get } from 'svelte/store'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { panelsSvelteStyle, SvelteComponentRegistry, toSvelteState, toSvelteSchema, toSvelteSnapshot, type SveltePanelComponent } from '../src/index'
import RelationNoOperationsFixture from './RelationNoOperationsFixture.svelte'
import RelationSelectorFixture from './RelationSelectorFixture.svelte'
import RelationViewFixture from './RelationViewFixture.svelte'

const Component = (() => undefined) as unknown as SveltePanelComponent
const Override = (() => undefined) as unknown as SveltePanelComponent
const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let ssrServer: ViteDevServer
let ServerHookFixture: Component
let renderServer: typeof render

beforeAll(async () => {
  ssrServer = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-vite-${process.pid}`,
    logLevel: 'silent',
    optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
    plugins: [svelte()],
    resolve: {
      alias: [
        { find: /^svelte\/server$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/server/index.js') },
        { find: /^svelte\/internal\/server$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/internal/server/index.js') },
        { find: /^svelte\/internal\/client$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/internal/client/index.js') },
        { find: /^svelte$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/index-server.js') },
      ],
      dedupe: ['svelte'],
      preserveSymlinks: true,
    },
    ssr: {
      noExternal: ['bits-ui', 'runed', 'svelte-toolbelt'],
      optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
    },
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  const hookModule = await ssrServer.ssrLoadModule('/tests/HookFixture.svelte')
  ServerHookFixture = hookModule.default as Component
  const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
})

afterAll(async () => {
  await ssrServer?.close()
})

afterEach(async () => {
  for (const entry of mounted.splice(0)) {
    await unmountClient(entry.component)
    entry.container.remove()
  }
  vi.restoreAllMocks()
})

describe('Svelte renderer foundation', () => {
  it('renders registered hook components with properties, page data, and scopes without a wrapper', () => {
    const rendered = renderServer(ServerHookFixture)

    expect(rendered.body).toContain('<strong data-record="42" data-scope="posts:edit">Notice</strong>')
  })

  it('loads and submits a related record through the relation selector', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const loadOptions = vi.fn(async () => [{ label: 'TypeScript', value: 'tag-typescript' }])
    const onOperation = vi.fn(async () => undefined)
    const component = mountClient(RelationSelectorFixture, { target: container, props: { loadOptions, onOperation } })
    mounted.push({ component, container })
    expect(container.querySelector('[data-slot="relation-manager-header"]')).not.toBeNull()
    expect(container.querySelector('.hp-relation-manager-count')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-operation="attach"] [data-icon="link"]')).not.toBeNull()
    expect(container.textContent).toContain('No tags found.')
    container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click()
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('[data-field-path="relatedId"] select')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-header"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-footer"]')).not.toBeNull()
    if (select) {
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (position) {
      position.value = '3'
      position.dispatchEvent(new Event('input', { bubbles: true }))
    }
    document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click()
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }), expect.any(AbortSignal)))
  })

  it('presents related record view through the shared row-action menu without eagerly mutating', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const onOperation = vi.fn(async () => undefined)
    const component = mountClient(RelationViewFixture, { target: container, props: { onOperation } })
    mounted.push({ component, container })

    const table = container.querySelector('[data-panels-component="data-table"]')
    expect(table).not.toBeNull()
    expect(table?.classList.contains('hp-table-responsive')).toBe(true)
    expect(table?.querySelector('td[data-label="Name"]')?.textContent).toContain('TypeScript')
    expect(table?.querySelector('td.hp-table-row-actions[data-label="Actions"]')).not.toBeNull()
    const menu = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
    expect(menu).not.toBeNull()

    expect(onOperation).not.toHaveBeenCalled()
  })

  it('omits relation action structure when no operations are configured', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(RelationNoOperationsFixture, { target: container })
    mounted.push({ component, container })

    const table = container.querySelector('[data-panels-component="data-table"]')
    expect(table).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).toBeNull()
    expect(table?.querySelector('th:last-child')?.textContent).toBe('Name')
    expect(table?.querySelector('td[data-label="Actions"]')).toBeNull()
    expect(table?.querySelector('.hp-table-row-actions')).toBeNull()
  })

  it('registers named components and resolves explicit panel overrides', () => {
    const registry = new SvelteComponentRegistry()
    registry.register({ component: Component, source: 'app/panels.ts', typeId: 'acme:field:money' })
    registry.register({ component: Component, source: 'app/dashboard.ts', typeId: 'app.page.dashboard' })
    registry.override('admin', { component: Override, source: 'app/admin.ts', typeId: 'acme:field:money' })

    expect(registry.hasRenderer('acme:field:money')).toBe(true)
    expect(registry.hasRenderer('app.page.dashboard')).toBe(true)
    expect(registry.resolve('acme:field:money')).toBe(Component)
    expect(registry.resolve('acme:field:money', 'admin')).toBe(Override)
    expect(() => registry.register({ component: Component, source: 'duplicate.ts', typeId: 'acme:field:money' }))
      .toThrow(/Duplicate Svelte component registration.*duplicate\.ts/)
  })

  it('reports missing registrations with type, panel, and schema source context', () => {
    const registry = new SvelteComponentRegistry()
    expect(() => registry.resolve('acme:field:missing', 'admin', 'app/panels/posts.ts:42'))
      .toThrow(/acme:field:missing.*admin.*app\/panels\/posts\.ts:42/)
  })

  it('adapts client state to an idiomatic Svelte readable without semantic changes', () => {
    let state: Readonly<{ count: number }> = Object.freeze({ count: 1 })
    let listener: ((value: typeof state) => void) | undefined
    const unsubscribe = vi.fn()
    const store = toSvelteState({
      get state() { return state },
      subscribe(next) {
        listener = next
        return unsubscribe
      },
    })
    const observed: number[] = []
    const stop = store.subscribe(value => observed.push(value.count))
    state = Object.freeze({ count: 2 })
    listener?.(state)

    expect(get(store)).toBe(state)
    expect(observed).toEqual([1, 2])
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('adapts snapshot and schema stores without changing subscription semantics', () => {
    const stop = vi.fn()
    const snapshot = Object.freeze({ page: 2 })
    const schema = Object.freeze({ id: 'posts' })
    const snapshotStore = toSvelteSnapshot({ snapshot, subscribe: () => stop })
    const schemaStore = toSvelteSchema({ schema, subscribe: () => stop })

    expect(get(snapshotStore)).toBe(snapshot)
    expect(get(schemaStore)).toBe(schema)
  })

  it('exports the isolated dashboard stylesheet', () => {
    expect(panelsSvelteStyle).toBe('@holo-js/panels-svelte/style.css')
  })
})
