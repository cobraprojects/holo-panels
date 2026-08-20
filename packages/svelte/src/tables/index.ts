import type { TableRecordId } from '@holo-js/panels-client'
import type { Component } from 'svelte'
import RawTableRenderer from './TableRenderer.svelte'
import type { SvelteTableRendererProps } from './types'

export interface SvelteTableRendererComponentProps {
  readonly table: SvelteTableRendererProps<Record<string, unknown>, TableRecordId>
}

export const SvelteTableRenderer: Component<SvelteTableRendererComponentProps> = RawTableRenderer
export { displayValue as displaySvelteTableValue, pageCount as svelteTablePageCount, paginationPages as svelteTablePaginationPages, paginationRange, recordValue as svelteTableRecordValue, visibleColumns as visibleSvelteTableColumns } from './helpers'
export type {
  SvelteCustomColumnProps,
  SvelteCustomFilterProps,
  SvelteFilterCollectionSlotProps,
  SvelteInlineEditRequest,
  SvelteInlineEditTransport,
  SvelteTableAction,
  SvelteTableActionRequest,
  SvelteTableActionTransport,
  SvelteTableColumn,
  SvelteTableColumnManifest,
  SvelteTableFilter,
  SvelteTableFilterOption,
  SvelteTableGroup,
  SvelteTableRendererProps,
  SvelteTableStore,
  SvelteTableSummary,
} from './types'
