<script lang="ts">
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

  function search(event: Event): void {
    if (!optionStore) return
    void optionStore.load((event.currentTarget as HTMLInputElement).value, 1)
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} required={presentation.required}>
    {#snippet children(attributes)}
      {#if Boolean(definition.properties?.searchable)}
        <input aria-label="Search {definition.label}" disabled={presentation.disabled || $optionState?.disabled} oninput={search} value={$optionState?.search ?? ''} />
      {/if}
      {#if kind === 'checkbox-list' || kind === 'toggle-buttons'}
        <div {...attributes} role={kind === 'toggle-buttons' ? 'group' : 'group'} aria-readonly={presentation.readOnly}>
          {#each options as option (option.value)}
            <label>
              <input type={multiple ? 'checkbox' : 'radio'} name={inputId} value={option.value} checked={selected(option.value)} disabled={presentation.disabled || presentation.readOnly || option.disabled || $optionState?.disabled} onchange={(event) => toggle(option.value, (event.currentTarget as HTMLInputElement).checked)} />
              {option.label}
            </label>
          {/each}
        </div>
      {:else}
        <select {...attributes} {multiple} disabled={presentation.disabled || presentation.readOnly || $optionState?.disabled} required={presentation.required} onchange={changeSelect}>
          {#if !multiple}<option value="" selected={value === null || typeof value === 'undefined'}>{definition.placeholder ?? 'Select an option'}</option>{/if}
          {#each options as option (option.value)}
            <option value={option.value} selected={selected(option.value)} disabled={option.disabled}>{option.label}</option>
          {/each}
        </select>
      {/if}
      {#if $optionState?.loading}<span role="status">Loading options</span>{/if}
      {#if $optionState?.error}<span role="alert">{$optionState.error}</span>{/if}
      {#if $optionState?.hasMore}<button type="button" disabled={$optionState.loading} onclick={() => optionStore && void optionStore.load($optionState.search, $optionState.page + 1)}>Load more</button>{/if}
    {/snippet}
  </FieldFrame>
{/if}
