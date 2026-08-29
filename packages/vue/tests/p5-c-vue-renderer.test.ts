import { FormStore } from '@holo-js/panels-client'
import { createSSRApp, createApp, defineComponent, effectScope, h, isReadonly, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ComponentRegistry,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  PanelsErrorBoundary,
  PanelsRenderHook,
  VueRelationManagerRenderer,
  renderPanelsHook,
  useFormStore,
  usePanelsStore,
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
  it('renders registered hook components with properties, page data, and scopes without a wrapper', async () => {
    const registry = new ComponentRegistry().register('app.banner', defineComponent({
      props: { data: { type: Object, required: true }, scopes: { type: Array, required: true }, title: { type: String, required: true } },
      setup(props) { return () => h('strong', { 'data-record': String(Reflect.get(props.data, 'recordId')), 'data-scope': props.scopes.join(':') }, props.title) },
    }))
    const app = createSSRApp(() => renderPanelsHook({
      data: { recordId: 42 },
      hook: PanelsRenderHook.PAGE_START,
      manifest: { id: 'admin', slots: { [PanelsRenderHook.PAGE_START]: [{ component: 'app.banner', order: 0, properties: { title: 'Notice' }, source: 'panel' }] } },
      registry,
      scopes: ['posts', 'edit'],
    }))

    expect(await renderToString(app)).toBe('<!--[--><strong data-record="42" data-scope="posts:edit">Notice</strong><!--]-->')
  })

  it('registers named components, rejects duplicates, and resolves panel overrides', () => {
    const defaultComponent = defineComponent(() => () => h('button', 'Default'))
    const registry = new ComponentRegistry().register('button', defaultComponent, 'test/default-button.ts')
    const override = defineComponent(() => () => h('strong', 'Panel override'))

    expect(registry.has('button')).toBe(true)
    expect(registry.resolve('button')).toBe(defaultComponent)
    expect(() => registry.register('button', override, 'test/button.ts')).toThrow(/already registered/u)

    registry.override('staff', 'button', override, 'panels/staff/button.ts')

    expect(registry.resolve('button', 'staff')).toBe(override)
    expect(registry.resolve('button', 'public')).toBe(defaultComponent)
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

describe('Vue shell error boundary', () => {
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

    expect(container.querySelector('[data-slot="alert"]')?.getAttribute('role')).toBe('alert')
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
    expect(container.querySelector('.hp-relation-manager-count[data-slot="badge"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-operation="attach"] [data-icon="link"]')).not.toBeNull()
    expect(container.textContent).toContain('No tags found.')
    container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click()
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('[data-field-path="relatedId"] select')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-header"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-footer"]')).not.toBeNull()
    if (select) {
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (position) {
      position.value = '3'
      position.dispatchEvent(new Event('input', { bubbles: true }))
    }
    document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click()
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }), expect.any(AbortSignal)))
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
    expect(container.querySelector('td[data-label="Name"]')?.textContent).toBe('TypeScript')
    expect(container.querySelector('td.hp-table-row-actions[data-label="Actions"]')).not.toBeNull()
    const menu = container.querySelector<HTMLButtonElement>('[aria-label="Row actions"]')
    menu?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    menu?.click()
    await vi.waitFor(() => expect(document.querySelector('[role="menuitem"][data-action="view"]')).not.toBeNull())
    document.querySelector<HTMLElement>('[role="menuitem"][data-action="view"]')?.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())

    expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[readonly]')?.value).toBe('TypeScript')
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
    const Fixture = defineComponent(() => () => h(Tabs, { defaultValue: 'details' }, () => [
      h(TabsList, {}, () => [
        h(TabsTrigger, { value: 'details' }, () => 'Details'),
        h(TabsTrigger, { value: 'history' }, () => 'History'),
      ]),
      h(TabsContent, { value: 'details' }, () => 'Details'),
      h(TabsContent, { value: 'history' }, () => 'History'),
    ]))
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
    expect(container.querySelector('[data-slot="tabs"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Details')
  })
})
