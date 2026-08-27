import { expect, it, vi } from 'vitest'
import { createTableActionHost, resolveTableActionManifest } from '../src/actions/table'

it('clears bulk selection only after successful completion when configured', async () => {
  const clearSelection = vi.fn()
  let succeeds = false
  const host = createTableActionHost({
    actions: [{ id: 'publish', label: 'Publish', scope: 'bulk', deselectAfterCompletion: true }],
    clearSelection,
    selection: () => ({ mode: 'explicit', recordIds: [1] }),
    execute: async () => ({ effects: [], items: [], status: succeeds ? 'succeeded' : 'partial' }),
  })
  host.store.mount(host.actions[0]!)
  await expect(host.store.submit()).rejects.toThrow('every record')
  expect(clearSelection).not.toHaveBeenCalled()
  succeeds = true
  host.store.close()
  host.store.mount(host.actions[0]!)
  await host.store.submit()
  expect(clearSelection).toHaveBeenCalledOnce()
})

it('keeps resolved row presentation and sends modal input through the shared lifecycle', async () => {
  const requests: object[] = []
  const host = createTableActionHost({
    actions: [{ id: 'publish', label: 'Publish', scope: 'row', resolveManifest: () => ({ badge: null, color: 'success', confirmation: 'Publish now?', disabled: false, icon: 'check', id: 'publish', kind: 'custom', label: 'Publish draft', modal: null, mount: 'record', size: 'medium', tooltip: null, type: 'custom', visible: true }) }],
    execute: async request => { requests.push(request) },
    recordId: 7,
  })
  expect(host.actions[0]?.label).toBe('Publish draft')
  host.store.mount(host.actions[0]!)
  expect(() => host.store.submit()).toThrow('confirmed')
  host.store.confirm()
  host.store.setInput({ title: 'Ready' })
  await host.store.submit()
  expect(requests).toEqual([{ actionId: 'publish', idempotencyKey: expect.any(String), input: { title: 'Ready' }, mount: 'record', recordId: 7 }])
  expect(host.store.activeFrame?.phase).toBe('succeeded')
  const rowManifest = host.actions[0]!
  const data = { tableActions: [{ ...rowManifest, modal: null, mount: 'bulk' as const }] }
  expect(resolveTableActionManifest(data, 'publish', 7)).toBeNull()
  expect(resolveTableActionManifest(data, 'publish')?.mount).toBe('bulk')
})
