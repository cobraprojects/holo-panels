import {
  Fragment,
  createElement,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { panelColorAppearance, panelColorValue, widgetChartMarks, widgetSparklinePoints } from '@holo-js/panels-ui'
import {
  createAccessibleChartModel,
  safeExternalUrl,
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
import { Button, Input, PanelsIcon } from '../internal-ui'
import { ReactActionRenderer } from '../actions/renderer'
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

function Sparkline({ stat }: { readonly stat: WidgetStat }): ReactNode {
  const points = widgetSparklinePoints(stat.chart)
  if (!points) return null
  return <svg aria-hidden="true" className="hp-widget-sparkline hp:mt-4 hp:h-8 hp:w-full" preserveAspectRatio="none" viewBox="0 0 100 32">
    <polyline fill="none" points={points} stroke="currentColor" vectorEffect="non-scaling-stroke" />
  </svg>
}

function StatContent({ action, actions, actionStore, navigate, stat }: {
  readonly action?: ReactWidgetRendererProps['action']
  readonly actions?: ReactWidgetRendererProps['actions']
  readonly actionStore?: ReactWidgetRendererProps['actionStore']
  readonly navigate?: ReactWidgetRendererProps['navigate']
  readonly stat: WidgetStat
}): ReactNode {
  const content = <Card className="hp-widget-stat"><CardHeader className="hp:flex hp:flex-row hp:items-center hp:justify-between hp:space-y-0 hp:pb-2"><CardTitle className="hp:text-sm hp:font-medium">{stat.label}</CardTitle>{stat.icon ? <PanelsIcon className="hp:size-4 hp:text-muted-foreground" name={stat.icon} /> : null}</CardHeader><CardContent><div className="hp:text-2xl hp:font-bold">{stat.value}</div>{stat.description ? <p className="hp:text-xs hp:text-muted-foreground">{stat.description}</p> : null}{stat.trend ? <p className="hp:text-xs hp:text-muted-foreground">{stat.trend}</p> : null}{stat.progress ? <progress aria-label={stat.label} className="hp-widget-progress hp:w-full" max={stat.progress.max} value={stat.progress.value}>{stat.progress.value} / {stat.progress.max}</progress> : null}<Sparkline stat={stat} /></CardContent></Card>
  const url = stat.url ? safeExternalUrl(stat.url) : null
  if (url) {
    return <a href={url} onClick={navigate ? event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !url.startsWith('/')) return
      event.preventDefault()
      navigate(url)
    } : undefined}>{content}</a>
  }
  const statAction = stat.action
  if (statAction && actionStore) {
    const registered = actions?.find(candidate => candidate.id === statAction && candidate.visible)
    return registered ? <Button className="hp:h-auto hp:w-full hp:block hp:whitespace-normal hp:p-0 hp:text-left" disabled={registered.disabled} onClick={() => actionStore.mount(registered)} type="button">{content}</Button> : content
  }
  if (statAction && action) return <Button className="hp:h-auto hp:w-full hp:block hp:whitespace-normal hp:p-0 hp:text-left" onClick={() => void action(statAction)} type="button">{content}</Button>
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
      style={{ ...style, color: panelColorValue(stat.color) }}
    >
      <StatContent action={props.action} actions={props.actions} actionStore={props.actionStore} navigate={props.navigate} stat={stat} />
    </li>
  })}</ul>
}

function ChartGraphic({ data }: { readonly data: ChartWidgetData }): ReactNode {
  return widgetChartMarks(data).map(mark => <path d={mark.path} data-chart-mark={mark.kind} data-chart-series={mark.series} data-chart-label={mark.label} fill={mark.kind === 'line' ? 'none' : mark.color} fillOpacity={mark.opacity} key={mark.key} stroke={mark.kind === 'line' ? mark.color : undefined} vectorEffect="non-scaling-stroke" />)
}

function ChartWidget({ data }: { readonly data: ChartWidgetData }): ReactNode {
  const model = createAccessibleChartModel(data)
  const descriptionId = useId()
  return <figure className="hp-widget-chart" data-chart-type={data.type}>
    <svg aria-hidden="true" className="hp:h-48 hp:w-full" focusable="false" viewBox="0 0 100 100">
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
  const host = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (props.store.snapshot.status === 'ready') props.store.startPolling()
    else if (!props.manifest.lazy && props.store.snapshot.status === 'idle') void props.store.activate()
    const observer = props.manifest.lazy && props.store.snapshot.status === 'idle' && typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer?.disconnect()
        void props.store.activate()
      }
    }) : null
    if (host.current) observer?.observe(host.current)
    return () => { observer?.disconnect(); props.store.stop() }
  }, [props.manifest.lazy, props.store])
  if (state.status === 'hidden') return null
  const content = <>
    {state.status === 'ready' && props.actions?.[0] && props.actionStore ? <ReactActionRenderer actions={props.actions} manifest={props.actions[0]} panelId={props.panelId} registry={props.registry} store={props.actionStore} /> : null}
    <WidgetFilters props={props} state={state} />
    {state.status === 'idle' ? <Button onClick={() => void props.store.activate()} type="button">Load widget</Button> : null}
    {state.status === 'loading' ? <p aria-live="polite" role="status">Loading widget…</p> : null}
    {state.status === 'unauthorized' ? <p role="status">Widget unavailable</p> : null}
    {state.status === 'error' ? <div role="alert"><strong>{props.manifest.errorState}</strong><Button onClick={() => void props.store.load()} type="button">Retry</Button></div> : null}
    {state.status === 'ready' ? <ReadyWidget props={props} state={state} /> : null}
  </>
  if (props.manifest.family === 'stats') return <section
    ref={host}
    aria-labelledby={props.manifest.heading ? headingId : undefined}
    className="hp-widget hp-widget--stats hp:space-y-4"
    data-panels-component="widget"
    data-widget-id={props.manifest.id}
  >
    {props.manifest.heading ? <div className="hp:space-y-1"><h2 className="hp:text-xl hp:font-semibold" id={headingId}>{props.manifest.heading}</h2>{props.manifest.description ? <p className="hp:text-sm hp:text-muted-foreground">{props.manifest.description}</p> : null}</div> : null}
    {content}
  </section>
  return <Card ref={element => { host.current = element }} aria-labelledby={props.manifest.heading ? headingId : undefined} className={`hp-widget hp-widget--${props.manifest.family}`} data-panels-component="widget" data-widget-id={props.manifest.id}><CardHeader>{props.manifest.heading ? <CardTitle id={headingId}>{props.manifest.heading}</CardTitle> : null}{props.manifest.description ? <CardDescription>{props.manifest.description}</CardDescription> : null}</CardHeader><CardContent>{content}</CardContent></Card>
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
