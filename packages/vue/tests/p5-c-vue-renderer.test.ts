import { FormStore } from '@holo-js/panels-client'
import { createSSRApp, createApp, defineComponent, effectScope, h, isReadonly, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ComponentRegistry,
  PanelsDropdown,
  PanelsErrorBoundary,
  PanelsInputWrapper,
  PanelsModal,
  PanelsPagination,
  PanelsPortalProvider,
  PanelsTabs,
  PanelsToastViewport,
  VueRelationManagerRenderer,
  registerVueShellComponents,
  useFormStore,
  usePanelsStore,
  vueShellComponents,
} from '../src/index'

const mountedApps: Array<{ unmount(): void }> = []

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount()
  document.body.replaceChildren()
})

function mount(component: ReturnType<typeof defineComponent>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(component)
  app.mount(container)
  mountedApps.push(app)
  return container
}

describe('Vue renderer registry', () => {
  it('registers named components, rejects duplicates, and resolves panel overrides', () => {
    const registry = registerVueShellComponents(new ComponentRegistry())
    const override = defineComponent(() => () => h('strong', 'Panel override'))

    expect(Object.keys(vueShellComponents)).toHaveLength(16)
    expect(registry.has('button')).toBe(true)
    expect(registry.resolve('button')).toBe(vueShellComponents.button)
    expect(() => registry.register('button', override, 'test/button.ts')).toThrow(/already registered/u)

    registry.override('staff', 'button', override, 'panels/staff/button.ts')

    expect(registry.resolve('button', 'staff')).toBe(override)
    expect(registry.resolve('button', 'public')).toBe(vueShellComponents.button)
    expect(() => registry.resolve('missing', 'staff', 'resources/users.ts:18')).toThrow(
      /Missing Vue component registration "missing" for panel "staff"\. Requested by resources\/users\.ts:18\./u,
    )
  })
})

describe('Vue shared store binding', () => {
  it('preserves shared store identity and unsubscribes with its Vue effect scope', () => {
    const store = new FormStore({ profile: { name: 'Ada' } })
    const scope = effectScope()
    const state = scope.run(() => useFormStore(store))
    const version = scope.run(() => usePanelsStore(store, snapshot => snapshot.version))

    expect(state).toBeDefined()
    expect(version).toBeDefined()
    expect(isReadonly(state)).toBe(true)
    expect(state?.value).toBe(store.state)

    store.set('profile.name', 'Grace')

    expect(state?.value).toBe(store.state)
    expect(state?.value.values.profile.name).toBe('Grace')
    expect(version?.value).toBe(1)

    const frozenState = state?.value
    scope.stop()
    store.set('profile.name', 'Lin')

    expect(state?.value).toBe(frozenState)
    expect(version?.value).toBe(1)
  })
})

