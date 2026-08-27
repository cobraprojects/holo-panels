<script lang="ts">
  import { relationActionManifests, type ClientRelationManager, type ClientRelationRecord, type JsonValue } from '@holo-js/panels-client'
  import { Badge } from '../ui/badge'
  import { Checkbox } from '../ui/checkbox'
  import * as Card from '../ui/card'
  import * as Empty from '../ui/empty'
  import TablePresentation from '../tables/TablePresentation.svelte'
  import RelationActions from './RelationActions.svelte'
  import type { SvelteRelationManagerRendererProps } from './contracts'

  let { manager, relations }: { readonly manager: ClientRelationManager, readonly relations: SvelteRelationManagerRendererProps } = $props()
  let selectedIds = $state<readonly (number | string)[]>([])
  const hasBulk = $derived(relationActionManifests(manager).some(action => action.mount === 'bulk'))
  const hasRows = $derived(!!relations.onOperation && manager.records.some(record => relationActionManifests(manager, record).length > 0))
  const columns = $derived([...(hasBulk ? [{ key: 'selection', label: 'Select' }] : []), ...manager.columns])
  function display(value: JsonValue | undefined): string {
    if (value === null || value === undefined) return '—'
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
</script>

<Card.Root aria-label={manager.label} class="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
  <Card.Header class="hp:flex-row hp:items-center hp:gap-3" data-slot="relation-manager-header">
    <Card.Title class="hp:flex-1" data-slot="relation-manager-title">{manager.label}</Card.Title>
    {#if manager.badge !== null}<Badge aria-label={`${manager.badge} ${manager.label.toLocaleLowerCase()}`} class="hp-relation-manager-count" variant="secondary">{manager.badge}</Badge>{/if}
  </Card.Header>
  <Card.Content class="hp:space-y-4">
    {#if relations.onOperation}<div aria-label={`${manager.label} actions`} class="hp-relation-actions hp-relation-toolbar" data-slot="relation-toolbar" role="group"><RelationActions {manager} {relations} {selectedIds} /></div>{/if}
    {#if manager.records.length === 0}
      <Empty.Root class="hp:min-h-40 hp:border" data-slot="table-empty"><Empty.Header><Empty.Title>No records</Empty.Title><Empty.Description>{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</Empty.Description></Empty.Header></Empty.Root>
    {:else}
      {#snippet cell(record: Readonly<ClientRelationRecord>, column: { readonly key: string })}
        {#if column.key === 'selection'}
          <Checkbox aria-label={`Select record ${record.id}`} checked={selectedIds.includes(record.id)} onCheckedChange={checked => { selectedIds = checked ? [...selectedIds.filter(id => id !== record.id), record.id] : selectedIds.filter(id => id !== record.id) }} />
        {:else}{display(record.values[column.key])}{/if}
      {/snippet}
      {#snippet trailing(record: Readonly<ClientRelationRecord>)}
        <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${record.id}`} class="hp-relation-row-actions" data-slot="relation-row-actions" role="group"><RelationActions {manager} {record} {relations} /></div>
      {/snippet}
      <TablePresentation caption={manager.label} {cell} {columns} containerClass="hp-relation-table-overflow" getRecordId={record => record.id} records={manager.records} trailing={hasRows ? { cell: trailing, label: 'Actions' } : undefined} />
    {/if}
  </Card.Content>
</Card.Root>
