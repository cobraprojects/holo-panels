import * as _holo_js_panels_core from '@holo-js/panels-core';
import { DiscoverableDefinition, definePage as definePage$1, definePanel as definePanel$1, SchemaBuilder } from '@holo-js/panels-core';
export { AccessibleChartModel, AccessibleChartRenderer, AccessibleChartRow, ActionGroupBuilder, ActionGroupItem, ActionGroupManifest, ActionPresentationDefinition, ActionPresentationManifest, ActionRateLimit, ActionSize, CalloutBuilder, CapabilityHost, ChartPoint, ChartSeries, ChartWidgetData, CompiledDashboardDefinition, CompiledPageDefinition, CompiledPanelDefinition, CompiledPanelTenancy, CompiledSchema, CompiledSchemaComponent, CompiledWidgetDefinition, ComponentDefault, ConstructionBuilder, ContainerComponentBuilder, ContextTypeSources, CustomComponentBuilder, CustomComponentProperties, CustomWidgetData, DashboardBuilder, DashboardContext, DashboardManifest, DashboardNavigation, DeepReadonly, DefaultableComponentKind, EmptyStateBuilder, ExecutePanelDatabaseNotificationOperationOptions, FieldsetBuilder, GridBuilder, GroupBuilder, HoloAuth, HoloAuthGuard, LabelCapability, LabelState, NestedResourceOptions, OptionalRuntimeTypeValue, PageAccessError, PageBreadcrumb, PageBuilder, PageComponentBody, PageContext, PageLayoutSlot, PageManifest, PageNavigation, PageNavigationInput, PageResolvable, PageServerHandles, PageType, PageTypeSources, PanelAccessContext, PanelActiveTenantPersistence, PanelActorPresenter, PanelActorSource, PanelAssetKind, PanelAssetManifest, PanelAuthContext, PanelAuthPageConfiguration, PanelAuthenticatedScope, PanelAuthorizationLayer, PanelAuthorizationRequest, PanelBootstrap, PanelBranding, PanelDarkMode, PanelDatabaseNotificationConfiguration, PanelDatabaseNotificationIdentity, PanelDatabaseNotificationInboxOptions, PanelDatabaseNotificationItem, PanelDatabaseNotificationOperationResult, PanelDatabaseNotificationPage, PanelDatabaseNotificationPayload, PanelDatabaseNotificationPlacement, PanelBuilder as PanelDefinition, PanelEmailVerificationPageConfiguration, PanelGeneratorTemplate, PanelIconDefinition, PanelIconPath, PanelLoginPageConfiguration, PanelLogoutPageConfiguration, PanelManifest, PanelMultiFactorPageConfiguration, PanelNavigationMode, PanelNavigationSeed, PanelNotification, PanelNotificationAccessError, PanelNotificationAction, PanelNotificationActionKind, PanelNotificationAuthorization, PanelNotificationBootstrap, PanelNotificationInbox, PanelNotificationOperation, PanelNotificationPresentation, PanelNotificationRecipient, PanelNotificationRecipientResolver, PanelNotificationRecord, PanelNotificationRequestError, PanelNotificationScope, PanelNotificationStatus, PanelNotificationStore, PanelNotificationStorePage, PanelNotificationStorePagination, PanelNotificationStoreQuery, PanelOperation, PanelPackageModuleContribution, PanelPasswordResetPageConfiguration, PanelPermissionSubject, PanelPlugin, PanelPluginAsset, PanelPluginBuilder, PanelPluginContribution, PanelPluginContributionDefinition, PanelPluginIcon, PanelPluginInstallation, PanelProfilePageConfiguration, PanelQueuedTenantContext, PanelRenderSlot, PanelRendererFramework, PanelRendererRegistration, PanelRuntime, PanelRuntimeError, PanelTenancyManifest, PanelTenancyOptions, PanelTenantBootstrap, PanelTenantIdentifier, PanelTenantIdentity, PanelTenantPresentation, PanelTenantPresentationInput, PanelTheme, PanelTranslationContribution, PanelUserMenuItem, PanelsConfiguration, RecordTypeSource, RecordTypeValue, RenderSlotReference, ResolvedPageData, ResolvedWidget, ResourceAttribute, ResourceAttributes, ResourceAuthorization, ResourceCapabilities, ResourceClientManifest, ResourceBuilder as ResourceDefinition, ResourceExecutionContext, ResourceExecutor, ResourceExecutorOptions, ResourceGlobalSearch, ResourceIdentifier, ResourceInput, ResourceInputError, ResourceLifecycle, ResourceModel, ResourceModelDefinition, ResourceMutationResult, ResourceNavigation, ResourceOperation, ResourceParentReference, ResourcePersistence, ResourceQuery, ResourceRecord, ResourceRecordFor, ResourceRecordNotFoundError, ResourceRenderSlot, ResourceTransaction, ResourceValidation, ResourceWidgetContext, ResponsiveValue, RuntimeTypeSource, RuntimeTypeValue, SchemaBreakpoint, SchemaBuilder, SchemaCollapseProperties, SchemaColumnSpan, SchemaComponentBuilder, SchemaComponentFactory, SchemaComponentKind, SchemaComponentManifest, SchemaComponentPatch, SchemaComponentProperties, SchemaJsonValue, SchemaLayoutProperties, SchemaManifest, SchemaPath, SchemaRenderSlots, SchemaTraversalContext, SchemaTypeSource, SchemaValueAtPath, SchemaVisibilityResolver, ScopedRenderSlotManifest, ScopedRenderSlots, SectionBuilder, SingularResourceOptions, SplitBuilder, StatsWidgetData, StepBuilder, TabBuilder, TableWidgetData, TabsBuilder, TargetedSchemaPatch, VisibilityCapability, VisibilityState, WidgetAccessError, WidgetBuilder, WidgetColumnSpan, WidgetContext, WidgetDataContext, WidgetFamily, WidgetFilterDefinition, WidgetFilterState, WidgetLayout, WidgetManifest, WidgetPolling, WidgetResourcePlacement, WidgetServerHandles, WidgetStat, WizardBuilder, actionGroup, applySchemaNodePatches, assignStableId, assignStableKey, callout, componentDefault, createAccessibleChartModel, createExtensionTypeId, createNavigationSeed, createResourceWidgetContext, csvExportFormat, csvImportFormat, customComponent, databaseNotificationPayload, defineChartWidget, defineCreatePage, defineCustomPage, defineCustomWidget, defineDashboard, defineEditPage, defineExporter, defineImporter, defineListPage, definePanelPlugin, definePanelsConfig, defineRelatedRecordPage, defineResourceChartWidget, defineResourceCustomWidget, defineResourceStatsWidget, defineResourceTableWidget, defineSingularPage, defineStatsWidget, defineTableWidget, defineViewPage, emptyState, evaluateSchemaVisibility, executePanelDatabaseNotificationOperation, fieldset, findSchemaComponent, grid, group, holoNotificationStore, isPanelDatabaseNotificationPayload, panelNotification, patchSchemaNode, preparePageRoutes, renderAccessibleChart, requireResolvedWidget, resolveTableWidgetData, resolveWidget, schemaComponentsFor, section, selectDefaultDashboard, split, step, tab, tabs, traverseSchema, widgetContext, wizard } from '@holo-js/panels-core';
export { ClientEffectHandler, ClientEffectSession, ClientEffectSessionOptions, ClientNotificationActionHandler, ClientNotificationInboxListener, ClientNotificationInboxOptions, ClientNotificationInboxState, ClientNotificationInboxStore, ClientNotificationRealtime, ClientNotificationTransport, ClientToast, ClientToastState, ClientToastStateListener, ClientToastStore, PanelNotificationTransportOptions, PanelShellBootstrap, PanelShellError, PanelShellErrorCode, PanelShellManifest, PanelShellMenuItem, PanelShellNavigationItem, PanelShellNavigationMode, PanelShellState, PanelShellStateListener, PanelShellStore, PanelShellViewport, WidgetClientFilter, WidgetClientManifest, WidgetClientState, WidgetClientStatus, WidgetFilterPersistence, WidgetFilterStorage, WidgetGridPlacement, WidgetLoadResult, WidgetLoader, WidgetScheduler, WidgetStateListener, WidgetStore, WidgetViewport, createPanelNotificationTransport, fluxNotificationRealtime, resolveWidgetGrid, widgetGridColumns, widgetViewport } from '@holo-js/panels-client';

