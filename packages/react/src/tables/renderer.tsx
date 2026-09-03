import { translateFilterOperator } from '@holo-js/panels-client'
import { usePanelTranslator } from '../localization'
import {
  Fragment,
  createElement,
  useEffect,
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
import { ClientTransferStore, createTableActionHost, type ClientTransferManifest, type FilterCollectionPresentation, type JsonValue, type TableRecordId } from '@holo-js/panels-client'
import { ReactActionRenderer } from '../actions/renderer'
import { TablesRenderHook } from '@holo-js/panels-core'
import { ChevronLeft, ChevronRight, Columns3, ListFilter, Search, X } from 'lucide-react'
import { Button, PanelsIcon, Input, NativeSelect } from '../internal-ui'
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Switch,
} from '../ui'
import { ReactPanelsRenderHook } from '../render-hooks'
import { useReactFeedback } from '../notifications/feedback'
import { useTableStore } from '../store'
import { displayValue, pages, paginationRange, perPageOptions, recordValue, visibleColumns } from './helpers'
import { ReactTableColumnPresentation, TablePresentation, type TablePresentationColumn, type TablePresentationGroup, type TablePresentationPlacement } from './presentation'
import type {
  ReactTableAction,
  ReactTableActionGroup,
  ReactTableActionItem,
  ReactTableColumn,
  ReactTableFilter,
  ReactCustomFilterProps,
  ReactTableRendererProps,
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
  const translate = usePanelTranslator(props.locale)
  if (filters.length === 0) return null
  const presentation = props.filterPresentation
  const placement = presentation?.placement ?? 'inline'
  const content = <form
    aria-label={translate('tables.filterForm')}
    className="hp-table-filters hp:grid hp:gap-4"
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
        className="hp:grid hp:gap-2"
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
          <label htmlFor={`${id}-from`}>{translate('filters.from')}<Input id={`${id}-from`} onChange={event => update({ from: event.currentTarget.value || null, to: to || null })} type="date" value={from} /></label>
          <label htmlFor={`${id}-to`}>{translate('filters.to')}<Input id={`${id}-to`} onChange={event => update({ from: from || null, to: event.currentTarget.value || null })} type="date" value={to} /></label>
        </fieldset>)
      }
      if (filter.manifest.type === 'ternary') {
        return wrap(<label htmlFor={id}>{label}<NativeSelect id={id} onChange={event => update(event.currentTarget.value)} value={typeof value === 'string' ? value : 'all'}>
          <option value="all">{translate('filters.all')}</option><option value="true">{translate('filters.yes')}</option><option value="false">{translate('filters.no')}</option>
        </NativeSelect></label>)
      }
      if (filter.manifest.type === 'trashed') {
        return wrap(<label htmlFor={id}>{label}<NativeSelect id={id} onChange={event => update(event.currentTarget.value)} value={typeof value === 'string' ? value : 'without'}>
          <option value="without">{translate('filters.withoutTrashed')}</option><option value="with">{translate('filters.withTrashed')}</option><option value="only">{translate('filters.onlyTrashed')}</option>
        </NativeSelect></label>)
      }
      if (filter.manifest.type === 'advanced-query') return wrap(<AdvancedFilter locale={props.locale} filter={filter} update={update} value={value} />)
      if (filter.manifest.type === 'custom' || filter.manifest.type.includes(':filter:')) {
        if (!props.registry) throw new Error(`[Holo Panels] A React component registry is required for filter "${filter.manifest.id}".`)
        const rendererName = filter.manifest.type === 'custom' ? 'filter.custom' : `filter.${filter.manifest.type.replaceAll(':', '.')}`
        const Renderer = props.registry.resolve<ReactCustomFilterProps>(rendererName, props.panelId, `filter "${filter.manifest.id}"`)
        return wrap(createElement(Renderer, { filter, update, value }))
      }
      const multiple = filter.manifest.properties.multiple === true
      const selectedValues = Array.isArray(value) ? value.map(String) : [String(value ?? '')]
      return wrap(<label htmlFor={id}>{label}{filter.options
          ? <NativeSelect id={id} multiple={multiple} onChange={event => {
              if (multiple) {
                update([...event.currentTarget.selectedOptions].map(option => filter.options?.find(item => String(item.value ?? '') === option.value)?.value ?? null))
                return
              }
              const option = filter.options?.find(item => String(item.value ?? '') === event.currentTarget.value)
              update(option?.value ?? null)
            }} value={multiple ? selectedValues : selectedValues[0]}>
              {!multiple ? <option value="">{translate('filters.all')}</option> : null}
              {filter.options.map(option => <option disabled={option.disabled} key={String(option.value)} value={String(option.value ?? '')}>{option.label}</option>)}
            </NativeSelect>
          : filter.manifest.type.includes('boolean') || typeof value === 'boolean'
            ? <Checkbox checked={value === true} id={id} onCheckedChange={checked => update(checked === true)} />
            : <Input id={id} onChange={event => update(event.currentTarget.value)} type="search" value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} />}
      </label>)
    })}
    {state.filters.mode === 'deferred' ? <Button type="submit">{translate('tables.applyFilters')}</Button> : null}
    <Button onClick={() => {
      props.store.resetFilters()
      notifyQueryChange(props.onQueryChange)
    }} type="button">{translate('tables.resetFilters')}</Button>
    <FilterCollectionSlot placement="after" props={props} />
  </form>
  if (placement === 'inline') return content
  const trigger = <Button aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} type="button" variant="outline"><ListFilter aria-hidden="true" />{translate('tables.filters')}</Button>
  if (placement === 'dropdown') return <Popover onOpenChange={setOpen} open={open}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="end" className="hp:w-96">{content}</PopoverContent></Popover>
  return <Fragment>{trigger}<Dialog onOpenChange={setOpen} open={open}><DialogContent aria-labelledby={modalTitleId} closeLabel={translate('actions.close')}><DialogHeader><DialogTitle id={modalTitleId}>{translate('tables.filters')}</DialogTitle><DialogDescription>{translate('tables.filterDescription')}</DialogDescription></DialogHeader>{content}</DialogContent></Dialog></Fragment>
}

