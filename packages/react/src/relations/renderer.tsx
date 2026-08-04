import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
import { useState, type ReactNode } from 'react'
import type { ReactRelationManagerRendererProps, ReactRelationOperationRequest } from './types'

const managerOperations: readonly RelationOperation[] = ['create', 'associate', 'attach']
const recordOperations: readonly RelationOperation[] = ['view', 'edit', 'delete', 'dissociate', 'detach', 'editPivot']

function operationLabel(operation: RelationOperation): string {
  return operation === 'editPivot'
    ? 'Edit pivot'
    : `${operation[0]?.toUpperCase() ?? ''}${operation.slice(1)}`
}

function display(value: JsonValue | undefined): string {
  if (value === null || typeof value === 'undefined') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function OperationButton({ manager, onOperation, operation, record }: {
  readonly manager: ClientRelationManager
  readonly onOperation: ReactRelationManagerRendererProps['onOperation']
  readonly operation: RelationOperation
  readonly record?: ClientRelationRecord
}): ReactNode {
  const request: ReactRelationOperationRequest = {
    managerId: manager.id,
    operation,
    ...(record ? { recordId: record.id } : {}),
  }
  return <button data-operation={operation} onClick={() => void onOperation?.(request)} type="button">{operationLabel(operation)}</button>
}

function RelationPanel({ manager, onOperation }: {
  readonly manager: ClientRelationManager
  readonly onOperation: ReactRelationManagerRendererProps['onOperation']
}): ReactNode {
  return <section aria-label={manager.label} className="hp-relation-manager" data-relation-manager={manager.id}>
    <header><h3>{manager.label}</h3>{manager.badge !== null ? <span className="hp-relation-badge">{manager.badge}</span> : null}</header>
    <div className="hp-relation-actions">{managerOperations.filter(operation => manager.operations.includes(operation)).map(operation => <OperationButton key={operation} manager={manager} onOperation={onOperation} operation={operation} />)}</div>
    {manager.records.length === 0
      ? <p className="hp-relation-empty">{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</p>
      : <table><caption>{manager.label}</caption><thead><tr>{manager.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>{manager.records.map(record => <tr key={record.id}>{manager.columns.map(column => <td key={column.key}>{display(record.values[column.key])}</td>)}<td>{recordOperations.filter(operation => manager.operations.includes(operation)).map(operation => <OperationButton key={operation} manager={manager} onOperation={onOperation} operation={operation} record={record} />)}</td></tr>)}</tbody></table>}
  </section>
}

export function ReactRelationManagerRenderer(props: ReactRelationManagerRendererProps): ReactNode {
  const [selection, setSelection] = useState(props.selection ?? {})
  const layout = createClientRelationLayout(props.managers, selection)
  const select = (groupId: string, managerId: string): void => {
    setSelection(current => ({ ...current, [groupId]: managerId }))
    props.onSelectionChange?.(groupId, managerId)
  }
  return <div className="hp-relations" data-panels-component="relation-managers">
    {layout.inline.map(manager => <RelationPanel key={manager.id} manager={manager} onOperation={props.onOperation} />)}
    {layout.tabGroups.map(group => <section aria-label={group.label ?? 'Related records'} className="hp-relation-tabs" key={group.id}>
      {group.label ? <h2>{group.label}</h2> : null}
      <div aria-label={group.label ?? 'Related records'} role="tablist">{group.managers.map(manager => <button aria-controls={`${group.id}-${manager.id}`} aria-selected={group.activeId === manager.id} id={`${group.id}-${manager.id}-tab`} key={manager.id} onClick={() => select(group.id, manager.id)} role="tab" type="button">{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</button>)}</div>
      {group.managers.map(manager => <div aria-labelledby={`${group.id}-${manager.id}-tab`} hidden={group.activeId !== manager.id} id={`${group.id}-${manager.id}`} key={manager.id} role="tabpanel"><RelationPanel manager={manager} onOperation={props.onOperation} /></div>)}
    </section>)}
    {layout.pages.length > 0 ? <nav aria-label="Related record pages" className="hp-relation-pages">{layout.pages.map(manager => <a href={manager.url!} key={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>)}</nav> : null}
  </div>
}
