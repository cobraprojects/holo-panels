import type { JsonValue, TableRecordId, TableStateStore } from '@holo-js/panels-client'

export interface TableAcceptanceColumn {
  readonly manifest: {
    readonly alignment: 'center' | 'end' | 'start'
    readonly copyable: boolean
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
}

export interface TableAcceptanceFilter {
  readonly manifest: {
    readonly defaultValue: JsonValue
    readonly id: string
    readonly label: string | null
    readonly properties: Readonly<Record<string, unknown>>
    readonly type: string
  }
  readonly options?: readonly {
    readonly disabled?: boolean
    readonly label: string
    readonly value: boolean | number | string | null
  }[]
}

export interface TableAcceptanceActionRequest {
  readonly actionId: string
  readonly recordId?: TableRecordId
  readonly selection?: unknown
}

export interface TableAcceptanceInlineEditRequest {
  readonly action: string
  readonly columnPath: string
  readonly expectedVersion: string | null
  readonly recordId: TableRecordId
  readonly value: boolean | number | string | null
}

export interface TableAcceptanceModel {
  readonly actionTransport: { execute(request: TableAcceptanceActionRequest, signal: AbortSignal): Promise<void> }
  readonly actions: readonly { readonly id: string, readonly label: string, readonly scope: 'bulk' | 'header' | 'row' }[]
  readonly caption: string
  readonly columns: readonly TableAcceptanceColumn[]
  readonly filters: readonly TableAcceptanceFilter[]
  readonly getRecordId: (record: Readonly<Record<string, unknown>>) => number
  readonly getRecordVersion: (record: Readonly<Record<string, unknown>>) => string | undefined
  readonly groups: readonly {
    readonly collapsed: boolean
    readonly collapsible: boolean
    readonly key: string
    readonly records: readonly Record<string, unknown>[]
    readonly summaries: readonly { readonly id: string, readonly label: string, readonly value: string | number }[]
    readonly title: string
  }[]
  readonly inlineEditTransport: { execute(request: TableAcceptanceInlineEditRequest, signal: AbortSignal): Promise<void> }
  readonly onQueryChange: () => void
  readonly store: TableStateStore<Record<string, unknown>, number>
  readonly summaries: readonly { readonly id: string, readonly label: string, readonly value: string | number }[]
}

export interface TableAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface TableAcceptanceDriver {
  click(selector: string): Promise<void>
  clickText(text: string): Promise<void>
  dispose(): Promise<void>
  input(selector: string, value: string): Promise<void>
  keydown(selector: string, key: string): Promise<void>
  markup(): string
  select(selector: string, value: string): Promise<void>
  sync(operation: () => void): Promise<void>
  toggleColumn(label: string): Promise<void>
}

export interface TableAcceptanceFixture {
  readonly framework: TableAcceptanceRenderReport['framework']
  mount(model: TableAcceptanceModel): Promise<TableAcceptanceDriver>
  render(model: TableAcceptanceModel): Promise<TableAcceptanceRenderReport>
}

export interface TableAcceptanceJourneyReport {
  readonly actionRequests: readonly TableAcceptanceActionRequest[]
  readonly collapsedGroupRows: number
  readonly columnVisibility: readonly string[]
  readonly filter: unknown
  readonly framework: TableAcceptanceRenderReport['framework']
  readonly inlineEditRequests: readonly TableAcceptanceInlineEditRequest[]
  readonly markupAfterSelection: string
  readonly page: number
  readonly render: TableAcceptanceRenderReport
  readonly search: string
  readonly selectionMode: string
  readonly sort: readonly { readonly column: string, readonly direction: string }[]
}
