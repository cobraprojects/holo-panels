<script lang="ts">
  import type { JsonValue } from '@holo-js/panels-client'
  import type { Component } from 'svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteEditorProps, SvelteFieldRendererProps } from './contracts'
  import DefaultEditor from './DefaultEditor.svelte'
  import FieldFrame from './FieldFrame.svelte'
  import { fieldInputId, fieldPresentation, jsonValue, readFieldValue, stringProperty, writeFieldValue } from './helpers'

  let { definition, form, collectionStore, registry, panelId, requestedFrom }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const collectionState = $derived.by(() => collectionStore ? toSvelteState(collectionStore) : undefined)
  const presentation = $derived(fieldPresentation(definition, $formState))
  const value = $derived(readFieldValue($formState.values, definition.path))
  const inputId = $derived(fieldInputId(definition.path))
  const kind = $derived(definition.type.split(':').at(-1) ?? 'tags')
  const adapter = $derived(stringProperty(definition.properties ?? {}, 'editorAdapter'))
  const Editor = $derived<Component<SvelteEditorProps>>(adapter && registry
    ? registry.resolve<SvelteEditorProps>(`panels:editor:${adapter}`, panelId, requestedFrom ?? definition.path)
    : DefaultEditor)

  function syncCollection(): void {
    if (collectionStore) writeFieldValue(form, definition.path, collectionStore.values)
  }

  function add(): void {
    if (!collectionStore) return
    collectionStore.add(kind === 'builder' ? { type: 'block' } : '')
    syncCollection()
  }

  function remove(index: number): void {
    collectionStore?.delete(index)
    syncCollection()
  }

  function clone(index: number): void {
    collectionStore?.clone(index)
    syncCollection()
  }

  function move(from: number, to: number): void {
    collectionStore?.move(from, to)
    syncCollection()
  }

  function replace(index: number, next: JsonValue): void {
    collectionStore?.replace(index, next)
    syncCollection()
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} required={presentation.required}>
    {#snippet children(attributes)}
      {#if collectionStore}
        <div {...attributes} role="group" data-readonly={presentation.readOnly} data-panels-collection={kind}>
          {#each $collectionState?.items ?? [] as item, index (item.key)}
            <article data-collection-key={item.key}>
              {#if !item.collapsed}
                <Editor value={jsonValue(item.value)} disabled={presentation.disabled} readOnly={presentation.readOnly} label={`${definition.label} item ${index + 1}`} inputId={`${inputId}-${index}`} invalid={Boolean($collectionState?.errors[String(index)]?.length)} setValue={(next) => replace(index, next)} />
              {/if}
              {#if Boolean(definition.properties?.collapsible)}<button type="button" disabled={presentation.disabled} onclick={() => collectionStore?.toggleCollapsed(index)}>{item.collapsed ? 'Expand' : 'Collapse'}</button>{/if}
              {#if Boolean(definition.properties?.cloneable)}<button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => clone(index)}>Clone</button>{/if}
              <button type="button" disabled={presentation.disabled || presentation.readOnly || index === 0} onclick={() => move(index, index - 1)}>Move up</button>
              <button type="button" disabled={presentation.disabled || presentation.readOnly || index === ($collectionState?.items.length ?? 0) - 1} onclick={() => move(index, index + 1)}>Move down</button>
              <button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => remove(index)}>Remove</button>
            </article>
          {/each}
          <button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={add}>Add {kind === 'builder' ? 'block' : 'item'}</button>
        </div>
      {:else}
        <Editor value={jsonValue(value)} disabled={presentation.disabled} readOnly={presentation.readOnly} label={definition.label} {inputId} describedBy={attributes['aria-describedby']} errorMessageId={attributes['aria-errormessage']} invalid={Boolean(attributes['aria-invalid'])} setValue={(next) => writeFieldValue(form, definition.path, next)} />
      {/if}
    {/snippet}
  </FieldFrame>
{/if}
