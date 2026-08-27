import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientToastStore, ReactFeedbackProvider, type JsonObject } from '@holo-js/panels-react'
import { expect, it, vi } from 'vitest'
import { NextPanelResourcePage, type NextResourceOperationTransport } from '../src/resource-page'
import { nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const action: JsonObject = { badge: null, color: null, confirmation: null, disabled: false, icon: 'check', id: 'publish', kind: 'custom', label: 'Publish', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'custom', visible: true }

function properties(pageType: 'list' | 'view'): { readonly properties: JsonObject, readonly resource: JsonObject } {
  const page = nextPanelAcceptanceFixture.pages.find(page => page.manifest.pageType === pageType)
  const properties = structuredClone(page?.manifest.body?.properties ?? {})
  const resource = properties.resource
  if (!resource || Array.isArray(resource) || typeof resource !== 'object') throw new Error('Expected resource metadata')
  return { properties, resource }
}

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
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Run action')?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'publish', input: {}, mount: 'page', source: 'list' }), expect.any(AbortSignal))
    expect(execute.mock.calls[0]?.[1]).not.toHaveProperty('recordIds')
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
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Run action')?.click())
    expect(execute).toHaveBeenCalledWith('action', expect.objectContaining({ actionId: 'publish', mount: 'record', recordIds: ['1'], source: 'infolist:title' }), expect.any(AbortSignal))
    expect(toasts.state.items).toHaveLength(1)
    expect(toasts.state.items[0]?.status).toBe('danger')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
