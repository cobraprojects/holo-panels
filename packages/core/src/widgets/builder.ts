import { ConstructionBuilder } from '../builders/construction-builder'
import { DISCOVERY_MARKER, type DiscoverableBuilder, type DiscoverableDefinition } from '../discovery/types'
import { toJsonValue } from '../protocol/serialization'
import type { JsonValue } from '../protocol/json'
import type { ResourceAttributes, ResourceCompositionTypes } from '../resources/contracts'
import type { ExtensionTypeId } from '../plugins/type-id'
import type { ContextTypeSources, OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import type {
  ChartWidgetData,
  CompiledWidgetDefinition,
  CustomWidgetData,
  StatsWidgetData,
  TableWidgetData,
  WidgetColumnSpan,
  WidgetContext,
  WidgetDataContext,
  WidgetFamily,
  WidgetFilterDefinition,
  WidgetManifest,
  WidgetServerHandles,
} from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const WIDGET_EXTENSION_TYPE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*:widget:[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

interface WidgetState<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object> {
  authorize: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['authorize']
  columnSpan: WidgetColumnSpan
  columnStart: number | null
  data: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['data']
  description: string | null
  emptyState: string
  errorState: string
  filters: WidgetFilterDefinition[]
  heading: string | null
  lazy: boolean
  pollingInterval: number | null
  sort: number
  visible: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['visible']
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} requires a stable identifier`)
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`)
}

export class WidgetBuilder<
  TData extends JsonValue,
  TActor = unknown,
  TTenant = unknown,
  TServices = unknown,
  TRecord extends object = object,
> extends ConstructionBuilder<WidgetState<TData, TActor, TTenant, TServices, TRecord>, CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>> implements DiscoverableBuilder<'widget'> {
  declare readonly resourceCompositionTypes: ResourceCompositionTypes<TRecord, TActor, TTenant, TServices>
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'widget' as const

  constructor(readonly id: string, readonly family: WidgetFamily, readonly type: string) {
    assertIdentifier(id, 'Widgets')
    if (!IDENTIFIER.test(type) && (family !== 'custom' || !WIDGET_EXTENSION_TYPE.test(type))) {
      throw new Error('Widget types require a stable identifier or widget extension type ID')
    }
    super({
      authorize: () => true,
      columnSpan: 1,
      columnStart: null,
      data: () => {
        throw new Error(`Widget ${id} requires a data resolver`)
      },
      description: null,
      emptyState: 'No data available',
      errorState: 'Unable to load widget',
      filters: [],
      heading: null,
      lazy: false,
      pollingInterval: null,
      sort: 0,
      visible: () => true,
    })
    this.configureComponentDefaults('widget', type)
  }

  heading(value: string | null): this {
    return this.writeState('heading', value)
  }

  description(value: string | null): this {
    return this.writeState('description', value)
  }

  sort(value: number): this {
    if (!Number.isFinite(value)) throw new Error('Widget sort must be finite')
    return this.writeState('sort', value)
  }

  columnSpan(value: WidgetColumnSpan): this {
    if (value !== 'full') positiveInteger(value, 'Widget column span')
    return this.writeState('columnSpan', value)
  }

  columnStart(value: number | null): this {
    if (value !== null) positiveInteger(value, 'Widget start column')
    return this.writeState('columnStart', value)
  }

  lazy(value = true): this {
    return this.writeState('lazy', value)
  }

  poll(interval: number | null): this {
    if (interval !== null) positiveInteger(interval, 'Widget polling interval')
    return this.writeState('pollingInterval', interval)
  }

  visible(resolver: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['visible']): this {
    return this.writeState('visible', resolver)
  }

  authorize(resolver: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['authorize']): this {
    return this.writeState('authorize', resolver)
  }

  data(resolver: (context: WidgetDataContext<TActor, TTenant, TServices, TRecord>) => TData | Promise<TData>): this {
    return this.writeState('data', resolver)
  }

  filter(id: string, label: string, defaultValue: JsonValue = null): this {
    assertIdentifier(id, 'Widget filters')
    if (!label.trim()) throw new Error('Widget filter labels cannot be empty')
    const filters = [...this.readState().filters]
    if (filters.some(filter => filter.id === id)) throw new Error(`Widget filter ${id} is already defined`)
    toJsonValue(defaultValue)
    filters.push({ defaultValue, id, label: label.trim() })
    return this.writeState('filters', filters)
  }

  emptyState(message: string): this {
    if (!message.trim()) throw new Error('Widget empty states cannot be empty')
    return this.writeState('emptyState', message.trim())
  }

  errorState(message: string): this {
    if (!message.trim()) throw new Error('Widget error states cannot be empty')
    return this.writeState('errorState', message.trim())
  }

  compileDiscoveryDefinition(): DiscoverableDefinition<'widget'> {
    const definition = this.compile()
    return Object.freeze({
      client: definition.manifest,
      componentKeys: definition.manifest.type.includes(':widget:') ? [definition.manifest.type] : [],
      discoveryMarker: this.discoveryMarker,
      id: this.id,
      kind: this.kind,
      permissionKeys: [`widgets.${this.id}.view`],
    })
  }

  protected createDefinition(state: Readonly<WidgetState<TData, TActor, TTenant, TServices, TRecord>>): CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord> {
    const manifest: WidgetManifest = {
      description: state.description,
      emptyState: state.emptyState,
      errorState: state.errorState,
      family: this.family,
      filters: state.filters,
      heading: state.heading,
      id: this.id,
      layout: { columnSpan: state.columnSpan, columnStart: state.columnStart },
      lazy: state.lazy,
      polling: { enabled: state.pollingInterval !== null, interval: state.pollingInterval },
      sort: state.sort,
      type: this.type,
    }
    toJsonValue(manifest)
    return {
      kind: 'widget',
      manifest,
      server: { authorize: state.authorize, data: state.data, visible: state.visible },
    }
  }
}

