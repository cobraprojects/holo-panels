import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientToastStore, ReactFeedbackProvider, type JsonObject } from '@holo-js/panels-react'
import { expect, it, vi } from 'vitest'
import { NextPanelResourcePage, type NextResourceOperationTransport } from '../src/resource-page'
import { nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const action: JsonObject = { badge: null, color: null, confirmation: null, disabled: false, icon: 'check', id: 'publish', kind: 'custom', label: 'Publish', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'custom', visible: true }

function properties(pageType: 'create' | 'list' | 'view'): { readonly properties: JsonObject, readonly resource: JsonObject } {
  const page = nextPanelAcceptanceFixture.pages.find(page => page.manifest.pageType === pageType)
  const properties = structuredClone(page?.manifest.body?.properties ?? {})
  const resource = properties.resource
  if (!resource || Array.isArray(resource) || typeof resource !== 'object') throw new Error('Expected resource metadata')
  return { properties, resource }
}

it('uses the registered form action and confirms before submitting the current values', async () => {
  const page = properties('create')
  page.resource.form = { actions: [{ ...action, confirmation: 'Publish this draft?', label: 'Publish draft' }], fields: [] }
  const execute = vi.fn<NextResourceOperationTransport['execute']>(async (operation): Promise<Awaited<ReturnType<NextResourceOperationTransport['execute']>>> => operation === 'options'
    ? { data: { fields: [], operations: [], schema: { components: [], id: 'posts-create-form', kind: 'schema' } }, ok: true }
    : { data: { record: { id: 1 }, status: 'succeeded' }, ok: true })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<StrictMode><NextPanelResourcePage data={{}} operation={{ execute }} panelId="admin" panelPath="/admin" properties={page.properties} /></StrictMode>))
    await vi.waitFor(() => expect(execute).toHaveBeenCalledWith('options', expect.objectContaining({ action: 'schema', lifecycle: 'hydrate', values: {} }), expect.any(AbortSignal)))
    expect(container.textContent).toContain('Publish draft')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action-id="publish"]')?.click())
    expect(execute.mock.calls.filter(([operation]) => operation === 'form-submit')).toHaveLength(0)
    const confirm = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')
    await act(async () => confirm?.click())
    expect(execute).toHaveBeenCalledWith('form-submit', expect.objectContaining({ actionId: 'publish', values: {}, idempotencyKey: expect.any(String) }), expect.any(AbortSignal))
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('runs field actions through the shared confirmation host with the current form values', async () => {
  const page = properties('create')
  const form = page.resource.form
  if (!form || Array.isArray(form) || typeof form !== 'object' || !Array.isArray(form.fields)) throw new Error('Expected form metadata')
  const title = form.fields.find(field => field && typeof field === 'object' && !Array.isArray(field) && field.path === 'title')
  if (!title || Array.isArray(title) || typeof title !== 'object') throw new Error('Expected title field metadata')
  const fieldAction = { ...action, color: 'primary', confirmation: 'Copy the current title?', id: 'copy-title', label: 'Copy title', mount: 'record' }
  title.properties = { ...(title.properties && typeof title.properties === 'object' && !Array.isArray(title.properties) ? title.properties : {}), prefixAction: fieldAction }
  const formFields = form.fields
  const execute = vi.fn<NextResourceOperationTransport['execute']>(async (operation): Promise<Awaited<ReturnType<NextResourceOperationTransport['execute']>>> => operation === 'options'
    ? { data: { fields: formFields, operations: [], schema: form.schema as JsonObject }, ok: true }
    : { data: { status: 'succeeded' }, ok: true })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<NextPanelResourcePage data={{}} operation={{ execute }} panelId="admin" panelPath="/admin" properties={page.properties} />))
    const input = container.querySelector<HTMLInputElement>('[data-field-path="title"] input')
    if (!input) throw new Error('Expected title input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Ready')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const trigger = container.querySelector<HTMLButtonElement>('.hp-field-action')
    expect(trigger?.dataset.color).toBe('primary')
    expect(trigger?.querySelector('svg')).not.toBeNull()
    await act(async () => trigger?.click())
    expect(trigger?.disabled).toBe(true)
    await act(async () => trigger?.click())
    expect(document.body.textContent).toContain('Copy the current title?')
    expect(execute.mock.calls.filter(([operation]) => operation === 'action')).toHaveLength(0)
    const confirm = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Confirm')
    await act(async () => confirm?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'copy-title', input: expect.objectContaining({ title: 'Ready' }), mount: 'page', source: 'form-field:title' }), expect.any(AbortSignal))
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('renders custom list actions once and dispatches a page mount without record IDs', async () => {
  const page = properties('list')
  page.resource.actions = [action, { ...action, id: 'schedule', label: 'Schedule' }]
  const execute = vi.fn<NextResourceOperationTransport['execute']>(async () => ({ data: {}, ok: true }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<NextPanelResourcePage data={{ records: [] }} operation={{ execute }} panelId="admin" panelPath="/admin" properties={page.properties} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action-id="publish"]')?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'publish', input: {}, mount: 'page', source: 'list' }), expect.any(AbortSignal))
    expect(execute.mock.calls[0]?.[1]).not.toHaveProperty('recordIds')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('uses server-resolved table header actions and sends their page mount', async () => {
  const page = properties('list')
  page.resource.actions = []
  page.resource.table = { columns: [], actions: [{ ...action, label: 'Static fallback', scope: 'header' }] }
  const execute = vi.fn<NextResourceOperationTransport['execute']>(async () => ({ data: { status: 'succeeded' }, ok: true }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<NextPanelResourcePage data={{ records: [], tableActions: [{ ...action, label: 'Publish for Ada', scope: 'header' }] }} operation={{ execute }} panelId="admin" panelPath="/admin" properties={page.properties} />))
    expect(container.textContent).toContain('Publish for Ada')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action-id="publish"]')?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'publish', input: {}, mount: 'page', source: 'table' }), expect.any(AbortSignal))
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it.each(['partial', 'network'] as const)('dispatches entry actions with their source and reports %s failure', async (failure) => {
  const page = properties('view')
  page.resource.infolist = { entries: [{ actionManifests: [{ ...action, mount: 'record' }], actions: ['publish'], id: 'title', label: 'Title', path: 'title', properties: {}, type: 'text' }] }
  const execute = vi.fn<NextResourceOperationTransport['execute']>(async () => {
    if (failure === 'network') throw new Error('Network unavailable')
    return { data: { status: 'partial' }, ok: true }
  })
  const toasts = new ClientToastStore()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<ReactFeedbackProvider panelId="admin" store={toasts}><NextPanelResourcePage data={{ record: { id: 1, slug: 'first-post', title: 'First post' } }} operation={{ execute }} panelId="admin" panelPath="/admin" properties={page.properties} /></ReactFeedbackProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action-id="publish"]')?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'publish', mount: 'record', recordIds: ['1'], source: 'infolist:title' }), expect.any(AbortSignal))
    expect(toasts.state.items).toHaveLength(1)
    expect(toasts.state.items[0]?.status).toBe('danger')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
