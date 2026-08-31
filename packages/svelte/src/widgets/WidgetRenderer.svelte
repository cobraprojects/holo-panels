<script lang="ts">
  import { Button } from '../ui/button'
  import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
  import { Field, FieldGroup, FieldLabel } from '../ui/field'
  import { Input } from '../ui/input'
  import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
  import { panelColorAppearance, panelColorValue, widgetChartMarks, widgetSparklinePoints } from '@holo-js/panels-ui'
  import { type Component } from 'svelte'
  import { widgetExtensionRendererName } from '@holo-js/panels-client'
  import { toSvelteSnapshot } from '../stores'
  import Icon from '../components/Icon.svelte'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import TableRenderer from '../tables/TableRenderer.svelte'
  import type { SvelteCustomWidgetProps, SvelteWidgetRendererProps } from './contracts'
  import { chartData, chartLabels, chartValue, customData, safeWidgetUrl, statsData, tableData, widgetLabel } from './helpers'

  let { actions, actionStore, manifest, store, registry, panelId, placement = 'dashboard', tableRenderer, tableController, onAction }: SvelteWidgetRendererProps = $props()
  const widgetState = $derived.by(() => toSvelteSnapshot(store))
  const stats = $derived(statsData($widgetState.data))
  const chart = $derived(chartData($widgetState.data))
  const table = $derived(tableData($widgetState.data))
  const custom = $derived(customData($widgetState.data))
  const Custom = $derived.by((): Component<SvelteCustomWidgetProps> | undefined => {
    if (manifest.family !== 'custom' || !custom) return undefined
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for custom widget "${manifest.id}".`)
    return registry.resolve<SvelteCustomWidgetProps>(widgetExtensionRendererName(manifest.type) ?? custom.component, panelId, `widget "${manifest.id}"`)
  })
  let root = $state<HTMLElement | null>(null)

  $effect(() => {
    if (!manifest.lazy) {
      void store.activate()
      return () => store.stop()
    }
    if (!root || !globalThis.IntersectionObserver) {
      void store.activate()
      return () => store.stop()
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      void store.activate()
    })
    observer.observe(root)
    return () => {
      observer.disconnect()
      store.stop()
    }
  })
</script>

{#if $widgetState.status !== 'hidden'}
  <Card bind:ref={root} aria-busy={$widgetState.loading} aria-labelledby={`${manifest.id}-heading`} class="hp-widget" data-panels-widget={manifest.id} data-placement={placement} data-widget-family={manifest.family}>
    <CardHeader>
      {#if $widgetState.status === 'ready' && actions?.[0] && actionStore}<ActionRenderer action={actions[0]} {actions} {panelId} {registry} store={actionStore} />{/if}
      <CardTitle id={`${manifest.id}-heading`}>{widgetLabel(manifest)}</CardTitle>
      {#if manifest.description}<CardDescription>{manifest.description}</CardDescription>{/if}
    </CardHeader>
    <CardContent>
    {#if $widgetState.status === 'unauthorized'}
      <Empty role="status"><EmptyHeader><EmptyTitle>Widget unavailable</EmptyTitle><EmptyDescription>You do not have access to this widget.</EmptyDescription></EmptyHeader></Empty>
    {:else if $widgetState.status === 'error'}
      <Alert variant="destructive"><AlertTitle>{manifest.errorState}</AlertTitle><AlertDescription>The widget could not be loaded.</AlertDescription><Button type="button" onclick={() => void store.load()}>Retry</Button></Alert>
    {:else if $widgetState.loading && $widgetState.data === null || $widgetState.status === 'idle'}
      <p aria-live="polite" class="hp:text-sm hp:text-muted-foreground" role="status">Loading widget</p>
    {:else if manifest.family === 'stats'}
      {#if stats.length === 0}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
      <dl class="hp-widget-stats hp:grid hp:gap-4 hp:sm:grid-cols-2 hp:xl:grid-cols-4">
        {#each stats as stat (stat.id)}
          {@const appearance = panelColorAppearance(stat.color)}
          <Card
            class="hp-widget-stat"
            data-color={appearance.attribute}
            data-trend={stat.trend}
            style={`color: ${panelColorValue(stat.color) ?? 'inherit'}; --hp-widget-color: ${appearance.custom ?? 'inherit'}`}
          >
            <CardHeader>{#if stat.icon}<Icon name={stat.icon} />{/if}<dt><CardDescription class="hp-widget-stat-label">{stat.label}</CardDescription></dt><dd><CardTitle class="hp-widget-stat-value hp:text-2xl">{stat.value}</CardTitle></dd></CardHeader>
            <CardContent>
              {#if stat.description}<dd class="hp-widget-stat-description hp:text-sm hp:text-muted-foreground">{stat.description}</dd>{/if}
              {#if stat.trend}<dd aria-label={`Trend ${stat.trend}`} class="hp-widget-stat-trend hp-widget-stat-trend-${stat.trend}">{stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}</dd>{/if}
              {@const points = widgetSparklinePoints(stat.chart)}
              {#if points}<dd><svg aria-label={`${stat.label} trend: ${stat.chart.join(', ')}`} class="hp-widget-sparkline hp:h-8 hp:w-full" role="img" viewBox="0 0 100 32"><polyline fill="none" {points} stroke="currentColor" vector-effect="non-scaling-stroke" /></svg></dd>{/if}
              {#if stat.progress}<dd><progress aria-label={stat.label} class="hp-widget-progress hp:w-full" value={stat.progress.value} max={stat.progress.max}>{stat.progress.value} / {stat.progress.max}</progress></dd>{/if}
            </CardContent>
            {#if stat.action || safeWidgetUrl(stat.url)}
              <CardFooter>
                {#if stat.action && actionStore}
                  {@const action = actions?.find(candidate => candidate.id === stat.action && candidate.visible)}
                  {#if action}<dd><Button disabled={action.disabled} type="button" data-action={action.id} onclick={() => actionStore?.mount(action)}>{action.label}</Button></dd>{/if}
                {:else if stat.action}
                  <dd><Button type="button" data-action={stat.action} onclick={() => void onAction?.(stat.action!, manifest.id)}>{stat.action}</Button></dd>
                {/if}
                {#if safeWidgetUrl(stat.url)}<dd><Button href={safeWidgetUrl(stat.url) ?? undefined} variant="outline">View {stat.label}</Button></dd>{/if}
              </CardFooter>
            {/if}
          </Card>
        {/each}
      </dl>
    {:else if manifest.family === 'chart'}
      {#if chart}
        <figure data-chart-type={chart.type}>
          <figcaption>{chart.summary}</figcaption>
          <svg aria-labelledby={`${manifest.id}-chart-title ${manifest.id}-chart-description`} class="hp-widget-chart hp:h-48 hp:w-full" role="img" viewBox="0 0 100 100">
            <title id={`${manifest.id}-chart-title`}>{chart.summary}</title>
            <desc>{chart.description}</desc>
            <g data-chart-geometry={chart.type}>
              {#each widgetChartMarks(chart) as mark (mark.key)}
                <path d={mark.path} data-chart-mark={mark.kind} data-series={mark.series} data-label={mark.label} fill={mark.kind === 'line' ? 'none' : mark.color} fill-opacity={mark.opacity} stroke={mark.kind === 'line' ? mark.color : undefined} vector-effect="non-scaling-stroke" />
              {/each}
            </g>
          </svg>
          <p id={`${manifest.id}-chart-description`}>{chart.description}</p>
          <Table aria-describedby={`${manifest.id}-chart-description`}><TableCaption>{chart.summary}</TableCaption><TableHeader><TableRow><TableHead scope="col">Label</TableHead>{#each chart.series as series (series.id)}<TableHead scope="col">{series.label}</TableHead>{/each}</TableRow></TableHeader><TableBody>{#each chartLabels(chart) as label (label)}<TableRow><TableHead scope="row">{label}</TableHead>{#each chart.series as series (series.id)}<TableCell>{chartValue(series, label) ?? '—'}</TableCell>{/each}</TableRow>{/each}</TableBody></Table>
        </figure>
      {:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {:else if manifest.family === 'table'}
      {@const presentation = table && tableController?.presentation}
      {#if presentation}<TableRenderer table={{ ...presentation, registry, emptyMessage: manifest.emptyState }} />{:else if table && tableRenderer}{@const CustomTableRenderer = tableRenderer}<CustomTableRenderer result={table.result} tableId={table.tableId} widgetId={manifest.id} />{:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {:else if manifest.family === 'custom'}
      {#if custom && Custom}<Custom properties={custom.properties} widgetId={manifest.id} />{:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {/if}
    </CardContent>
    {#if manifest.filters.length > 0}
      <CardFooter><form class="hp:w-full" aria-label={`${widgetLabel(manifest)} filters`} onsubmit={(event) => event.preventDefault()}><FieldGroup>{#each manifest.filters as filter (filter.id)}<Field><FieldLabel for={`${manifest.id}-${filter.id}`}>{filter.label}</FieldLabel><Input id={`${manifest.id}-${filter.id}`} value={String($widgetState.filters[filter.id] ?? '')} onchange={(event) => void store.setFilter(filter.id, event.currentTarget.value)} /></Field>{/each}</FieldGroup></form></CardFooter>
    {/if}
  </Card>
{/if}
