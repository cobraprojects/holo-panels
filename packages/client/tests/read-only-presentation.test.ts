import { describe, expect, it } from 'vitest'
import type { JsonObject, JsonValue } from '@holo-js/panels-core'
import { isActionManifest } from '../src/actions'
import { readOnlyPresentationStores } from '../src/entries'

function actionManifest(readOnlyPresentation: JsonValue): JsonObject {
  return {
    badge: null,
    color: null,
    confirmation: null,
    disabled: false,
    icon: null,
    id: 'view',
    kind: 'view',
    label: 'View',
    modal: {
      actions: [],
      alignment: 'center',
      autofocus: true,
      cancelActionLabel: null,
      closeByClickingAway: true,
      closeByEscaping: true,
      content: null,
      description: null,
      footer: null,
      heading: null,
      icon: null,
      iconColor: null,
      nestedActions: [],
      readOnlyPresentation,
      schema: null,
      slideOver: false,
      stickyFooter: false,
      stickyHeader: false,
      submitActionLabel: null,
      width: 'medium',
    },
    mount: 'record',
    size: 'medium',
    tooltip: null,
    type: 'action',
    visible: true,
  }
}

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
        tooltip: 'Current title',
        type: 'text',
        url: '/posts/draft',
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
      tooltip: 'Current title',
      type: 'text',
      url: '/posts/draft',
    })
  })

  it('rejects malformed modal presentations', () => {
    expect(() => readOnlyPresentationStores({
      entries: [{ actions: [], copyable: false, defaultValue: null, extraAttributes: {}, id: '../title', inlineLabel: false, label: null, layout: {}, path: null, placeholder: null, properties: {}, slots: {}, tooltip: null, type: 'text', url: null, visible: true }],
      kind: 'infolist',
    })).toThrow('Invalid read-only presentation entry')
  })

  it('rejects malformed read-only layout and slot manifests at the action boundary', () => {
    const entry = {
      actions: [],
      copyable: false,
      defaultValue: 'Draft',
      extraAttributes: {},
      id: 'posts-title',
      inlineLabel: false,
      label: 'Title',
      layout: {},
      path: 'title',
      placeholder: null,
      properties: {},
      slots: {},
      tooltip: null,
      type: 'text',
      url: null,
      visible: true,
    }
    expect(isActionManifest(actionManifest({ entries: [entry], kind: 'infolist' }), 'view')).toBe(true)
    const malformedEntries: JsonValue[] = [
      { ...entry, layout: { columnSpan: { desktop: 2 } } },
      { ...entry, slots: { side: [] } },
      { ...entry, slots: { above: [{ component: 'summary', order: 0, properties: {}, source: 'database' }] } },
    ]
    for (const malformedEntry of malformedEntries) {
      expect(isActionManifest(actionManifest({ entries: [malformedEntry], kind: 'infolist' }), 'view')).toBe(false)
    }
  })
})
