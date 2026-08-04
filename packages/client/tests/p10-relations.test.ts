import { describe, expect, it } from 'vitest'
import { createClientRelationLayout, type ClientRelationManager } from '../src/relations'

function manager(overrides: Partial<ClientRelationManager>): ClientRelationManager {
  return {
    badge: null,
    columns: [{ key: 'title', label: 'Title' }],
    group: null,
    id: 'comments',
    label: 'Comments',
    operations: ['list', 'create', 'edit'],
    presentation: 'inline',
    records: [{ id: 1, values: { title: 'First' } }],
    url: null,
    visible: true,
    ...overrides,
  }
}

describe('P10 relation client layout', () => {
  it('normalizes inline, tab, grouped-tab, and standalone page presentation', () => {
    const layout = createClientRelationLayout([
      manager({ id: 'comments' }),
      manager({ badge: 2, id: 'tags', label: 'Tags', presentation: 'tabs' }),
      manager({ id: 'authors', label: 'Authors', presentation: 'tabs' }),
      manager({ group: 'Commerce', id: 'orders', label: 'Orders', presentation: 'groupedTabs' }),
      manager({ group: 'Commerce', id: 'refunds', label: 'Refunds', presentation: 'groupedTabs' }),
      manager({ id: 'audit', label: 'Audit log', presentation: 'page', url: '/admin/posts/1/audit' }),
      manager({ id: 'hidden', label: 'Hidden', visible: false }),
    ], { relations: 'authors', 'relations-commerce': 'refunds' })

    expect(layout.inline.map(item => item.id)).toEqual(['comments'])
    expect(layout.pages.map(item => item.id)).toEqual(['audit'])
    expect(layout.tabGroups).toEqual([
      expect.objectContaining({ activeId: 'authors', id: 'relations', label: null }),
      expect.objectContaining({ activeId: 'refunds', id: 'relations-commerce', label: 'Commerce' }),
    ])
  })

  it('rejects duplicate IDs, unsafe standalone URLs, invalid columns, and missing grouped labels', () => {
    expect(() => createClientRelationLayout([manager({}), manager({})])).toThrow(/Duplicate/u)
    expect(() => createClientRelationLayout([manager({ presentation: 'page', url: 'https://attacker.test' })])).toThrow(/safe local URL/u)
    expect(() => createClientRelationLayout([manager({ columns: [{ key: '../secret', label: 'Secret' }] })])).toThrow(/invalid columns/u)
    expect(() => createClientRelationLayout([manager({ presentation: 'groupedTabs' })])).toThrow(/requires a group/u)
  })
})
