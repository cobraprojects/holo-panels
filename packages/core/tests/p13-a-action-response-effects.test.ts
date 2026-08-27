import { describe, expect, it, vi } from 'vitest'
import { ActionEngine, ActionExecutionError, compileActionManifest } from '../src/actions'
import type { ActionContext, ActionDefinition } from '../src/actions'
import { panelNotification } from '../src/notifications'

interface RecordValue {
  readonly id: number
}

interface Services {
  readonly events: string[]
}

function presentation(id: string, title = id) {
  return panelNotification(id).title(title).status('success').presentation()
}

function engine(records: readonly RecordValue[] = [{ id: 1 }, { id: 2 }], transaction?: { run<TResult>(operation: () => Promise<TResult>): Promise<TResult> }) {
  return new ActionEngine<RecordValue, number, string, string, Services>({
    records: {
      resolve: async id => records.find(record => record.id === id) ?? null,
      version: () => null,
    },
    transaction: transaction ?? { run: operation => operation() },
  })
}

function scope(events: string[] = []) {
  return { actor: 'actor', services: { events }, signal: new AbortController().signal, tenant: 'tenant' }
}

function action(overrides: Partial<ActionDefinition<RecordValue, { readonly value: string }, string, string, string, Services>> = {}): ActionDefinition<RecordValue, { readonly value: string }, string, string, string, Services> {
  return {
    authorize: () => true,
    handle: async input => input.value,
    id: 'records.save',
    kind: 'edit',
    label: 'Save',
    mount: 'page',
    ...overrides,
  }
}

