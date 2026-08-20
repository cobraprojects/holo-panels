<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import type { JsonValue, TableRecordId } from '@holo-js/panels-client'
  import Dialog from '../components/Dialog.svelte'
  import { toSvelteSnapshot } from '../stores'
  import ActionButton from './ActionButton.svelte'
  import FilterCollectionSlot from './FilterCollectionSlot.svelte'
  import { filterCollectionStyle, pageCount, paginationRange, perPageOptions, visibleColumns } from './helpers'
  import InlineCell from './InlineCell.svelte'
  import TablePresentation, { type TablePresentationColumn } from './TablePresentation.svelte'
  import FilterControl from './FilterControl.svelte'
  import TransferAction from './TransferAction.svelte'
  import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import Columns3 from 'lucide-svelte/icons/columns-3'
  import ListFilter from 'lucide-svelte/icons/list-filter'
  import Search from 'lucide-svelte/icons/search'
  import type {
    SvelteTableColumn,
    SvelteTableFilter,
    SvelteTableRendererProps,
  } from './types'

  let { table }: { readonly table: SvelteTableRendererProps<TRecord, TRecordId> } = $props()
  const snapshotStore = $derived.by(() => toSvelteSnapshot(table.store))
  const captionId = $props.id()
  let columnsOpen = $state(false)
  let filtersOpen = $state(false)
  let toggledGroups = $state<ReadonlySet<string>>(new Set())
  const columns = $derived(visibleColumns(table, $snapshotStore.visibleColumns))
  const presentationColumns = $derived(columns.map(column => ({
    alignment: column.manifest.alignment,
    ariaSort: ariaSort(column),
    key: column.manifest.path,
    label: column.manifest.label ?? column.manifest.path,
    width: column.manifest.width,
    wrap: column.manifest.wrap,
  })))
  const presentationGroups = $derived(table.groups?.map(group => ({
    ...group,
    collapsed: group.collapsed !== toggledGroups.has(group.key),
    onToggle: () => toggleGroup(group.key),
  })))
  const recordIds = $derived($snapshotStore.records.map(table.getRecordId))
  const selectedOnPage = $derived(recordIds.length > 0 && recordIds.every(recordId => table.store.isSelected(recordId)))
  const pages = $derived(pageCount($snapshotStore.total, $snapshotStore.perPage))
  const headerActions = $derived(table.actions?.filter(action => action.scope === 'header') ?? [])
  const bulkActions = $derived(table.actions?.filter(action => action.scope === 'bulk') ?? [])
  const rowActions = $derived(table.actions?.filter(action => action.scope === 'row') ?? [])
  const selectable = $derived(bulkActions.length > 0 || (table.transfers?.some(transfer => transfer.kind === 'export') ?? false))
  const filterPresentation = $derived(table.filterPresentation)
  const filterPlacement = $derived(filterPresentation?.placement ?? 'inline')
  const orderedFilters = $derived.by(() => {
    const filters = table.filters ?? []
    if (!filterPresentation) return filters
    const byId = new Map(filters.map(filter => [filter.manifest.id, filter]))
    const ordered = filterPresentation.schema.components.flatMap(component => {
      const filter = component.statePath ? byId.get(component.statePath) : undefined
      return filter ? [filter] : []
    })
    return ordered.length > 0 ? ordered : filters
  })
  const hasSelection = $derived(selectable && ($snapshotStore.selection.mode === 'all-matching' || $snapshotStore.selection.selectedRecordIds.length > 0))
  const currentColumns = $derived($snapshotStore.visibleColumns.length > 0
    ? new Set($snapshotStore.visibleColumns)
    : new Set(table.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path)))

  function notifyQueryChange(): void {
    table.onQueryChange?.()
  }

  function search(event: Event): void {
    table.store.setSearch((event.currentTarget as HTMLInputElement).value)
    notifyQueryChange()
  }

  function sort(column: SvelteTableColumn<TRecord>): void {
    if (!column.manifest.sortable) return
    const active = $snapshotStore.sort.find(item => item.column === column.manifest.path)
    table.store.setSort([{ column: column.manifest.path, direction: active?.direction === 'asc' ? 'desc' : 'asc' }])
    notifyQueryChange()
  }

  function toggleGroup(key: string): void {
    const next = new Set(toggledGroups)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    toggledGroups = next
  }

  function updateFilter(filter: SvelteTableFilter, value: JsonValue): void {
    const setFilter: unknown = Reflect.get(table.store, 'setFilter')
    if (typeof setFilter !== 'function') throw new Error('[Holo Panels] Svelte table filters require a compatible table store.')
    Reflect.apply(setFilter, table.store, [filter.manifest.id, value])
    if ($snapshotStore.filters.mode === 'live') notifyQueryChange()
  }

  function applyFilters(event: SubmitEvent): void {
    event.preventDefault()
    table.store.applyDeferredFilters()
    filtersOpen = false
    notifyQueryChange()
  }

  function resetFilters(): void {
    table.store.resetFilters()
    notifyQueryChange()
  }

  function toggleColumn(path: string, visible: boolean): void {
    const next = new Set(currentColumns)
    if (visible) next.add(path)
    else next.delete(path)
    table.store.setVisibleColumns([...next])
    notifyQueryChange()
  }

  function changePage(page: number): void {
    table.store.setPage(page)
    notifyQueryChange()
  }

  function changePerPage(event: Event): void {
    const value = Number((event.currentTarget as HTMLSelectElement).value)
    table.store.setPerPage?.(value)
    notifyQueryChange()
  }

  const pageNumbers = $derived(paginationRange($snapshotStore.page, pages))
  const paginationFrom = $derived($snapshotStore.total === 0 ? 0 : ($snapshotStore.page - 1) * $snapshotStore.perPage + 1)
  const paginationTo = $derived(Math.min($snapshotStore.page * $snapshotStore.perPage, $snapshotStore.total))

  function ariaSort(column: SvelteTableColumn<TRecord>): 'ascending' | 'descending' | 'none' {
    const direction = $snapshotStore.sort.find(item => item.column === column.manifest.path)?.direction
    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'
  }
