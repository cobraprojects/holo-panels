<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import type { TableRecordId } from '@holo-js/panels-client'
  import type { SvelteTableAction, SvelteTableRendererProps } from './types'

  let { action, record, table }: {
    readonly action: SvelteTableAction
    readonly record?: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  let pending = $state(false)
  let error = $state<string | null>(null)

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
  <button type="button" disabled={pending} onclick={() => void run()}>{pending ? 'Working…' : action.label}</button>
  {#if error}<span role="alert">{error}</span>{/if}
</span>
