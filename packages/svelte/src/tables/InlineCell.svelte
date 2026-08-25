<script lang="ts" generics="TRecord extends object, TRecordId extends TableRecordId">
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import { Input } from '../ui/input'
  import { NativeSelect as Select } from '../ui/native-select'
  import { Switch } from '../ui/switch'
  import type { TableRecordId } from '@holo-js/panels-client'
  import ColumnPresentation from './ColumnPresentation.svelte'
  import { displayValue, optionValue, recordValue } from './helpers'
  import type { SvelteTableColumn, SvelteTableRendererProps } from './types'

  let { column, record, table }: {
    readonly column: SvelteTableColumn<TRecord>
    readonly record: Readonly<TRecord>
    readonly table: SvelteTableRendererProps<TRecord, TRecordId>
  } = $props()
  let editing = $state(false)
  let pending = $state(false)
  let error = $state<string | null>(null)
  let value = $state<boolean | number | string | null>(null)
  const original = $derived(recordValue(record, column.manifest.path))
  const editor = $derived(column.manifest.inlineEditor)
  const kind = $derived(editor?.kind)
  const validEditor = $derived(typeof editor?.action === 'string' && ['checkbox', 'select', 'text-input', 'toggle'].includes(String(kind)))
  const options = $derived<readonly unknown[]>(Array.isArray(editor?.options) ? editor.options : [])

  function begin(): void {
    value = typeof original === 'boolean' || typeof original === 'number' || typeof original === 'string' || original === null
      ? original
      : displayValue(original) === '—' ? '' : displayValue(original)
    error = null
    editing = true
  }

  async function save(next = value): Promise<void> {
    const action = editor?.action
    if (typeof action !== 'string' || !table.inlineEditTransport) {
      error = '[Holo Panels] Inline editing requires a compiled action transport.'
      return
    }
    pending = true
    error = null
    try {
      await table.inlineEditTransport.execute({
        action,
        columnPath: column.manifest.path,
        expectedVersion: table.getRecordVersion?.(record) ?? null,
        recordId: table.getRecordId(record),
        value: next,
      }, new AbortController().signal)
      editing = false
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Inline edit failed'
    } finally {
      pending = false
    }
  }

  function select(event: Event): void {
    const raw = (event.currentTarget as HTMLSelectElement).value
    const next = options.map(optionValue).find(option => typeof option !== 'undefined' && String(option) === raw)
    if (typeof next === 'undefined') return
    value = next
    void save(next)
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      editing = false
      error = null
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
  }
</script>

{#if !validEditor}
  <ColumnPresentation {column} panelId={table.panelId} {record} registry={table.registry} value={original} />
{:else if !editing}
  <Button type="button" aria-label="Edit {column.manifest.label ?? column.manifest.path}" onclick={begin}><ColumnPresentation {column} panelId={table.panelId} {record} registry={table.registry} value={original} /></Button>
{:else if kind === 'checkbox' || kind === 'toggle'}
  <span>
    {#if kind === 'toggle'}<Switch aria-label={column.manifest.label ?? column.manifest.path} checked={value === true} disabled={pending} onCheckedChange={(checked) => { value = checked; void save(value) }} />{:else}<Checkbox aria-label={column.manifest.label ?? column.manifest.path} checked={value === true} disabled={pending} onCheckedChange={(checked) => { value = checked; void save(value) }} />{/if}
    {#if error}<span role="alert">{error}</span>{/if}
  </span>
{:else if kind === 'select'}
  <span>
    <Select aria-label={column.manifest.label ?? column.manifest.path} disabled={pending} value={String(value ?? '')} onchange={select}>
      {#each options as option, index}
        {@const next = optionValue(option)}
        {#if typeof next !== 'undefined'}
          <option value={String(next ?? '')} disabled={typeof option === 'object' && option !== null && Reflect.get(option, 'disabled') === true}>{typeof option === 'object' && option !== null && typeof Reflect.get(option, 'label') === 'string' ? Reflect.get(option, 'label') : `Option ${index + 1}`}</option>
        {/if}
      {/each}
    </Select>
    {#if error}<span role="alert">{error}</span>{/if}
  </span>
{:else}
  <span>
    <Input aria-label={column.manifest.label ?? column.manifest.path} disabled={pending} value={String(value ?? '')} oninput={(event) => { value = (event.currentTarget as HTMLInputElement).value }} onkeydown={keydown} />
    {#if error}<span role="alert">{error}</span>{/if}
  </span>
{/if}
