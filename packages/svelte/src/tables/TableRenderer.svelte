<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Table from '../components/Table.svelte'
  import type { JsonValue, TableRecordId } from '@holo-js/panels-client'
  import Dialog from '../components/Dialog.svelte'
  import { toSvelteSnapshot } from '../stores'
  import ActionButton from './ActionButton.svelte'
  import FilterCollectionSlot from './FilterCollectionSlot.svelte'
  import { filterCollectionStyle, pageCount, visibleColumns } from './helpers'
  import InlineCell from './InlineCell.svelte'
  import FilterControl from './FilterControl.svelte'
  import TransferAction from './TransferAction.svelte'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import Columns3 from 'lucide-svelte/icons/columns-3'
  import ListFilter from 'lucide-svelte/icons/list-filter'
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
  const recordIds = $derived($snapshotStore.records.map(table.getRecordId))
  const selectedOnPage = $derived(recordIds.length > 0 && recordIds.every(recordId => table.store.isSelected(recordId)))
  const pages = $derived(pageCount($snapshotStore.total, $snapshotStore.perPage))
  const headerActions = $derived(table.actions?.filter(action => action.scope === 'header') ?? [])
  const bulkActions = $derived(table.actions?.filter(action => action.scope === 'bulk') ?? [])
  const rowActions = $derived(table.actions?.filter(action => action.scope === 'row') ?? [])
  const selectable = $derived(bulkActions.length > 0 || (table.transfers?.some(transfer => transfer.kind === 'export') ?? false))
  const columnCount = $derived(columns.length + (selectable ? 1 : 0) + (rowActions.length > 0 ? 1 : 0))
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
  const regionAttributes = $derived({
    'aria-label': `${table.caption} data`,
    role: 'region' as const,
    tabindex: 0,
  })

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

  function toggleGroup(key: string): void {
    const next = new Set(toggledGroups)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    toggledGroups = next
  }

  function changePage(page: number): void {
    table.store.setPage(page)
    notifyQueryChange()
  }

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

<section aria-labelledby={captionId} class="hp-table-view" data-panels-component="table">
  <h2 id={captionId}>{table.caption}</h2>
  <div class="hp-table-toolbar">
    <label>Search<Input type="search" value={$snapshotStore.search} oninput={search} /></label>
    <div class="hp-column-manager">
      <Button type="button" aria-expanded={columnsOpen} aria-haspopup="menu" onclick={() => { columnsOpen = !columnsOpen }}><Columns3 aria-hidden="true" />Columns</Button>
      {#if columnsOpen}
        <div role="menu" aria-label="Visible columns">
          {#each table.columns.filter(column => column.manifest.toggleable) as column (column.manifest.path)}
            <label>
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
    <div role="alert"><strong>Unable to load table</strong><span>{$snapshotStore.error.message}</span></div>
  {/if}
  {#if $snapshotStore.loading}<div aria-live="polite" role="status">Loading records…</div>{/if}
  {#if !$snapshotStore.loading && !$snapshotStore.error && $snapshotStore.records.length === 0}
    <div class="hp-table-empty">{table.emptyMessage ?? 'No records found.'}</div>
  {/if}

  {#if $snapshotStore.records.length > 0}
    <div class="hp-table-responsive" data-slot="table-container" {...regionAttributes}>
      <Table>
        <caption class="hp-visually-hidden">{table.caption}</caption>
        <thead>
          <tr>
            {#if selectable}<th scope="col"><Input aria-label="Select page" type="checkbox" checked={selectedOnPage} onchange={(event) => table.store.selectPage(recordIds, (event.currentTarget as HTMLInputElement).checked)} /></th>{/if}
            {#each columns as column (column.manifest.path)}
              <th scope="col" aria-sort={ariaSort(column)}>
                {#if column.manifest.sortable}<Button type="button" onclick={() => sort(column)}>{column.manifest.label ?? column.manifest.path}</Button>{:else}{column.manifest.label ?? column.manifest.path}{/if}
              </th>
            {/each}
            {#if rowActions.length > 0}<th scope="col">Actions</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#if table.groups && table.groups.length > 0}
            {#each table.groups as group (group.key)}
              {@const collapsed = group.collapsed !== toggledGroups.has(group.key)}
              <tr class="hp-table-group">
                <th colspan={columnCount} scope="rowgroup">
                  {#if group.collapsible}<Button type="button" aria-expanded={!collapsed} onclick={() => toggleGroup(group.key)}><ChevronDown aria-hidden="true" /><span>{group.title}</span><span class="hp-table-group-count">{group.records.length}</span></Button>{:else}{group.title}{/if}
                  {#if group.description}<small>{group.description}</small>{/if}
                </th>
              </tr>
              {#if !collapsed}
                {#each group.records as record (table.getRecordId(record))}
                  {@const recordId = table.getRecordId(record)}
                  <tr>
                    {#if selectable}<td data-label="Select"><Input type="checkbox" aria-label="Select record {String(recordId)}" checked={table.store.isSelected(recordId)} onchange={(event) => table.store.selectRecord(recordId, (event.currentTarget as HTMLInputElement).checked)} /></td>{/if}
                    {#each columns as column (column.manifest.path)}<td data-label={column.manifest.label ?? column.manifest.path} style:text-align={column.manifest.alignment}><InlineCell {column} {record} {table} /></td>{/each}
                    {#if rowActions.length > 0}<td class="hp-table-row-actions" data-label="Actions">{#each rowActions as action (action.id)}<ActionButton {action} {record} {table} />{/each}</td>{/if}
                  </tr>
                {/each}
              {/if}
              {#each group.summaries ?? [] as summary (summary.id)}<tr class="hp-table-group-summary"><th colspan={columnCount} scope="row">{group.title} subtotal · {summary.label}: {summary.value}</th></tr>{/each}
            {/each}
          {:else}
            {#each $snapshotStore.records as record (table.getRecordId(record))}
              {@const recordId = table.getRecordId(record)}
              <tr>
                {#if selectable}<td data-label="Select"><Input type="checkbox" aria-label="Select record {String(recordId)}" checked={table.store.isSelected(recordId)} onchange={(event) => table.store.selectRecord(recordId, (event.currentTarget as HTMLInputElement).checked)} /></td>{/if}
                {#each columns as column (column.manifest.path)}<td data-label={column.manifest.label ?? column.manifest.path} style:text-align={column.manifest.alignment}><InlineCell {column} {record} {table} /></td>{/each}
                {#if rowActions.length > 0}<td class="hp-table-row-actions" data-label="Actions">{#each rowActions as action (action.id)}<ActionButton {action} {record} {table} />{/each}</td>{/if}
              </tr>
            {/each}
          {/if}
        </tbody>
        {#if (table.summaries?.length ?? 0) > 0}
          <tfoot>{#each table.summaries ?? [] as summary (summary.id)}<tr class="hp-table-total-summary"><th colspan={Math.max(1, columnCount)} scope="row">Total · {summary.label}: {summary.value}</th></tr>{/each}</tfoot>
        {/if}
      </Table>
    </div>
  {/if}

  <nav aria-label="Table pagination" class="hp-table-pagination">
    <Button type="button" aria-label="Previous page" disabled={$snapshotStore.page <= 1} onclick={() => changePage($snapshotStore.page - 1)}><ChevronLeft aria-hidden="true" />Previous</Button>
    <span>Page <strong>{$snapshotStore.page}</strong> of {pages}</span>
    <Button type="button" aria-label="Next page" disabled={$snapshotStore.page >= pages} onclick={() => changePage($snapshotStore.page + 1)}>Next<ChevronRight aria-hidden="true" /></Button>
  </nav>
</section>
