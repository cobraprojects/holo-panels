<script lang="ts">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Table from '../components/Table.svelte'
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
  let root = $state<HTMLElement>()

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
  <section bind:this={root} aria-busy={$widgetState.loading} aria-labelledby={`${manifest.id}-heading`} class="hp-widget" data-panels-widget={manifest.id} data-placement={placement} data-slot="card" data-widget-family={manifest.family}>
    <header data-slot="card-header">
      <h2 data-slot="card-title" id={`${manifest.id}-heading`}>{widgetLabel(manifest)}</h2>
      {#if manifest.description}<p data-slot="card-description">{manifest.description}</p>{/if}
    </header>
    {#if $widgetState.status === 'unauthorized'}
      <p role="status">Widget unavailable</p>
    {:else if $widgetState.status === 'error'}
      <p role="alert">{$widgetState.error ?? manifest.errorState}</p>
      <Button type="button" onclick={() => void store.load()}>Retry</Button>
    {:else if $widgetState.loading || $widgetState.status === 'idle'}
      <p aria-live="polite" role="status">Loading widget</p>
    {:else if manifest.family === 'stats'}
      {#if stats.length === 0}<p>{manifest.emptyState}</p>{/if}
      <dl class="hp-widget-stats">
        {#each stats as stat (stat.id)}
          {@const appearance = panelColorAppearance(stat.color)}
          <div
            class="hp-widget-stat"
            data-color={appearance.attribute}
            data-trend={stat.trend}
            style={appearance.custom ? `--hp-widget-color: ${appearance.custom}` : undefined}
          >
            <dt class="hp-widget-stat-label">{#if stat.icon}<span aria-hidden="true" data-icon={stat.icon}></span>{/if}{stat.label}</dt>
            <dd class="hp-widget-stat-value">{stat.value}</dd>
            {#if stat.description}<dd class="hp-widget-stat-description">{stat.description}</dd>{/if}
            {#if stat.trend}<dd aria-label={`Trend ${stat.trend}`} class="hp-widget-stat-trend hp-widget-stat-trend-${stat.trend}">{stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}</dd>{/if}
            {#if stat.chart.length > 0}<dd><span aria-label={`${stat.label} trend: ${stat.chart.join(', ')}`} class="hp-widget-sparkline" role="img">{stat.chart.join(' · ')}</span></dd>{/if}
            {#if stat.action}<dd><Button type="button" data-action={stat.action} onclick={() => void onAction?.(stat.action!, manifest.id)}>{stat.action}</Button></dd>{/if}
            {#if safeWidgetUrl(stat.url)}<dd><a href={safeWidgetUrl(stat.url) ?? undefined}>View {stat.label}</a></dd>{/if}
          </div>
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
          <Table aria-describedby={`${manifest.id}-chart-description`}><caption>{chart.summary}</caption><thead><tr><th scope="col">Label</th>{#each chart.series as series (series.id)}<th scope="col">{series.label}</th>{/each}</tr></thead><tbody>{#each chartLabels(chart) as label (label)}<tr><th scope="row">{label}</th>{#each chart.series as series (series.id)}<td>{chartValue(series, label) ?? '—'}</td>{/each}</tr>{/each}</tbody></Table>
        </figure>
      {:else}<p>{manifest.emptyState}</p>{/if}
    {:else if manifest.family === 'table'}
      {#if table && tableRenderer}{@const Table = tableRenderer}<Table result={table.result} tableId={table.tableId} widgetId={manifest.id} />{:else}<p>{manifest.emptyState}</p>{/if}
    {:else if manifest.family === 'custom'}
      {#if custom && Custom}<Custom properties={custom.properties} widgetId={manifest.id} />{:else}<p>{manifest.emptyState}</p>{/if}
    {/if}
    {#if manifest.filters.length > 0}
      <form aria-label={`${widgetLabel(manifest)} filters`} onsubmit={(event) => event.preventDefault()}>{#each manifest.filters as filter (filter.id)}<label>{filter.label}<Input value={String($widgetState.filters[filter.id] ?? '')} onchange={(event) => void store.setFilter(filter.id, event.currentTarget.value)} /></label>{/each}</form>
    {/if}
  </section>
{/if}
