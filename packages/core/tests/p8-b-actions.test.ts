import { describe, expect, it, vi } from 'vitest'
import { compileActionManifest, resolveActionState } from '../src/actions/action'
import { createBuiltinAction } from '../src/actions/builtins'
import { ActionEngine } from '../src/actions/engine'
import type { ActionContext, ActionDefinition, ActionEngineOptions } from '../src/actions/contracts'
import type { JsonObject } from '../src/protocol/json'
import { defineSchema, schemaComponentsFor } from '../src/schemas'

interface RecordValue {
  readonly id: number
  readonly tenantId: string
  readonly version: string
}

interface Services {
  readonly audit: string[]
}

class ModalValues {
  readonly [key: string]: JsonObject[string]
}

class ModalContext {
  declare readonly actor: string
  declare readonly mount: 'bulk' | 'modal' | 'notification' | 'page' | 'record'
  declare readonly record: RecordValue | null
  declare readonly services: Services
  declare readonly signal: AbortSignal
  declare readonly tenant: string
}

const records: readonly RecordValue[] = [
  { id: 1, tenantId: 'tenant-a', version: 'v1' },
  { id: 2, tenantId: 'tenant-a', version: 'v2' },
  { id: 3, tenantId: 'tenant-b', version: 'v1' },
]

function engine(transaction?: ActionEngineOptions<RecordValue, number, string, string>['transaction']): ActionEngine<RecordValue, number, string, string, Services> {
  return new ActionEngine({
    records: {
      resolve: async (id, scope) => records.find(record => record.id === id && record.tenantId === scope.tenant) ?? null,
      version: record => record.version,
    },
    transaction: transaction ?? { run: operation => operation() },
  })
}

function scope() {
  return { actor: 'editor', services: { audit: [] }, signal: new AbortController().signal, tenant: 'tenant-a' }
}

function editAction(handle = vi.fn(async (input: { title: string }) => input.title)): ActionDefinition<RecordValue, { title: string }, string, string, string, Services> {
  return {
    authorize: context => context.record?.id !== 2,
    handle,
    id: 'posts.edit',
    kind: 'edit',
    label: context => context.record ? 'Edit record' : 'Edit',
    mount: 'record',
    transactional: true,
  }
}

