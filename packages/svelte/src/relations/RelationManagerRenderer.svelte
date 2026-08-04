<script lang="ts">
  import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
  import type { SvelteRelationManagerRendererProps, SvelteRelationOperationRequest } from './contracts'

  let { relations }: { readonly relations: SvelteRelationManagerRendererProps } = $props()
  let selection = $state<Record<string, string | undefined>>({})
  const layout = $derived(createClientRelationLayout(relations.managers, { ...(relations.selection ?? {}), ...selection }))
  const managerOperations: readonly RelationOperation[] = ['create', 'associate', 'attach']
  const recordOperations: readonly RelationOperation[] = ['view', 'edit', 'delete', 'dissociate', 'detach', 'editPivot']

  function operationLabel(operation: RelationOperation): string {
    return operation === 'editPivot' ? 'Edit pivot' : `${operation[0]?.toUpperCase() ?? ''}${operation.slice(1)}`
  }

  function display(value: JsonValue | undefined): string {
    if (value === null || typeof value === 'undefined') return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  function run(manager: ClientRelationManager, operation: RelationOperation, record?: ClientRelationRecord): void {
    const request: SvelteRelationOperationRequest = { managerId: manager.id, operation, ...(record ? { recordId: record.id } : {}) }
    void relations.onOperation?.(request)
  }

  function select(groupId: string, managerId: string): void {
    selection = { ...selection, [groupId]: managerId }
    relations.onSelectionChange?.(groupId, managerId)
  }
</script>

{#snippet panel(manager: ClientRelationManager)}
  <section aria-label={manager.label} class="hp-relation-manager" data-relation-manager={manager.id}>
    <header><h3>{manager.label}</h3>{#if manager.badge !== null}<span class="hp-relation-badge">{manager.badge}</span>{/if}</header>
    <div class="hp-relation-actions">
      {#each managerOperations.filter(operation => manager.operations.includes(operation)) as operation (operation)}
        <button data-operation={operation} type="button" onclick={() => run(manager, operation)}>{operationLabel(operation)}</button>
      {/each}
    </div>
    {#if manager.records.length === 0}
      <p class="hp-relation-empty">{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</p>
    {:else}
      <table>
        <caption>{manager.label}</caption>
        <thead><tr>{#each manager.columns as column (column.key)}<th scope="col">{column.label}</th>{/each}<th scope="col">Actions</th></tr></thead>
        <tbody>
          {#each manager.records as record (record.id)}
            <tr>
              {#each manager.columns as column (column.key)}<td>{display(record.values[column.key])}</td>{/each}
              <td>
                {#each recordOperations.filter(operation => manager.operations.includes(operation)) as operation (operation)}
                  <button data-operation={operation} type="button" onclick={() => run(manager, operation, record)}>{operationLabel(operation)}</button>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/snippet}

<div class="hp-relations" data-panels-component="relation-managers">
  {#each layout.inline as manager (manager.id)}{@render panel(manager)}{/each}
  {#each layout.tabGroups as group (group.id)}
    <section aria-label={group.label ?? 'Related records'} class="hp-relation-tabs">
      {#if group.label}<h2>{group.label}</h2>{/if}
      <div aria-label={group.label ?? 'Related records'} role="tablist">
        {#each group.managers as manager (manager.id)}
          <button aria-controls={`${group.id}-${manager.id}`} aria-selected={group.activeId === manager.id} id={`${group.id}-${manager.id}-tab`} onclick={() => select(group.id, manager.id)} role="tab" type="button">{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</button>
        {/each}
      </div>
      {#each group.managers as manager (manager.id)}
        <div aria-labelledby={`${group.id}-${manager.id}-tab`} hidden={group.activeId !== manager.id} id={`${group.id}-${manager.id}`} role="tabpanel">{@render panel(manager)}</div>
      {/each}
    </section>
  {/each}
  {#if layout.pages.length > 0}
    <nav aria-label="Related record pages" class="hp-relation-pages">
      {#each layout.pages as manager (manager.id)}<a href={manager.url ?? '/'}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>{/each}
    </nav>
  {/if}
</div>
