import { describe, expect, it } from 'vitest'
import { readOnlyPresentationStores } from '../src/entries'

describe('read-only presentation', () => {
  it('creates entry stores from a modal infolist manifest', () => {
    const stores = readOnlyPresentationStores({
      entries: [{
        actions: [],
        copyable: true,
        defaultValue: 'Draft',
        extraAttributes: { 'data-entry': 'title' },
        id: 'posts-title',
        inlineLabel: false,
        label: 'Post title',
        layout: { columnSpan: { default: 2 } },
        path: 'title',
        placeholder: null,
        properties: { badge: true },
        slots: {},
        type: 'text',
        visible: true,
      }],
      kind: 'infolist',
    })

    expect(stores).toHaveLength(1)
    expect(stores[0]?.snapshot).toMatchObject({
      copyable: true,
      formattedState: 'Draft',
      id: 'posts-title',
      label: 'Post title',
      layout: { columnSpan: { default: 2 } },
      properties: { badge: true },
      state: 'Draft',
      type: 'text',
    })
  })

  it('rejects malformed modal presentations', () => {
    expect(() => readOnlyPresentationStores({
      entries: [{ actions: [], copyable: false, defaultValue: null, extraAttributes: {}, id: '../title', inlineLabel: false, label: null, layout: {}, path: null, placeholder: null, properties: {}, slots: {}, type: 'text', visible: true }],
      kind: 'infolist',
    })).toThrow('Invalid read-only presentation entry')
  })
})
