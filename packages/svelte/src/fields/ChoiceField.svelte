<script lang="ts">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import type { OptionValue } from '@holo-js/panels-client'
  import { toSvelteState } from '../stores'
  import type { SvelteFieldRendererProps } from './contracts'
  import FieldFrame from './FieldFrame.svelte'
  import { fieldInputId, fieldPresentation, optionValue, readFieldValue, writeFieldValue } from './helpers'

  let { definition, form, optionStore }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const optionState = $derived.by(() => optionStore ? toSvelteState(optionStore) : undefined)
  const presentation = $derived(fieldPresentation(definition, $formState))
  const value = $derived(readFieldValue($formState.values, definition.path))
  const options = $derived($optionState?.options ?? [])
  const inputId = $derived(fieldInputId(definition.path))
  const kind = $derived(definition.type.split(':').at(-1) ?? 'select')
  const multiple = $derived(kind === 'multiselect' || kind === 'checkbox-list' || Boolean(definition.properties?.multiple))
  let createLabel = $state('')
  let editLabel = $state('')

  function selectedValues(): readonly OptionValue[] {
    if (Array.isArray(value)) return value.filter((item): item is OptionValue => typeof item === 'string' || typeof item === 'number')
    return typeof value === 'string' || typeof value === 'number' ? [value] : []
  }

  async function createOption(): Promise<void> {
    if (!optionStore) return
    const option = await optionStore.create(createLabel)
    const next = multiple ? [...selectedValues(), option.value] : option.value
    createLabel = ''
    setSelection(next)
    await optionStore.hydrateSelected(multiple ? next as readonly OptionValue[] : [option.value])
  }

  async function editOption(): Promise<void> {
    const selected = selectedValues()
    if (!optionStore || selected.length !== 1) return
    await optionStore.edit(selected[0]!, editLabel)
    editLabel = ''
    await optionStore.hydrateSelected(selected)
  }

  function setSelection(next: OptionValue | readonly OptionValue[] | null): void {
    writeFieldValue(form, definition.path, next)
  }

  function changeSelect(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement
    if (multiple) {
      setSelection(Array.from(select.selectedOptions).map(option => optionValue(option.value, options)))
      return
    }
    setSelection(select.value ? optionValue(select.value, options) : null)
  }

  function toggle(next: OptionValue, checked: boolean): void {
    if (!multiple) {
      setSelection(checked ? next : null)
      return
    }
    const current = Array.isArray(value) ? value.filter((item): item is OptionValue => typeof item === 'string' || typeof item === 'number') : []
    setSelection(checked ? [...current, next] : current.filter(item => item !== next))
  }

  function selected(candidate: OptionValue): boolean {
    return Array.isArray(value) ? value.includes(candidate) : value === candidate
  }

  function selectValue(): string | readonly string[] {
    if (multiple) return selectedValues().map(String)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  function search(event: Event): void {
    if (!optionStore) return
    void optionStore.load((event.currentTarget as HTMLInputElement).value, 1)
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} required={presentation.required}>
    {#snippet children(attributes)}
      {#if Boolean(definition.properties?.searchable)}
        <Input aria-label="Search {definition.label}" disabled={presentation.disabled || $optionState?.disabled} oninput={search} value={$optionState?.search ?? ''} />
      {/if}
      {#if kind === 'checkbox-list' || kind === 'toggle-buttons'}
        <div {...attributes} role={kind === 'toggle-buttons' ? 'group' : 'group'} aria-readonly={presentation.readOnly}>
          {#each options as option (option.value)}
            <label>
              <Input type={multiple ? 'checkbox' : 'radio'} name={inputId} value={option.value} checked={selected(option.value)} disabled={presentation.disabled || presentation.readOnly || option.disabled || $optionState?.disabled} onchange={(event) => toggle(option.value, (event.currentTarget as HTMLInputElement).checked)} />
              {option.label}
            </label>
          {/each}
        </div>
      {:else}
        <Select {...attributes} {multiple} value={selectValue()} disabled={presentation.disabled || presentation.readOnly || $optionState?.disabled} required={presentation.required} onchange={changeSelect}>
          {#if !multiple}<option value="">{definition.placeholder ?? 'Select an option'}</option>{/if}
          {#each options as option (option.value)}
            <option value={option.value} disabled={option.disabled}>{option.label}</option>
          {/each}
        </Select>
      {/if}
      {#if $optionState?.loading}<span role="status">Loading options</span>{/if}
      {#if $optionState?.error}<span role="alert">{$optionState.error}</span>{/if}
      {#if $optionState?.hasMore}<Button type="button" disabled={$optionState.loading} onclick={() => optionStore && void optionStore.load($optionState.search, $optionState.page + 1)}>Load more</Button>{/if}
      {#if Boolean(definition.properties?.canCreateOption)}
        <div><Input aria-label="Create {definition.label} label" disabled={presentation.disabled || presentation.readOnly} bind:value={createLabel} /><Button type="button" disabled={!createLabel.trim()} onclick={() => void createOption()}>Create option</Button></div>
      {/if}
      {#if Boolean(definition.properties?.canEditOption)}
        <div><Input aria-label="Edit {definition.label} label" disabled={presentation.disabled || presentation.readOnly || selectedValues().length !== 1} bind:value={editLabel} /><Button type="button" disabled={!editLabel.trim() || selectedValues().length !== 1} onclick={() => void editOption()}>Edit option</Button></div>
      {/if}
    {/snippet}
  </FieldFrame>
{/if}