interface ComponentDescriptor<TKey extends string> {
    readonly key: TKey;
    readonly type: string;
}
interface FieldDescriptor<TKey extends string> extends ComponentDescriptor<TKey> {
    readonly requiredState: boolean;
    required(): this;
}
type CheckedDescriptor<TRecord, TDescriptor> = TDescriptor extends ComponentDescriptor<infer TKey> ? TKey extends Extract<keyof TRecord, string> ? TDescriptor : never : never;
type CheckedDescriptors<TRecord, TDescriptors extends readonly ComponentDescriptor<string>[]> = {
    readonly [TIndex in keyof TDescriptors]: CheckedDescriptor<TRecord, TDescriptors[TIndex]>;
};
declare const field: Readonly<{
    boolean: <TKey extends string>(key: TKey) => FieldDescriptor<TKey>;
    dateTime: <TKey extends string>(key: TKey) => FieldDescriptor<TKey>;
    number: <TKey extends string>(key: TKey) => FieldDescriptor<TKey>;
    text: <TKey extends string>(key: TKey) => FieldDescriptor<TKey>;
}>;
declare const column: Readonly<{
    boolean: <TKey extends string>(key: TKey) => ComponentDescriptor<TKey>;
    dateTime: <TKey extends string>(key: TKey) => ComponentDescriptor<TKey>;
    number: <TKey extends string>(key: TKey) => ComponentDescriptor<TKey>;
    text: <TKey extends string>(key: TKey) => ComponentDescriptor<TKey>;
}>;
declare class SchemaDefinition<TRecord> {
    #private;
    readonly definitionKind: "schema";
    fields<const TDescriptors extends readonly ComponentDescriptor<string>[]>(descriptors: TDescriptors & CheckedDescriptors<TRecord, TDescriptors>): this;
    get components(): readonly ComponentDescriptor<string>[];
}
declare class TableDefinition<TRecord> {
    #private;
    readonly definitionKind: "table";
    columns<const TDescriptors extends readonly ComponentDescriptor<string>[]>(descriptors: TDescriptors & CheckedDescriptors<TRecord, TDescriptors>): this;
    get components(): readonly ComponentDescriptor<string>[];
}
type DefinitionRecordSource<TRecord extends object = object> = {
    readonly prototype: TRecord;
} | {
    create(...parameters: never[]): TRecord | Promise<TRecord>;
};
type DefinitionRecord<TSource extends DefinitionRecordSource> = TSource extends {
    readonly prototype: infer TRecord extends object;
} ? TRecord : TSource extends {
    create(...parameters: never[]): infer TResult;
} ? Awaited<TResult> & object : never;
declare function defineSchema<TSource extends DefinitionRecordSource>(source: TSource): SchemaDefinition<DefinitionRecord<TSource>>;
declare function defineSchema(): SchemaDefinition<object>;
declare function defineSchema<TSource extends DefinitionRecordSource>(id: string, source: TSource): SchemaBuilder<DefinitionRecord<TSource>, unknown>;
declare function defineSchema<TSource extends DefinitionRecordSource, TContextSource extends {
    readonly prototype: object;
}>(id: string, source: TSource, context: TContextSource): SchemaBuilder<DefinitionRecord<TSource>, TContextSource['prototype']>;
declare function defineSchema(id: string): SchemaBuilder<Readonly<Record<string, unknown>>, unknown>;
declare function defineTable<TSource extends DefinitionRecordSource>(source: TSource): TableDefinition<DefinitionRecord<TSource>>;
declare function defineTable(): TableDefinition<object>;

