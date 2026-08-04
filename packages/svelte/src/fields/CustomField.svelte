<script lang="ts">
  import type { Component } from 'svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteCustomFieldProps, SvelteFieldRendererProps } from './contracts'
  import { fieldInputId, fieldPresentation, readFieldValue, writeFieldValue } from './helpers'

  let { definition, form, optionStore, collectionStore, uploadStore, registry, panelId, requestedFrom }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const presentation = $derived(fieldPresentation(definition, $formState))
  const value = $derived(readFieldValue($formState.values, definition.path))
  const inputId = $derived(fieldInputId(definition.path))
  const Resolved = $derived.by((): Component<SvelteCustomFieldProps> => {
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for custom field "${definition.type}".`)
    return registry.resolve<SvelteCustomFieldProps>(`field.${definition.type.replaceAll(':', '.')}`, panelId, requestedFrom ?? `field "${definition.path}"`)
  })
</script>

{#if presentation.visible}
  <Resolved
    {definition}
    {form}
    {optionStore}
    {collectionStore}
    {uploadStore}
    {registry}
    {panelId}
    {requestedFrom}
    {value}
    errors={presentation.errors}
    disabled={presentation.disabled}
    readOnly={presentation.readOnly}
    required={presentation.required}
    {inputId}
    setValue={(next) => writeFieldValue(form, definition.path, next)}
  />
{/if}
