import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ShadcnButton, ShadcnInput, ShadcnSelect, ShadcnTextarea } from '../internal-ui'
import { PanelsButton, PanelsModal } from '../primitives'
import { TablePresentation, type TablePresentationColumn, type TablePresentationPlacement } from '../tables/presentation'
import type { ReactRelationManagerRendererProps } from './types'

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

interface MountedOperation {
  readonly manager: ClientRelationManager
  readonly operation: RelationOperation
  readonly record?: ClientRelationRecord
}

function OperationButton({ manager, onMount, operation, record }: {
  readonly manager: ClientRelationManager
  readonly onMount: (operation: MountedOperation) => void
  readonly operation: RelationOperation
  readonly record?: ClientRelationRecord
}): ReactNode {
  return <ShadcnButton data-operation={operation} onClick={() => onMount({ manager, operation, ...(record ? { record } : {}) })} type="button">{operationLabel(operation)}</ShadcnButton>
}

function RelationPanel({ manager, onMount, operationsEnabled }: {
  readonly manager: ClientRelationManager
  readonly onMount: (operation: MountedOperation) => void
  readonly operationsEnabled: boolean
}): ReactNode {
  const managerActions = operationsEnabled ? managerOperations.filter(operation => manager.operations.includes(operation)) : []
  const recordActions = operationsEnabled ? recordOperations.filter(operation => manager.operations.includes(operation)) : []
  const columns: readonly TablePresentationColumn<ClientRelationRecord>[] = manager.columns.map(column => ({
    header: column.label,
    key: column.key,
    label: column.label,
    render: record => display(record.values[column.key]),
  }))
  const trailing: TablePresentationPlacement<ClientRelationRecord> | undefined = recordActions.length > 0
    ? {
        header: 'Actions',
        label: 'Actions',
        render: record => <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${String(record.id)}`} className="hp-relation-row-actions" data-slot="relation-row-actions" role="group">{recordActions.map(operation => <OperationButton key={operation} manager={manager} onMount={onMount} operation={operation} record={record} />)}</div>,
      }
    : undefined
  return <section aria-label={manager.label} className="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id}>
    <header className="hp-relation-manager-header" data-slot="relation-manager-header">
      <h3 className="hp-relation-manager-title" data-slot="relation-manager-title">{manager.label}</h3>
      {manager.badge !== null ? <span aria-label={`${String(manager.badge)} ${manager.label.toLocaleLowerCase()}`} className="hp-relation-badge hp-relation-manager-count" data-slot="relation-manager-count">{manager.badge}</span> : null}
    </header>
    {managerActions.length > 0 ? <div aria-label={`${manager.label} actions`} className="hp-relation-actions hp-relation-toolbar" data-slot="relation-toolbar" role="group">{managerActions.map(operation => <OperationButton key={operation} manager={manager} onMount={onMount} operation={operation} />)}</div> : null}
    {manager.records.length === 0
      ? <p className="hp-relation-empty hp-relation-loading-empty" data-slot="relation-loading-empty" role="status">{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</p>
      : <TablePresentation
          caption={manager.label}
          columns={columns}
          containerClassName="hp-relation-table-overflow"
          getRowKey={record => record.id}
          records={manager.records}
          trailing={trailing}
        />}
  </section>
}

function initialValues(operation: MountedOperation): Readonly<Record<string, JsonValue>> {
  const fields = operation.operation === 'editPivot' || operation.operation === 'attach'
    ? operation.manager.pivotFields ?? []
    : operation.operation === 'create' || operation.operation === 'edit' ? operation.manager.fields ?? [] : []
  const pivot = operation.record?.values.pivot
  const pivotValues = pivot && !Array.isArray(pivot) && typeof pivot === 'object' ? pivot : {}
  return Object.freeze(Object.fromEntries(fields.map(field => [field.id, operation.operation === 'editPivot' ? pivotValues[field.id] ?? '' : operation.record?.values[field.id] ?? (field.type === 'toggle' ? false : '')])))
}

function RelationOperationModal({ loadOptions, mounted, onClose, onOperation }: {
  readonly loadOptions?: ReactRelationManagerRendererProps['loadOptions']
  readonly mounted: MountedOperation
  readonly onClose: () => void
  readonly onOperation: NonNullable<ReactRelationManagerRendererProps['onOperation']>
}): ReactNode {
  const [values, setValues] = useState<Readonly<Record<string, JsonValue>>>(() => initialValues(mounted))
  const [relatedId, setRelatedId] = useState<number | string>('')
  const [optionSearch, setOptionSearch] = useState('')
  const [options, setOptions] = useState<readonly { readonly label: string, readonly value: number | string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fields = ['attach', 'editPivot'].includes(mounted.operation) ? mounted.manager.pivotFields ?? [] : ['create', 'edit'].includes(mounted.operation) ? mounted.manager.fields ?? [] : []
  const selectsRecord = mounted.operation === 'associate' || mounted.operation === 'attach'
  const destructive = ['delete', 'detach', 'dissociate'].includes(mounted.operation)
  const headingId = `hp-relation-${mounted.manager.id}-${mounted.operation}`
  useEffect(() => {
    if (!selectsRecord || !loadOptions) return
    let active = true
    const timeout = globalThis.setTimeout(() => {
      void loadOptions(mounted.manager.id, optionSearch).then(result => { if (active) setOptions(result) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Related records could not be loaded.') })
    }, 150)
    return () => { active = false; globalThis.clearTimeout(timeout) }
  }, [loadOptions, mounted.manager.id, optionSearch, selectsRecord])
  if (mounted.operation === 'view') {
    return <PanelsModal labelledBy={headingId} onClose={onClose} open>
      <article className="hp-relation-dialog hp-relation-operation-form" data-slot="relation-dialog">
        <header className="hp-relation-dialog-header" data-slot="relation-dialog-header"><h2 id={headingId}>View {mounted.manager.label.toLocaleLowerCase()}</h2></header>
        <div className="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
          <dl className="hp-infolist">{mounted.manager.columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{display(mounted.record?.values[column.key])}</dd></div>)}</dl>
        </div>
        <footer className="hp-relation-dialog-footer" data-slot="relation-dialog-footer"><PanelsButton onClick={onClose} type="button">Close</PanelsButton></footer>
      </article>
    </PanelsModal>
  }
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const selectedId = selectsRecord ? typeof relatedId === 'string' ? relatedId.trim() : relatedId : mounted.record?.id
      await onOperation({
        managerId: mounted.manager.id,
        operation: mounted.operation,
        ...(mounted.operation === 'editPivot' || mounted.operation === 'attach' ? { pivot: values } : fields.length > 0 ? { values } : {}),
        ...(selectedId ? { recordId: selectedId } : {}),
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The relation operation failed.')
    } finally {
      setSubmitting(false)
    }
  }
  return <PanelsModal labelledBy={headingId} onClose={onClose} open>
    <form aria-busy={submitting} className="hp-relation-dialog hp-relation-operation-form" data-pending={submitting || undefined} data-slot="relation-dialog" onSubmit={event => void submit(event)}>
      <header className="hp-relation-dialog-header" data-slot="relation-dialog-header"><h2 id={headingId}>{operationLabel(mounted.operation)} {mounted.manager.label.toLocaleLowerCase()}</h2><p>{destructive ? 'This action changes the relationship immediately.' : `Complete the fields below to ${mounted.operation} this relationship.`}</p></header>
      <div className="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
        {selectsRecord ? loadOptions
          ? <label><span>Related record</span><ShadcnInput aria-label="Search related records" autoFocus placeholder="Search…" value={optionSearch} onChange={event => setOptionSearch(event.currentTarget.value)} /><ShadcnSelect aria-label="Related record" required value={String(relatedId)} onChange={event => setRelatedId(options.find(option => String(option.value) === event.currentTarget.value)?.value ?? '')}><option value="">Select a record</option>{options.map(option => <option key={option.value} value={String(option.value)}>{option.label}</option>)}</ShadcnSelect></label>
          : <label><span>Related record ID</span><ShadcnInput autoFocus required value={relatedId} onChange={event => setRelatedId(event.currentTarget.value)} /></label> : null}
        {fields.map(field => <label key={field.id}><span>{field.label}</span>{field.type === 'textarea'
          ? <ShadcnTextarea required={field.required} value={String(values[field.id] ?? '')} onChange={event => { const value = event.currentTarget.value; setValues(current => ({ ...current, [field.id]: value })) }} />
          : field.type === 'toggle'
            ? <ShadcnInput checked={values[field.id] === true} type="checkbox" onChange={event => { const checked = event.currentTarget.checked; setValues(current => ({ ...current, [field.id]: checked })) }} />
            : <ShadcnInput required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date-time' ? 'datetime-local' : 'text'} value={String(values[field.id] ?? '')} onChange={event => { const value = field.type === 'number' ? event.currentTarget.valueAsNumber : event.currentTarget.value; setValues(current => ({ ...current, [field.id]: value })) }} />}</label>)}
        {submitting ? <p aria-live="polite" className="hp-relation-dialog-pending hp-visually-hidden" data-slot="relation-dialog-pending" role="status">{operationLabel(mounted.operation)} in progress</p> : null}
        {error ? <p className="hp-relation-dialog-error" data-slot="relation-dialog-error" role="alert">{error}</p> : null}
      </div>
      <footer className="hp-relation-dialog-footer" data-slot="relation-dialog-footer"><PanelsButton disabled={submitting} onClick={onClose} type="button">Cancel</PanelsButton><PanelsButton aria-label={submitting ? `${operationLabel(mounted.operation)} in progress` : undefined} data-pending={submitting || undefined} disabled={submitting} tone={destructive ? 'danger' : 'neutral'} type="submit">{submitting ? 'Working…' : operationLabel(mounted.operation)}</PanelsButton></footer>
    </form>
  </PanelsModal>
}

export function ReactRelationManagerRenderer(props: ReactRelationManagerRendererProps): ReactNode {
  const [selection, setSelection] = useState(props.selection ?? {})
  const [mounted, setMounted] = useState<MountedOperation | null>(null)
  const layout = createClientRelationLayout(props.managers, selection)
  const select = (groupId: string, managerId: string): void => {
    setSelection(current => ({ ...current, [groupId]: managerId }))
    props.onSelectionChange?.(groupId, managerId)
  }
  return <div className="hp-relations" data-panels-component="relation-managers">
    {layout.inline.map(manager => <RelationPanel key={manager.id} manager={manager} onMount={setMounted} operationsEnabled={!!props.onOperation} />)}
    {layout.tabGroups.map(group => <section aria-label={group.label ?? 'Related records'} className="hp-relation-tabs" key={group.id}>
      {group.label ? <h2>{group.label}</h2> : null}
      <div aria-label={group.label ?? 'Related records'} role="tablist">{group.managers.map(manager => <ShadcnButton aria-controls={`${group.id}-${manager.id}`} aria-selected={group.activeId === manager.id} id={`${group.id}-${manager.id}-tab`} key={manager.id} onClick={() => select(group.id, manager.id)} role="tab" type="button">{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</ShadcnButton>)}</div>
      {group.managers.map(manager => <div aria-labelledby={`${group.id}-${manager.id}-tab`} hidden={group.activeId !== manager.id} id={`${group.id}-${manager.id}`} key={manager.id} role="tabpanel"><RelationPanel manager={manager} onMount={setMounted} operationsEnabled={!!props.onOperation} /></div>)}
    </section>)}
    {layout.pages.length > 0 ? <nav aria-label="Related record pages" className="hp-relation-pages">{layout.pages.map(manager => <a href={manager.url!} key={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>)}</nav> : null}
    {mounted && props.onOperation ? <RelationOperationModal key={`${mounted.manager.id}:${mounted.operation}:${mounted.record?.id ?? ''}`} loadOptions={props.loadOptions} mounted={mounted} onClose={() => setMounted(null)} onOperation={props.onOperation} /> : null}
  </div>
}
