import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import type { SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import { createComponentRegistry } from '../src/registry'
import { VueSchemaRenderer } from '../src/schemas/renderer'

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function node(
  id: string,
  kind: SchemaComponentManifest['kind'],
  options: Partial<SchemaComponentManifest> = {},
): SchemaComponentManifest {
  return {
    children: [],
    dynamicVisibility: false,
    extraAttributes: {},
    id,
    key: id,
    kind,
    layout: {},
    properties: {},
    slots: {},
    type: kind,
    visible: true,
    ...options,
  }
}

function mount(
  schema: SchemaManifest,
  registry = createComponentRegistry(),
  renderContent?: (props: { readonly component: SchemaComponentManifest, readonly panelId: string, readonly schema: SchemaManifest }) => string,
): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const component = defineComponent(() => () => h(VueSchemaRenderer, { panelId: 'admin', registry, renderContent, schema }))
  const app = createApp(component)
  app.mount(container)
  mounted.push({ app, container })
  return container
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.app.unmount()
    item.container.remove()
  }
  localStorage.clear()
})

describe('Vue compiled schema renderer', () => {
  it('renders shared entry, filter, and widget leaves through content hooks', () => {
    const leaves = (['entry', 'filter', 'widget'] as const).map(kind => node(kind, kind, {
      properties: { leaf: { definition: { id: `${kind}-definition` }, kind } },
    }))
    const container = mount(
      { components: leaves, id: 'shared-leaves', kind: 'schema' },
      createComponentRegistry(),
      ({ component }) => String(component.properties.leaf?.definition.id),
    )

    expect(container.querySelectorAll('[data-schema-leaf]')).toHaveLength(3)
    expect(container.textContent).toContain('entry-definition')
    expect(container.textContent).toContain('filter-definition')
    expect(container.textContent).toContain('widget-definition')
  })

  it('renders every layout kind, slots, custom components, and responsive metadata', () => {
    const registry = createComponentRegistry()
      .register('app.schema.before', defineComponent(() => () => h('span', { 'data-slot': 'before' }, 'Before')))
      .register('schema.app.banner', defineComponent({
        props: { properties: { type: Object, required: true }, schemaComponentId: { type: String, required: true } },
        setup: props => () => h('output', { 'data-custom': props.schemaComponentId }, String(Reflect.get(props.properties, 'message'))),
      }))
    const schema: SchemaManifest = {
      components: [node('grid', 'grid', {
        dynamicVisibility: true,
        extraAttributes: { 'data-safe': 'yes', class: 'application-grid' },
        layout: {
          columns: { default: 1, md: 3 },
          columnSpan: { default: 'full', md: 2 },
          columnStart: { md: 2 },
          order: { default: 4 },
        },
        slots: { before: [{ component: 'app.schema.before', order: 0, properties: {}, source: 'component' }] },
        children: [
          node('section', 'section', { properties: { heading: 'Section', description: 'Description' }, children: [node('group', 'group')] }),
          node('fieldset', 'fieldset', { properties: { label: 'Details' } }),
          node('tabs', 'tabs', { children: [node('tab-one', 'tab', { properties: { label: 'First' } }), node('tab-two', 'tab', { properties: { label: 'Second' } })] }),
          node('wizard', 'wizard', { children: [node('step-one', 'step', { properties: { label: 'Start' } }), node('step-two', 'step', { properties: { label: 'Finish' } })] }),
          node('split', 'split', { properties: { splitFrom: 'lg' } }),
          node('callout', 'callout', { properties: { color: 'warning', heading: 'Notice', icon: 'info' } }),
          node('empty', 'empty-state', { properties: { description: 'Nothing here', heading: 'Empty' } }),
          node('custom', 'custom', { properties: { customProperties: { message: 'Rendered' }, customType: 'app.banner' }, type: 'app.banner' }),
        ],
      })],
      id: 'profile',
      kind: 'schema',
      statePath: 'profile',
    }
    const container = mount(schema, registry)
    const grid = container.querySelector<HTMLElement>('.hp-schema-grid')

    expect(container.querySelector('.hp-schema')?.getAttribute('data-state-path')).toBe('profile')
    expect(grid?.classList.contains('application-grid')).toBe(true)
    expect(grid?.dataset.safe).toBe('yes')
    expect(grid?.dataset.dynamicVisibility).toBe('true')
    expect(grid?.style.getPropertyValue('--hp-schema-columns-md')).toBe('3')
    expect(grid?.style.getPropertyValue('--hp-schema-column-start-default')).toBe('1')
    expect(grid?.style.getPropertyValue('--hp-schema-column-end-default')).toBe('-1')
    expect(grid?.style.getPropertyValue('--hp-schema-column-end-md')).toBe('span 2')
    expect(grid?.style.getPropertyValue('--hp-schema-order-default')).toBe('4')
    expect(container.querySelector('[data-slot="before"]')?.textContent).toBe('Before')
    expect(container.querySelector('fieldset legend')?.textContent).toBe('Details')
    expect(container.querySelector('[role="tablist"]')).not.toBeNull()
    expect(container.querySelector('nav[aria-label="Wizard progress"]')).not.toBeNull()
    expect(container.querySelector('.hp-schema-split')?.getAttribute('data-split-from')).toBe('lg')
    expect(container.querySelector('.hp-schema-callout')?.getAttribute('role')).toBe('note')
    expect(container.querySelector('.hp-schema-empty-state')?.getAttribute('aria-label')).toBe('Empty')
    expect(container.querySelector('[data-custom="custom"]')?.textContent).toBe('Rendered')
  })

  it('supports accessible tabs, wizard navigation, collapse state, persistence, and visibility', async () => {
    const schema: SchemaManifest = {
      components: [
        node('hidden', 'callout', { visible: false, properties: { heading: 'Do not render' } }),
        node('section', 'section', {
          properties: { collapse: { collapsible: true, collapsed: true, persistenceKey: 'account' }, heading: 'Account' },
          children: [node('inside', 'callout', { properties: { heading: 'Inside' } })],
        }),
        node('tabs', 'tabs', {
          properties: { persistenceKey: 'preferences' },
          children: [node('first', 'tab', { properties: { label: 'First' } }), node('second', 'tab', { properties: { label: 'Second' } })],
        }),
        node('wizard', 'wizard', {
          properties: { persistenceKey: 'setup' },
          children: [node('start', 'step', { properties: { label: 'Start' } }), node('finish', 'step', { properties: { label: 'Finish' } })],
        }),
      ],
      id: 'settings',
      kind: 'schema',
    }
    const container = mount(schema)
    const collapse = container.querySelector<HTMLButtonElement>('button[aria-controls*="section-content"]')

    expect(container.textContent).not.toContain('Do not render')
    expect(collapse?.getAttribute('aria-expanded')).toBe('false')
    collapse?.click()
    await nextTick()
    expect(collapse?.getAttribute('aria-expanded')).toBe('true')
    expect(localStorage.getItem('holo-panels:settings:collapse:account')).toBe('true')

    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[1]?.click()
    await nextTick()
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
    expect(localStorage.getItem('holo-panels:settings:tabs:preferences')).toBe('1')
    tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }))
    await nextTick()
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')

    const next = Array.from(container.querySelectorAll<HTMLButtonElement>('.hp-schema-wizard-navigation button'))
      .find(button => button.textContent === 'Next')
    next?.click()
    await nextTick()
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Finish')
    expect(localStorage.getItem('holo-panels:settings:wizard:setup')).toBe('1')
  })

  it('drops hostile DOM attributes and renders untrusted text without HTML interpretation', () => {
    const payload = '<img src=x onerror=alert(1)>'
    const schema: SchemaManifest = {
      components: [node('unsafe', 'callout', {
        extraAttributes: {
          'aria-label': 'Safe label',
          'data-test': 'safe',
          href: 'javascript:alert(1)',
          innerHTML: payload,
          onClick: 'alert(1)',
          style: 'background:url(javascript:alert(1))',
        },
        properties: { description: payload, heading: payload },
      })],
      id: 'security',
      kind: 'schema',
    }
    const container = mount(schema)
    const callout = container.querySelector<HTMLElement>('.hp-schema-callout')

    expect(callout?.getAttribute('aria-label')).toBe('Safe label')
    expect(callout?.dataset.test).toBe('safe')
    expect(callout?.hasAttribute('href')).toBe(false)
    expect(callout?.hasAttribute('onclick')).toBe(false)
    expect(callout?.getAttribute('style')).toBe(null)
    expect(container.querySelector('img')).toBeNull()
    expect(callout?.textContent).toContain(payload)
  })

  it('passes the panel and complete manifest to content renderers', () => {
    const schema: SchemaManifest = {
      components: [node('content', 'section')],
      id: 'content-schema',
      kind: 'schema',
    }
    const container = mount(schema, createComponentRegistry(), ({ component, panelId, schema: manifest }) => `${panelId}:${manifest.id}:${component.id}`)

    expect(container.textContent).toContain('admin:content-schema:content')
  })
})
