export { PanelTokenName, PanelTokenOverrides, PanelTokenValues, darkPanelTheme, definePanelTheme, lightPanelTheme, panelThemeStyleAttribute, panelThemeVariables, panelTokenNames, panelTokenVariable } from '@holo-js/panels-ui';
import { JsonValue, RuntimeTypeSource, ContextTypeSources, WidgetBuilder, RuntimeTypeValue, OptionalRuntimeTypeValue, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices, ChartWidgetData, JsonObject, PageTypeSources, PageBuilder, StatsWidgetData, TableWidgetData, DiscoverableDefinition, definePage as definePage$1, definePanel as definePanel$1 } from '@holo-js/panels-core';
export { AccessibleChartModel, AccessibleChartRenderer, AccessibleChartRow, ChartPoint, ChartSeries, ChartWidgetData, CompiledDashboardDefinition, CompiledPageDefinition, CompiledPanelDefinition, CompiledPanelTenancy, CompiledWidgetDefinition, ComponentDefault, ContextTypeSources, CustomWidgetData, DashboardBuilder, DashboardContext, DashboardManifest, DashboardNavigation, DefaultPanelActor, DefaultPanelServices, DefaultPanelTenant, DefaultableComponentKind, ExecutePanelDatabaseNotificationOperationOptions, HoloAuth, HoloAuthGuard, JsonObject, NestedResourceOptions, OptionalRuntimeTypeValue, PageAccessError, PageBreadcrumb, PageComponentBody, PageContext, PageManifest, PageNavigation, PageNavigationInput, PageResolvable, PageServerHandles, PageType, PageTypeSources, PanelAccessContext, PanelActiveTenantPersistence, PanelActorPresenter, PanelActorSource, PanelAssetKind, PanelAssetManifest, PanelAuthContext, PanelAuthPageConfiguration, PanelAuthenticatedScope, PanelAuthorizationLayer, PanelAuthorizationRequest, PanelBootstrap, PanelBranding, PanelDarkMode, PanelDatabaseNotificationConfiguration, PanelDatabaseNotificationIdentity, PanelDatabaseNotificationInboxOptions, PanelDatabaseNotificationItem, PanelDatabaseNotificationOperationResult, PanelDatabaseNotificationPage, PanelDatabaseNotificationPayload, PanelDatabaseNotificationPlacement, PanelBuilder as PanelDefinition, PanelEmailVerificationPageConfiguration, PanelGeneratorTemplate, PanelIconDefinition, PanelIconPath, PanelLoginPageConfiguration, PanelLogoutPageConfiguration, PanelManifest, PanelModelTenancyOptions, PanelMultiFactorPageConfiguration, PanelNavigationMode, PanelNavigationSeed, PanelNotification, PanelNotificationAccessError, PanelNotificationAction, PanelNotificationActionKind, PanelNotificationAuthorization, PanelNotificationBootstrap, PanelNotificationInbox, PanelNotificationOperation, PanelNotificationPresentation, PanelNotificationRecipient, PanelNotificationRecipientResolver, PanelNotificationRecord, PanelNotificationRequestError, PanelNotificationScope, PanelNotificationStatus, PanelNotificationStore, PanelNotificationStorePage, PanelNotificationStorePagination, PanelNotificationStoreQuery, PanelOperation, PanelPackageModuleContribution, PanelPasswordResetPageConfiguration, PanelPermissionSubject, PanelPlugin, PanelPluginAsset, PanelPluginBuilder, PanelPluginContribution, PanelPluginContributionDefinition, PanelPluginIcon, PanelPluginInstallation, PanelProfilePageConfiguration, PanelQueuedTenantContext, PanelRendererFramework, PanelRendererRegistration, PanelRuntime, PanelRuntimeError, PanelTenancyManifest, PanelTenancyOptions, PanelTenantBillingProvider, PanelTenantBootstrap, PanelTenantIdentifier, PanelTenantIdentity, PanelTenantMenuItem, PanelTenantPresentation, PanelTenantPresentationInput, PanelTheme, PanelTranslationContribution, PanelUserMenuItem, PanelsConfiguration, PanelsRenderHook, RecordTypeSource, RecordTypeValue, RenderHook, ResolvedPageData, ResolvedWidget, ResourceAttribute, ResourceAttributes, ResourceAuthorization, ResourceCapabilities, ResourceClientManifest, ResourceExecutionContext, ResourceExecutor, ResourceExecutorOptions, ResourceGlobalSearch, ResourceIdentifier, ResourceInput, ResourceInputError, ResourceLifecycle, ResourceModel, ResourceModelDefinition, ResourceMutationResult, ResourceNavigation, ResourceOperation, ResourceParentReference, ResourcePersistence, ResourceQuery, ResourceRecord, ResourceRecordNotFoundError, ResourceTransaction, ResourceValidation, ResourceWidgetContext, RuntimeTypeSource, RuntimeTypeValue, ScopedRenderSlotManifest, ScopedRenderSlots, SingularResourceOptions, StatsWidgetData, TableWidgetData, WidgetAccessError, WidgetBuilder, WidgetColumnSpan, WidgetContext, WidgetDataContext, WidgetFamily, WidgetFilterDefinition, WidgetFilterState, WidgetLayout, WidgetManifest, WidgetPolling, WidgetResourcePlacement, WidgetServerHandles, WidgetStat, WidgetsRenderHook, componentDefault, createAccessibleChartModel, createExtensionTypeId, createGeneratedResourcePage, createNavigationSeed, createResourceWidgetContext, csvExportFormat, csvImportFormat, databaseNotificationPayload, defineCustomWidget, defineDashboard, definePanelPlugin, definePanelsConfig, defineResourceChartWidget, defineResourceCustomWidget, defineResourceStatsWidget, defineResourceTableWidget, executePanelDatabaseNotificationOperation, generatedResourcePageManifests, holoNotificationStore, isPanelDatabaseNotificationPayload, panelNotification, preparePageRoutes, relationManagersFor, renderAccessibleChart, requireResolvedWidget, resolveTableWidgetData, resolveWidget, selectDefaultDashboard, widgetContext } from '@holo-js/panels-core';
export { ClientEffectHandler, ClientEffectSession, ClientEffectSessionOptions, ClientNotificationActionHandler, ClientNotificationInboxListener, ClientNotificationInboxOptions, ClientNotificationInboxState, ClientNotificationInboxStore, ClientNotificationRealtime, ClientNotificationTransport, ClientToast, ClientToastState, ClientToastStateListener, ClientToastStore, PanelNotificationTransportOptions, PanelShellBootstrap, PanelShellError, PanelShellErrorCode, PanelShellManifest, PanelShellMenuItem, PanelShellNavigationItem, PanelShellNavigationMode, PanelShellState, PanelShellStateListener, PanelShellStore, PanelShellViewport, WidgetClientFilter, WidgetClientManifest, WidgetClientState, WidgetClientStatus, WidgetFilterPersistence, WidgetFilterStorage, WidgetGridPlacement, WidgetLoadResult, WidgetLoader, WidgetScheduler, WidgetStateListener, WidgetStore, WidgetViewport, createPanelNotificationTransport, fluxNotificationRealtime, resolveWidgetGrid, widgetGridColumns, widgetViewport } from '@holo-js/panels-client';
export * from '@holo-js/panels-actions';
export * from '@holo-js/panels-forms';
export * from '@holo-js/panels-infolists';
export * from '@holo-js/panels-notifications';
export * from '@holo-js/panels-resources';
export * from '@holo-js/panels-schemas';
export * from '@holo-js/panels-tables';

