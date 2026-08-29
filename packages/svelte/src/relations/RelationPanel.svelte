<script lang="ts">
  import { relationActionManifests, TableStateStore, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
  import { Badge } from '../ui/badge'
  import * as Card from '../ui/card'
  import TableRenderer from '../tables/TableRenderer.svelte'
  import RelationActions from './RelationActions.svelte'
  import type { SvelteRelationManagerRendererProps } from './contracts'
  import type { SvelteTableAction, SvelteTableColumn, SvelteTableFilter, SvelteTableRendererProps } from '../tables/types'
  import { untrack } from 'svelte'

  let { manager, relations }: { readonly manager: ClientRelationManager, readonly relations: SvelteRelationManagerRendererProps } = $props()
  const initialManager = untrack(() => manager)
  const initialRelations = untrack(() => relations)
  function display(value: JsonValue | undefined): string {
    if (value === null || value === undefined) return '—'
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
  const columns: readonly SvelteTableColumn<ClientRelationRecord>[] = initialManager.columns.map(column => ({ manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: column.label, path: column.key, searchable: column.searchable, sortable: column.sortable === true, toggleable: true, type: 'text', width: null, wrap: false }, render: (_value, record) => display(record.values[column.key]) }))
  let pageActions = $state(initialManager.records.map(record => ({ actions: relationActionManifests(initialManager, record), recordId: record.id })))
  const initialPageActions = untrack(() => pageActions)
  const actions: readonly SvelteTableAction[] = [
    ...(initialManager.actions ?? []).filter(action => action.mount === 'bulk').map(action => ({ id: action.id, label: action.label, scope: 'bulk' as const, resolveManifest: () => action })),
    ...[...new Set(initialPageActions.flatMap(item => item.actions.map(action => action.id)))].map(id => ({ id, label: initialPageActions.flatMap(item => item.actions).find(action => action.id === id)?.label ?? id, resolveManifest: (recordId?: number | string) => pageActions.find(item => String(item.recordId) === String(recordId))?.actions.find(action => action.id === id) ?? null, scope: 'row' as const })),
  ]
  const filters: readonly SvelteTableFilter[] = (initialManager.filters ?? []).map(filter => ({ manifest: filter }))
  const store = new TableStateStore<ClientRelationRecord, number | string>({ filterMode: initialManager.filterMode, panelId: initialRelations.panelId ?? 'default', perPage: initialManager.perPage, records: initialManager.records, selection: initialManager.selection, tableId: initialManager.id, total: initialManager.total ?? initialManager.records.length, visibleColumns: initialManager.columns.map(column => column.key) })
  function refresh(): void {
    if (!relations.onTableQuery) return
    const query = store.query
    void relations.onTableQuery({ managerId: manager.id, query, selection: store.selectionPayload() }).then((page) => {
      const pageManager = { ...manager, recordActions: page.recordActions, records: page.records }
      pageActions = page.records.map(record => ({ actions: relationActionManifests(pageManager, record), recordId: record.id }))
      store.applyData({ queryVersion: query.queryVersion, records: page.records, selection: page.selection, total: page.total })
    }).catch(() => store.applyError(query.queryVersion, { code: 'relation-table-failed', message: 'Unable to load related records.' }))
  }
  const table: SvelteTableRendererProps<ClientRelationRecord, number | string> = {
    actionTransport: initialRelations.onOperation ? { execute: async (request, signal) => {
      const manifest = request.recordId === undefined ? manager.actions?.find(action => action.id === request.actionId && action.mount === 'bulk') : pageActions.find(item => String(item.recordId) === String(request.recordId))?.actions.find(action => action.id === request.actionId)
      if (!manifest) throw new Error('The relation action is not available')
      await relations.onOperation?.({ actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, managerId: manager.id, mount: request.mount, operation: manifest.kind as Parameters<NonNullable<SvelteRelationManagerRendererProps['onOperation']>>[0]['operation'], ...(request.recordId === undefined ? {} : { recordId: request.recordId }), ...(request.selection ? { selection: request.selection } : {}) }, signal)
      refresh()
    } } : undefined,
    actions, caption: initialManager.label, columns, emptyMessage: initialManager.emptyMessage ?? `No ${initialManager.label.toLocaleLowerCase()} found.`, filters, getRecordId: record => record.id, onQueryChange: initialRelations.onTableQuery ? refresh : undefined, panelId: initialRelations.panelId, registry: initialRelations.registry, store,
  }
</script>

<Card.Root aria-label={manager.label} class="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
  <Card.Header class="hp:flex-row hp:items-center hp:gap-3" data-slot="relation-manager-header">
    <Card.Title class="hp:flex-1" data-slot="relation-manager-title">{manager.label}</Card.Title>
    {#if manager.badge !== null}<Badge aria-label={`${manager.badge} ${manager.label.toLocaleLowerCase()}`} class="hp-relation-manager-count" variant="secondary">{manager.badge}</Badge>{/if}
  </Card.Header>
  <Card.Content class="hp:space-y-4">
    {#if relations.onOperation}<div aria-label={`${manager.label} actions`} class="hp-relation-actions hp-relation-toolbar" data-slot="relation-toolbar" role="group"><RelationActions {manager} {relations} /></div>{/if}
    <TableRenderer {table} />
  </Card.Content>
</Card.Root>
