import { usePanelLocale, usePanelTranslator } from '../localization'
import { createClientRelationLayout, createRelationActionHost, relationActionManifests, TableStateStore, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui'
import { ReactActionRenderer } from '../actions/renderer'
import { ReactTableRenderer } from '../tables/renderer'
import type { ReactTableAction, ReactTableColumn, ReactTableFilter } from '../tables/types'
import type { ReactRelationManagerRendererProps } from './types'

function display(value: JsonValue | undefined): string {
  if (value === null || typeof value === 'undefined') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function RelationActions({ manager, record, selectedIds, props }: {
  readonly manager: ClientRelationManager
  readonly record?: ClientRelationRecord
  readonly selectedIds?: readonly (number | string)[]
  readonly props: ReactRelationManagerRendererProps
}): ReactNode {
  const locale = usePanelLocale()
  const host = useMemo(() => createRelationActionHost({
    execute: async (request, signal) => props.onOperation?.(request, signal),
    locale, loadOptions: props.loadOptions, manager, panelId: props.panelId, record, selectedIds,
  }), [locale, manager, props.loadOptions, props.onOperation, props.panelId, record, selectedIds])
  useEffect(() => () => { while (host.store.activeFrame) host.store.close() }, [host])
  return host.actions[0] ? <ReactActionRenderer actions={host.actions} manifest={host.actions[0]} panelId={props.panelId} recordIds={record ? [record.id] : selectedIds} registry={props.registry} store={host.store} /> : null
}

function RelationPanel({ manager, props }: { readonly manager: ClientRelationManager, readonly props: ReactRelationManagerRendererProps }): ReactNode {
  const translate = usePanelTranslator()
  const locale = usePanelLocale()
  const [pageActions, setPageActions] = useState(manager.records.map(record => ({ actions: relationActionManifests(manager, record, false, locale), recordId: record.id })))
  useEffect(() => setPageActions(manager.records.map(record => ({ actions: relationActionManifests(manager, record, false, locale), recordId: record.id }))), [locale, manager])
  const columns = useMemo<readonly ReactTableColumn<ClientRelationRecord>[]>(() => manager.columns.map(column => ({
    manifest: { alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: column.label, path: column.key, searchable: column.searchable, sortable: column.sortable === true, toggleable: true, type: 'text', width: null, wrap: false },
    render: (_value, record) => display(record.values[column.key]),
  })), [manager.columns])
  const actions = useMemo<readonly ReactTableAction[]>(() => {
    const bulk = (manager.actions ?? []).filter(action => action.mount === 'bulk').map(action => ({ id: action.id, label: action.label, scope: 'bulk' as const, resolveManifest: () => action }))
    const rowIds = [...new Set(pageActions.flatMap(item => item.actions.map(action => action.id)))]
    const rows = rowIds.map(id => ({
      id,
      label: pageActions.flatMap(item => item.actions).find(action => action.id === id)?.label ?? id,
      resolveManifest: (recordId?: number | string) => pageActions.find(item => String(item.recordId) === String(recordId))?.actions.find(action => action.id === id) ?? null,
      scope: 'row' as const,
    }))
    return [...bulk, ...rows]
  }, [manager.actions, pageActions])
  const filters = useMemo<readonly ReactTableFilter[]>(() => (manager.filters ?? []).map(filter => ({ manifest: filter })), [manager.filters])
  const store = useMemo(() => new TableStateStore<ClientRelationRecord, number | string>({
    filterMode: manager.filterMode,
    panelId: props.panelId ?? 'default',
    perPage: manager.perPage,
    records: manager.records,
    selection: manager.selection,
    tableId: manager.id,
    total: manager.total ?? manager.records.length,
    visibleColumns: manager.columns.map(column => column.key),
  }), [manager, props.panelId])
  const refresh = (): void => {
    if (!props.onTableQuery) return
    const query = store.query
    void props.onTableQuery({ managerId: manager.id, query, selection: store.selectionPayload() }).then(page => {
      const pageManager = { ...manager, recordActions: page.recordActions, records: page.records }
      setPageActions(page.records.map(record => ({ actions: relationActionManifests(pageManager, record, false, locale), recordId: record.id })))
      store.applyData({ queryVersion: query.queryVersion, records: page.records, selection: page.selection, total: page.total })
    }).catch(() => store.applyError(query.queryVersion, { code: 'relation-table-failed', message: translate('relations.loadFailed') }))
  }
  return <Card aria-label={manager.label} className="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
    <CardHeader className="hp:flex hp:flex-row hp:items-center hp:justify-between">
      <div className="hp:flex hp:items-center hp:gap-2"><CardTitle className="hp-relation-manager-title">{manager.label}</CardTitle>{manager.badge !== null ? <Badge aria-label={`${manager.badge} ${manager.label.toLocaleLowerCase()}`} className="hp-relation-manager-count" variant="secondary">{manager.badge}</Badge> : null}</div>
      {props.onOperation ? <div aria-label={translate('relations.actions', { label: manager.label })} className="hp-relation-actions" data-slot="relation-toolbar" role="group"><RelationActions manager={manager} props={props} /></div> : null}
    </CardHeader>
    <CardContent><ReactTableRenderer
      actionTransport={props.onOperation ? { execute: async (request, signal) => {
        const manifest = request.recordId === undefined
          ? manager.actions?.find(action => action.id === request.actionId && action.mount === 'bulk')
          : pageActions.find(item => String(item.recordId) === String(request.recordId))?.actions.find(action => action.id === request.actionId)
        if (!manifest) throw new Error('The relation action is not available')
        await props.onOperation?.({ actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, managerId: manager.id, mount: request.mount, operation: manifest.kind as Parameters<NonNullable<ReactRelationManagerRendererProps['onOperation']>>[0]['operation'], ...(request.recordId === undefined ? {} : { recordId: request.recordId }), ...(request.selection ? { selection: request.selection } : {}) }, signal)
      } } : undefined}
      actions={actions}
      caption={manager.label}
      columns={columns}
      emptyMessage={manager.emptyMessage ?? translate('relations.empty', { label: manager.label.toLocaleLowerCase() })}
      filters={filters}
      getRecordId={record => record.id}
      onQueryChange={props.onTableQuery ? refresh : undefined}
      panelId={props.panelId}
      registry={props.registry}
      store={store}
    />
    </CardContent>
  </Card>
}

export function ReactRelationManagerRenderer(props: ReactRelationManagerRendererProps): ReactNode {
  const translate = usePanelTranslator()
  const [selection, setSelection] = useState(props.selection ?? {})
  const layout = createClientRelationLayout(props.managers, selection)
  const select = (groupId: string, managerId: string): void => {
    setSelection(current => ({ ...current, [groupId]: managerId }))
    props.onSelectionChange?.(groupId, managerId)
  }
  return <div className="hp-relations hp:space-y-6" data-panels-component="relation-managers">
    {layout.inline.map(manager => <RelationPanel key={`${manager.id}:${JSON.stringify(manager.records)}`} manager={manager} props={props} />)}
    {layout.tabGroups.map(group => <Tabs className="hp-relation-tabs" key={group.id} onValueChange={managerId => select(group.id, managerId)} value={group.activeId}>{group.label ? <h2>{group.label}</h2> : null}<TabsList>{group.managers.map(manager => <TabsTrigger key={manager.id} value={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</TabsTrigger>)}</TabsList>{group.managers.map(manager => <TabsContent key={manager.id} value={manager.id}><RelationPanel key={`${manager.id}:${JSON.stringify(manager.records)}`} manager={manager} props={props} /></TabsContent>)}</Tabs>)}
    {layout.pages.length > 0 ? <nav aria-label={translate('relations.pages')} className="hp-relation-pages">{layout.pages.map(manager => <a href={manager.url!} key={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>)}</nav> : null}
  </div>
}
