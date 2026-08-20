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
  import Button from '../components/Button.svelte'
  import Table from '../components/Table.svelte'

  let {
    caption,
    cell,
    columns,
    containerClass,
    getRecordId,
    groups,
    header,
    leading,
    records,
    summaries,
    trailing,
  }: {
    readonly caption: string
    readonly cell: Snippet<[Readonly<TRecord>, TablePresentationColumn]>
    readonly columns: readonly TablePresentationColumn[]
    readonly containerClass?: string
    readonly getRecordId: (record: Readonly<TRecord>) => number | string
    readonly groups?: readonly TablePresentationGroup<TRecord>[]
    readonly header?: Snippet<[TablePresentationColumn]>
    readonly leading?: TablePresentationPlacement<TRecord>
    readonly records: readonly TRecord[]
    readonly summaries?: readonly TablePresentationSummary[]
    readonly trailing?: TablePresentationPlacement<TRecord>
  } = $props()

  const columnCount = $derived(columns.length + (leading ? 1 : 0) + (trailing ? 1 : 0))
  const responsiveClass = $derived(['hp-table-responsive', containerClass].filter(Boolean).join(' '))

  function columnWidth(width: TablePresentationColumn['width']): string | undefined {
    if (width === null || typeof width === 'undefined') return undefined
    return typeof width === 'number' ? `${width}px` : width
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  aria-label={`${caption} data`}
  class={responsiveClass}
  data-panels-component="data-table"
  data-slot="table-container"
  role="region"
  tabindex="0"
>
  <Table>
    <caption class="hp-visually-hidden">{caption}</caption>
    <thead>
      <tr>
        {#if leading}
          <th scope="col">{#if leading.header}{@render leading.header()}{:else}{leading.label}{/if}</th>
        {/if}
        {#each columns as column (column.key)}
          <th aria-sort={column.ariaSort} scope="col" style:text-align={column.alignment}>
            {#if header}{@render header(column)}{:else}{column.label}{/if}
          </th>
        {/each}
        {#if trailing}
          <th scope="col">{#if trailing.header}{@render trailing.header()}{:else}{trailing.label}{/if}</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#if groups && groups.length > 0}
        {#each groups as group (group.key)}
          <tr class="hp-table-group">
            <th colspan={columnCount} scope="rowgroup">
              {#if group.collapsible}
                <Button type="button" aria-expanded={!group.collapsed} onclick={group.onToggle}><ChevronDown aria-hidden="true" /><span>{group.title}</span><span class="hp-table-group-count">{group.records.length}</span></Button>
              {:else}
                {group.title}
              {/if}
              {#if group.description}<small>{group.description}</small>{/if}
            </th>
          </tr>
          {#if !group.collapsed}
            {#each group.records as record (getRecordId(record))}
              <tr>
                {#if leading}<td data-label={leading.label}>{@render leading.cell(record)}</td>{/if}
                {#each columns as column (column.key)}<td data-label={column.label} style:text-align={column.alignment} style:width={columnWidth(column.width)} style:white-space={column.wrap === false ? 'nowrap' : undefined}>{@render cell(record, column)}</td>{/each}
                {#if trailing}<td class="hp-table-row-actions" data-label={trailing.label}>{@render trailing.cell(record)}</td>{/if}
              </tr>
            {/each}
          {/if}
          {#each group.summaries ?? [] as summary (summary.id)}
            <tr class="hp-table-group-summary"><th colspan={columnCount} scope="row">{group.title} subtotal · {summary.label}: {summary.value}</th></tr>
          {/each}
        {/each}
      {:else}
        {#each records as record (getRecordId(record))}
          <tr>
            {#if leading}<td data-label={leading.label}>{@render leading.cell(record)}</td>{/if}
            {#each columns as column (column.key)}<td data-label={column.label} style:text-align={column.alignment} style:width={columnWidth(column.width)} style:white-space={column.wrap === false ? 'nowrap' : undefined}>{@render cell(record, column)}</td>{/each}
            {#if trailing}<td class="hp-table-row-actions" data-label={trailing.label}>{@render trailing.cell(record)}</td>{/if}
          </tr>
        {/each}
      {/if}
    </tbody>
    {#if (summaries?.length ?? 0) > 0}
      <tfoot>{#each summaries ?? [] as summary (summary.id)}<tr class="hp-table-total-summary"><th colspan={Math.max(1, columnCount)} scope="row">Total · {summary.label}: {summary.value}</th></tr>{/each}</tfoot>
    {/if}
  </Table>
</div>
