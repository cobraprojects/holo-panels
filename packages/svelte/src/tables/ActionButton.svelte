<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { Button } from '../ui/button'
  import * as AlertDialog from '../ui/alert-dialog'
  import * as DropdownMenu from '../ui/dropdown-menu'
  import Icon from '../components/Icon.svelte'
  import type { TableRecordId } from '@holo-js/panels-client'
  import type { SvelteTableAction, SvelteTableRendererProps } from './types'
  import { executeTableAction } from './execute-action'
  let { action, menuItem = false, record, table }: {
    readonly action: SvelteTableAction
    readonly menuItem?: boolean
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  let pending = $state(false)
  let confirming = $state(false)
  const href = $derived(record ? table.getRecordActionUrl?.(action, record) ?? null : null)
  async function run(): Promise<void> {
    pending = true
    try {
      await executeTableAction(action, record, table)
    } finally {
      pending = false
    }
  }

  function activate(): void {
    if (action.confirmation) confirming = true
    else void run()
  }
</script>

{#if menuItem}
  <DropdownMenu.Item data-action={action.id} data-color={action.color ?? undefined} disabled={pending} variant={action.color === 'danger' ? 'destructive' : 'default'} onSelect={activate}>{#if action.icon}<Icon name={action.icon} />{/if}<span>{pending ? 'Working…' : action.label}</span></DropdownMenu.Item>
{:else}<span>
  {#if href}
    <Button class="hp-action-trigger hp-table-action" data-action={action.id} data-color={action.color ?? undefined} data-slot="button" variant={action.color === 'danger' ? 'destructive' : 'outline'} {href}>{#if action.icon}<Icon name={action.icon} />{/if}<span>{action.label}</span></Button>
  {:else}
    <Button class="hp-action-trigger hp-table-action" data-action={action.id} data-color={action.color ?? undefined} variant={action.color === 'danger' ? 'destructive' : 'outline'} type="button" disabled={pending} onclick={activate}>{#if action.icon}<Icon name={action.icon} />{/if}<span>{pending ? 'Working…' : action.label}</span></Button>
  {/if}
</span>{/if}
{#if confirming}
  <AlertDialog.Root open onOpenChange={(open) => { confirming = open }}>
    <AlertDialog.Content data-holo-panel>
      <AlertDialog.Header><AlertDialog.Title id={`${action.id}-confirmation-title`}>{action.label}</AlertDialog.Title><AlertDialog.Description>{action.confirmation}</AlertDialog.Description></AlertDialog.Header>
      <AlertDialog.Footer><AlertDialog.Cancel onclick={() => { confirming = false }}>Cancel</AlertDialog.Cancel><AlertDialog.Action variant={action.color === 'danger' ? 'destructive' : 'default'} onclick={() => { confirming = false; void run() }}>{#if action.icon}<Icon name={action.icon} />{/if}Confirm</AlertDialog.Action></AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