describe('Vue shell observable contract', () => {
  it('renders semantic input, pagination, toast, and dialog accessibility contracts', async () => {
    const Shell = defineComponent(() => () => h('main', [
      h(PanelsInputWrapper, {
        inputId: 'email',
        label: 'Email',
        description: 'Work address',
        error: 'Email is required',
        required: true,
      }, {
        default: (bindings: Record<string, string | undefined>) => h('input', { ...bindings, name: 'email' }),
      }),
      h(PanelsPagination, { page: 2, pages: 4 }),
      h(PanelsToastViewport, { toasts: [{ id: 'saved', message: 'Saved', tone: 'success' }] }),
      h(PanelsModal, { open: true, title: 'Confirm', description: 'Review this action' }, { default: () => 'Contents' }),
    ]))

    const html = await renderToString(createSSRApp(Shell))

    expect(html).toContain('data-panels-component="input-wrapper"')
    expect(html).toContain('<label')
    expect(html).toContain('for="email"')
    expect(html).toContain('aria-describedby="email-description email-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('<nav class="hp-pagination" aria-label="Pagination"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })

  it('supports tab navigation, dropdown selection, and dialog dismissal', async () => {
    const selectedItem = ref<string>()
    const Fixture = defineComponent({
      setup() {
        const activeTab = ref('details')
        const dropdownOpen = ref(true)
        const modalOpen = ref(true)
        return () => h('main', [
          h(PanelsTabs, {
            tabs: [{ id: 'details', label: 'Details' }, { id: 'history', label: 'History' }],
            modelValue: activeTab.value,
            'onUpdate:modelValue': (value: string) => { activeTab.value = value },
          }),
          h(PanelsDropdown, {
            label: 'Actions',
            items: [{ id: 'archive', label: 'Archive' }, { id: 'delete', label: 'Delete' }],
            open: dropdownOpen.value,
            onSelect: (value: string) => { selectedItem.value = value },
            'onUpdate:open': (value: boolean) => { dropdownOpen.value = value },
          }),
          h(PanelsModal, {
            open: modalOpen.value,
            title: 'Confirm',
            onClose: () => { modalOpen.value = false },
          }),
        ])
      },
    })
    const container = mount(Fixture)
    await nextTick()
    const firstTab = container.querySelector<HTMLElement>('[role="tab"]')
    const dropdownTrigger = container.querySelector<HTMLElement>('[aria-haspopup="menu"]')
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const dialogButton = dialog?.querySelector<HTMLElement>('button')

    expect(dialogButton?.getAttribute('aria-label')).toBe('Close')

    firstTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    dropdownTrigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    const menuItems = container.querySelectorAll<HTMLElement>('[role="menuitem"]')
    menuItems[1]?.click()
    dialogButton?.click()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('History')
    expect(selectedItem.value).toBe('delete')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('targets a panel-scoped portal container when one is provided', async () => {
    const portal = document.createElement('div')
    portal.dataset.panelPortal = ''
    document.body.append(portal)
    const Fixture = defineComponent(() => () => h(PanelsPortalProvider, { container: portal }, {
      default: () => h('main', [
        h(PanelsDropdown, {
          items: [{ id: 'profile', label: 'Profile' }],
          label: 'Account',
          open: true,
        }),
        h(PanelsModal, { open: true, title: 'Confirm' }),
      ]),
    }))
    const container = mount(Fixture)
    await nextTick()

    expect(container.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(portal.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull()
    expect(portal.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull()
    expect(portal.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('opens an uncontrolled dropdown when the open prop is omitted', async () => {
    const selectedItem = ref<string>()
    const Fixture = defineComponent(() => () => h(PanelsDropdown, {
      label: 'Account',
      items: [{ id: 'profile', label: 'Profile' }],
      onSelect: (value: string) => { selectedItem.value = value },
    }))
    const container = mount(Fixture)
    await nextTick()

    container.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.click()
    await nextTick()
    container.querySelector<HTMLElement>('[role="menuitem"]')?.click()
    await nextTick()

    expect(selectedItem.value).toBe('profile')
  })

  it('captures descendant render failures in an accessible boundary', async () => {
    const Broken = defineComponent(() => () => {
      throw new Error('Sensitive implementation detail')
    })
    const Fixture = defineComponent(() => () => h(PanelsErrorBoundary, null, {
      default: () => h(Broken),
      fallback: () => 'Unable to render this section',
    }))
    const container = mount(Fixture)
    await nextTick()

    expect(container.querySelector('[data-panels-component="error-boundary"]')?.getAttribute('role')).toBe('alert')
    expect(container.textContent).toContain('Unable to render this section')
    expect(container.textContent).not.toContain('Sensitive implementation detail')
  })
})

describe('Vue relation selection', () => {
  it('loads and submits a related record without exposing raw identifiers as the primary control', async () => {
    const loadOptions = vi.fn(async () => [{ label: 'TypeScript', value: 'tag-typescript' }])
    const onOperation = vi.fn(async () => undefined)
    const Fixture = defineComponent(() => () => h(VueRelationManagerRenderer, { relations: {
      loadOptions,
      managers: [{ badge: 0, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['attach'], pivotFields: [{ id: 'position', label: 'Position', required: false, type: 'number' }], presentation: 'inline', records: [], url: null, visible: true }],
      onOperation,
    } }))
    const container = mount(Fixture)
    expect(container.querySelector('[data-slot="relation-manager-header"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-manager-count"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-loading-empty"]')).not.toBeNull()
    container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click()
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Related record"]')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-header"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-body"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-footer"]')).not.toBeNull()
    if (select) {
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (position) {
      position.value = '3'
      position.dispatchEvent(new Event('input', { bubbles: true }))
    }
    document.querySelector<HTMLButtonElement>('.hp-relation-operation-form button[type="submit"]')?.click()
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith({ managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }))
  })

  it('views a related record without sending a mutation', async () => {
    const onOperation = vi.fn(async () => undefined)
    const Fixture = defineComponent(() => () => h(VueRelationManagerRenderer, { relations: {
      managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['view'], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
      onOperation,
    } }))
    const container = mount(Fixture)

    expect(container.querySelector('[data-slot="table-container"]')).not.toBeNull()
    expect(container.querySelector('[data-panels-component="data-table"]')?.classList.contains('hp-table-responsive')).toBe(true)
    expect(container.querySelector('[data-panels-component="data-table"]')?.classList.contains('hp-relation-table-overflow')).toBe(true)
    expect(container.querySelector('td[data-label="Name"]')?.textContent).toBe('TypeScript')
    expect(container.querySelector('.hp-table-row-actions [data-slot="relation-row-actions"]')?.getAttribute('role')).toBe('group')
    container.querySelector<HTMLButtonElement>('[data-operation="view"]')?.click()
    await nextTick()

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('TypeScript')
    expect(document.querySelector('.hp-relation-operation-form button[type="submit"]')).toBeNull()
    expect(onOperation).not.toHaveBeenCalled()
  })

  it('omits relation action structure when no operations are configured', () => {
    const Fixture = defineComponent(() => () => h(VueRelationManagerRenderer, { relations: {
      managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: [], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
    } }))
    const container = mount(Fixture)

    const table = container.querySelector('[data-panels-component="data-table"]')
    expect(table).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).toBeNull()
    expect(table?.querySelector('th:last-child')?.textContent).toBe('Name')
    expect(table?.querySelector('td[data-label="Actions"]')).toBeNull()
    expect(table?.querySelector('.hp-table-row-actions')).toBeNull()
  })
})

describe('Vue SSR hydration', () => {
  it('hydrates deterministic shell markup without mismatch diagnostics', async () => {
    const Fixture = defineComponent(() => () => h(PanelsTabs, {
      tabs: [{ id: 'details', label: 'Details' }, { id: 'history', label: 'History' }],
      modelValue: 'details',
    }))
    const serverHtml = await renderToString(createSSRApp(Fixture))
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.append(container)
    const warn = vi.fn()
    const app = createSSRApp(Fixture)
    app.config.warnHandler = warn

    app.mount(container)
    mountedApps.push(app)
    await nextTick()

    expect(warn).not.toHaveBeenCalled()
    expect(container.querySelector('[data-panels-component="tabs"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Details')
  })
})