type WidgetFromSources<
  TData extends JsonValue,
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined,
  TServicesSource extends RuntimeTypeSource | undefined,
> = WidgetBuilder<
  TData,
  RuntimeTypeValue<TActorSource>,
  OptionalRuntimeTypeValue<TTenantSource>,
  OptionalRuntimeTypeValue<TServicesSource>
>

type WidgetFactory<TData extends JsonValue> = {
  <
    TActorSource extends RuntimeTypeSource,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
    TServicesSource extends RuntimeTypeSource | undefined = undefined,
  >(
    id: string,
    sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>,
  ): WidgetFromSources<TData, TActorSource, TTenantSource, TServicesSource>
  (id: string): WidgetBuilder<TData, unknown, unknown, unknown>
}

function widgetFactory<TData extends JsonValue>(family: WidgetFamily, type: string): WidgetFactory<TData> {
  function create<TActor = unknown, TTenant = unknown, TServices = unknown>(id: string): WidgetBuilder<TData, TActor, TTenant, TServices> {
    return new WidgetBuilder(id, family, type)
  }
  return create
}

export const defineStatsWidget: WidgetFactory<StatsWidgetData> = widgetFactory('stats', 'panels.widgets.stats')
export const defineChartWidget: WidgetFactory<ChartWidgetData> = widgetFactory('chart', 'panels.widgets.chart')
export const defineTableWidget: WidgetFactory<TableWidgetData> = widgetFactory('table', 'panels.widgets.table')
export function defineCustomWidget<
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>, type?: ExtensionTypeId<'widget'>): WidgetFromSources<CustomWidgetData, TActorSource, TTenantSource, TServicesSource>
export function defineCustomWidget(id: string, type?: ExtensionTypeId<'widget'>): WidgetBuilder<CustomWidgetData, unknown, unknown, unknown>
export function defineCustomWidget<TActor = unknown, TTenant = unknown, TServices = unknown>(
  id: string,
  sourcesOrType: ContextTypeSources<RuntimeTypeSource, RuntimeTypeSource | undefined, RuntimeTypeSource | undefined> | ExtensionTypeId<'widget'> | 'panels.widgets.custom' = 'panels.widgets.custom',
  customType: ExtensionTypeId<'widget'> | 'panels.widgets.custom' = 'panels.widgets.custom',
): WidgetBuilder<CustomWidgetData, TActor, TTenant, TServices> {
  const type = typeof sourcesOrType === 'string' ? sourcesOrType : customType
  return new WidgetBuilder(id, 'custom', type)
}

export interface ResourceWidgetTypeSources<
  TRecordSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
> {
  readonly actor?: TActorSource
  readonly record: TRecordSource
  readonly services?: TServicesSource
  readonly tenant?: TTenantSource
}

type ResourceWidgetFromSources<
  TData extends JsonValue,
  TRecordSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource | undefined,
  TTenantSource extends RuntimeTypeSource | undefined,
  TServicesSource extends RuntimeTypeSource | undefined,
> = WidgetBuilder<
  TData,
  OptionalRuntimeTypeValue<TActorSource>,
  OptionalRuntimeTypeValue<TTenantSource>,
  OptionalRuntimeTypeValue<TServicesSource>,
  Readonly<ResourceAttributes<RecordTypeValue<TRecordSource>>>
>

type ResourceWidgetFactory<TData extends JsonValue> = <
  TRecordSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(
  id: string,
  sources: ResourceWidgetTypeSources<TRecordSource, TActorSource, TTenantSource, TServicesSource>,
) => ResourceWidgetFromSources<TData, TRecordSource, TActorSource, TTenantSource, TServicesSource>

function resourceWidgetFactory<TData extends JsonValue>(family: WidgetFamily, type: string): ResourceWidgetFactory<TData> {
  return <
    TRecordSource extends RecordTypeSource,
    TActorSource extends RuntimeTypeSource | undefined = undefined,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
    TServicesSource extends RuntimeTypeSource | undefined = undefined,
  >(
    id: string,
    _sources: ResourceWidgetTypeSources<TRecordSource, TActorSource, TTenantSource, TServicesSource>,
  ): ResourceWidgetFromSources<TData, TRecordSource, TActorSource, TTenantSource, TServicesSource> => new WidgetBuilder<
    TData,
    OptionalRuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>,
    Readonly<ResourceAttributes<RecordTypeValue<TRecordSource>>>
  >(id, family, type)
}

export const defineResourceStatsWidget = resourceWidgetFactory<StatsWidgetData>('stats', 'panels.widgets.stats')
export const defineResourceChartWidget = resourceWidgetFactory<ChartWidgetData>('chart', 'panels.widgets.chart')
export const defineResourceTableWidget = resourceWidgetFactory<TableWidgetData>('table', 'panels.widgets.table')

export function defineResourceCustomWidget<
  TRecordSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(
  id: string,
  sources: ResourceWidgetTypeSources<TRecordSource, TActorSource, TTenantSource, TServicesSource>,
  type = 'panels.widgets.custom',
): ResourceWidgetFromSources<CustomWidgetData, TRecordSource, TActorSource, TTenantSource, TServicesSource> {
  return new WidgetBuilder<
    CustomWidgetData,
    OptionalRuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>,
    Readonly<ResourceAttributes<RecordTypeValue<TRecordSource>>>
  >(id, 'custom', type)
}

export function widgetContext<TActor, TTenant, TServices>(context: WidgetContext<TActor, TTenant, TServices>): WidgetContext<TActor, TTenant, TServices> {
  return context
}
