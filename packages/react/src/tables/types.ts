import type {
  ClientTransferManifest,
  ClientTransferTransport,
  FilterCollectionPresentation,
  FormPath,
  FormValueAtPath,
  TableRecordId,
  TableSelectionPayload,
  TableActionDefinition,
  TableActionExecutionRequest,
  TableStateStore,
} from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import type { ComponentRegistry } from '../registry'
import type { JsonValue } from '@holo-js/panels-client'

export type ReactTableColumnPath<TRecord extends object> = [FormPath<TRecord>] extends [never] ? string : FormPath<TRecord>

export type ReactTableColumnValue<TRecord extends object, TPath extends ReactTableColumnPath<TRecord>> = TPath extends FormPath<TRecord>
  ? FormValueAtPath<TRecord, TPath>
  : unknown

export interface ReactTableColumnManifest {
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

export interface ReactTableColumn<
  TRecord extends object,
  TPath extends ReactTableColumnPath<TRecord> = ReactTableColumnPath<TRecord>,
> {
  readonly manifest: ReactTableColumnManifest
  readonly render?: (value: ReactTableColumnValue<TRecord, TPath>, record: Readonly<TRecord>) => ReactNode
  readonly url?: (record: Readonly<TRecord>) => string | null
}

export interface ReactCustomColumnProps<
  TRecord extends object,
  TPath extends ReactTableColumnPath<TRecord> = ReactTableColumnPath<TRecord>,
> extends Readonly<Record<string, unknown>> {
  readonly column: ReactTableColumn<TRecord, TPath>
  readonly record: Readonly<TRecord>
  readonly value: ReactTableColumnValue<TRecord, TPath>
}

export interface ReactTableFilterOption {
  readonly disabled?: boolean
  readonly label: string
  readonly value: boolean | number | string | null
}

export interface ReactTableFilter {
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
  readonly options?: readonly ReactTableFilterOption[]
}

export interface ReactCustomFilterProps {
  readonly filter: ReactTableFilter
  readonly update: (value: JsonValue) => void
  readonly value: JsonValue
}

export interface ReactFilterCollectionSlotProps {
  readonly placement: 'after' | 'before'
  readonly presentation: FilterCollectionPresentation
}

export interface ReactTableAction extends TableActionDefinition {
  readonly color?: string | null
  readonly confirmation?: string
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly scope: 'bulk' | 'header' | 'row'
  readonly url?: (recordId: TableRecordId) => string
}

export interface ReactTableActionGroup {
  readonly emptyStateOnly?: boolean
  readonly actions: readonly ReactTableAction[]
  readonly color?: string | null
  readonly icon?: string | null
  readonly id: string
  readonly kind: 'action-group'
  readonly label?: string | null
  readonly scope: 'bulk' | 'header' | 'row'
}

export type ReactTableActionItem = ReactTableAction | ReactTableActionGroup

export interface ReactTableActionRequest<TRecordId extends TableRecordId> extends TableActionExecutionRequest<TRecordId> {
  readonly actionId: string
  readonly recordId?: TRecordId
  readonly selection?: TableSelectionPayload<TRecordId>
}

export interface ReactTableActionTransport<TRecordId extends TableRecordId> {
  execute(request: ReactTableActionRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface ReactInlineEditRequest<TRecordId extends TableRecordId> {
  readonly action: string
  readonly columnPath: string
  readonly expectedVersion: string | null
  readonly recordId: TRecordId
  readonly value: boolean | number | string | null
}

export interface ReactInlineEditTransport<TRecordId extends TableRecordId> {
  execute(request: ReactInlineEditRequest<TRecordId>, signal: AbortSignal): Promise<void>
}

export interface ReactTableSummary {
  readonly id: string
  readonly label: string
  readonly value: ReactNode
}

export interface ReactTableGroup<TRecord extends object> {
  readonly collapsed: boolean
  readonly collapsible?: boolean
  readonly description?: string | null
  readonly key: string
  readonly records: readonly TRecord[]
  readonly summaries?: readonly ReactTableSummary[]
  readonly title: string
}

export interface ReactTableRendererProps<
  TRecord extends object,
  TRecordId extends TableRecordId,
> {
  readonly actionTransport?: ReactTableActionTransport<TRecordId>
  readonly actions?: readonly ReactTableActionItem[]
  readonly caption: string
  readonly columns: readonly ReactTableColumn<TRecord>[]
  readonly emptyMessage?: string
  readonly filters?: readonly ReactTableFilter[]
  readonly filterPresentation?: FilterCollectionPresentation
  readonly getRecordId: (record: Readonly<TRecord>) => TRecordId
  readonly getRecordVersion?: (record: Readonly<TRecord>) => string | undefined
  readonly groups?: readonly ReactTableGroup<TRecord>[]
  readonly inlineEditTransport?: ReactInlineEditTransport<TRecordId>
  readonly locale?: string
  readonly onQueryChange?: () => void
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly store: TableStateStore<TRecord, TRecordId>
  readonly summaries?: readonly ReactTableSummary[]
  readonly transferTransport?: ClientTransferTransport
  readonly transfers?: readonly ClientTransferManifest[]
}
