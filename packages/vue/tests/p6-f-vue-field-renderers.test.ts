import {
  CollectionStore,
  EditorAdapterRegistry,
  FormStore,
  OptionStore,
  UploadStore,
} from '@holo-js/panels-client'
import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  type App,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentRegistry } from '../src/registry'
import { fieldRendererName, registerVueFieldRenderers, VueFieldRenderer, vueFieldTypes } from '../src/fields/renderer'
import type { VueCompiledField, VueFieldControlProps, VueFieldRendererProps } from '../src/fields/types'
import { Input } from '../src/internal-ui'

interface FormValues {
  readonly attachment: unknown
  readonly cityId: number | null
  readonly sections: readonly object[]
  readonly title: string
}

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function definition(
  path: keyof FormValues,
  type: string,
  properties: Readonly<Record<string, unknown>> = {},
): VueCompiledField<FormValues> {
  return {
    disabled: false,
    helperText: 'Shown to editors',
    hint: null,
    label: path === 'title' ? 'Title' : path === 'cityId' ? 'City' : 'Sections',
    path,
    placeholder: 'Enter a value',
    properties,
    readOnly: false,
    required: true,
    type,
    visible: true,
  }
}

function fixture(field: VueFieldRendererProps<FormValues>) {
  return defineComponent(() => () => h(VueFieldRenderer, { field }))
}