declare const definePanel: typeof definePanel$1;
declare const definePage: typeof definePage$1;
declare const defineResource: {
    <TModel extends _holo_js_panels_core.ResourceModel<_holo_js_panels_core.ResourceRecord, _holo_js_panels_core.ResourceQuery<unknown, _holo_js_panels_core.ResourceRecord>>, TActorSource extends {
        readonly prototype: object;
    } | undefined = undefined, TTenantSource extends _holo_js_panels_core.RuntimeTypeSource | undefined = undefined>(model: TModel, sources: _holo_js_panels_core.ResourceContextTypeSources<TActorSource, TTenantSource>): _holo_js_panels_core.InferredResourceBuilder<TModel, TActorSource extends {
        readonly prototype: infer TActor extends object;
    } ? TActor : object, _holo_js_panels_core.OptionalRuntimeTypeValue<TTenantSource>>;
    <TModel extends _holo_js_panels_core.ResourceModel<_holo_js_panels_core.ResourceRecord, _holo_js_panels_core.ResourceQuery<unknown, _holo_js_panels_core.ResourceRecord>>>(model: TModel): _holo_js_panels_core.InferredResourceBuilder<TModel>;
};
type SimpleDefinition<TKind extends string> = Readonly<{
    definitionKind: TKind;
    id: string;
}>;
declare const defineAction: (id: string) => SimpleDefinition<"action">;
declare const defineColumn: (id: string) => SimpleDefinition<"column">;
declare const defineEntry: (id: string) => SimpleDefinition<"entry">;
declare const defineField: (id: string) => SimpleDefinition<"field">;
declare const defineFilter: (id: string) => SimpleDefinition<"filter">;
declare const defineCluster: (id: string) => DiscoverableDefinition<"cluster">;
declare const defineResourcePage: typeof definePage$1;
declare const defineWidget: (id: string) => DiscoverableDefinition<"widget">;
type RelationManagerDefinition<TRecord> = DiscoverableDefinition<'relation-manager'> & {
    readonly record?: TRecord;
};
declare function defineRelationManager<TSource extends DefinitionRecordSource>(id: string, source: TSource): RelationManagerDefinition<DefinitionRecord<TSource>>;
declare function defineRelationManager(id: string): RelationManagerDefinition<object>;

export { type ComponentDescriptor, type DefinitionRecord, type DefinitionRecordSource, type FieldDescriptor, type RelationManagerDefinition, SchemaDefinition, TableDefinition, column, defineAction, defineCluster, defineColumn, defineEntry, defineField, defineFilter, definePage, definePanel, defineRelationManager, defineResource, defineResourcePage, defineSchema, defineTable, defineWidget, field };
