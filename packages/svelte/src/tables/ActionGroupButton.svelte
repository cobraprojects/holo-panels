<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import type { TableRecordId } from '@holo-js/panels-client'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import Ellipsis from 'lucide-svelte/icons/ellipsis'
  import Icon from '../components/Icon.svelte'
  import { Button } from '../ui/button'
  import * as AlertDialog from '../ui/alert-dialog'
  import * as DropdownMenu from '../ui/dropdown-menu'
  import { executeTableAction } from './execute-action'
  import type { SvelteTableAction, SvelteTableActionGroup, SvelteTableRendererProps } from './types'

  let { group, record, table }: {
    readonly group: SvelteTableActionGroup
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  const label = $derived(group.label ?? (group.scope === 'bulk' ? 'Bulk actions' : 'Actions'))
  let confirmation = $state<SvelteTableAction | null>(null)
  let pendingActionId = $state<string | null>(null)

  async function run(action: SvelteTableAction): Promise<void> {
    pendingActionId = action.id
    try {
      await executeTableAction(action, record, table)
    } finally {
      pendingActionId = null
    }
  }

  function activate(action: SvelteTableAction): void {
    if (action.confirmation) confirmation = action
    else void run(action)
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}<Button {...props} aria-label={label} class="hp-action-group-trigger hp-action-trigger" data-action-group={group.id} type="button" variant="outline">{#if group.icon}<Icon name={group.icon} />{:else if group.scope === 'row'}<Ellipsis aria-hidden="true" />{/if}<span>{label}</span>{#if group.scope !== 'row'}<ChevronDown aria-hidden="true" />{/if}</Button>{/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" data-holo-panel>
    {#each group.actions as action (action.id)}<DropdownMenu.Item data-action={action.id} data-color={action.color ?? undefined} disabled={pendingActionId !== null} variant={action.color === 'danger' ? 'destructive' : 'default'} onSelect={() => activate(action)}>{#if action.icon}<Icon name={action.icon} />{/if}<span>{pendingActionId === action.id ? 'Working…' : action.label}</span></DropdownMenu.Item>{/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>

{#if confirmation}
  <AlertDialog.Root open onOpenChange={(open) => { if (!open) confirmation = null }}>
    <AlertDialog.Content data-holo-panel>
      <AlertDialog.Header><AlertDialog.Title id={`${confirmation.id}-confirmation-title`}>{confirmation.label}</AlertDialog.Title><AlertDialog.Description>{confirmation.confirmation}</AlertDialog.Description></AlertDialog.Header>
      <AlertDialog.Footer><AlertDialog.Cancel onclick={() => { confirmation = null }}>Cancel</AlertDialog.Cancel><AlertDialog.Action variant={confirmation.color === 'danger' ? 'destructive' : 'default'} onclick={() => { const action = confirmation; confirmation = null; if (action) void run(action) }}>{#if confirmation.icon}<Icon name={confirmation.icon} />{/if}Confirm</AlertDialog.Action></AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
