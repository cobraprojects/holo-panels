import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  BuilderCollectionStore,
  CollectionStore,
  EditorAdapterRegistry,
  createStableCollectionKey,
  type EditorAdapter,
} from '../src/collections'

interface RepeaterValue {
  readonly body: string
  readonly heading: string
}

type PageBlock =
  | { readonly data: { readonly heading: string }, readonly type: 'hero' }
  | { readonly data: { readonly body: string }, readonly type: 'quote' }

describe('P6-C collection state', () => {
  it('hydrates deterministically with stable keys and exact values', () => {
    const values: RepeaterValue[] = [
      { body: 'One', heading: 'First' },
      { body: 'Two', heading: 'Second' },
    ]
    const first = new CollectionStore(values, 'section')
    const second = new CollectionStore(values, 'section')

    expect(first.state.items.map(item => item.key)).toEqual(second.state.items.map(item => item.key))
    expect(first.state.items[0]?.key).toBe(createStableCollectionKey(values[0], 0, 'section'))
    expect(first.values).toEqual(values)
    expect(first.values).not.toBe(values)
    expect(Object.isFrozen(first.state.items[0]?.value)).toBe(true)
  })

  it('adds, clones, reorders, collapses, replaces, and deletes without losing item identity', () => {
    const store = new CollectionStore<RepeaterValue>([
      { body: 'A', heading: 'Alpha' },
      { body: 'B', heading: 'Beta' },
    ], 'section')
    const originalKeys = store.state.items.map(item => item.key)
    const added = store.add({ body: 'C', heading: 'Gamma' })
    const cloned = store.clone(0)
    store.toggleCollapsed(1)
    store.replace(0, { body: 'Updated', heading: 'Alpha' })
    store.move(0, 3)
    const removed = store.delete(1)

    expect(added.key).not.toBe(cloned.key)
    expect(store.state.items.find(item => item.key === cloned.key)?.collapsed).toBe(true)
    expect(store.state.items.at(-1)?.key).toBe(originalKeys[0])
    expect(store.state.items.at(-1)?.value.body).toBe('Updated')
    expect(removed).toEqual({ body: 'B', heading: 'Beta' })
  })

  it('remaps nested errors through insertion, reorder, and deletion', () => {
    const store = new CollectionStore([
      { body: 'A', heading: 'Alpha' },
      { body: 'B', heading: 'Beta' },
      { body: 'C', heading: 'Gamma' },
    ])
    store.setErrors({ '0.heading': 'Required', '2.body': ['Too long'] })
    store.add({ body: 'N', heading: 'New' }, 1)
    expect(store.state.errors).toEqual({ '0.heading': ['Required'], '3.body': ['Too long'] })
    store.move(3, 0)
    expect(store.state.errors).toEqual({ '1.heading': ['Required'], '0.body': ['Too long'] })
    store.delete(0)
    expect(store.state.errors).toEqual({ '0.heading': ['Required'] })
  })

  it('preserves discriminated builder block inference', () => {
    const store = new BuilderCollectionStore<PageBlock>()
    const hero = store.addBlock({ type: 'hero', data: { heading: 'Launch' } })
    store.addBlock({ type: 'quote', data: { body: 'Ship it' } })

    expectTypeOf(hero.value).toEqualTypeOf<PageBlock>()
    expect(store.values).toEqual([
      { type: 'hero', data: { heading: 'Launch' } },
      { type: 'quote', data: { body: 'Ship it' } },
    ])
  })
})

describe('P6-C editor adapter replacement', () => {
  it('registers and resolves replaceable editor adapters with source diagnostics', () => {
    const instance = { destroy: vi.fn(), focus: vi.fn(), update: vi.fn() }
    const adapter: EditorAdapter = {
      kind: 'markdown',
      mount: vi.fn(() => instance),
    }
    const registry = new EditorAdapterRegistry()
    const unregister = registry.register('milkdown', adapter, 'app/editors.ts')

    expect(registry.has('milkdown')).toBe(true)
    expect(registry.resolve('milkdown')).toBe(adapter)
    expect(() => registry.register('milkdown', adapter, 'plugin/editor.ts')).toThrow(/conflicts with app\/editors\.ts/)
    expect(() => registry.resolve('missing', 'posts/fields/content.ts:12')).toThrow(/posts\/fields\/content\.ts:12/)
    unregister()
    expect(registry.has('milkdown')).toBe(false)
  })
})