</script>

{#snippet filterForm()}
  <form
    aria-label="Table filters"
    class="hp-table-filters"
    data-filter-placement={filterPlacement}
    onsubmit={applyFilters}
    style={filterCollectionStyle(filterPresentation?.columns ?? { default: 1 })}
  >
    {#if filterPresentation}<FilterCollectionSlot panelId={table.panelId} placement="before" presentation={filterPresentation} registry={table.registry} />{/if}
    {#each orderedFilters as filter (filter.manifest.id)}
      {@const filterValue = $snapshotStore.filters.draft[filter.manifest.id] ?? filter.manifest.defaultValue}
      <FilterControl {filter} panelId={table.panelId} registry={table.registry} value={filterValue} update={(value) => updateFilter(filter, value)} />
    {/each}
    {#if $snapshotStore.filters.mode === 'deferred'}<Button type="submit">Apply filters</Button>{/if}
    <Button type="button" onclick={resetFilters}>Reset filters</Button>
    {#if filterPresentation}<FilterCollectionSlot panelId={table.panelId} placement="after" presentation={filterPresentation} registry={table.registry} />{/if}
  </form>
{/snippet}

<section
  aria-busy={$snapshotStore.loading}
  aria-labelledby={captionId}
  class="hp-table-view"
  data-panels-component="table"
  data-state={$snapshotStore.error ? 'error' : $snapshotStore.loading ? 'loading' : $snapshotStore.records.length === 0 ? 'empty' : 'ready'}
>
  <h2 id={captionId}>{table.caption}</h2>
  <div class="hp-table-toolbar">
    <label><Search aria-hidden="true" /><span class="hp-visually-hidden">Search</span><Input placeholder="Search records…" type="search" value={$snapshotStore.search} oninput={search} /></label>
    <div class="hp-column-manager">
      <Button type="button" aria-expanded={columnsOpen} aria-haspopup="menu" onclick={() => { columnsOpen = !columnsOpen }}><Columns3 aria-hidden="true" />Columns</Button>
      {#if columnsOpen}
        <div role="menu" aria-label="Visible columns">
          {#each table.columns.filter(column => column.manifest.toggleable) as column (column.manifest.path)}
            <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
            <label aria-checked={currentColumns.has(column.manifest.path)} role="menuitemcheckbox">
              <Input type="checkbox" checked={currentColumns.has(column.manifest.path)} onchange={(event) => toggleColumn(column.manifest.path, (event.currentTarget as HTMLInputElement).checked)} />
              {column.manifest.label ?? column.manifest.path}
            </label>
          {/each}
        </div>
      {/if}
    </div>
    {#if (table.filters?.length ?? 0) > 0}
      {#if filterPlacement === 'inline'}
        {@render filterForm()}
      {:else}
        <div class="hp-table-filters-dropdown">
          <Button type="button" aria-expanded={filtersOpen} aria-haspopup="dialog" onclick={() => { filtersOpen = !filtersOpen }}><ListFilter aria-hidden="true" />Filters</Button>
          {#if filterPlacement === 'dropdown' && filtersOpen}
            <div aria-label="Filter options" role="dialog">{@render filterForm()}</div>
          {:else if filterPlacement === 'modal'}
            <Dialog labelledBy={`${captionId}-filters-title`} onclose={() => { filtersOpen = false }} open={filtersOpen}>
              <h3 id={`${captionId}-filters-title`}>Filters</h3>
              {@render filterForm()}
            </Dialog>
          {/if}
        </div>
      {/if}
    {/if}
    {#each headerActions as action (action.id)}
      <ActionButton {action} {table} />
    {/each}
    {#each table.transfers ?? [] as manifest (manifest.id)}
      <TransferAction {manifest} {table} />
    {/each}
  </div>

  {#if hasSelection}
    <div aria-live="polite" class="hp-table-bulk-actions">
      <span>{$snapshotStore.selection.mode === 'all-matching' ? `All ${$snapshotStore.total} matching records selected` : `${$snapshotStore.selection.selectedRecordIds.length} records selected`}</span>
      {#each bulkActions as action (action.id)}<ActionButton {action} {table} />{/each}
      <Button type="button" onclick={() => table.store.clearSelection()}>Clear selection</Button>
    </div>
  {/if}
  {#if $snapshotStore.selection.mode === 'explicit' && selectedOnPage && $snapshotStore.total > recordIds.length}
    <Button type="button" onclick={() => table.store.selectAllMatching()}>Select all {$snapshotStore.total} matching records</Button>
  {/if}

  {#if $snapshotStore.error}
    <div class="hp-table-error" data-slot="table-error" role="alert"><strong>Unable to load table</strong><span>{$snapshotStore.error.message}</span></div>
  {/if}
  {#if $snapshotStore.loading}<div aria-live="polite" class="hp-table-loading" data-slot="table-loading" role="status">Loading records…</div>{/if}
  {#if !$snapshotStore.loading && !$snapshotStore.error && $snapshotStore.records.length === 0}
    <div class="hp-table-empty" data-slot="table-empty">{table.emptyMessage ?? 'No records found.'}</div>
  {/if}

  {#if $snapshotStore.records.length > 0}
    {#snippet tableHeader(presentationColumn: TablePresentationColumn)}
      {@const column = columns.find(candidate => candidate.manifest.path === presentationColumn.key)}
      {@const direction = $snapshotStore.sort.find(item => item.column === presentationColumn.key)?.direction}
      {#if column?.manifest.sortable}
        <Button class="hp-table-sort" data-sorted={direction} type="button" onclick={() => sort(column)}>
          {presentationColumn.label}
          {#if direction === 'asc'}<ChevronUp aria-hidden="true" data-icon="chevron-up" data-slot="icon" />{:else if direction === 'desc'}<ChevronDown aria-hidden="true" data-icon="chevron-down" data-slot="icon" />{:else}<ArrowUpDown aria-hidden="true" data-icon="sort" data-slot="icon" />{/if}
        </Button>
      {:else}
        {presentationColumn.label}
      {/if}
    {/snippet}
    {#snippet leadingHeader()}
      <Input aria-label="Select page" type="checkbox" checked={selectedOnPage} onchange={(event) => table.store.selectPage(recordIds, (event.currentTarget as HTMLInputElement).checked)} />
    {/snippet}
    {#snippet leadingCell(record: Readonly<TRecord>)}
      {@const recordId = table.getRecordId(record)}
      <Input type="checkbox" aria-label="Select record {String(recordId)}" checked={table.store.isSelected(recordId)} onchange={(event) => table.store.selectRecord(recordId, (event.currentTarget as HTMLInputElement).checked)} />
    {/snippet}
    {#snippet tableCell(record: Readonly<TRecord>, presentationColumn: { readonly key: string })}
      {@const column = columns.find(candidate => candidate.manifest.path === presentationColumn.key)}
      {#if column}<InlineCell {column} {record} {table} />{/if}
    {/snippet}
    {#snippet trailingCell(record: Readonly<TRecord>)}
      {#each rowActions as action (action.id)}<ActionButton {action} {record} {table} />{/each}
    {/snippet}
    <TablePresentation
      caption={table.caption}
      cell={tableCell}
      columns={presentationColumns}
      getRecordId={table.getRecordId}
      groups={presentationGroups}
      header={tableHeader}
      leading={selectable ? { cell: leadingCell, header: leadingHeader, label: 'Select' } : undefined}
      records={$snapshotStore.records}
      summaries={table.summaries}
      trailing={rowActions.length > 0 ? { cell: trailingCell, label: 'Actions' } : undefined}
    />
  {/if}

  <nav aria-label="Table pagination" class="hp-table-pagination" data-slot="table-pagination">
    <span aria-live="polite" class="hp-table-pagination-info">Showing <strong>{paginationFrom}</strong> to <strong>{paginationTo}</strong> of <strong>{$snapshotStore.total}</strong> results</span>
    {#if typeof table.store.setPerPage === 'function'}
      <label class="hp-table-pagination-per-page">
        <select aria-label="Results per page" data-slot="select" disabled={$snapshotStore.loading} onchange={changePerPage} value={String($snapshotStore.perPage)}>
          {#each perPageOptions($snapshotStore.perPage) as value (value)}
            <option value={String(value)}>{value}</option>
          {/each}
        </select>
        <span>per page</span>
      </label>
    {/if}
    <div class="hp-table-pagination-pages">
      <Button type="button" aria-label="Previous page" disabled={$snapshotStore.page <= 1 || $snapshotStore.loading} onclick={() => changePage($snapshotStore.page - 1)}><ChevronLeft aria-hidden="true" /></Button>
      {#each pageNumbers as entry, i (typeof entry === 'number' ? entry : `ellipsis-${i}`)}
        {#if entry === 'ellipsis'}
          <span aria-hidden="true" class="hp-table-pagination-ellipsis">…</span>
        {:else}
          <Button type="button" aria-label="Page {entry}" aria-current={entry === $snapshotStore.page ? 'page' : undefined} data-active={entry === $snapshotStore.page ? 'true' : undefined} disabled={$snapshotStore.loading} onclick={() => changePage(entry)}>{entry}</Button>
        {/if}
      {/each}
      <Button type="button" aria-label="Next page" disabled={$snapshotStore.page >= pages || $snapshotStore.loading} onclick={() => changePage($snapshotStore.page + 1)}><ChevronRight aria-hidden="true" /></Button>
    </div>
  </nav>
</section>
