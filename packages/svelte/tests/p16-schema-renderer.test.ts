import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, mount, unmount } from 'svelte'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import { isSchemaManifest, safeDomAttributes } from '../src/schemas/helpers'
import P16SchemaFixture from './P16SchemaFixture.svelte'

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let server: ViteDevServer
let flushClient: typeof flushSync
let mountClient: typeof mount
let unmountClient: typeof unmount

function node(
  kind: SchemaComponentManifest['kind'],
  id: string,
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
    type: `panels:${kind}`,
    visible: true,
    ...options,
  }
}

function schema(): SchemaManifest {
  const custom = (id: string, message: string): SchemaComponentManifest => node('custom', id, {
    properties: { customProperties: { message }, customType: 'acme:review' },
    statePath: `values.${id}`,
  })
  return {
    components: [
      node('grid', 'grid', {
        children: [
          node('section', 'section', {
            children: [
              node('group', 'group', {
                children: [node('fieldset', 'fieldset', {
                  children: [custom('primary', '<script>alert(1)</script>')],
                  properties: { label: 'Details', collapse: { collapsible: true, collapsed: false } },
                })],
              }),
            ],
            properties: { collapse: { collapsible: true, collapsed: true, persistenceKey: 'section' }, description: 'Summary', heading: '<img src=x onerror=alert(1)>' },
            slots: {
              above: [{ component: 'acme:slot', order: 0, properties: {}, source: 'component' }],
              after: [{ component: 'acme:slot', order: 0, properties: {}, source: 'component' }],
              before: [{ component: 'acme:slot', order: 0, properties: {}, source: 'component' }],
              below: [{ component: 'acme:slot', order: 0, properties: {}, source: 'component' }],
            },
          }),
          node('tabs', 'tabs', {
            children: [
              node('tab', 'first-tab', { children: [custom('tab-one', 'First tab')], properties: { label: 'First' } }),
              node('tab', 'second-tab', { children: [custom('tab-two', 'Second tab')], properties: { label: 'Second' } }),
            ],
            properties: { label: 'Account sections', persistenceKey: 'tabs' },
          }),
          node('wizard', 'wizard', {
            children: [
              node('step', 'first-step', { children: [custom('step-one', 'First step')], properties: { description: 'Start here', label: 'Start' } }),
              node('step', 'second-step', { children: [custom('step-two', 'Second step')], properties: { label: 'Finish' } }),
            ],
            properties: { label: 'Setup progress', persistenceKey: 'wizard' },
          }),
          node('split', 'split', { children: [custom('split-content', 'Split content')], properties: { splitFrom: 'md' } }),
          node('callout', 'callout', {
            extraAttributes: { 'aria-label': 'Safe note', 'data-proof': 'kept', class: 'accent', onclick: 'alert(1)', style: 'background:url(javascript:alert(1))', title: 'Safe title' },
            properties: { color: 'warning', description: 'Read carefully', heading: 'Notice', icon: 'warning' },
          }),
          node('empty-state', 'empty', { properties: { description: 'Nothing yet', heading: 'No records', icon: 'inbox' } }),
          node('entry', 'entry-leaf', { properties: { leaf: { definition: { id: 'title' }, kind: 'entry' } } }),
          node('filter', 'filter-leaf', { properties: { leaf: { definition: { id: 'published' }, kind: 'filter' } } }),
          node('widget', 'widget-leaf', { properties: { leaf: { definition: { id: 'overview' }, kind: 'widget' } } }),
          node('callout', 'hidden', { properties: { heading: 'Secret' }, visible: false }),
        ],
        dynamicVisibility: true,
        layout: { columns: { default: 1, lg: 3 }, columnSpan: { default: 'full', md: 2 }, order: { default: 1 } },
      }),
    ],
    id: 'profile',
    kind: 'schema',
    statePath: 'values',
  }
}

function mountFixture(value = schema()): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const instance = mountClient(P16SchemaFixture, { props: { schema: value }, target: container })
  mounted.push({ component: instance, container })
  flushClient()
  return container
}

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-schema-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  await server.ssrLoadModule('/tests/P16SchemaFixture.svelte')
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
  localStorage.clear()
})

describe('Svelte compiled schema renderer', () => {
  it('renders every layout kind with visibility, metadata, slots, and registry components', () => {
    const container = mountFixture()
    const grid = container.querySelector<HTMLElement>('[data-schema-id="grid"]')
    const callout = container.querySelector<HTMLElement>('[data-schema-id="callout"]')

    expect(grid?.dataset.layoutColumns).toBe('{"default":1,"lg":3}')
    expect(grid?.dataset.layoutColumnSpan).toBe('{"default":"full","md":2}')
    expect(grid?.dataset.dynamicVisibility).toBe('true')
    expect(container.querySelectorAll('[data-slot-owner="section"]')).toHaveLength(4)
    expect(container.querySelector('[data-custom-id="primary"]')?.getAttribute('data-custom-state')).toBe('values.primary')
    expect(container.querySelector('[data-schema-id="split"]')?.getAttribute('data-split-from')).toBe('md')
    expect(callout?.classList.contains('accent')).toBe(true)
    expect(callout?.getAttribute('data-proof')).toBe('kept')
    expect(callout?.getAttribute('title')).toBe('Safe title')
    expect(container.querySelector('[data-schema-id="empty"]')?.textContent).toContain('No records')
    expect(container.querySelector('[data-schema-content="grid"]')?.textContent).toBe('admin:profile')
    expect(container.querySelectorAll('[data-schema-leaf]')).toHaveLength(3)
    expect(container.querySelector('[data-schema-content="entry-leaf"]')?.textContent).toBe('admin:profile')
    expect(container.textContent).not.toContain('Secret')
  })

  it('supports accessible collapse, tab, and wizard interactions', () => {
    const container = mountFixture()
    const section = container.querySelector<HTMLElement>('[data-schema-id="section"]')
    const collapse = section?.querySelector<HTMLButtonElement>('button[aria-expanded]')
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')

    expect(collapse?.getAttribute('aria-expanded')).toBe('false')
    collapse?.click()
    tabs[1]?.click()
    container.querySelector<HTMLButtonElement>('[data-schema-id="wizard"] > button:last-child')?.click()
    flushClient()

    expect(collapse?.getAttribute('aria-expanded')).toBe('true')
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain('Second tab')
    expect(container.querySelector('[data-schema-id="wizard"] [aria-current="step"]')?.textContent).toContain('Finish')
    expect(container.querySelector('[data-schema-id="wizard"] section')?.textContent).toContain('Second step')
  })

  it('escapes hostile content and rejects executable extra attributes', () => {
    const container = mountFixture()
    const callout = container.querySelector<HTMLElement>('[data-schema-id="callout"]')

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(callout?.getAttribute('onclick')).toBeNull()
    expect(callout?.getAttribute('style')).toBeNull()
    expect(safeDomAttributes({ href: 'javascript:alert(1)', onmouseover: 'alert(1)', role: 'note' })).toEqual({ role: 'note' })
  })

  it('rejects malformed compiled schema trees at the renderer boundary', () => {
    expect(isSchemaManifest({ components: [{ id: 'broken', kind: 'custom' }], id: 'bad', kind: 'schema' })).toBe(false)
    expect(isSchemaManifest(schema() as unknown as Record<string, never>)).toBe(true)
  })
})
