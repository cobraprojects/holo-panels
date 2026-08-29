import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CollectionStore,
  FormStore,
  OptionStore,
  UploadStore,
  type JsonValue,
  type OptionValue,
} from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, hydrate, mount, unmount } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SvelteFieldRendererProps } from '../src/fields/contracts'
import { SvelteComponentRegistry } from '../src/registry'
import P6GFieldFixture from './P6GFieldFixture.svelte'
import P6GHydrationFixture from './P6GHydrationFixture.svelte'
import P6GCustomField from './P6GCustomField.svelte'
import FieldRenderer from '../src/fields/FieldRenderer.svelte'

interface FixtureProps {
  readonly form: FormStore<Record<string, unknown>>
  readonly optionStore: OptionStore<OptionValue>
  readonly collectionStore: CollectionStore<JsonValue>
  readonly uploadStore: UploadStore
}

const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []
let ssrServer: ViteDevServer
let ServerFixture: Component<FixtureProps>
let ServerHydrationFixture: Component<{ form: FormStore<Record<string, unknown>> }>
let renderServer: typeof render
let flushClient: typeof flushSync
let hydrateClient: typeof hydrate
let mountClient: typeof mount
let unmountClient: typeof unmount

function stores(): FixtureProps {
  const form = new FormStore<Record<string, unknown>>({
    attachment: null,
    basic: { text: 'Initial title', textarea: 'Initial body' },
    builder: [{ title: 'First' }],
    collection: { 'rich-editor': 'Rich value' },
    option: { select: 1 },
    rating: 'Five stars',
    sections: [{ title: 'First' }],
  })
  form.batch([{ kind: 'errors', path: 'basic.text', errors: ['Title is required'] }])
  const optionStore = new OptionStore<OptionValue>({
    fieldId: 'city',
    locale: 'en',
    panelId: 'admin',
    resourceId: 'locations',
    tenantKey: 'tenant:1',
    transport: {
      list: async request => ({ hasMore: false, options: [{ label: 'Cairo', value: 1 }, { label: 'Giza', value: 2 }], page: request.page, perPage: request.perPage }),
      hydrateSelected: async (_request, values) => values.map(value => ({ label: String(value), value })),
      validateSelection: async () => true,
    },
  })
  const collectionStore = new CollectionStore<JsonValue>([{ title: 'First' }], 'section')
  const uploadStore = new UploadStore({
    adapter: {
      create: vi.fn(),
      delete: vi.fn(async () => undefined),
      deleteExisting: vi.fn(async () => undefined),
      resolve: vi.fn(),
      write: vi.fn(),
    },
    context: { actorId: 'actor', fieldId: 'attachment', panelId: 'admin', resourceId: 'posts', tenantId: 'tenant' },
    existing: [
      { id: 'one', mimeType: 'image/png', name: 'one.png', previewUrl: '/one.png', size: 10 },
      { id: 'two', mimeType: 'image/png', name: 'two.png', size: 20 },
    ],
    policy: {
      acceptedExtensions: ['png'],
      acceptedMimeTypes: ['image/png'],
      directory: 'uploads',
      disk: 'local',
      expiresInSeconds: 600,
      imageOnly: true,
      maximumFiles: 3,
      maximumSize: 100,
      private: true,
    },
  })
  return { collectionStore, form, optionStore, uploadStore }
}

beforeAll(async () => {
  ssrServer = await createServer({
    appType: 'custom',
    cacheDir: `/tmp/holo-panels-svelte-p6g-${process.pid}`,
    logLevel: 'silent',
    plugins: [svelte()],
    root: process.cwd(),
    server: { middlewareMode: true },
  })
  const module = await ssrServer.ssrLoadModule('/tests/P6GFieldFixture.svelte')
  ServerFixture = module.default as Component<FixtureProps>
  const hydrationModule = await ssrServer.ssrLoadModule('/tests/P6GHydrationFixture.svelte')
  ServerHydrationFixture = hydrationModule.default as Component<{ form: FormStore<Record<string, unknown>> }>
  const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
  renderServer = svelteServer.render as typeof render
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const svelteClient = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  flushClient = svelteClient.flushSync as typeof flushSync
  hydrateClient = svelteClient.hydrate as typeof hydrate
  mountClient = svelteClient.mount as typeof mount
  unmountClient = svelteClient.unmount as typeof unmount
})

afterAll(async () => ssrServer?.close())

