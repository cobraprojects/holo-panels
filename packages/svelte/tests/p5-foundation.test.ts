import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Component, flushSync, hydrate, unmount } from 'svelte'
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

const Component = (() => undefined) as unknown as SveltePanelComponent
const Override = (() => undefined) as unknown as SveltePanelComponent
const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let ssrServer: ViteDevServer
let ServerShellFixture: Component<{ onselect?: (id: string) => void }>
let renderServer: typeof render
let flushClient: typeof flushSync
let hydrateClient: typeof hydrate
let unmountClient: typeof unmount

beforeAll(async () => {
  ssrServer = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-vite-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  const module = await ssrServer.ssrLoadModule('/tests/ShellFixture.svelte')
  ServerShellFixture = module.default as Component<{ onselect?: (id: string) => void }>
  const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const svelteClient = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  flushClient = svelteClient.flushSync as typeof flushSync
  hydrateClient = svelteClient.hydrate as typeof hydrate
  unmountClient = svelteClient.unmount as typeof unmount
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
    expect(container.querySelector('[data-panels-component="tabs"]')?.getAttribute('role')).toBe('tablist')
    expect(container.querySelector('[data-panels-component="pagination"]')?.getAttribute('aria-label')).toBe('Pagination')
    expect(container.querySelector('[data-panels-component="toast-viewport"]')?.getAttribute('role')).toBe('region')
    expect(container.querySelector('[data-panels-component="error-boundary"]')?.getAttribute('role')).toBe('alert')
  })

  it('hydrates genuine SSR output without mismatch diagnostics', () => {
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerShellFixture).body
    document.body.append(container)
    const serverMarkup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(ShellFixture, { target: container })
    mounted.push({ component, container })
    flushClient()

    expect(container.innerHTML).toBe(serverMarkup)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('supports keyboard-only dropdown selection and tab navigation after hydration', () => {
    const selected: string[] = []
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerShellFixture).body
    document.body.append(container)
    const component = hydrateClient(ShellFixture, { props: { onselect: (id: string) => selected.push(id) }, target: container })
    mounted.push({ component, container })
    const dropdownTrigger = container.querySelector<HTMLButtonElement>('[data-panels-component="dropdown"] > button')

    dropdownTrigger?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
    flushClient()
    dropdownTrigger?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    flushClient()
    expect(selected).toEqual(['delete'])

    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[0]?.focus()
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    flushClient()
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
  })
})
