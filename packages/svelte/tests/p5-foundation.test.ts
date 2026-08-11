import { resolve } from 'node:path'
import { flushSync as flushClient, hydrate as hydrateClient, mount as mountClient, unmount as unmountClient, type Component } from 'svelte'
import type { render } from 'svelte/server'
import { get } from 'svelte/store'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PanelsModal,
  PanelsSlideOver,
  panelsSvelteStyle,
  SvelteButton,
  SvelteComponentRegistry,
  SvelteModal,
  svelteShellPrimitives,
  toSvelteState,
  toSvelteSchema,
  toSvelteSnapshot,
  type SveltePanelComponent,
} from '../src/index'
import ShellFixture from './ShellFixture.svelte'
import InteractiveFixture from './InteractiveFixture.svelte'
import RelationSelectorFixture from './RelationSelectorFixture.svelte'
import RelationViewFixture from './RelationViewFixture.svelte'

const Component = (() => undefined) as unknown as SveltePanelComponent
const Override = (() => undefined) as unknown as SveltePanelComponent
const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let ssrServer: ViteDevServer
let ServerShellFixture: Component<{ dialogsOpen?: boolean; onselect?: (id: string) => void }>
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
  const module = await ssrServer.ssrLoadModule('/tests/ShellFixture.svelte')
  ServerShellFixture = module.default as Component<{ dialogsOpen?: boolean; onselect?: (id: string) => void }>
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
  it('loads and submits a related record through the relation selector', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const loadOptions = vi.fn(async () => [{ label: 'TypeScript', value: 'tag-typescript' }])
    const onOperation = vi.fn(async () => undefined)
    const component = mountClient(RelationSelectorFixture, { target: container, props: { loadOptions, onOperation } })
    mounted.push({ component, container })
    container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click()
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Related record"]')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    if (select) {
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (position) {
      position.value = '3'
      position.dispatchEvent(new Event('input', { bubbles: true }))
    }
    document.querySelector<HTMLButtonElement>('.hp-relation-operation-form button[type="submit"]')?.click()
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith({ managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }))
  })

  it('views a related record without sending a mutation', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const onOperation = vi.fn(async () => undefined)
    const component = mountClient(RelationViewFixture, { target: container, props: { onOperation } })
    mounted.push({ component, container })

    container.querySelector<HTMLButtonElement>('[data-operation="view"]')?.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('TypeScript'))

    expect(document.querySelector('.hp-relation-operation-form button[type="submit"]')).toBeNull()
    expect(onOperation).not.toHaveBeenCalled()
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

  it('exposes every shell primitive with shared styling and accessible semantics', () => {
    expect(Object.keys(svelteShellPrimitives)).toHaveLength(16)
    expect(panelsSvelteStyle).toBe('@holo-js/panels-svelte/style.css')
    expect(SvelteButton.attributes.type).toBe('button')
    expect(SvelteModal.attributes).toMatchObject({ role: 'dialog', 'aria-modal': 'true' })
    expect(PanelsSlideOver).not.toBe(PanelsModal)
    expect(svelteShellPrimitives['toast-viewport'].attributes).toMatchObject({
      role: 'status',
      'aria-live': 'polite',
    })
  })

  it('renders all actual shell components with accessible semantics', () => {
    const { body } = renderServer(ServerShellFixture)
    const container = document.createElement('div')
    container.innerHTML = body
    const expected = [
      'button', 'link', 'badge', 'avatar', 'icon-button', 'input-wrapper', 'loading-indicator', 'dropdown',
      'modal', 'slide-over', 'tabs', 'section', 'empty-state', 'pagination', 'toast-viewport', 'error-boundary',
    ]

    for (const name of expected) expect(container.querySelector(`[data-panels-component="${name}"]`)).not.toBeNull()
    expect(container.querySelector('[data-panels-component="modal"]')?.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('[data-panels-component="slide-over"]')?.classList.contains('hp-slide-over')).toBe(true)
    expect(container.querySelector('[data-panels-component="tabs"] [role="tablist"]')).not.toBeNull()
    expect(container.querySelector('[data-panels-component="pagination"]')?.getAttribute('aria-label')).toBe('Pagination')
    expect(container.querySelector('[data-panels-component="toast-viewport"]')?.getAttribute('role')).toBe('region')
    expect(container.querySelector('[data-panels-component="error-boundary"]')?.getAttribute('role')).toBe('alert')
  })

  it('hydrates genuine SSR output without mismatch diagnostics', () => {
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerShellFixture, { props: { dialogsOpen: false } }).body
    document.body.append(container)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(ShellFixture, { target: container })
    mounted.push({ component, container })
    flushClient()

    expect(consoleError).not.toHaveBeenCalled()
    expect(container.querySelector('[data-panels-component="dropdown"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
  })

  it('supports dropdown selection and tab activation after client mount', async () => {
    const selected: string[] = []
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(InteractiveFixture, { props: { onselect: (id: string) => selected.push(id) }, target: container })
    mounted.push({ component, container })
    const dropdownTrigger = container.querySelector<HTMLButtonElement>('[data-panels-component="dropdown"] > button')

    expect(dropdownTrigger).not.toBeNull()
    dropdownTrigger?.focus()
    dropdownTrigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
    flushClient()
    await new Promise(resolve => setTimeout(resolve, 0))
    flushClient()
    expect(dropdownTrigger?.getAttribute('aria-expanded')).toBe('true')
    await vi.waitFor(() => expect(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).toHaveLength(2))
    const menuItems = document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    menuItems[1]?.click()
    flushClient()
    expect(selected).toEqual(['delete'])

    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[1]?.click()
    flushClient()
    await Promise.resolve()
    flushClient()
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
  })
})
