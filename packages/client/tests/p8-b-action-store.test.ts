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
})
