import type {
  ClientTransferManifest,
  ClientTransferTransport,
  FilterCollectionPresentation,
  TableRecordId,
  TableSelectionPayload,
  TableStateStore,
} from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import type { ComponentRegistry } from '../registry'
import type { JsonValue } from '@holo-js/panels-client'

export interface ReactTableColumnManifest {
  readonly alignment: 'center' | 'end' | 'start'
  readonly copyable: boolean
  readonly formatters?: readonly Readonly<Record<string, unknown>>[]
  readonly hidden: boolean
  readonly inlineEditor: Readonly<Record<string, unknown>> | null
  readonly label: string | null
  readonly path: string
  readonly sortable: boolean
  readonly toggleable: boolean
  readonly type: string
  readonly width: number | string | null
  readonly wrap: boolean
}

export interface ReactTableColumn<TRecord extends object> {
  readonly manifest: ReactTableColumnManifest
  readonly render?: (value: unknown, record: Readonly<TRecord>) => ReactNode
}

export interface ReactCustomColumnProps<TRecord extends object> extends Readonly<Record<string, unknown>> {
  readonly column: ReactTableColumn<TRecord>
  readonly record: Readonly<TRecord>
  readonly value: unknown
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

export interface ReactTableAction {
  readonly confirmation?: string
  readonly id: string
  readonly label: string
  readonly scope: 'bulk' | 'header' | 'row'
}

export interface ReactTableActionRequest<TRecordId extends TableRecordId> {
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
  readonly actions?: readonly ReactTableAction[]
  readonly caption: string
  readonly columns: readonly ReactTableColumn<TRecord>[]
  readonly emptyMessage?: string
  readonly filters?: readonly ReactTableFilter[]
  readonly filterPresentation?: FilterCollectionPresentation
  readonly getRecordId: (record: Readonly<TRecord>) => TRecordId
  readonly getRecordVersion?: (record: Readonly<TRecord>) => string | undefined
  readonly groups?: readonly ReactTableGroup<TRecord>[]
  readonly inlineEditTransport?: ReactInlineEditTransport<TRecordId>
  readonly onQueryChange?: () => void
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly store: TableStateStore<TRecord, TRecordId>
  readonly summaries?: readonly ReactTableSummary[]
  readonly transferTransport?: ClientTransferTransport
  readonly transfers?: readonly ClientTransferManifest[]
}
