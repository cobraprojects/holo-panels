import { Badge, Card, CardContent, CardHeader, CardTitle, Checkbox, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '../internal-ui'
import { createClientRelationLayout, createRelationActionHost, relationActionManifests, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
import { computed, defineComponent, h, ref, watch, type PropType, type VNodeChild } from 'vue'
import { VueTablePresentation, type VueTablePresentationProps } from '../tables/presentation'
import { VueActionRenderer } from '../actions/renderer'
import type { VueRelationManagerRendererProps } from './types'

function display(value: JsonValue | undefined): string {
  if (value === null || typeof value === 'undefined') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const RelationActions = defineComponent({
  props: {
    manager: { type: Object as PropType<ClientRelationManager>, required: true },
    record: Object as PropType<ClientRelationRecord>,
    selectedIds: Array as PropType<readonly (number | string)[]>,
    relations: { type: Object as PropType<VueRelationManagerRendererProps>, required: true },
  },
  setup(props) {
    const host = computed(() => createRelationActionHost({
      execute: async (request, signal) => props.relations.onOperation?.(request, signal),
      loadOptions: props.relations.loadOptions, manager: props.manager, panelId: props.relations.panelId, record: props.record, selectedIds: props.selectedIds,
    }))
    watch(host, (current, _previous, cleanup) => cleanup(() => { while (current.store.activeFrame) current.store.close() }), { immediate: true })
    return () => host.value.actions[0] ? h(VueActionRenderer, { action: host.value.actions[0], actions: host.value.actions, panelId: props.relations.panelId, recordIds: props.record ? [props.record.id] : props.selectedIds, registry: props.relations.registry, store: host.value.store }) : null
  },
})

const RelationPanel = defineComponent({
  props: {
    manager: { type: Object as PropType<ClientRelationManager>, required: true },
    relations: { type: Object as PropType<VueRelationManagerRendererProps>, required: true },
  },
  setup(props) {
    const selectedIds = ref<readonly (number | string)[]>([])
    return () => {
      const manager = props.manager
      const hasBulk = relationActionManifests(manager).some(action => action.mount === 'bulk')
      const hasRows = !!props.relations.onOperation && manager.records.some(record => relationActionManifests(manager, record).length > 0)
      const presentation: VueTablePresentationProps<ClientRelationRecord> = {
        ariaLabel: `${manager.label} data`, caption: manager.label,
        columns: [
          ...(hasBulk ? [{ header: 'Select', key: 'selection', label: 'Select', render: (record: ClientRelationRecord) => h(Checkbox, { 'aria-label': `Select record ${record.id}`, modelValue: selectedIds.value.includes(record.id), 'onUpdate:modelValue': (checked: boolean | 'indeterminate') => { selectedIds.value = checked === true ? [...selectedIds.value.filter(id => id !== record.id), record.id] : selectedIds.value.filter(id => id !== record.id) } }) }] : []),
          ...manager.columns.map(column => ({ header: column.label, key: column.key, label: column.label, render: (record: ClientRelationRecord): VNodeChild => display(record.values[column.key]) })),
        ],
        containerClass: 'hp-relation-table-overflow', records: manager.records, rowKey: record => record.id,
        ...(hasRows ? { trailing: {
          header: 'Actions', label: 'Actions', render: (record: ClientRelationRecord) => h('div', { 'aria-label': `Actions for ${manager.label.toLocaleLowerCase()} record ${record.id}`, class: 'hp-relation-row-actions', 'data-slot': 'relation-row-actions', role: 'group' }, h(RelationActions, { manager, record, relations: props.relations })),
        } } : {}),
      }
      return h(Card, { 'aria-label': manager.label, class: 'hp-relation-manager', 'data-empty': manager.records.length === 0 || undefined, 'data-relation-manager': manager.id, role: 'region' }, () => [
        h(CardHeader, { class: 'hp-relation-manager-header', 'data-slot': 'relation-manager-header' }, () => [
          h(CardTitle, { class: 'hp-relation-manager-title' }, () => manager.label),
          manager.badge !== null ? h(Badge, { 'aria-label': `${manager.badge} ${manager.label.toLocaleLowerCase()}`, class: 'hp-relation-manager-count', variant: 'secondary' }, () => String(manager.badge)) : null,
          props.relations.onOperation ? h('div', { 'aria-label': `${manager.label} actions`, class: 'hp-relation-toolbar', 'data-slot': 'relation-toolbar', role: 'group' }, h(RelationActions, { manager, relations: props.relations, selectedIds: selectedIds.value })) : null,
        ]),
        h(CardContent, {}, () => manager.records.length === 0
          ? h(Empty, { class: 'hp:min-h-40 hp:border', 'data-slot': 'table-empty' }, () => h(EmptyHeader, {}, () => [h(EmptyTitle, {}, () => 'No records'), h(EmptyDescription, {}, () => manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`)]))
          : h(VueTablePresentation, { presentation })),
      ])
    }
  },
})

export const VueRelationManagerRenderer = defineComponent({
  name: 'VueRelationManagerRenderer',
  props: { relations: { type: Object as PropType<VueRelationManagerRendererProps>, required: true } },
  setup(componentProps) {
    const selection = ref({ ...(componentProps.relations.selection ?? {}) })
    const select = (groupId: string, managerId: string): void => {
      selection.value = { ...selection.value, [groupId]: managerId }
      componentProps.relations.onSelectionChange?.(groupId, managerId)
    }
    return () => {
      const props = componentProps.relations
      const layout = createClientRelationLayout(props.managers, selection.value)
      return h('div', { class: 'hp-relations', 'data-panels-component': 'relation-managers' }, [
        ...layout.inline.map(manager => h(RelationPanel, { key: manager.id, manager, relations: props })),
        ...layout.tabGroups.map(group => h(Tabs, { 'aria-label': group.label ?? 'Related records', class: 'hp-relation-tabs', key: group.id, modelValue: group.activeId, 'onUpdate:modelValue': (value: string | number) => select(group.id, String(value)) }, () => [
          group.label ? h('h2', group.label) : null,
          h(TabsList, {}, () => group.managers.map(manager => h(TabsTrigger, { key: manager.id, value: manager.id }, () => `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))),
          ...group.managers.map(manager => h(TabsContent, { key: manager.id, value: manager.id }, () => h(RelationPanel, { manager, relations: props }))),
        ])),
        layout.pages.length > 0 ? h('nav', { 'aria-label': 'Related record pages', class: 'hp-relation-pages' }, layout.pages.map(manager => h('a', { href: manager.url!, key: manager.id }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))) : null,
      ])
    }
  },
})
