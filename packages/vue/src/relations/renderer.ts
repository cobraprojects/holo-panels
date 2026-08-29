import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '../internal-ui'
import { createClientRelationLayout, createRelationActionHost, relationActionManifests, TableStateStore, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
import { computed, defineComponent, h, ref, shallowRef, watch, type PropType, type VNodeChild } from 'vue'
import { VueTableRenderer } from '../tables/renderer'
import type { VueTableAction, VueTableColumn, VueTableFilter } from '../tables/types'
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
    const manager = props.manager
    const columns: readonly VueTableColumn<ClientRelationRecord>[] = manager.columns.map(column => ({
      manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: column.label, path: column.key, searchable: column.searchable, sortable: column.sortable === true, toggleable: true, type: 'text', width: null, wrap: false },
      render: (_value, record): VNodeChild => display(record.values[column.key]),
    }))
    const pageActions = shallowRef<NonNullable<ClientRelationManager['recordActions']>>(manager.records.map(record => ({ actions: relationActionManifests(manager, record), recordId: record.id })))
    const actions = computed<readonly VueTableAction[]>(() => [
      ...(manager.actions ?? []).filter(action => action.mount === 'bulk').map(action => ({ id: action.id, label: action.label, scope: 'bulk' as const, resolveManifest: () => action })),
      ...[...new Set(pageActions.value.flatMap(item => item.actions.map(action => action.id)))].map(id => ({
        id,
        label: pageActions.value.flatMap(item => item.actions).find(action => action.id === id)?.label ?? id,
        resolveManifest: (recordId?: number | string) => pageActions.value.find(item => String(item.recordId) === String(recordId))?.actions.find(action => action.id === id) ?? null,
        scope: 'row' as const,
      })),
    ])
    const filters: readonly VueTableFilter[] = (manager.filters ?? []).map(filter => ({ manifest: filter }))
    const store = new TableStateStore<ClientRelationRecord, number | string>({ filterMode: manager.filterMode, panelId: props.relations.panelId ?? 'default', perPage: manager.perPage, records: manager.records, selection: manager.selection, tableId: manager.id, total: manager.total ?? manager.records.length, visibleColumns: manager.columns.map(column => column.key) })
    const refresh = (): void => {
      if (!props.relations.onTableQuery) return
      const query = store.query
      void props.relations.onTableQuery({ managerId: manager.id, query, selection: store.selectionPayload() }).then((page) => {
        const pageManager = { ...manager, recordActions: page.recordActions, records: page.records }
        pageActions.value = page.records.map(record => ({ actions: relationActionManifests(pageManager, record), recordId: record.id }))
        store.applyData({ queryVersion: query.queryVersion, records: page.records, selection: page.selection, total: page.total })
      }).catch(() => store.applyError(query.queryVersion, { code: 'relation-table-failed', message: 'Unable to load related records.' }))
    }
    return () => {
      return h(Card, { 'aria-label': manager.label, class: 'hp-relation-manager', 'data-empty': manager.records.length === 0 || undefined, 'data-relation-manager': manager.id, role: 'region' }, () => [
        h(CardHeader, { class: 'hp-relation-manager-header', 'data-slot': 'relation-manager-header' }, () => [
          h(CardTitle, { class: 'hp-relation-manager-title' }, () => manager.label),
          manager.badge !== null ? h(Badge, { 'aria-label': `${manager.badge} ${manager.label.toLocaleLowerCase()}`, class: 'hp-relation-manager-count', variant: 'secondary' }, () => String(manager.badge)) : null,
          props.relations.onOperation ? h('div', { 'aria-label': `${manager.label} actions`, class: 'hp-relation-toolbar', 'data-slot': 'relation-toolbar', role: 'group' }, h(RelationActions, { manager, relations: props.relations })) : null,
        ]),
        h(CardContent, {}, () => h(VueTableRenderer, { table: {
          actionTransport: props.relations.onOperation ? { execute: async (request: { readonly actionId: string, readonly idempotencyKey?: string, readonly input?: Readonly<Record<string, JsonValue>>, readonly mount?: 'bulk' | 'modal' | 'notification' | 'page' | 'record', readonly recordId?: number | string, readonly selection?: ReturnType<typeof store.selectionPayload> }, signal: AbortSignal) => {
            const manifest = request.recordId === undefined ? manager.actions?.find(action => action.id === request.actionId && action.mount === 'bulk') : pageActions.value.find(item => String(item.recordId) === String(request.recordId))?.actions.find(action => action.id === request.actionId)
            if (!manifest) throw new Error('The relation action is not available')
            await props.relations.onOperation?.({ actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, managerId: manager.id, mount: request.mount, operation: manifest.kind as Parameters<NonNullable<VueRelationManagerRendererProps['onOperation']>>[0]['operation'], ...(request.recordId === undefined ? {} : { recordId: request.recordId }), ...(request.selection ? { selection: request.selection } : {}) }, signal)
            refresh()
          } } : undefined,
          actions: actions.value, caption: manager.label, columns, emptyMessage: manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`, filters, getRecordId: (record: ClientRelationRecord) => record.id, onQueryChange: props.relations.onTableQuery ? refresh : undefined, panelId: props.relations.panelId, registry: props.relations.registry, store,
        } })),
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
        ...layout.inline.map(manager => h(RelationPanel, { key: `${manager.id}:${JSON.stringify(manager.records)}`, manager, relations: props })),
        ...layout.tabGroups.map(group => h(Tabs, { 'aria-label': group.label ?? 'Related records', class: 'hp-relation-tabs', key: group.id, modelValue: group.activeId, 'onUpdate:modelValue': (value: string | number) => select(group.id, String(value)) }, () => [
          group.label ? h('h2', group.label) : null,
          h(TabsList, {}, () => group.managers.map(manager => h(TabsTrigger, { key: manager.id, value: manager.id }, () => `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))),
          ...group.managers.map(manager => h(TabsContent, { key: manager.id, value: manager.id }, () => h(RelationPanel, { key: `${manager.id}:${JSON.stringify(manager.records)}`, manager, relations: props }))),
        ])),
        layout.pages.length > 0 ? h('nav', { 'aria-label': 'Related record pages', class: 'hp-relation-pages' }, layout.pages.map(manager => h('a', { href: manager.url!, key: manager.id }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))) : null,
      ])
    }
  },
})
