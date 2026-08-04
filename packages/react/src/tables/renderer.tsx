import {
  Fragment,
  createElement,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ClientTransferStore, type ClientTransferManifest, type FilterCollectionPresentation, type JsonValue, type TableRecordId } from '@holo-js/panels-client'
import { PanelsModal } from '../primitives'
import { useTableStore } from '../store'
import { displayValue, pages, recordValue, visibleColumns } from './helpers'
import { ReactTableColumnPresentation } from './presentation'
import type {
  ReactTableAction,
  ReactTableColumn,
  ReactTableFilter,
  ReactCustomFilterProps,
  ReactTableGroup,
  ReactTableRendererProps,
  ReactTableSummary,
  ReactFilterCollectionSlotProps,
} from './types'

function notifyQueryChange(callback: (() => void) | undefined): void {
  callback?.()
}

const emptyTransferState = Object.freeze({ error: null, inspection: null, progress: null, uploadProgress: 0, version: 0 })

const filterBreakpoints = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

type FilterStyle = CSSProperties & Readonly<Record<`--hp-filter-${string}`, number | string | undefined>>

function collectionStyle(columns: FilterCollectionPresentation['columns']): FilterStyle {
  const style: Record<string, number> = {}
  for (const breakpoint of filterBreakpoints) {
    const value = columns[breakpoint]
    if (value !== undefined) style[`--hp-filter-columns-${breakpoint}`] = value
  }
  return style as FilterStyle
}

function filterStyle(layout: NonNullable<ReactTableFilter['manifest']['layout']>): FilterStyle {
  const style: Record<string, number | string> = {}
  for (const breakpoint of filterBreakpoints) {
    const span = layout.columnSpan?.[breakpoint]
    const start = layout.columnStart?.[breakpoint]
    if (span !== undefined) style[`--hp-filter-column-span-${breakpoint}`] = span === 'full' ? '-1' : `span ${span}`
    if (start !== undefined) style[`--hp-filter-column-start-${breakpoint}`] = start
  }
  const defaultSpan = layout.columnSpan?.default
  if (defaultSpan !== undefined) style['--hp-filter-column-span'] = defaultSpan === 'full' ? '-1' : `span ${defaultSpan}`
  if (layout.columnStart?.default !== undefined) style['--hp-filter-column-start'] = layout.columnStart.default
  return style as FilterStyle
}

function orderedFilters(filters: readonly ReactTableFilter[], presentation: FilterCollectionPresentation | undefined): readonly ReactTableFilter[] {
  const ids = presentation?.schema.components.flatMap(component => {
    const id = component.properties.leaf?.definition.id
    return typeof id === 'string' ? [id] : []
  }) ?? []
  if (ids.length === 0) return filters
  const byId = new Map(filters.map(filter => [filter.manifest.id, filter]))
  return [...ids.flatMap(id => byId.get(id) ? [byId.get(id) as ReactTableFilter] : []), ...filters.filter(filter => !ids.includes(filter.manifest.id))]
}

function FilterCollectionSlot<TRecord extends object, TRecordId extends TableRecordId>({ placement, props }: {
  readonly placement: ReactFilterCollectionSlotProps['placement']
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
}): ReactNode {
  const presentation = props.filterPresentation
  const references = presentation?.slots[placement] ?? []
  if (references.length === 0) return null
  if (!props.registry || !presentation) throw new Error(`[Holo Panels] A React component registry is required for table filter ${placement} content.`)
  return references.map(reference => {
    const Renderer = props.registry?.resolve<ReactFilterCollectionSlotProps>(reference.component, props.panelId, `table filter ${placement} content`)
    return Renderer ? createElement(Renderer, {
      ...reference.properties,
      key: `${reference.source}:${reference.order}:${reference.component}`,
      placement,
      presentation,
    }) : null
  })
}

