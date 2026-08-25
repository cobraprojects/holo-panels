import { describe, expect, it } from 'vitest'
import {
  AssociateAction,
  AttachAction,
  CreateAction,
  DeleteAction,
  DeleteBulkAction,
  DetachAction,
  DissociateAction,
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
      DissociateAction.make().manifest(),
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

    expect(action.create().manifest()).toMatchObject({ color: 'primary', icon: 'plus' })
    expect(action.deleteBulk().manifest()).toMatchObject({ color: 'danger', icon: 'delete', requiresConfirmation: true })
    expect(action.attach().manifest('header')).toMatchObject({ icon: 'link', kind: 'attach', scope: 'header' })
    expect(action.editPivot().manifest('row')).toMatchObject({ icon: 'edit', kind: 'editPivot', scope: 'row' })
    expect(action.detach().manifest('row')).toMatchObject({ color: 'danger', icon: 'unlink', kind: 'detach', requiresConfirmation: true })
  })
})
