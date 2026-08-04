import { act, createElement, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CollectionStore,
  EditorAdapterRegistry,
  FormStore,
  OptionStore,
  UploadStore,
} from '@holo-js/panels-client'
import { createComponentRegistry } from '../src/registry'
import { ReactFieldRenderer, fieldRendererName } from '../src/fields/renderer'
import type { ReactCompiledField, ReactFieldControlProps, ReactFieldRendererProps } from '../src/fields/types'

interface FormValues {
  readonly title: string
  readonly sections: readonly object[]
  readonly attachment: unknown
}

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function definition(path: keyof FormValues, type: string, properties: Readonly<Record<string, unknown>> = {}): ReactCompiledField<FormValues> {
  return {
    disabled: false,
    helperText: 'Shown to editors',
    hint: null,
    label: path === 'title' ? 'Title' : 'Sections',
    path,
    placeholder: 'Enter a value',
    properties,
    readOnly: false,
    required: true,
    type,
    visible: true,
  }
}

function FormField(props: ReactFieldRendererProps<FormValues>): ReactNode {
  return ReactFieldRenderer(props)
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P6-E React field renderers', () => {
  it('binds values, errors, required state, descriptions, disabled state, read-only state, and visibility', () => {
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: 'Initial' })
    store.batch([
      { kind: 'errors', path: 'title', errors: ['Title is required'] },
      { kind: 'disabled', path: 'title', value: true },
      { kind: 'read-only', path: 'title', value: true },
    ])
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })

    act(() => root.render(createElement(FormField, {
      definition: definition('title', 'text'),
      registry,
      store,
    })))

    const input = container.querySelector<HTMLInputElement>('input')
    expect(input?.value).toBe('Initial')
    expect(input?.disabled).toBe(true)
    expect(input?.readOnly).toBe(true)
    expect(input?.getAttribute('aria-required')).toBe('true')
    expect(input?.getAttribute('aria-invalid')).toBe('true')
    expect(input?.getAttribute('aria-describedby')).toContain('-description')
    expect(container.querySelector('label')?.textContent).toContain('Title')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Title is required')

    act(() => store.batch([{ kind: 'visible', path: 'title', value: false }]))
    expect(container.innerHTML).toBe('')
  })

  it('renders emitted text adornments, datalist, password reveal, mask metadata, and picker modes', () => {
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: 'secret' })
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    const render = (field: ReactCompiledField<FormValues>): void => act(() => root.render(createElement(FormField, { definition: field, registry, store })))

    render(definition('title', 'text', {
      datalist: ['alpha', 'beta'],
      inputMode: 'password',
      mask: 'AAAA-9999',
      prefix: '@',
      revealable: true,
      suffix: '.test',
    }))

    const password = container.querySelector<HTMLInputElement>('input')
    expect(password?.type).toBe('password')
    expect(password?.dataset.mask).toBe('AAAA-9999')
    expect(password?.getAttribute('list')).toBeTruthy()
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
    expect(container.querySelector('.hp-field-prefix')?.textContent).toBe('@')
    expect(container.querySelector('.hp-field-suffix')?.textContent).toBe('.test')
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click())
    expect(container.querySelector<HTMLInputElement>('input')?.type).toBe('text')
    expect(container.querySelector<HTMLButtonElement>('button')?.getAttribute('aria-label')).toBe('Hide password')

    render(definition('title', 'date', { mode: 'time' }))
    expect(container.querySelector<HTMLInputElement>('input')?.type).toBe('time')
    render(definition('title', 'date', { mode: 'date-time' }))
    expect(container.querySelector<HTMLInputElement>('input')?.type).toBe('datetime-local')
  })

  it('applies textarea autosizing and renders the active toggle label', () => {
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: 'content' })
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })

    act(() => root.render(createElement(FormField, {
      definition: definition('title', 'textarea', { autosize: true, rows: 2 }),
      registry,
      store,
    })))
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')
    if (!textarea) throw new Error('Textarea was not rendered')
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 48 })
    act(() => textarea.dispatchEvent(new Event('input', { bubbles: true })))
    expect(textarea.dataset.autosize).toBe('true')
    expect(textarea.style.height).toBe('48px')

    const toggleStore = new FormStore<FormValues>({ attachment: null, sections: [], title: true as never })
    act(() => root.render(createElement(FormField, {
      definition: definition('title', 'toggle', { offLabel: 'Inactive', onLabel: 'Active' }),
      registry,
      store: toggleStore,
    })))
    expect(container.querySelector('.hp-field-toggle-label')?.textContent).toBe('Active')
  })

  it('renders collection controls from stable collection state and remaps the form value', () => {
    const store = new FormStore<FormValues>({ attachment: null, sections: [{ title: 'First' }], title: '' })
    const collectionStore = new CollectionStore<unknown>([{ title: 'First' }], 'section')
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })

    act(() => root.render(createElement(FormField, {
      collectionStore,
      definition: definition('sections', 'repeater', { maximumItems: 3 }),
      registry,
      renderRepeaterItem: (_value: unknown, index: number) => createElement('strong', null, `Section ${index + 1}`),
      store,
    })))
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Clone item 1"]')?.click())

    expect(container.textContent).toContain('Section 2')
    expect(store.state.values.sections).toHaveLength(2)
    expect(container.querySelector('button[aria-label="Move item 2 up"]')).not.toBeNull()
  })

  it('renders cached option state and respects dependent option disabling', async () => {
    const optionStore = new OptionStore<number>({
      dependencies: { country: 'eg' },
      fieldId: 'title',
      locale: 'en',
      panelId: 'admin',
      requiredDependencies: ['country'],
      resourceId: 'posts',
      tenantKey: 'tenant',
      transport: {
        hydrateSelected: async () => [],
        list: async request => ({
          hasMore: false,
          options: [{ label: 'Cairo', value: 20 }, { label: 'Giza', value: 21 }],
          page: request.page,
          perPage: request.perPage,
        }),
        validateSelection: async () => true,
      },
    })
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: '' })
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    await optionStore.preload()

    await act(async () => {
      root.render(createElement(FormField, {
        definition: definition('title', 'select'),
        optionStore,
        registry,
        store,
      }))
      await Promise.resolve()
    })
    const select = container.querySelector<HTMLSelectElement>('select')
    expect(select?.options.length).toBe(3)
    act(() => {
      if (!select) return
      select.value = '21'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(store.state.values.title).toBe(21)

    await act(async () => {
      await optionStore.updateDependencies({}, 21)
    })
    expect(select?.disabled).toBe(true)
  })

  it('mounts rich editor adapters only at the client boundary and destroys them on unmount', () => {
    const editorAdapters = new EditorAdapterRegistry()
    const destroy = vi.fn()
    const mount = vi.fn(() => ({ destroy, focus: vi.fn(), update: vi.fn() }))
    editorAdapters.register('test-editor', { kind: 'rich-text', mount })
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: '{"type":"doc"}' })
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => root.render(createElement(FormField, {
      definition: definition('title', 'rich-editor', { editorAdapter: 'test-editor' }),
      editorAdapters,
      registry,
      store,
    })))
    expect(mount).toHaveBeenCalledOnce()
    act(() => root.unmount())
    container.remove()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('renders upload previews, progress, reorder, and removal from UploadStore state', async () => {
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
        disk: 'private',
        expiresInSeconds: 600,
        imageOnly: true,
        maximumFiles: 3,
        maximumSize: 100,
        private: true,
      },
    })
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: '' })
    const registry = createComponentRegistry()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })

    act(() => root.render(createElement(FormField, {
      definition: definition('attachment', 'panels:field:upload'),
      registry,
      store,
      uploadStore,
    })))
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Move two.png up"]')?.click())
    expect(uploadStore.state.items[0]?.name).toBe('two.png')
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Preview of one.png')
    expect(container.querySelectorAll('progress')).toHaveLength(2)
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remove one.png"]')?.click())
    expect(deleteExisting).toHaveBeenCalledOnce()
  })

  it('resolves panel-scoped custom fields through the shared registry contract', () => {
    const registry = createComponentRegistry()
    function CustomField(props: ReactFieldControlProps<FormValues>) {
      return createElement('output', { 'data-custom-path': props.context.definition.path }, String(props.context.value))
    }
    registry.register(fieldRendererName('acme:rating'), CustomField)
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: 'Five stars' })
    const html = renderToString(createElement(FormField, {
      definition: definition('title', 'acme:rating'),
      registry,
      store,
    }))

    expect(html).toContain('data-custom-path="title"')
    expect(html).toContain('Five stars')
  })

  it('hydrates deterministic field markup without mismatch diagnostics', async () => {
    const store = new FormStore<FormValues>({ attachment: null, sections: [], title: 'Server value' })
    const registry = createComponentRegistry()
    const props: ReactFieldRendererProps<FormValues> = { definition: definition('title', 'text'), registry, store }
    const container = document.createElement('div')
    container.innerHTML = renderToString(createElement(FormField, props))
    document.body.append(container)
    const markup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined

    await act(async () => {
      root = hydrateRoot(container, createElement(FormField, props))
      await Promise.resolve()
    })
    if (!root) throw new Error('React hydration did not create a root.')
    roots.push({ container, unmount: () => root?.unmount() })
    expect(container.innerHTML).toBe(markup)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
