import { ActionEngine } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import {
  Action,
  AssociateAction,
  AttachAction,
  CreateAction,
  DeleteAction,
  DeleteBulkAction,
  DetachAction,
  DetachBulkAction,
  DissociateAction,
  DissociateBulkAction,
  EditAction,
  EditPivotAction,
  ExportAction,
  ForceDeleteAction,
  ForceDeleteBulkAction,
  ImportAction,
  ReplicateAction,
  RestoreAction,
  RestoreBulkAction,
  ViewAction,
  createActionFactory,
} from '../src'

describe('built-in action presentation', () => {
  it('gives every built-in action an icon and destructive actions confirmation and danger defaults', () => {
    const manifests = [
      CreateAction.make().manifest(),
      AssociateAction.make().manifest(),
      AttachAction.make().manifest(),
      EditAction.make().manifest(),
      ViewAction.make().manifest(),
      DeleteAction.make().manifest(),
      DeleteBulkAction.make().manifest(),
      DetachAction.make().manifest(),
      DetachBulkAction.make().manifest(),
      DissociateAction.make().manifest(),
      DissociateBulkAction.make().manifest(),
      EditPivotAction.make().manifest(),
      ReplicateAction.make().manifest(),
      ForceDeleteAction.make().manifest(),
      ForceDeleteBulkAction.make().manifest(),
      RestoreAction.make().manifest(),
      RestoreBulkAction.make().manifest(),
      ImportAction.make().manifest(),
      ExportAction.make().manifest(),
    ]

    expect(manifests.every(manifest => typeof manifest.icon === 'string')).toBe(true)
    expect(manifests.filter(manifest => manifest.id === 'delete' || manifest.id === 'force-delete')).toEqual(expect.arrayContaining([
      expect.objectContaining({ color: 'danger', confirmation: expect.any(String), requiresConfirmation: true }),
    ]))
  })

  it('keeps explicit presentation customizations authoritative', () => {
    expect(DeleteAction.make().color('gray').icon(null).requiresConfirmation(false).manifest()).toMatchObject({
      color: 'gray',
      confirmation: null,
      icon: null,
      requiresConfirmation: false,
    })
  })

  it('uses the same defaults through resource-scoped action factories', () => {
    const action = createActionFactory<{ readonly id: number }>()

    expect(action.CreateAction.make().manifest()).toMatchObject({ color: 'primary', icon: 'plus' })
    expect(action.DeleteBulkAction.make().manifest()).toMatchObject({ color: 'danger', icon: 'delete', requiresConfirmation: true })
    expect(action.AttachAction.make().manifest('header')).toMatchObject({ icon: 'link', kind: 'attach', scope: 'header' })
    expect(action.EditPivotAction.make().manifest('row')).toMatchObject({ icon: 'edit', kind: 'editPivot', scope: 'row' })
    expect(action.DetachAction.make().manifest('row')).toMatchObject({ color: 'danger', icon: 'unlink', kind: 'detach', requiresConfirmation: true })
    expect(action.DetachBulkAction.make().manifest('bulk')).toMatchObject({ color: 'danger', icon: 'unlink', kind: 'detach', requiresConfirmation: true })
    expect(action.DissociateBulkAction.make().manifest('bulk')).toMatchObject({ color: 'danger', icon: 'unlink', kind: 'dissociate', requiresConfirmation: true })
  })

  it('executes compiled callbacks with the public data and selection context', async () => {
    const authorize = vi.fn((context: { readonly data: { readonly reason: string }, readonly selectedRecords: readonly { readonly id: number }[] }) => context.data.reason === 'reviewed' && context.selectedRecords[0]?.id === 7)
    const handle = vi.fn((_data: Readonly<{ readonly reason: string }>, context: { readonly data: { readonly reason: string }, readonly selectedRecords: readonly { readonly id: number }[] }) => ({ id: context.selectedRecords[0]?.id, reason: context.data.reason }))
    const definition = Action.make<{ readonly id: number }, { readonly reason: string }, { readonly id: number | undefined, readonly reason: string }>('review')
      .authorize(authorize)
      .action(handle)
      .compile()
    const engine = new ActionEngine<{ readonly id: number }, number, object, unknown, object>({
      records: { resolve: async () => ({ id: 7 }), version: () => null },
      transaction: { run: operation => operation() },
    })

    const result = await engine.execute(definition, {
      idempotencyKey: 'review-7',
      input: { reason: 'reviewed' },
      mount: 'record',
      recordIds: [7],
    }, {
      actor: {},
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })

    expect(result.items[0]).toEqual({ recordId: 7, result: { id: 7, reason: 'reviewed' }, status: 'succeeded' })
    expect(authorize).toHaveBeenCalledOnce()
    expect(handle).toHaveBeenCalledOnce()
  })
})