function TableFilters<TRecord extends object, TRecordId extends TableRecordId>({ filters, props }: {
  readonly filters: readonly ReactTableFilter[]
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
}): ReactNode {
  const state = useTableStore(props.store)
  const modalTitleId = useId()
  const [open, setOpen] = useState(false)
  if (filters.length === 0) return null
  const presentation = props.filterPresentation
  const placement = presentation?.placement ?? 'inline'
  const content = <form
    aria-label="Table filters"
    className="hp-table-filters"
    data-filter-placement={placement}
    style={collectionStyle(presentation?.columns ?? { default: 1 })}
    onSubmit={event => {
    event.preventDefault()
    props.store.applyDeferredFilters()
    notifyQueryChange(props.onQueryChange)
  }}>
    <FilterCollectionSlot placement="before" props={props} />
    {orderedFilters(filters, presentation).map(filter => {
      const id = `hp-filter-${filter.manifest.id}`
      const value = state.filters.draft[filter.manifest.id] ?? filter.manifest.defaultValue
      const update = (next: JsonValue): void => {
        props.store.setFilter(filter.manifest.id, next)
        if (state.filters.mode === 'live') notifyQueryChange(props.onQueryChange)
      }
      const label = filter.manifest.label ?? filter.manifest.id
      const layout = filter.manifest.layout ?? {}
      const wrap = (control: ReactNode): ReactNode => <div
        data-filter-column-span={layout.columnSpan ? JSON.stringify(layout.columnSpan) : undefined}
        data-filter-column-start={layout.columnStart ? JSON.stringify(layout.columnStart) : undefined}
        key={filter.manifest.id}
        style={filterStyle(layout)}
      >{control}</div>
      if (filter.manifest.type === 'date-range') {
        const range = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
        const from = typeof Reflect.get(range, 'from') === 'string' ? String(Reflect.get(range, 'from')) : ''
        const to = typeof Reflect.get(range, 'to') === 'string' ? String(Reflect.get(range, 'to')) : ''
        return wrap(<fieldset><legend>{label}</legend>
          <label htmlFor={`${id}-from`}>From<input id={`${id}-from`} onChange={event => update({ from: event.currentTarget.value || null, to: to || null })} type="date" value={from} /></label>
          <label htmlFor={`${id}-to`}>To<input id={`${id}-to`} onChange={event => update({ from: from || null, to: event.currentTarget.value || null })} type="date" value={to} /></label>
        </fieldset>)
      }
      if (filter.manifest.type === 'ternary') {
        return wrap(<label htmlFor={id}>{label}<select id={id} onChange={event => update(event.currentTarget.value)} value={typeof value === 'string' ? value : 'all'}>
          <option value="all">All</option><option value="true">Yes</option><option value="false">No</option>
        </select></label>)
      }
      if (filter.manifest.type === 'trashed') {
        return wrap(<label htmlFor={id}>{label}<select id={id} onChange={event => update(event.currentTarget.value)} value={typeof value === 'string' ? value : 'without'}>
          <option value="without">Without trashed</option><option value="with">With trashed</option><option value="only">Only trashed</option>
        </select></label>)
      }
      if (filter.manifest.type === 'advanced-query') return wrap(<AdvancedFilter filter={filter} update={update} value={value} />)
      if (filter.manifest.type === 'custom' || filter.manifest.type.includes(':filter:')) {
        if (!props.registry) throw new Error(`[Holo Panels] A React component registry is required for filter "${filter.manifest.id}".`)
        const rendererName = filter.manifest.type === 'custom' ? 'filter.custom' : `filter.${filter.manifest.type.replaceAll(':', '.')}`
        const Renderer = props.registry.resolve<ReactCustomFilterProps>(rendererName, props.panelId, `filter "${filter.manifest.id}"`)
        return wrap(createElement(Renderer, { filter, update, value }))
      }
      const multiple = filter.manifest.properties.multiple === true
      const selectedValues = Array.isArray(value) ? value.map(String) : [String(value ?? '')]
      return wrap(<label htmlFor={id}>{label}{filter.options
          ? <select id={id} multiple={multiple} onChange={event => {
              if (multiple) {
                update([...event.currentTarget.selectedOptions].map(option => filter.options?.find(item => String(item.value ?? '') === option.value)?.value ?? null))
                return
              }
              const option = filter.options?.find(item => String(item.value ?? '') === event.currentTarget.value)
              update(option?.value ?? null)
            }} value={multiple ? selectedValues : selectedValues[0]}>
              {filter.options.map(option => <option disabled={option.disabled} key={String(option.value)} value={String(option.value ?? '')}>{option.label}</option>)}
            </select>
          : filter.manifest.type.includes('boolean') || typeof value === 'boolean'
            ? <input checked={value === true} id={id} onChange={event => update(event.currentTarget.checked)} type="checkbox" />
            : <input id={id} onChange={event => update(event.currentTarget.value)} type="search" value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} />}
      </label>)
    })}
    {state.filters.mode === 'deferred' ? <button type="submit">Apply filters</button> : null}
    <button onClick={() => {
      props.store.resetFilters()
      notifyQueryChange(props.onQueryChange)
    }} type="button">Reset filters</button>
    <FilterCollectionSlot placement="after" props={props} />
  </form>
  if (placement === 'inline') return content
  const trigger = <button aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} type="button">Filters</button>
  if (placement === 'dropdown') return <div className="hp-table-filters-dropdown">{trigger}{open ? <div role="dialog">{content}</div> : null}</div>
  return <Fragment>{trigger}<PanelsModal labelledBy={modalTitleId} onClose={() => setOpen(false)} open={open}><h3 id={modalTitleId}>Filters</h3>{content}</PanelsModal></Fragment>
}

