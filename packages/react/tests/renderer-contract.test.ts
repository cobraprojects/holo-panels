import { act, createElement, Fragment } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PanelsAvatar,
  PanelsBadge,
  PanelsButton,
  PanelsDropdown,
  PanelsEmptyState,
  PanelsErrorBoundary,
  PanelsIconButton,
  PanelsInputWrapper,
  PanelsLink,
  PanelsLoadingIndicator,
  PanelsModal,
  PanelsPagination,
  PanelsPortalProvider,
  PanelsSection,
  PanelsSlideOver,
  PanelsTab,
  PanelsTabPanel,
  PanelsTabs,
  PanelsToastViewport,
  ReactRelationManagerRenderer,
} from '../src/index'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const roots: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

function ShellFixture() {
  return createElement(Fragment, null,
    createElement(PanelsButton, null, 'Save'),
    createElement(PanelsLink, { href: '/posts' }, 'Posts'),
    createElement(PanelsBadge, { tone: 'success' }, 'Published'),
    createElement(PanelsAvatar, { alt: 'Ada Lovelace', fallback: 'AL' }),
    createElement(PanelsIconButton, { label: 'Open navigation' }, '☰'),
    createElement(PanelsInputWrapper, { inputId: 'title', label: 'Title', description: 'Public title', errors: ['Required'] },
      createElement('input', { id: 'title' })),
    createElement(PanelsLoadingIndicator, { label: 'Loading posts' }),
    createElement(PanelsDropdown, { label: 'Actions', items: [{ id: 'edit', label: 'Edit', onSelect: () => undefined }] }),
    createElement(PanelsModal, { labelledBy: 'modal-title', onClose: () => undefined, open: true },
      createElement('h2', { id: 'modal-title' }, 'Confirm')),
    createElement(PanelsSlideOver, { labelledBy: 'drawer-title', onClose: () => undefined, open: true },
      createElement('h2', { id: 'drawer-title' }, 'Filters')),
    createElement(PanelsTabs, { defaultValue: 'one', label: 'Content' },
      createElement(PanelsTab, { value: 'one' }, 'One'),
      createElement(PanelsTab, { value: 'two' }, 'Two'),
      createElement(PanelsTabPanel, { value: 'one' }, 'First panel'),
      createElement(PanelsTabPanel, { value: 'two' }, 'Second panel')),
    createElement(PanelsSection, { heading: 'Details' }, 'Section content'),
    createElement(PanelsEmptyState, { title: 'Nothing here' }, 'Create the first record'),
    createElement(PanelsPagination, { onPageChange: () => undefined, page: 2, pages: 5 }),
    createElement(PanelsToastViewport, { toasts: [{ id: 'saved', message: 'Saved', tone: 'success' }] }),
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
  it('renders every shell primitive with stable semantic component markers', () => {
    const html = renderToString(createElement(ShellFixture))
    const expected = [
      'button', 'link', 'badge', 'avatar', 'icon-button', 'input-wrapper', 'loading-indicator', 'dropdown',
      'tabs', 'section', 'empty-state', 'pagination', 'toast-viewport',
    ]

    for (const name of expected) expect(html).toContain(`data-panels-component="${name}"`)
  })

  it('exposes accessible names, landmarks, live regions, and dialog semantics', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })
    act(() => root.render(createElement(ShellFixture)))

    expect(container.querySelector('[data-panels-component="icon-button"]')?.getAttribute('aria-label')).toBe('Open navigation')
    expect(container.querySelector('[data-panels-component="loading-indicator"]')?.getAttribute('role')).toBe('status')
    expect(document.querySelector('[data-panels-component="modal"]')?.getAttribute('aria-modal')).toBe('true')
    expect(document.querySelector('[data-panels-component="slide-over"]')?.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('[data-panels-component="tabs"]')?.getAttribute('role')).toBe('tablist')
    expect(container.querySelector('[data-panels-component="pagination"]')?.getAttribute('aria-label')).toBe('Pagination')
    expect(container.querySelector('[data-panels-component="toast-viewport"]')?.getAttribute('role')).toBe('region')
    expect(container.querySelector('label[for="title"]')?.textContent).toBe('Title')
    expect(container.querySelector('#title-errors')?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('#title')?.getAttribute('aria-describedby')).toBe('title-description title-errors')
    expect(container.querySelector('#title')?.getAttribute('aria-invalid')).toBe('true')
  })

  it('targets a panel-scoped portal container when one is provided', () => {
    const container = document.createElement('div')
    const portal = document.createElement('div')
    document.body.append(container, portal)
    const root = createRoot(container)

    act(() => root.render(createElement(PanelsPortalProvider, { container: portal },
      createElement(PanelsModal, { labelledBy: 'scoped-modal-title', onClose: () => undefined, open: true },
        createElement('h2', { id: 'scoped-modal-title' }, 'Scoped modal')))))

    expect(portal.querySelector('[data-panels-component="modal"]')).not.toBeNull()
    expect(document.body.querySelector(':scope > [data-panels-component="modal"]')).toBeNull()
    act(() => root.unmount())
    container.remove()
    portal.remove()
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

    expect(serverMarkup).toContain('data-panels-component="tabs"')
    expect(container.querySelector('[data-panels-component="tabs"]')).not.toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('selects dropdown actions and supports keyboard tab navigation', async () => {
    const selected: string[] = []
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ container, unmount: () => root.unmount() })

    act(() => root.render(createElement(Fragment, null,
      createElement(PanelsDropdown, {
        label: 'Actions',
        items: [
          { id: 'edit', label: 'Edit', onSelect: () => selected.push('edit') },
          { id: 'delete', label: 'Delete', onSelect: () => selected.push('delete') },
        ],
      }),
      createElement(PanelsTabs, { defaultValue: 'one', label: 'Keyboard tabs' },
        createElement(PanelsTab, { value: 'one' }, 'One'),
        createElement(PanelsTab, { value: 'two' }, 'Two'),
        createElement(PanelsTabPanel, { value: 'one' }, 'First'),
        createElement(PanelsTabPanel, { value: 'two' }, 'Second')),
    )))

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-panels-component="dropdown"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      await Promise.resolve()
    })
    const deleteItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === 'Delete')
    await act(async () => {
      deleteItem?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      deleteItem?.click()
      await Promise.resolve()
    })
    expect(selected).toEqual(['delete'])

    const firstTab = container.querySelector<HTMLButtonElement>('[role="tab"]')
    firstTab?.focus()
    await act(async () => {
      firstTab?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
      await Promise.resolve()
    })
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    await vi.waitFor(() => expect(document.activeElement).toBe(tabs[1]))
    await vi.waitFor(() => expect(tabs[1]?.getAttribute('aria-selected')).toBe('true'))
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
    expect(container.querySelector('[data-slot="relation-manager-header"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-manager-count"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="relation-loading-empty"]')).not.toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-operation="attach"]')?.click() })
    await vi.waitFor(() => expect(loadOptions).toHaveBeenCalledWith('tags', ''))
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Related record"]')
    const position = document.querySelector<HTMLInputElement>('input[type="number"]')
    expect(select?.textContent).toContain('TypeScript')
    expect(position).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-header"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-body"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="relation-dialog-footer"]')).not.toBeNull()
    await act(async () => {
      if (!select) return
      select.value = 'tag-typescript'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      if (position) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(position, '3')
        position.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await act(async () => { document.querySelector<HTMLButtonElement>('.hp-relation-operation-form button[type="submit"]')?.click() })
    await vi.waitFor(() => expect(onOperation).toHaveBeenCalledWith({ managerId: 'tags', operation: 'attach', pivot: { position: 3 }, recordId: 'tag-typescript' }))
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

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('TypeScript')
    expect(document.querySelector('.hp-relation-operation-form button[type="submit"]')).toBeNull()
    expect(onOperation).not.toHaveBeenCalled()
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
