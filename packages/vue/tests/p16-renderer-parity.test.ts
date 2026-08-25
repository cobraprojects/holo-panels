import { FormStore, TableStateStore, type ExtensionTypeId } from '@holo-js/panels-client'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueFieldRenderer } from '../src/fields/renderer'
import type { VueCompiledField } from '../src/fields/types'
import { createComponentRegistry, registerVueExtensionRenderer } from '../src/registry'
import { VueTableRenderer } from '../src/tables/renderer'
import type { VueTableColumn, VueTableRendererProps } from '../src/tables/types'

interface FormValues {
  readonly appointment: string
  readonly biography: string
  readonly enabled: boolean
  readonly secret: string
}

interface RecordValue {
  readonly active: boolean
  readonly avatar: string
  readonly id: number
  readonly title: string
}

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function fieldDefinition(path: keyof FormValues, type: string, properties: Readonly<Record<string, unknown>>): VueCompiledField<FormValues> {
  return {
    disabled: false,
    helperText: null,
    hint: null,
    label: path,
    path,
    placeholder: null,
    properties,
    readOnly: false,
    required: false,
    type,
    visible: true,
  }
}

function mountField(path: keyof FormValues, type: string, properties: Readonly<Record<string, unknown>>, values: FormValues): HTMLElement {
  const store = new FormStore(values)
  const field = { definition: fieldDefinition(path, type, properties), registry: createComponentRegistry(), store }
  const component = defineComponent(() => () => h(VueFieldRenderer, { field }))
  return mount(component)
}

function column(path: keyof RecordValue, type: string, options: {
  readonly copyable?: boolean
  readonly formatters?: readonly Readonly<Record<string, unknown>>[]
} = {}): VueTableColumn<RecordValue> {
  const manifest = {
    alignment: 'start' as const,
    copyable: options.copyable ?? false,
    formatters: options.formatters ?? [],
    hidden: false,
    inlineEditor: null,
    label: path,
    lineClamp: null,
    path,
    sortable: false,
    toggleable: false,
    type,
    width: null,
    wrap: true,
  }
  return { manifest }
}

function mountTable(options: {
  readonly columns: readonly VueTableColumn<RecordValue>[]
  readonly filters?: VueTableRendererProps<RecordValue, number>['filters']
  readonly registry?: VueTableRendererProps<RecordValue, number>['registry']
}): { readonly container: HTMLElement, readonly store: TableStateStore<RecordValue, number> } {
  const store = new TableStateStore<RecordValue, number>({
    filterMode: 'live',
    panelId: 'admin',
    records: [{ active: true, avatar: 'javascript:alert(1)', id: 1, title: '<img src=x onerror=alert(1)>' }],
    tableId: 'records',
    total: 1,
  })
  const table: VueTableRendererProps<RecordValue, number> = {
    caption: 'Records',
    columns: options.columns,
    filters: options.filters,
    getRecordId: record => record.id,
    panelId: 'admin',
    registry: options.registry,
    store,
  }
  const component = defineComponent(() => () => h(VueTableRenderer, { table }))
  return { container: mount(component), store }
}

function mount(component: ReturnType<typeof defineComponent>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
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
  vi.restoreAllMocks()
})

