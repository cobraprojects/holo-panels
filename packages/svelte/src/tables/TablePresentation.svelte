<script lang="ts" module>
  import type { Snippet } from 'svelte'

  export interface TablePresentationColumn {
    readonly alignment?: 'center' | 'end' | 'start'
    readonly ariaSort?: 'ascending' | 'descending' | 'none'
    readonly key: string
    readonly label: string
    readonly width?: number | string | null
    readonly wrap?: boolean
  }

  export interface TablePresentationSummary {
    readonly id: string
    readonly label: string
    readonly value: boolean | number | string | null
  }

  export interface TablePresentationGroup<TItem extends object> {
    readonly selection?: { readonly checked: boolean, readonly disabled: boolean, readonly onChange: (checked: boolean) => void }
    readonly collapsed: boolean
    readonly collapsible?: boolean
    readonly description?: string | null
    readonly key: string
    readonly onToggle?: () => void
    readonly records: readonly TItem[]
    readonly summaries?: readonly TablePresentationSummary[]
    readonly title: string
  }

  export interface TablePresentationPlacement<TItem extends object> {
    readonly cell: Snippet<[Readonly<TItem>]>
    readonly header?: Snippet
    readonly label: string
  }
</script>

<script lang="ts" generics="TRecord extends object">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
  import { Skeleton } from '../ui/skeleton'
  import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from '../ui/table'

  let {
    caption,
    cell,
    columns,
    containerClass,
    emptyMessage = 'No records found.',
    error,
    getRecordId,
    groups,
    header,
    leading,
    loading = false,
    records,
    summaries,
    trailing,
  }: {
    readonly caption: string
    readonly cell: Snippet<[Readonly<TRecord>, TablePresentationColumn]>
    readonly columns: readonly TablePresentationColumn[]
    readonly containerClass?: string
    readonly emptyMessage?: string
    readonly error?: string | null
    readonly getRecordId: (record: Readonly<TRecord>) => number | string
    readonly groups?: readonly TablePresentationGroup<TRecord>[]
    readonly header?: Snippet<[TablePresentationColumn]>
    readonly leading?: TablePresentationPlacement<TRecord>
    readonly loading?: boolean
    readonly records: readonly TRecord[]
    readonly summaries?: readonly TablePresentationSummary[]
    readonly trailing?: TablePresentationPlacement<TRecord>
  } = $props()

  const columnCount = $derived(columns.length + (leading ? 1 : 0) + (trailing ? 1 : 0))
  const responsiveClass = $derived(['hp-table-responsive hp:w-full hp:max-w-full hp:rounded-lg hp:border hp:bg-card', containerClass].filter(Boolean).join(' '))

  function columnWidth(width: TablePresentationColumn['width']): string | undefined {
    if (width === null || typeof width === 'undefined') return undefined
    return typeof width === 'number' ? `${width}px` : width
  }
</script>

<div
  class={responsiveClass}
  data-panels-component="data-table"
  data-slot="table-container"