function AdvancedFilter({ filter, locale, update, value }: ReactCustomFilterProps & { readonly locale?: string }): ReactNode {
  const translate = usePanelTranslator(locale)
  const columns = Array.isArray(filter.manifest.properties.columns) ? filter.manifest.properties.columns : []
  const conditions = typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray(value.conditions) ? value.conditions : []
  const normalizedColumns = columns.filter((column): column is Readonly<Record<string, unknown>> => typeof column === 'object' && column !== null && !Array.isArray(column))
  const change = (index: number, name: 'column' | 'operator' | 'value', next: JsonValue): void => {
    const updated = conditions.map((condition, conditionIndex) => conditionIndex === index && typeof condition === 'object' && condition !== null && !Array.isArray(condition)
      ? { ...condition, [name]: next }
      : condition)
    update({ conditions: updated })
  }
  return <fieldset className="hp:grid hp:gap-3"><legend className="hp:text-sm hp:font-medium">{filter.manifest.label ?? filter.manifest.id}</legend>
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
      return <div className="hp:grid hp:grid-cols-1 hp:gap-2 hp:md:grid-cols-4" data-advanced-condition key={index}>
        <NativeSelect aria-label={translate('filters.column')} onChange={event => change(index, 'column', event.currentTarget.value)} value={columnId}>{normalizedColumns.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.id)}</option>)}</NativeSelect>
        <NativeSelect aria-label={translate('filters.operator')} onChange={event => change(index, 'operator', event.currentTarget.value)} value={operator}>{operators.map(item => <option key={item} value={item}>{translateFilterOperator(item, translate)}</option>)}</NativeSelect>
        {!['null', 'not-null'].includes(operator) ? <Input aria-label={translate('filters.value')} onChange={event => change(index, 'value', advancedInputValue(event.currentTarget.value, scalarType, operator))} type={scalarType === 'number' ? 'number' : scalarType === 'date' ? 'date' : 'text'} value={inputValue} /> : null}
        <Button onClick={() => update({ conditions: conditions.filter((_, conditionIndex) => conditionIndex !== index) })} type="button">{translate('filters.removeCondition')}</Button>
      </div>
    })}
    <Button disabled={normalizedColumns.length === 0} onClick={() => {
      const column = normalizedColumns[0]
      const operator = Array.isArray(column?.operators) ? column.operators.find(item => typeof item === 'string') : undefined
      if (typeof column?.id !== 'string' || typeof operator !== 'string') return
      update({ conditions: [...conditions, { column: column.id, operator, value: null }] })
    }} type="button">{translate('filters.addCondition')}</Button>
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
  const translate = usePanelTranslator(props.locale)
  const [open, setOpen] = useState(false)
  const current = state.visibleColumns.length > 0
    ? new Set(state.visibleColumns)
    : new Set(props.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path))
  return <Popover onOpenChange={setOpen} open={open}>
    <PopoverTrigger asChild><Button aria-expanded={open} aria-haspopup="menu" className="hp-column-manager" type="button" variant="outline"><Columns3 aria-hidden="true" />{translate('tables.columns')}</Button></PopoverTrigger>
    <PopoverContent align="end" aria-label={translate('tables.visibleColumns')} className="hp:w-64">{props.columns.filter(column => column.manifest.toggleable).map(column => {
      const id = `hp-column-${column.manifest.path.replace(/[^a-z0-9_-]/giu, '-')}`
      return <div className="hp:flex hp:items-center hp:gap-2 hp:py-1.5 hp:text-sm" key={column.manifest.path}>
      <Checkbox checked={current.has(column.manifest.path)} id={id} onCheckedChange={checked => {
        const next = new Set(current)
        if (checked === true) next.add(column.manifest.path)
        else next.delete(column.manifest.path)
        props.store.setVisibleColumns([...next])
        notifyQueryChange(props.onQueryChange)
      }} /><label htmlFor={id}>{column.manifest.label ?? column.manifest.path}</label>
    </div>
    })}</PopoverContent>
  </Popover>
}

