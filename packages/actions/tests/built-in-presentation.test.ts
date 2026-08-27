import { ActionEngine, compileActionManifest, resolveActionState } from '@holo-js/panels-core'
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
  it('compiles pivot editing with a stable action identifier', async () => {
    const action = EditPivotAction.make().compile()
    const manifest = await compileActionManifest(action, 'Edit pivot', { actor: {}, mount: 'record', record: {}, services: {}, signal: new AbortController().signal, tenant: null })
    expect(manifest).toMatchObject({ id: 'edit-pivot', kind: 'editPivot', icon: 'edit' })
  })
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

  it('provides every resolved record to bulk action callbacks', async () => {
    const selections: Array<readonly number[]> = []
    const definition = createActionFactory<{ readonly id: number }>().BulkAction.make('publish')
      .authorize(() => true)
      .action((_data, context) => {
        selections.push(context.selectedRecords.map(record => record.id))
      })
      .compile()
    const engine = new ActionEngine<{ readonly id: number }, number, object, unknown, object>({
      records: { resolve: async id => ({ id }), version: () => null },
      transaction: { run: operation => operation() },
    })

    await engine.execute(definition, {
      idempotencyKey: 'publish-many',
      input: {},
      mount: 'bulk',
      recordIds: [3, 5, 8],
    }, {
      actor: {},
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })

    expect(selections).toEqual([[3, 5, 8]])
  })

  it('executes identifier-only chunks through the fluent bulk action API', async () => {
    const selections: Array<readonly (number | string)[]> = []
    const action = createActionFactory<{ readonly id: number }>().BulkAction.make('queue')
      .action((_data, context) => {
        expect(context.selectedRecords).toEqual([])
        selections.push(context.selectedRecordIds)
        return 'queued'
      })
      .fetchSelectedRecords(false)
      .chunkSelectedRecords(2)
      .deselectRecordsAfterCompletion()
    const engine = new ActionEngine<{ readonly id: number }, number, object, unknown, object>({
      records: { resolve: async id => ({ id }), version: () => null }, transaction: { run: operation => operation() },
    })
    const result = await engine.execute(action.compile(), { idempotencyKey: 'queue-many', input: {}, mount: 'bulk', recordIds: [3, 5, 8] }, { actor: {}, services: {}, signal: new AbortController().signal, tenant: null })
    expect(selections).toEqual([[3, 5], [8]])
    expect(result.items.every(item => item.result === 'queued')).toBe(true)
    expect(action.manifest()).toMatchObject({ deselectAfterCompletion: true, scope: 'bulk' })
  })

  it('preserves resolver-backed presentation and modal configuration in compiled definitions', async () => {
    const definition = Action.make<{ readonly id: number }>('review')
      .label(context => `Review ${context.record?.id ?? 'record'}`)
      .icon(context => context.record ? 'document' : 'question')
      .color(context => context.record ? 'warning' : 'gray')
      .disabled(context => context.record === null)
      .visible(context => context.actor !== null)
      .tooltip(context => context.record ? 'Review this record' : null)
      .modalHeading(context => `Review ${context.record?.id ?? 'record'}?`)
      .modalDescription(context => context.record ? 'Check the selected record.' : null)
      .modalAlignment('end')
      .modalAutofocus(false)
      .modalCancelActionLabel('Keep editing')
      .closeModalByClickingAway(false)
      .closeModalByEscaping(false)
      .modalContent({ component: 'app.review-summary' })
      .modalFooter({ component: 'app.review-footer' })
      .modalIcon('document')
      .modalIconColor('warning')
      .modalSubmitActionLabel('Review')
      .stickyModalFooter()
      .stickyModalHeader()
      .action(() => undefined)
      .compile()
    const context = {
      actor: {},
      mount: 'record' as const,
      record: { id: 9 },
      selectedRecords: [{ id: 9 }],
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    }
    const state = await resolveActionState(definition, context)
    const manifest = await compileActionManifest(definition, state.label, context, state)

    expect(manifest).toMatchObject({
      color: 'warning',
      disabled: false,
      icon: 'document',
      label: 'Review 9',
      modal: {
        alignment: 'end',
        autofocus: false,
        cancelActionLabel: 'Keep editing',
        closeByClickingAway: false,
        closeByEscaping: false,
        content: { component: 'app.review-summary' },
        description: 'Check the selected record.',
        footer: { component: 'app.review-footer' },
        heading: 'Review 9?',
        icon: 'document',
        iconColor: 'warning',
        stickyFooter: true,
        stickyHeader: true,
        submitActionLabel: 'Review',
      },
      tooltip: 'Review this record',
      visible: true,
    })
  })
})
