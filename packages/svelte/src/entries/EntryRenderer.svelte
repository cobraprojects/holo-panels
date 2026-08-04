<script lang="ts">
  import type { Component } from 'svelte'
  import { entryRichTextMetadata, entryUsesMarkdown, safeEntryAttributes, safeMarkdownBlocks } from '@holo-js/panels-client'
  import { toSvelteSnapshot } from '../stores'
  import EntrySlot from './EntrySlot.svelte'
  import type { SvelteCustomEntryProps, SvelteEntryRendererProps } from './contracts'
  import { colorValue, entryLayoutStyle, entryText, objectEntries, safeEntryUrl, valueList } from './helpers'

  let { store, registry, panelId, action }: SvelteEntryRendererProps = $props()
  const entryState = $derived.by(() => toSvelteSnapshot(store))
  const safeUrl = $derived(safeEntryUrl($entryState.url))
  const imageUrl = $derived(safeEntryUrl(typeof $entryState.state === 'string' ? $entryState.state : null))
  const color = $derived(colorValue($entryState.formattedState))
  const attributes = $derived(safeEntryAttributes($entryState.extraAttributes))
  const layoutStyle = $derived(entryLayoutStyle($entryState))
  const markdown = $derived(entryUsesMarkdown($entryState.properties))
  const markdownBlocks = $derived(safeMarkdownBlocks($entryState.formattedState))
  const richText = $derived(entryRichTextMetadata($entryState.properties))
  const Custom = $derived.by((): Component<SvelteCustomEntryProps> | undefined => {
    if (!$entryState.type.includes(':entry:')) return undefined
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for custom entry "${$entryState.type}".`)
    return registry.resolve<SvelteCustomEntryProps>(`entry.${$entryState.type.replaceAll(':', '.')}`, panelId, `entry "${$entryState.id}"`)
  })
  let copyStatus = $state('')
  let actionError = $state<string | null>(null)

  async function copy(): Promise<void> {
    if (!globalThis.navigator?.clipboard) {
      copyStatus = 'Copy unavailable'
      return
    }
    try {
      await globalThis.navigator.clipboard.writeText(entryText($entryState.formattedState))
      copyStatus = 'Copied'
    } catch {
      copyStatus = 'Copy failed'
    }
  }

  async function runAction(id: string): Promise<void> {
    if (!action) return
    actionError = null
    try {
      await action(id)
    } catch (cause) {
      actionError = cause instanceof Error ? cause.message : 'Action failed'
    }
  }

</script>

{#snippet content()}
  {#if Custom}
    <Custom entry={$entryState} {store} {registry} {panelId} {action} />
  {:else if $entryState.type === 'boolean' || $entryState.type === 'icon'}
    <span
      role="img"
      aria-label={$entryState.state ? 'Yes' : 'No'}
      data-icon={typeof ($entryState.type === 'icon' ? $entryState.properties.icon : $entryState.state ? $entryState.properties.truthyIcon : $entryState.properties.falsyIcon) === 'string'
        ? ($entryState.type === 'icon' ? $entryState.properties.icon : $entryState.state ? $entryState.properties.truthyIcon : $entryState.properties.falsyIcon)
        : $entryState.state ? 'check' : 'x-mark'}
    >{$entryState.state ? '✓' : '✕'}</span>
  {:else if $entryState.type === 'image' && imageUrl}
    <img
      src={imageUrl}
      alt={typeof $entryState.properties.alt === 'string' ? $entryState.properties.alt : $entryState.label ?? ''}
      class:hp-entry-image-circular={$entryState.properties.circular === true}
      width={typeof $entryState.properties.size === 'number' ? $entryState.properties.size : undefined}
      height={typeof $entryState.properties.size === 'number' ? $entryState.properties.size : undefined}
    />
  {:else if $entryState.type === 'color' && color}
    <span><span aria-hidden="true" class="hp-entry-color" style:background-color={color}></span>{color}</span>
  {:else if $entryState.type === 'code'}
    <pre data-line-numbers={$entryState.properties.lineNumbers === true || undefined}><code data-language={$entryState.properties.language}>{entryText($entryState.formattedState)}</code></pre>
  {:else if $entryState.type === 'key-value'}
    <dl aria-label={[typeof $entryState.properties.keyLabel === 'string' ? $entryState.properties.keyLabel : '', typeof $entryState.properties.valueLabel === 'string' ? $entryState.properties.valueLabel : ''].filter(Boolean).join(' / ') || undefined}>{#each objectEntries($entryState.formattedState) as [key, value] (key)}<dt>{key}</dt><dd>{entryText(value)}</dd>{/each}</dl>
  {:else if $entryState.type === 'repeatable'}
    <ol data-entry-schema={Array.isArray($entryState.properties.schema) ? $entryState.properties.schema.join(' ') : undefined}>{#each valueList($entryState.formattedState) as value, index (index)}<li>{entryText(value)}</li>{/each}</ol>
  {:else if markdown}
    <div data-entry-content="markdown">
      {#each markdownBlocks as block, blockIndex (blockIndex)}
        <p>
          {#each block.segments as segment, segmentIndex (segmentIndex)}
            {#if segment.kind === 'strong'}<strong>{segment.value}</strong>
            {:else if segment.kind === 'emphasis'}<em>{segment.value}</em>
            {:else if segment.kind === 'code'}<code>{segment.value}</code>
            {:else if segment.kind === 'link'}<a href={segment.href} rel={segment.href.startsWith('/') ? undefined : 'noopener noreferrer'}>{segment.value}</a>
            {:else}{segment.value}{/if}
          {/each}
        </p>
      {/each}
    </div>
  {:else if richText}
    <div data-entry-content="rich-text" data-sanitizer={richText.sanitizer}>{entryText($entryState.formattedState)}</div>
  {:else if $entryState.properties.badge === true}
    <span class="hp-entry-badge">{entryText($entryState.formattedState) || $entryState.placeholder || ''}</span>
  {:else}
    {entryText($entryState.formattedState) || $entryState.placeholder || ''}
  {/if}
{/snippet}

{#if $entryState.visible !== false}
<section
  {...attributes}
  aria-labelledby={$entryState.label ? `${$entryState.id}-label` : undefined}
  class:hp-entry-inline={$entryState.inlineLabel}
  class={`hp-entry ${typeof attributes.class === 'string' ? attributes.class : typeof attributes.className === 'string' ? attributes.className : ''}`}
  data-panels-entry={$entryState.id}
  style={layoutStyle}
  title={$entryState.tooltip ?? undefined}
>
  <EntrySlot entry={$entryState} {panelId} placement="above" {registry} />
  {#if $entryState.label}<h3 id={`${$entryState.id}-label`}>{$entryState.label}</h3>{/if}
  <EntrySlot entry={$entryState} {panelId} placement="before" {registry} />
  <div class="hp-entry-state">
    {#if safeUrl}
      <a href={safeUrl} rel={safeUrl.startsWith('/') ? undefined : 'noopener noreferrer'}>{@render content()}</a>
    {:else}
      {@render content()}
    {/if}
  </div>
  <EntrySlot entry={$entryState} {panelId} placement="after" {registry} />
  {#if $entryState.copyable}<button type="button" onclick={() => void copy()}>Copy</button>{/if}
  {#each $entryState.actions as entryAction (entryAction)}
    <button type="button" disabled={$entryState.pending || !action} onclick={() => void runAction(entryAction)}>{entryAction}</button>
  {/each}
  <span aria-live="polite" class="hp-visually-hidden">{copyStatus}</span>
  {#if $entryState.pending}<span role="status">Loading entry</span>{/if}
  {#if $entryState.error}<span role="alert">{$entryState.error}</span>{/if}
  {#if actionError}<span role="alert">{actionError}</span>{/if}
  <EntrySlot entry={$entryState} {panelId} placement="below" {registry} />
</section>
{/if}