function TableActions<TRecord extends object, TRecordId extends TableRecordId>({ actions, group, props, record }: {
  readonly actions: readonly ReactTableAction[]
  readonly group?: ReactTableActionGroup
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly record?: Readonly<TRecord>
}): ReactNode {
  const translate = usePanelTranslator(props.locale)
  const feedback = useReactFeedback()
  const recordId = record ? props.getRecordId(record) : undefined
  const host = useMemo(() => createTableActionHost({
    actions, group: group ? { ...group, label: group.label ?? translate(group.scope === 'row' ? 'actions.row' : group.scope === 'bulk' ? 'actions.bulk' : 'actions.group') } : undefined, recordId,
    selection: () => props.store.selectionPayload(),
    clearSelection: () => props.store.clearSelection(),
    execute: async (request, signal) => {
      try {
        if (!props.actionTransport) throw new Error('Table actions require an action transport')
        await props.actionTransport.execute(request, signal)
      } catch (cause) {
        if (!signal.aborted) feedback.error(translate('feedback.failedAction', { label: actions.find(action => action.id === request.actionId)?.label ?? translate('actions.action') }), cause)
        throw cause
      }
    },
  }), [actions, feedback, translate, group, props.actionTransport, props.store, recordId])
  useEffect(() => () => { while (host.store.activeFrame) host.store.close() }, [host])
  return host.actions[0] ? <ReactActionRenderer {...host} locale={props.locale} manifest={host.actions[0]} panelId={props.panelId} registry={props.registry} /> : null
}

function ActionGroupButton<TRecord extends object, TRecordId extends TableRecordId>({ group, props, record }: {
  readonly group: ReactTableActionGroup
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly record?: Readonly<TRecord>
}): ReactNode {
  return <TableActions actions={group.actions} group={group} props={props} record={record} />
}

function isActionGroup(item: ReactTableActionItem): item is ReactTableActionGroup {
  return 'kind' in item && item.kind === 'action-group'
}

function actionItem<TRecord extends object, TRecordId extends TableRecordId>(item: ReactTableActionItem, props: ReactTableRendererProps<TRecord, TRecordId>, record?: Readonly<TRecord>): ReactNode {
  return isActionGroup(item)
    ? <ActionGroupButton group={item} key={item.id} props={props} record={record} />
    : <TableActions actions={[item]} key={item.id} props={props} record={record} />
}

