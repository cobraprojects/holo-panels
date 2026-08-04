import type { JsonValue } from '@holo-js/panels-client'
import { createApp, createSSRApp, defineComponent, h, nextTick, type App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueEntryRenderer, registerVueEntryRenderer } from '../src/entries/renderer'
import type { VueEntryRendererProps, VueEntrySnapshot, VueEntryStore } from '../src/entries/types'
import { createComponentRegistry } from '../src/registry'

class EntryStore implements VueEntryStore {
  #listeners = new Set<(state: VueEntrySnapshot, previous: VueEntrySnapshot) => void>()
  snapshot: VueEntrySnapshot

  constructor(snapshot: VueEntrySnapshot) {
    this.snapshot = snapshot
  }

  subscribe(listener: (state: VueEntrySnapshot, previous: VueEntrySnapshot) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setState(value: JsonValue): void {
    const previous = this.snapshot
    this.snapshot = { ...previous, formattedState: value, state: value }
    for (const listener of this.#listeners) listener(this.snapshot, previous)
  }
}

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function snapshot(type: string, state: JsonValue, overrides: Partial<VueEntrySnapshot> = {}): VueEntrySnapshot {
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

function fixture(entries: readonly VueEntryRendererProps[]) {
  return defineComponent(() => () => h('div', entries.map(entry => h(VueEntryRenderer, { entry, key: entry.store.snapshot.id }))))
}

function mountEntries(entries: readonly VueEntryRendererProps[]): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(fixture(entries))
  app.mount(container)
  mounted.push({ app, container })
  return container
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.app.unmount()
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P8-A Vue entry renderer', () => {
  it('renders every built-in entry with accessible, safe semantics', () => {
    const entries = [
      snapshot('text', 'Published', { inlineLabel: true, properties: { badge: true }, tooltip: 'Current status' }),
      snapshot('boolean', true, { properties: { truthyIcon: 'circle-check' } }),
      snapshot('icon', false, { properties: { icon: 'star' } }),
      snapshot('image', 'https://example.com/avatar.png', { properties: { alt: 'Author avatar', circular: true, size: 72 } }),
      snapshot('color', '#336699'),
      snapshot('code', 'const safe = true', { properties: { language: 'typescript', lineNumbers: true } }),
      snapshot('key-value', { locale: 'en', role: 'admin' }, { properties: { keyLabel: 'Attribute', valueLabel: 'Value' } }),
      snapshot('repeatable', ['First', 'Second'], { properties: { schema: ['title'] } }),
    ].map(entry => ({ store: new EntryStore(entry) }))
    const container = mountEntries(entries)

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

  it('reacts to shared state and supports safe links, copy, actions, loading, and errors', async () => {
    const action = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } })
    const store = new EntryStore(snapshot('text', 'Initial', {
      actions: ['posts.edit'],
      copyable: true,
      error: 'Unable to refresh',
      url: 'javascript:alert(1)',
    }))
    const container = mountEntries([{ action, store }])

    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Unable to refresh')
    store.setState('Updated')
    await nextTick()
    expect(container.querySelector('.hp-entry-state')?.textContent).toBe('Updated')
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Copy')?.click()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'posts.edit')?.click()
    await Promise.resolve()
    await nextTick()
    expect(writeText).toHaveBeenCalledWith('Updated')
    expect(action).toHaveBeenCalledWith('posts.edit')
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied')
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Copy')?.click()
    await Promise.resolve()
    await nextTick()
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy failed')
  })

  it('resolves custom entries through the common panel registry contract', () => {
    const registry = createComponentRegistry()
    const Custom = defineComponent({
      props: { entry: { type: Object, required: true } },
      setup(props) {
        return () => h('output', { 'data-custom-entry': true }, String((props.entry as VueEntrySnapshot).state))
      },
    })
    registerVueEntryRenderer(registry, 'acme:entry:rating', Custom)
    const container = mountEntries([{
      panelId: 'admin',
      registry,
      store: new EntryStore(snapshot('acme:entry:rating', 5)),
    }])

    expect(container.querySelector('[data-custom-entry]')?.textContent).toBe('5')
    expect(() => mountEntries([{ registry, store: new EntryStore(snapshot('acme:entry:missing', null)) }]))
      .toThrow(/entry\.acme\.entry\.missing.*entry/u)
  })

  it('renders safe rich content with presentation attributes, layout, slots, and visibility', () => {
    const registry = createComponentRegistry()
    registry.register('entry-prefix', defineComponent({
      props: { marker: String },
      setup: props => () => h('span', { 'data-slot': props.marker }, 'Prefix'),
    }))
    const markdown = snapshot('text', '**Bold** <script>alert(1)</script> [safe](/posts/1)', {
      extraAttributes: { 'data-summary': 'true', class: 'summary-entry', onclick: 'alert(1)' },
      layout: { columnSpan: { default: 2 }, columnStart: { lg: 3 }, order: { md: 1 } },
      properties: { formats: [{ kind: 'markdown', rawHtml: false, value: true }] },
      slots: {
        before: [{ component: 'entry-prefix', order: -1, properties: { marker: 'prefix' }, source: 'component' }],
      },
    })
    const rich = snapshot('text', '<img src=x onerror=alert(1)>', {
      properties: { formats: [{ kind: 'rich-text', sanitizer: 'content.safe', structured: true }] },
    })
    const container = mountEntries([
      { registry, store: new EntryStore(markdown) },
      { store: new EntryStore(rich) },
      { store: new EntryStore(snapshot('text', 'Hidden', { visible: false })) },
    ])

    const summary = container.querySelector<HTMLElement>('[data-summary="true"]')
    expect(summary?.classList.contains('summary-entry')).toBe(true)
    expect(summary?.getAttribute('onclick')).toBeNull()
    expect(summary?.getAttribute('style')).toContain('--hp-schema-column-end-default: span 2')
    expect(summary?.querySelector('strong')?.textContent).toBe('Bold')
    expect(summary?.querySelector('script')).toBeNull()
    expect(summary?.textContent).toContain('<script>alert(1)</script>')
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe('/posts/1')
    expect(summary?.querySelector('[data-slot="prefix"]')?.textContent).toBe('Prefix')
    expect(container.querySelector('[data-entry-content="rich-text"]')?.getAttribute('data-sanitizer')).toBe('content.safe')
    expect(container.querySelector('[data-entry-content="rich-text"] img')).toBeNull()
    expect(container.textContent).not.toContain('Hidden')
  })

  it('hydrates deterministic entry markup without mismatch diagnostics', async () => {
    const entries = [{ store: new EntryStore(snapshot('text', 'Server state')) }]
    const Fixture = fixture(entries)
    const serverHtml = await renderToString(createSSRApp(Fixture))
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    const normalized = container.innerHTML
    document.body.append(container)
    const app = createSSRApp(Fixture)
    const warn = vi.fn()
    app.config.warnHandler = warn
    app.mount(container)
    mounted.push({ app, container })
    await nextTick()

    expect(warn).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(normalized)
  })
})
