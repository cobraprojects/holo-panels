import { expect, it, vi } from 'vitest'
import { createRelationActionHost } from '../src/relations/actions'
import { formValidationFailure } from '../src/forms/validation'

it('keeps an invalid relation modal open, corrects its fields, and preserves server form errors', async () => {
  const execute = vi.fn(async () => { throw formValidationFailure({ _root: ['The relation cannot be saved yet'] }) })
  const host = createRelationActionHost({ execute, manager: {
    badge: null, columns: [], fields: [{ id: 'title', label: 'Title', required: true, type: 'text' }], group: null, id: 'comments', label: 'Comments', operations: ['create'], presentation: 'inline', records: [], url: null, visible: true,
  } })
  host.store.mount(host.actions[0]!)
  await expect(host.store.submit()).rejects.toMatchObject({ panelsError: { category: 'validation' } })
  expect(execute).not.toHaveBeenCalled()
  expect(host.store.activeForm?.state.errors['values.title']?.length).toBeGreaterThan(0)
  host.store.activeForm?.batch([{ kind: 'set', path: 'values.title', value: 'New comment', touch: true }])
  await vi.waitFor(() => expect(host.store.activeForm?.state.errors['values.title']).toBeUndefined())
  await expect(host.store.submit()).rejects.toMatchObject({ panelsError: { category: 'validation' } })
  expect(execute).toHaveBeenCalledOnce()
  expect(host.store.activeForm?.state.values).toEqual({ values: { title: 'New comment' } })
  expect(host.store.activeForm?.state.errors._root).toEqual(['The relation cannot be saved yet'])
})

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

it('forwards a shared table selection to bulk relation actions', async () => {
  const execute = vi.fn(async () => undefined)
  const host = createRelationActionHost({
    execute,
    manager: {
      actions: [{ badge: null, color: 'danger', confirmation: null, disabled: false, icon: 'unlink', id: 'detach-selected', kind: 'detach', label: 'Detach selected', modal: null, mount: 'bulk', size: 'medium', tooltip: null, type: 'detach', visible: true }],
      badge: 2,
      columns: [{ key: 'name', label: 'Name' }],
      group: null,
      id: 'tags',
      label: 'Tags',
      operations: ['detach'],
      presentation: 'inline',
      records: [],
      url: null,
      visible: true,
    },
    selection: () => ({ mode: 'explicit', recordIds: ['tag-one', 'tag-two'] }),
  })

  host.store.mount(host.actions[0]!)
  await host.store.submit()

  expect(execute).toHaveBeenCalledWith(expect.objectContaining({
    actionId: 'detach-selected',
    managerId: 'tags',
    selection: { mode: 'explicit', recordIds: ['tag-one', 'tag-two'] },
  }), expect.any(AbortSignal))
})
