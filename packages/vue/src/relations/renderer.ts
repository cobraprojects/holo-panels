import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
import { defineComponent, h, ref, type PropType, type VNodeChild } from 'vue'
import type { VueRelationManagerRendererProps, VueRelationOperationRequest } from './types'

const managerOperations: readonly RelationOperation[] = ['create', 'associate', 'attach']
const recordOperations: readonly RelationOperation[] = ['view', 'edit', 'delete', 'dissociate', 'detach', 'editPivot']

function operationLabel(operation: RelationOperation): string {
  return operation === 'editPivot' ? 'Edit pivot' : `${operation[0]?.toUpperCase() ?? ''}${operation.slice(1)}`
}

function display(value: JsonValue | undefined): string {
  if (value === null || typeof value === 'undefined') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function operationButton(
  manager: ClientRelationManager,
  operation: RelationOperation,
  callback: VueRelationManagerRendererProps['onOperation'],
  record?: ClientRelationRecord,
): VNodeChild {
  const request: VueRelationOperationRequest = { managerId: manager.id, operation, ...(record ? { recordId: record.id } : {}) }
  return h('button', { 'data-operation': operation, type: 'button', onClick: () => void callback?.(request) }, operationLabel(operation))
}

function relationPanel(manager: ClientRelationManager, callback: VueRelationManagerRendererProps['onOperation']): VNodeChild {
  return h('section', { 'aria-label': manager.label, class: 'hp-relation-manager', 'data-relation-manager': manager.id }, [
    h('header', [h('h3', manager.label), manager.badge !== null ? h('span', { class: 'hp-relation-badge' }, String(manager.badge)) : null]),
    h('div', { class: 'hp-relation-actions' }, managerOperations.filter(operation => manager.operations.includes(operation)).map(operation => operationButton(manager, operation, callback))),
    manager.records.length === 0
      ? h('p', { class: 'hp-relation-empty' }, manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`)
      : h('table', [
          h('caption', manager.label),
          h('thead', h('tr', [...manager.columns.map(column => h('th', { scope: 'col' }, column.label)), h('th', { scope: 'col' }, 'Actions')])),
          h('tbody', manager.records.map(record => h('tr', { key: record.id }, [
            ...manager.columns.map(column => h('td', display(record.values[column.key]))),
            h('td', recordOperations.filter(operation => manager.operations.includes(operation)).map(operation => operationButton(manager, operation, callback, record))),
          ]))),
        ]),
  ])
}

export const VueRelationManagerRenderer = defineComponent({
  name: 'VueRelationManagerRenderer',
  props: {
    relations: { type: Object as PropType<VueRelationManagerRendererProps>, required: true },
  },
  setup(componentProps) {
    const selection = ref({ ...(componentProps.relations.selection ?? {}) })
    return (): VNodeChild => {
      const props = componentProps.relations
      const layout = createClientRelationLayout(props.managers, selection.value)
      const select = (groupId: string, managerId: string): void => {
        selection.value = { ...selection.value, [groupId]: managerId }
        props.onSelectionChange?.(groupId, managerId)
      }
      return h('div', { class: 'hp-relations', 'data-panels-component': 'relation-managers' }, [
        ...layout.inline.map(manager => relationPanel(manager, props.onOperation)),
        ...layout.tabGroups.map(group => h('section', { 'aria-label': group.label ?? 'Related records', class: 'hp-relation-tabs', key: group.id }, [
          group.label ? h('h2', group.label) : null,
          h('div', { 'aria-label': group.label ?? 'Related records', role: 'tablist' }, group.managers.map(manager => h('button', {
            'aria-controls': `${group.id}-${manager.id}`,
            'aria-selected': group.activeId === manager.id,
            id: `${group.id}-${manager.id}-tab`,
            key: manager.id,
            role: 'tab',
            type: 'button',
            onClick: () => select(group.id, manager.id),
          }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))),
          ...group.managers.map(manager => h('div', {
            'aria-labelledby': `${group.id}-${manager.id}-tab`,
            hidden: group.activeId !== manager.id,
            id: `${group.id}-${manager.id}`,
            key: manager.id,
            role: 'tabpanel',
          }, [relationPanel(manager, props.onOperation)])),
        ])),
        layout.pages.length > 0 ? h('nav', { 'aria-label': 'Related record pages', class: 'hp-relation-pages' }, layout.pages.map(manager => h('a', { href: manager.url!, key: manager.id }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))) : null,
      ])
    }
  },
})
