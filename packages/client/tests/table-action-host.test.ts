import { expect, it } from 'vitest'
import { createTableActionHost } from '../src/actions/table'

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
})
