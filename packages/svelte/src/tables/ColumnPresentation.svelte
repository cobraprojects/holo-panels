<script lang="ts" generics="TRecord extends object">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import { rendererRegistryName, type ExtensionTypeId } from '@holo-js/panels-client'
  import type { SvelteComponentRegistry } from '../registry'
  import type { SvelteCustomColumnProps, SvelteTableColumn, SvelteTableColumnPath, SvelteTableColumnValue } from './types'
  import { formattedTableValue, safeTableColor, safeTableUrl, tableFormatters, tableIconName } from './presentation'

  let { column, panelId, record, registry, value }: {
    readonly column: SvelteTableColumn<TRecord>
    readonly panelId?: string
    readonly record: Readonly<TRecord>
    readonly registry?: SvelteComponentRegistry
    readonly value: unknown
  } = $props()
  let copyStatus = $state('')
  const inferredValue = $derived(value as SvelteTableColumnValue<TRecord, SvelteTableColumnPath<TRecord>>)
  const formatters = $derived(tableFormatters(column.manifest))
  const formatted = $derived(formattedTableValue(value, formatters))
  const rendered = $derived(column.render?.(inferredValue, record))
  const tooltip = $derived(formatters.find(formatter => formatter.kind === 'tooltip')?.value)
  const url = $derived(safeTableUrl(column.url?.(record)) ?? safeTableUrl(formatters.find(formatter => formatter.kind === 'url')?.value))
  const badge = $derived(column.manifest.type === 'badge' || formatters.some(formatter => formatter.kind === 'badge' && formatter.value !== false))
  const lineClamp = $derived(Reflect.get(column.manifest, 'lineClamp'))
  const contentStyle = $derived(Number.isSafeInteger(lineClamp) && Number(lineClamp) > 0 ? `-webkit-box-orient: vertical; -webkit-line-clamp: ${Number(lineClamp)}; display: -webkit-box; overflow: hidden` : undefined)
  const custom = $derived(column.manifest.type.includes(':column:'))
  const customConfiguration = $derived(formatters.find(formatter => formatter.kind === 'custom')?.configuration)
  const customProperties = $derived(customConfiguration !== null && typeof customConfiguration === 'object' && !Array.isArray(customConfiguration) ? customConfiguration : {})
  const CustomRenderer = $derived(custom && registry
    ? registry.resolve<SvelteCustomColumnProps<TRecord>>(rendererRegistryName('column', column.manifest.type as ExtensionTypeId<'column'>), panelId, `column "${column.manifest.path}"`)
    : null)

  async function copy(): Promise<void> {
    try {
      await globalThis.navigator?.clipboard?.writeText(formatted)
      copyStatus = 'Copied'
    } catch {
      copyStatus = 'Copy failed'
    }
  }
</script>

{#snippet content()}
  {#if column.render}
    {rendered}
  {:else if custom}
    {#if !registry}
      {@const missing = (() => { throw new Error(`[Holo Panels] A Svelte component registry is required for custom column "${column.manifest.type}".`) })()}
      {missing}
    {:else if CustomRenderer}
      <CustomRenderer {...customProperties} {column} {record} value={inferredValue} />
    {/if}
  {:else if column.manifest.type === 'boolean' || column.manifest.type === 'icon'}
    {@const active = Boolean(value)}
    <span role="img" aria-label={active ? 'Yes' : 'No'} data-icon={tableIconName(formatters, active)}>{active ? '✓' : '✕'}</span>
  {:else if column.manifest.type === 'image'}
    {@const source = safeTableUrl(value)}
    {@const size = formatters.find(formatter => formatter.kind === 'size')?.pixels}
    {@const pixels = Number.isSafeInteger(size) && Number(size) > 0 && Number(size) <= 2048 ? Number(size) : undefined}
    {@const circular = formatters.some(formatter => formatter.kind === 'circular' && formatter.value !== false)}
    {#if source}<img alt={column.manifest.label ?? ''} height={pixels} loading="lazy" src={source} width={pixels} style:border-radius={circular ? '9999px' : undefined} />{:else}—{/if}
  {:else if column.manifest.type === 'color'}
    {@const color = safeTableColor(value)}
    {#if color}<span><span aria-hidden="true" class="hp-table-color" style:background-color={color}></span>{color}</span>{:else}{formatted}{/if}
  {:else if (column.manifest.type === 'checkbox' || column.manifest.type === 'toggle') && !column.manifest.inlineEditor}
    <Input aria-label={column.manifest.label ?? column.manifest.path} checked={value === true} disabled readonly type="checkbox" />
  {:else if badge}
    <span class="hp-table-badge"><span style={contentStyle}>{formatted}</span></span>
  {:else}
    <span style={contentStyle}>{formatted}</span>
  {/if}
{/snippet}

{#if column.manifest.copyable && !column.manifest.inlineEditor}
  <span title={typeof tooltip === 'string' ? tooltip : undefined}>{#if url}<a href={url} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>{@render content()}</a>{:else}{@render content()}{/if}<Button type="button" aria-label="Copy {column.manifest.label ?? column.manifest.path}" onclick={() => void copy()}>Copy</Button><span aria-live="polite" class="hp-visually-hidden">{copyStatus}</span></span>
{:else}
  <span title={typeof tooltip === 'string' ? tooltip : undefined}>{#if url}<a href={url} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>{@render content()}</a>{:else}{@render content()}{/if}</span>
{/if}
