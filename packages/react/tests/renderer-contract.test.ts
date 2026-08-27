import { act, createElement, Fragment } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  PanelsErrorBoundary,
  PanelsRenderHook,
  ReactPanelsRenderHook,
  ComponentRegistry,
  ReactRelationManagerRenderer,
} from '../src/index'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function ShellFixture() {
  return createElement(Fragment, null,
    createElement(Button, null, 'Save'),
    createElement(Button, { asChild: true }, createElement('a', { href: '/posts' }, 'Posts')),
    createElement(Badge, { variant: 'secondary' }, 'Published'),
    createElement(Avatar, null, createElement(AvatarFallback, null, 'AL')),
    createElement(Field, null,
      createElement(FieldLabel, { htmlFor: 'title' }, 'Title'),
      createElement(Input, { 'aria-invalid': true, id: 'title' }),
      createElement(FieldDescription, null, 'Public title'),
      createElement(FieldError, { errors: [{ message: 'Required' }] })),
    createElement(Card, null,
      createElement(CardHeader, null,
        createElement(CardTitle, null, 'Details'),
        createElement(CardDescription, null, 'Record details')),
      createElement(CardContent, null, 'Section content')),
    createElement(Empty, null,
      createElement(EmptyHeader, null,
        createElement(EmptyTitle, null, 'Nothing here'),
        createElement(EmptyDescription, null, 'Create the first record'))),
  )
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(root.unmount)
    root.container.remove()
  }
  vi.restoreAllMocks()
})

describe('shared React renderer contract', () => {
  it('renders registered hook components with properties, page data, and scopes without a wrapper', () => {
    const registry = new ComponentRegistry().register('app.banner', ({ data, scopes, title }: { readonly data: Readonly<Record<string, unknown>>, readonly scopes: readonly string[], readonly title: string }) => createElement('strong', { 'data-record': String(data.recordId), 'data-scope': scopes.join(':') }, title))
    const html = renderToString(createElement(ReactPanelsRenderHook, {
      data: { recordId: 42 },
      hook: PanelsRenderHook.PAGE_START,
      manifest: { id: 'admin', slots: { [PanelsRenderHook.PAGE_START]: [{ component: 'app.banner', order: 0, properties: { title: 'Notice' }, source: 'panel' }] } },
      registry,
      scopes: ['posts', 'edit'],
    }))

    expect(html).toBe('<strong data-record="42" data-scope="posts:edit">Notice</strong>')
  })

  it('renders the canonical shadcn component sources', () => {
    const html = renderToString(createElement(ShellFixture))
    for (const slot of ['button', 'badge', 'avatar', 'field', 'input', 'card', 'empty']) {
      expect(html).toContain(`data-slot="${slot}"`)
    }
    expect(html).toContain('hp:bg-primary')
    expect(html).toContain('hp:border-input')
  })

  it('preserves accessible field semantics', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    act(() => root.render(createElement(ShellFixture)))

    expect(container.querySelector('label[for="title"]')?.textContent).toBe('Title')
    expect(container.querySelector('#title')?.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-slot="field-error"]')?.textContent).toBe('Required')
  })

  it('hydrates deterministic SSR markup without mismatch diagnostics', async () => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(createElement(ShellFixture))
    document.body.append(container)
    const serverMarkup = container.innerHTML
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined

    await act(async () => {
      root = hydrateRoot(container, createElement(ShellFixture))
      await Promise.resolve()
    })
    if (!root) throw new Error('React hydration did not create a root.')
    roots.push({ container, unmount: () => root?.unmount() })

    expect(serverMarkup).toContain('data-slot="card"')
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('contains renderer failures in an accessible error boundary', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function BrokenRenderer(): never {
      throw new Error('Renderer failed')
    }

    act(() => root.render(createElement(PanelsErrorBoundary, { fallback: error => `Could not render: ${error.message}` },
      createElement(BrokenRenderer))))

    const fallback = container.querySelector('[data-panels-component="error-boundary"]')
    expect(fallback?.getAttribute('role')).toBe('alert')
    expect(fallback?.textContent).toBe('Could not render: Renderer failed')
  })

  it('searches and submits related records through the relation selector', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    const loadOptions = vi.fn(async () => [{ label: 'TypeScript', value: 'tag-typescript' }])
    const onOperation = vi.fn(async () => undefined)
    await act(async () => root.render(createElement(ReactRelationManagerRenderer, {
      loadOptions,
      managers: [{ badge: 0, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['attach'], pivotFields: [{ id: 'position', label: 'Position', required: false, type: 'number' }], presentation: 'inline', records: [], url: null, visible: true }],
      onOperation,
    })))
    expect(container.querySelector('.hp-relation-manager [data-slot="card-header"]')).not.toBeNull()
    expect(container.querySelector('.hp-relation-manager-count[data-slot="badge"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-operation="attach"] [data-icon="link"]')).not.toBeNull()
    expect(container.textContent).toContain('No tags found.')
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click() })
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('[data-field-path="relatedId"] select')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-header"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-footer"]')).not.toBeNull()
    await act(async () => {
      if (!select) return
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      if (position) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(position, '3')
        position.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click() })
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'attach', managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }), expect.any(AbortSignal)))
  })

  it('views a related record without sending a mutation', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    const onOperation = vi.fn(async () => undefined)
    await act(async () => root.render(createElement(ReactRelationManagerRenderer, {
      managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['view'], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
      onOperation,
    })))

    expect(container.querySelector('[data-slot="table-container"]')).not.toBeNull()
    expect(container.querySelector('[data-panels-component="data-table"]')?.classList.contains('hp-relation-table-overflow')).toBe(true)
    expect(container.querySelector('td[data-label="Name"]')?.textContent).toBe('TypeScript')
    expect(container.querySelector('td.hp-table-row-actions[data-label="Actions"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-row-actions"]')?.getAttribute('role')).toBe('group')
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-operation="view"]')?.click() })

    expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[readonly]')?.value).toBe('TypeScript')
    expect(onOperation).not.toHaveBeenCalled()
  })

  it('presents detach as a destructive confirmed relation action', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    const onOperation = vi.fn(async () => undefined)
    await act(async () => root.render(createElement(ReactRelationManagerRenderer, {
      managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: ['detach'], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
      onOperation,
    })))

    const trigger = container.querySelector<HTMLButtonElement>('[data-operation="detach"]')
    expect(trigger?.className).toContain('hp:bg-destructive')
    expect(trigger?.querySelector('[data-icon="unlink"]')).not.toBeNull()
    await act(async () => trigger?.click())
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('Are you sure you want to detach this record?')
    const confirm = Array.from(dialog?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Confirm'))
    expect(confirm?.className).toContain('hp:bg-destructive')
    await act(async () => confirm?.click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'detach', managerId: 'tags', operation: 'detach', recordId: 'tag-typescript' }), expect.any(AbortSignal))
  })

  it('omits relation action structure when no operations are configured', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    await act(async () => root.render(createElement(ReactRelationManagerRenderer, {
      managers: [{ badge: 1, columns: [{ key: 'name', label: 'Name' }], group: null, id: 'tags', label: 'Tags', operations: [], presentation: 'inline', records: [{ id: 'tag-typescript', values: { name: 'TypeScript' } }], url: null, visible: true }],
    })))

    const table = container.querySelector('[data-panels-component="data-table"]')
    expect(table).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).toBeNull()
    expect(table?.querySelector('th:last-child')?.textContent).toBe('Name')
    expect(table?.querySelector('td[data-label="Actions"]')).toBeNull()
    expect(table?.querySelector('.hp-table-row-actions')).toBeNull()
  })
})