afterEach(async () => {
  for (const entry of mounted.splice(0)) {
    await unmountClient(entry.component)
    entry.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P6-G Svelte field renderers', () => {
  it('uses a panel registry override for a built-in field with shared values and updates', () => {
    const form = new FormStore<Record<string, unknown>>({ title: 'Initial' })
    const registry = new SvelteComponentRegistry()
    registry.override('editor', { component: P6GCustomField, source: 'test', typeId: 'field.text' })
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(FieldRenderer, { target: container, props: { definition: { type: 'text', path: 'title', label: 'Title' }, form, panelId: 'editor', registry } })
    mounted.push({ component, container })
    flushClient()

    expect(container.querySelector('[data-custom-path="title"]')?.textContent).toBe('Initial')
    container.querySelector<HTMLButtonElement>('button')?.click()
    flushClient()
    expect(form.state.values.title).toBe('custom-updated')
  })

  it('renders every field family with accessible value, description, error, required, preview, and editor contracts', async () => {
    const props = stores()
    await props.optionStore.preload()
    const { body } = renderServer(ServerFixture, { props })
    const container = document.createElement('div')
    container.innerHTML = body

    expect(container.querySelectorAll('[data-panels-field]')).toHaveLength(22)
    const title = container.querySelector<HTMLInputElement>('#hp-field-basic-text')
    expect(title?.value).toBe('Initial title')
    expect(title?.required).toBe(true)
    expect(title?.getAttribute('aria-describedby')).toContain('-description')
    expect(title?.getAttribute('aria-errormessage')).toContain('-error')
    expect(title?.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Title is required')
    expect(container.querySelector('select')?.textContent).toContain('Cairo')
    expect(container.querySelector('[data-custom-editor]')).not.toBeNull()
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(2)
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Preview of one.png')
    expect(container.querySelector('[data-custom-path="rating"]')?.textContent).toBe('Five stars')
  })

  it('hydrates independently compiled deterministic field SSR without mismatch diagnostics', () => {
    const form = new FormStore<Record<string, unknown>>({ title: 'Server value' })
    const container = document.createElement('div')
    container.innerHTML = renderServer(ServerHydrationFixture, { props: { form } }).body
    document.body.append(container)
    const serverFieldCount = container.querySelectorAll('[data-panels-field]').length
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const component = hydrateClient(P6GHydrationFixture, { props: { form }, target: container })
    mounted.push({ component, container })
    flushClient()

    expect(container.querySelectorAll('[data-panels-field]')).toHaveLength(serverFieldCount)
    expect(consoleError).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('Server value')
  })

  it('updates form, option, collection, upload, and custom state after client mounting', async () => {
    const props = stores()
    await props.optionStore.preload()
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(P6GFieldFixture, { props, target: container })
    mounted.push({ component, container })
    flushClient()
    const title = container.querySelector<HTMLInputElement>('#hp-field-basic-text')
    if (!title) throw new Error('Title field was not rendered')
    title.value = 'Updated title'
    title.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()
    expect((props.form.state.values.basic as Record<string, unknown>).text).toBe('Updated title')

    const textarea = container.querySelector<HTMLTextAreaElement>('#hp-field-basic-textarea')
    if (!textarea) throw new Error('Textarea field was not rendered')
    expect(textarea.value).toBe('Initial body')
    textarea.value = 'Updated body'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()
    expect((props.form.state.values.basic as Record<string, unknown>).textarea).toBe('Updated body')
    expect(textarea.value).toBe('Updated body')

    const slug = container.querySelector<HTMLInputElement>('#hp-field-basic-slug')
    if (!slug) throw new Error('Slug field was not rendered')
    slug.value = 'updated-slug'
    slug.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()
    expect((props.form.state.values.basic as Record<string, unknown>).slug).toBe('updated-slug')
    expect(title.value).toBe('Updated title')
    expect(textarea.value).toBe('Updated body')

    const select = container.querySelector<HTMLSelectElement>('#hp-field-option-select')
    if (!select) throw new Error('Select field was not rendered')
    await Promise.resolve()
    expect(select.value).toBe('1')
    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    flushClient()
    expect((props.form.state.values.option as Record<string, unknown>).select).toBe(2)

    const sectionTitle = container.querySelector<HTMLInputElement>('[data-panels-collection="repeater"] input')
    if (!sectionTitle) throw new Error('Nested repeater field was not rendered')
    sectionTitle.value = 'Updated section'
    sectionTitle.dispatchEvent(new Event('input', { bubbles: true }))
    flushClient()
    expect(props.collectionStore.state.items[0]?.value).toEqual({ title: 'Updated section' })

    container.querySelector<HTMLButtonElement>('[data-panels-collection="repeater"] button')?.click()
    flushClient()
    expect(props.collectionStore.state.items[0]?.collapsed).toBe(true)
    container.querySelector<HTMLButtonElement>('[data-upload-id="two"] button')?.click()
    flushClient()
    expect(props.uploadStore.state.items[0]?.name).toBe('two.png')
    container.querySelectorAll<HTMLButtonElement>('button')[container.querySelectorAll('button').length - 1]?.click()
    flushClient()
    expect(props.form.state.values.rating).toBe('custom-updated')
  })

  it('reports custom renderer failures with source context', () => {
    const registry = new SvelteComponentRegistry()
    expect(() => registry.resolve<SvelteFieldRendererProps>('acme:field:missing', 'admin', 'panels/posts.ts:42'))
      .toThrow(/acme:field:missing.*admin.*panels\/posts\.ts:42/u)
  })
})
