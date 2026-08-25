import {
  Fragment,
  createElement,
  useEffect,
  useId,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { panelColorAppearance } from '@holo-js/panels-ui'
import {
  createAccessibleChartModel,
  resolveWidgetGrid,
  type ChartWidgetData,
  type CustomWidgetData,
  type JsonObject,
  type StatsWidgetData,
  type TableWidgetData,
  type WidgetClientState,
  type WidgetGridPlacement,
  type WidgetStat,
} from '@holo-js/panels-client'
import { Button, Input } from '../internal-ui'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui'
import type {
  ReactCustomWidgetProps,
  ReactDashboardRendererProps,
  ReactResourceWidgetsProps,
  ReactWidgetRendererProps,
} from './types'

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatsData(value: unknown): value is StatsWidgetData {
  return isObject(value) && Array.isArray(value.stats)
}

function isChartData(value: unknown): value is ChartWidgetData {
  return isObject(value)
    && typeof value.description === 'string'
    && Array.isArray(value.series)
    && typeof value.summary === 'string'
    && ['area', 'bar', 'line', 'pie'].includes(String(value.type))
}

function isTableData(value: unknown): value is TableWidgetData {
  return isObject(value) && isObject(value.result) && typeof value.tableId === 'string'
}

function isCustomData(value: unknown): value is CustomWidgetData {
  return isObject(value) && typeof value.component === 'string' && isObject(value.properties)
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.startsWith('/')) return trimmed.startsWith('//') ? null : trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function Sparkline({ stat }: { readonly stat: WidgetStat }): ReactNode {
  if (stat.chart.length < 2 || stat.chart.some(value => !Number.isFinite(value))) return null
  const minimum = Math.min(...stat.chart)
  const maximum = Math.max(...stat.chart)
  const range = maximum - minimum || 1
  const points = stat.chart.map((value, index) => {
    const x = index * 100 / (stat.chart.length - 1)
    const y = 28 - ((value - minimum) / range) * 24
    return `${x},${y}`
  }).join(' ')
  return <svg aria-hidden="true" className="hp-widget-sparkline hp:mt-4 hp:h-8 hp:w-full hp:text-primary" preserveAspectRatio="none" viewBox="0 0 100 32">
    <polyline fill="none" points={points} stroke="currentColor" vectorEffect="non-scaling-stroke" />
  </svg>
}

function StatContent({ action, navigate, stat }: {
  readonly action?: ReactWidgetRendererProps['action']
  readonly navigate?: ReactWidgetRendererProps['navigate']
  readonly stat: WidgetStat
}): ReactNode {
  const content = <Card className="hp-widget-stat"><CardHeader className="hp:flex hp:flex-row hp:items-center hp:justify-between hp:space-y-0 hp:pb-2"><CardTitle className="hp:text-sm hp:font-medium">{stat.label}</CardTitle>{stat.icon ? <span aria-hidden="true" className="hp:text-muted-foreground" data-icon={stat.icon} /> : null}</CardHeader><CardContent><div className="hp:text-2xl hp:font-bold">{stat.value}</div>{stat.description ? <p className="hp:text-xs hp:text-muted-foreground">{stat.description}</p> : null}{stat.trend ? <p className="hp:text-xs hp:text-muted-foreground">{stat.trend}</p> : null}<Sparkline stat={stat} /></CardContent></Card>
  const url = stat.url ? safeUrl(stat.url) : null
  if (url) {
    return <a href={url} onClick={navigate ? event => {
      event.preventDefault()
      navigate(url)
    } : undefined}>{content}</a>
  }
  const statAction = stat.action
  if (statAction && action) return <Button onClick={() => void action(statAction)} type="button">{content}</Button>
  return content
}

function StatsWidget({ data, props }: { readonly data: StatsWidgetData, readonly props: ReactWidgetRendererProps }): ReactNode {
  if (data.stats.length === 0) return <p>{props.manifest.emptyState}</p>
  return <ul className="hp-widget-stats hp:grid hp:gap-4 hp:md:grid-cols-2 hp:lg:grid-cols-4">{data.stats.map(stat => {
    const appearance = panelColorAppearance(stat.color)
    const style = appearance.custom
      ? { '--hp-widget-color': appearance.custom } as CSSProperties
      : undefined
    return <li
      className="hp-widget-stat"
      data-color={appearance.attribute}
      key={stat.id}
      style={style}
    >
      <StatContent action={props.action} navigate={props.navigate} stat={stat} />
    </li>
  })}</ul>
}

interface ChartScale {
  readonly baseline: number
  readonly count: number
  readonly y: (value: number) => number
}

type ChartSeries = ChartWidgetData['series'][number]

function chartScale(data: ChartWidgetData): ChartScale {
  const values = data.series.flatMap(series => series.points.map(point => point.value))
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values)
  const range = maximum - minimum || 1
  const count = Math.max(2, ...data.series.map(series => series.points.length))
  const y = (value: number): number => 96 - ((value - minimum) / range) * 92
  return { baseline: y(0), count, y }
}