describe('Vue renderer parity', () => {
  it('renders text adornments, safe datalists, mask metadata, and password reveal controls', async () => {
    const container = mountField('secret', 'text', {
      datalist: ['alpha', 'beta', 7],
      inputMode: 'password',
      mask: 'credential',
      prefix: '@',
      revealable: true,
      suffix: '.internal',
    }, { appointment: '', biography: '', enabled: false, secret: 'hidden-value' })
    const input = container.querySelector<HTMLInputElement>('input')

    expect(input?.type).toBe('password')
    expect(input?.closest('[data-slot="input-group"]')).not.toBeNull()
    expect(input?.dataset.mask).toBe('credential')
    expect(container.querySelector('.hp-field-prefix')?.textContent).toBe('@')
    expect(container.querySelector('.hp-field-suffix')?.textContent).toBe('.internal')
    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value'))).toEqual(['alpha', 'beta'])
    container.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click()
    await nextTick()
    expect(container.querySelector<HTMLInputElement>('input')?.type).toBe('text')
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Hide password')
  })

  it('autosizes textareas, renders toggle state labels, and normalizes date input modes', async () => {
    const values = { appointment: '2026-07-28T14:35:00.000Z', biography: 'Hello', enabled: false, secret: '' }
    const textareaContainer = mountField('biography', 'textarea', { autosize: true, rows: 3 }, values)
    const textarea = textareaContainer.querySelector<HTMLTextAreaElement>('textarea')
    if (!textarea) throw new Error('Expected textarea')
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 96 })
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(textarea.dataset.autosize).toBe('true')
    expect(textarea.style.height).toBe('96px')

    const toggleContainer = mountField('enabled', 'toggle', { offLabel: 'Disabled', onLabel: 'Enabled' }, values)
    expect(toggleContainer.querySelector('.hp-field-toggle-label')?.textContent).toBe('Disabled')
    toggleContainer.querySelector<HTMLButtonElement>('[data-slot="switch"]')?.click()
    await nextTick()
    expect(toggleContainer.querySelector('.hp-field-toggle-label')?.textContent).toBe('Enabled')

    for (const [mode, type, value] of [
      ['date', 'date', '2026-07-28'],
      ['time', 'time', '14:35'],
      ['date-time', 'datetime-local', '2026-07-28T14:35'],
    ] as const) {
      const dateContainer = mountField('appointment', 'date', { mode }, values)
      const input = dateContainer.querySelector<HTMLInputElement>('input')
      expect(input?.type).toBe(type)
      expect(input?.value).toBe(value)
    }
  })

  it('renders semantic columns and formatter chains while rejecting unsafe presentation URLs', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = mountTable({
      columns: [
        column('title', 'badge', { copyable: true, formatters: [{ kind: 'limit', characters: 8 }, { kind: 'prefix', value: '[' }, { kind: 'suffix', value: ']' }, { kind: 'url', value: 'javascript:alert(1)' }] }),
        column('active', 'boolean', { formatters: [{ kind: 'boolean-icons', truthy: 'check-circle', falsy: 'x-circle' }] }),
        column('avatar', 'image', { formatters: [{ kind: 'size', pixels: 48 }] }),
      ],
    })

    expect(container.querySelector('.hp-table-badge')?.textContent).toBe('[<img src…]')
    expect(container.querySelector('[role="img"]')?.getAttribute('data-icon')).toBe('check-circle')
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy title"]')
    expect(copyButton?.classList.contains('hp-table-copy')).toBe(true)
    expect(copyButton?.querySelector('[data-icon="copy"]')).not.toBeNull()
    expect(copyButton?.textContent).toBe('')
    copyButton?.click()
    await nextTick()
    expect(writeText).toHaveBeenCalledWith('[<img src…]')
    await vi.waitFor(() => expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied'))
  })

  it('renders custom columns through the shared extension registry', () => {
    const type = 'holo.money:column:money' as ExtensionTypeId<'column'>
    const registry = createComponentRegistry()
    registerVueExtensionRenderer(registry, 'column', type, defineComponent({
      props: { currency: { type: String, required: true }, value: { type: Number, required: true } },
      setup: props => () => h('span', { class: 'money' }, `${props.currency} ${props.value}`),
    }))
    const custom = column('title', type) as VueTableColumn<RecordValue> & { readonly manifest: Record<string, unknown> }
    const configured = { ...custom, manifest: { ...custom.manifest, formatters: [{ configuration: { currency: 'EUR' }, kind: 'custom' }], path: 'id' } } as VueTableColumn<RecordValue>
    const { container } = mountTable({ columns: [configured], registry })

    expect(container.querySelector('.money')?.textContent).toBe('EUR 1')
  })

  it('uses dedicated ternary, trashed, and date-range controls with typed filter values', async () => {
    const { container, store } = mountTable({
      columns: [column('title', 'text')],
      filters: [
        { manifest: { defaultValue: 'all', id: 'active', label: 'Active', properties: {}, type: 'ternary' } },
        { manifest: { defaultValue: 'without', id: 'trashed', label: 'Deleted', properties: {}, type: 'trashed' } },
        { manifest: { defaultValue: { from: null, to: null }, id: 'created', label: 'Created', properties: {}, type: 'date-range' } },
      ],
    })
    const selects = container.querySelectorAll<HTMLSelectElement>('.hp-table-filters select')
    selects[0]!.value = 'true'
    selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    selects[1]!.value = 'only'
    selects[1]!.dispatchEvent(new Event('change', { bubbles: true }))
    const dates = container.querySelectorAll<HTMLInputElement>('.hp-table-filters input[type="date"]')
    dates[0]!.value = '2026-07-01'
    dates[0]!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(store.snapshot.filters.applied.active).toBe('true')
    expect(store.snapshot.filters.applied.trashed).toBe('only')
    expect(store.snapshot.filters.applied.created).toEqual({ from: '2026-07-01', to: null })
    expect(Array.from(selects[0]!.options).map(option => option.value)).toEqual(['all', 'true', 'false'])
    expect(Array.from(selects[1]!.options).map(option => option.value)).toEqual(['without', 'with', 'only'])
  })
})
