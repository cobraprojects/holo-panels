<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
  import { NativeSelect } from '../ui/native-select'
  import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
  import { Skeleton } from '../ui/skeleton'
  import type { JsonValue, TableRecordId } from '@holo-js/panels-client'
  import { TablesRenderHook } from '@holo-js/panels-core'
  import * as Dialog from '../ui/dialog'
  import * as DropdownMenu from '../ui/dropdown-menu'
  import * as Popover from '../ui/popover'
  import RenderHook from '../components/RenderHook.svelte'
  import { toSvelteSnapshot } from '../stores'
  import ActionButton from './ActionButton.svelte'
  import ActionGroupButton from './ActionGroupButton.svelte'
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
    SvelteTableActionGroup,
    SvelteTableActionItem,
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

  function isActionGroup(action: SvelteTableActionItem): action is SvelteTableActionGroup {
    return 'kind' in action && action.kind === 'action-group'
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
  <RenderHook hook={TablesRenderHook.HEADER_BEFORE} />
  <h2 id={captionId}>{table.caption}</h2>
  <RenderHook hook={TablesRenderHook.HEADER_AFTER} />
  <RenderHook hook={TablesRenderHook.TOOLBAR_BEFORE} />
  <div class="hp-table-toolbar">
    <RenderHook hook={TablesRenderHook.TOOLBAR_START} />
    <RenderHook hook={TablesRenderHook.TOOLBAR_SEARCH_BEFORE} />
    <label class="hp:min-w-48 hp:flex-1"><span class="hp-visually-hidden">Search</span><InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput placeholder="Search records…" type="search" value={$snapshotStore.search} oninput={search} /></InputGroup></label>
    <RenderHook hook={TablesRenderHook.TOOLBAR_SEARCH_AFTER} />
    <RenderHook hook={TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE} />
    <div>
      <DropdownMenu.Root bind:open={columnsOpen}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}<Button {...props} class="hp-column-manager" variant="outline"><Columns3 aria-hidden="true" />Columns</Button>{/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" data-holo-panel>
          {#each table.columns.filter(column => column.manifest.toggleable) as column (column.manifest.path)}
            <DropdownMenu.CheckboxItem checked={currentColumns.has(column.manifest.path)} onCheckedChange={(checked) => toggleColumn(column.manifest.path, checked)}>{column.manifest.label ?? column.manifest.path}</DropdownMenu.CheckboxItem>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
    <RenderHook hook={TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_AFTER} />
    {#if (table.filters?.length ?? 0) > 0}
      {#if filterPlacement === 'inline'}
        {@render filterForm()}
      {:else}
        {#if filterPlacement === 'dropdown'}
          <Popover.Root bind:open={filtersOpen}>
            <Popover.Trigger>{#snippet child({ props })}<Button {...props} variant="outline"><ListFilter aria-hidden="true" />Filters</Button>{/snippet}</Popover.Trigger>
            <Popover.Content align="end" class="hp:w-80" data-holo-panel>{@render filterForm()}</Popover.Content>
          </Popover.Root>
        {:else if filterPlacement === 'modal'}
          <Button type="button" variant="outline" onclick={() => { filtersOpen = true }}><ListFilter aria-hidden="true" />Filters</Button>
          <Dialog.Root bind:open={filtersOpen}>
            <Dialog.Content data-holo-panel><Dialog.Header><Dialog.Title id={`${captionId}-filters-title`}>Filters</Dialog.Title><Dialog.Description>Filter the records in this table.</Dialog.Description></Dialog.Header>{@render filterForm()}</Dialog.Content>
          </Dialog.Root>
        {/if}
      {/if}
    {/if}
    {#each headerActions as action (action.id)}
      {#if isActionGroup(action)}<ActionGroupButton group={action} {table} />{:else}<ActionButton {action} {table} />{/if}
    {/each}
    {#each table.transfers ?? [] as manifest (manifest.id)}
      <TransferAction {manifest} {table} />
    {/each}
    <RenderHook hook={TablesRenderHook.TOOLBAR_END} />
  </div>
  <RenderHook hook={TablesRenderHook.TOOLBAR_AFTER} />

  {#if hasSelection}
    <div aria-live="polite" class="hp-table-bulk-actions">
      <span>{$snapshotStore.selection.mode === 'all-matching' ? `All ${$snapshotStore.total} matching records selected` : `${$snapshotStore.selection.selectedRecordIds.length} records selected`}</span>
      <RenderHook hook={TablesRenderHook.SELECTION_INDICATOR_ACTIONS_BEFORE} />
      {#each bulkActions as action (action.id)}{#if isActionGroup(action)}<ActionGroupButton group={action} {table} />{:else}<ActionButton {action} {table} />{/if}{/each}
      <RenderHook hook={TablesRenderHook.SELECTION_INDICATOR_ACTIONS_AFTER} />
      <Button type="button" onclick={() => table.store.clearSelection()}>Clear selection</Button>
    </div>
  {/if}
  {#if $snapshotStore.selection.mode === 'explicit' && selectedOnPage && $snapshotStore.total > recordIds.length}
    <Button type="button" onclick={() => table.store.selectAllMatching()}>Select all {$snapshotStore.total} matching records</Button>
  {/if}

  {#if $snapshotStore.error}
    <Alert class="hp-table-error" data-slot="table-error" variant="destructive"><AlertTitle>Unable to load table</AlertTitle><AlertDescription>{$snapshotStore.error.message}</AlertDescription></Alert>
  {/if}
  {#if $snapshotStore.loading}<div aria-label="Loading records" aria-live="polite" class="hp-table-loading hp:space-y-2" data-slot="table-loading" role="status"><Skeleton class="hp:h-10 hp:w-full" /><Skeleton class="hp:h-10 hp:w-full" /><Skeleton class="hp:h-10 hp:w-full" /></div>{/if}
  {#if !$snapshotStore.loading && !$snapshotStore.error && $snapshotStore.records.length === 0}
    <Empty class="hp-table-empty" data-slot="table-empty"><EmptyHeader><EmptyTitle>No records</EmptyTitle><EmptyDescription>{table.emptyMessage ?? 'No records found.'}</EmptyDescription></EmptyHeader></Empty>
  {/if}

  {#if $snapshotStore.records.length > 0}
    {#snippet tableHeader(presentationColumn: TablePresentationColumn)}
      {@const column = columns.find(candidate => candidate.manifest.path === presentationColumn.key)}
      {@const direction = $snapshotStore.sort.find(item => item.column === presentationColumn.key)?.direction}
      {#if column?.manifest.sortable}
        <Button class="hp-table-sort hp:-ml-3 hp:h-8 hp:px-3 hp:text-muted-foreground hp:data-[sorted]:text-foreground" data-sorted={direction} size="sm" type="button" variant="ghost" onclick={() => sort(column)}>
          {presentationColumn.label}
          {#if direction === 'asc'}<ChevronUp aria-hidden="true" data-icon="chevron-up" data-slot="icon" />{:else if direction === 'desc'}<ChevronDown aria-hidden="true" data-icon="chevron-down" data-slot="icon" />{:else}<ArrowUpDown aria-hidden="true" data-icon="sort" data-slot="icon" />{/if}
        </Button>
      {:else}
        {presentationColumn.label}
      {/if}
    {/snippet}
    {#snippet leadingHeader()}
      <Checkbox aria-label="Select page" checked={selectedOnPage} onCheckedChange={(checked) => table.store.selectPage(recordIds, checked)} />
    {/snippet}
    {#snippet leadingCell(record: Readonly<TRecord>)}
      {@const recordId = table.getRecordId(record)}
      <Checkbox aria-label="Select record {String(recordId)}" checked={table.store.isSelected(recordId)} onCheckedChange={(checked) => table.store.selectRecord(recordId, checked)} />
    {/snippet}
    {#snippet tableCell(record: Readonly<TRecord>, presentationColumn: { readonly key: string })}
      {@const column = columns.find(candidate => candidate.manifest.path === presentationColumn.key)}
      {#if column}<InlineCell {column} {record} {table} />{/if}
    {/snippet}
    {#snippet trailingCell(record: Readonly<TRecord>)}
      {#each rowActions as action (action.id)}{#if isActionGroup(action)}<ActionGroupButton group={action} {record} {table} />{:else}<ActionButton {action} {record} {table} />{/if}{/each}
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
        <NativeSelect aria-label="Results per page" disabled={$snapshotStore.loading} onchange={changePerPage} value={String($snapshotStore.perPage)}>
          {#each perPageOptions($snapshotStore.perPage) as value (value)}
            <option value={String(value)}>{value}</option>
          {/each}
        </NativeSelect>
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