function AdvancedFilter({ filter, update, value }: ReactCustomFilterProps): ReactNode {
  const columns = Array.isArray(filter.manifest.properties.columns) ? filter.manifest.properties.columns : []
  const conditions = typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray(value.conditions) ? value.conditions : []
  const normalizedColumns = columns.filter((column): column is Readonly<Record<string, unknown>> => typeof column === 'object' && column !== null && !Array.isArray(column))
  const change = (index: number, name: 'column' | 'operator' | 'value', next: JsonValue): void => {
    const updated = conditions.map((condition, conditionIndex) => conditionIndex === index && typeof condition === 'object' && condition !== null && !Array.isArray(condition)
      ? { ...condition, [name]: next }
      : condition)
    update({ conditions: updated })
  }
  return <fieldset><legend>{filter.manifest.label ?? filter.manifest.id}</legend>
    {conditions.map((condition, index) => {
      if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) return null
      const columnId = typeof condition.column === 'string' ? condition.column : ''
      const column = normalizedColumns.find(item => item.id === columnId)
      const operators = Array.isArray(column?.operators) ? column.operators.filter((item): item is string => typeof item === 'string') : []
      const operator = typeof condition.operator === 'string' ? condition.operator : ''
      const scalarType = typeof column?.scalarType === 'string' ? column.scalarType : 'string'
      const inputValue = Array.isArray(condition.value)
        ? condition.value.join(', ')
        : typeof condition.value === 'string' || typeof condition.value === 'number' ? String(condition.value) : ''
      return <div data-advanced-condition key={index}>
        <select aria-label="Column" onChange={event => change(index, 'column', event.currentTarget.value)} value={columnId}>{normalizedColumns.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.id)}</option>)}</select>
        <select aria-label="Operator" onChange={event => change(index, 'operator', event.currentTarget.value)} value={operator}>{operators.map(item => <option key={item} value={item}>{item}</option>)}</select>
        {!['null', 'not-null'].includes(operator) ? <input aria-label="Value" onChange={event => change(index, 'value', advancedInputValue(event.currentTarget.value, scalarType, operator))} type={scalarType === 'number' ? 'number' : scalarType === 'date' ? 'date' : 'text'} value={inputValue} /> : null}
        <button onClick={() => update({ conditions: conditions.filter((_, conditionIndex) => conditionIndex !== index) })} type="button">Remove condition</button>
      </div>
    })}
    <button disabled={normalizedColumns.length === 0} onClick={() => {
      const column = normalizedColumns[0]
      const operator = Array.isArray(column?.operators) ? column.operators.find(item => typeof item === 'string') : undefined
      if (typeof column?.id !== 'string' || typeof operator !== 'string') return
      update({ conditions: [...conditions, { column: column.id, operator, value: null }] })
    }} type="button">Add condition</button>
  </fieldset>
}

