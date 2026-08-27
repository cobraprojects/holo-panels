import { createClientRelationLayout, createRelationActionHost, relationActionManifests, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge, Card, CardContent, CardHeader, CardTitle, Checkbox, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui'
import { ReactActionRenderer } from '../actions/renderer'
import { TablePresentation, type TablePresentationColumn } from '../tables/presentation'
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
  const host = useMemo(() => createRelationActionHost({
    execute: async (request, signal) => props.onOperation?.(request, signal),
    loadOptions: props.loadOptions, manager, panelId: props.panelId, record, selectedIds,
  }), [manager, props.loadOptions, props.onOperation, props.panelId, record, selectedIds])
  useEffect(() => () => { while (host.store.activeFrame) host.store.close() }, [host])
  return host.actions[0] ? <ReactActionRenderer actions={host.actions} manifest={host.actions[0]} panelId={props.panelId} recordIds={record ? [record.id] : selectedIds} registry={props.registry} store={host.store} /> : null
}

function RelationPanel({ manager, props }: { readonly manager: ClientRelationManager, readonly props: ReactRelationManagerRendererProps }): ReactNode {
  const [selectedIds, setSelectedIds] = useState<readonly (number | string)[]>([])
  const hasBulk = relationActionManifests(manager).some(action => action.mount === 'bulk')
  const hasRows = !!props.onOperation && manager.records.some(record => relationActionManifests(manager, record).length > 0)
  const columns: readonly TablePresentationColumn<ClientRelationRecord>[] = [
    ...(hasBulk ? [{
      header: 'Select', key: 'selection', label: 'Select',
      render: (record: ClientRelationRecord) => <Checkbox aria-label={`Select record ${record.id}`} checked={selectedIds.includes(record.id)} onCheckedChange={checked => setSelectedIds(current => checked ? [...current.filter(id => id !== record.id), record.id] : current.filter(id => id !== record.id))} />,
    }] : []),
    ...manager.columns.map(column => ({ header: column.label, key: column.key, label: column.label, render: (record: ClientRelationRecord) => display(record.values[column.key]) })),
  ]
  return <Card aria-label={manager.label} className="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
    <CardHeader className="hp:flex hp:flex-row hp:items-center hp:justify-between">
      <div className="hp:flex hp:items-center hp:gap-2"><CardTitle className="hp-relation-manager-title">{manager.label}</CardTitle>{manager.badge !== null ? <Badge aria-label={`${manager.badge} ${manager.label.toLocaleLowerCase()}`} className="hp-relation-manager-count" variant="secondary">{manager.badge}</Badge> : null}</div>
      {props.onOperation ? <div aria-label={`${manager.label} actions`} className="hp-relation-actions" data-slot="relation-toolbar" role="group"><RelationActions manager={manager} props={props} selectedIds={selectedIds} /></div> : null}
    </CardHeader>
    <CardContent>{manager.records.length === 0
      ? <Empty className="hp:min-h-40 hp:border" data-slot="table-empty"><EmptyHeader><EmptyTitle>No records</EmptyTitle><EmptyDescription>{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</EmptyDescription></EmptyHeader></Empty>
      : <TablePresentation regionLabel={`${manager.label} data`} caption={manager.label} columns={columns} containerClassName="hp-relation-table-overflow" getRowKey={record => record.id} records={manager.records} trailing={hasRows ? {
          header: 'Actions', label: 'Actions', render: record => <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${record.id}`} className="hp-relation-row-actions" data-slot="relation-row-actions" role="group"><RelationActions manager={manager} props={props} record={record} /></div>,
        } : undefined} />}
    </CardContent>
  </Card>
}

export function ReactRelationManagerRenderer(props: ReactRelationManagerRendererProps): ReactNode {
  const [selection, setSelection] = useState(props.selection ?? {})
  const layout = createClientRelationLayout(props.managers, selection)
  const select = (groupId: string, managerId: string): void => {
    setSelection(current => ({ ...current, [groupId]: managerId }))
    props.onSelectionChange?.(groupId, managerId)
  }
  return <div className="hp-relations hp:space-y-6" data-panels-component="relation-managers">
    {layout.inline.map(manager => <RelationPanel key={manager.id} manager={manager} props={props} />)}
    {layout.tabGroups.map(group => <Tabs className="hp-relation-tabs" key={group.id} onValueChange={managerId => select(group.id, managerId)} value={group.activeId}>{group.label ? <h2>{group.label}</h2> : null}<TabsList>{group.managers.map(manager => <TabsTrigger key={manager.id} value={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</TabsTrigger>)}</TabsList>{group.managers.map(manager => <TabsContent key={manager.id} value={manager.id}><RelationPanel manager={manager} props={props} /></TabsContent>)}</Tabs>)}
    {layout.pages.length > 0 ? <nav aria-label="Related record pages" className="hp-relation-pages">{layout.pages.map(manager => <a href={manager.url!} key={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>)}</nav> : null}
  </div>
}