function TransferAction<TRecord extends object, TRecordId extends TableRecordId>({ manifest, props }: {
  readonly manifest: ClientTransferManifest
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
}): ReactNode {
  const transport = props.transferTransport
  const translate = usePanelTranslator(props.locale)
  const store = useMemo(() => transport ? new ClientTransferStore(manifest, transport, translate) : null, [manifest, transport, translate])
  const state = useSyncExternalStore(
    listener => store?.subscribe(listener) ?? (() => undefined),
    () => store?.state ?? emptyTransferState,
    () => emptyTransferState,
  )
  const [open, setOpen] = useState(false)
  const [formatId, setFormatId] = useState(manifest.formatIds[0] ?? '')
  const [mappings, setMappings] = useState<Readonly<Record<string, string>>>({})
  const [columns, setColumns] = useState(() => new Set(manifest.kind === 'export' ? manifest.columns.filter(column => column.visibleByDefault).map(column => column.id) : []))
  const kind = translate(`transfers.${manifest.kind}`)
  const submit = async (): Promise<void> => {
    if (!store) return
    if (manifest.kind === 'import') {
      await store.startImport(formatId, Object.entries(mappings).flatMap(([column, header]) => header ? [{ column, header }] : []))
    } else {
      await store.startExport(formatId, [...columns], props.store.selectionPayload())
    }
  }
  return <span className="hp-transfer-action">
    <Button className="hp-action-trigger" data-action={manifest.id} disabled={!transport} onClick={() => setOpen(true)} type="button" variant="outline"><PanelsIcon name={manifest.kind === 'import' ? 'upload' : 'download'} /><span>{manifest.label}</span></Button>
    <Dialog onOpenChange={(next) => { if (!next) store?.cancel(); setOpen(next) }} open={open}><DialogContent closeLabel={translate('actions.close')}>
      <DialogHeader><DialogTitle id={`${manifest.id}-title`}>{manifest.label}</DialogTitle><DialogDescription>{translate('transfers.configure', { kind })}</DialogDescription></DialogHeader>
      <label>{translate('transfers.format')}<NativeSelect onChange={event => setFormatId(event.currentTarget.value)} value={formatId}>{manifest.formatIds.map(id => <option key={id} value={id}>{id.toUpperCase()}</option>)}</NativeSelect></label>
      {manifest.kind === 'import' ? <>
        <label>{translate('transfers.csvFile')}<Input accept=".csv,text/csv" onChange={event => {
          const file = event.currentTarget.files?.[0]
          if (file && store) void store.inspect(file).catch(() => undefined)
        }} type="file" /></label>
        {state.inspection ? manifest.columns.map(column => <label key={column.key}>{column.label}<NativeSelect required={column.required} onChange={event => {
          const value = event.currentTarget.value
          setMappings(current => ({ ...current, [column.key]: value }))
        }} value={mappings[column.key] ?? ''}>
          <option value="">{translate('transfers.doNotImport')}</option>{state.inspection?.headers.map(header => <option key={header} value={header}>{header}</option>)}
        </NativeSelect>{column.example ? <small>{translate('transfers.example', { value: column.example })}</small> : null}</label>) : null}
        {state.uploadProgress > 0 ? <Progress aria-label={translate('transfers.uploadProgress')} max={100} value={state.uploadProgress} /> : null}
      </> : manifest.columns.map(column => <label key={column.id}><Checkbox checked={columns.has(column.id)} onCheckedChange={value => {
        const checked = value === true
        setColumns(current => {
        const next = new Set(current)
        if (checked) next.add(column.id)
        else next.delete(column.id)
        return next
        })
      }} />{column.label}</label>)}
      <DialogFooter><Button disabled={!store || (manifest.kind === 'import' && !state.inspection)} onClick={() => void submit().catch(() => undefined)} type="button">{translate('transfers.start', { kind })}</Button>
      <Button onClick={() => setOpen(false)} type="button" variant="outline">{translate('transfers.close')}</Button></DialogFooter>
      {state.progress ? <Progress aria-label={translate('transfers.transferProgress')} max={Math.max(1, state.progress.total)} value={(state.progress.completed / Math.max(1, state.progress.total)) * 100} /> : null}
      {state.error ? <div role="alert">{state.error}</div> : null}
    </DialogContent></Dialog>
  </span>
}

