import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientActionStore, WidgetStore, type ClientActionManifest, type EntrySnapshot } from '@holo-js/panels-client'
import { expect, it } from 'vitest'
import { ReactEntryRenderer } from '../src/entries/renderer'
import { ReactWidgetRenderer } from '../src/widgets/renderer'
import type { ReactWidgetManifest } from '../src/widgets/types'

it('mounts registered widget actions through the same action lifecycle', async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const action: ClientActionManifest = { badge: null, color: 'danger', confirmation: 'Publish everything?', disabled: false, icon: 'check', id: 'publish', kind: 'custom', label: 'Publish all', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'custom', visible: true }
  const actionStore = new ClientActionStore({ createIdempotencyKey: () => 'widget-publish', transport: { execute: async () => ({ effects: [], items: [], status: 'succeeded' }) } })
  const manifest: ReactWidgetManifest = { description: null, emptyState: 'Empty', errorState: 'Error', family: 'stats', filters: [], heading: 'Overview', id: 'overview', layout: { columnSpan: 1, columnStart: null }, lazy: false, polling: { enabled: false, interval: null }, sort: 0, type: 'stats' }
  const result = { data: { stats: [] }, status: 'ready' as const }
  const store = new WidgetStore(manifest, async () => result, { initialResult: result })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(ReactWidgetRenderer, { actions: [action], actionStore, manifest, store })))
    const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="publish"]')
    expect(trigger?.textContent).toContain('Publish all')
    await act(async () => trigger?.click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Publish everything?')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('mounts entry actions with their shared confirmation lifecycle and resolved label', async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const action: ClientActionManifest = { badge: null, color: 'danger', confirmation: 'Delete this post?', disabled: false, icon: 'trash', id: 'delete', kind: 'delete', label: 'Delete post', modal: null, mount: 'record', size: 'medium', tooltip: null, type: 'delete', visible: true }
  const store = new ClientActionStore({ createIdempotencyKey: () => 'entry-delete', transport: { execute: async () => ({ effects: [], items: [], status: 'succeeded' }) } })
  const snapshot: EntrySnapshot = { actions: ['delete'], copyable: false, error: null, formattedState: 'Draft', id: 'status', inlineLabel: false, label: 'Status', pending: false, placeholder: null, properties: {}, state: 'Draft', tooltip: null, type: 'text', url: null }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(ReactEntryRenderer, { actions: [action], actionStore: store, recordIds: [7], store: { snapshot, subscribe: () => () => undefined } })))
    const trigger = container.querySelector<HTMLButtonElement>('[data-action-id="delete"]')
    expect(trigger?.textContent).toContain('Delete post')
    await act(async () => trigger?.click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Delete this post?')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
