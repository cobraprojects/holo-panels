import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import { createComponentRegistry } from '../src/registry'
import { ReactSchemaRenderer, registerReactSchemaRenderer } from '../src/schema/renderer'

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function component(kind: SchemaComponentManifest['kind'], overrides: Partial<SchemaComponentManifest> = {}): SchemaComponentManifest {
  return {
    children: [],
    dynamicVisibility: false,
    extraAttributes: {},
    id: kind,
    key: kind,
    kind,
    layout: {},
    properties: {},
    slots: {},
    type: kind,
    visible: true,
    ...overrides,
  }
}

function schema(components: readonly SchemaComponentManifest[]): SchemaManifest {
  return { components, id: 'profile', kind: 'schema', statePath: 'profile' }
}

function mount(value: ReactNode): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push({ container, unmount: () => root.unmount() })
  act(() => root.render(value))
  return container
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  window.localStorage.clear()
})

describe('P16 React compiled schema renderer', () => {
  it('moves tab focus in the visual direction in RTL', () => {
    const tabs = component('tabs', {
      children: ['First', 'Second', 'Third'].map(label => component('tab', { id: label, key: label, properties: { label } })),
    })
    const container = mount(<div dir="rtl"><ReactSchemaRenderer panelId="admin" registry={createComponentRegistry()} schema={schema([tabs])} /></div>)
    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons[0]?.focus()

    act(() => buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' })))

    expect(document.activeElement).toBe(buttons[1])
    expect(buttons[1]?.getAttribute('aria-selected')).toBe('true')
  })

  it('renders shared entry, filter, and widget leaves through inferred content hooks', () => {
    const leaves = (['entry', 'filter', 'widget'] as const).map(kind => component(kind, {
      properties: { leaf: { definition: { id: `${kind}-definition` }, kind } },
    }))
    const html = renderToString(<ReactSchemaRenderer
      panelId="admin"
      registry={createComponentRegistry()}
      renderContent={({ component: item }) => <span>{String(item.properties.leaf?.definition.id)}</span>}
      schema={schema(leaves)}
    />)

    expect(html.match(/data-schema-leaf=/gu)).toHaveLength(3)
    expect(html).toContain('entry-definition')
    expect(html).toContain('filter-definition')
    expect(html).toContain('widget-definition')
  })

  it('renders every built-in layout with semantic structure and responsive metadata', () => {
    const tree = component('grid', {
      children: [
        component('section', { children: [component('group', { properties: { heading: 'Account' } })], properties: { description: 'Profile settings', heading: 'Profile' } }),
        component('fieldset', { properties: { label: 'Contact details' } }),
        component('split', { children: [component('callout', { properties: { color: 'info', description: 'Check this', heading: 'Notice', icon: 'info' } }), component('empty-state', { properties: { description: 'Create one', heading: 'No records' } })], properties: { splitFrom: 'md' } }),
      ],
      layout: { columns: { default: 1, lg: 3 }, columnSpan: { default: 'full', md: 2 }, order: { default: 2 } },
    })
    const html = renderToString(<ReactSchemaRenderer panelId="admin" registry={createComponentRegistry()} schema={schema([tree])} />)

    expect(html).toContain('data-schema-id="profile"')
    expect(html).toContain('class="hp-schema-node hp-schema-grid"')
    expect(html).toContain('--hp-schema-columns-default:1')
    expect(html).toContain('--hp-schema-columns-lg:3')
    expect(html).toContain('data-split-from="md"')
    expect(html).toContain('<section')
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend>Contact details</legend>')
    expect(html).toContain('role="note"')
    expect(html).toContain('aria-label="No records"')
  })

  it('supports accessible tabs, wizard navigation, collapsed persistence, and visibility', () => {
    const tabs = component('tabs', {
      children: [
        component('tab', { key: 'one', properties: { label: 'First' } }),
        component('tab', { key: 'two', properties: { label: 'Second' } }),
        component('tab', { key: 'hidden', properties: { label: 'Secret' }, visible: false }),
      ],
      properties: { label: 'Details', persistenceKey: 'details' },
    })
    const wizard = component('wizard', {
      children: [component('step', { key: 'start', properties: { label: 'Start' } }), component('step', { key: 'finish', properties: { label: 'Finish' } })],
      properties: { persistenceKey: 'setup' },
    })
    const section = component('section', { properties: { collapse: { collapsed: true, collapsible: true, persistenceKey: 'advanced' }, heading: 'Advanced' } })
    const container = mount(<ReactSchemaRenderer
      panelId="admin"
      registry={createComponentRegistry()}
      renderContent={({ component: item, panelId, schema: manifest }) => <span data-panel-id={panelId} data-schema-id={manifest.id}>{item.key}-content</span>}
      schema={schema([tabs, wizard, section])}
    />)

    const tabButtons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    expect(tabButtons).toHaveLength(2)
    expect(container.querySelector('[data-panel-id="admin"]')?.getAttribute('data-schema-id')).toBe('profile')
    expect(container.textContent).not.toContain('Secret')
    expect(tabButtons[0]?.getAttribute('aria-selected')).toBe('true')
    act(() => tabButtons[1]?.click())
    expect(tabButtons[1]?.getAttribute('aria-selected')).toBe('true')
    expect(window.localStorage.getItem('holo-panels:tabs:details')).toBe('1')
    const next = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Next')
    act(() => next?.click())
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe('Finish')
    expect(window.localStorage.getItem('holo-panels:wizard:setup')).toBe('1')
    const collapseTrigger = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Advanced')
    expect(collapseTrigger?.getAttribute('aria-expanded')).toBe('false')
    act(() => collapseTrigger?.click())
    expect(collapseTrigger?.getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('holo-panels:collapse:advanced')).toBe('true')
  })

  it('resolves scoped slots and custom components while rejecting unsafe DOM attributes', () => {
    const registry = createComponentRegistry()
      .register('profile.before', ({ placement }: { readonly placement: string }) => <span>{`${placement} slot`}</span>)
    registerReactSchemaRenderer(registry, 'acme:profile-card', ({ children, properties }) => <article data-message={String(properties.message)}>{children}</article>)
    const custom = component('custom', {
      extraAttributes: {
        'aria-label': 'Safe label',
        'data-testid': 'custom',
        className: 'safe-class',
        dangerouslySetInnerHTML: { __html: '<img src=x onerror=alert(1)>' },
        onClick: 'alert(1)',
        style: { backgroundImage: 'url(javascript:alert(1))' },
      },
      properties: { customProperties: { message: '<script>alert(1)</script>' }, customType: 'acme:profile-card' },
      slots: { before: [{ component: 'profile.before', order: 0, properties: {}, source: 'component' }] },
    })
    const html = renderToString(<ReactSchemaRenderer panelId="admin" registry={registry} schema={schema([custom])} />)

    expect(html).toContain('before slot')
    expect(html).toContain('data-message="&lt;script&gt;alert(1)&lt;/script&gt;"')
    expect(html).not.toContain('dangerouslySetInnerHTML')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })
})
