<script lang="ts" generics="TRecord extends object">
  import { usePanelLocale, usePanelTranslator } from '../localization'
  import Copy from 'lucide-svelte/icons/copy'
  import { Badge } from '../ui/badge'
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import { rendererRegistryName, type ExtensionTypeId } from '@holo-js/panels-client'
  import type { SvelteComponentRegistry } from '../registry'
  import type { SvelteCustomColumnProps, SvelteTableColumn, SvelteTableColumnPath, SvelteTableColumnValue } from './types'
  import { formattedTableValue, safeTableColor, safeTableUrl, tableFormatters, tableIconName } from './presentation'

  let { column, locale: localeOverride, panelId, record, registry, value }: {
    readonly locale?: string
    readonly column: SvelteTableColumn<TRecord>
    readonly panelId?: string
    readonly record: Readonly<TRecord>
    readonly registry?: SvelteComponentRegistry
    readonly value: unknown
  } = $props()
  const inheritedLocale = usePanelLocale()
  const locale = () => localeOverride ?? inheritedLocale()
  const translate = usePanelTranslator(locale)
  let copyStatus = $state('')
  const inferredValue = $derived(value as SvelteTableColumnValue<TRecord, SvelteTableColumnPath<TRecord>>)
  const formatters = $derived(tableFormatters(column.manifest))
  const formatted = $derived(formattedTableValue(value, formatters, locale()))
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
    if (!globalThis.navigator?.clipboard) {
      copyStatus = translate('copy.unavailable')
      return
    }
    try {
      await globalThis.navigator.clipboard.writeText(formatted)
      copyStatus = translate('copy.copied')
    } catch {
      copyStatus = translate('copy.failed')
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
    <span role="img" aria-label={translate(active ? 'filters.yes' : 'filters.no')} data-icon={tableIconName(formatters, active)}>{active ? '✓' : '✕'}</span>
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
    <Checkbox aria-label={column.manifest.label ?? column.manifest.path} checked={value === true} disabled />
  {:else if badge}
    <Badge class="hp-table-badge" variant="secondary"><span style={contentStyle}>{formatted}</span></Badge>
  {:else}
    <span style={contentStyle}>{formatted}</span>
  {/if}
{/snippet}

{#if column.manifest.copyable && !column.manifest.inlineEditor}
  <span class="hp-table-cell" title={typeof tooltip === 'string' ? tooltip : undefined}>{#if url}<a href={url} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>{@render content()}</a>{:else}{@render content()}{/if}<Button class="hp-table-copy" size="icon" variant="ghost" type="button" aria-label={translate('copy.label', { label: column.manifest.label ?? column.manifest.path })} onclick={() => void copy()}><Copy aria-hidden="true" data-icon="copy" data-slot="icon" /></Button><span aria-live="polite" class="hp-visually-hidden">{copyStatus}</span></span>
{:else}
  <span title={typeof tooltip === 'string' ? tooltip : undefined}>{#if url}<a href={url} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>{@render content()}</a>{:else}{@render content()}{/if}</span>
{/if}
