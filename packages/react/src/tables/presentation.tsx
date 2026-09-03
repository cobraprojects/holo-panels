import { usePanelLocale, usePanelTranslator } from '../localization'
import { Fragment, useState, type AriaAttributes, type CSSProperties, type Key, type ReactNode } from 'react'
import { rendererRegistryName, type ExtensionTypeId } from '@holo-js/panels-client'
import { ChevronDown } from 'lucide-react'
import { Button, PanelsIcon } from '../internal-ui'
import { Alert, AlertDescription, AlertTitle, Badge, Checkbox, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Skeleton, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui'
import type { ComponentRegistry } from '../registry'
import type { ReactCustomColumnProps, ReactTableColumn, ReactTableColumnPath, ReactTableColumnValue } from './types'

export interface TablePresentationColumn<TRecord extends object> {
  readonly alignment?: CSSProperties['textAlign']
  readonly ariaSort?: AriaAttributes['aria-sort']
  readonly header: ReactNode
  readonly key: string
  readonly label: string
  readonly render: (record: Readonly<TRecord>) => ReactNode
  readonly width?: number | string | null
  readonly wrap?: boolean
}

export interface TablePresentationPlacement<TRecord extends object> {
  readonly cellClassName?: string
  readonly header: ReactNode
  readonly label: string
  readonly render: (record: Readonly<TRecord>) => ReactNode
}

export interface TablePresentationSummary {
  readonly id: string
  readonly label: string
  readonly value: ReactNode
}

export interface TablePresentationGroup<TRecord extends object> {
  readonly selection?: { readonly checked: boolean, readonly disabled: boolean, readonly onChange: (checked: boolean) => void }
  readonly collapsed?: boolean
  readonly collapsible?: boolean
  readonly description?: ReactNode
  readonly key: string
  readonly onToggle?: () => void
  readonly records: readonly TRecord[]
  readonly summaries?: readonly TablePresentationSummary[]
  readonly title: string
}

export interface TablePresentationProps<TRecord extends object> {
  readonly locale?: string
  readonly caption: string
  readonly columns: readonly TablePresentationColumn<TRecord>[]
  readonly containerClassName?: string
  readonly emptyMessage?: string
  readonly error?: string | null
  readonly getRowKey: (record: Readonly<TRecord>) => Key
  readonly groups?: readonly TablePresentationGroup<TRecord>[]
  readonly leading?: TablePresentationPlacement<TRecord>
  readonly loading?: boolean
  readonly records?: readonly TRecord[]
  readonly regionLabel?: string
  readonly summaries?: readonly TablePresentationSummary[]
  readonly trailing?: TablePresentationPlacement<TRecord>
}

function classNames(...values: readonly (string | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export function TablePresentation<TRecord extends object>({
  caption,
  columns,
  containerClassName,
  emptyMessage,
  error,
  getRowKey,
  groups,
  leading,
  loading = false,
  locale,
  records = [],
  regionLabel,
  summaries = [],
  trailing,
}: TablePresentationProps<TRecord>): ReactNode {
  const translate = usePanelTranslator(locale)
  const columnCount = columns.length + (leading ? 1 : 0) + (trailing ? 1 : 0)
  const state = error
    ? <Alert className="hp-table-error" data-slot="table-error" variant="destructive"><AlertTitle>{translate('tables.loadFailed')}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
    : loading
      ? <div aria-label={translate('tables.loading')} aria-live="polite" className="hp-table-loading hp:space-y-2 hp:py-2" data-slot="table-loading" role="status"><Skeleton className="hp:h-8 hp:w-full" /><Skeleton className="hp:h-8 hp:w-full" /><Skeleton className="hp:h-8 hp:w-full" /></div>
      : records.length === 0
        ? <Empty className="hp-table-empty hp:min-h-40" data-slot="table-empty"><EmptyHeader><EmptyTitle>{translate('tables.noRecords')}</EmptyTitle><EmptyDescription>{emptyMessage ?? translate('tables.empty')}</EmptyDescription></EmptyHeader></Empty>
        : null
  const row = (record: TRecord): ReactNode => {
    return <TableRow key={getRowKey(record)}>
      {leading ? <TableCell className={leading.cellClassName} data-label={leading.label}>{leading.render(record)}</TableCell> : null}
      {columns.map(column => <TableCell
        data-label={column.label}
        key={column.key}
        style={{ textAlign: column.alignment, whiteSpace: column.wrap === false ? 'nowrap' : undefined, width: column.width ?? undefined }}
      >{column.render(record)}</TableCell>)}
      {trailing ? <TableCell className={classNames('hp-table-row-actions hp:whitespace-nowrap', trailing.cellClassName)} data-label={trailing.label}>{trailing.render(record)}</TableCell> : null}
    </TableRow>
  }
  const body = groups && groups.length > 0
    ? groups.map(group => <Fragment key={group.key}>
        <TableRow className="hp-table-group"><TableHead colSpan={columnCount}>
          {group.selection ? <Checkbox aria-label={translate('tables.selectGroup', { group: group.title })} checked={group.selection.checked} disabled={group.selection.disabled} onCheckedChange={checked => group.selection?.onChange(checked === true)} /> : null}
          {group.collapsible
            ? <Button aria-expanded={!group.collapsed} onClick={group.onToggle} type="button"><ChevronDown aria-hidden="true" /><span>{group.title}</span><span className="hp-table-group-count">{group.records.length}</span></Button>
            : group.title}
          {group.description ? <small>{group.description}</small> : null}
        </TableHead></TableRow>
        {!group.collapsed ? group.records.map(row) : null}
        {group.summaries?.map(summary => <TableRow className="hp-table-group-summary" key={`${group.key}-${summary.id}`}><TableHead colSpan={columnCount}>{translate('tables.subtotal', { group: group.title, label: summary.label })} {summary.value}</TableHead></TableRow>)}
      </Fragment>)
    : records.map(row)
  return <div
    className={classNames('hp-table-responsive hp:w-full hp:max-w-full hp:rounded-lg hp:border hp:bg-card', containerClassName)}
    data-panels-component="data-table"
    data-slot="table-container"
  >
    <Table containerProps={{ 'aria-label': regionLabel ?? translate('tables.data', { caption }), role: 'region', tabIndex: 0 }}>
      <TableCaption className="hp:sr-only">{caption}</TableCaption>
      <TableHeader><TableRow>
        {leading ? <TableHead scope="col">{leading.header}</TableHead> : null}
        {columns.map(column => <TableHead aria-sort={column.ariaSort} key={column.key} scope="col" style={{ textAlign: column.alignment }}>{column.header}</TableHead>)}
        {trailing ? <TableHead scope="col">{trailing.header}</TableHead> : null}
      </TableRow></TableHeader>
      <TableBody>{state ? <TableRow><TableCell colSpan={Math.max(1, columnCount)}>{state}</TableCell></TableRow> : body}</TableBody>
      {!state && summaries.length > 0 ? <TableFooter>{summaries.map(summary => <TableRow className="hp-table-total-summary" key={summary.id}><TableHead colSpan={Math.max(1, columnCount)}>{translate('tables.total', { label: summary.label })} {summary.value}</TableHead></TableRow>)}</TableFooter> : null}
    </Table>
  </div>
}

type Formatter = Readonly<Record<string, unknown>> & { readonly kind: string }

function formatterList(manifest: object): readonly Formatter[] {
  const value = Reflect.get(manifest, 'formatters')
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Formatter => (
    typeof item === 'object'
    && item !== null
    && !Array.isArray(item)
    && typeof Reflect.get(item, 'kind') === 'string'
  ))
}

function formatterOptions(formatter: Formatter): Readonly<Record<string, unknown>> {
  const options = formatter.options
  return typeof options === 'object' && options !== null && !Array.isArray(options) ? options as Readonly<Record<string, unknown>> : {}
}

function finiteNumber(value: unknown): number | null {
  const converted = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(converted) ? converted : null
}

function validDate(value: unknown): Date | null {
  const converted = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(converted.getTime()) ? null : converted
}

function formattedValue(input: unknown, formatters: readonly Formatter[], locale: string): string {
  let value: unknown = Array.isArray(input) ? input.map(item => String(item)) : input
  for (const formatter of formatters) {
    try {
      if (formatter.kind === 'list' && Array.isArray(value)) {
        value = value.join(typeof formatter.separator === 'string' ? formatter.separator : ', ')
      } else if (formatter.kind === 'date' || formatter.kind === 'time' || formatter.kind === 'date-time') {
        const date = validDate(value)
        if (date) {
          const defaults: Intl.DateTimeFormatOptions = formatter.kind === 'date'
            ? { dateStyle: 'medium' }
            : formatter.kind === 'time'
              ? { timeStyle: 'short' }
              : { dateStyle: 'medium', timeStyle: 'short' }
          value = new Intl.DateTimeFormat(locale, { ...defaults, ...formatterOptions(formatter) }).format(date)
        }
      } else if (formatter.kind === 'relative-time') {
        const date = validDate(value)
        if (date) {
          const seconds = Math.round((date.getTime() - Date.now()) / 1000)
          const division = [
            { amount: 31_536_000, unit: 'year' },
            { amount: 2_592_000, unit: 'month' },
            { amount: 86_400, unit: 'day' },
            { amount: 3_600, unit: 'hour' },
            { amount: 60, unit: 'minute' },
          ].find(item => Math.abs(seconds) >= item.amount)
          const amount = division ? Math.round(seconds / division.amount) : seconds
          value = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, division?.unit as Intl.RelativeTimeFormatUnit ?? 'second')
        }
      } else if (formatter.kind === 'number' || formatter.kind === 'money') {
        const number = finiteNumber(value)
        if (number !== null) {
          const style = formatter.kind === 'money' ? { currency: String(formatter.currency), style: 'currency' as const } : {}
          value = new Intl.NumberFormat(locale, { ...formatterOptions(formatter), ...style }).format(number)
        }
      } else if (formatter.kind === 'words') {
        value = String(value).trim().split(/\s+/u).slice(0, Number(formatter.count)).join(' ')
      } else if (formatter.kind === 'limit') {
        const text = String(value)
        const characters = Number(formatter.characters)
        value = text.length > characters ? `${text.slice(0, characters)}…` : text
      } else if (formatter.kind === 'prefix') {
        value = `${String(formatter.value ?? '')}${String(value)}`
      } else if (formatter.kind === 'suffix') {
        value = `${String(value)}${String(formatter.value ?? '')}`
      }
    } catch {
      continue
    }
  }
  if (value === null || typeof value === 'undefined') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value !== 'object') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

function safeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^(?:#[\da-f]{3,8}|[a-z][a-z0-9-]*)$/iu.test(value) ? value : null
}

function iconName(formatters: readonly Formatter[], active: boolean): string {
  const icon = formatters.find(formatter => formatter.kind === 'icon')?.name
  const booleanIcons = formatters.find(formatter => formatter.kind === 'boolean-icons')
  const configured = booleanIcons ? active ? booleanIcons.truthy : booleanIcons.falsy : icon
  return typeof configured === 'string' && /^[a-z][a-z0-9-]*$/u.test(configured) ? configured : active ? 'check' : 'x-mark'
}

export function ReactTableColumnPresentation<TRecord extends object>({ column, locale: localeOverride, onAction, panelId, record, registry, value }: {
  readonly column: ReactTableColumn<TRecord>
  readonly locale?: string
  readonly onAction?: (actionId: string) => Promise<void>
  readonly panelId?: string
  readonly record: Readonly<TRecord>
  readonly registry?: ComponentRegistry
  readonly value: unknown
}): ReactNode {
  const inheritedLocale = usePanelLocale()
  const locale = localeOverride ?? inheritedLocale
  const inferredValue = value as ReactTableColumnValue<TRecord, ReactTableColumnPath<TRecord>>
  const translate = usePanelTranslator(locale)
  const [copyStatus, setCopyStatus] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  if (column.render) return column.render(inferredValue, record)
  const formatters = formatterList(column.manifest)
  const formatted = formattedValue(value, formatters, locale)
  const type = column.manifest.type
  const tooltip = formatters.find(formatter => formatter.kind === 'tooltip')?.value
  const url = safeUrl(column.url?.(record)) ?? safeUrl(formatters.find(formatter => formatter.kind === 'url')?.value)
  const actionValue = formatters.find(formatter => formatter.kind === 'action')?.value
  const actionId = typeof actionValue === 'string' && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(actionValue) ? actionValue : null
  const badge = type === 'badge' || formatters.some(formatter => formatter.kind === 'badge' && formatter.value !== false)
  const lineClamp = Reflect.get(column.manifest, 'lineClamp')
  const contentStyle = Number.isSafeInteger(lineClamp) && Number(lineClamp) > 0
    ? { WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: Number(lineClamp), display: '-webkit-box', overflow: 'hidden' }
    : undefined
  let content: ReactNode

  if (type.includes(':column:')) {
    if (!registry) throw new Error(`[Holo Panels] A React component registry is required for custom column "${type}".`)
    const Renderer = registry.resolve<ReactCustomColumnProps<TRecord>>(
      rendererRegistryName('column', type as ExtensionTypeId<'column'>),
      panelId,
      `column "${column.manifest.path}"`,
    )
    const configuration = formatters.find(formatter => formatter.kind === 'custom')?.configuration
    const properties = configuration !== null && typeof configuration === 'object' && !Array.isArray(configuration) ? configuration : {}
    content = <Renderer {...properties} column={column} record={record} value={inferredValue} />
  } else if (type === 'boolean' || type === 'icon') {
    const active = Boolean(value)
    content = <span aria-label={translate(active ? 'filters.yes' : 'filters.no')} data-icon={iconName(formatters, active)} role="img">{active ? '✓' : '✕'}</span>
  } else if (type === 'image') {
    const source = safeUrl(value)
    const size = formatters.find(formatter => formatter.kind === 'size')?.pixels
    const pixels = Number.isSafeInteger(size) && Number(size) > 0 && Number(size) <= 2048 ? Number(size) : undefined
    const circular = formatters.some(formatter => formatter.kind === 'circular' && formatter.value !== false)
    content = source ? <img alt={column.manifest.label ?? ''} className={circular ? 'hp-table-image-circular' : undefined} height={pixels} loading="lazy" src={source} width={pixels} /> : '—'
  } else if (type === 'color') {
    const color = safeColor(value)
    content = color ? <span><span aria-hidden="true" className="hp-table-color" style={{ backgroundColor: color }} />{color}</span> : formatted
  } else if ((type === 'checkbox' || type === 'toggle') && !column.manifest.inlineEditor) {
    content = <Checkbox aria-label={column.manifest.label ?? column.manifest.path} checked={value === true} disabled />
  } else {
    const configuredIcon = formatters.find(formatter => formatter.kind === 'icon')?.name
    const textColor = safeColor(formatters.find(formatter => formatter.kind === 'color')?.value)
    const text = <span data-color={textColor ?? undefined} style={{ ...contentStyle, ...(textColor?.startsWith('#') ? { color: textColor } : {}) }}>
      {typeof configuredIcon === 'string' && /^[a-z][a-z0-9-]*$/u.test(configuredIcon) ? <span aria-hidden="true" data-icon={configuredIcon} /> : null}
      {formatted}
    </span>
    content = badge ? <Badge className="hp-table-badge" variant="secondary">{text}</Badge> : text
  }

  const linked = url ? <a href={url} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>{content}</a> : content
  const actionable = actionId && onAction ? <Button disabled={actionPending} onClick={() => {
    setActionPending(true)
    setActionError(null)
    void onAction(actionId).catch(cause => {
      setActionError(cause instanceof Error ? cause.message : translate('tables.actionFailed'))
    }).finally(() => setActionPending(false))
  }} type="button">{linked}</Button> : linked
  const copy = async (): Promise<void> => {
    if (!globalThis.navigator?.clipboard) {
      setCopyStatus(translate('copy.unavailable'))
      return
    }
    try {
      await globalThis.navigator.clipboard.writeText(formatted)
      setCopyStatus(translate('copy.copied'))
    } catch {
      setCopyStatus(translate('copy.failed'))
    }
  }
  return <span className="hp-table-cell" title={typeof tooltip === 'string' ? tooltip : undefined}>{actionable}{column.manifest.copyable && !column.manifest.inlineEditor
    ? <Button aria-label={translate('copy.label', { label: column.manifest.label ?? column.manifest.path })} className="hp-table-copy" onClick={() => void copy()} size="icon" type="button" variant="ghost"><PanelsIcon name="copy" /></Button>
    : null}<span aria-live="polite" className="hp-visually-hidden">{copyStatus}</span>{actionError ? <span role="alert">{actionError}</span> : null}</span>
}
