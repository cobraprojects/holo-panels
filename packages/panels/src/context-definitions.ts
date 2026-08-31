import {
  defineChartWidget as defineCoreChartWidget,
  defineCustomPage as defineCoreCustomPage,
  defineStatsWidget as defineCoreStatsWidget,
  defineTableWidget as defineCoreTableWidget,
  type TableWidgetBuilder,
  type ChartWidgetData,
  type ContextTypeSources,
  type DefaultPanelActor,
  type DefaultPanelServices,
  type DefaultPanelTenant,
  type JsonObject,
  type JsonValue,
  type OptionalRuntimeTypeValue,
  type PageBuilder,
  type PageTypeSources,
  type RuntimeTypeSource,
  type RuntimeTypeValue,
  type StatsWidgetData,
  type WidgetBuilder,
} from '@holo-js/panels-core'

interface PageFactory {
  <
    TData extends JsonObject,
    TActorSource extends RuntimeTypeSource | undefined = undefined,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
    TServicesSource extends RuntimeTypeSource | undefined = undefined,
  >(
    id: string,
    sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>,
  ): PageBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>
  (id: string): PageBuilder<JsonObject, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>
}

interface WidgetFactory<TData extends JsonValue> {
  <
    TActorSource extends RuntimeTypeSource,
    TTenantSource extends RuntimeTypeSource | undefined = undefined,
    TServicesSource extends RuntimeTypeSource | undefined = undefined,
  >(
    id: string,
    sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>,
  ): WidgetBuilder<TData, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>
  (id: string): WidgetBuilder<TData, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>
}

export const defineCustomPage = defineCoreCustomPage as PageFactory
export const defineChartWidget = defineCoreChartWidget as WidgetFactory<ChartWidgetData>
export const defineStatsWidget = defineCoreStatsWidget as WidgetFactory<StatsWidgetData>
export const defineTableWidget = defineCoreTableWidget as {
  (id: string): TableWidgetBuilder<DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>
  <TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>): TableWidgetBuilder<RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>
}