function advancedInputValue(raw: string, scalarType: string, operator: string): JsonValue {
  const values = ['between', 'in', 'not-in'].includes(operator) ? raw.split(',').map(value => value.trim()).filter(Boolean) : [raw]
  const parsed = values.map(value => scalarType === 'number'
    ? Number.isFinite(Number(value)) ? Number(value) : value
    : scalarType === 'boolean' ? value === 'true' : value)
  return ['between', 'in', 'not-in'].includes(operator) ? parsed : parsed[0] ?? null
}

function ColumnManager<TRecord extends object, TRecordId extends TableRecordId>({ props }: {
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
}): ReactNode {
  const state = useTableStore(props.store)
  const [open, setOpen] = useState(false)
  const current = state.visibleColumns.length > 0
    ? new Set(state.visibleColumns)
    : new Set(props.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path))
  return <div className="hp-column-manager">
    <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)} type="button">Columns</button>
    {open ? <div aria-label="Visible columns" role="menu">{props.columns.filter(column => column.manifest.toggleable).map(column => <label key={column.manifest.path} role="menuitemcheckbox" aria-checked={current.has(column.manifest.path)}>
      <input checked={current.has(column.manifest.path)} onChange={event => {
        const next = new Set(current)
        if (event.currentTarget.checked) next.add(column.manifest.path)
        else next.delete(column.manifest.path)
        props.store.setVisibleColumns([...next])
        notifyQueryChange(props.onQueryChange)
      }} type="checkbox" />{column.manifest.label ?? column.manifest.path}
    </label>)}</div> : null}
  </div>
}

function ActionButton<TRecord extends object, TRecordId extends TableRecordId>({ action, props, record }: {
  readonly action: ReactTableAction
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly record?: Readonly<TRecord>
}): ReactNode {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (): Promise<void> => {
    const transport = props.actionTransport
    if (!transport) throw new Error('[Holo Panels] React table actions require an action transport.')
    if (action.confirmation && !globalThis.confirm(action.confirmation)) return
    setPending(true)
    setError(null)
    const controller = new AbortController()
    try {
      await transport.execute({
        actionId: action.id,
        ...(record ? { recordId: props.getRecordId(record) } : {}),
        ...(action.scope === 'bulk' ? { selection: props.store.selectionPayload() } : {}),
      }, controller.signal)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed')
    } finally {
      setPending(false)
    }
  }
  return <span><button disabled={pending} onClick={() => void run()} type="button">{pending ? 'Working…' : action.label}</button>{error ? <span role="alert">{error}</span> : null}</span>
}