function InlineCell<TRecord extends object, TRecordId extends TableRecordId>({ column, props, record }: {
  readonly column: ReactTableColumn<TRecord>
  readonly props: ReactTableRendererProps<TRecord, TRecordId>
  readonly record: Readonly<TRecord>
}): ReactNode {
  const translate = usePanelTranslator(props.locale)
  const original = recordValue(record, column.manifest.path)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(displayValue(original) === '—' ? '' : displayValue(original))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const editor = column.manifest.inlineEditor
  const actionTransport = props.actionTransport
  const presentation = <ReactTableColumnPresentation
    locale={props.locale}
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
      setError(cause instanceof Error ? cause.message : translate('tables.inlineFailed'))
    } finally {
      setPending(false)
    }
  }
  if (!editing) return <Button aria-label={translate('tables.editValue', { label: column.manifest.label ?? column.manifest.path })} onClick={() => setEditing(true)} type="button">{presentation}</Button>
  if (kind === 'checkbox' || kind === 'toggle') {
    const Toggle = kind === 'toggle' ? Switch : Checkbox
    return <Toggle
      aria-label={column.manifest.label ?? column.manifest.path}
      checked={value === 'Yes' || value === 'true'}
      disabled={pending}
      onCheckedChange={checked => {
        const next = checked === true
        setValue(next ? 'true' : 'false')
        void save(next)
      }}
    />
  }
  if (kind === 'select') return <NativeSelect
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
      return <option disabled={Reflect.get(option, 'disabled') === true} key={String(optionValue)} value={String(optionValue)}>{typeof label === 'string' ? label : translate('fields.numberedOption', { number: index + 1 })}</option>
    })}</NativeSelect>
  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setEditing(false)
      setValue(displayValue(original) === '—' ? '' : displayValue(original))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
  }
  return <span><Input aria-label={column.manifest.label ?? column.manifest.path} disabled={pending} onChange={event => setValue(event.currentTarget.value)} onKeyDown={keyDown} ref={input} value={value} />{error ? <span role="alert">{error}</span> : null}</span>
}

