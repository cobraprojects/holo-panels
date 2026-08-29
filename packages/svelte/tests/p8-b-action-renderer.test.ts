import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClientActionStore, type ClientActionManifest } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, hydrate, mount, unmount } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SvelteActionRendererProps } from '../src/actions/contracts'
import P8BActionFixture from './P8BActionFixture.svelte'
import P16ActionSlot from './P16ActionSlot.svelte'
import { SvelteComponentRegistry } from '../src/registry'

const manifest: ClientActionManifest = {
  badge: null,
  color: null,
  confirmation: 'Restore this record?',
  disabled: false,
  icon: 'check',
  id: 'posts.restore',
  kind: 'restore',
  label: 'Restore',
  mount: 'record',
  modal: {
    alignment: 'center',
    autofocus: true,
    cancelActionLabel: null,
    closeByClickingAway: true,
    closeByEscaping: true,
    content: null,
    description: null,
    footer: null,
    heading: null,
    icon: null,
    iconColor: null,
    nestedActions: [],
    schema: { components: [], id: 'restore-reason', kind: 'schema' },
    slideOver: false,
    stickyFooter: false,
    stickyHeader: false,
    submitActionLabel: null,
    width: 'medium',
  },
  size: 'medium',
  tooltip: null,
  type: 'core:action:restore',
  visible: true,
}

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let server: ViteDevServer
let ServerFixture: Component<{ action: SvelteActionRendererProps }>
let renderServer: typeof render
let flushClient: typeof flushSync
let hydrateClient: typeof hydrate
let mountClient: typeof mount
let unmountClient: typeof unmount

