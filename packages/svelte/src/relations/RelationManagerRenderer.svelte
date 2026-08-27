<script lang="ts">
  import { createClientRelationLayout } from '@holo-js/panels-client'
  import { Badge } from '../ui/badge'
  import * as Tabs from '../ui/tabs'
  import RelationPanel from './RelationPanel.svelte'
  import type { SvelteRelationManagerRendererProps } from './contracts'

  let { relations }: { readonly relations: SvelteRelationManagerRendererProps } = $props()
  let selection = $state<Record<string, string | undefined>>({})
  const layout = $derived(createClientRelationLayout(relations.managers, { ...(relations.selection ?? {}), ...selection }))
  function select(groupId: string, managerId: string): void {
    selection = { ...selection, [groupId]: managerId }
    relations.onSelectionChange?.(groupId, managerId)
  }
</script>

<div class="hp-relations" data-panels-component="relation-managers">
  {#each layout.inline as manager (manager.id)}<RelationPanel {manager} {relations} />{/each}
  {#each layout.tabGroups as group (group.id)}
    <section aria-label={group.label ?? 'Related records'} class="hp-relation-tabs">
      {#if group.label}<h2>{group.label}</h2>{/if}
      <Tabs.Root value={group.activeId} onValueChange={value => select(group.id, value)}>
        <Tabs.List aria-label={group.label ?? 'Related records'}>
          {#each group.managers as manager (manager.id)}
            <Tabs.Trigger value={manager.id}>{manager.label}{#if manager.badge !== null}<Badge class="hp:ml-2" variant="secondary">{manager.badge}</Badge>{/if}</Tabs.Trigger>
          {/each}
        </Tabs.List>
        {#each group.managers as manager (manager.id)}<Tabs.Content value={manager.id}><RelationPanel {manager} {relations} /></Tabs.Content>{/each}
      </Tabs.Root>
    </section>
  {/each}
  {#if layout.pages.length > 0}
    <nav aria-label="Related record pages" class="hp-relation-pages">
      {#each layout.pages as manager (manager.id)}<a href={manager.url ?? undefined}>{manager.label}{manager.badge === null ? '' : ` (${manager.badge})`}</a>{/each}
    </nav>
  {/if}
</div>
