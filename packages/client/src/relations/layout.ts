import type {
  ClientRelationLayout,
  ClientRelationManager,
  ClientRelationSelection,
  ClientRelationTabGroup,
} from './contracts'

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function assertManager(manager: ClientRelationManager, ids: Set<string>): void {
  if (!identifierPattern.test(manager.id)) throw new Error(`[Holo Panels] Invalid client relation manager ID "${manager.id}".`)
  if (ids.has(manager.id)) throw new Error(`[Holo Panels] Duplicate client relation manager ID "${manager.id}".`)
  ids.add(manager.id)
  if (!manager.label.trim()) throw new Error(`[Holo Panels] Relation manager "${manager.id}" requires a label.`)
  if (manager.presentation === 'groupedTabs' && !manager.group?.trim()) {
    throw new Error(`[Holo Panels] Grouped relation manager "${manager.id}" requires a group.`)
  }
  if (manager.presentation === 'page' && (!manager.url || !manager.url.startsWith('/') || manager.url.startsWith('//'))) {
    throw new Error(`[Holo Panels] Standalone relation manager "${manager.id}" requires a safe local URL.`)
  }
  const columns = new Set<string>()
  for (const column of manager.columns) {
    if (!identifierPattern.test(column.key) || columns.has(column.key) || !column.label.trim()) {
      throw new Error(`[Holo Panels] Relation manager "${manager.id}" has invalid columns.`)
    }
    columns.add(column.key)
  }
  const recordIds = new Set<number | string>()
  for (const record of manager.records) {
    if (recordIds.has(record.id)) throw new Error(`[Holo Panels] Relation manager "${manager.id}" has duplicate record IDs.`)
    recordIds.add(record.id)
  }
}

function tabGroup(
  id: string,
  label: string | null,
  managers: readonly ClientRelationManager[],
  selection: ClientRelationSelection,
): ClientRelationTabGroup {
  const requested = selection[id]
  const activeId = managers.some(manager => manager.id === requested) ? requested! : managers[0]!.id
  return Object.freeze({ activeId, id, label, managers: Object.freeze([...managers]) })
}

export function createClientRelationLayout(
  managers: readonly ClientRelationManager[],
  selection: ClientRelationSelection = {},
): ClientRelationLayout {
  const ids = new Set<string>()
  const visible = managers.filter(manager => {
    assertManager(manager, ids)
    return manager.visible
  })
  const inline = visible.filter(manager => manager.presentation === 'inline')
  const pages = visible.filter(manager => manager.presentation === 'page')
  const tabs = visible.filter(manager => manager.presentation === 'tabs')
  const grouped = new Map<string, ClientRelationManager[]>()
  for (const manager of visible.filter(candidate => candidate.presentation === 'groupedTabs')) {
    const group = manager.group!
    grouped.set(group, [...(grouped.get(group) ?? []), manager])
  }
  const tabGroups = [
    ...(tabs.length > 0 ? [tabGroup('relations', null, tabs, selection)] : []),
    ...[...grouped.entries()].map(([label, items]) => tabGroup(`relations-${label.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')}`, label, items, selection)),
  ]
  return Object.freeze({
    inline: Object.freeze(inline),
    pages: Object.freeze(pages),
    tabGroups: Object.freeze(tabGroups),
  })
}
