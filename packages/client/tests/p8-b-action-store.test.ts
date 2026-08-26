import type { ActionExecutionResult, ActionManifest } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { ClientActionStore } from '../src/actions/store'

function manifest(id: string, options: Partial<ActionManifest> = {}): ActionManifest {
  return {
    badge: null,
    color: null,
    confirmation: null,
    disabled: false,
    icon: null,
    id,
    kind: 'custom',
    label: id,
    mount: 'page',
    modal: null,
    size: 'medium',
    tooltip: null,
    type: 'core:action:custom',
    visible: true,
    ...options,
  }
}

describe('P8-B client action state', () => {
  it('mounts confirmation, schema, and nested modal actions in order', () => {
    const store = new ClientActionStore({ createIdempotencyKey: () => 'request-00000001', transport: { execute: vi.fn() } })
    store.mount(manifest('parent', {
      confirmation: 'Continue?',
      modal: {
        content: null,
        description: null,
        footer: null,
        heading: null,
        nestedActions: [],
        schema: { components: [], id: 'reason', kind: 'schema' },
        slideOver: false,
        width: 'medium',
      },
    }))
    expect(store.activeFrame?.phase).toBe('confirming')
    store.confirm()
    expect(store.activeFrame?.phase).toBe('collecting')
    store.setInput({ reason: 'Required' })
    store.mount(manifest('child', { mount: 'modal' }))
    expect(store.state.frames.map(frame => frame.manifest.id)).toEqual(['parent', 'child'])
    expect(store.activeFrame?.parentId).toBe('parent')
    store.close()
    expect(store.activeFrame?.input).toEqual({ reason: 'Required' })
  })

  it('deduplicates double submit and records successful state', async () => {
    let resolveRequest: ((value: { effects: [], items: [], result: string, status: 'succeeded' }) => void) | undefined
    const execute = vi.fn(() => new Promise<{ effects: [], items: [], result: string, status: 'succeeded' }>(resolve => { resolveRequest = resolve }))
    const store = new ClientActionStore({ createIdempotencyKey: () => 'request-00000002', transport: { execute } })
    store.mount(manifest('save'))
    const first = store.submit()
    const second = store.submit()
    expect(second).toBe(first)
    resolveRequest?.({ effects: [], items: [], result: 'saved', status: 'succeeded' })
    await first
    expect(execute).toHaveBeenCalledOnce()
    expect(store.activeFrame?.phase).toBe('succeeded')
  })

  it('ignores stale completion after a modal closes and reports active denial', async () => {
    const requests: Array<{ reject(error: Error): void, resolve(value: ActionExecutionResult<number | string, unknown>): void }> = []
    const store = new ClientActionStore({
      createIdempotencyKey: () => 'request-00000003',
      transport: {
        execute: () => new Promise<ActionExecutionResult<number | string, unknown>>((resolve, reject) => requests.push({ reject, resolve })),
      },
    })
    store.mount(manifest('stale'))
    const stale = store.submit()
    store.close()
    requests[0]?.resolve({ effects: [], items: [], status: 'succeeded' })
    await stale
    expect(store.activeFrame).toBeNull()

    store.mount(manifest('denied'))
    const denied = store.submit()
    requests[1]?.reject(new Error('Not authorized'))
    await expect(denied).rejects.toThrow('Not authorized')
    expect(store.activeFrame).toEqual(expect.objectContaining({ error: 'Not authorized', phase: 'failed' }))
  })

  it('starts a fresh submission when the same action reopens before its obsolete request settles', async () => {
    const requests: Array<{
      readonly signal: AbortSignal
      resolve(value: ActionExecutionResult<number | string, string>): void
    }> = []
    const store = new ClientActionStore<string>({
      createIdempotencyKey: () => `request-${String(requests.length + 1).padStart(8, '0')}`,
      transport: {
        execute: (_request, signal) => new Promise(resolve => requests.push({ resolve, signal })),
      },
    })

    store.mount(manifest('save'))
    const obsolete = store.submit()
    store.close()
    expect(requests[0]?.signal.aborted).toBe(true)

    store.mount(manifest('save'))
    const current = store.submit()
    expect(current).not.toBe(obsolete)
    expect(requests).toHaveLength(2)
    expect(requests[1]?.signal.aborted).toBe(false)

    requests[0]?.resolve({ effects: [], items: [], result: 'obsolete', status: 'succeeded' })
    await obsolete
    expect(store.activeFrame).toMatchObject({ phase: 'submitting', requestVersion: 1 })
    expect(requests[1]?.signal.aborted).toBe(false)

    requests[1]?.resolve({ effects: [], items: [], result: 'current', status: 'succeeded' })
    await current
    expect(store.activeFrame).toMatchObject({ phase: 'succeeded', result: { result: 'current' } })
  })
})
