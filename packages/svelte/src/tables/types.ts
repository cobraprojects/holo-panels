import type {
  ClientTransferManifest,
  ClientTransferTransport,
  FilterCollectionPresentation,
  FormPath,
  FormValueAtPath,
  TableRecordId,
  TableSelectionPayload,
  TableState,
  TableStateListener,
} from '@holo-js/panels-client'
import type { SvelteComponentRegistry } from '../registry'
import type { JsonValue } from '@holo-js/panels-client'

export type SvelteTableColumnPath<TRecord extends object> = [FormPath<TRecord>] extends [never] ? string : FormPath<TRecord>

export type SvelteTableColumnValue<TRecord extends object, TPath extends SvelteTableColumnPath<TRecord>> = TPath extends FormPath<TRecord>
  ? FormValueAtPath<TRecord, TPath>
  : unknown

export interface SvelteTableColumnManifest {
  readonly alignment: 'center' | 'end' | 'start'
  readonly copyable: boolean
  readonly formatters?: readonly Readonly<Record<string, unknown>>[]
  readonly hidden: boolean
  readonly inlineEditor: Readonly<Record<string, unknown>> | null
  readonly label: string | null
  readonly lineClamp?: number | null
  readonly path: string
  readonly searchable?: boolean
  readonly sortable: boolean
  readonly toggleable: boolean
  readonly type: string
  readonly width: number | string | null
  readonly wrap: boolean
}

export interface SvelteTableColumn<
  TRecord extends object,
  TPath extends SvelteTableColumnPath<TRecord> = SvelteTableColumnPath<TRecord>,
> {
  readonly manifest: SvelteTableColumnManifest
  readonly render?: (value: SvelteTableColumnValue<TRecord, TPath>, record: Readonly<TRecord>) => boolean | number | string | null | undefined
  readonly url?: (record: Readonly<TRecord>) => string | null
}

export interface SvelteCustomColumnProps<
  TRecord extends object,
  TPath extends SvelteTableColumnPath<TRecord> = SvelteTableColumnPath<TRecord>,
> extends Readonly<Record<string, unknown>> {
  readonly column: SvelteTableColumn<TRecord, TPath>
  readonly record: Readonly<TRecord>
  readonly value: SvelteTableColumnValue<TRecord, TPath>
}

export interface SvelteTableFilterOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: boolean | number | string | null
}

export interface SvelteTableFilter {
  readonly manifest: {
    readonly defaultValue: JsonValue
    readonly id: string
    readonly label: string | null
    readonly layout?: {
      readonly columnSpan?: Readonly<Partial<Record<'2xl' | 'default' | 'lg' | 'md' | 'sm' | 'xl', number | 'full'>>>
      readonly columnStart?: Readonly<Partial<Record<'2xl' | 'default' | 'lg' | 'md' | 'sm' | 'xl', number>>>
    }
    readonly properties: Readonly<Record<string, unknown>>
    readonly type: string
  }
  readonly options?: readonly SvelteTableFilterOption[]
}

export interface SvelteCustomFilterProps extends Record<string, unknown> {
  readonly filter: SvelteTableFilter
  readonly update: (value: JsonValue) => void
  readonly value: JsonValue
}

export interface SvelteFilterCollectionSlotProps extends Record<string, unknown> {
  readonly placement: 'after' | 'before'
  readonly presentation: FilterCollectionPresentation
}

export interface SvelteTableAction {
  readonly color?: string | null
  readonly confirmation?: string
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly scope: 'bulk' | 'header' | 'row'
}

export interface SvelteTableActionRequest<TRecordId extends TableRecordId> {
  readonly actionId: string
  readonly recordId?: TRecordId
  readonly selection?: TableSelectionPayload<TRecordId>
}

export interface SvelteTableActionTransport<TRecordId extends TableRecordId> {
  execute(request: SvelteTableActionRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface SvelteInlineEditRequest<TRecordId extends TableRecordId> {
  readonly action: string
  readonly columnPath: string
  readonly expectedVersion: string | null
  readonly recordId: TRecordId
  readonly value: boolean | number | string | null
}

export interface SvelteInlineEditTransport<TRecordId extends TableRecordId> {
  execute(request: SvelteInlineEditRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface SvelteTableSummary {
  readonly id: string
  readonly label: string
  readonly value: boolean | number | string | null
}

export interface SvelteTableGroup<TRecord extends object> {
  readonly collapsed: boolean
  readonly collapsible?: boolean
  readonly description?: string | null
  readonly key: string
  readonly records: readonly TRecord[]
  readonly summaries?: readonly SvelteTableSummary[]
  readonly title: string
}

export interface SvelteTableStore<TRecord extends object, TRecordId extends TableRecordId> {
  readonly snapshot: TableState<TRecord, TRecordId>
  applyDeferredFilters(): void
  clearSelection(): void
  isSelected(recordId: TRecordId): boolean
  resetFilters(): void
  selectAllMatching(): void
  selectPage(recordIds: readonly TRecordId[], selected?: boolean): void
  selectRecord(recordId: TRecordId, selected?: boolean): void
  selectionPayload(): TableSelectionPayload<TRecordId>
  setFilter(filterId: string, value: JsonValue): void
  setPage(page: number): void
  setSearch(search: string): void
  setSort(sort: readonly { readonly column: string, readonly direction: 'asc' | 'desc' }[]): void
  setVisibleColumns(columns: readonly string[]): void
  subscribe(listener: TableStateListener<TRecord, TRecordId>): () => void
}

export interface SvelteTableRendererProps<TRecord extends object, TRecordId extends TableRecordId> {
  readonly actionTransport?: SvelteTableActionTransport<TRecordId>
  readonly actions?: readonly SvelteTableAction[]
  readonly caption: string
  readonly columns: readonly SvelteTableColumn<TRecord>[]
  readonly emptyMessage?: string
  readonly filters?: readonly SvelteTableFilter[]
  readonly filterPresentation?: FilterCollectionPresentation
  readonly getRecordId: (record: Readonly<TRecord>) => TRecordId
  readonly getRecordActionUrl?: (action: SvelteTableAction, record: Readonly<TRecord>) => string | null
  readonly getRecordVersion?: (record: Readonly<TRecord>) => string | undefined
  readonly groups?: readonly SvelteTableGroup<TRecord>[]
  readonly inlineEditTransport?: SvelteInlineEditTransport<TRecordId>
  readonly onQueryChange?: () => void
  readonly panelId?: string
  readonly registry?: SvelteComponentRegistry
  readonly store: SvelteTableStore<TRecord, TRecordId>
  readonly summaries?: readonly SvelteTableSummary[]
  readonly transferTransport?: ClientTransferTransport
  readonly transfers?: readonly ClientTransferManifest[]
}
