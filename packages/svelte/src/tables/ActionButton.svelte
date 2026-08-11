<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import Button from '../components/Button.svelte'
  import Icon from '../components/Icon.svelte'
  import type { TableRecordId } from '@holo-js/panels-client'
  import type { SvelteTableAction, SvelteTableRendererProps } from './types'
  let { action, record, table }: {
    readonly action: SvelteTableAction
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  let pending = $state(false)
  let error = $state<string | null>(null)
  const href = $derived(record ? table.getRecordActionUrl?.(action, record) ?? null : null)
  const destructive = $derived(action.id.includes('delete'))
  const editable = $derived(action.id.includes('edit'))
  const viewable = $derived(action.id.includes('view'))
  const icon = $derived(action.icon ?? (destructive ? 'delete' : editable ? 'edit' : viewable ? 'view' : null))

  async function run(): Promise<void> {
    if (!table.actionTransport) {
      error = '[Holo Panels] Svelte table actions require an action transport.'
      return
    }
    if (action.confirmation && typeof globalThis.confirm === 'function' && !globalThis.confirm(action.confirmation)) return
    pending = true
    error = null
    try {
      await table.actionTransport.execute({
        actionId: action.id,
        ...(record ? { recordId: table.getRecordId(record) } : {}),
        ...(action.scope === 'bulk' ? { selection: table.store.selectionPayload() } : {}),
      }, new AbortController().signal)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Action failed'
    } finally {
      pending = false
    }
  }
</script>

<span>
  {#if href}
    <a class="hp-button hp-button-ghost hp-table-action" data-action={action.id} data-color={action.color ?? undefined} {href}>{#if icon}<Icon name={icon} />{/if}<span>{action.label}</span></a>
  {:else}
    <Button class="hp-table-action" data-action={action.id} data-color={action.color ?? undefined} type="button" disabled={pending} onclick={() => void run()}>{#if icon}<Icon name={icon} />{/if}<span>{pending ? 'Working…' : action.label}</span></Button>
  {/if}
  {#if error}<span role="alert">{error}</span>{/if}
</span>
