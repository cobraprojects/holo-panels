import { describe, expect, it } from 'vitest'
import { readOnlyPresentationStores } from '../src/entries'

describe('read-only presentation', () => {
  it('creates entry stores from a modal infolist manifest', () => {
    const stores = readOnlyPresentationStores({
      entries: [{
        actions: [],
        copyable: true,
        defaultValue: 'Draft',
        id: 'posts-title',
        inlineLabel: false,
        label: 'Post title',
        path: 'title',
        placeholder: null,
        properties: { badge: true },
        type: 'text',
      }],
      kind: 'infolist',
    })

    expect(stores).toHaveLength(1)
    expect(stores[0]?.snapshot).toMatchObject({
      copyable: true,
      formattedState: 'Draft',
      id: 'posts-title',
      label: 'Post title',
      properties: { badge: true },
      state: 'Draft',
      type: 'text',
    })
  })

  it('rejects malformed modal presentations', () => {
    expect(() => readOnlyPresentationStores({ entries: [{ id: '../title' }], kind: 'infolist' })).toThrow('Invalid read-only presentation entry')
    expect(() => readOnlyPresentationStores({ entries: [], kind: 'form' })).toThrow('Invalid read-only presentation')
  })
})