function seriesPath(series: ChartSeries, scale: ChartScale): string {
  return series.points.map((point, index) => {
    const x = index * 100 / (scale.count - 1)
    return `${index === 0 ? 'M' : 'L'} ${x} ${scale.y(point.value)}`
  }).join(' ')
}

function LineChart({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const scale = chartScale(data)
  return data.series.map(series => <path
    d={seriesPath(series, scale)}
    data-chart-mark="line"
    data-chart-series={series.id}
    fill="none"
    key={series.id}
    stroke={series.color ?? 'currentColor'}
    vectorEffect="non-scaling-stroke"
  />)
}

function AreaChart({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const scale = chartScale(data)
  return data.series.map(series => {
    const line = seriesPath(series, scale)
    const finalX = Math.max(0, series.points.length - 1) * 100 / (scale.count - 1)
    const area = series.points.length === 0 ? '' : `${line} L ${finalX} ${scale.baseline} L 0 ${scale.baseline} Z`
    return <g data-chart-series={series.id} key={series.id}>
      <path d={area} data-chart-mark="area" fill={series.color ?? 'currentColor'} fillOpacity="0.2" />
      <path d={line} data-chart-mark="area-line" fill="none" stroke={series.color ?? 'currentColor'} vectorEffect="non-scaling-stroke" />
    </g>
  })
}

function BarChart({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const scale = chartScale(data)
  const groupCount = Math.max(1, scale.count)
  const seriesCount = Math.max(1, data.series.length)
  const groupWidth = 90 / groupCount
  const barWidth = groupWidth / seriesCount
  return data.series.flatMap((series, seriesIndex) => series.points.map((point, pointIndex) => {
    const y = scale.y(point.value)
    const top = Math.min(y, scale.baseline)
    const height = Math.max(0.5, Math.abs(scale.baseline - y))
    return <rect
      data-chart-label={point.label}
      data-chart-mark="bar"
      data-chart-series={series.id}
      fill={series.color ?? 'currentColor'}
      height={height}
      key={`${series.id}-${point.label}`}
      width={barWidth * 0.8}
      x={5 + pointIndex * groupWidth + seriesIndex * barWidth}
      y={top}
    />
  }))
}

function piePoint(center: number, radius: number, angle: number): readonly [number, number] {
  return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)]
}

function PieChart({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const slices = data.series.flatMap(series => series.points.map(point => ({ point, series }))).filter(slice => slice.point.value > 0)
  const total = slices.reduce((sum, slice) => sum + slice.point.value, 0)
  if (total === 0) return null
  let angle = -Math.PI / 2
  return slices.map((slice, index) => {
    const sweep = slice.point.value / total * Math.PI * 2
    const end = angle + sweep
    const startPoint = piePoint(50, 44, angle)
    const endPoint = piePoint(50, 44, end)
    const path = slices.length === 1
      ? null
      : `M 50 50 L ${startPoint[0]} ${startPoint[1]} A 44 44 0 ${sweep > Math.PI ? 1 : 0} 1 ${endPoint[0]} ${endPoint[1]} Z`
    angle = end
    if (path === null) return <circle
      cx="50"
      cy="50"
      data-chart-label={slice.point.label}
      data-chart-mark="slice"
      data-chart-series={slice.series.id}
      fill={slice.series.color ?? 'currentColor'}
      key={`${slice.series.id}-${slice.point.label}`}
      r="44"
    />
    return <path
      d={path}
      data-chart-label={slice.point.label}
      data-chart-mark="slice"
      data-chart-series={slice.series.id}
      fill={slice.series.color ?? 'currentColor'}
      fillOpacity={Math.max(0.35, 1 - index * 0.12)}
      key={`${slice.series.id}-${slice.point.label}`}
    />
  })
}

function ChartGraphic({ data }: { readonly data: ChartWidgetData }): ReactNode {
  if (data.type === 'area') return <AreaChart data={data} />
  if (data.type === 'bar') return <BarChart data={data} />
  if (data.type === 'pie') return <PieChart data={data} />
  return <LineChart data={data} />
}

function ChartWidget({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const model = createAccessibleChartModel(data)
  const descriptionId = useId()
  return <figure className="hp-widget-chart" data-chart-type={data.type}>
    <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox="0 0 100 100">
      <ChartGraphic data={data} />
    </svg>
    <figcaption id={descriptionId}>{model.description}</figcaption>
    <div className="hp-table-responsive" role="region" aria-label={model.caption} tabIndex={0}>
      <Table>
        <TableCaption>{model.caption}</TableCaption>
        <TableHeader><TableRow><TableHead scope="col">Label</TableHead>{model.columns.map(column => <TableHead key={column} scope="col">{column}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{model.rows.map(row => <TableRow key={row.label}><TableHead scope="row">{row.label}</TableHead>{row.values.map((value, index) => <TableCell key={`${row.label}-${model.columns[index] ?? index}`}>{value ?? '—'}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  </figure>
}

function CustomWidget({ data, props }: { readonly data: CustomWidgetData, readonly props: ReactWidgetRendererProps }): ReactNode {
  if (!props.registry) throw new Error(`[Holo Panels] A React component registry is required for custom widget "${data.component}".`)
  const name = `widget.${data.component}`
  const component = props.registry.resolve<ReactCustomWidgetProps>(name, props.panelId, `widget "${props.manifest.id}"`)
  return createElement(component, { properties: data.properties, widget: props.manifest })
}

function ReadyWidget({ props, state }: { readonly props: ReactWidgetRendererProps, readonly state: WidgetClientState }): ReactNode {
  const data = state.data
  if (props.manifest.family === 'stats' && isStatsData(data)) return <StatsWidget data={data} props={props} />
  if (props.manifest.family === 'chart' && isChartData(data)) return <ChartWidget data={data} />
  if (props.manifest.family === 'table' && isTableData(data)) {
    return props.renderTable ? props.renderTable({ data, widget: props.manifest }) : <p role="alert">Table widget renderer unavailable</p>
  }
  if (props.manifest.family === 'custom' && isCustomData(data)) return <CustomWidget data={data} props={props} />
  return <p role="alert">{props.manifest.errorState}</p>
}

function WidgetFilters({ props, state }: { readonly props: ReactWidgetRendererProps, readonly state: WidgetClientState }): ReactNode {
  if (props.manifest.filters.length === 0) return null
  return <form aria-label={`${props.manifest.heading ?? props.manifest.id} filters`} className="hp-widget-filters" onSubmit={event => event.preventDefault()}>
    {props.manifest.filters.map(filter => {
      const value = state.filters[filter.id] ?? filter.defaultValue
      const id = `${props.manifest.id}-${filter.id}`
      return <label htmlFor={id} key={filter.id}>{filter.label}
        {typeof value === 'boolean'
          ? <Checkbox checked={value} id={id} onCheckedChange={checked => void props.store.setFilter(filter.id, checked === true)} />
          : <Input id={id} onChange={event => void props.store.setFilter(filter.id, event.currentTarget.value)} type="search" value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} />}
      </label>
    })}
    <Button onClick={() => void props.store.resetFilters()} type="button">Reset filters</Button>
  </form>
}

export function ReactWidgetRenderer(props: ReactWidgetRendererProps): ReactNode {
  const state = useSyncExternalStore(
    listener => props.store.subscribe(listener),
    () => props.store.snapshot,
    () => props.store.snapshot,
  )
  const headingId = useId()
  useEffect(() => {
    if (!props.manifest.lazy && props.store.snapshot.status === 'idle') void props.store.activate()
    return () => props.store.stop()
  }, [props.manifest.lazy, props.store])
  if (state.status === 'hidden') return null
  const content = <>
    <WidgetFilters props={props} state={state} />
    {state.status === 'idle' ? <Button onClick={() => void props.store.activate()} type="button">Load widget</Button> : null}
    {state.status === 'loading' ? <p aria-live="polite" role="status">Loading widget…</p> : null}
    {state.status === 'unauthorized' ? <p role="status">Widget unavailable</p> : null}
    {state.status === 'error' ? <div role="alert"><strong>{props.manifest.errorState}</strong>{state.error ? <span>{state.error}</span> : null}<Button onClick={() => void props.store.load()} type="button">Retry</Button></div> : null}
    {state.status === 'ready' ? <ReadyWidget props={props} state={state} /> : null}
  </>
  if (props.manifest.family === 'stats') return <section
    aria-labelledby={props.manifest.heading ? headingId : undefined}
    className="hp-widget hp-widget--stats hp:space-y-4"
    data-panels-component="widget"
    data-widget-id={props.manifest.id}
  >
    {props.manifest.heading ? <div className="hp:space-y-1"><h2 className="hp:text-xl hp:font-semibold" id={headingId}>{props.manifest.heading}</h2>{props.manifest.description ? <p className="hp:text-sm hp:text-muted-foreground">{props.manifest.description}</p> : null}</div> : null}
    {content}
  </section>
  return <Card aria-labelledby={props.manifest.heading ? headingId : undefined} className={`hp-widget hp-widget--${props.manifest.family}`} data-panels-component="widget" data-widget-id={props.manifest.id}><CardHeader>{props.manifest.heading ? <CardTitle id={headingId}>{props.manifest.heading}</CardTitle> : null}{props.manifest.description ? <CardDescription>{props.manifest.description}</CardDescription> : null}</CardHeader><CardContent>{content}</CardContent></Card>
}

function gridStyle(placement: WidgetGridPlacement): React.CSSProperties {
  return {
    gridColumnEnd: `span ${placement.columnSpan}`,
    gridColumnStart: placement.columnStart ?? undefined,
  }
}

function WidgetGrid({ label, widgets, width }: ReactDashboardRendererProps): ReactNode {
  const ordered = [...widgets].sort((left, right) => left.manifest.sort - right.manifest.sort || left.manifest.id.localeCompare(right.manifest.id))
  const placements = resolveWidgetGrid(ordered.map(widget => widget.manifest), width)
  const columns = placements[0]?.columns ?? 1
  return <section aria-label={label} className="hp-widget-grid hp:grid hp:gap-4" data-columns={columns} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {ordered.map((widget, index) => {
      const placement = placements[index]
      if (!placement) return null
      return <div className="hp-widget-grid-item" key={widget.manifest.id} style={gridStyle(placement)}>{widget.render()}</div>
    })}
  </section>
}

export function ReactDashboardRenderer(props: ReactDashboardRendererProps): ReactNode {
  return <WidgetGrid {...props} />
}

export function ReactResourceWidgets(props: ReactResourceWidgetsProps): ReactNode {
  const headers = props.widgets.filter(widget => widget.placement === 'header')
  const footers = props.widgets.filter(widget => widget.placement === 'footer')
  return <Fragment>
    {headers.length > 0 ? <WidgetGrid label={props.headerLabel ?? 'Resource header widgets'} widgets={headers} width={props.width} /> : null}
    {props.children}
    {footers.length > 0 ? <WidgetGrid label={props.footerLabel ?? 'Resource footer widgets'} widgets={footers} width={props.width} /> : null}
  </Fragment>
}

export function registerReactWidgetRenderer(
  registry: NonNullable<ReactWidgetRendererProps['registry']>,
  component: string,
  renderer: ComponentType<ReactCustomWidgetProps>,
): typeof registry {
  registry.register(`widget.${component}`, renderer, '@holo-js/panels-react')
  return registry
}
