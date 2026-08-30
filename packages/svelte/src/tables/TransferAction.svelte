<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { Button } from '../ui/button'
  import Icon from '../components/Icon.svelte'
  import { Input } from '../ui/input'
  import { Progress } from '../ui/progress'
  import { Checkbox } from '../ui/checkbox'
  import { NativeSelect as Select } from '../ui/native-select'
  import { ClientTransferStore, createPanelTranslator, type ClientTransferManifest, type ClientTransferTransport, type TableRecordId } from '@holo-js/panels-client'
  import { untrack } from 'svelte'
  import * as Dialog from '../ui/dialog'
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
  const translate = $derived(createPanelTranslator(table.locale ?? 'en'))
  const kind = $derived(translate(`transfers.${manifest.kind}`))

  async function submit(): Promise<void> {
    if (manifest.kind === 'import') await store.startImport(formatId, Object.entries(mappings).flatMap(([column, header]) => header ? [{ column, header }] : []))
    else await store.startExport(formatId, [...columns], table.store.selectionPayload())
  }
</script>

<span class="hp-transfer-action">
  <Button class="hp-action-trigger" data-action={manifest.id} disabled={!available} onclick={() => open = true} type="button"><Icon name={manifest.kind === 'import' ? 'upload' : 'download'} /><span>{manifest.label}</span></Button>
  <Dialog.Root bind:open onOpenChange={(value) => { if (!value) store.cancel() }}>
    <Dialog.Content closeLabel={translate('actions.close')} data-holo-panel>
    <Dialog.Header><Dialog.Title id={`${manifest.id}-title`}>{manifest.label}</Dialog.Title><Dialog.Description>{translate('transfers.configure', { kind })}</Dialog.Description></Dialog.Header>
    <div class="hp:space-y-4">
    <label>{translate('transfers.format')}<Select bind:value={formatId}>{#each manifest.formatIds as id (id)}<option value={id}>{id.toUpperCase()}</option>{/each}</Select></label>
    {#if manifest.kind === 'import'}
      <label>{translate('transfers.csvFile')}<Input accept=".csv,text/csv" onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void store.inspect(file).catch(() => undefined) }} type="file" /></label>
      {#if $transferState.inspection}
        {#each manifest.columns as column (column.key)}
          <label>{column.label}<Select required={column.required} value={mappings[column.key] ?? ''} onchange={(event) => mappings = { ...mappings, [column.key]: event.currentTarget.value }}><option value="">{translate('transfers.doNotImport')}</option>{#each $transferState.inspection.headers as header (header)}<option value={header}>{header}</option>{/each}</Select></label>
        {/each}
      {/if}
      {#if $transferState.uploadProgress > 0}<Progress aria-label={translate('transfers.uploadProgress')} max={100} value={$transferState.uploadProgress} />{/if}
    {:else}
      {#each manifest.columns as column (column.id)}<label><Checkbox checked={columns.has(column.id)} onCheckedChange={(checked) => { const next = new Set(columns); if (checked) next.add(column.id); else next.delete(column.id); columns = next }} />{column.label}</label>{/each}
    {/if}
    <Button disabled={!available || (manifest.kind === 'import' && !$transferState.inspection)} onclick={() => void submit().catch(() => undefined)} type="button">{translate('transfers.start', { kind })}</Button>
    {#if $transferState.progress}<Progress aria-label={translate('transfers.transferProgress')} max={Math.max(1, $transferState.progress.total)} value={$transferState.progress.completed} />{/if}
    {#if $transferState.error}<div role="alert">{$transferState.error}</div>{/if}
    <Dialog.Footer closeLabel={translate('actions.close')}><Button onclick={() => open = false} type="button" variant="outline">{translate('transfers.close')}</Button></Dialog.Footer>
    </div>
    </Dialog.Content>
  </Dialog.Root>
</span>
