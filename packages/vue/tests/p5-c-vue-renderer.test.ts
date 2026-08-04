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
  PanelsTabs,
  PanelsToastViewport,
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
    expect(html).toContain('<label for="email">')
    expect(html).toContain('aria-describedby="email-description email-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('<nav class="hp-pagination" aria-label="Pagination"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })

  it('supports keyboard-only tabs, dropdown selection, and dialog dismissal', async () => {
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

    expect(document.activeElement).toBe(dialogButton)
    dialogButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(dialogButton)

    firstTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    dropdownTrigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    dropdownTrigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('History')
    expect(document.activeElement?.textContent).toBe('History')
    expect(selectedItem.value).toBe('delete')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
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
    expect(container.innerHTML).toBe(serverHtml)
  })
})
