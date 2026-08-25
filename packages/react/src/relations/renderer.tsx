import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
import { builtInActionPresentation } from '@holo-js/panels-core'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, PanelsIcon, Input, NativeSelect, Textarea } from '../internal-ui'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui'
import { useReactFeedback } from '../notifications/feedback'
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
  const presentation = builtInActionPresentation(operation)
  return <Button className="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={operation} onClick={() => onMount({ manager, operation, ...(record ? { record } : {}) })} type="button" variant={presentation?.destructive ? 'destructive' : 'outline'}>{presentation ? <PanelsIcon name={presentation.icon} /> : null}<span>{operationLabel(operation)}</span></Button>
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
        render: record => <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${String(record.id)}`} className="hp-relation-row-actions hp:flex hp:items-center hp:justify-end hp:gap-1" data-slot="relation-row-actions" role="group">{recordActions.map(operation => <OperationButton key={operation} manager={manager} onMount={onMount} operation={operation} record={record} />)}</div>,
      }
    : undefined
  return <Card aria-label={manager.label} className="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
    <CardHeader className="hp:flex hp:flex-row hp:items-center hp:justify-between"><div className="hp:flex hp:items-center hp:gap-2"><CardTitle className="hp-relation-manager-title">{manager.label}</CardTitle>{manager.badge !== null ? <Badge aria-label={`${String(manager.badge)} ${manager.label.toLocaleLowerCase()}`} className="hp-relation-manager-count" variant="secondary">{manager.badge}</Badge> : null}</div>
    {managerActions.length > 0 ? <div aria-label={`${manager.label} actions`} className="hp-relation-actions hp:flex hp:flex-wrap hp:items-center hp:gap-2" data-slot="relation-toolbar" role="group">{managerActions.map(operation => <OperationButton key={operation} manager={manager} onMount={onMount} operation={operation} />)}</div> : null}</CardHeader>
    <CardContent>
    {manager.records.length === 0
      ? <Empty className="hp-relation-empty hp:min-h-40 hp:border" data-slot="table-empty"><EmptyHeader><EmptyTitle>No records</EmptyTitle><EmptyDescription>{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</EmptyDescription></EmptyHeader></Empty>
      : <TablePresentation
          caption={manager.label}
          columns={columns}
          containerClassName="hp-relation-table-overflow"
          getRowKey={record => record.id}
          records={manager.records}
          trailing={trailing}
        />}
    </CardContent>
  </Card>
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
  const feedback = useReactFeedback()
  const [values, setValues] = useState<Readonly<Record<string, JsonValue>>>(() => initialValues(mounted))
  const [relatedId, setRelatedId] = useState<number | string>('')
  const [optionSearch, setOptionSearch] = useState('')
  const [options, setOptions] = useState<readonly { readonly label: string, readonly value: number | string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fields = ['attach', 'editPivot'].includes(mounted.operation) ? mounted.manager.pivotFields ?? [] : ['create', 'edit'].includes(mounted.operation) ? mounted.manager.fields ?? [] : []
  const selectsRecord = mounted.operation === 'associate' || mounted.operation === 'attach'
  const destructive = ['delete', 'detach', 'dissociate'].includes(mounted.operation)
  const presentation = builtInActionPresentation(mounted.operation)
  const headingId = `hp-relation-${mounted.manager.id}-${mounted.operation}`
  useEffect(() => {
    if (!selectsRecord || !loadOptions) return
    let active = true
    const timeout = globalThis.setTimeout(() => {
      void loadOptions(mounted.manager.id, optionSearch).then(result => { if (active) setOptions(result) }).catch(cause => { if (active) feedback.error('Related records could not be loaded', cause) })
    }, 150)
    return () => { active = false; globalThis.clearTimeout(timeout) }
  }, [feedback, loadOptions, mounted.manager.id, optionSearch, selectsRecord])
  if (mounted.operation === 'view') {
    return <Dialog onOpenChange={open => { if (!open) onClose() }} open>
      <DialogContent className="hp-relation-dialog hp-relation-operation-form" data-slot="relation-dialog">
        <DialogHeader><DialogTitle id={headingId}>View {mounted.manager.label.toLocaleLowerCase()}</DialogTitle><DialogDescription>Review this related record.</DialogDescription></DialogHeader>
        <div className="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
          <dl className="hp-infolist">{mounted.manager.columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{display(mounted.record?.values[column.key])}</dd></div>)}</dl>
        </div>
        <DialogFooter><Button onClick={onClose} type="button">Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  }
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitting(true)
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
      feedback.error(`${operationLabel(mounted.operation)} failed`, cause)
    } finally {
      setSubmitting(false)
    }
  }
  const content = <form aria-busy={submitting} className="hp-relation-operation-form" data-pending={submitting || undefined} onSubmit={event => void submit(event)}>
      {destructive
        ? <AlertDialogHeader><AlertDialogTitle id={headingId}>{operationLabel(mounted.operation)} {mounted.manager.label.toLocaleLowerCase()}</AlertDialogTitle><AlertDialogDescription>{presentation?.confirmation ?? 'Are you sure?'}</AlertDialogDescription></AlertDialogHeader>
        : <DialogHeader><DialogTitle id={headingId}>{operationLabel(mounted.operation)} {mounted.manager.label.toLocaleLowerCase()}</DialogTitle><DialogDescription>Complete the fields below to {mounted.operation} this relationship.</DialogDescription></DialogHeader>}
      <div className="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
        {selectsRecord ? loadOptions
          ? <label><span>Related record</span><Input aria-label="Search related records" autoFocus placeholder="Search…" value={optionSearch} onChange={event => setOptionSearch(event.currentTarget.value)} /><NativeSelect aria-label="Related record" required value={String(relatedId)} onChange={event => setRelatedId(options.find(option => String(option.value) === event.currentTarget.value)?.value ?? '')}><option value="">Select a record</option>{options.map(option => <option key={option.value} value={String(option.value)}>{option.label}</option>)}</NativeSelect></label>
          : <label><span>Related record ID</span><Input autoFocus required value={relatedId} onChange={event => setRelatedId(event.currentTarget.value)} /></label> : null}
        {fields.map(field => <label key={field.id}><span>{field.label}</span>{field.type === 'textarea'
          ? <Textarea required={field.required} value={String(values[field.id] ?? '')} onChange={event => { const value = event.currentTarget.value; setValues(current => ({ ...current, [field.id]: value })) }} />
          : field.type === 'toggle'
            ? <Checkbox checked={values[field.id] === true} onCheckedChange={checked => { setValues(current => ({ ...current, [field.id]: checked === true })) }} />
            : <Input required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date-time' ? 'datetime-local' : 'text'} value={String(values[field.id] ?? '')} onChange={event => { const value = field.type === 'number' ? event.currentTarget.valueAsNumber : event.currentTarget.value; setValues(current => ({ ...current, [field.id]: value })) }} />}</label>)}
        {submitting ? <p aria-live="polite" className="hp-relation-dialog-pending hp-visually-hidden" data-slot="relation-dialog-pending" role="status">{operationLabel(mounted.operation)} in progress</p> : null}
      </div>
      {destructive
        ? <AlertDialogFooter><Button className="hp-action-trigger" disabled={submitting} onClick={onClose} type="button" variant="outline">Cancel</Button><Button aria-label={submitting ? `${operationLabel(mounted.operation)} in progress` : undefined} className="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={mounted.operation} data-pending={submitting || undefined} disabled={submitting} type="submit" variant="destructive">{presentation ? <PanelsIcon name={presentation.icon} /> : null}<span>{submitting ? 'Working…' : operationLabel(mounted.operation)}</span></Button></AlertDialogFooter>
        : <DialogFooter><Button className="hp-action-trigger" disabled={submitting} onClick={onClose} type="button" variant="outline">Cancel</Button><Button aria-label={submitting ? `${operationLabel(mounted.operation)} in progress` : undefined} className="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={mounted.operation} data-pending={submitting || undefined} disabled={submitting} type="submit">{presentation ? <PanelsIcon name={presentation.icon} /> : null}<span>{submitting ? 'Working…' : operationLabel(mounted.operation)}</span></Button></DialogFooter>}
    </form>
  return destructive
    ? <AlertDialog onOpenChange={open => { if (!open) onClose() }} open><AlertDialogContent className="hp-relation-dialog" data-slot="relation-dialog">{content}</AlertDialogContent></AlertDialog>
    : <Dialog onOpenChange={open => { if (!open) onClose() }} open><DialogContent className="hp-relation-dialog" data-slot="relation-dialog">{content}</DialogContent></Dialog>
}

export function ReactRelationManagerRenderer(props: ReactRelationManagerRendererProps): ReactNode {
  const [selection, setSelection] = useState(props.selection ?? {})
  const [mounted, setMounted] = useState<MountedOperation | null>(null)
  const layout = createClientRelationLayout(props.managers, selection)
  const select = (groupId: string, managerId: string): void => {
    setSelection(current => ({ ...current, [groupId]: managerId }))
    props.onSelectionChange?.(groupId, managerId)
  }
  return <div className="hp-relations hp:space-y-6" data-panels-component="relation-managers">
    {layout.inline.map(manager => <RelationPanel key={manager.id} manager={manager} onMount={setMounted} operationsEnabled={!!props.onOperation} />)}
    {layout.tabGroups.map(group => <Tabs className="hp-relation-tabs" key={group.id} onValueChange={managerId => select(group.id, managerId)} value={group.activeId}>{group.label ? <h2 className="hp:text-xl hp:font-semibold">{group.label}</h2> : null}<TabsList>{group.managers.map(manager => <TabsTrigger key={manager.id} value={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</TabsTrigger>)}</TabsList>{group.managers.map(manager => <TabsContent key={manager.id} value={manager.id}><RelationPanel manager={manager} onMount={setMounted} operationsEnabled={!!props.onOperation} /></TabsContent>)}</Tabs>)}
    {layout.pages.length > 0 ? <nav aria-label="Related record pages" className="hp-relation-pages">{layout.pages.map(manager => <a href={manager.url!} key={manager.id}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>)}</nav> : null}
    {mounted && props.onOperation ? <RelationOperationModal key={`${mounted.manager.id}:${mounted.operation}:${mounted.record?.id ?? ''}`} loadOptions={props.loadOptions} mounted={mounted} onClose={() => setMounted(null)} onOperation={props.onOperation} /> : null}
  </div>
}
