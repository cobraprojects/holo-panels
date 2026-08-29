import { ClientActionStore, type ClientActionManifest } from '@holo-js/panels-client'
import { createApp, createSSRApp, defineComponent, h, nextTick, type App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueActionRenderer } from '../src/actions/renderer'
import { createComponentRegistry } from '../src/registry'

const manifest: ClientActionManifest = {
  badge: null,
  color: 'danger',
  confirmation: 'Delete this record?',
  disabled: false,
  icon: 'delete',
  id: 'posts.delete',
  kind: 'delete',
  label: 'Delete',
  mount: 'record',
  modal: {
    alignment: 'center',
    autofocus: true,
    cancelActionLabel: null,
    closeByClickingAway: true,
    closeByEscaping: true,
    content: null,
    description: null,
    footer: null,
    heading: null,
    icon: null,
    iconColor: null,
    nestedActions: [],
    schema: { components: [], id: 'delete-reason', kind: 'schema' },
    slideOver: false,
    stickyFooter: false,
    stickyHeader: false,
    submitActionLabel: null,
    width: 'medium',
  },
  size: 'medium',
  tooltip: null,
  type: 'core:action:delete',
  visible: true,
}

const mounted: Array<{ readonly app: App, readonly container: HTMLElement }> = []

function createStore() {
  return new ClientActionStore<string>({
    createIdempotencyKey: () => 'request-00000001',
    transport: { execute: vi.fn(async () => ({ effects: [], items: [], result: 'deleted', status: 'succeeded' as const })) },
  })
}

async function flush(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.app.unmount()
    item.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P8-B Vue action renderer', () => {
  it('renders view modals through the shared read-only entry presentation', async () => {
    const store = createStore()
    const action = { ...manifest, confirmation: null, kind: 'view' as const, modal: { ...manifest.modal!, readOnlyPresentation: { entries: [{ actions: [], copyable: false, defaultValue: true, extraAttributes: {}, id: 'posts-published', inlineLabel: false, label: 'Published', layout: {}, path: 'published', placeholder: null, properties: {}, slots: {}, tooltip: null, type: 'boolean', url: null, visible: true }], kind: 'infolist' as const }, schema: null } }
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(defineComponent(() => () => h(VueActionRenderer, { action, store })))
    app.mount(container)
    mounted.push({ app, container })
    container.querySelector<HTMLButtonElement>('[data-action-id]')?.click()
    await flush()
    expect(document.querySelector('[data-panels-entry="posts-published"] [role="img"]')?.getAttribute('aria-label')).toBe('Yes')
    expect(document.querySelector('[role="dialog"] form')).toBeNull()
  })

  it('renders grouped triggers and complete slide-over presentation with nested actions and slots', async () => {
    const store = createStore()
    const nested = { ...manifest, confirmation: null, id: 'posts.schedule', label: 'Schedule', modal: null }
    const presented = { ...manifest, confirmation: null, modal: { ...manifest.modal!, content: { component: 'action-content', properties: { message: 'Body slot' } }, description: 'Review deletion', footer: { component: 'action-footer' }, heading: 'Delete post', nestedActions: [nested.id], slideOver: true, width: 'large' as const } }
    const registry = createComponentRegistry()
      .register('action-content', defineComponent({ props: { message: String }, setup: props => () => h('div', { 'data-slot': 'content' }, props.message) }))
      .register('action-footer', defineComponent(() => () => h('div', { 'data-slot': 'footer' }, 'Footer slot')))
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(defineComponent(() => () => h(VueActionRenderer, {
      action: presented,
      actions: [presented, nested],
      groups: [{ actions: [presented.id], color: null, icon: null, id: 'publishing', label: 'Publishing' }],
      registry,
      store,
    })))
    app.mount(container)
    mounted.push({ app, container })
    Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Publishing')?.click()
    await flush()
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'Delete')?.click()
    await flush()
    const dialog = document.querySelector('[data-slot="sheet-content"]')
    expect(dialog?.getAttribute('data-panels-component')).toBe('slide-over')
    expect(dialog?.getAttribute('data-modal-width')).toBe('large')
    expect(dialog?.textContent).toContain('Delete post')
    expect(dialog?.textContent).toContain('Review deletion')
    expect(dialog?.textContent).toContain('Body slot')
    expect(dialog?.textContent).toContain('Footer slot')
    Array.from(dialog?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Schedule')?.click()
    await flush()
    expect(store.activeFrame?.manifest.id).toBe('posts.schedule')
  })

  it('runs modal confirmation and schema input and closes nested actions with Escape', async () => {
    const store = createStore()
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(defineComponent(() => () => h(VueActionRenderer, { action: manifest, recordIds: [9], store })))
    app.mount(container)
    mounted.push({ app, container })
    const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="posts.delete"]')
    expect(trigger?.classList.contains('hp-action-trigger')).toBe(true)
    expect(trigger?.getAttribute('data-variant')).toBe('destructive')
    expect(trigger?.querySelector('[data-icon="delete"][data-slot="icon"]')).not.toBeNull()

    container.querySelector<HTMLButtonElement>('button')?.click()
    await flush()
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Delete this record?')
    expect(Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Confirm')?.querySelector('[data-icon="delete"]')).not.toBeNull()
    Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')?.click()
    await flush()
    expect(document.querySelector('[data-schema-id="delete-reason"]')).not.toBeNull()
    store.activeForm?.applyServerPatch({ errors: { _root: ['Review the entire form'] } })
    await flush()
    expect(document.querySelector('form [data-form-errors]')?.textContent).toContain('Review the entire form')
    store.setInput({ reason: 'Duplicate' })
    document.querySelector<HTMLFormElement>('[data-panels-component="modal"] form')?.requestSubmit()
    await flush()
    await vi.waitFor(() => expect(store.activeFrame).toBeNull())

    store.mount({ ...manifest, confirmation: null })
    store.mount({ ...manifest, confirmation: null, id: 'posts.notice', label: 'Notice', modal: null, mount: 'notification' })
    await flush()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Notice')
    document.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await flush()
    expect(store.activeFrame?.manifest.id).toBe('posts.delete')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Delete')
  })

  it('hydrates deterministic server-rendered action markup without diagnostics', async () => {
    const store = createStore()
    store.mount(manifest)
    const fixture = () => h(VueActionRenderer, { action: manifest, store })
    const markup = await renderToString(createSSRApp(fixture))
    const container = document.createElement('div')
    container.innerHTML = markup
    document.body.append(container)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = createSSRApp(fixture)
    app.mount(container)
    mounted.push({ app, container })
    await flush()
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
