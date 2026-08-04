import type { ClientRelationManager } from '@holo-js/panels-client'
import type { RelationAcceptanceFixture, RelationAcceptanceJourneyReport } from './contracts'

export function relationAcceptanceManagers(): readonly ClientRelationManager[] {
  return Object.freeze([
    {
      badge: 2,
      columns: [{ key: 'body', label: 'Comment' }, { key: 'author', label: 'Author' }],
      group: null,
      id: 'comments',
      label: 'Comments',
      operations: ['list', 'view', 'create', 'edit', 'associate', 'dissociate', 'delete'],
      presentation: 'inline',
      records: [
        { id: 10, values: { author: 'Amina', body: 'First comment' } },
        { id: 11, values: { author: 'Omar', body: 'Second comment' } },
      ],
      url: null,
      visible: true,
    },
    {
      badge: 2,
      columns: [{ key: 'name', label: 'Tag' }, { key: 'position', label: 'Position' }],
      group: null,
      id: 'tags',
      label: 'Tags',
      operations: ['list', 'attach', 'detach', 'create', 'edit', 'editPivot'],
      presentation: 'tabs',
      records: [
        { id: 20, values: { name: 'TypeScript', position: 1 } },
        { id: 21, values: { name: 'Holo', position: 2 } },
      ],
      url: null,
      visible: true,
    },
    {
      badge: 1,
      columns: [{ key: 'title', label: 'Title' }],
      group: null,
      id: 'mentions',
      label: 'Mentions',
      operations: ['list', 'view'],
      presentation: 'tabs',
      records: [{ id: 30, values: { title: 'Release notes' } }],
      url: null,
      visible: true,
    },
    {
      badge: 1,
      columns: [{ key: 'name', label: 'Name' }],
      group: 'Editorial',
      id: 'reviewers',
      label: 'Reviewers',
      operations: ['list', 'view'],
      presentation: 'groupedTabs',
      records: [{ id: 40, values: { name: 'Editor' } }],
      url: null,
      visible: true,
    },
    {
      badge: null,
      columns: [{ key: 'event', label: 'Event' }],
      group: null,
      id: 'audit',
      label: 'Audit log',
      operations: ['list', 'view'],
      presentation: 'page',
      records: [],
      url: '/admin/posts/1/relations/audit',
      visible: true,
    },
    {
      badge: null,
      columns: [],
      group: null,
      id: 'private-notes',
      label: 'Private notes',
      operations: ['list'],
      presentation: 'inline',
      records: [],
      url: null,
      visible: false,
    },
  ])
}

export async function runRelationAcceptanceJourney(fixture: RelationAcceptanceFixture): Promise<RelationAcceptanceJourneyReport> {
  const managers = relationAcceptanceManagers()
  return {
    framework: fixture.framework,
    managers,
    render: await fixture.render(managers),
  }
}