function createStore() {
  return new ClientActionStore<string>({
    createIdempotencyKey: () => 'request-00000001',
    transport: { execute: vi.fn(async () => ({ effects: [], items: [], result: 'restored', status: 'succeeded' as const })) },
  })
}

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p8b-${process.pid}`,
    logLevel: 'silent',
    optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
    plugins: [svelte()],
    resolve: {
      alias: [
        { find: /^svelte\/server$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/server/index.js') },
        { find: /^svelte\/internal\/server$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/internal/server/index.js') },
        { find: /^svelte$/u, replacement: resolve(process.cwd(), '../../node_modules/svelte/src/index-server.js') },
      ],
      dedupe: ['svelte'],
    },
    root: process.cwd(),
    server: { middlewareMode: true },
    ssr: {
      noExternal: ['bits-ui', 'runed', 'svelte-toolbelt'],
      optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
    },
  })
  const module = await server.ssrLoadModule('/tests/P8BActionFixture.svelte')
  ServerFixture = module.default as Component<{ action: SvelteActionRendererProps }>
  const svelteServer = await server.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const svelteClient = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  flushClient = svelteClient.flushSync as typeof flushSync
  hydrateClient = svelteClient.hydrate as typeof hydrate
  mountClient = svelteClient.mount as typeof mount
  unmountClient = svelteClient.unmount as typeof unmount
})

afterAll(async () => server?.close())

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await unmountClient(item.component)
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P8-B Svelte action renderer', () => {
  it('renders view modals through the shared read-only entry presentation', () => {
    const store = createStore()
    const view = { ...manifest, confirmation: null, kind: 'view' as const, modal: { ...manifest.modal!, readOnlyPresentation: { entries: [{ actions: [], copyable: false, defaultValue: true, id: 'posts-published', inlineLabel: false, label: 'Published', path: 'published', placeholder: null, properties: {}, type: 'boolean' }], kind: 'infolist' }, schema: null } }
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(P8BActionFixture, { props: { action: { action: view, store } }, target: container })
    mounted.push({ component, container })
    container.querySelector<HTMLButtonElement>('[data-action-id]')?.click()
    flushClient()
    expect(document.querySelector('[data-panels-entry="posts-published"] [role="img"]')?.getAttribute('aria-label')).toBe('Yes')
    expect(document.querySelector('[role="dialog"] form')).toBeNull()
  })

  it('renders grouped triggers and complete slide-over presentation with nested actions and slots', async () => {
    const store = createStore()
    const nested = { ...manifest, confirmation: null, id: 'posts.schedule', label: 'Schedule', modal: null }
    const presented = { ...manifest, confirmation: null, modal: { ...manifest.modal!, content: { component: 'action-content', properties: { message: 'Body slot' } }, description: 'Review restoration', footer: { component: 'action-footer', properties: { message: 'Footer slot' } }, heading: 'Restore post', nestedActions: [nested.id], slideOver: true, width: 'large' as const } }
    const registry = new SvelteComponentRegistry()
    registry.register({ component: P16ActionSlot, source: 'action test', typeId: 'action-content' })
    registry.register({ component: P16ActionSlot, source: 'action test', typeId: 'action-footer' })
    const action = { action: presented, actions: [presented, nested], groups: [{ actions: [presented.id], color: null, icon: null, id: 'publishing', label: 'Publishing' }], registry, store }
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(P8BActionFixture, { props: { action }, target: container })
    mounted.push({ component, container })
    flushClient()
    const publishing = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Publishing')
    expect(publishing).toBeDefined()
    publishing?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
    flushClient()
    await new Promise(resolve => setTimeout(resolve, 0))
    flushClient()
    const restore = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'Restore')
    expect(restore).toBeDefined()
    restore?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    flushClient()
    await Promise.resolve()
    flushClient()
    const dialog = document.querySelector('[role="dialog"]')
    const slideOver = document.querySelector('[data-panels-component="slide-over"]')
    expect(dialog).not.toBeNull()
    expect(slideOver).not.toBeNull()
    expect(slideOver?.getAttribute('data-modal-width')).toBe('large')
    expect(slideOver?.textContent).toContain('Restore post')
    expect(slideOver?.textContent).toContain('Review restoration')
    expect(slideOver?.textContent).toContain('Body slot')
    expect(slideOver?.textContent).toContain('Footer slot')
    Array.from(slideOver?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Schedule')?.click()
    flushClient()
    expect(store.activeFrame?.manifest.id).toBe('posts.schedule')
  })

  it('runs modal confirmation and schema flows and closes nested actions with Escape', async () => {
    const store = createStore()
    const action = { action: manifest, recordIds: [11], store }
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(P8BActionFixture, { props: { action }, target: container })
    mounted.push({ component, container })
    const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="posts.restore"]')
    expect(trigger?.classList.contains('hp-action-trigger')).toBe(true)
    expect(trigger?.getAttribute('data-variant')).toBe('outline')
    expect(trigger?.querySelector('[data-icon="check"][data-slot="icon"]')).not.toBeNull()
    flushClient()

    container.querySelector<HTMLButtonElement>('button')?.click()
    flushClient()
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Restore this record?')
    expect(Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Confirm')?.querySelector('[data-icon="check"]')).not.toBeNull()
    Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')?.click()
    flushClient()
    expect(document.querySelector('[data-schema-id="restore-reason"]')).not.toBeNull()
    store.activeForm?.applyServerPatch({ errors: { _root: ['Review the entire form'] } })
    flushClient()
    expect(document.querySelector('form [data-form-errors]')?.textContent).toContain('Review the entire form')
    store.setInput({ reason: 'Requested' })
    document.querySelector<HTMLFormElement>('[data-panels-component="modal"] form')?.requestSubmit()
    await Promise.resolve()
    flushClient()
    await vi.waitFor(() => expect(store.activeFrame).toBeNull())

    store.mount({ ...manifest, confirmation: null })
    store.mount({ ...manifest, confirmation: null, id: 'posts.notice', label: 'Notice', modal: null, mount: 'notification' })
    flushClient()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Notice')
    document.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    flushClient()
    expect(store.activeFrame?.manifest.id).toBe('posts.restore')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Restore')
  })

  it('does not open a transient dialog when a non-modal action finishes', async () => {
    const store = createStore()
    const action = { ...manifest, confirmation: null, modal: null }
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(P8BActionFixture, { props: { action: { action, store } }, target: container })
    mounted.push({ component, container })
    store.mount(action)
    await store.submit()
    flushClient()
    expect(store.activeFrame?.phase).toBe('succeeded')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('hydrates server-rendered action markup without mismatch diagnostics', () => {
    const store = createStore()
    const action = { action: manifest, store }
    const markup = renderServer(ServerFixture, { props: { action } }).body
    const container = document.createElement('div')
    container.innerHTML = markup
    document.body.append(container)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(P8BActionFixture, { props: { action }, target: container })
    mounted.push({ component, container })
    flushClient()
    expect(container.querySelector('[data-action-id="posts.restore"]')).not.toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
