import type {
  ClientTransferManifest,
  ClientTransferTransport,
  ClientToastStore,
  FilterCollectionPresentation,
  FormPath,
  FormValueAtPath,
  TableRecordId,
  TableActionDefinition,
  TableActionExecutionRequest,
  TableSelectionPayload,
  TableState,
  TableStateListener,
} from '@holo-js/panels-client'
import type { VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'
import type { JsonValue } from '@holo-js/panels-client'

export type VueTableColumnPath<TRecord extends object> = [FormPath<TRecord>] extends [never] ? string : FormPath<TRecord>

export type VueTableColumnValue<TRecord extends object, TPath extends VueTableColumnPath<TRecord>> = TPath extends FormPath<TRecord>
  ? FormValueAtPath<TRecord, TPath>
  : unknown

export interface VueTableColumnManifest {
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

export interface VueTableColumn<
  TRecord extends object,
  TPath extends VueTableColumnPath<TRecord> = VueTableColumnPath<TRecord>,
> {
  readonly manifest: VueTableColumnManifest
  readonly render?: (value: VueTableColumnValue<TRecord, TPath>, record: Readonly<TRecord>) => VNodeChild
  readonly url?: (record: Readonly<TRecord>) => string | null
}

export interface VueCustomColumnProps<
  TRecord extends object,
  TPath extends VueTableColumnPath<TRecord> = VueTableColumnPath<TRecord>,
> extends Readonly<Record<string, unknown>> {
  readonly column: VueTableColumn<TRecord, TPath>
  readonly record: Readonly<TRecord>
  readonly value: VueTableColumnValue<TRecord, TPath>
}

export interface VueTableFilterOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: boolean | number | string | null
}

export interface VueTableFilter {
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
  readonly options?: readonly VueTableFilterOption[]
}

export interface VueCustomFilterProps {
  readonly filter: VueTableFilter
  readonly update: (value: JsonValue) => void
  readonly value: JsonValue
}

export interface VueFilterCollectionSlotProps {
  readonly placement: 'after' | 'before'
  readonly presentation: FilterCollectionPresentation
}

export interface VueTableAction extends TableActionDefinition {
  readonly color?: string | null
  readonly confirmation?: string
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly scope: 'bulk' | 'header' | 'row'
}

export interface VueTableActionGroup {
  readonly emptyStateOnly?: boolean
  readonly actions: readonly VueTableAction[]
  readonly color?: string | null
  readonly icon?: string | null
  readonly id: string
  readonly kind: 'action-group'
  readonly label?: string | null
  readonly scope: 'bulk' | 'header' | 'row'
}

export type VueTableActionItem = VueTableAction | VueTableActionGroup

export interface VueTableActionRequest<TRecordId extends TableRecordId> extends TableActionExecutionRequest<TRecordId> {
  readonly actionId: string
  readonly recordId?: TRecordId
  readonly selection?: TableSelectionPayload<TRecordId>
}

export interface VueTableActionTransport<TRecordId extends TableRecordId> {
  execute(request: VueTableActionRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface VueInlineEditRequest<TRecordId extends TableRecordId> {
  readonly action: string
  readonly columnPath: string
  readonly expectedVersion: string | null
  readonly recordId: TRecordId
  readonly value: boolean | number | string | null
}

export interface VueInlineEditTransport<TRecordId extends TableRecordId> {
  execute(request: VueInlineEditRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface VueTableSummary {
  readonly id: string
  readonly label: string
  readonly value: VNodeChild
}

export interface VueTableGroup<TRecord extends object> {
  readonly collapsed: boolean
  readonly collapsible?: boolean
  readonly description?: string | null
  readonly key: string
  readonly records: readonly TRecord[]
  readonly summaries?: readonly VueTableSummary[]
  readonly title: string
}

export interface VueTableStore<TRecord extends object, TRecordId extends TableRecordId> {
  readonly selectionSettings: Readonly<{ currentPageOnly: boolean, groupsOnly: boolean, maximum: number | null }>
  readonly canSelectAllMatching: boolean
  readonly selectedCount: number
  canSelectRecord(recordId: TRecordId): boolean
  selectGroup(recordIds: readonly TRecordId[], groupKey: string, selected?: boolean): void
  readonly snapshot: TableState<TRecord, TRecordId>
  applyDeferredFilters(): void
  clearSelection(): void
  isSelected(recordId: TRecordId): boolean
  resetFilters(): void
  selectAllMatching(): void
  selectPage(recordIds: readonly TRecordId[], selected?: boolean): void
  selectRecord(recordId: TRecordId, selected?: boolean, groupKey?: string): void
  selectionPayload(): TableSelectionPayload<TRecordId>
  setFilter(filterId: string, value: JsonValue): void
  setPage(page: number): void
  setPerPage?(perPage: number): void
  setSearch(search: string): void
  setSort(sort: readonly { readonly column: string, readonly direction: 'asc' | 'desc' }[]): void
  setVisibleColumns(columns: readonly string[]): void
  subscribe(listener: TableStateListener<TRecord, TRecordId>): () => void
}

export interface VueTableRendererProps<
  TRecord extends object,
  TRecordId extends TableRecordId,
> {
  readonly actionTransport?: VueTableActionTransport<TRecordId>
  readonly actions?: readonly VueTableActionItem[]
  readonly caption: string
  readonly columns: readonly VueTableColumn<TRecord>[]
  readonly emptyMessage?: string
  readonly filters?: readonly VueTableFilter[]
  readonly filterPresentation?: FilterCollectionPresentation
  readonly getRecordId: (record: Readonly<TRecord>) => TRecordId
  readonly getRecordVersion?: (record: Readonly<TRecord>) => string | undefined
  readonly groups?: readonly VueTableGroup<TRecord>[]
  readonly inlineEditTransport?: VueInlineEditTransport<TRecordId>
  readonly notificationStore?: ClientToastStore
  readonly onQueryChange?: () => void
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly store: VueTableStore<TRecord, TRecordId>
  readonly summaries?: readonly VueTableSummary[]
  readonly transferTransport?: ClientTransferTransport
  readonly transfers?: readonly ClientTransferManifest[]
}
