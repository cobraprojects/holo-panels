import { expect, it, vi } from 'vitest'
import { createRelationActionHost } from '../src/relations/actions'

it('uses configured relation action confirmation and forwards the shared execution request', async () => {
  const execute = vi.fn(async () => undefined)
  const record = { id: 7, values: { title: 'First' } }
  const action = { badge: null, color: 'danger', confirmation: null, disabled: false, icon: 'delete', id: 'remove', kind: 'delete' as const, label: 'Remove comment', modal: null, mount: 'record' as const, size: 'medium' as const, tooltip: null, type: 'delete', visible: true }
  const manager = { actions: [], badge: null, columns: [], group: null, id: 'comments', label: 'Comments', operations: ['delete' as const], presentation: 'inline' as const, recordActions: [{ actions: [action], recordId: 7 }], records: [record], url: null, visible: true }
  const host = createRelationActionHost({ execute, manager, record })
  expect(host.actions[0]).toMatchObject({ confirmation: null, id: 'remove', label: 'Remove comment' })
  host.store.mount(host.actions[0]!)
  await host.store.submit([7])
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'remove', idempotencyKey: expect.any(String), mount: 'record', operation: 'delete', recordId: 7 }), expect.any(AbortSignal))
})
