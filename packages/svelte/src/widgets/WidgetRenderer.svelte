<script lang="ts">
  import { Button } from '../ui/button'
  import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
  import { Field, FieldGroup, FieldLabel } from '../ui/field'
  import { Input } from '../ui/input'
  import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
  import { panelColorAppearance } from '@holo-js/panels-ui'
  import { onMount, type Component } from 'svelte'
  import { toSvelteSnapshot } from '../stores'
  import type { SvelteCustomWidgetProps, SvelteWidgetRendererProps } from './contracts'
  import { chartData, chartLabels, chartValue, customData, safeWidgetUrl, statsData, tableData, type SvelteChartData, type SvelteChartSeries, widgetLabel } from './helpers'

  interface ChartBar {
    readonly height: number
    readonly label: string
    readonly series: SvelteChartSeries
    readonly width: number
    readonly x: number
    readonly y: number
  }

  interface PieSlice {
    readonly label: string
    readonly opacity: number
    readonly path: string
    readonly series: SvelteChartSeries
  }

  function chartBounds(data: SvelteChartData): { readonly maximum: number, readonly minimum: number } {
    const values = data.series.flatMap(series => series.points.map(point => point.value))
    return {
      maximum: Math.max(0, ...values),
      minimum: Math.min(0, ...values),
    }
  }

  function chartY(value: number, data: SvelteChartData): number {
    const { maximum, minimum } = chartBounds(data)
    return 30 - ((value - minimum) / (maximum - minimum || 1)) * 28
  }

  function chartPoints(series: SvelteChartSeries, data: SvelteChartData): string {
    const last = Math.max(series.points.length - 1, 1)
    return series.points.map((point, index) => `${(index / last) * 100},${chartY(point.value, data)}`).join(' ')
  }

  function areaPoints(series: SvelteChartSeries, data: SvelteChartData): string {
    if (series.points.length === 0) return ''
    const lastX = series.points.length === 1 ? 0 : 100
    const baseline = chartY(0, data)
    return `0,${baseline} ${chartPoints(series, data)} ${lastX},${baseline}`
  }

  function chartBars(data: SvelteChartData): readonly ChartBar[] {
    const labels = chartLabels(data)
    if (labels.length === 0 || data.series.length === 0) return []
    const slotWidth = 100 / labels.length
    const groupWidth = slotWidth * 0.8
    const width = groupWidth / data.series.length
    const baseline = chartY(0, data)
    return labels.flatMap((label, labelIndex) => data.series.flatMap((series, seriesIndex) => {
      const value = chartValue(series, label)
      if (value === null) return []
      const valueY = chartY(value, data)
      return [{
        height: Math.max(Math.abs(baseline - valueY), 0.2),
        label,
        series,
        width,
        x: labelIndex * slotWidth + slotWidth * 0.1 + seriesIndex * width,
        y: Math.min(baseline, valueY),
      }]
    }))
  }

  function piePath(centerX: number, centerY: number, radius: number, start: number, end: number): string {
    const startX = centerX + radius * Math.cos(start)
    const startY = centerY + radius * Math.sin(start)
    if (end - start >= Math.PI * 2 - Number.EPSILON) {
      return `M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`
    }
    const endX = centerX + radius * Math.cos(end)
    const endY = centerY + radius * Math.sin(end)
    const largeArc = end - start > Math.PI ? 1 : 0
    return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`
  }

  function pieSlices(data: SvelteChartData): readonly PieSlice[] {
    const pieWidth = 100 / Math.max(data.series.length, 1)
    const radius = Math.min(14, pieWidth * 0.4)
    return data.series.flatMap((series, seriesIndex) => {
      const values = series.points.map(point => Math.max(point.value, 0))
      const total = values.reduce((sum, value) => sum + value, 0)
      if (total === 0) return []
      let angle = -Math.PI / 2
      return series.points.map((point, pointIndex) => {
        const start = angle
        angle += (values[pointIndex]! / total) * Math.PI * 2
        return {
          label: point.label,
          opacity: Math.max(0.3, 1 - pointIndex / Math.max(series.points.length, 1)),
          path: piePath(seriesIndex * pieWidth + pieWidth / 2, 16, radius, start, angle),
          series,
        }
      })
    })
  }

  let { manifest, store, registry, panelId, placement = 'dashboard', tableRenderer, onAction }: SvelteWidgetRendererProps = $props()
  const widgetState = $derived.by(() => toSvelteSnapshot(store))
  const stats = $derived(statsData($widgetState.data))
  const chart = $derived(chartData($widgetState.data))
  const table = $derived(tableData($widgetState.data))
  const custom = $derived(customData($widgetState.data))
  const Custom = $derived.by((): Component<SvelteCustomWidgetProps> | undefined => {
    if (manifest.family !== 'custom' || !custom) return undefined
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for custom widget "${manifest.id}".`)
    return registry.resolve<SvelteCustomWidgetProps>(custom.component, panelId, `widget "${manifest.id}"`)
  })
  let root = $state<HTMLElement | null>(null)

  onMount(() => {
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
      <CardTitle id={`${manifest.id}-heading`}>{widgetLabel(manifest)}</CardTitle>
      {#if manifest.description}<CardDescription>{manifest.description}</CardDescription>{/if}
    </CardHeader>
    <CardContent>
    {#if $widgetState.status === 'unauthorized'}
      <Empty role="status"><EmptyHeader><EmptyTitle>Widget unavailable</EmptyTitle><EmptyDescription>You do not have access to this widget.</EmptyDescription></EmptyHeader></Empty>
    {:else if $widgetState.status === 'error'}
      <Alert variant="destructive"><AlertTitle>{$widgetState.error ?? manifest.errorState}</AlertTitle><AlertDescription>The widget could not be loaded.</AlertDescription><Button type="button" onclick={() => void store.load()}>Retry</Button></Alert>
    {:else if $widgetState.loading || $widgetState.status === 'idle'}
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
            style={appearance.custom ? `--hp-widget-color: ${appearance.custom}` : undefined}
          >
            <CardHeader><dt><CardDescription class="hp-widget-stat-label">{stat.label}</CardDescription></dt><dd><CardTitle class="hp-widget-stat-value hp:text-2xl">{stat.value}</CardTitle></dd></CardHeader>
            <CardContent>
              {#if stat.description}<dd class="hp-widget-stat-description hp:text-sm hp:text-muted-foreground">{stat.description}</dd>{/if}
              {#if stat.trend}<dd aria-label={`Trend ${stat.trend}`} class="hp-widget-stat-trend hp-widget-stat-trend-${stat.trend}">{stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}</dd>{/if}
              {#if stat.chart.length > 0}<dd><span aria-label={`${stat.label} trend: ${stat.chart.join(', ')}`} class="hp-widget-sparkline" role="img">{stat.chart.join(' · ')}</span></dd>{/if}
            </CardContent>
            {#if stat.action || safeWidgetUrl(stat.url)}<CardFooter>{#if stat.action}<dd><Button type="button" data-action={stat.action} onclick={() => void onAction?.(stat.action!, manifest.id)}>{stat.action}</Button></dd>{/if}{#if safeWidgetUrl(stat.url)}<dd><Button href={safeWidgetUrl(stat.url) ?? undefined} variant="outline">View {stat.label}</Button></dd>{/if}</CardFooter>{/if}
          </Card>
        {/each}
      </dl>
    {:else if manifest.family === 'chart'}
      {#if chart}
        <figure data-chart-type={chart.type}>
          <figcaption>{chart.summary}</figcaption>
          <svg aria-labelledby={`${manifest.id}-chart-title ${manifest.id}-chart-description`} class="hp-widget-chart" role="img" viewBox="0 0 100 32">
            <title id={`${manifest.id}-chart-title`}>{chart.summary}</title>
            <desc>{chart.description}</desc>
            {#if chart.type === 'line'}
              <g data-chart-geometry="line">{#each chart.series as series (series.id)}<polyline data-series={series.id} fill="none" points={chartPoints(series, chart)} stroke={series.color ?? 'currentColor'} vector-effect="non-scaling-stroke" />{/each}</g>
            {:else if chart.type === 'area'}
              <g data-chart-geometry="area">{#each chart.series as series (series.id)}<polygon data-series={series.id} fill={series.color ?? 'currentColor'} fill-opacity="0.25" points={areaPoints(series, chart)} /><polyline fill="none" points={chartPoints(series, chart)} stroke={series.color ?? 'currentColor'} vector-effect="non-scaling-stroke" />{/each}</g>
            {:else if chart.type === 'bar'}
              <g data-chart-geometry="bar">{#each chartBars(chart) as bar (`${bar.series.id}:${bar.label}`)}<rect data-label={bar.label} data-series={bar.series.id} fill={bar.series.color ?? 'currentColor'} height={bar.height} width={bar.width} x={bar.x} y={bar.y} />{/each}</g>
            {:else}
              <g data-chart-geometry="pie">{#each pieSlices(chart) as slice (`${slice.series.id}:${slice.label}`)}<path data-label={slice.label} data-series={slice.series.id} d={slice.path} fill={slice.series.color ?? 'currentColor'} fill-opacity={slice.opacity} />{/each}</g>
            {/if}
          </svg>
          <p id={`${manifest.id}-chart-description`}>{chart.description}</p>
          <Table aria-describedby={`${manifest.id}-chart-description`}><TableCaption>{chart.summary}</TableCaption><TableHeader><TableRow><TableHead scope="col">Label</TableHead>{#each chart.series as series (series.id)}<TableHead scope="col">{series.label}</TableHead>{/each}</TableRow></TableHeader><TableBody>{#each chartLabels(chart) as label (label)}<TableRow><TableHead scope="row">{label}</TableHead>{#each chart.series as series (series.id)}<TableCell>{chartValue(series, label) ?? '—'}</TableCell>{/each}</TableRow>{/each}</TableBody></Table>
        </figure>
      {:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {:else if manifest.family === 'table'}
      {#if table && tableRenderer}{@const TableRenderer = tableRenderer}<TableRenderer result={table.result} tableId={table.tableId} widgetId={manifest.id} />{:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {:else if manifest.family === 'custom'}
      {#if custom && Custom}<Custom properties={custom.properties} widgetId={manifest.id} />{:else}<Empty><EmptyHeader><EmptyTitle>{manifest.emptyState}</EmptyTitle></EmptyHeader></Empty>{/if}
    {/if}
    </CardContent>
    {#if manifest.filters.length > 0}
      <CardFooter><form class="hp:w-full" aria-label={`${widgetLabel(manifest)} filters`} onsubmit={(event) => event.preventDefault()}><FieldGroup>{#each manifest.filters as filter (filter.id)}<Field><FieldLabel for={`${manifest.id}-${filter.id}`}>{filter.label}</FieldLabel><Input id={`${manifest.id}-${filter.id}`} value={String($widgetState.filters[filter.id] ?? '')} onchange={(event) => void store.setFilter(filter.id, event.currentTarget.value)} /></Field>{/each}</FieldGroup></form></CardFooter>
    {/if}
  </Card>
{/if}
