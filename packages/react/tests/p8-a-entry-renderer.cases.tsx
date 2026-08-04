import { act, createElement, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { EntryStateStore, type EntryClientManifest, type JsonValue } from '@holo-js/panels-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactEntryRenderer, registerReactEntryRenderer } from '../src/entries/renderer'
import type { ReactCustomEntryProps, ReactEntryRendererProps } from '../src/entries/types'
import { createComponentRegistry } from '../src/registry'

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function manifest(type: string, state: JsonValue, overrides: Partial<EntryClientManifest> = {}): EntryClientManifest {
  return {
    actions: [],
    copyable: false,
    defaultValue: state,
    extraAttributes: {},
    formatters: [],
    inlineLabel: false,
    label: type,
    layout: {},
    path: null,
    placeholder: 'Not available',
    properties: {},
    slots: {},
    type,
    visible: true,
    ...overrides,
  }
}

function store(type: string, state: JsonValue, overrides: Partial<EntryClientManifest> = {}): EntryStateStore {
  return new EntryStateStore(`${type.replaceAll(':', '-')}-entry`, manifest(type, state, overrides))
}

function Fixture({ entries }: { readonly entries: readonly ReactEntryRendererProps[] }): ReactNode {
  return <div>{entries.map(entry => <ReactEntryRenderer key={entry.store.snapshot.id} {...entry} />)}</div>
}

function mount(entries: readonly ReactEntryRendererProps[]): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push({ container, unmount: () => root.unmount() })
  act(() => root.render(<Fixture entries={entries} />))
  return container
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P8-A React entry renderer', () => {
  it('renders every built-in entry with accessible safe semantics', () => {
    const entries = [
      store('text', 'Published', { inlineLabel: true, properties: { badge: true } }),
      store('boolean', true, { properties: { truthyIcon: 'circle-check' } }),
      store('icon', false, { properties: { icon: 'star' } }),
      store('image', 'https://example.com/avatar.png', { properties: { alt: 'Author avatar', circular: true, size: 72 } }),
      store('color', '#336699'),
      store('code', 'const safe = true', { properties: { language: 'typescript', lineNumbers: true } }),
      store('key-value', { locale: 'en' }, { properties: { keyLabel: 'Attribute', valueLabel: 'Value' } }),
      store('repeatable', ['First', 'Second'], { properties: { schema: ['title'] } }),
    ].map(entryStore => ({ store: entryStore }))
    const container = mount(entries)

    expect(container.querySelectorAll('[data-panels-entry]')).toHaveLength(8)
    expect(container.querySelector('.hp-entry-inline')).not.toBeNull()
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
    const entryStore = store('text', 'Initial', { actions: ['posts.edit'], copyable: true })
    entryStore.setResolved({ tooltip: 'Current title', url: 'javascript:alert(1)' })
    const container = mount([{ action, store: entryStore }])

    expect(container.querySelector('a')).toBeNull()
    act(() => entryStore.setState('Updated'))
    expect(container.querySelector('.hp-entry-state')?.textContent).toBe('Updated')
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    await act(async () => buttons.find(button => button.textContent === 'Copy')?.click())
    await act(async () => buttons.find(button => button.textContent === 'posts.edit')?.click())
    expect(writeText).toHaveBeenCalledWith('Updated')
    expect(action).toHaveBeenCalledWith('posts.edit')
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied')
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    await act(async () => buttons.find(button => button.textContent === 'Copy')?.click())
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy failed')

    await act(async () => entryStore.hydrate(async () => {
      throw new Error('Unable to refresh')
    }))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Unable to refresh')
  })

  it('resolves custom entries through the common registry contract', () => {
    const registry = createComponentRegistry()
    function Custom({ entry }: ReactCustomEntryProps): ReactNode {
      return <output data-custom-entry>{String(entry.state)}</output>
    }
    registerReactEntryRenderer(registry, 'acme:entry:rating', Custom)
    const container = mount([{ registry, store: store('acme:entry:rating', 5) }])

    expect(container.querySelector('[data-custom-entry]')?.textContent).toBe('5')
    expect(() => renderToString(<Fixture entries={[{ registry, store: store('acme:entry:missing', null) }]} />))
      .toThrow(/entry\.acme\.entry\.missing.*entry/u)
  })

  it('renders inferred presentation metadata, ordered slots, and safe rich content', () => {
    const registry = createComponentRegistry()
      .register('entry-prefix', ({ marker }: { readonly marker?: string }) => <span data-slot={marker}>Prefix</span>)
      .register('entry-suffix', () => <span data-slot="suffix">Suffix</span>)
    const markdown = store('text', '**Bold** <script>alert(1)</script> [safe](/posts/1)', {
      extraAttributes: { 'data-summary': 'true', className: 'summary-entry', onclick: 'alert(1)' },
      layout: { columnSpan: { default: 2 }, columnStart: { lg: 3 }, order: { md: 1 } },
      properties: { formats: [{ kind: 'markdown', rawHtml: false, value: true }] },
      slots: {
        after: [{ component: 'entry-suffix', order: 2, properties: {}, source: 'component' }],
        before: [{ component: 'entry-prefix', order: -1, properties: { marker: 'prefix' }, source: 'component' }],
      },
    })
    const rich = store('text', '<img src=x onerror=alert(1)>', {
      properties: { formats: [{ kind: 'rich-text', sanitizer: 'content.safe', structured: true }] },
    })
    const hidden = store('text', 'Hidden', { visible: false })
    const container = mount([{ registry, store: markdown }, { store: rich }, { store: hidden }])

    const summary = container.querySelector<HTMLElement>('[data-summary="true"]')
    expect(summary?.classList.contains('summary-entry')).toBe(true)
    expect(summary?.getAttribute('onclick')).toBeNull()
    expect(summary?.getAttribute('style')).toContain('--hp-schema-column-end-default: span 2')
    expect(summary?.querySelector('strong')?.textContent).toBe('Bold')
    expect(summary?.querySelector('script')).toBeNull()
    expect(summary?.textContent).toContain('<script>alert(1)</script>')
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe('/posts/1')
    expect(Array.from(summary?.querySelectorAll('[data-slot]') ?? []).map(node => node.textContent)).toEqual(['Prefix', 'Suffix'])
    expect(container.querySelector('[data-entry-content="rich-text"]')?.getAttribute('data-sanitizer')).toBe('content.safe')
    expect(container.querySelector('[data-entry-content="rich-text"] img')).toBeNull()
    expect(container.textContent).not.toContain('Hidden')
  })

  it('hydrates deterministic server markup without mismatch diagnostics', async () => {
    const entries = [{ store: store('text', 'Server state') }]
    const element = createElement(Fixture, { entries })
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    document.body.append(container)
    const markup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined

    await act(async () => {
      root = hydrateRoot(container, element)
      await Promise.resolve()
    })
    if (!root) throw new Error('React entry hydration did not create a root.')
    roots.push({ container, unmount: () => root?.unmount() })
    expect(container.innerHTML).toBe(markup)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
