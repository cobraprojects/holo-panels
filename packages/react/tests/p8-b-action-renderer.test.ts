import { act, createElement } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { ClientActionStore, type ClientActionManifest } from '@holo-js/panels-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactActionRenderer } from '../src/actions/renderer'
import { createComponentRegistry } from '../src/registry'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const manifest: ClientActionManifest = {
  badge: null,
  color: null,
  confirmation: 'Publish this record?',
  disabled: false,
  icon: 'check',
  id: 'posts.publish',
  kind: 'custom',
  label: 'Publish',
  mount: 'record',
  modal: {
    content: null,
    description: null,
    footer: null,
    heading: null,
    nestedActions: [],
    schema: { components: [], id: 'publish-reason', kind: 'schema' },
    slideOver: false,
    width: 'medium',
  },
  size: 'medium',
  tooltip: null,
  type: 'core:action:custom',
  visible: true,
}

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function createStore() {
  return new ClientActionStore<string>({
    createIdempotencyKey: () => 'request-00000001',
    transport: { execute: vi.fn(async () => ({ effects: [], items: [], result: 'published', status: 'succeeded' as const })) },
  })
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

describe('P8-B React action renderer', () => {
  it('renders grouped triggers and complete slide-over presentation with nested actions and slots', async () => {
    const store = createStore()
    const nested = { ...manifest, confirmation: null, id: 'posts.schedule', label: 'Schedule', modal: null }
    const presented = { ...manifest, confirmation: null, modal: { ...manifest.modal!, content: { component: 'action-content', properties: { message: 'Body slot' } }, description: 'Review publishing', footer: { component: 'action-footer' }, heading: 'Publish post', nestedActions: [nested.id], slideOver: true, width: 'large' as const } }
    const registry = createComponentRegistry()
      .register<{ readonly message: string }>('action-content', ({ message }) => createElement('div', { 'data-slot': 'content' }, message))
      .register('action-footer', () => createElement('div', { 'data-slot': 'footer' }, 'Footer slot'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    act(() => root.render(createElement(ReactActionRenderer, {
      actions: [presented, nested],
      groups: [{ actions: [presented.id], color: null, icon: null, id: 'publishing', label: 'Publishing' }],
      manifest: presented,
      registry,
      store,
    })))

    act(() => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Publishing')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })))
    await vi.waitFor(() => expect(Array.from(document.querySelectorAll('[role="menuitem"]')).some(item => item.textContent === 'Publish')).toBe(true))
    const publishItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'Publish')
    act(() => {
      publishItem?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      publishItem?.click()
    })
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('data-panels-component')).toBe('slide-over')
    expect(dialog?.getAttribute('data-modal-width')).toBe('large')
    expect(dialog?.textContent).toContain('Publish post')
    expect(dialog?.textContent).toContain('Review publishing')
    expect(dialog?.textContent).toContain('Body slot')
    expect(dialog?.textContent).toContain('Footer slot')
    act(() => Array.from(dialog?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Schedule')?.click())
    expect(store.activeFrame?.manifest.id).toBe('posts.schedule')
  })

  it('runs confirmation and schema flows, mounts nested dialogs, and closes the active dialog with Escape', async () => {
    const store = createStore()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    act(() => root.render(createElement(ReactActionRenderer, { manifest, recordIds: [7], store })))
    const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="posts.publish"]')
    expect(trigger?.classList.contains('hp-action-trigger')).toBe(true)
    expect(trigger?.className).toContain('hp:border')
    expect(trigger?.querySelector('[data-icon="check"][data-slot="icon"]')).not.toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('button')?.click())
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Publish this record?'))
    expect(Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Confirm')?.querySelector('[data-icon="check"]')).not.toBeNull()
    act(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')?.click())
    await vi.waitFor(() => expect(document.querySelector('[data-schema-id="publish-reason"]')).not.toBeNull())
    act(() => store.setInput({ reason: 'Ready' }))
    await act(async () => document.querySelector<HTMLFormElement>('form')?.requestSubmit())
    expect(store.activeFrame?.phase).toBe('succeeded')

    act(() => store.mount({ ...manifest, confirmation: null, id: 'posts.notify', label: 'Notify', modal: null, mount: 'notification' }))
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Notify')
    act(() => document.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(store.activeFrame?.manifest.id).toBe('posts.publish')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Publish')
  })

  it('hydrates deterministic modal markup without diagnostics', async () => {
    const store = createStore()
    store.mount(manifest)
    const element = createElement(ReactActionRenderer, { manifest, store })
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    document.body.append(container)
    const markup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, element)
      await Promise.resolve()
    })
    if (!root) throw new Error('React hydration did not create a root')
    roots.push({ container, unmount: () => root?.unmount() })
    expect(container.innerHTML).toBe(markup)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