describe('P13-A action response effects', () => {
  it('emits default Panel notifications when an action does not customize feedback', async () => {
    const definition = action()
    const succeeded = await engine().execute(definition, {
      idempotencyKey: 'request-default-success-0001',
      input: { value: 'saved' },
      mount: 'page',
    }, scope())

    expect(succeeded.effects).toEqual([{ kind: 'toast', presentation: expect.objectContaining({
      body: 'The operation completed successfully.',
      id: 'records.save.succeeded',
      status: 'success',
      title: 'Action completed',
    }) }])

    const failed = engine().execute(action({ handle: async () => { throw new Error('database password was rejected') } }), {
      idempotencyKey: 'request-default-failure-0001',
      input: { value: 'save' },
      mount: 'page',
    }, scope())

    await expect(failed).rejects.toMatchObject({
      effects: [{ kind: 'toast', presentation: expect.objectContaining({
        body: 'The operation could not be completed.',
        id: 'records.save.failed',
        status: 'danger',
        title: 'Action failed',
      }) }],
      message: 'The action could not be completed',
    })
  })

  it('emits rich success feedback only after the transaction commits and keeps persistent delivery inside it', async () => {
    const events: string[] = []
    const send = vi.fn(async () => { events.push('persistent') })
    const executor = new ActionEngine<RecordValue, number, string, string, Services>({
      notifications: { send },
      records: { resolve: async () => null, version: () => null },
      transaction: {
        async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
          events.push('begin')
          const result = await operation()
          events.push('commit')
          return result
        },
      },
    })
    const result = await executor.execute(action({
      notification: async () => ({ persistent: true }),
      successNotification: async (value) => {
        events.push(`temporary:${value}`)
        return presentation('records.saved', 'Record saved')
      },
    }), { idempotencyKey: 'request-success-0001', input: { value: 'saved' }, mount: 'page' }, scope(events))

    expect(events).toEqual(['begin', 'persistent', 'commit', 'temporary:saved'])
    expect(result.effects).toEqual([{ kind: 'toast', presentation: presentation('records.saved', 'Record saved') }])
    expect(send).toHaveBeenCalledOnce()
  })

  it('attaches validated failure feedback without exposing the raw cause to its resolver', async () => {
    const failure = vi.fn((context: ActionContext<RecordValue, string, string, Services>) => {
      expect(context.record).toBeNull()
      return panelNotification('records.failed').title('Unable to save').status('danger').presentation()
    })
    const execution = engine().execute(action({
      failureNotification: failure,
      handle: async () => { throw new Error('database password was rejected') },
    }), { idempotencyKey: 'request-failure-0001', input: { value: 'save' }, mount: 'page' }, scope())

    await expect(execution).rejects.toMatchObject({
      code: 'failed',
      effects: [{ kind: 'toast', presentation: expect.objectContaining({ id: 'records.failed', title: 'Unable to save' }) }],
    })
    const error = await execution.catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ActionExecutionError)
    expect((error as ActionExecutionError).message).toBe('The action could not be completed')
    expect(JSON.stringify((error as ActionExecutionError).effects)).not.toContain('database password')
    expect(failure).toHaveBeenCalledOnce()
    expect(failure.mock.calls[0]).toHaveLength(1)
  })

  it('emits no success effect when commit fails and keeps notification resolvers out of manifests', async () => {
    const success = vi.fn(() => presentation('records.saved'))
    const definition = action({
      failureNotification: panelNotification('records.failed').title('Unable to save').status('danger').presentation(),
      successNotification: success,
    })
    const executor = engine([], {
      async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
        await operation()
        throw new Error('commit connection secret')
      },
    })
    const execution = executor.execute(definition, { idempotencyKey: 'request-commit-0001', input: { value: 'save' }, mount: 'page' }, scope())

    await expect(execution).rejects.toMatchObject({
      effects: [{ kind: 'toast', presentation: expect.objectContaining({ id: 'records.failed' }) }],
      message: 'The action could not be completed',
    })
    expect(success).not.toHaveBeenCalled()
    const manifest = await compileActionManifest(definition, 'Save', { ...scope(), mount: 'page', record: null })
    expect(manifest).not.toHaveProperty('successNotification')
    expect(manifest).not.toHaveProperty('failureNotification')
  })

  it('coalesces partial bulk failure feedback by ID and emits no success feedback', async () => {
    const success = vi.fn(() => presentation('records.saved'))
    const failure = vi.fn(() => panelNotification('records.failed').title('Some records failed').status('danger').presentation())
    const result = await engine().execute({
      ...action({ failureNotification: failure, successNotification: success }),
      authorize: context => context.record?.id !== 2,
      mount: 'bulk',
    }, {
      idempotencyKey: 'request-partial-0001',
      input: { value: 'save' },
      mount: 'bulk',
      recordIds: [1, 2, 404],
    }, scope())

    expect(result.status).toBe('partial')
    expect(result.items.map(item => item.status)).toEqual(['succeeded', 'denied', 'denied'])
    expect(result.effects).toHaveLength(1)
    expect(result.effects[0]).toMatchObject({ kind: 'toast', presentation: { id: 'records.failed' } })
    expect(success).not.toHaveBeenCalled()
    expect(failure).toHaveBeenCalledTimes(2)
  })

  it('caps unique bulk effects and suppresses effects on completed idempotent replay', async () => {
    const records = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }))
    const executor = engine(records)
    const definition = {
      ...action(),
      mount: 'bulk' as const,
      successNotification: (value: string, context: { readonly record: RecordValue | null }) => presentation(`saved-${context.record?.id ?? 0}`, value),
    }
    const request = { idempotencyKey: 'request-replay-0001', input: { value: 'saved' }, mount: 'bulk' as const, recordIds: records.map(record => record.id) }
    const first = await executor.execute(definition, request, scope())
    const replay = await executor.execute(definition, request, scope())

    expect(first.effects).toHaveLength(20)
    expect(replay).toMatchObject({ items: first.items, status: 'succeeded' })
    expect(replay.effects).toEqual([])
  })

  it('fails closed when a feedback resolver returns an invalid presentation', async () => {
    const result = await engine().execute(action({
      successNotification: () => ({ ...presentation('records.invalid'), actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: 'javascript:alert(1)' }] }),
    }), { idempotencyKey: 'request-invalid-0001', input: { value: 'saved' }, mount: 'page' }, scope())

    expect(result.effects).toEqual([])
    expect(result.status).toBe('succeeded')
  })
})