>
  <Table containerProps={{ 'aria-label': `${caption} data`, role: 'region', tabindex: 0 }}>
    <TableCaption class="hp:sr-only">{caption}</TableCaption>
    <TableHeader>
      <TableRow>
        {#if leading}<TableHead scope="col">{#if leading.header}{@render leading.header()}{:else}{leading.label}{/if}</TableHead>{/if}
        {#each columns as column (column.key)}
          <TableHead aria-sort={column.ariaSort} scope="col" style={column.alignment ? `text-align: ${column.alignment}` : undefined}>{#if header}{@render header(column)}{:else}{column.label}{/if}</TableHead>
        {/each}
        {#if trailing}<TableHead scope="col">{#if trailing.header}{@render trailing.header()}{:else}{trailing.label}{/if}</TableHead>{/if}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#if error}
        <TableRow><TableCell colspan={Math.max(1, columnCount)}><Alert class="hp-table-error" data-slot="table-error" variant="destructive"><AlertTitle>Unable to load table</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></TableCell></TableRow>
      {:else if loading}
        <TableRow><TableCell colspan={Math.max(1, columnCount)}><div aria-label="Loading records" aria-live="polite" class="hp-table-loading hp:space-y-2 hp:py-2" data-slot="table-loading" role="status"><Skeleton class="hp:h-8 hp:w-full" /><Skeleton class="hp:h-8 hp:w-full" /><Skeleton class="hp:h-8 hp:w-full" /></div></TableCell></TableRow>
      {:else if records.length === 0}
        <TableRow><TableCell colspan={Math.max(1, columnCount)}><Empty class="hp-table-empty hp:min-h-40" data-slot="table-empty"><EmptyHeader><EmptyTitle>No records</EmptyTitle><EmptyDescription>{emptyMessage}</EmptyDescription></EmptyHeader></Empty></TableCell></TableRow>
      {:else if groups && groups.length > 0}
        {#each groups as group (group.key)}
          <TableRow class="hp-table-group">
            <TableCell colspan={columnCount}>
              {#if group.selection}<Checkbox aria-label="Select group {group.title}" checked={group.selection.checked} disabled={group.selection.disabled} onCheckedChange={checked => group.selection?.onChange(checked === true)} />{/if}
              {#if group.collapsible}
                <Button type="button" aria-expanded={!group.collapsed} onclick={group.onToggle}><ChevronDown aria-hidden="true" /><span>{group.title}</span><span class="hp-table-group-count">{group.records.length}</span></Button>
              {:else}
                {group.title}
              {/if}
              {#if group.description}<small>{group.description}</small>{/if}
            </TableCell>
          </TableRow>
          {#if !group.collapsed}
            {#each group.records as record (getRecordId(record))}
              <TableRow>
                {#if leading}<TableCell data-label={leading.label}>{@render leading.cell(record)}</TableCell>{/if}
                {#each columns as column (column.key)}<TableCell data-label={column.label} style={[column.alignment ? `text-align: ${column.alignment}` : '', columnWidth(column.width) ? `width: ${columnWidth(column.width)}` : '', column.wrap === false ? 'white-space: nowrap' : ''].filter(Boolean).join('; ')}>{@render cell(record, column)}</TableCell>{/each}
                {#if trailing}<TableCell class="hp-table-row-actions" data-label={trailing.label}>{@render trailing.cell(record)}</TableCell>{/if}
              </TableRow>
            {/each}
          {/if}
          {#each group.summaries ?? [] as summary (summary.id)}
            <TableRow class="hp-table-group-summary"><TableCell colspan={columnCount}>{group.title} subtotal · {summary.label}: {summary.value}</TableCell></TableRow>
          {/each}
        {/each}
      {:else}
        {#each records as record (getRecordId(record))}
          <TableRow>
            {#if leading}<TableCell data-label={leading.label}>{@render leading.cell(record)}</TableCell>{/if}
            {#each columns as column (column.key)}<TableCell data-label={column.label} style={[column.alignment ? `text-align: ${column.alignment}` : '', columnWidth(column.width) ? `width: ${columnWidth(column.width)}` : '', column.wrap === false ? 'white-space: nowrap' : ''].filter(Boolean).join('; ')}>{@render cell(record, column)}</TableCell>{/each}
            {#if trailing}<TableCell class="hp-table-row-actions" data-label={trailing.label}>{@render trailing.cell(record)}</TableCell>{/if}
          </TableRow>
        {/each}
      {/if}
    </TableBody>
    {#if !error && !loading && records.length > 0 && (summaries?.length ?? 0) > 0}
      <TableFooter>{#each summaries ?? [] as summary (summary.id)}<TableRow class="hp-table-total-summary"><TableCell colspan={Math.max(1, columnCount)}>Total · {summary.label}: {summary.value}</TableCell></TableRow>{/each}</TableFooter>
    {/if}
  </Table>
</div>