function mountField(field: VueFieldRendererProps<FormValues>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(fixture(field))
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

describe('P6-F Vue field renderer contracts', () => {
  it('leaves native file input values under browser control', async () => {
    const update = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(defineComponent(() => () => h(Input, { type: 'file', 'onUpdate:modelValue': update })))
    app.mount(container)
    mounted.push({ app, container })

    container.querySelector<HTMLInputElement>('input')?.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(update).not.toHaveBeenCalled()
  })

  it('registers every P6 field family through the shared component registry', () => {
    const registry = registerVueFieldRenderers(createComponentRegistry())

    expect(vueFieldTypes).toEqual({
      basic: ['checkbox', 'color', 'date', 'hidden', 'radio', 'slider', 'slug', 'text', 'textarea', 'toggle'],
      collection: ['builder', 'code', 'key-value', 'markdown', 'repeater', 'rich-editor', 'tags'],
      option: ['checkbox-list', 'multiselect', 'select', 'toggle-buttons'],
      upload: ['panels:field:upload'],
    })
    for (const type of [...vueFieldTypes.basic, ...vueFieldTypes.collection, ...vueFieldTypes.option, ...vueFieldTypes.upload]) {
      expect(registry.has(fieldRendererName(type))).toBe(true)
    }
  })

  it('binds value, errors, required descriptions, disabled, read-only, and visibility state', async () => {
    const store = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: 'Initial' })
    store.batch([
      { kind: 'errors', path: 'title', errors: ['Title is required'] },
      { kind: 'disabled', path: 'title', value: true },
      { kind: 'read-only', path: 'title', value: true },
    ])
    const container = mountField({ definition: definition('title', 'text'), registry: createComponentRegistry(), store })
    const input = container.querySelector<HTMLInputElement>('input')

    expect(input?.value).toBe('Initial')
    expect(input?.disabled).toBe(true)
    expect(input?.readOnly).toBe(true)
    expect(input?.getAttribute('aria-required')).toBe('true')
    expect(input?.getAttribute('aria-invalid')).toBe('true')
    expect(input?.getAttribute('aria-describedby')).toContain('-description')
    expect(input?.getAttribute('aria-describedby')).toContain('-errors')
    expect(container.querySelector('label')?.textContent).toContain('Title *')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Title is required')

    store.batch([{ kind: 'visible', path: 'title', value: false }])
    await nextTick()
    expect(container.innerHTML).toBe('<!---->')
  })

  it('uses OptionStore for dependent state, search, hydration, and typed selection', async () => {
    const formStore = new FormStore<FormValues>({ attachment: null, cityId: 1, sections: [], title: '' })
    const optionStore = new OptionStore<number>({
      panelId: 'admin',
      resourceId: 'locations',
      fieldId: 'city_id',
      tenantKey: 'tenant:1',
      locale: 'en',
      dependencies: { countryId: 10 },
      requiredDependencies: ['countryId'],
      transport: {
        list: async request => ({
          options: request.search === 'gi' ? [{ value: 2, label: 'Giza' }] : [{ value: 1, label: 'Cairo' }, { value: 2, label: 'Giza' }],
          page: request.page,
          perPage: request.perPage,
          hasMore: false,
        }),
        hydrateSelected: async (_request, values) => values.map(value => ({ value, label: value === 1 ? 'Cairo' : 'Giza' })),
        validateSelection: async () => true,
      },
    })
    const container = mountField({
      definition: definition('cityId', 'select', { paginated: true, preload: true, searchable: true }),
      optionStore,
      registry: createComponentRegistry(),
      store: formStore,
    })
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(container.querySelector('select')?.textContent).toContain('Cairo')
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')
    if (!search) throw new Error('Search input was not rendered.')
    search.value = 'gi'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
    await nextTick()
    expect(container.querySelector('select')?.textContent).toContain('Giza')

    const select = container.querySelector<HTMLSelectElement>('select')
    if (!select) throw new Error('Select was not rendered.')
    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(formStore.state.values.cityId).toBe(2)
  })

  it('preloads options when the initial single selection is empty', async () => {
    const formStore = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: '' })
    const optionStore = new OptionStore<string>({
      fieldId: 'title',
      locale: 'en',
      panelId: 'admin',
      resourceId: 'articles',
      tenantKey: 'tenant:1',
      transport: {
        hydrateSelected: async (_request, values) => values.map(value => ({ label: value, value })),
        list: async request => ({ hasMore: false, options: [{ label: 'Draft', value: 'draft' }], page: request.page, perPage: request.perPage }),
        validateSelection: async () => true,
      },
    })
    const container = mountField({
      definition: definition('title', 'select', { preload: true }),
      optionStore,
      registry: createComponentRegistry(),
      store: formStore,
    })

    await vi.waitFor(() => expect(container.querySelector('select')?.textContent).toContain('Draft'))
    expect(optionStore.state.loading).toBe(false)
  })

  it('renders repeater and builder controls from stable collection state and updates FormStore', async () => {
    const formStore = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [{ title: 'First' }], title: '' })
    const collectionStore = new CollectionStore<unknown>([{ title: 'First' }], 'section')
    const container = mountField({
      collectionStore,
      createCollectionItem: () => ({ title: '' }),
      definition: definition('sections', 'repeater', { fields: [{ label: 'Title', path: 'title', required: true, type: 'text' }], maximumItems: 3 }),
      registry: createComponentRegistry(),
      store: formStore,
    })

    container.querySelector<HTMLButtonElement>('button[aria-label="Clone item 1"]')?.click()
    await nextTick()
    expect(container.querySelectorAll('input[required]')).toHaveLength(2)
    expect(formStore.state.values.sections).toHaveLength(2)
    expect(container.querySelector('button[aria-label="Move item 2 up"]')).not.toBeNull()

    container.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.click()
    await nextTick()
    expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull()
  })

  it('mounts editor adapters only on the client and destroys them on unmount', async () => {
    const editorAdapters = new EditorAdapterRegistry()
    const destroy = vi.fn()
    const update = vi.fn()
    const mountAdapter = vi.fn(() => ({ destroy, focus: vi.fn(), update }))
    editorAdapters.register('test-editor', { kind: 'rich-text', mount: mountAdapter })
    const formStore = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: '{"type":"doc"}' })
    const container = mountField({
      definition: definition('title', 'rich-editor', { editorAdapter: 'test-editor' }),
      editorAdapters,
      registry: createComponentRegistry(),
      store: formStore,
    })
    await nextTick()

    expect(mountAdapter).toHaveBeenCalledOnce()
    expect(container.querySelector('[tabindex="0"]')).not.toBeNull()
    formStore.set('title', '{"type":"paragraph"}')
    await nextTick()
    expect(update).toHaveBeenCalledWith('{"type":"paragraph"}')

    const item = mounted.pop()
    item?.app.unmount()
    item?.container.remove()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('renders upload previews, progress, reorder, removal, and accessible errors', async () => {
    const deleteExisting = vi.fn(async () => undefined)
    const uploadStore = new UploadStore({
      adapter: {
        create: vi.fn(),
        delete: vi.fn(async () => undefined),
        deleteExisting,
        resolve: vi.fn(),
        write: vi.fn(),
      },
      context: { actorId: 'actor', panelId: 'admin', resourceId: 'posts', fieldId: 'attachment', tenantId: 'tenant' },
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
    const formStore = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: '' })
    formStore.batch([{ kind: 'errors', path: 'attachment', errors: ['Upload required'] }])
    const container = mountField({
      definition: definition('attachment', 'panels:field:upload'),
      registry: createComponentRegistry(),
      store: formStore,
      uploadStore,
    })

    container.querySelector<HTMLButtonElement>('button[aria-label="Move two.png up"]')?.click()
    await nextTick()
    expect(uploadStore.state.items[0]?.name).toBe('two.png')
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Preview of one.png')
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(2)
    expect(container.querySelector('input[type="file"]')?.getAttribute('aria-invalid')).toBe('true')
    container.querySelector<HTMLButtonElement>('button[aria-label="Remove one.png"]')?.click()
    await Promise.resolve()
    await nextTick()
    expect(deleteExisting).toHaveBeenCalledOnce()
  })

  it('resolves panel-scoped custom field components with complete shared context', async () => {
    const registry = createComponentRegistry()
    const Custom = defineComponent({
      props: { field: { type: Object, required: true } },
      setup(props) {
        return () => {
          const field = props.field as VueFieldControlProps<FormValues>
          return h('output', { 'data-custom-path': field.context.definition.path }, String(field.context.value))
        }
      },
    })
    registry.register(fieldRendererName('acme:rating'), Custom)
    const store = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: 'Five stars' })
    const container = mountField({ definition: definition('title', 'acme:rating'), registry, store })

    expect(container.querySelector('output')?.getAttribute('data-custom-path')).toBe('title')
    expect(container.textContent).toContain('Five stars')
    await expect(async () => renderToString(createSSRApp(fixture({
      definition: definition('title', 'missing:rating'),
      registry,
      store,
    })))).rejects.toThrow(/field "title"/u)
  })
})

describe('P6-F Vue field hydration', () => {
  it('hydrates deterministic field markup without mismatch diagnostics', async () => {
    const store = new FormStore<FormValues>({ attachment: null, cityId: null, sections: [], title: 'Server value' })
    const field = { definition: definition('title', 'text'), registry: createComponentRegistry(), store }
    const Fixture = fixture(field)
    const serverHtml = await renderToString(createSSRApp(Fixture))
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.append(container)
    const warn = vi.fn()
    const app = createSSRApp(Fixture)
    app.config.warnHandler = warn
    app.mount(container)
    mounted.push({ app, container })
    await nextTick()

    expect(warn).not.toHaveBeenCalled()
    expect(container.querySelector('[data-field-path="title"]')).not.toBeNull()
    expect(container.querySelector<HTMLInputElement>('[data-slot="input"]')?.value).toBe('Server value')
  })
})