interface PageFactory {
    <TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>): PageBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    (id: string): PageBuilder<JsonObject, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>;
}
interface WidgetFactory<TData extends JsonValue> {
    <TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>): WidgetBuilder<TData, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    (id: string): WidgetBuilder<TData, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>;
}
declare const defineCustomPage: PageFactory;
declare const defineChartWidget: WidgetFactory<ChartWidgetData>;
declare const defineStatsWidget: WidgetFactory<StatsWidgetData>;
declare const defineTableWidget: WidgetFactory<TableWidgetData>;

declare const definePanel: typeof definePanel$1;
declare const definePage: typeof definePage$1;
interface CompiledCustomDefinition<TKind extends string, TValue, TContext> {
    readonly definitionKind: TKind;
    readonly id: string;
    readonly label?: string;
    readonly properties: Readonly<Record<string, unknown>>;
    readonly renderer?: string;
    readonly visible: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>);
}
declare class CustomDefinitionBuilder<TKind extends string, TValue = unknown, TContext = unknown> {
    #private;
    readonly contextType: TContext;
    readonly definitionKind: TKind;
    readonly id: string;
    readonly valueType: TValue;
    constructor(definitionKind: TKind, id: string);
    label(value: string): this;
    properties(value: Readonly<Record<string, unknown>>): this;
    renderer(value: string): this;
    visible(value: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>)): this;
    compile(): CompiledCustomDefinition<TKind, TValue, TContext>;
}
declare const defineColumn: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"column", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineEntry: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"entry", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineField: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"field", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineFilter: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"filter", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineCluster: (id: string) => DiscoverableDefinition<"cluster">;
declare const defineWidget: (id: string) => DiscoverableDefinition<"widget">;

export { type CompiledCustomDefinition, CustomDefinitionBuilder, defineChartWidget, defineCluster, defineColumn, defineCustomPage, defineEntry, defineField, defineFilter, definePage, definePanel, defineStatsWidget, defineTableWidget, defineWidget };
