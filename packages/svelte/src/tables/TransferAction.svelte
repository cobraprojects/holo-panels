<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import { ClientTransferStore, type ClientTransferManifest, type ClientTransferTransport, type TableRecordId } from '@holo-js/panels-client'
  import { untrack } from 'svelte'
  import Dialog from '../components/Dialog.svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteTableRendererProps } from './types'

  let { manifest, table }: { readonly manifest: ClientTransferManifest; readonly table: SvelteTableRendererProps<TRecord, TRecordId> } = $props()
  const initialManifest = untrack(() => manifest)
  const initialTable = untrack(() => table)
  const available = Boolean(initialTable.transferTransport)
  const unavailableTransport: ClientTransferTransport = {
    inspectImport: async () => { throw new Error('[Holo Panels] Svelte transfer actions require a transfer transport.') },
    startExport: async () => { throw new Error('[Holo Panels] Svelte transfer actions require a transfer transport.') },
    startImport: async () => { throw new Error('[Holo Panels] Svelte transfer actions require a transfer transport.') },
  }
  let open = $state(false)
  let formatId = $state(initialManifest.formatIds[0] ?? '')
  let mappings = $state<Readonly<Record<string, string>>>({})
  let columns = $state(new Set(initialManifest.kind === 'export' ? initialManifest.columns.filter(column => column.visibleByDefault).map(column => column.id) : []))
  const store = new ClientTransferStore(initialManifest, initialTable.transferTransport ?? unavailableTransport)
  const transferState = toSvelteState(store)

  async function submit(): Promise<void> {
    if (manifest.kind === 'import') await store.startImport(formatId, Object.entries(mappings).flatMap(([column, header]) => header ? [{ column, header }] : []))
    else await store.startExport(formatId, [...columns], table.store.selectionPayload())
  }
</script>

<span class="hp-transfer-action">
  <Button disabled={!available} onclick={() => open = true} type="button">{manifest.label}</Button>
  <Dialog labelledBy={`${manifest.id}-title`} onclose={() => { store.cancel(); open = false }} {open}>
    <h2 id={`${manifest.id}-title`}>{manifest.label}</h2>
    <label>Format<Select bind:value={formatId}>{#each manifest.formatIds as id (id)}<option value={id}>{id.toUpperCase()}</option>{/each}</Select></label>
    {#if manifest.kind === 'import'}
      <label>CSV file<Input accept=".csv,text/csv" onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void store.inspect(file).catch(() => undefined) }} type="file" /></label>
      {#if $transferState.inspection}
        {#each manifest.columns as column (column.key)}
          <label>{column.label}<Select required={column.required} value={mappings[column.key] ?? ''} onchange={(event) => mappings = { ...mappings, [column.key]: event.currentTarget.value }}><option value="">Do not import</option>{#each $transferState.inspection.headers as header (header)}<option value={header}>{header}</option>{/each}</Select></label>
        {/each}
      {/if}
      {#if $transferState.uploadProgress > 0}<progress aria-label="Upload progress" max="100" value={$transferState.uploadProgress}></progress>{/if}
    {:else}
      {#each manifest.columns as column (column.id)}<label><Input checked={columns.has(column.id)} onchange={(event) => { const next = new Set(columns); if (event.currentTarget.checked) next.add(column.id); else next.delete(column.id); columns = next }} type="checkbox" />{column.label}</label>{/each}
    {/if}
    <Button disabled={!available || (manifest.kind === 'import' && !$transferState.inspection)} onclick={() => void submit().catch(() => undefined)} type="button">Start {manifest.kind}</Button>
    {#if $transferState.progress}<progress aria-label="Transfer progress" max={Math.max(1, $transferState.progress.total)} value={$transferState.progress.completed}></progress>{/if}
    {#if $transferState.error}<div role="alert">{$transferState.error}</div>{/if}
    <Button onclick={() => open = false} type="button">Close</Button>
  </Dialog>
</span>