function TransferAction<TRecord extends object, TRecordId extends TableRecordId>({ manifest, props }: {
  readonly manifest: ClientTransferManifest
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
}): ReactNode {
  const transport = props.transferTransport
  const store = useMemo(() => transport ? new ClientTransferStore(manifest, transport) : null, [manifest, transport])
  const state = useSyncExternalStore(
    listener => store?.subscribe(listener) ?? (() => undefined),
    () => store?.state ?? emptyTransferState,
    () => emptyTransferState,
  )
  const [open, setOpen] = useState(false)
  const [formatId, setFormatId] = useState(manifest.formatIds[0] ?? '')
  const [mappings, setMappings] = useState<Readonly<Record<string, string>>>({})
  const [columns, setColumns] = useState(() => new Set(manifest.kind === 'export' ? manifest.columns.filter(column => column.visibleByDefault).map(column => column.id) : []))
  const submit = async (): Promise<void> => {
    if (!store) return
    if (manifest.kind === 'import') {
      await store.startImport(formatId, Object.entries(mappings).flatMap(([column, header]) => header ? [{ column, header }] : []))
    } else {
      await store.startExport(formatId, [...columns], props.store.selectionPayload())
    }
  }
  return <span className="hp-transfer-action">
    <button disabled={!transport} onClick={() => setOpen(true)} type="button">{manifest.label}</button>
    <PanelsModal labelledBy={`${manifest.id}-title`} onClose={() => { store?.cancel(); setOpen(false) }} open={open}>
      <h2 id={`${manifest.id}-title`}>{manifest.label}</h2>
      <label>Format<select onChange={event => setFormatId(event.currentTarget.value)} value={formatId}>{manifest.formatIds.map(id => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
      {manifest.kind === 'import' ? <>
        <label>CSV file<input accept=".csv,text/csv" onChange={event => {
          const file = event.currentTarget.files?.[0]
          if (file && store) void store.inspect(file).catch(() => undefined)
        }} type="file" /></label>
        {state.inspection ? manifest.columns.map(column => <label key={column.key}>{column.label}<select required={column.required} onChange={event => {
          const value = event.currentTarget.value
          setMappings(current => ({ ...current, [column.key]: value }))
        }} value={mappings[column.key] ?? ''}>
          <option value="">Do not import</option>{state.inspection?.headers.map(header => <option key={header} value={header}>{header}</option>)}
        </select>{column.example ? <small>Example: {column.example}</small> : null}</label>) : null}
        {state.uploadProgress > 0 ? <progress aria-label="Upload progress" max={100} value={state.uploadProgress} /> : null}
      </> : manifest.columns.map(column => <label key={column.id}><input checked={columns.has(column.id)} onChange={event => {
        const checked = event.currentTarget.checked
        setColumns(current => {
        const next = new Set(current)
        if (checked) next.add(column.id)
        else next.delete(column.id)
        return next
        })
      }} type="checkbox" />{column.label}</label>)}
      <button disabled={!store || (manifest.kind === 'import' && !state.inspection)} onClick={() => void submit().catch(() => undefined)} type="button">Start {manifest.kind}</button>
      {state.progress ? <progress aria-label="Transfer progress" max={Math.max(1, state.progress.total)} value={state.progress.completed} /> : null}
      {state.error ? <div role="alert">{state.error}</div> : null}
      <button onClick={() => setOpen(false)} type="button">Close</button>
    </PanelsModal>
  </span>
}

function InlineCell<TRecord extends object, TRecordId extends TableRecordId>({ column, props, record }: {
  readonly column: ReactTableColumn<TRecord>
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly record: Readonly<TRecord>
}): ReactNode {
  const original = recordValue(record, column.manifest.path)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(displayValue(original) === '—' ? '' : displayValue(original))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const editor = column.manifest.inlineEditor
  const actionTransport = props.actionTransport
  const presentation = <ReactTableColumnPresentation
    column={column}
    onAction={!editor && actionTransport ? actionId => actionTransport.execute({ actionId, recordId: props.getRecordId(record) }, new AbortController().signal) : undefined}
    panelId={props.panelId}
    record={record}
    registry={props.registry}
    value={original}
  />
  if (!editor) return presentation
  const action = editor.action
  const kind = editor.kind
  const editorOptions: readonly unknown[] = Array.isArray(editor.options) ? editor.options : []
  if (typeof action !== 'string' || !['checkbox', 'select', 'text-input', 'toggle'].includes(String(kind))) {
    return presentation
  }
  const save = async (next: boolean | number | string | null = value): Promise<void> => {
    if (!props.inlineEditTransport) throw new Error('[Holo Panels] Inline editing requires an action transport.')
    setPending(true)
    setError(null)
    try {
      await props.inlineEditTransport.execute({
        action,
        columnPath: column.manifest.path,
        expectedVersion: props.getRecordVersion?.(record) ?? null,
        recordId: props.getRecordId(record),
        value: next,
      }, new AbortController().signal)
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inline edit failed')
    } finally {
      setPending(false)
    }
  }
  if (!editing) return <button aria-label={`Edit ${column.manifest.label ?? column.manifest.path}`} onClick={() => setEditing(true)} type="button">{presentation}</button>
  if (kind === 'checkbox' || kind === 'toggle') return <input
    aria-label={column.manifest.label ?? column.manifest.path}
    checked={value === 'Yes' || value === 'true'}
    disabled={pending}
    onChange={event => {
      setValue(event.currentTarget.checked ? 'true' : 'false')
      void save(event.currentTarget.checked)
    }}
    type="checkbox"
  />
  if (kind === 'select') return <select
    aria-label={column.manifest.label ?? column.manifest.path}
    disabled={pending}
    onChange={event => {
      const selected = editorOptions.find(option => typeof option === 'object'
        && option !== null
        && !Array.isArray(option)
        && String(Reflect.get(option, 'value')) === event.currentTarget.value)
      const next = typeof selected === 'object' && selected !== null ? Reflect.get(selected, 'value') : event.currentTarget.value
      if (typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean' || next === null) void save(next)
    }}
    value={value}
  >{editorOptions.map((option, index) => {
      if (typeof option !== 'object' || option === null || Array.isArray(option)) return null
      const optionValue = Reflect.get(option, 'value')
      if (typeof optionValue !== 'string' && typeof optionValue !== 'number' && typeof optionValue !== 'boolean') return null
      const label = Reflect.get(option, 'label')
      return <option disabled={Reflect.get(option, 'disabled') === true} key={String(optionValue)} value={String(optionValue)}>{typeof label === 'string' ? label : `Option ${index + 1}`}</option>
    })}</select>
  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setEditing(false)
      setValue(displayValue(original) === '—' ? '' : displayValue(original))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
  }
  return <span><input aria-label={column.manifest.label ?? column.manifest.path} disabled={pending} onChange={event => setValue(event.currentTarget.value)} onKeyDown={keyDown} ref={input} value={value} />{error ? <span role="alert">{error}</span> : null}</span>
}

function SummaryRows({ columnCount, summaries }: { readonly columnCount: number, readonly summaries: readonly ReactTableSummary[] }): ReactNode {
  if (summaries.length === 0) return null
  return <tfoot>{summaries.map(summary => <tr key={summary.id}><th colSpan={Math.max(1, columnCount)} scope="row">{summary.label}: {summary.value}</th></tr>)}</tfoot>
}

function Records<TRecord extends object, TRecordId extends TableRecordId>({ columns, group, onToggleGroup, props, records }: {
  readonly columns: readonly ReactTableColumn<TRecord>[]
  readonly group?: ReactTableGroup<TRecord>
  readonly onToggleGroup?: () => void
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly records: readonly TRecord[]
}): ReactNode {
  const rowActions = props.actions?.filter(action => action.scope === 'row') ?? []
  return <Fragment>
    {group ? <tr className="hp-table-group"><th colSpan={columns.length + 2} scope="rowgroup">{group.collapsible
      ? <button aria-expanded={!group.collapsed} onClick={onToggleGroup} type="button">{group.title}</button>
      : group.title}{group.description ? <small>{group.description}</small> : null}</th></tr> : null}
    {!group?.collapsed ? records.map(record => {
      const recordId = props.getRecordId(record)
      return <tr key={String(recordId)}>
        <td data-label="Select"><input aria-label={`Select record ${String(recordId)}`} checked={props.store.isSelected(recordId)} onChange={event => props.store.selectRecord(recordId, event.currentTarget.checked)} type="checkbox" /></td>
        {columns.map(column => <td data-label={column.manifest.label ?? column.manifest.path} key={column.manifest.path} style={{ textAlign: column.manifest.alignment, whiteSpace: column.manifest.wrap ? undefined : 'nowrap', width: column.manifest.width ?? undefined }}><InlineCell column={column} props={props} record={record} /></td>)}
        <td data-label="Actions">{rowActions.map(action => <ActionButton action={action} key={action.id} props={props} record={record} />)}</td>
      </tr>
    }) : null}
    {group?.summaries?.map(summary => <tr key={`${group.key}-${summary.id}`}><th colSpan={columns.length + 2} scope="row">{summary.label}: {summary.value}</th></tr>)}
  </Fragment>
}

export function ReactTableRenderer<TRecord extends object, TRecordId extends TableRecordId>(
  props: ReactTableRendererProps<TRecord, TRecordId>,
): ReactNode {
  const state = useTableStore(props.store)
  const captionId = useId()
  const columns = visibleColumns(props, state.visibleColumns)
  const recordIds = state.records.map(props.getRecordId)
  const selectedOnPage = recordIds.length > 0 && recordIds.every(recordId => props.store.isSelected(recordId))
  const pageCount = pages(state.total, state.perPage)
  const headerActions = props.actions?.filter(action => action.scope === 'header') ?? []
  const bulkActions = props.actions?.filter(action => action.scope === 'bulk') ?? []
  const hasSelection = state.selection.mode === 'all-matching' || state.selection.selectedRecordIds.length > 0
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(props.groups?.filter(group => group.collapsed).map(group => group.key)),
  )
  const sort = (column: ReactTableColumn<TRecord>): void => {
    if (!column.manifest.sortable) return
    const active = state.sort.find(item => item.column === column.manifest.path)
    props.store.setSort([{ column: column.manifest.path, direction: active?.direction === 'asc' ? 'desc' : 'asc' }])
    notifyQueryChange(props.onQueryChange)
  }
  return <section aria-labelledby={captionId} className="hp-table-view" data-panels-component="table">
    <h2 id={captionId}>{props.caption}</h2>
    <div className="hp-table-toolbar">
      <label>Search<input onChange={(event: ChangeEvent<HTMLInputElement>) => {
        props.store.setSearch(event.currentTarget.value)
        notifyQueryChange(props.onQueryChange)
      }} type="search" value={state.search} /></label>
      <ColumnManager props={props} />
      {props.transfers?.map(manifest => <TransferAction key={manifest.id} manifest={manifest} props={props} />)}
      {headerActions.map(action => <ActionButton action={action} key={action.id} props={props} />)}
    </div>
    <TableFilters filters={props.filters ?? []} props={props} />
    {hasSelection ? <div aria-live="polite" className="hp-table-bulk-actions">
      <span>{state.selection.mode === 'all-matching' ? `All ${state.total} matching records selected` : `${state.selection.selectedRecordIds.length} records selected`}</span>
      {bulkActions.map(action => <ActionButton action={action} key={action.id} props={props} />)}
      <button onClick={() => props.store.clearSelection()} type="button">Clear selection</button>
    </div> : null}
    {state.selection.mode === 'explicit' && selectedOnPage && state.total > recordIds.length
      ? <button onClick={() => props.store.selectAllMatching()} type="button">Select all {state.total} matching records</button>
      : null}
    {state.error ? <div role="alert"><strong>Unable to load table</strong><span>{state.error.message}</span></div> : null}
    {state.loading ? <div aria-live="polite" role="status">Loading records…</div> : null}
    {!state.loading && !state.error && state.records.length === 0 ? <div className="hp-table-empty">{props.emptyMessage ?? 'No records found.'}</div> : null}
    {state.records.length > 0 ? <div className="hp-table-responsive" role="region" aria-label={`${props.caption} data`} tabIndex={0}>
      <table>
        <caption className="hp-visually-hidden">{props.caption}</caption>
        <thead><tr>
          <th scope="col"><input aria-label="Select page" checked={selectedOnPage} onChange={event => props.store.selectPage(recordIds, event.currentTarget.checked)} type="checkbox" /></th>
          {columns.map(column => <th aria-sort={state.sort.find(item => item.column === column.manifest.path)?.direction === 'asc' ? 'ascending' : state.sort.find(item => item.column === column.manifest.path)?.direction === 'desc' ? 'descending' : 'none'} key={column.manifest.path} scope="col">
            {column.manifest.sortable ? <button onClick={() => sort(column)} type="button">{column.manifest.label ?? column.manifest.path}</button> : column.manifest.label ?? column.manifest.path}
          </th>)}
          <th scope="col">Actions</th>
        </tr></thead>
        <tbody>{props.groups
          ? props.groups.map(group => <Records
              columns={columns}
              group={{ ...group, collapsed: collapsedGroups.has(group.key) }}
              key={group.key}
              onToggleGroup={() => setCollapsedGroups(current => {
                const next = new Set(current)
                if (next.has(group.key)) next.delete(group.key)
                else next.add(group.key)
                return next
              })}
              props={props}
              records={group.records}
            />)
          : <Records columns={columns} props={props} records={state.records} />}</tbody>
        <SummaryRows columnCount={columns.length + 2} summaries={props.summaries ?? []} />
      </table>
    </div> : null}
    <nav aria-label="Table pagination" className="hp-table-pagination">
      <button aria-label="Previous page" disabled={state.page <= 1 || state.loading} onClick={() => {
        props.store.setPage(state.page - 1)
        notifyQueryChange(props.onQueryChange)
      }} type="button">Previous</button>
      <span aria-live="polite">Page {state.page} of {pageCount}</span>
      <button aria-label="Next page" disabled={state.page >= pageCount || state.loading} onClick={() => {
        props.store.setPage(state.page + 1)
        notifyQueryChange(props.onQueryChange)
      }} type="button">Next</button>
    </nav>
  </section>
}