export function ReactTableRenderer<TRecord extends object, TRecordId extends TableRecordId>(
  props: ReactTableRendererProps<TRecord, TRecordId>,
): ReactNode {
  const translate = usePanelTranslator(props.locale)
  const state = useTableStore(props.store)
  const captionId = useId()
  const columns = visibleColumns(props, state.visibleColumns)
  const recordIds = state.records.map(props.getRecordId)
  const selectedOnPage = recordIds.length > 0 && recordIds.every(recordId => props.store.isSelected(recordId))
  const pageCount = pages(state.total, state.perPage)
  const paginationItems = paginationRange(state.page, pageCount)
  const paginationFrom = state.total === 0 ? 0 : (state.page - 1) * state.perPage + 1
  const paginationTo = Math.min(state.page * state.perPage, state.total)
  const headerActions = props.actions?.filter(action => action.scope === 'header' && (!action.emptyStateOnly || state.records.length === 0)) ?? []
  const bulkActions = props.actions?.filter(action => action.scope === 'bulk') ?? []
  const selectable = bulkActions.length > 0 || (props.transfers?.some(transfer => transfer.kind === 'export') ?? false)
  const hasSelection = selectable && (state.selection.mode === 'all-matching' || state.selection.selectedRecordIds.length > 0)
  const rowActions = props.actions?.filter(action => action.scope === 'row') ?? []
  const rowActionGroups = rowActions.filter(isActionGroup)
  const ungroupedRowActions = rowActions.filter((action): action is ReactTableAction => !isActionGroup(action))
  const defaultRowActionGroup: ReactTableActionGroup = { actions: ungroupedRowActions, id: 'row-actions', kind: 'action-group', scope: 'row' }
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(props.groups?.filter(group => group.collapsed).map(group => group.key)),
  )
  const sort = (column: ReactTableColumn<TRecord>): void => {
    if (!column.manifest.sortable) return
    const active = state.sort.find(item => item.column === column.manifest.path)
    props.store.setSort([{ column: column.manifest.path, direction: active?.direction === 'asc' ? 'desc' : 'asc' }])
    notifyQueryChange(props.onQueryChange)
  }
  const presentationColumns: readonly TablePresentationColumn<TRecord>[] = columns.map(column => {
    const direction = state.sort.find(item => item.column === column.manifest.path)?.direction
    const label = column.manifest.label ?? column.manifest.path
    return {
      alignment: column.manifest.alignment,
      ariaSort: direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      header: column.manifest.sortable
        ? <Button className="hp-table-sort hp:-ms-3 hp:h-8 hp:px-3 hp:text-muted-foreground hp:data-[sorted]:text-foreground" data-sorted={direction ?? undefined} onClick={() => sort(column)} size="sm" type="button" variant="ghost">{label}<PanelsIcon name={direction === 'asc' ? 'chevron-up' : direction === 'desc' ? 'chevron-down' : 'sort'} /></Button>
        : label,
      key: column.manifest.path,
      label,
      render: record => <InlineCell column={column} props={props} record={record} />,
      width: column.manifest.width,
      wrap: column.manifest.wrap,
    }
  })
  const leading: TablePresentationPlacement<TRecord> | undefined = selectable
    ? {
        header: props.store.selectionSettings.groupsOnly ? null : <Checkbox aria-label={translate('tables.selectPage')} checked={selectedOnPage ? true : recordIds.some(id => props.store.isSelected(id)) ? 'indeterminate' : false} disabled={state.loading} onCheckedChange={checked => props.store.selectPage(recordIds, checked === true)} />,
        label: translate('tables.select'),
        render: record => {
          const recordId = props.getRecordId(record)
          return <Checkbox aria-label={translate('tables.selectRecord', { record: String(recordId) })} checked={props.store.isSelected(recordId)} disabled={state.loading || !props.store.canSelectRecord(recordId)} onCheckedChange={checked => props.store.selectRecord(recordId, checked === true, props.groups?.find(group => group.records.some(item => props.getRecordId(item) === recordId))?.key)} />
        },
      }
    : undefined
  const trailing: TablePresentationPlacement<TRecord> | undefined = rowActions.length > 0
    ? {
        header: translate('actions.group'),
        label: translate('actions.group'),
        render: record => <div className="hp:flex hp:items-center hp:justify-end hp:gap-1">{ungroupedRowActions.length > 0 ? <ActionGroupButton group={defaultRowActionGroup} props={props} record={record} /> : null}{rowActionGroups.map(group => <ActionGroupButton group={group} key={group.id} props={props} record={record} />)}</div>,
      }
    : undefined
  const presentationGroups: readonly TablePresentationGroup<TRecord>[] | undefined = props.groups?.map(group => ({
    ...group,
    selection: selectable ? {
      checked: group.records.length > 0 && group.records.every(record => props.store.isSelected(props.getRecordId(record))),
      disabled: state.loading,
      onChange: checked => props.store.selectGroup(group.records.map(props.getRecordId), group.key, checked),
    } : undefined,
    collapsed: collapsedGroups.has(group.key),
    onToggle: () => setCollapsedGroups(current => {
      const next = new Set(current)
      if (next.has(group.key)) next.delete(group.key)
      else next.add(group.key)
      return next
    }),
  }))
  return <section aria-busy={state.loading} aria-labelledby={captionId} className="hp-table-view hp:min-w-0 hp:w-full hp:max-w-full hp:space-y-4" data-panels-component="table" data-state={state.error ? 'error' : state.loading ? 'loading' : state.records.length === 0 ? 'empty' : 'ready'}>
    <ReactPanelsRenderHook hook={TablesRenderHook.HEADER_BEFORE} />
    <h2 className="hp:text-xl hp:font-semibold" id={captionId}>{props.caption}</h2>
    <ReactPanelsRenderHook hook={TablesRenderHook.HEADER_AFTER} />
    <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_BEFORE} />
    <div className="hp-table-toolbar hp:flex hp:flex-wrap hp:items-center hp:gap-2">
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_START} />
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_SEARCH_BEFORE} />
      <label className="hp:min-w-48 hp:flex-1"><span className="hp-visually-hidden">{translate('tables.search')}</span><InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput onChange={(event: ChangeEvent<HTMLInputElement>) => {
        props.store.setSearch(event.currentTarget.value)
        notifyQueryChange(props.onQueryChange)
      }} placeholder={translate('tables.searchPlaceholder')} type="search" value={state.search} /></InputGroup></label>
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_SEARCH_AFTER} />
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE} />
      <ColumnManager props={props} />
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_AFTER} />
      <TableFilters filters={props.filters ?? []} props={props} />
      {props.transfers?.map(manifest => <TransferAction key={manifest.id} manifest={manifest} props={props} />)}
      {headerActions.map(action => actionItem(action, props))}
      <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_END} />
    </div>
    <ReactPanelsRenderHook hook={TablesRenderHook.TOOLBAR_AFTER} />
    {hasSelection ? <div aria-live="polite" className="hp-table-bulk-actions hp:flex hp:flex-wrap hp:items-center hp:gap-2 hp:rounded-md hp:border hp:bg-muted/50 hp:p-3">
      <span>{state.selection.mode === 'all-matching' ? translate('tables.allSelected', { count: props.store.selectedCount }) : translate('tables.selected', { count: props.store.selectedCount })}</span>
      <ReactPanelsRenderHook hook={TablesRenderHook.SELECTION_INDICATOR_ACTIONS_BEFORE} />
      {bulkActions.map(action => actionItem(action, props))}
      <ReactPanelsRenderHook hook={TablesRenderHook.SELECTION_INDICATOR_ACTIONS_AFTER} />
      <Button aria-label={translate('tables.clearSelection')} onClick={() => props.store.clearSelection()} type="button" variant="outline"><X aria-hidden="true" />{translate('tables.clearSelection')}</Button>
    </div> : null}
    {props.store.canSelectAllMatching && state.selection.mode === 'explicit' && selectedOnPage && state.total > recordIds.length
      ? <Button onClick={() => props.store.selectAllMatching()} type="button">{translate('tables.selectAll', { count: state.total })}</Button>
      : null}
    <TablePresentation
      caption={props.caption}
      columns={presentationColumns}
      emptyMessage={props.emptyMessage}
      error={state.error?.message}
      getRowKey={record => props.getRecordId(record)}
      groups={presentationGroups}
      leading={leading}
      loading={state.loading}
      locale={props.locale}
      records={state.records}
      summaries={props.summaries}
      trailing={trailing}
    />
    <nav aria-label={translate('tables.pagination')} className="hp-table-pagination hp:flex hp:flex-wrap hp:items-center hp:justify-between hp:gap-4 hp:text-sm hp:text-muted-foreground" data-slot="table-pagination">
      <span aria-live="polite" className="hp-table-pagination-info">{translate('tables.summary', { from: paginationFrom, to: paginationTo, total: state.total })}</span>
      <label className="hp-table-pagination-per-page hp:flex hp:items-center hp:gap-2">
        <NativeSelect aria-label={translate('tables.resultsPerPage')} disabled={state.loading} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          props.store.setPerPage(Number(event.currentTarget.value))
          notifyQueryChange(props.onQueryChange)
        }} value={state.perPage}>
          {perPageOptions(state.perPage).map(value => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
        <span>{translate('tables.perPage')}</span>
      </label>
      <span className="hp-table-pagination-pages hp:flex hp:items-center hp:gap-1">
        <Button aria-label={translate('tables.previousPage')} disabled={state.page <= 1 || state.loading} onClick={() => {
          props.store.setPage(state.page - 1)
          notifyQueryChange(props.onQueryChange)
        }} size="icon" type="button" variant="outline"><ChevronLeft aria-hidden="true" className="hp:rtl:rotate-180" /></Button>
        {paginationItems.map((item, index) => item === 'ellipsis'
          ? <span aria-hidden="true" className="hp-table-pagination-ellipsis" key={`ellipsis-${index}`}>…</span>
          : <Button
              aria-current={item === state.page ? 'page' : undefined}
              aria-label={translate('tables.page', { page: item })}
              data-active={item === state.page ? 'true' : undefined}
              disabled={state.loading}
              key={item}
              onClick={() => {
                props.store.setPage(item)
                notifyQueryChange(props.onQueryChange)
              }}
              type="button"
              variant={item === state.page ? 'secondary' : 'ghost'}
            >{item}</Button>)}
        <Button aria-label={translate('tables.nextPage')} disabled={state.page >= pageCount || state.loading} onClick={() => {
          props.store.setPage(state.page + 1)
          notifyQueryChange(props.onQueryChange)
        }} size="icon" type="button" variant="outline"><ChevronRight aria-hidden="true" className="hp:rtl:rotate-180" /></Button>
      </span>
    </nav>
  </section>
}