describe('P8-B action execution', () => {
  it('does not rerun a committed handler when navigation presentation fails', async () => {
    const handle = vi.fn(async () => 'saved')
    const action = { ...editAction(handle), url: () => { throw new Error('Unavailable navigation') } }
    const executor = engine()
    const request = { idempotencyKey: 'failed-navigation', input: { title: 'Saved' }, mount: 'record' as const, recordIds: [1] }
    const context = scope()
    expect((await executor.execute(action, request, context)).status).toBe('succeeded')
    expect((await executor.execute(action, request, context)).status).toBe('succeeded')
    expect(handle).toHaveBeenCalledOnce()
  })
  it('resolves action URLs only after authorization and execution and suppresses replay navigation', async () => {
    const events: string[] = []
    const action = { ...editAction(), authorize: () => { events.push('authorize'); return true }, handle: async () => { events.push('handle'); return 'opened' }, url: () => { events.push('url'); return '/reports/1' } }
    const executor = engine()
    const request = { idempotencyKey: 'navigate', input: { title: 'Open' }, mount: 'record' as const, recordIds: [1] }
    const context = scope()
    expect((await executor.execute(action, request, context)).effects).toContainEqual({ kind: 'redirect', url: '/reports/1' })
    expect(events).toEqual(['authorize', 'handle', 'url'])
    expect((await executor.execute(action, request, context)).effects).toEqual([])
  })
  it('denies hidden or disabled actions and reauthorizes completed retries', async () => {
    let allowed = true
    let visible = true
    let disabled = false
    const handle = vi.fn(async () => 'saved')
    const action = { ...editAction(handle), authorize: () => allowed, visible: () => visible, disabled: () => disabled }
    const executor = engine()
    const request = { idempotencyKey: 'recheck-action', input: { title: 'Saved' }, mount: 'record' as const, recordIds: [1] }
    expect((await executor.execute(action, request, scope())).status).toBe('succeeded')
    allowed = false
    await expect(executor.execute(action, request, scope())).rejects.toMatchObject({ code: 'denied', status: 403 })
    allowed = true
    visible = false
    expect((await executor.execute(action, { ...request, idempotencyKey: 'hidden-action' }, scope())).items[0]?.status).toBe('denied')
    visible = true
    disabled = true
    expect((await executor.execute(action, { ...request, idempotencyKey: 'disabled-action' }, scope())).items[0]?.status).toBe('denied')
    expect(handle).toHaveBeenCalledTimes(1)
  })
  it('returns JSON-safe success results for actions without a return value', async () => {
    const action: ActionDefinition<RecordValue, JsonObject, void, string, string, Services> = {
      authorize: () => true,
      handle: async () => undefined,
      id: 'posts.delete',
      kind: 'delete',
      label: 'Delete',
      mount: 'record',
    }

    const result = await engine().execute(action, {
      idempotencyKey: 'request-void-result',
      input: {},
      mount: 'record',
      recordIds: [1],
    }, scope())

    expect(result).toEqual({
      effects: [{ kind: 'toast', presentation: expect.objectContaining({ id: 'posts.delete.succeeded', status: 'success' }) }],
      items: [{ recordId: 1, status: 'succeeded' }],
      status: 'succeeded',
    })
  })

  it('compiles canonical built-in presentation defaults into action manifests', async () => {
    const context: ActionContext<RecordValue, string, string, Services> = { ...scope(), mount: 'record', record: records[0] as RecordValue }
    const action = createBuiltinAction('delete', { delete: async record => record }, { authorize: async () => true })
    const manifest = await compileActionManifest(action, 'Delete', context)

    expect(manifest).toMatchObject({
      color: 'danger',
      confirmation: 'Are you sure you want to delete this record?',
      icon: 'delete',
    })
  })

  it('resolves typed action state and compiles callback-free manifests', async () => {
    const definition = editAction()
    const context: ActionContext<RecordValue, string, string, Services> = { ...scope(), mount: 'record', record: records[0] as RecordValue }
    expect(await resolveActionState(definition, context)).toEqual({ disabled: false, label: 'Edit record', visible: true })
    const components = schemaComponentsFor(ModalValues, ModalContext)
    const modalSchema = defineSchema('edit-post', ModalValues, ModalContext)
      .components([components.section().visible(() => true)])
      .compile()
    const manifest = await compileActionManifest(
      { ...definition, confirmation: 'Continue?', modal: { heading: 'Edit post', schema: modalSchema } },
      'Edit record',
      context,
      { disabled: true, visible: false },
    )
    expect(manifest).toEqual(expect.objectContaining({
      confirmation: 'Continue?',
      disabled: true,
      id: 'posts.edit',
      kind: 'edit',
      mount: 'record',
      modal: expect.objectContaining({ heading: 'Edit post', schema: expect.objectContaining({ id: 'edit-post', kind: 'schema' }) }),
      visible: false,
    }))
    expect(JSON.stringify(manifest)).not.toContain('authorize')
    expect(JSON.stringify(manifest)).not.toContain('handle')
    expect(JSON.stringify(manifest)).not.toContain('server')
    expect(JSON.stringify(manifest)).not.toContain('visibility')
  })

  it('deduplicates simultaneous and completed submissions by idempotency key', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const handle = vi.fn(async () => {
      await gate
      return 'saved'
    })
    const executor = engine()
    const request = { idempotencyKey: 'request-00000001', input: { title: 'Saved' }, mount: 'record' as const, recordIds: [1] }
    const first = executor.execute(editAction(handle), request, scope())
    const second = executor.execute(editAction(handle), request, scope())
    expect(second).toBe(first)
    release?.()
    expect((await first).items[0]).toEqual({ recordId: 1, result: 'saved', status: 'succeeded' })
    await executor.execute(editAction(handle), request, scope())
    expect(handle).toHaveBeenCalledOnce()
  })

  it('clears failed submissions so the same idempotency key can be retried', async () => {
    const handle = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('saved')
    const executor = engine()
    const action: ActionDefinition<RecordValue, { title: string }, string, string, string, Services> = {
      ...editAction(handle),
      mount: 'page',
    }
    const request = { idempotencyKey: 'request-00000005', input: { title: 'Saved' }, mount: 'page' as const }

    await expect(executor.execute(action, request, scope())).rejects.toMatchObject({
      effects: [{ kind: 'toast', presentation: expect.objectContaining({ id: 'posts.edit.failed', status: 'danger' }) }],
      message: 'The action could not be completed',
    })
    await expect(executor.execute(action, request, scope())).resolves.toMatchObject({ result: 'saved', status: 'succeeded' })
    expect(handle).toHaveBeenCalledTimes(2)
  })

  it('scopes idempotency by actor and tenant and rejects changed request payloads', async () => {
    const handle = vi.fn(async (input: { title: string, url: string }) => input.title)
    const executor = engine()
    const action: ActionDefinition<RecordValue, { title: string, url: string }, string, string, string, Services> = {
      authorize: context => context.record?.id !== 2,
      handle,
      id: 'posts.edit',
      kind: 'edit',
      label: context => context.record ? 'Edit record' : 'Edit',
      mount: 'record',
      transactional: true,
    }
    const request = {
      idempotencyKey: 'request-00000006',
      input: { title: 'First', url: 'http://example.test/posts/1' },
      mount: 'record' as const,
      recordIds: [1],
    }

    await executor.execute(action, request, scope())
    await executor.execute(action, request, { ...scope(), actor: 'reviewer' })
    await executor.execute(action, request, { ...scope(), tenant: 'tenant-b' })
    await expect(executor.execute(action, { ...request, input: { title: 'Changed', url: request.input.url } }, scope()))
      .rejects.toMatchObject({ code: 'idempotency-conflict' })
    expect(handle).toHaveBeenCalledTimes(2)
  })

  it('enforces record cardinality and unique bounded bulk IDs', async () => {
    const executor = engine()
    await expect(executor.execute(editAction(), {
      idempotencyKey: 'request-00000007',
      input: { title: 'Invalid' },
      mount: 'record',
      recordIds: [1, 2],
    }, scope())).rejects.toThrow('exactly one')
    await expect(executor.execute({ ...editAction(), mount: 'bulk' }, {
      idempotencyKey: 'request-00000008',
      input: { title: 'Invalid' },
      mount: 'bulk',
      recordIds: [1, 1],
    }, scope())).rejects.toThrow('unique')
  })

  it('returns stale, denied, tenant-hidden, and successful per-record bulk results', async () => {
    const result = await engine().execute(
      { ...editAction(), mount: 'bulk' },
      {
        expectedVersions: { '1': 'old', '2': 'v2', '3': 'v1' },
        idempotencyKey: 'request-00000002',
        input: { title: 'Bulk' },
        mount: 'bulk',
        recordIds: [1, 2, 3],
      },
      scope(),
    )
    expect(result.status).toBe('partial')
    expect(result.items.map(item => item.status)).toEqual(['stale', 'denied', 'denied'])
  })

  it('rolls back lifecycle failures without effects or notifications', async () => {
    const effect = vi.fn()
    const notification = vi.fn()
    const rollback = vi.fn()
    const transaction = {
      async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
        try {
          return await operation()
        } catch (error) {
          rollback()
          throw error
        }
      },
    }
    const action: ActionDefinition<RecordValue, { title: string }, string, string, string, Services> = {
      ...editAction(),
      lifecycle: { after: async () => { throw new Error('after failed') } },
      notification,
      sideEffects: [effect],
    }
    const result = await engine(transaction).execute(action, {
      idempotencyKey: 'request-00000003',
      input: { title: 'Fail' },
      mount: 'record',
      recordIds: [1],
    }, scope())
    expect(result.items[0]?.status).toBe('failed')
    expect(rollback).toHaveBeenCalledOnce()
    expect(effect).not.toHaveBeenCalled()
    expect(notification).not.toHaveBeenCalled()
  })

  it('keeps effects and notifications inside the configured transaction boundary', async () => {
    const rollback = vi.fn()
    const notificationSender = vi.fn()
    const transaction = {
      async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
        try {
          return await operation()
        } catch (error) {
          rollback()
          throw error
        }
      },
    }
    const executor = new ActionEngine<RecordValue, number, string, string, Services>({
      notifications: { send: notificationSender },
      records: {
        resolve: async id => records.find(record => record.id === id) ?? null,
        version: record => record.version,
      },
      transaction,
    })
    const action: ActionDefinition<RecordValue, { title: string }, string, string, string, Services> = {
      ...editAction(),
      notification: async () => ({ title: 'Saved' }),
      sideEffects: [async () => { throw new Error('effect failed') }],
    }
    const result = await executor.execute(action, {
      idempotencyKey: 'request-00000009',
      input: { title: 'Fail' },
      mount: 'record',
      recordIds: [1],
    }, scope())

    expect(result.items[0]?.status).toBe('failed')
    expect(rollback).toHaveBeenCalledOnce()
    expect(notificationSender).not.toHaveBeenCalled()
  })

  it('mutates input and delegates built-ins through transactional persistence adapters', async () => {
    const update = vi.fn(async (_record: RecordValue, input: { title: string }) => input.title)
    const action = createBuiltinAction('edit', { update }, { authorize: async () => true, id: 'posts.rename' })
    const result = await engine().execute({
      ...action,
      mutateInput: async input => ({ title: input.title.trim() }),
    }, {
      idempotencyKey: 'request-00000004',
      input: { title: ' Renamed ' },
      mount: 'record',
      recordIds: [1],
    }, scope())
    expect(result.items[0]?.result).toBe('Renamed')
    expect(update).toHaveBeenCalledWith(records[0], { title: 'Renamed' })
  })
})
