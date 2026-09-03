<script lang="ts">
  import { usePanelTranslator } from '../localization'
  const translate = usePanelTranslator()
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import { Input } from '../ui/input'
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

  interface NestedField {
    readonly label: string
    readonly path: string
    readonly required: boolean
    readonly type: string
  }

  const blocks = $derived(Array.isArray(definition.properties?.blocks) ? definition.properties.blocks : [])
  const repeaterFields = $derived(nestedFields(definition.properties?.fields))

  function syncCollection(): void {
    if (collectionStore) writeFieldValue(form, definition, collectionStore.values)
  }

  function add(blockType?: string): void {
    if (!collectionStore) return
    collectionStore.add(kind === 'builder' ? { data: {}, type: blockType ?? '' } : kind === 'key-value' ? { key: '', value: '' } : {})
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

  function entryPart(value: JsonValue, part: 'key' | 'value'): string {
    return value && typeof value === 'object' && !Array.isArray(value) && typeof value[part] === 'string' ? value[part] : ''
  }

  function nestedFields(value: unknown): readonly NestedField[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const label = Reflect.get(item, 'label')
      const path = Reflect.get(item, 'path')
      const type = Reflect.get(item, 'type')
      return typeof label === 'string' && typeof path === 'string' && typeof type === 'string'
        ? [{ label, path, required: Reflect.get(item, 'required') === true, type }]
        : []
    })
  }

  function nestedValue(value: JsonValue, path: string): JsonValue | undefined {
    let current: JsonValue | undefined = value
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
      current = current[segment]
    }
    return current
  }

  function withNestedValue(value: JsonValue, path: string, next: JsonValue): JsonValue {
    const result = value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}
    const segments = path.split('.')
    let target = result
    for (const segment of segments.slice(0, -1)) {
      const child = target[segment]
      const object = child && typeof child === 'object' && !Array.isArray(child) ? child : {}
      target[segment] = object
      target = object
    }
    const final = segments.at(-1)
    if (final) target[final] = next
    return result
  }

  function itemFields(value: JsonValue): readonly NestedField[] {
    if (kind !== 'builder') return repeaterFields
    const type = value && typeof value === 'object' && !Array.isArray(value) && typeof value.type === 'string' ? value.type : ''
    const block = blocks.find(item => item && typeof item === 'object' && !Array.isArray(item) && item.type === type)
    return block && typeof block === 'object' && !Array.isArray(block) ? nestedFields(block.fields) : []
  }

  function itemData(value: JsonValue): JsonValue {
    if (kind !== 'builder') return value
    return value && typeof value === 'object' && !Array.isArray(value) && value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : {}
  }

  function replaceItemField(index: number, item: JsonValue, field: NestedField, next: JsonValue): void {
    const data = withNestedValue(itemData(item), field.path, next)
    if (kind === 'builder') {
      const type = item && typeof item === 'object' && !Array.isArray(item) && typeof item.type === 'string' ? item.type : ''
      replace(index, { data, type })
      return
    }
    replace(index, data)
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} path={definition.path} required={presentation.required} type={kind}>
    {#snippet children(attributes)}
      {#if collectionStore}
        <div {...attributes} role="group" data-readonly={presentation.readOnly} data-panels-collection={kind}>
          {#each $collectionState?.items ?? [] as item, index (item.key)}
            <article data-collection-key={item.key}>
              {#if !item.collapsed}
                {#if kind === 'key-value'}
                  <span class="hp-key-value-entry"><Input aria-label={translate('fields.key', { number: index + 1 })} disabled={presentation.disabled || presentation.readOnly} value={entryPart(item.value, 'key')} oninput={(event) => replace(index, { key: event.currentTarget.value, value: entryPart(item.value, 'value') })} /><Input aria-label={translate('fields.value', { number: index + 1 })} disabled={presentation.disabled || presentation.readOnly} value={entryPart(item.value, 'value')} oninput={(event) => replace(index, { key: entryPart(item.value, 'key'), value: event.currentTarget.value })} /></span>
                {:else if itemFields(item.value).length > 0}
                  <div class="hp-collection-fields">{#each itemFields(item.value) as field (field.path)}
                    {@const current = nestedValue(itemData(item.value), field.path)}
                    {@const checkbox = field.type === 'toggle' || field.type === 'checkbox'}
                    <label>{field.label}{#if checkbox}<Checkbox checked={current === true} disabled={presentation.disabled || presentation.readOnly} onCheckedChange={(checked) => replaceItemField(index, item.value, field, checked)} />{:else}<Input type="text" value={typeof current === 'string' || typeof current === 'number' ? current : ''} required={field.required} disabled={presentation.disabled || presentation.readOnly} oninput={(event) => replaceItemField(index, item.value, field, event.currentTarget.value)} />{/if}</label>
                  {/each}</div>
                {:else}
                  <Editor value={jsonValue(item.value)} disabled={presentation.disabled} readOnly={presentation.readOnly} label={`${definition.label} item ${index + 1}`} inputId={`${inputId}-${index}`} invalid={Boolean($collectionState?.errors[String(index)]?.length)} setValue={(next) => replace(index, next)} />
                {/if}
              {/if}
              {#if Boolean(definition.properties?.collapsible)}<Button type="button" disabled={presentation.disabled} onclick={() => collectionStore?.toggleCollapsed(index)}>{item.collapsed ? translate('fields.expand') : translate('fields.collapse')}</Button>{/if}
              {#if Boolean(definition.properties?.cloneable)}<Button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => clone(index)}>{translate('fields.clone')}</Button>{/if}
              <Button type="button" disabled={presentation.disabled || presentation.readOnly || index === 0} onclick={() => move(index, index - 1)}>Move up</Button>
              <Button type="button" disabled={presentation.disabled || presentation.readOnly || index === ($collectionState?.items.length ?? 0) - 1} onclick={() => move(index, index + 1)}>Move down</Button>
              <Button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => remove(index)}>{translate('fields.remove')}</Button>
            </article>
          {/each}
          {#if kind === 'builder'}
            {#each blocks as block}
              {#if block && typeof block === 'object' && !Array.isArray(block) && typeof block.type === 'string'}<Button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => add(String(block.type))}>{translate('fields.addBlock', { label: typeof block.label === 'string' ? block.label : String(block.type) })}</Button>{/if}
            {/each}
          {:else}
            <Button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => add()}>{translate('fields.addItem')}</Button>
          {/if}
        </div>
      {:else}
        <Editor value={jsonValue(value)} disabled={presentation.disabled} readOnly={presentation.readOnly} label={definition.label} {inputId} describedBy={attributes['aria-describedby']} errorMessageId={attributes['aria-errormessage']} invalid={Boolean(attributes['aria-invalid'])} setValue={(next) => writeFieldValue(form, definition, next)} />
      {/if}
    {/snippet}
  </FieldFrame>
{/if}
