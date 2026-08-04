import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { JsonValue } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, hydrate, mount, unmount } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SvelteCustomEntryProps, SvelteEntryRendererProps, SvelteEntrySnapshot, SvelteEntryStore } from '../src/entries/contracts'
import { registerSvelteEntryRenderer } from '../src/entries'
import { SvelteComponentRegistry } from '../src/registry'
import EntryFixture from './P8AEntryFixture.svelte'

class EntryStore implements SvelteEntryStore {
  #listeners = new Set<(state: SvelteEntrySnapshot, previous: SvelteEntrySnapshot) => void>()
  snapshot: SvelteEntrySnapshot

  constructor(snapshot: SvelteEntrySnapshot) {
    this.snapshot = snapshot
  }

  subscribe(listener: (state: SvelteEntrySnapshot, previous: SvelteEntrySnapshot) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setState(value: JsonValue): void {
    const previous = this.snapshot
    this.snapshot = { ...previous, formattedState: value, state: value }
    for (const listener of this.#listeners) listener(this.snapshot, previous)
  }
}

interface FixtureProps {
  readonly entries: readonly SvelteEntryRendererProps[]
}

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let server: ViteDevServer
let ServerFixture: Component<FixtureProps>
let ServerCustomEntry: Component<SvelteCustomEntryProps>
let ServerEntrySlot: Component<Record<string, unknown>>
let renderServer: typeof render
let flushClient: typeof flushSync
let hydrateClient: typeof hydrate
let mountClient: typeof mount
let unmountClient: typeof unmount

function snapshot(type: string, state: JsonValue, overrides: Partial<SvelteEntrySnapshot> = {}): SvelteEntrySnapshot {
  return {
    actions: [],
    copyable: false,
    error: null,
    formattedState: state,
    id: `${type.replaceAll(':', '-')}-entry`,
    inlineLabel: false,
    label: type,
    pending: false,
    placeholder: 'Not available',
    properties: {},
    state,
    tooltip: null,
    type,
    url: null,
    ...overrides,
  }
}

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p8a-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  const fixtureModule = await server.ssrLoadModule('/tests/P8AEntryFixture.svelte')
  ServerFixture = fixtureModule.default as Component<FixtureProps>
  const customModule = await server.ssrLoadModule('/tests/P8ACustomEntry.svelte')
  ServerCustomEntry = customModule.default as Component<SvelteCustomEntryProps>
  const slotModule = await server.ssrLoadModule('/tests/P8AEntrySlot.svelte')
  ServerEntrySlot = slotModule.default as Component<Record<string, unknown>>
  const svelteServer = await server.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
  const require = createRequire(import.meta.url)
  const packagePath = require.resolve('svelte/package.json')
  const client = await import(pathToFileURL(resolve(dirname(packagePath), 'src/index-client.js')).href)
  flushClient = client.flushSync as typeof flushSync
  hydrateClient = client.hydrate as typeof hydrate
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

describe('P8-A Svelte entry renderer', () => {
  it('renders all built-ins with safe accessible semantics', () => {
    const entries = [
      snapshot('text', 'Published', { inlineLabel: true, properties: { badge: true }, tooltip: 'Current status' }),
      snapshot('boolean', true, { properties: { truthyIcon: 'circle-check' } }),
      snapshot('icon', false, { properties: { icon: 'star' } }),
      snapshot('image', 'https://example.com/avatar.png', { properties: { alt: 'Author avatar', circular: true, size: 72 } }),
      snapshot('color', '#336699'),
      snapshot('code', 'const safe = true', { properties: { language: 'typescript', lineNumbers: true } }),
      snapshot('key-value', { locale: 'en' }, { properties: { keyLabel: 'Attribute', valueLabel: 'Value' } }),
      snapshot('repeatable', ['First', 'Second'], { properties: { schema: ['title'] } }),
    ].map(entry => ({ store: new EntryStore(entry) }))
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerFixture, { props: { entries } }).body

    expect(container.querySelectorAll('[data-panels-entry]')).toHaveLength(8)
    expect(container.querySelector('.hp-entry-inline')?.getAttribute('title')).toBe('Current status')
    expect(container.querySelector('[aria-label="Yes"]')?.textContent).toBe('✓')
    expect(container.querySelector('[aria-label="No"]')?.textContent).toBe('✕')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/avatar.png')
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Author avatar')
    expect(container.querySelector('img')?.getAttribute('width')).toBe('72')
    expect(container.querySelector('img')?.classList.contains('hp-entry-image-circular')).toBe(true)
    expect(container.querySelector('[aria-label="Yes"]')?.getAttribute('data-icon')).toBe('circle-check')
    expect(container.querySelector('[aria-label="No"]')?.getAttribute('data-icon')).toBe('star')
    expect(container.querySelector('.hp-entry-badge')).not.toBeNull()
    expect(container.querySelector('.hp-entry-color')?.getAttribute('style')).toContain('#336699')
    expect(container.querySelector('code')?.getAttribute('data-language')).toBe('typescript')
    expect(container.querySelector('pre')?.getAttribute('data-line-numbers')).toBe('true')
    expect(container.querySelector('dl')?.getAttribute('aria-label')).toBe('Attribute / Value')
    expect(container.querySelector('ol')?.getAttribute('data-entry-schema')).toBe('title')
    expect(container.querySelector('dl')?.textContent).toContain('localeen')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
  })

  it('uses shared reactive state and executes copy and entry actions', async () => {
    const action = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } })
    const store = new EntryStore(snapshot('text', 'Initial', {
      actions: ['posts.edit'],
      copyable: true,
      error: 'Unable to refresh',
      url: 'javascript:alert(1)',
    }))
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(EntryFixture, { props: { entries: [{ action, store }] }, target: container })
    mounted.push({ component, container })
    flushClient()

    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Unable to refresh')
    store.setState('Updated')
    flushClient()
    expect(container.querySelector('.hp-entry-state')?.textContent).toBe('Updated')
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Copy')?.click()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'posts.edit')?.click()
    await Promise.resolve()
    await Promise.resolve()
    flushClient()
    expect(writeText).toHaveBeenCalledWith('Updated')
    expect(action).toHaveBeenCalledWith('posts.edit')
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied')
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Copy')?.click()
    await Promise.resolve()
    await Promise.resolve()
    flushClient()
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy failed')
  })

  it('resolves custom entries through the shared registry contract', () => {
    const registry = registerSvelteEntryRenderer(
      new SvelteComponentRegistry(),
      'acme:entry:rating',
      ServerCustomEntry,
    )
    const entries = [{ registry, store: new EntryStore(snapshot('acme:entry:rating', 5)) }]
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerFixture, { props: { entries } }).body

    expect(container.querySelector('[data-custom-entry]')?.textContent).toBe('5')
    expect(() => registry.resolve('acme:entry:missing', 'admin', 'entry "missing"'))
      .toThrow(/acme:entry:missing.*admin.*entry/u)
  })

  it('renders safe rich content with presentation attributes, layout, slots, and visibility', () => {
    const registry = new SvelteComponentRegistry()
    registry.register({ component: ServerEntrySlot, source: 'test', typeId: 'entry-prefix' })
    const entries = [
      {
        registry,
        store: new EntryStore(snapshot('text', '**Bold** <script>alert(1)</script> [safe](/posts/1)', {
          extraAttributes: { 'data-summary': 'true', class: 'summary-entry', onclick: 'alert(1)' },
          layout: { columnSpan: { default: 2 }, columnStart: { lg: 3 }, order: { md: 1 } },
          properties: { formats: [{ kind: 'markdown', rawHtml: false, value: true }] },
          slots: {
            before: [{ component: 'entry-prefix', order: -1, properties: { marker: 'prefix' }, source: 'component' }],
          },
        })),
      },
      {
        store: new EntryStore(snapshot('text', '<img src=x onerror=alert(1)>', {
          properties: { formats: [{ kind: 'rich-text', sanitizer: 'content.safe', structured: true }] },
        })),
      },
      { store: new EntryStore(snapshot('text', 'Hidden', { visible: false })) },
    ]
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerFixture, { props: { entries } }).body

    const summary = container.querySelector<HTMLElement>('[data-summary="true"]')
    expect(summary?.classList.contains('summary-entry')).toBe(true)
    expect(summary?.getAttribute('onclick')).toBeNull()
    expect(summary?.getAttribute('style')).toContain('--hp-schema-column-end-default:span 2')
    expect(summary?.querySelector('strong')?.textContent).toBe('Bold')
    expect(summary?.querySelector('script')).toBeNull()
    expect(summary?.textContent).toContain('<script>alert(1)</script>')
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe('/posts/1')
    expect(summary?.querySelector('[data-slot="prefix"]')?.textContent).toBe('Prefix')
    expect(container.querySelector('[data-entry-content="rich-text"]')?.getAttribute('data-sanitizer')).toBe('content.safe')
    expect(container.querySelector('[data-entry-content="rich-text"] img')).toBeNull()
    expect(container.textContent).not.toContain('Hidden')
  })

  it('hydrates deterministic server markup without mismatch diagnostics', () => {
    const entries = [{ store: new EntryStore(snapshot('text', 'Server state')) }]
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerFixture, { props: { entries } }).body
    document.body.append(container)
    const count = container.querySelectorAll('[data-panels-entry]').length
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(EntryFixture, { props: { entries }, target: container })
    mounted.push({ component, container })
    flushClient()

    expect(container.querySelectorAll('[data-panels-entry]')).toHaveLength(count)
    expect(consoleError).not.toHaveBeenCalled()
    expect(container.querySelector('.hp-entry-state')?.textContent).toBe('Server state')
  })
})
