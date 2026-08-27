import { F as FieldClientHints, a as FormFieldPath, b as FormFieldValue, B as BoundFormField, c as FieldResolvable, d as FieldResolver, C as CompiledFieldDefinition, e as FieldResolverContext, f as FieldPresentationState, g as FormFieldPathFor, R as RecordPath, h as RelationPath, i as RelatedRecord, j as RecordPathValue, k as FilterIndicatorResolver, l as CompiledFilterDefinition, m as FilterServerHandles, n as FilterEncoder, o as FilterManifest, O as OptionValue, p as ChoiceOption, q as OptionSource, r as OptionQueryRequest, s as OptionPage, t as OptionServiceLimits, H as HoloOptionQuery, u as RelationshipOptionAdapter, v as RelationshipOptionQueryModifier, w as RelationOperation, N as NormalizedRelationListRequest, x as RelationRecordPage, y as RelationPresentation, z as RelationListRequest, A as RecordPathFor, D as ColumnResolver, E as ColumnAlignment, G as ColumnDataSource, T as TextFormatter, I as InlineEditorManifest, J as CompiledColumnDefinition, K as ColumnAggregate, L as AdvancedOperatorFor, M as AdvancedScalarType, P as AdvancedFilterColumn, Q as AdvancedColumnMap, S as AdvancedFilterValue, U as AdvancedFilterCondition, V as DateRangeFilterValue, W as SelectFilterOption, X as FilterExecutionContext, Y as TernaryFilterValue, Z as TrashedFilterValue, _ as FilterResponsiveColumns, $ as FilterCollectionPlacement, a0 as FilterCollectionPresentation, a1 as FilterIndicator, a2 as P7AFilterCompatibility, a3 as TranslationReference, a4 as TranslationCatalog, a5 as RegisteredTranslations, a6 as TranslationArguments, a7 as TranslationMessage } from './browser-D21zTZ2u.js';
export { a8 as AnyAdvancedFilterColumn, a9 as BuiltInActionPresentation, aa as ColumnManifest, ab as ColumnServerHandles, ac as ErrorCategory, ad as ErrorEnvelope, ae as FieldLayout, af as FieldOperation, ag as FieldStateCodec, ah as FilterLayout, ai as FilterMode, aj as FormValues, ak as HoloOptionPage, al as IDEMPOTENCY_HEADER, am as InlineEditorKind, an as LocaleDirection, ao as ManifestSerializationError, ap as OptionDependencies, aq as PROTOCOL_VERSION, ar as PanelNotification, as as PanelNotificationAccessError, at as PanelNotificationInbox, au as PanelRecordTypeRegistry, av as PanelRelationValue, aw as PanelRelationValueMarker, ax as PanelsError, ay as PanelsTransportError, az as PluralCategory, aA as PluralTranslation, aB as ProtocolCompatibilityError, aC as ProtocolVersion, aD as RegisteredPanelRecord, aE as RegisteredPanelRecordForPath, aF as RegisteredPanelRecordForPathValue, aG as RegisteredPanelRecordPath, aH as RegisteredPanelRecordPathFor, aI as RelationshipOptionContext, aJ as RequestEnvelope, aK as ResponseEnvelope, aL as SchemaTraversalContext, aM as SuccessEnvelope, aN as SupportedFilterOperator, aO as TRANSLATION_REFERENCE_KIND, aP as TRANSPORT_REQUEST_FIELD, aQ as TableWidgetExecutor, aR as TranslationCatalogRegistry, aS as TranslationCatalogSet, aT as TranslationCatalogSource, aU as TranslationLookup, aV as TranslationReplacementMap, aW as TranslationReplacementNames, aX as TranslationReplacementValue, aY as TranslationReplacements, aZ as TransportDecodedRequest, a_ as TransportDecodingError, a$ as TransportOperation, b0 as TransportOperationKind, b1 as TransportRequestOptions, b2 as TransportServerRequestLike, b3 as TransportServerResult, b4 as WidgetAccessError, b5 as applySchemaManifestPatches, b6 as applySchemaNodePatches, b7 as assertJsonSafe, b8 as assertProtocolCompatible, b9 as assertUntranslatedStableKey, ba as builtInActionPresentation, bb as canonicalLocale, bc as createAccessibleChartModel, bd as createRequestEnvelope, be as createTranslationReference, bf as databaseNotificationPayload, bg as decodeRequestEnvelope, bh as decodeResponseEnvelope, bi as decodeTransportServerRequest, bj as defineTranslationCatalog, bk as defineTransportOperation, bl as evaluateSchemaVisibility, bm as findSchemaComponent, bn as isPanelDatabaseNotificationPayload, bo as isProtocolCompatible, bp as isTranslationReference, bq as normalizeTransportError, br as panelNotification, bs as parseProtocolVersion, bt as patchSchemaManifestNode, bu as patchSchemaNode, bv as renderAccessibleChart, bw as requireResolvedWidget, bx as resolveTableWidgetData, by as resolveWidget, bz as serializeManifest, bA as toJsonValue, bB as traverseSchema, bC as traverseSchemaManifest } from './browser-D21zTZ2u.js';
import { l as UploadMimeInspector, n as UploadPolicy, L as SchemaComponentKind, N as SchemaVisibilityResolver, Q as ResponsiveValue, V as SchemaColumnSpan, X as RenderSlotReference, Y as CompiledSchemaComponent, Z as SchemaComponentProperties, _ as SchemaLayoutProperties, $ as CustomComponentProperties, a0 as SchemaCollapseProperties, a1 as SchemaPath, t as CompiledSchema, a2 as SchemaBreakpoint, a3 as RecordTypeSource, a4 as RecordTypeValue, v as RuntimeTypeSource, x as RuntimeTypeValue, a5 as SchemaRenderSlots, a6 as RegisteredAction, a7 as ActionRegistration, a8 as WidgetServerHandles, a9 as WidgetColumnSpan, aa as WidgetFilterDefinition, C as CompiledWidgetDefinition, ab as WidgetFamily, ac as WidgetDataContext, w as ContextTypeSources, O as OptionalRuntimeTypeValue, ad as ChartWidgetData, s as ExtensionTypeId, ae as CustomWidgetData, af as StatsWidgetData, ag as TableWidgetData, W as WidgetContext, ah as WidgetManifest, ai as ActionDefinition, aj as ActionPresentationContext, ak as ActionResolvedState, al as ActionManifest, am as ActionResolvable, an as ActionContext, ao as ActionFailureNotification, ap as ActionModalOptions, aq as ActionMount, ar as ActionRateLimit, as as ActionSize, at as ActionSuccessNotification, au as ActionKind, av as ActionEngineOptions, b as ActionExecutionResult, a as ActionExecutionRequest, E as Effect, aw as ActionGroupItem, ax as ActionGroupManifest, z as ScopedRenderSlots, B as RenderHook, P as PluginCompatibility, J as PanelNotificationStore, ay as DashboardContext, az as DashboardNavigation, aA as CompiledDashboardDefinition, aB as WidgetResourcePlacement, aC as ResourceWidgetContext, aD as PanelNotificationScope } from './contracts-CYg6GYi6.js';
export { aE as AccessibleChartModel, aF as AccessibleChartRenderer, aG as AccessibleChartRow, aH as ActionItemResult, aI as ActionItemStatus, aJ as ActionModalManifest, aK as ActionModalWidth, aL as ActionNode, aM as ActionNotificationSender, aN as ActionPresentationDefinition, aO as ActionPresentationManifest, aP as ActionProperties, aQ as ActionRecordResolver, A as ActionTransaction, aR as ActionsRenderHook, aS as ChartPoint, aT as ChartSeries, aU as ClientRegistryReference, aV as CloseModalEffect, aW as ColumnNode, aX as ColumnProperties, aY as CompiledNode, c as CreateTemporaryUploadInput, aZ as DashboardManifest, D as DeleteTemporaryUploadInput, a_ as DownloadEffect, a$ as DuplicateRegistrationError, b0 as EntryNode, b1 as EntryProperties, b2 as ExportNode, b3 as ExportProperties, u as ExtensionRegistration, b4 as ExtensionRegistry, b5 as FieldNode, b6 as FieldProperties, b7 as FilterNode, b8 as FilterProperties, F as FinalizedUploadResult, b9 as FocusEffect, ba as ImportNode, bb as ImportProperties, bc as InvalidateTableEffect, bd as LayoutNode, be as LayoutProperties, bf as MediaAttachmentBuilder, y as MediaAttachmentResult, M as MediaAttachmentTarget, bg as MissingRendererError, bh as NavigationNode, bi as NavigationProperties, bj as NodeKind, bk as NotificationNode, bl as NotificationProperties, bm as PageNode, bn as PageProperties, bo as PanelDatabaseNotificationItem, K as PanelDatabaseNotificationPage, bp as PanelDatabaseNotificationPayload, bq as PanelNode, br as PanelNotificationAction, bs as PanelNotificationActionKind, bt as PanelNotificationAuthorization, G as PanelNotificationOperation, bu as PanelNotificationPresentation, H as PanelNotificationRecipient, bv as PanelNotificationRecipientResolver, bw as PanelNotificationRecord, bx as PanelNotificationStatus, by as PanelNotificationStorePage, bz as PanelNotificationStorePagination, bA as PanelNotificationStoreQuery, bB as PanelProperties, bC as PanelsRenderHook, bD as PluginCompatibilityError, bE as PublicNode, bF as PublicSourceLocation, bG as RedirectEffect, bH as RefreshEffect, bI as RegistryKind, bJ as RenderSlotSource, R as ResolveTemporaryUploadInput, bK as ResolvedWidget, bL as ResourceNode, bM as ResourceProperties, bN as SCHEMA_BREAKPOINTS, S as SchemaComponentManifest, bO as SchemaComponentPatch, bP as SchemaJsonValue, bQ as SchemaLeafKind, bR as SchemaLeafManifest, d as SchemaManifest, bS as SchemaNode, bT as SchemaProperties, bU as SchemaValueAtPath, bV as ScopedRenderSlotManifest, bW as ServerHandles, bX as SourceLocation, e as StoredUploadDescriptor, bY as SummaryNode, bZ as SummaryProperties, b_ as TableNode, b$ as TableProperties, c0 as TablesRenderHook, c1 as TargetedSchemaPatch, T as TemporaryUploadDescriptor, f as TemporaryUploadServiceOptions, I as ToastEffect, U as UploadActorContext, g as UploadAuthorizationRequest, h as UploadAuthorizer, i as UploadEndpointBody, j as UploadEndpointRequest, k as UploadEndpointResponse, m as UploadOperation, o as UploadStorageAdapter, p as UploadStorageListPage, q as UploadStorageListRequest, c2 as VersionRange, c3 as WidgetFilterState, c4 as WidgetLayout, c5 as WidgetNode, c6 as WidgetPolling, c7 as WidgetProperties, c8 as WidgetStat, c9 as WidgetsRenderHook, r as WriteTemporaryUploadInput, ca as assertPluginCompatible, cb as compileRegisteredActions, cc as createExtensionTypeId, cd as createSourceLocation, ce as exposeSourceLocation, cf as rendererRegistryName } from './contracts-CYg6GYi6.js';
import { W as ComponentDefault, X as DefaultableComponentKind, Y as PageServerHandles, Z as PageComponentBody, _ as PageResolvable, $ as PageContext, a0 as PageBreadcrumb, a1 as PageNavigation, a2 as PageRendererManifest, a as CompiledPageDefinition, a3 as PageType, a4 as PageNavigationInput, a5 as PanelNavigationSeed, a6 as PanelAccessContext, a7 as PanelActorPresenter, a8 as CompiledPanelAuth, a9 as PanelAuthPageConfiguration, aa as PanelAsset, ab as PanelBootContext, ac as PanelBranding, ad as PanelComponentConfiguration, ae as PanelDatabaseNotificationConfiguration, af as PanelDatabaseNotificationInboxOptions, ag as PanelContentWidth, ah as PanelSubNavigationPosition, ai as PanelMiddleware, aj as PanelNavigationGroup, ak as PanelNavigationMode, al as PanelRouteScope, am as PanelRouteRegistrar, an as PanelPlugin, ao as PanelRegisteredDefinition, ap as PanelTheme, aq as PanelAuthenticatedScope, ar as CompiledPanelTenancy, as as PanelTenantBillingProvider, at as PanelTenantMenuItem, au as PanelUserMenuItem, C as CompiledPanelDefinition, av as PanelLoginPageConfiguration, aw as PanelRegistrationPageConfiguration, ax as PanelPasswordResetPageConfiguration, ay as PanelEmailVerificationPageConfiguration, az as PanelEmailChangeVerificationPageConfiguration, aA as PanelMultiFactorPageConfiguration, aB as PanelTenantIdentifier, aC as PanelTenancyOptions, aD as PanelModelTenancyOptions, aE as PanelTokenTheme, aF as PanelPluginInstallation, aG as PanelRouteMethod, aH as PanelTenantExecutionContext } from './operation-DiqaGg88.js';
export { aI as CompiledPanelRoute, E as ExecutePanelAuthOperationOptions, aJ as ExecutePanelDatabaseNotificationOperationOptions, b as ExecutePanelTenantOperationOptions, c as ExecutePanelTenantSwitchOptions, aK as GeneratedGlobalSearchInput, G as GeneratedResourceOperationInput, d as GeneratedResourceOperationResult, e as GeneratedUploadOperationInput, H as HoloAuth, aL as HoloAuthGuard, P as PANELS_CLEAN_TEMPORARY_UPLOADS_JOB, aM as PageAccessError, aN as PageManifest, aO as PanelActiveTenantPersistence, aP as PanelAssetKind, aQ as PanelAssetManifest, aR as PanelAuthContext, g as PanelAuthOperation, h as PanelAuthOperationOutcome, aS as PanelAuthPresentation, aT as PanelAuthorizationLayer, aU as PanelAuthorizationRequest, aV as PanelBootstrap, aW as PanelDarkMode, aX as PanelDatabaseNotificationIdentity, j as PanelDatabaseNotificationOperationResult, aY as PanelDatabaseNotificationPlacement, aZ as PanelErrorNotification, a_ as PanelErrorNotificationConfiguration, a$ as PanelGeneratorTemplate, b0 as PanelGlobalSearchConfiguration, b1 as PanelIconDefinition, b2 as PanelIconPath, b3 as PanelLayoutConfiguration, b4 as PanelLogoutPageConfiguration, b5 as PanelManifest, b6 as PanelMiddlewareContext, b7 as PanelNotificationBootstrap, b8 as PanelNotificationRequestError, b9 as PanelOperation, ba as PanelPackageModuleContribution, bb as PanelPermissionSubject, bc as PanelPluginAsset, bd as PanelPluginBuilder, be as PanelPluginContribution, bf as PanelPluginContributionDefinition, bg as PanelPluginIcon, bh as PanelProfilePageConfiguration, bi as PanelQueuedTenantContext, bj as PanelRendererFramework, bk as PanelRendererRegistration, bl as PanelResolvedTenant, bm as PanelRouteHandler, bn as PanelRouteRegistry, bo as PanelRoutingConfiguration, k as PanelRuntime, bp as PanelRuntimeConfiguration, l as PanelRuntimeError, bq as PanelSubscriptionRequiredError, br as PanelTenancyManifest, bs as PanelTenantBootstrap, bt as PanelTenantIdentity, bu as PanelTenantMembershipPage, bv as PanelTenantMembershipRequest, m as PanelTenantOperation, n as PanelTenantOperationError, bw as PanelTenantOperationFailure, o as PanelTenantOperationResult, bx as PanelTenantPresentation, by as PanelTenantPresentationInput, bz as PanelTenantPresentationPage, bA as PanelTenantProfileOptions, bB as PanelTenantRegistrationOptions, bC as PanelTenantScopedQuery, p as PanelTenantSwitchResult, bD as PanelThemeMode, bE as PanelTranslationContribution, bF as PanelsConfiguration, bG as ResolvedPageData, bH as ResolvedPanelRoute, R as ResourceExecutor, bI as ResourceExecutorOptions, bJ as ResourceInputError, bK as ResourceMutationResult, bL as ResourceNestedExecution, bM as ResourceRecordNotFoundError, bN as ResourceTableResult, T as TemporaryUploadService, U as UploadStoragePaginationError, q as bootPanel, bO as compilePanelRoutes, bP as compiledPanelRoutePath, bQ as componentDefault, r as createGeneratedResourcePage, s as createHoloUploadStorage, u as createTemporaryUploadService, bR as definePanelPlugin, bS as definePanelsConfig, v as executeGeneratedGlobalSearch, w as executeGeneratedResourceOperation, x as executeGeneratedUploadOperation, y as executePanelAuthOperation, z as executePanelDatabaseNotificationOperation, B as executePanelPipeline, D as executePanelRoute, F as executePanelTenantOperation, I as executePanelTenantSwitch, bT as generatedResourcePageManifests, J as handleUploadEndpoint, K as panelAuthOperationStatus, bU as panelAuthPresentation, L as panelErrorNotificationEffect, M as panelTenantOperationStatus, N as preparePageRoutes, bV as resolveGeneratedResourceWidget, O as resolvePageData, Q as resolvePanelRoute, S as runTemporaryUploadCleanupJob, V as toSchemaManifest } from './operation-DiqaGg88.js';
import { D as DiscoverableDefinition, j as DiscoverableBuilder, k as DiscoverableKind, l as ResourceCompositionTypes, m as ResourceAttributes, a as DiscoveryDirectories, b as ResourceModel, c as ResourceRecord, d as ResourceQuery, n as ResourceModelDefinition, o as ResourceInput, R as ResourceExecutionContext, p as ResourceGlobalSearch, q as ResourceLifecycle, r as ResourceNavigation, C as CompiledNestedResource, s as ResourcePersistence, t as ResourceAttribute, S as SingularResourceOptions, u as ResourceValidation, N as NestedResourceOptions, v as ResourceParentReference, e as ResourceDefinition, w as ResourceRecordFor } from './contracts-B3BQFMw6.js';
export { x as ClientManifestValue, y as DISCOVERABLE_KINDS, z as DISCOVERY_MARKER, f as ResourceAuthorization, A as ResourceCapabilities, B as ResourceClientManifest, g as ResourceIdentifier, E as ResourceOperation, h as ResourceParentRegistry, i as ResourceTransaction } from './contracts-B3BQFMw6.js';
export { CompiledExportColumn, CompiledExportFormat, CompiledImportColumn, CompiledImportFormat, CsvExportOptions, CsvImportLimits, CsvImportOptions, ExecuteTransferExportRequest, ExportAggregateKind, ExportAggregatePlan, ExportCell, ExportColumnBatchContext, ExportColumnBatchValueContext, ExportColumnBuilder, ExportColumnManifest, ExportColumnOption, ExportEngineError, ExportEngineErrorCode, ExportFormatAdapter, ExportFormatArtifact, ExportFormatInput, ExportPathValue, ExportQueryAdapter, ExportRecordPath, ExportRelationPath, ExporterBuilder, ExporterDefinition, ExporterManifest, ExporterServerDefinition, FinalizeTransferExportPartsOptions, HoloTransferCompletionNotifier, HoloTransferNotificationDefinitions, HoloTransferStorageOptions, HoloTransferStoreOptions, ImportColumnBuilder, ImportColumnManifest, ImportFormatAdapter, ImportFormatInspection, ImportLimits, ImportMutationAdapter, ImportMutationDecision, ImportRowExecutionContext, ImporterBuilder, ImporterDefinition, ImporterManifest, ImporterServerDefinition, PersistTransferExportPartOptions, StartExportRequest, StartImportRequest, TransferArtifactDigest, TransferArtifactWriter, TransferCompletionNotifier, TransferExecutionContext, TransferExecutionInput, TransferExportChunk, TransferExportExecutionInput, TransferExportResult, TransferFailureRows, TransferIdentity, TransferIdentityValue, TransferImportExecutionInput, TransferInputSource, TransferNextChunk, TransferOperationIdentity, TransferOperationKind, TransferOperationProgress, TransferOperationRecord, TransferOperationRequest, TransferOperationStatus, TransferOperationStore, TransferOutboxDispatchResult, TransferOutboxDispatcher, TransferOutboxDispatcherOptions, TransferOutboxEvent, TransferOutboxFailure, TransferOutboxLease, TransferOutboxRecord, TransferPartsError, TransferPartsErrorCode, TransferPolicy, TransferProgressTransition, TransferQueueAdapter, TransferQueueConfiguration, TransferQueueEnvelope, TransferResultPart, TransferRetentionConfiguration, TransferSanitizedError, TransferSnapshotError, TransferStorageAdapter, TransferStorageConfiguration, TransferStorageError, TransferStoredArtifact, TransferUploadResolver, WriteTransferResultPartOptions, XlsxExportOptions, createHoloTransferOperationStore, createHoloTransferStorage, createPanelTransferTables, csvExportFormat, csvImportFormat, defineExporter, defineImporter, executeTransferExport, finalizeTransferExportParts, holoTransferCompletionNotifier, persistTransferExportPart, readTransferResultParts, snapshotTransferUpload, transferDefinitionRevision, writeTransferResultPart, xlsxExportFormat } from './transfers.js';
import { FieldDefinition, FormSchema, InferFormData, WebFileLike, StandardSchemaV1Issue } from '@holo-js/forms';
import { J as JsonObject, a as JsonValue, b as TableQueryFilterDefinition, H as HoloTableQuery, c as TableQueryDefinition, T as TableQueryState, d as TableQueryResult, e as TableRecordIdentifier, f as TableSelection, g as JsonPrimitive, h as TableFilterOperator, i as TableQueryFilter } from './contracts-lajC9c3H.js';
export { A as AllTableQueryResult, C as CursorTableQueryResult, j as HoloCursorPaginatedResult, k as HoloPaginatedResult, l as HoloPaginationMeta, m as HoloSimplePaginatedResult, n as HoloSimplePaginationMeta, o as JsonArray, P as PageTableQueryResult, S as SimpleTableQueryResult, p as TableAggregateKind, q as TablePaginationMode, r as TableQueryAggregateDefinition, s as TableQueryColumnDefinition, t as TableQueryScalar, u as TableQuerySort, v as TableSortDirection } from './contracts-lajC9c3H.js';
import { AuthUser } from '@holo-js/auth';
import { RelationDefinition } from '@holo-js/db';
import '@holo-js/notifications';

declare function deriveFieldClientHints(definition: FieldDefinition): FieldClientHints;
declare function deriveSchemaDefault<TValue>(definition: FieldDefinition): TValue | undefined;

declare abstract class FieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue = FormFieldValue<TValues, TPath>, TType extends string = string, TRecord = unknown> {
    #private;
    readonly resourceRecordType: TValues;
    readonly path: TPath;
    readonly type: TType;
    readonly schema: FieldDefinition;
    protected constructor(type: TType, binding: BoundFormField<TValues, TPath>);
    label(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this;
    helperText(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this;
    hint(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this;
    placeholder(value: FieldResolvable<TValues, TPath, string | null, TRecord>): this;
    default(value: FieldResolvable<TValues, TPath, TValue, TRecord>): this;
    visible(value?: FieldResolvable<TValues, TPath, boolean, TRecord>): this;
    hidden(value?: FieldResolvable<TValues, TPath, boolean, TRecord>): this;
    disabled(value?: FieldResolvable<TValues, TPath, boolean, TRecord>): this;
    readOnly(value?: FieldResolvable<TValues, TPath, boolean, TRecord>): this;
    required(value?: boolean): this;
    dependsOn(...paths: readonly FormFieldPath<TValues>[]): this;
    debounce(milliseconds: number): this;
    columnSpan(value: number | 'full'): this;
    columnStart(value: number): this;
    hydrate(resolver: FieldResolver<TValues, TPath, TValue, TRecord>): this;
    dehydrate(resolver: FieldResolver<TValues, TPath, TValue | undefined, TRecord>): this;
    extraAttributes(value: Readonly<Record<string, unknown>>): this;
    compile(): CompiledFieldDefinition<TValues, TPath, TValue, TRecord>;
    protected assertMutable(): void;
    protected fieldProperties(): JsonObject;
    protected abstract assertSchemaKind(definition: FieldDefinition): void;
}

declare function hydrateFieldValue<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown>(definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>, context: FieldResolverContext<TValues, TPath, TRecord>): Promise<TValue>;
declare function resolveFieldDefault<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown>(definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>, context: FieldResolverContext<TValues, TPath, TRecord>): Promise<TValue | undefined>;
declare function dehydrateFieldValue<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown>(definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>, context: FieldResolverContext<TValues, TPath, TRecord>): Promise<TValue | undefined>;
declare function resolveFieldPresentationState<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown>(definition: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>, context: FieldResolverContext<TValues, TPath, TRecord>, errors?: readonly string[]): Promise<FieldPresentationState<TValue>>;

declare class FormSchemaBinding<TSchema extends FormSchema> {
    readonly schema: TSchema;
    constructor(schema: TSchema);
    bind<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): BoundFormField<InferFormData<TSchema>, TPath>;
}
declare function bindFormSchema<TSchema extends FormSchema>(schema: TSchema): FormSchemaBinding<TSchema>;

interface ComponentDefaultLayers {
    readonly application?: readonly ComponentDefault[];
    readonly panel?: readonly ComponentDefault[];
    readonly plugins?: readonly (readonly ComponentDefault[])[];
}
declare function withComponentDefaults<TResult>(layers: ComponentDefaultLayers, callback: () => TResult | Promise<TResult>): Promise<TResult>;

declare function isDiscoverableKind(value: unknown): value is DiscoverableKind;
declare function isDiscoverableDefinition(value: unknown): value is DiscoverableDefinition;
declare function isDiscoverableBuilder(value: unknown): value is DiscoverableBuilder;
declare function isPanelDefinition(value: unknown): value is DiscoverableDefinition<'panel'>;
declare function isResourceDefinition(value: unknown): value is DiscoverableDefinition<'resource'>;
declare function isPageDefinition(value: unknown): value is DiscoverableDefinition<'page'>;
declare function isWidgetDefinition(value: unknown): value is DiscoverableDefinition<'widget'>;
declare function isClusterDefinition(value: unknown): value is DiscoverableDefinition<'cluster'>;
declare function isRelationManagerDefinition(value: unknown): value is DiscoverableDefinition<'relation-manager'>;
declare function isPluginDefinition(value: unknown): value is DiscoverableDefinition<'plugin'>;
declare function isImportDefinition(value: unknown): value is DiscoverableDefinition<'import'>;
declare function isExportDefinition(value: unknown): value is DiscoverableDefinition<'export'>;
declare function markDiscoverableDefinition<TDefinition extends Omit<DiscoverableDefinition, 'discoveryMarker'>>(definition: TDefinition): Readonly<TDefinition & Pick<DiscoverableDefinition, 'discoveryMarker'>>;

type DeepReadonly<TValue> = TValue extends string | number | boolean | bigint | symbol | null | undefined ? TValue : TValue extends (...parameters: never[]) => unknown ? TValue : TValue extends readonly (infer TItem)[] ? readonly DeepReadonly<TItem>[] : TValue extends object ? string extends keyof TValue ? TValue : {
    readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]>;
} : TValue;

declare abstract class ConstructionBuilder<TState extends object, TDefinition extends object> {
    #private;
    protected constructor(initialState: TState);
    compile(): DeepReadonly<TDefinition>;
    protected abstract createDefinition(state: Readonly<TState>): TDefinition;
    protected configureComponentDefaults(kind: DefaultableComponentKind, type: string): void;
    protected readState(): Readonly<TState>;
    protected registerInvariant(name: string, invariant: (state: Readonly<TState>) => void): void;
    protected writeState<TKey extends keyof TState>(key: TKey, value: TState[TKey]): this;
    private applyDefaults;
}

declare function defineUploadPolicy(policy: UploadPolicy): UploadPolicy;
declare const defaultUploadMimeInspector: UploadMimeInspector;
declare function uploadExtension(fileName: string): string;

declare class UploadFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TRecord = unknown> extends FieldBuilder<TValues, TPath, FormFieldValue<TValues, TPath>, 'panels:field:upload', TRecord> {
    readonly policy: UploadPolicy;
    constructor(binding: BoundFormField<TValues, TPath>, policy: UploadPolicy);
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
type UploadFieldValue = WebFileLike | readonly WebFileLike[];
declare class UploadFieldFactory<TSchema extends FormSchema> {
    #private;
    constructor(schema: TSchema);
    file<TPath extends FormFieldPathFor<InferFormData<TSchema>, UploadFieldValue>>(path: TPath, policy: UploadPolicy): UploadFieldBuilder<InferFormData<TSchema>, TPath>;
}
declare function uploadFields<TSchema extends FormSchema>(schema: TSchema): UploadFieldFactory<TSchema>;

interface CapabilityHost<TState extends object> {
    addInvariant(name: string, invariant: (state: Readonly<TState>) => void): void;
    change<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void;
}
interface LabelState {
    label: string | null;
}
interface VisibilityState {
    hidden: boolean;
}
declare class LabelCapability<THost, TState extends LabelState> {
    #private;
    constructor(host: THost & CapabilityHost<TState>);
    readonly label: (value: string | null) => THost;
}
declare class VisibilityCapability<THost, TState extends VisibilityState> {
    #private;
    constructor(host: THost & CapabilityHost<TState>);
    readonly hidden: (value?: boolean) => THost;
    readonly visible: (value?: boolean) => THost;
}

declare function assignStableKey(kind: string, explicitKey: string | undefined, position: readonly (number | string)[]): string;
declare function assignStableId(namespace: string, kind: string, key: string): string;

type DefaultPanelActor = AuthUser;
type DefaultPanelTenant = string;
type DefaultPanelServices = unknown;

interface ComponentCompileContext {
    readonly schemaId: string;
    readonly parentId: string;
    readonly parentPath?: string;
    readonly position: readonly number[];
}
declare abstract class SchemaComponentBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown, TKind extends SchemaComponentKind = SchemaComponentKind> {
    #private;
    readonly kind: TKind;
    protected readonly valueType: TValues;
    protected constructor(kind: TKind);
    key(value: string): this;
    statePath(value: string): this;
    visible(value?: boolean | SchemaVisibilityResolver<TContext>): this;
    hidden(value?: boolean | SchemaVisibilityResolver<TContext>): this;
    columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this;
    columnStart(value: ResponsiveValue<number>): this;
    order(value: ResponsiveValue<number>): this;
    extraAttributes(value: Readonly<Record<string, unknown>>): this;
    before(reference: string | RenderSlotReference): this;
    after(reference: string | RenderSlotReference): this;
    above(reference: string | RenderSlotReference): this;
    below(reference: string | RenderSlotReference): this;
    compileComponent(context: ComponentCompileContext): CompiledSchemaComponent<TContext>;
    protected assertMutable(): void;
    protected configureComponentDefaultType(type: string): void;
    protected componentType(): string;
    protected componentProperties(): SchemaComponentProperties;
    protected layoutProperties(): SchemaLayoutProperties;
    protected compileChildren(_context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[];
    private setSlot;
}
declare class ContainerComponentBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown, TKind extends SchemaComponentKind = SchemaComponentKind> extends SchemaComponentBuilder<TValues, TContext, TKind> {
    #private;
    protected constructor(kind: TKind, children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    schema(children: readonly SchemaComponentBuilder<TValues, TContext>[]): this;
    protected compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[];
}
declare class GridBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends ContainerComponentBuilder<TValues, TContext, 'grid'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    columns(value: ResponsiveValue<number>): this;
    protected layoutProperties(): SchemaLayoutProperties;
}
declare abstract class CollapsibleContainerBuilder<TValues, TContext, TKind extends 'fieldset' | 'group' | 'section'> extends ContainerComponentBuilder<TValues, TContext, TKind> {
    #private;
    collapsible(value?: boolean): this;
    collapsed(value?: boolean): this;
    persistCollapse(key: string): this;
    protected collapseProperties(): SchemaCollapseProperties;
}
declare class SectionBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends CollapsibleContainerBuilder<TValues, TContext, 'section'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    heading(value: string | null): this;
    description(value: string | null): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class GroupBuilder$1<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends CollapsibleContainerBuilder<TValues, TContext, 'group'> {
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    protected componentProperties(): SchemaComponentProperties;
}
declare class FieldsetBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends CollapsibleContainerBuilder<TValues, TContext, 'fieldset'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    label(value: string | null): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class PersistentContainerBuilder<TValues, TContext, TKind extends 'tabs' | 'wizard'> extends ContainerComponentBuilder<TValues, TContext, TKind> {
    #private;
    persist(key: string): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class TabsBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends PersistentContainerBuilder<TValues, TContext, 'tabs'> {
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    protected compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[];
}
declare class TabBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends ContainerComponentBuilder<TValues, TContext, 'tab'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    label(value: string): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class WizardBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends PersistentContainerBuilder<TValues, TContext, 'wizard'> {
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    protected compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[];
}
declare class StepBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends ContainerComponentBuilder<TValues, TContext, 'step'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    label(value: string): this;
    description(value: string | null): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class SplitBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends ContainerComponentBuilder<TValues, TContext, 'split'> {
    #private;
    constructor(children?: readonly SchemaComponentBuilder<TValues, TContext>[]);
    from(value: SchemaBreakpoint): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare abstract class MessageComponentBuilder<TValues, TContext, TKind extends 'callout' | 'empty-state'> extends SchemaComponentBuilder<TValues, TContext, TKind> {
    #private;
    heading(value: string): this;
    description(value: string | null): this;
    icon(value: string | null): this;
    protected messageProperties(): SchemaComponentProperties;
}
declare class CalloutBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends MessageComponentBuilder<TValues, TContext, 'callout'> {
    #private;
    constructor();
    color(value: string | null): this;
    protected componentProperties(): SchemaComponentProperties;
}
declare class EmptyStateBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends MessageComponentBuilder<TValues, TContext, 'empty-state'> {
    constructor();
    protected componentProperties(): SchemaComponentProperties;
}
declare class CustomComponentBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> extends SchemaComponentBuilder<TValues, TContext, 'custom'> {
    #private;
    constructor(customType: string);
    properties(value: CustomComponentProperties): this;
    protected componentType(): string;
    protected componentProperties(): SchemaComponentProperties;
}
declare class SchemaBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> {
    #private;
    readonly resourceRecordType: TValues;
    constructor(id: string);
    statePath<TPath extends SchemaPath<TValues>>(value: TPath): this;
    components(components: readonly SchemaComponentBuilder<TValues, TContext>[]): this;
    schema(components: readonly SchemaComponentBuilder<TValues, TContext>[]): this;
    compile(): CompiledSchema<TValues, TContext>;
    private assertMutable;
}
type SchemaTypeSource<TValue extends object> = RecordTypeSource & ({
    readonly prototype: TValue;
} | {
    create(...parameters: never[]): TValue | Promise<TValue>;
});
declare function defineSchema<TValuesSource extends RecordTypeSource>(id: string, values: TValuesSource): SchemaBuilder<RecordTypeValue<TValuesSource>, unknown>;
declare function defineSchema<TValuesSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource>(id: string, values: TValuesSource, context: TContextSource): SchemaBuilder<RecordTypeValue<TValuesSource>, RuntimeTypeValue<TContextSource>>;
declare function defineSchema(id?: string): SchemaBuilder<Readonly<Record<string, unknown>>, unknown>;

type EntryRecordPath<TRecord> = RecordPath<TRecord>;
type EntryRecordPathValue<TRecord, TPath extends EntryRecordPath<TRecord>> = RecordPathValue<TRecord, TPath>;
type EntryRelationPath<TRecord> = RelationPath<TRecord>;
type EntryRelatedRecord<TValue> = RelatedRecord<TValue>;
interface EntryResolverContext$1<TRecord, TValue> {
    readonly locale: string;
    readonly record: Readonly<TRecord>;
    readonly value: TValue;
}
type EntryResolver<TRecord, TValue, TResult> = (context: EntryResolverContext$1<TRecord, TValue>) => TResult | Promise<TResult>;
type EntryStateSource = {
    readonly kind: 'computed';
    readonly id: string;
} | {
    readonly kind: 'json';
    readonly path: string;
} | {
    readonly kind: 'path';
    readonly path: string;
} | {
    readonly kind: 'relationship';
    readonly path: string;
    readonly titlePath: string;
};
interface EntryFormat extends JsonObject {
    readonly kind: string;
}
interface EntryManifest {
    readonly actions: readonly string[];
    readonly copyable: boolean;
    readonly defaultValue: JsonValue;
    readonly dynamicVisibility: boolean;
    readonly extraAttributes: JsonObject;
    readonly formatters: readonly EntryFormat[];
    readonly inlineLabel: boolean;
    readonly label: string | null;
    readonly layout: SchemaLayoutProperties;
    readonly path: string | null;
    readonly placeholder: string | null;
    readonly properties: JsonObject;
    readonly source: EntryStateSource;
    readonly slots: SchemaRenderSlots;
    readonly type: string;
    readonly visible: boolean;
}
interface EntryServerHandles<TRecord, TValue> {
    readonly actions?: readonly RegisteredAction<TRecord>[];
    readonly visibility?: EntryResolver<TRecord, TValue, boolean>;
    readonly state?: EntryResolver<TRecord, TValue, unknown>;
    readonly tooltip?: EntryResolver<TRecord, TValue, string | null>;
    readonly url?: EntryResolver<TRecord, TValue, string | null>;
}
interface CompiledEntryDefinition<TRecord, TValue, TType extends string = string> {
    readonly kind: 'entry';
    readonly manifest: EntryManifest & {
        readonly type: TType;
    };
    readonly server: EntryServerHandles<TRecord, TValue>;
}
interface EntryRendererProps<TState = JsonValue> {
    readonly actions: readonly string[];
    readonly copyable: boolean;
    readonly label: string | null;
    readonly state: TState;
    readonly tooltip: string | null;
    readonly url: string | null;
}
interface EntryRendererRegistration<TType extends string = string> {
    readonly type: TType;
    readonly source: string;
}
interface EntryRendererRegistryContract<TRenderer> {
    has(type: string): boolean;
    register<TType extends string>(registration: EntryRendererRegistration<TType>, renderer: TRenderer): () => void;
    resolve(type: string, requestedFrom?: string): TRenderer;
}

interface EntryState<TRecord, TValue> {
    actions: string[];
    registeredActions: ActionRegistration<TRecord>[];
    copyable: boolean;
    defaultValue: JsonValue;
    extraAttributes: JsonObject;
    formatters: EntryFormat[];
    inlineLabel: boolean;
    label: string | null;
    columnSpan?: ResponsiveValue<SchemaColumnSpan>;
    columnStart?: ResponsiveValue<number>;
    placeholder: string | null;
    source: EntryStateSource;
    slots: SchemaRenderSlots;
    state?: EntryResolver<TRecord, TValue, unknown>;
    tooltip?: EntryResolver<TRecord, TValue, string | null>;
    url?: EntryResolver<TRecord, TValue, string | null>;
    visibility: boolean | EntryResolver<TRecord, TValue, boolean>;
}
declare abstract class EntryBuilder<TRecord, TValue, TType extends string> extends ConstructionBuilder<EntryState<TRecord, TValue>, CompiledEntryDefinition<TRecord, TValue, TType>> {
    #private;
    readonly resourceRecordType: TRecord;
    protected constructor(type: TType, source: EntryStateSource);
    label(value: string | null): this;
    inlineLabel(value?: boolean): this;
    copyable(value?: boolean): this;
    visible(value?: boolean | EntryResolver<TRecord, TValue, boolean>): this;
    hidden(value?: boolean | EntryResolver<TRecord, TValue, boolean>): this;
    columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this;
    columnStart(value: ResponsiveValue<number>): this;
    extraAttributes(value: Readonly<Record<string, unknown>>): this;
    before(reference: string | RenderSlotReference): this;
    after(reference: string | RenderSlotReference): this;
    above(reference: string | RenderSlotReference): this;
    below(reference: string | RenderSlotReference): this;
    placeholder(value: string | null): this;
    default(value: unknown): this;
    state(resolver: EntryResolver<TRecord, TValue, unknown>, id?: string): this;
    field<const TPath extends EntryRecordPath<TRecord>>(path: TPath): this;
    json<const TPath extends EntryRecordPath<TRecord>>(path: TPath): this;
    relationship<const TRelationPath extends EntryRelationPath<TRecord>, const TTitlePath extends EntryRecordPath<EntryRelatedRecord<EntryRecordPathValue<TRecord, TRelationPath>>>>(path: TRelationPath, titlePath: TTitlePath): this;
    tooltip(value: string | null | EntryResolver<TRecord, TValue, string | null>): this;
    url(value: string | null | EntryResolver<TRecord, TValue, string | null>): this;
    action(action: string | ActionRegistration<TRecord>): this;
    protected addFormat(formatter: EntryFormat): this;
    protected createDefinition(state: Readonly<EntryState<TRecord, TValue>>): CompiledEntryDefinition<TRecord, TValue, TType>;
    protected configuration(value: JsonObject): this;
    private setSlot;
}

declare abstract class FilterBuilder<TValue extends JsonValue, TType extends string, TContext = unknown> {
    #private;
    readonly id: string;
    readonly type: TType;
    protected constructor(id: string, type: TType, defaultValue: TValue);
    label(value: string | null): this;
    default(value: TValue): this;
    live(value?: boolean): this;
    deferred(value?: boolean): this;
    columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this;
    columnStart(value: ResponsiveValue<number>): this;
    indicator(resolver: FilterIndicatorResolver<TValue, TContext>): this;
    compile(): CompiledFilterDefinition<TValue, TType, TContext>;
    protected assertMutable(): void;
    protected properties(): JsonObject;
    protected additionalServerHandles(): Partial<FilterServerHandles<TValue, TContext>>;
    protected abstract queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected abstract encoder(): FilterEncoder<TValue, TContext>;
}

interface WidgetState<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object> {
    actions: readonly ActionRegistration<TRecord>[];
    authorize: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['authorize'];
    columnSpan: WidgetColumnSpan;
    columnStart: number | null;
    data: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['data'];
    description: string | null;
    emptyState: string;
    errorState: string;
    filters: WidgetFilterDefinition[];
    heading: string | null;
    lazy: boolean;
    pollingInterval: number | null;
    sort: number;
    visible: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['visible'];
}
declare class WidgetBuilder<TData extends JsonValue, TActor = unknown, TTenant = unknown, TServices = unknown, TRecord extends object = object> extends ConstructionBuilder<WidgetState<TData, TActor, TTenant, TServices, TRecord>, CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>> implements DiscoverableBuilder<'widget'> {
    readonly id: string;
    readonly family: WidgetFamily;
    readonly type: string;
    readonly resourceCompositionTypes: ResourceCompositionTypes<TRecord, TActor, TTenant, TServices>;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "widget";
    constructor(id: string, family: WidgetFamily, type: string);
    heading(value: string | null): this;
    actions(actions: readonly ActionRegistration<TRecord>[]): this;
    description(value: string | null): this;
    sort(value: number): this;
    columnSpan(value: WidgetColumnSpan): this;
    columnStart(value: number | null): this;
    lazy(value?: boolean): this;
    poll(interval: number | null): this;
    visible(resolver: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['visible']): this;
    authorize(resolver: WidgetServerHandles<TData, TActor, TTenant, TServices, TRecord>['authorize']): this;
    data(resolver: (context: WidgetDataContext<TActor, TTenant, TServices, TRecord>) => TData | Promise<TData>): this;
    filter(id: string, label: string, defaultValue?: JsonValue): this;
    emptyState(message: string): this;
    errorState(message: string): this;
    compileDiscoveryDefinition(): DiscoverableDefinition<'widget'>;
    protected createDefinition(state: Readonly<WidgetState<TData, TActor, TTenant, TServices, TRecord>>): CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>;
}
type WidgetFromSources<TData extends JsonValue, TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined, TServicesSource extends RuntimeTypeSource | undefined> = WidgetBuilder<TData, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
type WidgetFactory<TData extends JsonValue> = {
    <TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>): WidgetFromSources<TData, TActorSource, TTenantSource, TServicesSource>;
    (id: string): WidgetBuilder<TData, unknown, unknown, unknown>;
};
declare const defineStatsWidget: WidgetFactory<StatsWidgetData>;
declare const defineChartWidget: WidgetFactory<ChartWidgetData>;
declare const defineTableWidget: WidgetFactory<TableWidgetData>;
declare function defineCustomWidget<TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>, type?: ExtensionTypeId<'widget'>): WidgetFromSources<CustomWidgetData, TActorSource, TTenantSource, TServicesSource>;
declare function defineCustomWidget(id: string, type?: ExtensionTypeId<'widget'>): WidgetBuilder<CustomWidgetData, unknown, unknown, unknown>;
interface ResourceWidgetTypeSources<TRecordSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined> {
    readonly actor?: TActorSource;
    readonly record: TRecordSource;
    readonly services?: TServicesSource;
    readonly tenant?: TTenantSource;
}
type ResourceWidgetFromSources<TData extends JsonValue, TRecordSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource | undefined, TTenantSource extends RuntimeTypeSource | undefined, TServicesSource extends RuntimeTypeSource | undefined> = WidgetBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>, Readonly<ResourceAttributes<RecordTypeValue<TRecordSource>>>>;
type ResourceWidgetFactory<TData extends JsonValue> = <TRecordSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ResourceWidgetTypeSources<TRecordSource, TActorSource, TTenantSource, TServicesSource>) => ResourceWidgetFromSources<TData, TRecordSource, TActorSource, TTenantSource, TServicesSource>;
declare const defineResourceStatsWidget: ResourceWidgetFactory<StatsWidgetData>;
declare const defineResourceChartWidget: ResourceWidgetFactory<ChartWidgetData>;
declare const defineResourceTableWidget: ResourceWidgetFactory<TableWidgetData>;
declare function defineResourceCustomWidget<TRecordSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ResourceWidgetTypeSources<TRecordSource, TActorSource, TTenantSource, TServicesSource>, type?: string): ResourceWidgetFromSources<CustomWidgetData, TRecordSource, TActorSource, TTenantSource, TServicesSource>;
declare function widgetContext<TActor, TTenant, TServices>(context: WidgetContext<TActor, TTenant, TServices>): WidgetContext<TActor, TTenant, TServices>;

interface EntrySchemaSource {
    compile(): Readonly<{
        kind: 'entry';
        manifest: DeepReadonly<EntryManifest>;
    }>;
}
interface FilterSchemaSource {
    compile(): Readonly<{
        kind: 'filter';
        manifest: FilterManifest;
    }>;
}
interface WidgetSchemaSource {
    compile(): Readonly<{
        kind: 'widget';
        manifest: DeepReadonly<WidgetManifest>;
    }>;
}
type EntryRecord<TSource> = TSource extends EntryBuilder<infer TRecord, infer _TValue, infer _TType> ? TRecord : Readonly<Record<string, unknown>>;
type EntryValue<TSource> = TSource extends EntryBuilder<infer _TRecord, infer TValue, infer _TType> ? TValue : JsonValue;
type FilterValue<TSource> = TSource extends FilterBuilder<infer TValue, infer _TType, infer _TContext> ? TValue : JsonValue;
type FilterContext<TSource> = TSource extends FilterBuilder<infer _TValue, infer _TType, infer TContext> ? TContext : unknown;
type WidgetData<TSource> = TSource extends WidgetBuilder<infer TData, infer _TActor, infer _TTenant, infer _TServices, infer _TRecord> ? TData : JsonValue;
type WidgetActor<TSource> = TSource extends WidgetBuilder<infer _TData, infer TActor, infer _TTenant, infer _TServices, infer _TRecord> ? TActor : unknown;
type WidgetTenant<TSource> = TSource extends WidgetBuilder<infer _TData, infer _TActor, infer TTenant, infer _TServices, infer _TRecord> ? TTenant : unknown;
type WidgetServices<TSource> = TSource extends WidgetBuilder<infer _TData, infer _TActor, infer _TTenant, infer TServices, infer _TRecord> ? TServices : unknown;
interface SchemaWidgetContext<TActor, TTenant, TServices> {
    readonly actor: TActor;
    readonly services: TServices;
    readonly tenant: TTenant;
}
declare class EntrySchemaComponentBuilder<TSource extends EntrySchemaSource, TValues = EntryRecord<TSource>, TContext = EntryResolverContext$1<EntryRecord<TSource>, EntryValue<TSource>>> extends SchemaComponentBuilder<TValues, TContext, 'entry'> {
    #private;
    constructor(source: TSource);
    protected componentType(): string;
    protected componentProperties(): SchemaComponentProperties;
    protected layoutProperties(): SchemaLayoutProperties;
}
declare class FilterSchemaComponentBuilder<TSource extends FilterSchemaSource, TValues = Readonly<Record<string, FilterValue<TSource>>>, TContext = FilterContext<TSource>> extends SchemaComponentBuilder<TValues, TContext, 'filter'> {
    #private;
    constructor(source: TSource);
    protected componentType(): string;
    protected componentProperties(): SchemaComponentProperties;
    protected layoutProperties(): SchemaLayoutProperties;
}
declare class WidgetSchemaComponentBuilder<TSource extends WidgetSchemaSource, TValues = Readonly<{
    data: WidgetData<TSource>;
}>, TContext = SchemaWidgetContext<WidgetActor<TSource>, WidgetTenant<TSource>, WidgetServices<TSource>>> extends SchemaComponentBuilder<TValues, TContext, 'widget'> {
    #private;
    constructor(source: TSource);
    protected componentType(): string;
    protected componentProperties(): SchemaComponentProperties;
    protected layoutProperties(): SchemaLayoutProperties;
}
declare function schemaEntry<TSource extends EntrySchemaSource>(source: TSource): EntrySchemaComponentBuilder<TSource>;
declare function schemaFilter<TSource extends FilterSchemaSource>(source: TSource): FilterSchemaComponentBuilder<TSource>;
declare function schemaWidget<TSource extends WidgetSchemaSource>(source: TSource): WidgetSchemaComponentBuilder<TSource>;

type DefaultValues = Readonly<Record<string, unknown>>;
declare function grid(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): GridBuilder<DefaultValues, unknown>;
declare function section(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): SectionBuilder<DefaultValues, unknown>;
declare function group(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): GroupBuilder$1<DefaultValues, unknown>;
declare function fieldset(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): FieldsetBuilder<DefaultValues, unknown>;
declare function tabs(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): TabsBuilder<DefaultValues, unknown>;
declare function tab(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): TabBuilder<DefaultValues, unknown>;
declare function wizard(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): WizardBuilder<DefaultValues, unknown>;
declare function step(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): StepBuilder<DefaultValues, unknown>;
declare function split(children?: readonly SchemaComponentBuilder<DefaultValues, unknown>[]): SplitBuilder<DefaultValues, unknown>;
declare function callout(): CalloutBuilder<DefaultValues, unknown>;
declare function emptyState(): EmptyStateBuilder<DefaultValues, unknown>;
declare function customComponent(type: string): CustomComponentBuilder<DefaultValues, unknown>;
interface SchemaComponentFactory<TValues, TContext> {
    callout(): CalloutBuilder<TValues, TContext>;
    custom(type: string): CustomComponentBuilder<TValues, TContext>;
    emptyState(): EmptyStateBuilder<TValues, TContext>;
    entry<TSource extends EntrySchemaSource>(source: TSource): EntrySchemaComponentBuilder<TSource, TValues, TContext>;
    fieldset(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): FieldsetBuilder<TValues, TContext>;
    filter<TSource extends FilterSchemaSource>(source: TSource): FilterSchemaComponentBuilder<TSource, TValues, TContext>;
    grid(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): GridBuilder<TValues, TContext>;
    group(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): GroupBuilder$1<TValues, TContext>;
    section(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): SectionBuilder<TValues, TContext>;
    split(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): SplitBuilder<TValues, TContext>;
    step(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): StepBuilder<TValues, TContext>;
    tab(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): TabBuilder<TValues, TContext>;
    tabs(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): TabsBuilder<TValues, TContext>;
    widget<TSource extends WidgetSchemaSource>(source: TSource): WidgetSchemaComponentBuilder<TSource, TValues, TContext>;
    wizard(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): WizardBuilder<TValues, TContext>;
}
declare function schemaComponentsFor<TValuesSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_values: TValuesSource, _context?: TContextSource): SchemaComponentFactory<RecordTypeValue<TValuesSource>, OptionalRuntimeTypeValue<TContextSource>>;

type TextValue = string | number | null | undefined;
type BooleanValue = boolean | null | undefined;
type DateValue = Date | null | undefined;
type RadioValue = boolean | number | string | null | undefined;
type TextInputMode = 'email' | 'numeric' | 'password' | 'search' | 'tel' | 'text' | 'url';
declare class TextFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends TextValue = FormFieldValue<TValues, TPath> & TextValue, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'text', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    email(): this;
    url(): this;
    telephone(): this;
    password(revealable?: boolean): this;
    numeric(): this;
    search(): this;
    prefix(value: string | null): this;
    suffix(value: string | null): this;
    mask(value: string | null): this;
    autocomplete(value: string | null): this;
    minLength(value: number): this;
    maxLength(value: number): this;
    datalist(values: readonly string[]): this;
    revealable(value?: boolean): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare class TextareaFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined), TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'textarea', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    rows(value: number): this;
    autosize(value?: boolean): this;
    maxLength(value: number): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare abstract class BooleanFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends BooleanValue, TType extends 'checkbox' | 'toggle', TRecord> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
    #private;
    onLabel(value: string | null): this;
    offLabel(value: string | null): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare class CheckboxFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends BooleanValue = FormFieldValue<TValues, TPath> & BooleanValue, TRecord = unknown> extends BooleanFieldBuilder<TValues, TPath, TValue, 'checkbox', TRecord> {
    constructor(binding: BoundFormField<TValues, TPath>);
}
declare class ToggleFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends BooleanValue = FormFieldValue<TValues, TPath> & BooleanValue, TRecord = unknown> extends BooleanFieldBuilder<TValues, TPath, TValue, 'toggle', TRecord> {
    constructor(binding: BoundFormField<TValues, TPath>);
}
interface RadioOption<TValue extends Exclude<RadioValue, null | undefined>> {
    readonly value: TValue;
    readonly label: string;
    readonly disabled?: boolean;
}
declare class RadioFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends RadioValue = FormFieldValue<TValues, TPath> & RadioValue, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'radio', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    options(values: readonly RadioOption<Exclude<TValue, null | undefined>>[]): this;
    inline(value?: boolean): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
type DatePickerMode = 'date' | 'date-time' | 'time';
declare class DateFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends DateValue = FormFieldValue<TValues, TPath> & DateValue, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'date', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>, mode?: DatePickerMode);
    min(value: Date | string | null): this;
    max(value: Date | string | null): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare class HiddenFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue = FormFieldValue<TValues, TPath>, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'hidden', TRecord> {
    constructor(binding: BoundFormField<TValues, TPath>);
    protected assertSchemaKind(_definition: FieldDefinition): void;
}
declare class SliderFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends number | null | undefined = FormFieldValue<TValues, TPath> & (number | null | undefined), TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'slider', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    range(minimum: number, maximum: number): this;
    step(value: number): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare class ColorFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined), TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, 'color', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    format(value: 'hex' | 'hsl' | 'rgb'): this;
    alpha(value?: boolean): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
type SlugLocalTransform = (value: string) => string;
declare function defaultSlugTransform(value: string): string;
declare class SlugFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends string | null | undefined = FormFieldValue<TValues, TPath> & (string | null | undefined), TRecord = unknown> extends TextFieldBuilder<TValues, TPath, TValue, TRecord> {
    #private;
    from(path: FormFieldPath<TValues>): this;
    localTransform(transform: SlugLocalTransform): this;
    transformLocal(value: string): string;
    normalizeUsing(resolver: FieldResolver<TValues, TPath, TValue | undefined, TRecord>): this;
    protected fieldProperties(): JsonObject;
}
type BasicFormSchema = FormSchema;
type BasicFormValues<TSchema extends BasicFormSchema> = InferFormData<TSchema>;

interface CustomFieldDefinition<TValue, TProperties extends JsonObject, TContext> {
    readonly codec: {
        decode(value: JsonValue): TValue;
        encode(value: TValue): JsonValue;
    };
    readonly properties: TProperties;
    readonly resolveOptions?: (context: TContext) => JsonValue | Promise<JsonValue>;
    readonly validate?: (value: TValue, context: TContext) => void | Promise<void>;
}
declare class CustomFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue, TType extends ExtensionTypeId<'field'>, TProperties extends JsonObject, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>, typeId: TType, properties: TProperties);
    properties(value: TProperties): this;
    protected fieldProperties(): TProperties;
    protected assertSchemaKind(_definition: FieldDefinition): void;
}
declare function customField<TValues, TPath extends FormFieldPath<TValues>, TValue, TType extends ExtensionTypeId<'field'>, TProperties extends JsonObject, TContext>(binding: BoundFormField<TValues, TPath>, typeId: TType, definition: CustomFieldDefinition<TValue, TProperties, TContext>): CustomFieldBuilder<TValues, TPath, TValue, TType, TProperties>;

declare class BasicFieldFactory<TSchema extends FormSchema> {
    #private;
    constructor(schema: TSchema);
    text<TPath extends FormFieldPathFor<InferFormData<TSchema>, string | number>>(path: TPath): TextFieldBuilder<InferFormData<TSchema>, TPath>;
    textarea<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): TextareaFieldBuilder<InferFormData<TSchema>, TPath>;
    checkbox<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean>>(path: TPath): CheckboxFieldBuilder<InferFormData<TSchema>, TPath>;
    toggle<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean>>(path: TPath): ToggleFieldBuilder<InferFormData<TSchema>, TPath>;
    radio<TPath extends FormFieldPathFor<InferFormData<TSchema>, boolean | number | string>>(path: TPath): RadioFieldBuilder<InferFormData<TSchema>, TPath>;
    date<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath>;
    time<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath>;
    dateTime<TPath extends FormFieldPathFor<InferFormData<TSchema>, Date>>(path: TPath): DateFieldBuilder<InferFormData<TSchema>, TPath>;
    hidden<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): HiddenFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>>;
    slider<TPath extends FormFieldPathFor<InferFormData<TSchema>, number>>(path: TPath): SliderFieldBuilder<InferFormData<TSchema>, TPath>;
    color<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): ColorFieldBuilder<InferFormData<TSchema>, TPath>;
    slug<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): SlugFieldBuilder<InferFormData<TSchema>, TPath>;
    custom<TPath extends FormFieldPath<InferFormData<TSchema>>, TValue, TType extends ExtensionTypeId<'field'>, TProperties extends JsonObject, TContext>(path: TPath, typeId: TType, definition: CustomFieldDefinition<TValue, TProperties, TContext>): CustomFieldBuilder<InferFormData<TSchema>, TPath, TValue, TType, TProperties>;
}
declare function fields<TSchema extends FormSchema>(schema: TSchema): BasicFieldFactory<TSchema>;

interface KeyValueEntry$1 {
    readonly key: string;
    readonly value: string;
}
type RichTextNodeType = 'blockquote' | 'bullet-list' | 'code-block' | 'doc' | 'hard-break' | 'heading' | 'list-item' | 'ordered-list' | 'paragraph' | 'text';
type RichTextMarkType = 'bold' | 'code' | 'italic' | 'link' | 'strike' | 'underline';
interface RichTextMark extends JsonObject {
    attrs: JsonObject;
    type: RichTextMarkType;
}
interface RichTextNode extends JsonObject {
    attrs: JsonObject;
    content: RichTextNode[];
    marks: RichTextMark[];
    text: string | null;
    type: RichTextNodeType;
}
interface RichTextDocument extends RichTextNode {
    type: 'doc';
}
interface RichTextSanitizer {
    sanitize(document: RichTextDocument): RichTextDocument;
}
interface BuilderBlockDefinition<TSchema extends FormSchema = FormSchema> {
    readonly icon?: string;
    readonly label: string;
    readonly schema: TSchema;
    readonly type: string;
}
type BuilderBlockMap = Readonly<Record<string, BuilderBlockDefinition>>;
type BuilderBlockValue<TBlocks extends BuilderBlockMap> = {
    [TType in keyof TBlocks & string]: {
        readonly data: InferFormData<TBlocks[TType]['schema']>;
        readonly type: TType;
    };
}[keyof TBlocks & string];
interface BuilderBlockValidationIssue {
    readonly blockIndex: number;
    readonly blockType: string;
    readonly issues: readonly StandardSchemaV1Issue[];
}
interface CollectionFieldProperties extends JsonObject {
    editorAdapter: string | null;
    maximumItems: number | null;
    minimumItems: number;
}
type CollectionValue = readonly JsonValue[];

interface SubmittedBuilderBlock {
    readonly data: unknown;
    readonly type: string;
}
declare function validateBuilderBlocks<TBlocks extends BuilderBlockMap>(blocks: readonly SubmittedBuilderBlock[], definitions: TBlocks): Promise<readonly BuilderBlockValidationIssue[]>;

type StringValue = string | null | undefined;
type ArrayValue = readonly unknown[] | null | undefined;
declare abstract class CollectionFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends ArrayValue, TType extends string, TRecord> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
    #private;
    minimumItems(value: number): this;
    maximumItems(value: number | null): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected collectionProperties(properties?: JsonObject): JsonObject;
}
declare class TagsFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends readonly string[] | null | undefined = FormFieldValue<TValues, TPath> & (readonly string[] | null | undefined), TRecord = unknown> extends CollectionFieldBuilder<TValues, TPath, TValue, 'tags', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    separator(value: string): this;
    allowDuplicates(value?: boolean): this;
    protected fieldProperties(): JsonObject;
}
declare class KeyValueFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends readonly KeyValueEntry$1[] | null | undefined = FormFieldValue<TValues, TPath> & (readonly KeyValueEntry$1[] | null | undefined), TRecord = unknown> extends CollectionFieldBuilder<TValues, TPath, TValue, 'key-value', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    uniqueKeys(value?: boolean): this;
    protected fieldProperties(): JsonObject;
}
declare abstract class StringEditorFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends StringValue, TType extends string, TRecord> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
    #private;
    editorAdapter(value: string | null): this;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected editorProperties(properties?: JsonObject): JsonObject;
}
declare class CodeFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue, TRecord = unknown> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'code', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    language(value: string): this;
    lineNumbers(value?: boolean): this;
    protected fieldProperties(): JsonObject;
}
declare class MarkdownFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue, TRecord = unknown> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'markdown', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    preview(value?: boolean): this;
    protected fieldProperties(): JsonObject;
}
declare class RichEditorFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends StringValue = FormFieldValue<TValues, TPath> & StringValue, TRecord = unknown> extends StringEditorFieldBuilder<TValues, TPath, TValue, 'rich-editor', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    sanitizer(value: string): this;
    protected fieldProperties(): JsonObject;
}
declare class RepeaterFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends ArrayValue = FormFieldValue<TValues, TPath> & ArrayValue, TRecord = unknown> extends CollectionFieldBuilder<TValues, TPath, TValue, 'repeater', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>);
    collapsible(value?: boolean): this;
    cloneable(value?: boolean): this;
    reorderable(value?: boolean): this;
    protected fieldProperties(): JsonObject;
}
declare class BuilderFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue extends ArrayValue, TBlocks extends BuilderBlockMap, TRecord = unknown> extends CollectionFieldBuilder<TValues, TPath, TValue, 'builder', TRecord> {
    #private;
    constructor(binding: BoundFormField<TValues, TPath>, blocks: TBlocks);
    protected fieldProperties(): JsonObject;
}
declare class CollectionFieldFactory<TSchema extends FormSchema> {
    #private;
    constructor(schema: TSchema);
    tags<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly string[]>>(path: TPath): TagsFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, readonly string[] | null | undefined>>;
    keyValue<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly KeyValueEntry$1[]>>(path: TPath): KeyValueFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, readonly KeyValueEntry$1[] | null | undefined>>;
    code<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): CodeFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>>;
    markdown<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): MarkdownFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>>;
    richEditor<TPath extends FormFieldPathFor<InferFormData<TSchema>, string>>(path: TPath): RichEditorFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, StringValue>>;
    repeater<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly object[]>>(path: TPath): RepeaterFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, ArrayValue>>;
    builder<TPath extends FormFieldPathFor<InferFormData<TSchema>, readonly object[]>, TBlocks extends BuilderBlockMap>(path: TPath, blocks: TBlocks): BuilderFieldBuilder<InferFormData<TSchema>, TPath, Extract<FormFieldValue<InferFormData<TSchema>, TPath>, ArrayValue>, TBlocks>;
}
declare function collectionFields<TSchema extends FormSchema>(schema: TSchema): CollectionFieldFactory<TSchema>;

declare const structuralRichTextSanitizer: RichTextSanitizer;
declare function serializeMarkdown(value: string): string;
declare function serializeRichText(document: RichTextDocument, sanitizer: RichTextSanitizer): string;
declare function deserializeRichText(value: string, sanitizer: RichTextSanitizer): RichTextDocument;

type ChoiceFieldType = 'checkbox-list' | 'multiselect' | 'select' | 'toggle-buttons';
interface CompiledChoiceFieldDefinition<TValues, TPath extends FormFieldPath<TValues>, TValue, TOptionValue extends OptionValue, TRecord> extends CompiledFieldDefinition<TValues, TPath, TValue, TRecord> {
    readonly server: CompiledFieldDefinition<TValues, TPath, TValue, TRecord>['server'] & {
        readonly options: OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>;
    };
}
declare class ChoiceFieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue = FormFieldValue<TValues, TPath>, TOptionValue extends OptionValue = Extract<NonNullable<TValue> extends readonly (infer TItem)[] ? TItem : NonNullable<TValue>, OptionValue>, TType extends ChoiceFieldType = ChoiceFieldType, TRecord = unknown> extends FieldBuilder<TValues, TPath, TValue, TType, TRecord> {
    #private;
    constructor(type: TType, binding: BoundFormField<TValues, TPath>);
    options(options: readonly ChoiceOption<TOptionValue>[] | OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>): this;
    relationship(name: string, titleColumn: string, source: OptionSource<TOptionValue, FieldResolverContext<TValues, TPath, TRecord>>): this;
    searchable(value?: boolean): this;
    preload(value?: boolean): this;
    paginated(value?: boolean): this;
    multiple(value?: boolean): this;
    createOption(value?: boolean): this;
    editOption(value?: boolean): this;
    preserveWhenDependencyChanges(value?: boolean): this;
    compile(): CompiledChoiceFieldDefinition<TValues, TPath, TValue, TOptionValue, TRecord>;
    protected assertSchemaKind(definition: FieldDefinition): void;
    protected fieldProperties(): JsonObject;
}
declare class ChoiceFieldFactory<TSchema extends FormSchema> {
    #private;
    constructor(schema: TSchema);
    select<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>>, OptionValue>, 'select'>;
    multiselect<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'multiselect'>;
    checkboxList<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'checkbox-list'>;
    toggleButtons<TPath extends FormFieldPath<InferFormData<TSchema>>>(path: TPath): ChoiceFieldBuilder<InferFormData<TSchema>, TPath, FormFieldValue<InferFormData<TSchema>, TPath>, Extract<NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>> extends readonly (infer TItem)[] ? TItem : NonNullable<FormFieldValue<InferFormData<TSchema>, TPath>>, OptionValue>, 'toggle-buttons'>;
}
declare function choiceFields<TSchema extends FormSchema>(schema: TSchema): ChoiceFieldFactory<TSchema>;

declare class OptionService<TValue extends OptionValue, TContext> {
    #private;
    constructor(source: OptionSource<TValue, TContext>, limits?: OptionServiceLimits);
    list(request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal): Promise<OptionPage<TValue>>;
    hydrateSelected(request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], context: TContext, signal?: AbortSignal): Promise<readonly ChoiceOption<TValue>[]>;
    validateSubmission(request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], context: TContext, signal?: AbortSignal): Promise<readonly ChoiceOption<TValue>[]>;
    create(label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>;
    edit(value: TValue, label: string, request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>;
    private validateRequest;
    private validateTenantContext;
    private validateSelected;
}
declare class StaticOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
    #private;
    readonly kind = "static";
    constructor(options: readonly ChoiceOption<TValue>[]);
    manifestOptions(): readonly ChoiceOption<TValue>[];
    list(request: OptionQueryRequest<TValue>, _context: TContext): Promise<OptionPage<TValue>>;
    hydrateSelected(_request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], _context: TContext): Promise<readonly ChoiceOption<TValue>[]>;
}
type OptionResolver<TValue extends OptionValue, TContext> = (request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal) => Promise<OptionPage<TValue>>;
type SelectedOptionResolver<TValue extends OptionValue, TContext> = (request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], context: TContext, signal?: AbortSignal) => Promise<readonly ChoiceOption<TValue>[]>;
declare class ResolverOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
    readonly resolve: OptionResolver<TValue, TContext>;
    readonly resolveSelected: SelectedOptionResolver<TValue, TContext>;
    readonly kind = "resolver";
    constructor(resolve: OptionResolver<TValue, TContext>, resolveSelected: SelectedOptionResolver<TValue, TContext>);
    list(request: OptionQueryRequest<TValue>, context: TContext, signal?: AbortSignal): Promise<OptionPage<TValue>>;
    hydrateSelected(request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], context: TContext, signal?: AbortSignal): Promise<readonly ChoiceOption<TValue>[]>;
}
interface CustomOptionSourceHandlers<TValue extends OptionValue, TContext> {
    readonly list: OptionSource<TValue, TContext>['list'];
    readonly hydrateSelected: OptionSource<TValue, TContext>['hydrateSelected'];
    readonly create?: OptionSource<TValue, TContext>['create'];
    readonly edit?: OptionSource<TValue, TContext>['edit'];
}
declare class CustomOptionSource<TValue extends OptionValue, TContext> implements OptionSource<TValue, TContext> {
    readonly kind = "custom";
    readonly list: OptionSource<TValue, TContext>['list'];
    readonly hydrateSelected: OptionSource<TValue, TContext>['hydrateSelected'];
    readonly create?: OptionSource<TValue, TContext>['create'];
    readonly edit?: OptionSource<TValue, TContext>['edit'];
    constructor(handlers: CustomOptionSourceHandlers<TValue, TContext>);
}
interface RelationshipConstraint<TValues> {
    readonly dependency: FormFieldPath<TValues>;
    readonly column: string;
}
declare class RelationshipOptionSource<TValues, TPath extends FormFieldPath<TValues>, TRecord, TQuery extends HoloOptionQuery<TQuery, TOptionRecord>, TOptionRecord, TValue extends OptionValue, TContext extends FieldResolverContext<TValues, TPath, TRecord>> implements OptionSource<TValue, TContext> {
    #private;
    readonly kind = "relationship";
    constructor(adapter: RelationshipOptionAdapter<TQuery, TOptionRecord, TValue, TContext>, modifiers?: readonly RelationshipOptionQueryModifier<TValues, TPath, TRecord, TQuery>[], constraints?: readonly RelationshipConstraint<TValues>[]);
    optionsQuery(modifier: RelationshipOptionQueryModifier<TValues, TPath, TRecord, TQuery>): RelationshipOptionSource<TValues, TPath, TRecord, TQuery, TOptionRecord, TValue, TContext>;
    constrainedBy<TDependencyPath extends FormFieldPath<TValues>>(dependency: TDependencyPath, column: string): RelationshipOptionSource<TValues, TPath, TRecord, TQuery, TOptionRecord, TValue, TContext>;
    list(request: OptionQueryRequest<TValue>, context: TContext): Promise<OptionPage<TValue>>;
    hydrateSelected(_request: OptionQueryRequest<TValue>, selectedValues: readonly TValue[], context: TContext): Promise<readonly ChoiceOption<TValue>[]>;
    create(label: string, _request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>;
    edit(value: TValue, label: string, _request: OptionQueryRequest<TValue>, context: TContext): Promise<ChoiceOption<TValue>>;
    private scopedQuery;
    private option;
}

declare function resolveActionState<TRecord, TInput extends JsonObject, TActor, TTenant, TServices>(definition: Pick<ActionDefinition<TRecord, TInput, unknown, TActor, TTenant, TServices>, 'disabled' | 'label' | 'visible'>, context: ActionPresentationContext<TRecord, TInput, TActor, TTenant, TServices>): Promise<ActionResolvedState>;
declare function compileActionManifest<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>, label: string, context: ActionPresentationContext<TRecord, TInput, TActor, TTenant, TServices>, state?: Pick<ActionResolvedState, 'disabled' | 'visible'>): Promise<Readonly<ActionManifest>>;

type ActionHandler<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> = ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['handle'];
type Context<TRecord, TActor, TTenant, TServices> = ActionContext<TRecord, TActor, TTenant, TServices>;
declare class ActionBuilder<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
    #private;
    constructor(id: string);
    authorize(policy: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['authorize']): this;
    badge(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    color(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    disabled(condition: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>): this;
    failureNotification(notification: ActionFailureNotification<Context<TRecord, TActor, TTenant, TServices>>): this;
    action<TNextResult>(handler: ActionHandler<TRecord, TInput, TNextResult, TActor, TTenant, TServices>): ActionBuilder<TRecord, TInput, TNextResult, TActor, TTenant, TServices>;
    icon(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    label(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string>): this;
    lifecycle(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['lifecycle']>): this;
    modal(value: ActionModalOptions<Context<TRecord, TActor, TTenant, TServices>>): this;
    modalDescription(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    modalHeading(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    modalWidth(value: NonNullable<ActionModalOptions<Context<TRecord, TActor, TTenant, TServices>>['width']>): this;
    mount(value: ActionMount): this;
    mutateInput(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['mutateInput']>): this;
    notification(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['notification']>): this;
    rateLimit(value: ActionRateLimit<Context<TRecord, TActor, TTenant, TServices>>): this;
    requiresConfirmation(value?: boolean | string): this;
    sideEffects(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['sideEffects']>): this;
    size(value: ActionSize): this;
    slideOver(value?: boolean): this;
    successNotification(notification: ActionSuccessNotification<TResult, Context<TRecord, TActor, TTenant, TServices>>): this;
    tooltip(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this;
    transactional(value?: boolean): this;
    type(value: ExtensionTypeId<'action'>): this;
    visible(condition: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>): this;
    compile(): Readonly<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>>;
}
interface ResourceActionComposer<TRecord, TInput extends JsonObject, TActor, TTenant, TServices> {
    action(id: string): ActionBuilder<TRecord, TInput, unknown, TActor, TTenant, TServices>;
}
declare function createResourceActionComposer<TRecord, TInput extends JsonObject, TActor, TTenant, TServices>(): ResourceActionComposer<TRecord, TInput, TActor, TTenant, TServices>;
declare function defineAction<TRecordSource extends RecordTypeSource, TInputSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, _sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource> & {
    readonly input: TInputSource;
    readonly record: TRecordSource;
}): ActionBuilder<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, unknown, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
declare function defineAction(id: string): ActionBuilder<unknown, JsonObject, unknown, unknown, unknown, unknown>;

interface ActionPersistence<TRecord, TInput extends JsonObject, TResult> {
    create?(input: TInput): Promise<TResult>;
    delete?(record: TRecord): Promise<TResult>;
    forceDelete?(record: TRecord): Promise<TResult>;
    replicate?(record: TRecord, input: TInput): Promise<TResult>;
    restore?(record: TRecord): Promise<TResult>;
    update?(record: TRecord, input: TInput): Promise<TResult>;
}
interface BuiltinActionOptions<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
    readonly authorize: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['authorize'];
    readonly id?: string;
    readonly label?: string;
    readonly mount?: ActionMount;
}
declare function actionsFor<TRecordSource extends RecordTypeSource, TInputSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(_sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource> & {
    readonly input: TInputSource;
    readonly record: TRecordSource;
}): {
    builtin<TResult>(kind: Exclude<ActionKind, 'custom' | 'view'>, persistence: ActionPersistence<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult>, options: BuiltinActionOptions<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>): ActionDefinition<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    custom<TResult>(definition: ActionDefinition<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>> & {
        readonly type?: ExtensionTypeId<'action'>;
    }): ActionDefinition<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    view(options: {
        readonly authorize: ActionDefinition<RecordTypeValue<TRecordSource>, JsonObject, RecordTypeValue<TRecordSource>, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>['authorize'];
        readonly id?: string;
        readonly label?: string;
    }): ActionDefinition<RecordTypeValue<TRecordSource>, JsonObject, RecordTypeValue<TRecordSource>, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
};

interface CachedExecution<TRecordId extends number | string> {
    readonly actionId: string;
    readonly actor: unknown;
    readonly expiresAt: number;
    readonly fingerprint: string;
    readonly idempotencyKey: string;
    readonly promise: Promise<ActionExecutionResult<TRecordId, unknown>>;
    settled: boolean;
    readonly tenant: unknown;
}
interface RateLimitWindow {
    count: number;
    expiresAt: number;
}
declare class ActionExecutionError extends Error {
    readonly code: 'denied' | 'failed' | 'idempotency-conflict' | 'rate-limited' | 'record-not-found' | 'stale';
    readonly effects: readonly Effect[];
    constructor(code: 'denied' | 'failed' | 'idempotency-conflict' | 'rate-limited' | 'record-not-found' | 'stale', message: string, effects?: readonly Effect[]);
}
declare class ActionEngineState<TRecordId extends number | string> {
    readonly executions: CachedExecution<TRecordId>[];
    readonly rateLimits: Map<string, RateLimitWindow>;
}
declare class ActionEngine<TRecord, TRecordId extends number | string, TActor, TTenant, TServices> {
    #private;
    readonly options: ActionEngineOptions<TRecord, TRecordId, TActor, TTenant>;
    constructor(options: ActionEngineOptions<TRecord, TRecordId, TActor, TTenant>, state?: ActionEngineState<TRecordId>);
    execute<TInput extends JsonObject, TResult>(definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>, request: ActionExecutionRequest<TInput, TRecordId>, scope: {
        readonly actor: TActor;
        readonly services: TServices;
        readonly signal: AbortSignal;
        readonly tenant: TTenant;
    }): Promise<ActionExecutionResult<TRecordId, TResult>>;
    private run;
    private executeRecord;
    private context;
    private executeWithContext;
    private enforceRateLimit;
    private successEffects;
    private failureEffects;
    private notificationEffects;
    private pruneExecutions;
    private removeExecution;
}

declare class ActionGroupBuilder {
    #private;
    constructor(id: string, actions: readonly ActionGroupItem[]);
    label(value: string | null): this;
    icon(value: string | null): this;
    color(value: string | null): this;
    compile(): ActionGroupManifest;
    private assertMutable;
}
declare function actionGroup(id: string, ...actions: readonly ActionGroupItem[]): ActionGroupBuilder;

interface PageState<TData extends JsonObject, TActor, TTenant, TServices> {
    authorize: PageServerHandles<TData, TActor, TTenant, TServices>['authorize'];
    body: PageComponentBody | null;
    breadcrumbs?: PageResolvable<PageContext<TActor, TTenant, TServices>, readonly PageBreadcrumb[]>;
    footerActions: string[];
    footerWidgets: string[];
    headerActions: string[];
    headerWidgets: string[];
    heading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>;
    load?: PageServerHandles<TData, TActor, TTenant, TServices>['load'];
    navigation: PageNavigation | null;
    path: string;
    renderer: PageRendererManifest | null;
    schema?: PageResolvable<PageContext<TActor, TTenant, TServices>, CompiledSchema<Readonly<Record<string, unknown>>, PageContext<TActor, TTenant, TServices>> | null>;
    schemaId: string | null;
    subheading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>;
    title?: PageResolvable<PageContext<TActor, TTenant, TServices>, string>;
}
declare class PageBuilder<TData extends JsonObject = JsonObject, TActor = unknown, TTenant = unknown, TServices = unknown> extends ConstructionBuilder<PageState<TData, TActor, TTenant, TServices>, CompiledPageDefinition<TData, TActor, TTenant, TServices>> implements DiscoverableBuilder<'page'> {
    readonly id: string;
    readonly pageType: PageType;
    readonly resourceCompositionTypes: ResourceCompositionTypes<unknown, TActor, TTenant, TServices>;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "page";
    constructor(id: string, pageType: PageType, state?: PageState<TData, TActor, TTenant, TServices>);
    configured(id: string, configure: (page: PageBuilder<TData, TActor, TTenant, TServices>) => PageBuilder<TData, TActor, TTenant, TServices>): PageBuilder<TData, TActor, TTenant, TServices>;
    path(value: string): this;
    authorize(resolver: PageServerHandles<TData, TActor, TTenant, TServices>['authorize']): this;
    loader(loader: PageServerHandles<TData, TActor, TTenant, TServices>['load']): this;
    title(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string>): this;
    heading(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>): this;
    subheading(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>): this;
    breadcrumbs(value: PageResolvable<PageContext<TActor, TTenant, TServices>, readonly PageBreadcrumb[]>): this;
    headerActions(...actionIds: readonly string[]): this;
    footerActions(...actionIds: readonly string[]): this;
    headerWidgets(...widgetIds: readonly string[]): this;
    footerWidgets(...widgetIds: readonly string[]): this;
    schema(id: string, value: PageResolvable<PageContext<TActor, TTenant, TServices>, CompiledSchema<Readonly<Record<string, unknown>>, PageContext<TActor, TTenant, TServices>> | null>): this;
    body(component: string, properties?: JsonObject): this;
    renderer(type: ExtensionTypeId<'page'>, properties?: JsonObject): this;
    navigation(value: PageNavigationInput): this;
    compileDiscoveryDefinition(): DiscoverableDefinition<'page'>;
    protected createDefinition(state: Readonly<PageState<TData, TActor, TTenant, TServices>>): CompiledPageDefinition<TData, TActor, TTenant, TServices>;
}
interface PageTypeSources<TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined> {
    readonly actor?: TActorSource;
    readonly load: (context: PageContext<OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>) => TData | Promise<TData>;
    readonly services?: TServicesSource;
    readonly tenant?: TTenantSource;
}
type PageFromSources<TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined, TTenantSource extends RuntimeTypeSource | undefined, TServicesSource extends RuntimeTypeSource | undefined> = PageBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
declare function definePage<TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>, type?: PageType): PageFromSources<TData, TActorSource, TTenantSource, TServicesSource>;
declare function definePage(id: string, type?: PageType): PageBuilder<JsonObject, unknown, unknown, unknown>;
type PageFactory = {
    <TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>): PageFromSources<TData, TActorSource, TTenantSource, TServicesSource>;
    (id: string): PageBuilder<JsonObject, unknown, unknown, unknown>;
};
declare const defineListPage: PageFactory;
declare const defineCreatePage: PageFactory;
declare const defineEditPage: PageFactory;
declare const defineViewPage: PageFactory;
declare const defineCustomPage: PageFactory;
declare const defineSingularPage: PageFactory;
declare const defineRelatedRecordPage: PageFactory;

declare function createNavigationSeed<TData extends JsonObject, TActor, TTenant, TServices>(pages: readonly CompiledPageDefinition<TData, TActor, TTenant, TServices>[]): readonly PanelNavigationSeed[];
declare function resolvePanelNavigationSeed<TActor, TTenant, TServices>(configured: readonly PanelNavigationSeed[], pages: readonly CompiledPageDefinition<JsonObject, TActor, TTenant, TServices>[], context: Omit<PageContext<TActor, TTenant, TServices>, 'parameters'>): Promise<readonly PanelNavigationSeed[]>;

interface PanelState<TActor> {
    access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>;
    actorHidden: readonly string[];
    actorPresenter: PanelActorPresenter<TActor>;
    actorRecipientType: string;
    auth: ((path: string) => CompiledPanelAuth<TActor>) | null;
    authFeatures: PanelAuthPageConfiguration<Readonly<Record<string, unknown>>, string, TActor, unknown, unknown>;
    authPasswordBroker: string;
    authRoutes: {
        emailChangeVerificationPrefix: string | null;
        emailChangeVerificationSlug: string | null;
        emailVerificationPrefix: string | null;
        emailVerificationPromptSlug: string | null;
        emailVerificationSlug: string | null;
        loginSlug: string | null;
        passwordResetPrefix: string | null;
        passwordResetRequestSlug: string | null;
        passwordResetSlug: string | null;
        registrationSlug: string | null;
    };
    assets: readonly PanelAsset[];
    boot: readonly ((panel: PanelBootContext) => void | Promise<void>)[];
    branding: PanelBranding;
    components: PanelComponentConfiguration;
    databaseNotifications: PanelDatabaseNotificationConfiguration | null;
    databaseNotificationInbox: PanelDatabaseNotificationInboxOptions<TActor> | null;
    defaults: readonly ComponentDefault[];
    defaultPanel: boolean;
    discover: DiscoveryDirectories;
    guard: string;
    globalSearch: boolean;
    globalSearchDebounce: number;
    globalSearchFieldSuffix: string | null;
    globalSearchKeybindingSuffix: string | null;
    globalSearchKeybindings: readonly string[];
    globalSearchResourceOptIn: boolean;
    icons: JsonObject;
    id: string;
    layout: {
        breadcrumbs: boolean;
        collapsedSidebarWidth: string;
        collapsibleNavigationGroups: boolean;
        maxContentWidth: PanelContentWidth;
        sidebarFullyCollapsible: boolean;
        sidebarWidth: string;
        simplePageMaxContentWidth: PanelContentWidth;
        subNavigationPosition: PanelSubNavigationPosition;
        topbar: boolean;
    };
    middleware: {
        authenticated: readonly PanelMiddleware<TActor>[];
        panel: readonly PanelMiddleware<TActor>[];
        persistent: {
            authenticated: readonly PanelMiddleware<TActor>[];
            panel: readonly PanelMiddleware<TActor>[];
            tenant: readonly PanelMiddleware<TActor>[];
        };
        tenant: readonly PanelMiddleware<TActor>[];
    };
    navigation: PanelNavigationSeed[];
    navigationEnabled: boolean;
    navigationGroups: readonly PanelNavigationGroup[];
    navigationMode: PanelNavigationMode;
    path: string;
    routing: {
        domain: string | null;
        domains: readonly string[];
        homeUrl: string | null;
    };
    runtime: {
        broadcasting: boolean;
        databaseTransactions: boolean;
        readOnlyRelationManagersOnResourceViewPagesByDefault: boolean;
        resourceCreatePageRedirect: 'edit' | 'index' | 'view';
        resourceEditPageRedirect: 'index' | 'view' | null;
        spa: boolean;
        spaPrefetching: boolean;
        spaUrlExceptions: readonly string[];
        strictAuthorization: boolean;
        unsavedChangesAlerts: boolean;
    };
    routes: Record<PanelRouteScope, readonly PanelRouteRegistrar[]>;
    plugins: readonly PanelPlugin<TActor>[];
    registered: readonly PanelRegisteredDefinition[];
    sidebarCollapsible: boolean;
    slots: ScopedRenderSlots<RenderHook>;
    theme: PanelTheme;
    tenancy: {
        compile: (resolver: PanelTenantResolver<TActor> | null) => CompiledPanelTenancy<TActor>;
    } | null;
    tenancyConfiguration: {
        billingProvider: PanelTenantBillingProvider<TActor> | null;
        billingRouteSlug: string;
        menu: boolean;
        menuItems: readonly PanelTenantMenuItem[];
        profilePath: string | null | undefined;
        registrationPath: string | null | undefined;
        requiresSubscription: boolean;
        resolveTenantUsing: PanelTenantResolver<TActor> | null;
        routeDomain: string | null;
        routePrefix: string | null;
        searchableMenu: boolean | null;
        switcher: boolean;
    };
    userMenu: PanelUserMenuItem[];
    userMenuEnabled: boolean;
    errorNotifications: {
        disabledStatusCodes: readonly number[];
        enabled: boolean;
        hiddenStatusCodes: readonly number[];
        notifications: readonly {
            readonly body: string;
            readonly statusCode: number | null;
            readonly title: string;
        }[];
    };
}
type PanelTenantResolver<TActor> = (key: string, scope: PanelAuthenticatedScope<TActor>) => unknown | null | Promise<unknown | null>;
interface PanelDiscoveryServer {
    readonly plugins: readonly {
        readonly compatibility: PluginCompatibility;
        readonly contributions: PanelPluginInstallation<unknown>['contributions'];
        readonly id: string;
        readonly packageName: string;
    }[];
    readonly registered: readonly PanelRegisteredDefinition[];
    readonly routeDomain: string | null;
    readonly routePrefix: string | null;
    readonly routes: readonly {
        readonly method: PanelRouteMethod;
        readonly path: string;
        readonly scope: PanelRouteScope;
    }[];
}
type ExplicitPanelKind = 'cluster' | 'page' | 'resource' | 'widget';
type ExplicitPanelDefinition<TKind extends ExplicitPanelKind> = DiscoverableBuilder<TKind> | DiscoverableDefinition<TKind>;
declare class PanelBuilder<TActor = unknown> extends ConstructionBuilder<PanelState<TActor>, CompiledPanelDefinition<TActor>> {
    #private;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "panel";
    constructor(initialId: string, actorSource?: RecordTypeSource);
    get route(): string;
    id(value: string): this;
    get guardName(): string;
    get discover(): Readonly<DiscoveryDirectories>;
    get client(): Readonly<Record<string, string>>;
    path(value: string): this;
    guard(value: string): this;
    authGuard(value: string): this;
    defaultPanel(value?: boolean): this;
    ['default'](value?: boolean): this;
    access(policy: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>): this;
    auth<TProfileValues extends Readonly<Record<string, unknown>>, TProfileField extends Extract<keyof TProfileValues, string>, TTenantSource extends RuntimeTypeSource, TServicesSource extends RuntimeTypeSource>(sources: {
        readonly services: TServicesSource;
        readonly tenant: TTenantSource;
    }, options: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, RuntimeTypeValue<TTenantSource>, RuntimeTypeValue<TServicesSource>>): this;
    auth<TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>, TProfileField extends Extract<keyof TProfileValues, string> = Extract<keyof TProfileValues, string>, TTenant = unknown, TServices = unknown>(options: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices>): this;
    login(configuration?: boolean | PanelLoginPageConfiguration): this;
    loginRouteSlug(value: string): this;
    registration(configuration?: boolean | PanelRegistrationPageConfiguration): this;
    registrationRouteSlug(value: string): this;
    passwordReset(configuration?: Omit<PanelPasswordResetPageConfiguration, 'broker'>): this;
    passwordResetRoutePrefix(value: string): this;
    passwordResetRequestRouteSlug(value: string): this;
    passwordResetRouteSlug(value: string): this;
    emailVerification(configuration?: boolean | PanelEmailVerificationPageConfiguration): this;
    emailVerificationRoutePrefix(value: string): this;
    emailVerificationPromptRouteSlug(value: string): this;
    emailVerificationRouteSlug(value: string): this;
    emailChangeVerification(configuration?: boolean | PanelEmailChangeVerificationPageConfiguration): this;
    emailChangeVerificationRoutePrefix(value: string): this;
    emailChangeVerificationRouteSlug(value: string): this;
    revealablePasswords(value?: boolean): this;
    profile(configuration?: PanelState<TActor>['authFeatures']['profile']): this;
    simpleProfilePage(value?: boolean): this;
    multiFactorAuthentication(configuration?: boolean | PanelMultiFactorPageConfiguration): this;
    authPasswordBroker(value: string): this;
    presentActor(presenter: PanelActorPresenter<TActor>): this;
    plugin<TTenant = unknown>(plugin: PanelPlugin<TActor, TTenant>): this;
    defaults(...defaults: readonly ComponentDefault[]): this;
    tenancy<TTenantSource extends RuntimeTypeSource, TTenantId extends PanelTenantIdentifier, TRegistrationValues extends Readonly<Record<string, unknown>>, TProfileValues extends Readonly<Record<string, unknown>>>(options: PanelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>, TTenantId, TTenantSource, TRegistrationValues, TProfileValues>): this;
    tenant<TTenantSource extends RuntimeTypeSource>(model: TTenantSource & (RuntimeTypeValue<TTenantSource> extends object ? object : never), options?: PanelModelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>>): this;
    tenantRoutePrefix(prefix: string | null): this;
    tenantDomain(domain: string | null): this;
    tenantSwitcher(condition?: boolean): this;
    searchableTenantMenu(condition?: boolean | null): this;
    tenantMenu(condition?: boolean): this;
    tenantMenuItems(items: readonly PanelTenantMenuItem[]): this;
    tenantProfile(page?: string | null): this;
    tenantRegistration(page?: string | null): this;
    tenantBillingProvider(provider: PanelTenantBillingProvider<TActor> | null): this;
    tenantBillingRouteSlug(slug: string): this;
    requiresTenantSubscription(condition?: boolean): this;
    resolveTenantUsing<TTenant>(callback: (key: string, scope: PanelAuthenticatedScope<TActor>) => TTenant | null | Promise<TTenant | null>): this;
    databaseNotifications(options?: Partial<PanelDatabaseNotificationConfiguration>): this;
    databaseNotificationsPolling(interval: string | false): this;
    globalSearch(value?: boolean): this;
    globalSearchDebounce(value: number | string): this;
    globalSearchKeyBindings(bindings: readonly string[]): this;
    globalSearchFieldSuffix(value: string | null): this;
    globalSearchFieldKeyBindingSuffix(value: string | null): this;
    globalSearchResourceOptIn(value?: boolean): this;
    databaseNotificationInbox(options: PanelDatabaseNotificationInboxOptions<TActor>): this;
    branding(value: {
        readonly favicon?: string | null;
        readonly logo?: string | null;
        readonly name?: string;
    }): this;
    brandName(value: string): this;
    defaultAvatarProvider(value: string | null): this;
    brandLogo(value: string | null): this;
    darkModeBrandLogo(value: string | null): this;
    brandLogoHeight(value: string | null): this;
    favicon(value: string | null): this;
    theme(value: Partial<PanelTheme> | PanelTokenTheme): this;
    colors(value: JsonObject): this;
    icons(value: JsonObject): this;
    viteTheme(value: string): this;
    darkMode(value?: boolean): this;
    defaultThemeMode(value: PanelTheme['darkMode']): this;
    themeSwitcher(value?: boolean): this;
    font(value: string | null): this;
    monoFont(value: string | null): this;
    serifFont(value: string | null): this;
    navigationMode(value: PanelNavigationMode): this;
    topNavigation(value?: boolean): this;
    topbar(value?: boolean | string): this;
    sidebarComponent(value: string | null): this;
    topbarComponent(value: string | null): this;
    breadcrumbs(value?: boolean): this;
    maxContentWidth(value: PanelContentWidth): this;
    simplePageMaxContentWidth(value: PanelContentWidth): this;
    subNavigationPosition(value: PanelSubNavigationPosition): this;
    sidebarCollapsibleOnDesktop(value?: boolean): this;
    sidebarFullyCollapsibleOnDesktop(value?: boolean): this;
    collapsibleNavigationGroups(value?: boolean): this;
    sidebarWidth(value: string): this;
    collapsedSidebarWidth(value: string): this;
    collapsibleSidebar(value?: boolean): this;
    navigation(value?: boolean): this;
    navigationItems(items: readonly PanelNavigationSeed[]): this;
    navigationGroups(groups: readonly (PanelNavigationGroup | string)[]): this;
    userMenu(value?: boolean): this;
    userMenuItems(items: readonly PanelUserMenuItem[]): this;
    domain(value: string | null): this;
    domains(values: readonly string[]): this;
    homeUrl(value: string | null): this;
    routes(registrar: PanelRouteRegistrar | null): this;
    authenticatedRoutes(registrar: PanelRouteRegistrar | null): this;
    tenantRoutes(registrar: PanelRouteRegistrar | null): this;
    authenticatedTenantRoutes(registrar: PanelRouteRegistrar | null): this;
    assets(assets: readonly PanelAsset[]): this;
    bootUsing(callback: (panel: PanelBootContext) => void | Promise<void>): this;
    broadcasting(value?: boolean): this;
    spa(value?: boolean | {
        readonly hasPrefetching?: boolean;
    }): this;
    spaUrlExceptions(values: readonly string[]): this;
    unsavedChangesAlerts(value?: boolean): this;
    databaseTransactions(value?: boolean): this;
    resourceCreatePageRedirect(value: 'edit' | 'index' | 'view'): this;
    resourceEditPageRedirect(value: 'index' | 'view' | null): this;
    readOnlyRelationManagersOnResourceViewPagesByDefault(value?: boolean): this;
    strictAuthorization(value?: boolean): this;
    errorNotifications(value?: boolean): this;
    registerErrorNotification(configuration: {
        readonly body: string;
        readonly statusCode?: number;
        readonly title: string;
    }): this;
    registerErrorNotification(title: string, body: string, statusCode?: number): this;
    hiddenErrorNotification(statusCode: number): this;
    disabledErrorNotification(statusCode: number): this;
    middleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent?: boolean): this;
    authMiddleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent?: boolean): this;
    tenantMiddleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent?: boolean): this;
    plugins(plugins: readonly PanelPlugin<TActor>[]): this;
    discoverResources(path?: string): this;
    discoverPages(path?: string): this;
    discoverWidgets(path?: string): this;
    discoverClusters(path?: string): this;
    resources(definitions: readonly ExplicitPanelDefinition<'resource'>[]): this;
    pages(definitions: readonly ExplicitPanelDefinition<'page'>[]): this;
    widgets(definitions: readonly ExplicitPanelDefinition<'widget'>[]): this;
    clusters(definitions: readonly ExplicitPanelDefinition<'cluster'>[]): this;
    renderHook(hook: RenderHook, reference: string | RenderSlotReference): this;
    compileDiscoveryDefinition(): DiscoverableDefinition<'panel', PanelDiscoveryServer>;
    protected createDefinition(state: Readonly<PanelState<TActor>>): CompiledPanelDefinition<TActor>;
    private installPlugin;
    private modelTenancyOptions;
    private defaultProfileConfiguration;
    private writeAuthFeature;
    private writeAuthRoute;
    private authFeaturesWithRoutes;
    private writeRuntime;
    private writeRoute;
    private writeMiddleware;
    private writeMiddlewareInput;
    private writeTenancyConfiguration;
    private staticRoute;
    private routeSegment;
    private componentReference;
    private assertStatusCode;
    private cssLength;
    private hostname;
    private writeDiscovery;
    private register;
}
type PanelActorSource<TActor extends object = object> = {
    readonly prototype: TActor;
} | {
    create(...parameters: never[]): TActor | Promise<TActor>;
};
declare function definePanel<TActorSource extends RecordTypeSource>(id: string, actor: TActorSource): PanelBuilder<RuntimeTypeValue<TActorSource>>;
declare function definePanel<TActorSource extends RecordTypeSource>(actor: TActorSource): PanelBuilder<RuntimeTypeValue<TActorSource>>;
declare function definePanel(id: string): PanelBuilder<unknown>;
declare function definePanel(): PanelBuilder<unknown>;

interface ResourceBuilderState<TModel, TRecord, TQuery, TInput extends Readonly<Record<string, unknown>>, TActor extends object, TTenant, TSoftDeletes extends boolean> {
    readonly actions: readonly ResourceActionDefinition[];
    readonly baseQuery: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery;
    readonly createBindings?: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>;
    readonly discover?: Readonly<DiscoveryDirectories>;
    readonly form?: object;
    readonly globalSearch?: ResourceGlobalSearch<TRecord>;
    readonly id: string;
    readonly infolist?: object;
    readonly lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>;
    readonly model: TModel;
    readonly navigation: ResourceNavigation;
    readonly nested: CompiledNestedResource<ResourceRecord, TRecord, TQuery, TActor, TTenant> | null;
    readonly pages: readonly object[];
    readonly persistence?: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>;
    readonly recordTitle: ResourceAttribute<TRecord>;
    readonly readOnly: boolean;
    readonly relations: readonly object[];
    readonly routeKey: ResourceAttribute<TRecord>;
    readonly shared: boolean;
    readonly singular: SingularResourceOptions<TRecord, TQuery, TActor, TTenant> | null;
    readonly slug: string;
    readonly softDeletes: TSoftDeletes;
    readonly table?: object;
    readonly tenantScope?: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery;
    readonly validation?: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>;
    readonly widgets: readonly object[];
    readonly writableAttributes: readonly ResourceAttribute<TRecord>[];
}
type CompactValueKind = 'boolean' | 'date-time' | 'number' | 'text';
interface CompactComponentDescriptor<TKey extends string = string, TValueKind extends CompactValueKind = CompactValueKind> {
    readonly key: TKey;
    readonly valueKind: TValueKind;
}
interface ResourceRecordComposition<TRecord> {
    readonly resourceRecordType: TRecord;
}
interface ResourceActionDefinition {
    readonly id: string;
    readonly kind: string;
    readonly mount?: 'bulk' | 'modal' | 'notification' | 'page' | 'record';
    readonly source?: string;
}
type ContextTypeCompatible<TActual, TExpected> = unknown extends TActual ? true : TActual extends TExpected ? true : false;
type CheckedResourceComposition<TRecord, TActor, TTenant, TComposition, TRecordMode extends 'ignore' | 'owner' | 'record'> = TComposition extends {
    readonly resourceCompositionTypes: ResourceCompositionTypes<infer TCompositionRecord, infer TCompositionActor, infer TCompositionTenant, infer _TServices>;
} ? ContextTypeCompatible<TCompositionActor, TActor> extends true ? ContextTypeCompatible<TCompositionTenant, TTenant> extends true ? TRecordMode extends 'ignore' ? TComposition : TRecordMode extends 'owner' ? TRecord extends TCompositionRecord ? TComposition : never : TRecord extends TCompositionRecord ? TComposition : never : never : never : TRecordMode extends 'owner' ? TComposition extends {
    readonly kind: 'relation-manager';
    readonly resourceRecordType: infer TCompositionRecord;
} ? TRecord extends TCompositionRecord ? TComposition : never : never : never;
type CheckedResourceCompositions<TRecord, TActor, TTenant, TCompositions extends readonly object[], TRecordMode extends 'ignore' | 'owner' | 'record'> = {
    readonly [TIndex in keyof TCompositions]: CheckedResourceComposition<TRecord, TActor, TTenant, TCompositions[TIndex], TRecordMode>;
};
interface CompilableResourceAction {
    compile(): ResourceActionDefinition;
}
type CompactDescriptorValue<TValueKind extends CompactValueKind> = TValueKind extends 'boolean' ? boolean : TValueKind extends 'number' ? number : TValueKind extends 'date-time' ? Date : string;
type CheckedCompactDescriptor<TRecord, TDescriptor> = TDescriptor extends CompactComponentDescriptor<infer TKey, infer TValueKind> ? TKey extends ResourceAttribute<TRecord> ? NonNullable<ResourceAttributes<TRecord>[TKey]> extends CompactDescriptorValue<TValueKind> ? TDescriptor : never : never : never;
type CheckedCompactComposition<TRecord, TComposition> = TComposition extends readonly CompactComponentDescriptor[] ? {
    readonly [TIndex in keyof TComposition]: CheckedCompactDescriptor<TRecord, TComposition[TIndex]>;
} : TComposition;
type CheckedRecordComposition<TRecord, TComposition> = TComposition extends ResourceRecordComposition<infer TCompositionRecord> ? TCompositionRecord extends TRecord ? TComposition : TCompositionRecord extends Partial<ResourceAttributes<TRecord>> ? TComposition : never : never;
type CheckedRecordCompositions<TRecord, TCompositions extends readonly ResourceRecordComposition<object>[]> = {
    readonly [TIndex in keyof TCompositions]: CheckedRecordComposition<TRecord, TCompositions[TIndex]>;
};
declare class ResourceBuilder<TModel extends {
    readonly definition: ResourceModelDefinition;
}, TRecord extends ResourceRecord, TQuery, TInput extends Readonly<Record<string, unknown>> = ResourceInput<TRecord>, TActor extends object = object, TTenant = unknown, TSoftDeletes extends boolean = boolean> implements DiscoverableBuilder<'resource'> {
    #private;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "resource";
    constructor(model: TModel, state?: ResourceBuilderState<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>);
    get id(): string;
    actions(configure: (actions: ResourceActionComposer<TRecord, TInput & JsonObject, TActor, TTenant, unknown>) => readonly CompilableResourceAction[]): this;
    baseQuery(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): this;
    configured(id: string, configure: (resource: this) => this): this;
    form<const TForm extends readonly CompactComponentDescriptor[]>(form: TForm, ..._validation: TForm extends CheckedCompactComposition<TRecord, TForm> ? [] : [error: never]): this;
    form<TForm extends ResourceRecordComposition<object>>(form: CheckedRecordComposition<TRecord, TForm>): this;
    form<const TFields extends readonly ResourceRecordComposition<object>[]>(form: TFields extends CheckedRecordCompositions<TRecord, TFields> ? TFields : CheckedRecordCompositions<TRecord, TFields>): this;
    globalSearch(metadata: ResourceGlobalSearch<TRecord>): this;
    infolist<TInfolist extends ResourceRecordComposition<object>>(infolist: CheckedRecordComposition<TRecord, TInfolist>): this;
    infolist<const TEntries extends readonly ResourceRecordComposition<object>[]>(infolist: TEntries extends CheckedRecordCompositions<TRecord, TEntries> ? TEntries : CheckedRecordCompositions<TRecord, TEntries>): this;
    createBindings(bindings: (context: ResourceExecutionContext<TActor, TTenant>) => Partial<TInput> | Promise<Partial<TInput>>): this;
    discoverPages(path?: string): this;
    discoverRelationManagers(path?: string): this;
    discoverWidgets(path?: string): this;
    lifecycle(lifecycle: ResourceLifecycle<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>>): this;
    navigation(navigation: ResourceNavigation): this;
    navigationIcon(icon: string): this;
    navigationLabel(label: string): this;
    pages<const TPages extends readonly object[]>(...pages: TPages extends CheckedResourceCompositions<TRecord, TActor, TTenant, TPages, 'ignore'> ? TPages : CheckedResourceCompositions<TRecord, TActor, TTenant, TPages, 'ignore'>): this;
    singular(options: SingularResourceOptions<TRecord, TQuery, TActor, TTenant>): this;
    nestedUnder<TParentModel extends {
        readonly definition: ResourceModelDefinition;
    }, TParentRecord extends ResourceRecord, TParentQuery, TParentInput extends Readonly<Record<string, unknown>>, TParentActor extends object, TParentTenant, TParentSoftDeletes extends boolean>(parent: ResourceBuilder<TParentModel, TParentRecord, TParentQuery, TParentInput, TParentActor, TParentTenant, TParentSoftDeletes>, options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>): this;
    nestedUnder<TParentRecord extends ResourceRecord>(parent: ResourceParentReference<TParentRecord>, options: NestedResourceOptions<TParentRecord, TRecord, TQuery, TActor, TTenant>): this;
    persistence(persistence: ResourcePersistence<TRecord, TInput, ResourceExecutionContext<TActor, TTenant>, TSoftDeletes>): this;
    recordTitle<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): this;
    readOnly(): this;
    relations<const TRelations extends readonly object[]>(...relations: TRelations extends CheckedResourceCompositions<TRecord, TActor, TTenant, TRelations, 'owner'> ? TRelations : CheckedResourceCompositions<TRecord, TActor, TTenant, TRelations, 'owner'>): this;
    routeKey<TAttribute extends ResourceAttribute<TRecord>>(attribute: TAttribute): this;
    shared(value?: boolean): this;
    slug(slug: string): this;
    table<const TTable extends readonly CompactComponentDescriptor[]>(table: TTable, ..._validation: TTable extends CheckedCompactComposition<TRecord, TTable> ? [] : [error: never]): this;
    table<TTable extends ResourceRecordComposition<object>>(table: CheckedRecordComposition<TRecord, TTable>): this;
    table<const TColumns extends readonly ResourceRecordComposition<object>[]>(table: TColumns extends CheckedRecordCompositions<TRecord, TColumns> ? TColumns : CheckedRecordCompositions<TRecord, TColumns>): this;
    tenantScope(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TTenant>) => TQuery): this;
    tenantScope<TNextTenant>(scope: (query: TQuery, context: ResourceExecutionContext<TActor, TNextTenant>) => TQuery): ResourceBuilder<TModel, TRecord, TQuery, TInput, TActor, TNextTenant, TSoftDeletes>;
    validation(validation: ResourceValidation<TInput, ResourceExecutionContext<TActor, TTenant>>): this;
    widgets<const TWidgets extends readonly object[]>(...widgets: TWidgets extends CheckedResourceCompositions<TRecord, TActor, TTenant, TWidgets, 'record'> ? TWidgets : CheckedResourceCompositions<TRecord, TActor, TTenant, TWidgets, 'record'>): this;
    writableAttributes<const TAttributes extends readonly ResourceAttribute<TRecord>[]>(attributes: TAttributes): this;
    compile(): ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>;
    compileDiscoveryDefinition(): ResourceDefinition<TModel, TRecord, TQuery, TInput, TActor, TTenant, TSoftDeletes>;
    private with;
    private withDiscovery;
}
type InferredSoftDeletes<TModel extends {
    readonly definition: {
        readonly softDeletes: boolean;
    };
}> = TModel['definition']['softDeletes'] extends true ? true : false;
type InferredRecord<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = Awaited<ReturnType<TModel['create']>>;
type InferredQuery<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = ReturnType<TModel['query']>;
interface ResourceContextTypeSources<TActorSource extends RecordTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined> {
    readonly actor?: TActorSource;
    readonly tenant?: TTenantSource;
}
type ResourceActorValue<TActorSource extends RecordTypeSource | undefined> = TActorSource extends RecordTypeSource ? Extract<RuntimeTypeValue<TActorSource>, object> : object;
type PublicResourceRecord<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = [
    ResourceRecordFor<TModel>
] extends [never] ? InferredRecord<TModel> : Extract<ResourceRecordFor<TModel>, ResourceRecord>;
type PublicResourceModel<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>> = ResourceModel<PublicResourceRecord<TModel>, InferredQuery<TModel>>;
type InferredResourceBuilder<TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>, TActor extends object = object, TTenant = unknown> = ResourceBuilder<PublicResourceModel<TModel>, PublicResourceRecord<TModel>, InferredQuery<TModel>, ResourceInput<PublicResourceRecord<TModel>>, TActor, TTenant, InferredSoftDeletes<TModel>>;
type ResourceFactory = {
    <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>, TActorSource extends RecordTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined>(model: TModel, sources: ResourceContextTypeSources<TActorSource, TTenantSource>): InferredResourceBuilder<TModel, ResourceActorValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>>;
    <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>>(model: TModel): InferredResourceBuilder<TModel>;
};
declare const defineResource: ResourceFactory;

declare class TableQueryExecutor<TQuery extends HoloTableQuery<TQuery, TRecord>, TRecord, TContext> {
    #private;
    constructor(definition: TableQueryDefinition<TQuery, TContext>);
    compile(state: TableQueryState, context: TContext): TQuery;
    execute(state: TableQueryState, context: TContext): Promise<TableQueryResult<TRecord>>;
    count(state: TableQueryState, context: TContext): Promise<number>;
    executeSelection<TRecordId extends TableRecordIdentifier>(state: TableQueryState, selection: TableSelection<TRecordId>, context: TContext): Promise<readonly TRecord[]>;
    resolveRowAction<TRecordId extends TableRecordIdentifier>(state: TableQueryState, recordId: TRecordId, context: TContext): Promise<TRecord | undefined>;
    private createScopedQuery;
    private applyUserConstraints;
    private applySort;
    private applyPlans;
    private validatePagination;
    private executeAll;
    private pageResult;
    private simpleResult;
    private cursorResult;
}

interface RelationManagerContext<TOwner, TActor extends object, TTenant> {
    readonly actor: TActor | null;
    readonly owner: TOwner;
    readonly signal: AbortSignal;
    readonly tenant: TTenant;
}
interface RelationManagerAuthorization<TOwner, TRelated, TActor extends object, TTenant> {
    authorizeOwner(operation: RelationOperation, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    authorizeRelated(operation: RelationOperation, related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
}
interface RelationManagerTransaction {
    run<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
}
interface RelationOptionPage<TRelated> {
    readonly records: readonly TRelated[];
    readonly page: number;
    readonly perPage: number;
    readonly hasMore: boolean;
    readonly total?: number;
}
interface RelationPersistence<TOwner, TRelated, TQuery, TInput extends Readonly<Record<string, unknown>>, TPivot extends Readonly<Record<string, unknown>>, TValue extends OptionValue, TActor extends object, TTenant> {
    createQuery(context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery;
    scopeToOwner(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery;
    applyTenantScope(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery;
    applyAuthorizationScope(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery;
    list(query: TQuery, request: NormalizedRelationListRequest): Promise<RelationRecordPage<TRelated>>;
    find(query: TQuery, id: TValue): Promise<TRelated | undefined>;
    create(input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>;
    update(related: TRelated, input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>;
    delete(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    associate?(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    dissociate?(related: TRelated | undefined, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    attach?(related: TRelated, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    detach?(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    updatePivot?(related: TRelated, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    listOptions?(request: OptionQueryRequest<TValue>, context: RelationManagerContext<TOwner, TActor, TTenant>, signal?: AbortSignal): Promise<RelationOptionPage<TRelated>>;
    hydrateOptions?(request: OptionQueryRequest<TValue>, selected: readonly TValue[], context: RelationManagerContext<TOwner, TActor, TTenant>, signal?: AbortSignal): Promise<readonly TRelated[]>;
    optionValue?(record: TRelated): TValue;
    optionLabel?(record: TRelated): string;
}
interface RelationValidation<TValue, TContext> {
    validate(value: TValue, context: TContext): Promise<void>;
}
interface RelationManagerDefinition<TOwner, TRelated, TQuery, TInput extends Readonly<Record<string, unknown>>, TPivot extends Readonly<Record<string, unknown>>, TValue extends OptionValue, TActor extends object, TTenant> {
    readonly id: string;
    readonly relationName: string;
    readonly relation: RelationDefinition;
    readonly operations: readonly RelationOperation[];
    readonly presentation: RelationPresentation;
    readonly group: string | null;
    readonly badge: ((context: RelationManagerContext<TOwner, TActor, TTenant>) => string | number | Promise<string | number>) | null;
    readonly visible: (context: RelationManagerContext<TOwner, TActor, TTenant>) => boolean | Promise<boolean>;
    readonly persistence: RelationPersistence<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>;
    readonly authorization: RelationManagerAuthorization<TOwner, TRelated, TActor, TTenant>;
    readonly transaction: RelationManagerTransaction;
    readonly inputValidation?: RelationValidation<TInput, RelationManagerContext<TOwner, TActor, TTenant>>;
    readonly pivotValidation?: RelationValidation<TPivot, RelationManagerContext<TOwner, TActor, TTenant>>;
    readonly writableInputFields: readonly Extract<keyof TInput, string>[];
    readonly writablePivotFields: readonly Extract<keyof TPivot, string>[];
}

interface RelationManagerBuilderOptions<TOwner, TRelated, TQuery, TInput extends Readonly<Record<string, unknown>>, TPivot extends Readonly<Record<string, unknown>>, TValue extends OptionValue, TActor extends object, TTenant> {
    readonly relationName: string;
    readonly relation: RelationDefinition;
    readonly persistence: RelationPersistence<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>;
    readonly authorization: RelationManagerAuthorization<TOwner, TRelated, TActor, TTenant>;
    readonly transaction: RelationManagerTransaction;
}
declare class RelationManagerBuilder<TOwner, TRelated, TQuery, TInput extends Readonly<Record<string, unknown>>, TPivot extends Readonly<Record<string, unknown>>, TValue extends OptionValue, TActor extends object, TTenant> {
    #private;
    readonly resourceCompositionTypes: ResourceCompositionTypes<TOwner, TActor, TTenant>;
    constructor(options: RelationManagerBuilderOptions<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>);
    id(id: string): this;
    operations(operations: readonly RelationOperation[]): this;
    presentation(presentation: RelationPresentation, group?: string): this;
    visibleWhen(visible: (context: RelationManagerContext<TOwner, TActor, TTenant>) => boolean | Promise<boolean>): this;
    badge(badge: (context: RelationManagerContext<TOwner, TActor, TTenant>) => string | number | Promise<string | number>): this;
    fields<TField extends Extract<keyof TInput, string>>(fields: readonly TField[], validation?: RelationValidation<TInput, RelationManagerContext<TOwner, TActor, TTenant>>): this;
    pivotFields<TField extends Extract<keyof TPivot, string>>(fields: readonly TField[], validation?: RelationValidation<TPivot, RelationManagerContext<TOwner, TActor, TTenant>>): this;
    compile(): RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>;
    private assertMutable;
    private assertPersistenceOperation;
}
declare function relationManagersFor<TOwnerSource extends RecordTypeSource, TRelatedSource extends RecordTypeSource, TQuerySource extends RuntimeTypeSource, TInputSource extends RecordTypeSource, TPivotSource extends RecordTypeSource, TValueSource extends NumberConstructor | StringConstructor, TActorSource extends {
    readonly prototype: object;
}, TTenantSource extends RuntimeTypeSource | undefined = undefined>(_sources: {
    readonly actor: TActorSource;
    readonly input: TInputSource;
    readonly owner: TOwnerSource;
    readonly pivot: TPivotSource;
    readonly query: TQuerySource;
    readonly related: TRelatedSource;
    readonly tenant?: TTenantSource;
    readonly value: TValueSource;
}): {
    define(options: RelationManagerBuilderOptions<RecordTypeValue<TOwnerSource>, RecordTypeValue<TRelatedSource>, RuntimeTypeValue<TQuerySource>, RecordTypeValue<TInputSource> & Readonly<Record<string, unknown>>, RecordTypeValue<TPivotSource> & Readonly<Record<string, unknown>>, Extract<RuntimeTypeValue<TValueSource>, OptionValue>, Extract<RuntimeTypeValue<TActorSource>, object>, OptionalRuntimeTypeValue<TTenantSource>>): RelationManagerBuilder<RecordTypeValue<TOwnerSource>, RecordTypeValue<TRelatedSource>, RuntimeTypeValue<TQuerySource>, RecordTypeValue<TInputSource> & Readonly<Record<string, unknown>>, RecordTypeValue<TPivotSource> & Readonly<Record<string, unknown>>, Extract<RuntimeTypeValue<TValueSource>, OptionValue>, Extract<RuntimeTypeValue<TActorSource>, object>, OptionalRuntimeTypeValue<TTenantSource>>;
};

declare class RelationRecordNotFoundError extends Error {
    constructor();
}
declare class RelationOperationNotAllowedError extends Error {
    constructor(operation: RelationOperation);
}
declare class RelationPivotInputError extends Error {
    constructor(field: string);
}
declare class RelationInputError extends Error {
    constructor(field: string);
}
declare class RelationListPaginationError extends Error {
    constructor(message: string);
}
declare class RelationManagerExecutor<TOwner, TRelated, TQuery, TInput extends Readonly<Record<string, unknown>>, TPivot extends Readonly<Record<string, unknown>>, TValue extends OptionValue, TActor extends object, TTenant> {
    #private;
    constructor(definition: RelationManagerDefinition<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>);
    isVisible(context: RelationManagerContext<TOwner, TActor, TTenant>): boolean | Promise<boolean>;
    badge(context: RelationManagerContext<TOwner, TActor, TTenant>): string | number | Promise<string | number> | null;
    list(request: RelationListRequest, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<RelationRecordPage<TRelated>>;
    view(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>;
    create(input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>;
    edit(id: TValue, input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>;
    delete(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    associate(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    dissociate(id: TValue | undefined, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    attach(id: TValue, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    detach(id: TValue, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    editPivot(id: TValue, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>;
    optionService(): OptionService<TValue, RelationManagerContext<TOwner, TActor, TTenant>>;
    private assertOperation;
    private assertOwner;
    private createScopedQuery;
    private resolveAuthorized;
    private resolveOption;
    private assertPivotInput;
    private assertInput;
}

declare function allowedRelationOperations(relation: RelationDefinition): readonly RelationOperation[];
declare function relationSupportsOperation(relation: RelationDefinition, operation: RelationOperation): boolean;

declare function holoNotificationStore(): PanelNotificationStore;

interface DashboardState<TActor, TTenant, TServices> {
    authorize: (context: DashboardContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>;
    default: boolean;
    navigation: DashboardNavigation;
    path: string;
    widgets: string[];
}
declare class DashboardBuilder<TActor = unknown, TTenant = unknown, TServices = unknown> extends ConstructionBuilder<DashboardState<TActor, TTenant, TServices>, CompiledDashboardDefinition<TActor, TTenant, TServices>> implements DiscoverableBuilder<'page'> {
    readonly id: string;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "page";
    constructor(id: string);
    path(value: string): this;
    default(value?: boolean): this;
    navigation(label: string, options?: {
        readonly icon?: string | null;
        readonly sort?: number;
    }): this;
    widgets(...ids: readonly string[]): this;
    authorize(resolver: DashboardState<TActor, TTenant, TServices>['authorize']): this;
    compileDiscoveryDefinition(): DiscoverableDefinition<'page'>;
    protected createDefinition(state: Readonly<DashboardState<TActor, TTenant, TServices>>): CompiledDashboardDefinition<TActor, TTenant, TServices>;
}
declare function defineDashboard<TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>): DashboardBuilder<RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
declare function defineDashboard(id: string): DashboardBuilder<unknown, unknown, unknown>;
declare function selectDefaultDashboard<TActor, TTenant, TServices>(definitions: readonly CompiledDashboardDefinition<TActor, TTenant, TServices>[], context: DashboardContext<TActor, TTenant, TServices>): Promise<CompiledDashboardDefinition<TActor, TTenant, TServices> | null>;
declare function createResourceWidgetContext<TRecord, TActor, TTenant, TServices>(context: DashboardContext<TActor, TTenant, TServices>, resourceId: string, pageId: string, placement: WidgetResourcePlacement, options?: {
    readonly record?: Readonly<TRecord> | null;
    readonly tableState?: Readonly<TableQueryState> | null;
}): ResourceWidgetContext<TRecord, TActor, TTenant, TServices>;

type ReservedTenantContextKeys = 'actor' | 'cacheKey' | 'guard' | 'panelId' | 'provider' | 'scopeTenantQuery' | 'signal' | 'tenant' | 'tenantBindings' | 'tenantId' | 'tenantRouteKey';
type TenantContextExtension<TExtension extends object> = TExtension & {
    readonly [TKey in ReservedTenantContextKeys]?: never;
};
type BoundPanelTenantContext<TActor, TTenant, TTenantId extends PanelTenantIdentifier, TExtension extends object> = Readonly<PanelAuthenticatedScope<TActor> & PanelTenantExecutionContext<TTenant, TTenantId> & TExtension>;
declare function bindPanelTenantContext<TActor, TTenant, TTenantId extends PanelTenantIdentifier, const TExtension extends object>(context: PanelTenantExecutionContext<TTenant, TTenantId>, scope: PanelAuthenticatedScope<TActor>, extension: TenantContextExtension<TExtension>): BoundPanelTenantContext<TActor, TTenant, TTenantId, TExtension>;
declare function panelTenantNotificationScope<TTenant, TTenantId extends PanelTenantIdentifier>(context: PanelTenantExecutionContext<TTenant, TTenantId>, actorId: PanelTenantIdentifier): Readonly<PanelNotificationScope>;

type CustomEntryType = ExtensionTypeId<'entry'> | `${string}:entry:${string}`;
interface CustomEntryDefinition<TType extends CustomEntryType> {
    readonly configuration: JsonObject;
    readonly type: TType;
}
declare function defineEntry<const TType extends CustomEntryType>(type: TType, configuration?: JsonObject): CustomEntryDefinition<TType>;

declare class TextEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'text'> {
    constructor(path: TPath);
    prefix(value: string): this;
    suffix(value: string): this;
    limit(characters: number): this;
    list(separator?: string): this;
    date(options?: Intl.DateTimeFormatOptions): this;
    number(options?: Intl.NumberFormatOptions): this;
    badge(value?: boolean): this;
    markdown(value?: boolean): this;
    richText(sanitizer: string): this;
}
declare class IconEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'icon'> {
    constructor(path: TPath);
    icon(name: string): this;
    boolean(truthy?: string, falsy?: string): this;
}
declare class BooleanEntry<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends EntryBuilder<TRecord, boolean, 'boolean'> {
    constructor(path: TPath);
    icons(truthy?: string, falsy?: string): this;
}
declare class ImageEntry<TRecord, TPath extends RecordPathFor<TRecord, string>> extends EntryBuilder<TRecord, string, 'image'> {
    constructor(path: TPath);
    circular(value?: boolean): this;
    size(pixels: number): this;
    alt(value: string): this;
}
declare class ColorEntry<TRecord, TPath extends RecordPathFor<TRecord, string>> extends EntryBuilder<TRecord, string, 'color'> {
    constructor(path: TPath);
}
declare class CodeEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'code'> {
    constructor(path: TPath);
    language(value: string): this;
    lineNumbers(value?: boolean): this;
}
declare class KeyValueEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'key-value'> {
    constructor(path: TPath);
    keyLabel(value: string): this;
    valueLabel(value: string): this;
}
declare class RepeatableEntry<TRecord, TPath extends EntryRecordPath<TRecord>> extends EntryBuilder<TRecord, EntryRecordPathValue<TRecord, TPath>, 'repeatable'> {
    constructor(path: TPath);
    schema(entries: readonly string[]): this;
}
declare class CustomEntry<TRecord, TValue, TType extends CustomEntryType> extends EntryBuilder<TRecord, TValue, TType> {
    constructor(type: TType, path: EntryRecordPath<TRecord>, configuration?: JsonObject);
}
interface EntryFactory<TRecord> {
    boolean<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): BooleanEntry<TRecord, TPath>;
    code<const TPath extends EntryRecordPath<TRecord>>(path: TPath): CodeEntry<TRecord, TPath>;
    color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorEntry<TRecord, TPath>;
    custom<const TPath extends EntryRecordPath<TRecord>, const TType extends CustomEntryType>(type: TType, path: TPath, configuration?: JsonObject): CustomEntry<TRecord, unknown, TType>;
    icon<const TPath extends EntryRecordPath<TRecord>>(path: TPath): IconEntry<TRecord, TPath>;
    image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageEntry<TRecord, TPath>;
    keyValue<const TPath extends EntryRecordPath<TRecord>>(path: TPath): KeyValueEntry<TRecord, TPath>;
    repeatable<const TPath extends EntryRecordPath<TRecord>>(path: TPath): RepeatableEntry<TRecord, TPath>;
    text<const TPath extends EntryRecordPath<TRecord>>(path: TPath): TextEntry<TRecord, TPath>;
}
type EntryRecordSource<TRecord extends object> = RecordTypeSource & ({
    readonly prototype: TRecord;
} | {
    create(...parameters: never[]): TRecord | Promise<TRecord>;
});
declare function entriesFor<TSource extends RecordTypeSource>(_source: TSource): EntryFactory<RecordTypeValue<TSource>>;

declare function formatEntryState(value: unknown, formatters: readonly EntryFormat[], locale?: string): JsonValue;
declare function copyableEntryText(value: JsonValue): string;

declare function resolveEntrySource<TRecord>(record: Readonly<TRecord>, source: EntryStateSource): unknown;
declare function entryValueAt<TRecord, const TPath extends EntryRecordPath<TRecord>>(record: Readonly<TRecord>, path: TPath): EntryRecordPathValue<TRecord, TPath>;

interface ColumnState<TRecord, TPath extends RecordPath<TRecord>> {
    action?: ColumnResolver<TRecord, TPath, string | null>;
    alignment: ColumnAlignment;
    copyable: boolean;
    dataSource: ColumnDataSource;
    formatters: TextFormatter[];
    hidden: boolean;
    inlineEditor: InlineEditorManifest | null;
    label: string | null;
    lineClamp: number | null;
    path: TPath;
    searchable: boolean;
    sortable: boolean;
    state?: ColumnResolver<TRecord, TPath, JsonValue>;
    toggleable: boolean;
    tooltip?: ColumnResolver<TRecord, TPath, string | null>;
    url?: ColumnResolver<TRecord, TPath, string | null>;
    width: number | string | null;
    wrap: boolean;
}
declare abstract class ColumnBuilder<TRecord, TPath extends RecordPath<TRecord>, TType extends string> extends ConstructionBuilder<ColumnState<TRecord, TPath>, CompiledColumnDefinition<TRecord, TPath, TType>> {
    #private;
    readonly resourceRecordType: TRecord;
    protected constructor(type: TType, path: TPath);
    label(value: string | null): this;
    sortable(value?: boolean): this;
    searchable(value?: boolean): this;
    toggleable(value?: boolean): this;
    hidden(value?: boolean): this;
    alignment(value: ColumnAlignment): this;
    width(value: number | string | null): this;
    wrap(value?: boolean): this;
    lineClamp(lines: number | null): this;
    tooltip(value: string | null | ColumnResolver<TRecord, TPath, string | null>): this;
    url(value: string | null | ColumnResolver<TRecord, TPath, string | null>): this;
    action(value: string | ColumnResolver<TRecord, TPath, string | null>): this;
    copyable(value?: boolean): this;
    state(resolver: ColumnResolver<TRecord, TPath, JsonValue>): this;
    relationship<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath, titlePath: RecordPath<RelatedRecord<RecordPathValue<TRecord, TRelationPath>>>): this;
    count<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath): this;
    exists<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath): this;
    aggregate<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath, field: RecordPath<RelatedRecord<RecordPathValue<TRecord, TRelationPath>>>, aggregate: ColumnAggregate): this;
    protected addFormatter(formatter: TextFormatter): this;
    protected inlineEditor(editor: InlineEditorManifest): this;
    protected createDefinition(state: Readonly<ColumnState<TRecord, TPath>>): CompiledColumnDefinition<TRecord, TPath, TType>;
}

interface SelectColumnOption extends JsonObject {
    label: string;
    value: JsonPrimitive;
}
declare class TextColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'text'> {
    constructor(path: TPath);
    badge(value?: boolean): this;
    date(options?: Intl.DateTimeFormatOptions): this;
    time(options?: Intl.DateTimeFormatOptions): this;
    dateTime(options?: Intl.DateTimeFormatOptions): this;
    relativeTime(value?: boolean): this;
    number(options?: Intl.NumberFormatOptions): this;
    money(currency: string, options?: Omit<Intl.NumberFormatOptions, 'currency' | 'style'>): this;
    markdown(value?: boolean): this;
    list(separator?: string): this;
    limit(characters: number): this;
    words(count: number): this;
    icon(name: string): this;
    color(value: string): this;
    prefix(value: string): this;
    suffix(value: string): this;
}
declare class IconColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'icon'> {
    constructor(path: TPath);
    icons(truthy: string, falsy: string): this;
}
declare class BooleanColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'boolean'> {
    constructor(path: TPath);
    icons(truthy?: string, falsy?: string): this;
}
declare class ImageColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'image'> {
    constructor(path: TPath);
    circular(value?: boolean): this;
    size(pixels: number): this;
}
declare class ColorColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'color'> {
    constructor(path: TPath);
}
declare class CheckboxColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'checkbox'> {
    constructor(path: TPath);
    editable(action: string): this;
}
declare class SelectColumn<TRecord, TPath extends RecordPath<TRecord>> extends ColumnBuilder<TRecord, TPath, 'select'> {
    constructor(path: TPath);
    editable(action: string, options: readonly SelectColumnOption[]): this;
}
declare class ToggleColumn<TRecord, TPath extends RecordPathFor<TRecord, boolean>> extends ColumnBuilder<TRecord, TPath, 'toggle'> {
    constructor(path: TPath);
    editable(action: string): this;
}
declare class TextInputColumn<TRecord, TPath extends RecordPathFor<TRecord, string>> extends ColumnBuilder<TRecord, TPath, 'text-input'> {
    constructor(path: TPath);
    editable(action: string, options?: {
        readonly maximumLength?: number;
        readonly placeholder?: string;
    }): this;
}
declare class CustomColumn<TRecord, TPath extends RecordPath<TRecord>, TType extends ExtensionTypeId<'column'> | `${string}:column:${string}`> extends ColumnBuilder<TRecord, TPath, TType> {
    constructor(type: TType, path: TPath, configuration?: JsonObject);
}
interface ColumnFactory<TRecord> {
    boolean<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): BooleanColumn<TRecord, TPath>;
    checkbox<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): CheckboxColumn<TRecord, TPath>;
    color<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ColorColumn<TRecord, TPath>;
    custom<const TPath extends RecordPath<TRecord>, const TType extends ExtensionTypeId<'column'> | `${string}:column:${string}`>(type: TType, path: TPath, configuration?: JsonObject): CustomColumn<TRecord, TPath, TType>;
    icon<const TPath extends RecordPath<TRecord>>(path: TPath): IconColumn<TRecord, TPath>;
    image<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): ImageColumn<TRecord, TPath>;
    select<const TPath extends RecordPath<TRecord>>(path: TPath): SelectColumn<TRecord, TPath>;
    text<const TPath extends RecordPath<TRecord>>(path: TPath): TextColumn<TRecord, TPath>;
    textInput<const TPath extends RecordPathFor<TRecord, string>>(path: TPath): TextInputColumn<TRecord, TPath>;
    toggle<const TPath extends RecordPathFor<TRecord, boolean>>(path: TPath): ToggleColumn<TRecord, TPath>;
}
type ColumnRecordSource<TRecord extends object> = RecordTypeSource & ({
    readonly prototype: TRecord;
} | {
    create(...parameters: never[]): TRecord | Promise<TRecord>;
});
declare function columnsFor<TSource extends RecordTypeSource>(source: TSource): ColumnFactory<RecordTypeValue<TSource>>;

declare function formatTextValue(input: JsonValue | Date | readonly JsonValue[], formatters: readonly TextFormatter[], options?: {
    readonly locale?: string;
    readonly now?: Date;
}): string;

interface InlineEditableColumnManifest {
    readonly inlineEditor: {
        readonly action?: unknown;
    } | null;
    readonly path: string;
}
interface InlineEditRequest<TRecordId extends number | string> {
    readonly action: string;
    readonly columnPath: string;
    readonly expectedVersion?: string;
    readonly recordId: TRecordId;
    readonly value: JsonValue;
}
interface InlineEditActionInput<TRecordId extends number | string> extends JsonObject {
    action: string;
    columnPath: string;
    expectedVersion: string | null;
    recordId: TRecordId;
    value: JsonValue;
}
interface InlineEditActionExecutor<TRecordId extends number | string, TResult> {
    execute(input: InlineEditActionInput<TRecordId>, signal?: AbortSignal): Promise<TResult>;
}
declare function executeInlineColumnEdit<TRecordId extends number | string, TResult>(column: InlineEditableColumnManifest, request: InlineEditRequest<TRecordId>, executor: InlineEditActionExecutor<TRecordId, TResult>, signal?: AbortSignal): Promise<TResult>;

declare class AdvancedColumnFactory<TRecord> {
    column<TPath extends RecordPath<TRecord>, const TOperators extends readonly AdvancedOperatorFor<RecordPathValue<TRecord, TPath>>[]>(id: string, path: TPath, column: string, scalarType: AdvancedScalarType, operators: TOperators): AdvancedFilterColumn<TRecord, TPath, TOperators>;
}
type AdvancedColumnRecordSource<TRecord extends object> = RecordTypeSource & ({
    readonly prototype: TRecord;
} | {
    create(...parameters: never[]): TRecord | Promise<TRecord>;
});
declare function advancedColumnsFor<TSource extends RecordTypeSource>(source: TSource): AdvancedColumnFactory<RecordTypeValue<TSource>>;
declare function advancedFilterValue<TColumns extends Readonly<Record<string, unknown>>>(conditions: readonly AdvancedFilterCondition<TColumns>[]): AdvancedFilterValue;
declare class AdvancedQueryFilter<TRecord, TColumns extends AdvancedColumnMap<TRecord>, TContext = unknown> extends FilterBuilder<AdvancedFilterValue, 'advanced-query', TContext> {
    #private;
    constructor(id: string, columns: TColumns);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<AdvancedFilterValue, TContext>;
    protected properties(): JsonObject;
}
declare function advancedQueryFilter<TRecord, TColumns extends AdvancedColumnMap<TRecord>, TContext = unknown>(id: string, columns: TColumns): AdvancedQueryFilter<TRecord, TColumns, TContext>;

declare abstract class ColumnFilterBuilder<TRecord, TPath extends RecordPath<TRecord>, TValue extends JsonValue, TType extends string, TContext> extends FilterBuilder<TValue, TType, TContext> {
    readonly path: TPath;
    readonly column: string;
    protected constructor(id: string, type: TType, path: TPath, column: string, defaultValue: TValue);
    protected definition(operators: readonly TableFilterOperator[]): Readonly<Record<string, TableQueryFilterDefinition>>;
}
declare class BooleanFilter<TRecord, TPath extends RecordPathFor<TRecord, boolean>, TContext = unknown> extends ColumnFilterBuilder<TRecord, TPath, boolean | null, 'boolean', TContext> {
    constructor(id: string, path: TPath, column?: string);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<boolean | null, TContext>;
}
declare class SelectFilter<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown, TType extends 'relationship-select' | 'select' = 'select'> extends ColumnFilterBuilder<TRecord, TPath, JsonValue, TType, TContext> {
    #private;
    constructor(id: string, path: TPath, column?: string, type?: TType);
    options(values: readonly SelectFilterOption[]): this;
    optionsUsing(resolver: (context: FilterExecutionContext<TContext>) => readonly SelectFilterOption[] | Promise<readonly SelectFilterOption[]>): this;
    multiple(value?: boolean): this;
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<JsonValue, TContext>;
    protected properties(): JsonObject;
    protected additionalServerHandles(): Partial<FilterServerHandles<JsonValue, TContext>>;
}
declare class RelationshipSelectFilter<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown> extends SelectFilter<TRecord, TPath, TContext, 'relationship-select'> {
    #private;
    constructor(id: string, path: TPath, relationship: string, titleColumn: string, column?: string);
    protected properties(): JsonObject;
}
declare class TernaryFilter<TRecord, TPath extends RecordPathFor<TRecord, boolean>, TContext = unknown> extends ColumnFilterBuilder<TRecord, TPath, TernaryFilterValue, 'ternary', TContext> {
    constructor(id: string, path: TPath, column?: string);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<TernaryFilterValue, TContext>;
}
declare class DateRangeFilter<TRecord, TPath extends RecordPathFor<TRecord, Date | string>, TContext = unknown> extends ColumnFilterBuilder<TRecord, TPath, DateRangeFilterValue, 'date-range', TContext> {
    constructor(id: string, path: TPath, column?: string);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<DateRangeFilterValue, TContext>;
}
declare class TrashedFilter<TRecord, TContext = unknown> extends ColumnFilterBuilder<TRecord, RecordPath<TRecord>, TrashedFilterValue, 'trashed', TContext> {
    constructor(id: string, deletedAtPath: RecordPath<TRecord>, column?: string);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<TrashedFilterValue, TContext>;
}
interface CustomFilterOptions<TValue extends JsonValue, TContext> {
    readonly defaultValue: TValue;
    readonly schema: JsonObject;
    readonly targets: Readonly<Record<string, TableQueryFilterDefinition>>;
    readonly encode: FilterEncoder<TValue, TContext>;
}
declare class CustomSchemaFilter<TValue extends JsonValue, TContext = unknown> extends FilterBuilder<TValue, 'custom', TContext> {
    #private;
    constructor(id: string, options: CustomFilterOptions<TValue, TContext>);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<TValue, TContext>;
    protected properties(): JsonObject;
}
interface ExtensionFilterOptions<TValue extends JsonValue, TContext> {
    readonly defaultValue: TValue;
    readonly encode: FilterEncoder<TValue, TContext>;
    readonly properties?: JsonObject;
    readonly targets: Readonly<Record<string, TableQueryFilterDefinition>>;
}
declare class ExtensionFilterBuilder<TValue extends JsonValue, TType extends ExtensionTypeId<'filter'>, TContext = unknown> extends FilterBuilder<TValue, TType, TContext> {
    #private;
    constructor(id: string, typeId: TType, options: ExtensionFilterOptions<TValue, TContext>);
    protected queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>;
    protected encoder(): FilterEncoder<TValue, TContext>;
    protected properties(): JsonObject;
}
declare class ExtensionFilterFactory<TContext = unknown> {
    create<TValue extends JsonValue, const TType extends ExtensionTypeId<'filter'>>(id: string, typeId: TType, options: ExtensionFilterOptions<TValue, TContext>): ExtensionFilterBuilder<TValue, TType, TContext>;
}
declare function extensionFiltersFor<TContextSource extends RuntimeTypeSource | undefined = undefined>(_context?: TContextSource): ExtensionFilterFactory<OptionalRuntimeTypeValue<TContextSource>>;
declare class FilterFactory<TRecord, TContext = unknown> {
    boolean<TPath extends RecordPathFor<TRecord, boolean>>(id: string, path: TPath, column?: string): BooleanFilter<TRecord, TPath, TContext>;
    select<TPath extends RecordPath<TRecord>>(id: string, path: TPath, column?: string): SelectFilter<TRecord, TPath, TContext>;
    relationshipSelect<TPath extends RecordPath<TRecord>>(id: string, path: TPath, relationship: string, titleColumn: string, column?: string): RelationshipSelectFilter<TRecord, TPath, TContext>;
    ternary<TPath extends RecordPathFor<TRecord, boolean>>(id: string, path: TPath, column?: string): TernaryFilter<TRecord, TPath, TContext>;
    dateRange<TPath extends RecordPathFor<TRecord, Date | string>>(id: string, path: TPath, column?: string): DateRangeFilter<TRecord, TPath, TContext>;
    trashed(id: string, deletedAtPath: RecordPath<TRecord>, column?: string): TrashedFilter<TRecord, TContext>;
}
type FilterTypeSource<TValue extends object> = RecordTypeSource & ({
    readonly prototype: TValue;
} | {
    create(...parameters: never[]): TValue | Promise<TValue>;
});
declare function filtersFor<TRecordSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_record: TRecordSource, _context?: TContextSource): FilterFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>>;

interface ExecutableFilterDefinition<TContext> {
    readonly manifest: FilterManifest<string, JsonValue>;
    readonly queryDefinitions: Readonly<Record<string, TableQueryFilterDefinition>>;
    encode(value: JsonValue, context: FilterExecutionContext<TContext>): Promise<TableQueryFilter | readonly TableQueryFilter[] | null>;
    indicator?(value: JsonValue, context: FilterExecutionContext<TContext>): Promise<string>;
}
interface TableFilterSnapshot {
    readonly draft: Readonly<Record<string, JsonValue>>;
    readonly applied: Readonly<Record<string, JsonValue>>;
}
declare class FilterCollection<TContext = unknown> {
    #private;
    readonly queryDefinitions: Readonly<Record<string, TableQueryFilterDefinition>>;
    constructor(definitions: readonly ExecutableFilterDefinition<TContext>[]);
    manifests(): readonly FilterManifest[];
    columns(value: FilterResponsiveColumns): this;
    placement(value: FilterCollectionPlacement): this;
    dropdown(): this;
    inline(): this;
    modal(): this;
    before(reference: string | RenderSlotReference): this;
    after(reference: string | RenderSlotReference): this;
    presentation(id?: string): FilterCollectionPresentation;
    state(initial?: Readonly<Record<string, JsonValue>>): TableFilterState<TContext>;
    compile(values: Readonly<Record<string, JsonValue>>, context: FilterExecutionContext<TContext>): Promise<P7AFilterCompatibility>;
    require(id: string): ExecutableFilterDefinition<TContext>;
}
declare class TableFilterState<TContext = unknown> {
    #private;
    constructor(collection: FilterCollection<TContext>, initial?: Readonly<Record<string, JsonValue>>);
    snapshot(): TableFilterSnapshot;
    update(id: string, value: JsonValue): this;
    applyDeferred(): this;
    reset(id: string): this;
    resetAll(): this;
    remove(id: string): this;
    removeAll(): this;
    indicators(context: FilterExecutionContext<TContext>): Promise<readonly FilterIndicator[]>;
    compile(context: FilterExecutionContext<TContext>): Promise<P7AFilterCompatibility>;
}
declare function filterCollection<TContext = unknown>(...definitions: readonly ExecutableFilterDefinition<TContext>[]): FilterCollection<TContext>;
declare function asFilterDefinition<TValue extends JsonValue, TType extends string, TContext>(definition: CompiledFilterDefinition<TValue, TType, TContext>): ExecutableFilterDefinition<TContext>;

type GroupOrder = 'asc' | 'desc';
type SummaryKind = 'average' | 'count' | 'custom' | 'max' | 'min' | 'range' | 'sum';
type SummaryMode = 'full-query' | 'page';
type AggregateDriver = 'mysql' | 'postgres' | 'sqlite';
type AggregatePrimitive = bigint | number | string | null;
interface GroupManifest<TPath extends string = string> {
    readonly id: string;
    readonly path: TPath;
    readonly column: string;
    readonly label: string | null;
    readonly collapsible: boolean;
    readonly collapsed: boolean;
    readonly order: GroupOrder;
    readonly persistKey: string;
}
interface GroupResolverContext<TRecord, TPath extends RecordPath<TRecord>, TContext> {
    readonly context: TContext;
    readonly path: TPath;
    readonly value: RecordPathValue<TRecord, TPath>;
    readonly records: readonly TRecord[];
}
type GroupResolver<TRecord, TPath extends RecordPath<TRecord>, TContext> = (context: GroupResolverContext<TRecord, TPath, TContext>) => string | null | Promise<string | null>;
interface CompiledGroupDefinition<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown> {
    readonly kind: 'group';
    readonly manifest: GroupManifest<TPath>;
    readonly server: {
        readonly title?: GroupResolver<TRecord, TPath, TContext>;
        readonly description?: GroupResolver<TRecord, TPath, TContext>;
    };
}
interface GroupStateSnapshot {
    readonly order: GroupOrder;
    readonly collapsed: readonly string[];
}
interface GroupedRecords<TRecord> {
    readonly key: string;
    readonly value: JsonValue;
    readonly title: string | null;
    readonly description: string | null;
    readonly collapsed: boolean;
    readonly records: readonly TRecord[];
}
interface SummaryManifest<TPath extends string | null = string | null> {
    readonly id: string;
    readonly kind: SummaryKind;
    readonly mode: SummaryMode;
    readonly path: TPath;
    readonly column: string | null;
    readonly label: string | null;
    readonly properties: JsonObject;
}
interface SummaryResult {
    readonly id: string;
    readonly kind: SummaryKind;
    readonly mode: SummaryMode;
    readonly value: JsonValue;
}
interface SummaryResolverContext<TRecord, TContext> {
    readonly context: TContext;
    readonly mode: SummaryMode;
    readonly records?: readonly TRecord[];
}
type CustomSummaryResolver<TRecord, TContext> = (context: SummaryResolverContext<TRecord, TContext>) => JsonValue | Promise<JsonValue>;
interface CompiledSummaryDefinition<TRecord, TPath extends RecordPath<TRecord> | null = RecordPath<TRecord> | null, TContext = unknown> {
    readonly kind: 'summary';
    readonly manifest: SummaryManifest<TPath>;
    readonly server: {
        readonly custom?: CustomSummaryResolver<TRecord, TContext>;
    };
}
interface SummaryAggregateRequest {
    readonly id: string;
    readonly kind: Exclude<SummaryKind, 'custom'>;
    readonly column: string | null;
}
interface HoloAggregateQuery {
    count(): Promise<number>;
    sum(column: string): Promise<AggregatePrimitive>;
    avg(column: string): Promise<AggregatePrimitive>;
    min(column: string): Promise<AggregatePrimitive>;
    max(column: string): Promise<AggregatePrimitive>;
}
interface SummaryDriverAdapter<TQuery> {
    readonly driver: AggregateDriver;
    execute(query: TQuery, requests: readonly SummaryAggregateRequest[]): Promise<Readonly<Record<string, JsonValue>>>;
}
interface GroupedAggregateRequest {
    readonly groupColumn: string;
    readonly order: GroupOrder;
    readonly summaries: readonly SummaryAggregateRequest[];
}
interface GroupedAggregateRow {
    readonly key: JsonValue;
    readonly values: Readonly<Record<string, JsonValue>>;
}
interface GroupedSummaryDriverAdapter<TQuery> {
    execute(query: TQuery, request: GroupedAggregateRequest): Promise<readonly GroupedAggregateRow[]>;
}

declare class GroupBuilder<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown> {
    #private;
    constructor(id: string, path: TPath, column?: string);
    label(value: string | null): this;
    title(resolver: GroupResolver<TRecord, TPath, TContext>): this;
    description(resolver: GroupResolver<TRecord, TPath, TContext>): this;
    collapsible(value?: boolean): this;
    collapsed(value?: boolean): this;
    order(value: GroupOrder): this;
    persistAs(key: string): this;
    compile(): CompiledGroupDefinition<TRecord, TPath, TContext>;
    private assertMutable;
}
declare class GroupingState {
    #private;
    constructor(manifest: GroupManifest, snapshot?: Partial<GroupStateSnapshot>);
    order(value: GroupOrder): this;
    collapse(key: string): this;
    expand(key: string): this;
    toggle(key: string): this;
    isCollapsed(key: string): boolean;
    snapshot(): GroupStateSnapshot;
    toUrl(): string;
    static fromUrl(manifest: GroupManifest, value: string): GroupingState;
}
declare function groupPageRecords<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown>(records: readonly TRecord[], definition: CompiledGroupDefinition<TRecord, TPath, TContext>, context: TContext, state?: GroupingState): Promise<readonly GroupedRecords<TRecord>[]>;
declare class GroupFactory<TRecord, TContext = unknown> {
    group<TPath extends RecordPath<TRecord>>(id: string, path: TPath, column?: string): GroupBuilder<TRecord, TPath, TContext>;
}
declare function groupingsFor<TRecordSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_record: TRecordSource, _context?: TContextSource): GroupFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>>;

declare class SummaryBuilder<TRecord, TPath extends RecordPath<TRecord> | null, TKind extends SummaryKind, TContext = unknown> {
    #private;
    constructor(id: string, kind: TKind, path: TPath, column: string | null);
    label(value: string | null): this;
    page(): this;
    fullQuery(): this;
    properties(value: JsonObject): this;
    resolveUsing(resolver: CustomSummaryResolver<TRecord, TContext>): this;
    compile(): CompiledSummaryDefinition<TRecord, TPath, TContext>;
    private assertMutable;
}
declare class SummaryFactory<TRecord, TContext = unknown> {
    count(id?: string): SummaryBuilder<TRecord, null, 'count', TContext>;
    sum<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column?: string): SummaryBuilder<TRecord, TPath, 'sum', TContext>;
    average<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column?: string): SummaryBuilder<TRecord, TPath, 'average', TContext>;
    min<TPath extends RecordPathFor<TRecord, Date | number | string>>(id: string, path: TPath, column?: string): SummaryBuilder<TRecord, TPath, 'min', TContext>;
    max<TPath extends RecordPathFor<TRecord, Date | number | string>>(id: string, path: TPath, column?: string): SummaryBuilder<TRecord, TPath, 'max', TContext>;
    range<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column?: string): SummaryBuilder<TRecord, TPath, 'range', TContext>;
    custom(id: string, resolver: CustomSummaryResolver<TRecord, TContext>): SummaryBuilder<TRecord, null, 'custom', TContext>;
}
type SummaryTypeSource<TValue extends object> = RecordTypeSource & ({
    readonly prototype: TValue;
} | {
    create(...parameters: never[]): TValue | Promise<TValue>;
});
declare function summariesFor<TRecordSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_record: TRecordSource, _context?: TContextSource): SummaryFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>>;

interface ExecutableSummary<TRecord, TContext> {
    readonly definition: CompiledSummaryDefinition<TRecord, RecordPath<TRecord> | null, TContext>;
}
declare function asExecutableSummary<TRecord, TPath extends RecordPath<TRecord> | null, TContext>(definition: CompiledSummaryDefinition<TRecord, TPath, TContext>): ExecutableSummary<TRecord, TContext>;
declare function executePageSummaries<TRecord, TContext>(definitions: readonly ExecutableSummary<TRecord, TContext>[], records: readonly TRecord[], context: TContext): Promise<readonly SummaryResult[]>;
declare function executeFullQuerySummaries<TQuery, TRecord, TContext>(definitions: readonly ExecutableSummary<TRecord, TContext>[], scopedQuery: TQuery, adapter: SummaryDriverAdapter<TQuery>, context: TContext): Promise<readonly SummaryResult[]>;
declare function createHoloSummaryAdapter<TQuery extends HoloAggregateQuery>(driver: AggregateDriver): SummaryDriverAdapter<TQuery>;
declare function executeGroupedFullQuery<TQuery, TRecord, TPath extends RecordPath<TRecord>, TContext>(scopedQuery: TQuery, group: CompiledGroupDefinition<TRecord, TPath, TContext>, summaries: readonly ExecutableSummary<TRecord, TContext>[], adapter: GroupedSummaryDriverAdapter<TQuery>, order?: GroupOrder): Promise<readonly GroupedAggregateRow[]>;

declare function normalizeAggregateNumber(value: AggregatePrimitive, driver: AggregateDriver): number | null;

type AtomicValue = bigint | boolean | Date | null | number | string | symbol | undefined;
type PreviousDepth = [never, 0, 1, 2, 3, 4, 5, 6];
type NestedPath<TValue, TDepth extends number> = TDepth extends 0 ? never : TValue extends AtomicValue | ((...parameters: never[]) => unknown) ? never : TValue extends readonly (infer TItem)[] ? `${number}` | `${number}.${NestedPath<TItem, PreviousDepth[TDepth]>}` : TValue extends object ? {
    [TKey in Extract<keyof TValue, string>]: TValue[TKey] extends AtomicValue | ((...parameters: never[]) => unknown) ? TKey : TKey | `${TKey}.${NestedPath<TValue[TKey], PreviousDepth[TDepth]>}`;
}[Extract<keyof TValue, string>] : never;
type FieldPath<TValues extends object> = NestedPath<TValues, 6>;
type FieldPathValue<TValue, TPath extends string> = TPath extends `${infer THead}.${infer TTail}` ? THead extends keyof TValue ? FieldPathValue<TValue[THead], TTail> : TValue extends readonly (infer TItem)[] ? THead extends `${number}` ? FieldPathValue<TItem, TTail> : never : never : TPath extends keyof TValue ? TValue[TPath] : TValue extends readonly (infer TItem)[] ? TPath extends `${number}` ? TItem : never : never;

type ResolverDomain = 'action' | 'column' | 'entry' | 'form' | 'notification' | 'page' | 'panel' | 'widget';
type ClientExpressionOperator = 'and' | 'coalesce' | 'equals' | 'get' | 'not' | 'or';
type ClientExpressionNode = JsonValue | {
    readonly operator: ClientExpressionOperator;
    readonly operands: readonly ClientExpressionNode[];
};
type ClientExpression<TValue extends JsonValue> = {
    readonly kind: 'client-expression';
    readonly expression: ClientExpressionNode;
    readonly valueType?: TValue;
};
type NamedClientResolver<TValue extends JsonValue, TInput extends JsonValue = JsonValue> = {
    readonly kind: 'named-client-resolver';
    readonly name: string;
    readonly input?: TInput;
    readonly valueType?: TValue;
};
type LiteralResolver<TValue extends JsonValue> = {
    readonly kind: 'literal';
    readonly value: TValue;
};
type NullResolver = {
    readonly kind: 'null';
    readonly value: null;
};
type ResolverContextInput<TDomain extends ResolverDomain, TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> = {
    readonly domain: TDomain;
    readonly values: TValues;
    readonly record: TRecord;
    readonly actor: TActor;
    readonly tenant: TTenant;
    readonly services: TServices;
    readonly locale: string;
};
type ResolverContext<TDomain extends ResolverDomain, TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContextInput<TDomain, TValues, TRecord, TActor, TTenant, TServices> & {
    get<TPath extends FieldPath<TValues>>(path: TPath): FieldPathValue<TValues, TPath>;
};
type FormResolverContext<TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'form', TValues, TRecord, TActor, TTenant, TServices>;
type EntryResolverContext<TRecord extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'entry', TRecord, TRecord, TActor, TTenant, TServices>;
type ColumnResolverContext<TRecord extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'column', TRecord, TRecord, TActor, TTenant, TServices>;
type ActionResolverContext<TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'action', TValues, TRecord, TActor, TTenant, TServices>;
type WidgetResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'widget', TState, undefined, TActor, TTenant, TServices>;
type PageResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'page', TState, undefined, TActor, TTenant, TServices>;
type PanelResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'panel', TState, undefined, TActor, TTenant, TServices>;
type NotificationResolverContext<TNotification extends object, TActor = undefined, TTenant = undefined, TServices = undefined> = ResolverContext<'notification', TNotification, undefined, TActor, TTenant, TServices>;
type RawServerCallback<TValue extends JsonValue, TContext> = (context: TContext) => TValue | Promise<TValue>;
type ExplicitServerResolver<TValue extends JsonValue, TContext> = {
    readonly kind: 'server-resolver';
    readonly id: string;
    readonly dependencies: readonly string[];
    readonly resolve: RawServerCallback<TValue, TContext>;
};
type ServerValueResolver<TValue extends JsonValue, TContext> = ExplicitServerResolver<TValue, TContext> | RawServerCallback<TValue, TContext>;
type Resolvable<TValue extends JsonValue, TContext> = ClientExpression<TValue> | ExplicitServerResolver<TValue, TContext> | LiteralResolver<TValue> | NamedClientResolver<TValue> | NullResolver | RawServerCallback<TValue, TContext> | TranslationReference | TValue | null;
type ResolverComponentError = {
    readonly code: 'resolver_failed';
    readonly message: string;
    readonly resolverId?: string;
    readonly target: string;
};
type ServerResolverPatch = {
    readonly target: string;
    readonly dependencies: readonly string[];
    readonly value?: JsonValue;
    readonly error?: ResolverComponentError;
};
type ServerResolverBatchResult = {
    readonly scope: string;
    readonly version: number;
    readonly stale: boolean;
    readonly patches: readonly ServerResolverPatch[];
};
type ServerResolverBatchOptions = {
    readonly scope: string;
    readonly version: number;
    readonly requests: readonly ServerResolverRequest[];
    readonly environment?: 'development' | 'production';
};
type ServerResolverRequest = {
    readonly target: string;
    readonly resolverId?: string;
    readonly explicitDependencies: readonly string[];
    run(observe: (path: string) => void): Promise<JsonValue>;
};

declare function literal<TValue extends JsonValue>(value: TValue): LiteralResolver<TValue>;
declare function nullResolver(): NullResolver;
declare function clientExpression<TValueSource extends RuntimeTypeSource>(_value: TValueSource, expression: ClientExpressionNode): ClientExpression<RuntimeTypeValue<TValueSource> & JsonValue>;
declare function clientResolver<TValueSource extends RuntimeTypeSource, TInput extends JsonValue = JsonValue>(_value: TValueSource, name: string, input?: TInput): NamedClientResolver<RuntimeTypeValue<TValueSource> & JsonValue, TInput>;
declare function serverResolver<TValue extends JsonValue, TContextSource extends RuntimeTypeSource>(id: string, context: TContextSource, resolve: RawServerCallback<TValue, RuntimeTypeValue<TContextSource>>, dependencies?: readonly string[]): ExplicitServerResolver<TValue, RuntimeTypeValue<TContextSource>>;
declare function serverResolver<TValue extends JsonValue>(id: string, resolve: RawServerCallback<TValue, unknown>, dependencies?: readonly string[]): ExplicitServerResolver<TValue, unknown>;
declare function formResolverContextFor<TValuesSource extends RecordTypeSource>(_values: TValuesSource): {
    readonly prototype: ResolverContext<'form', RecordTypeValue<TValuesSource>>;
};

declare class ResolverDependencyCycleError extends Error {
    readonly dependencyPath: readonly string[];
    constructor(dependencyPath: readonly string[]);
}
declare class ServerResolverBatcher {
    #private;
    resolve(options: ServerResolverBatchOptions): Promise<ServerResolverBatchResult>;
}

declare const EN_MESSAGES: Readonly<{
    readonly 'actions.cancel': "Cancel";
    readonly 'actions.confirm': "Confirm";
    readonly 'actions.create': "Create";
    readonly 'actions.delete': "Delete";
    readonly 'actions.edit': "Edit";
    readonly 'actions.save': "Save";
    readonly 'actions.view': "View";
    readonly 'navigation.open': "Open navigation";
    readonly 'navigation.close': "Close navigation";
    readonly 'pagination.next': "Next";
    readonly 'pagination.previous': "Previous";
    readonly 'pagination.summary': "Showing {from} to {to} of {total}";
    readonly 'records.selected': Readonly<{
        one: "{count} record selected";
        other: "{count} records selected";
    }>;
    readonly 'states.empty': "No records found";
    readonly 'states.loading': "Loading";
}>;
declare const enCatalog: TranslationCatalog<Readonly<{
    readonly 'actions.cancel': "Cancel";
    readonly 'actions.confirm': "Confirm";
    readonly 'actions.create': "Create";
    readonly 'actions.delete': "Delete";
    readonly 'actions.edit': "Edit";
    readonly 'actions.save': "Save";
    readonly 'actions.view': "View";
    readonly 'navigation.open': "Open navigation";
    readonly 'navigation.close': "Close navigation";
    readonly 'pagination.next': "Next";
    readonly 'pagination.previous': "Previous";
    readonly 'pagination.summary': "Showing {from} to {to} of {total}";
    readonly 'records.selected': Readonly<{
        one: "{count} record selected";
        other: "{count} records selected";
    }>;
    readonly 'states.empty': "No records found";
    readonly 'states.loading': "Loading";
}>>;

declare const arCatalog: TranslationCatalog<Readonly<{
    readonly 'actions.cancel': "إلغاء";
    readonly 'actions.confirm': "تأكيد";
    readonly 'actions.create': "إنشاء";
    readonly 'actions.delete': "حذف";
    readonly 'actions.edit': "تعديل";
    readonly 'actions.save': "حفظ";
    readonly 'actions.view': "عرض";
    readonly 'navigation.open': "فتح التنقل";
    readonly 'navigation.close': "إغلاق التنقل";
    readonly 'pagination.next': "التالي";
    readonly 'pagination.previous': "السابق";
    readonly 'pagination.summary': "عرض {from} إلى {to} من {total}";
    readonly 'records.selected': Readonly<{
        zero: "لم يتم تحديد أي سجلات";
        one: "تم تحديد سجل واحد";
        two: "تم تحديد سجلين";
        few: "تم تحديد {count} سجلات";
        many: "تم تحديد {count} سجلًا";
        other: "تم تحديد {count} سجل";
    }>;
    readonly 'states.empty': "لا توجد سجلات";
    readonly 'states.loading': "جارٍ التحميل";
}>>;

type KnownTranslations = typeof EN_MESSAGES & RegisteredTranslations;
type TranslationKey = Exclude<Extract<keyof KnownTranslations, string>, '__registeredTranslationsBrand'>;
type KnownTranslationMessage<TKey extends TranslationKey> = KnownTranslations[TKey] extends TranslationMessage ? KnownTranslations[TKey] : never;
declare function trans<TKey extends TranslationKey>(key: TKey, ...args: TranslationArguments<KnownTranslationMessage<TKey>>): TranslationReference<TKey>;

export { ActionBuilder, ActionContext, ActionDefinition, ActionEngine, ActionEngineOptions, ActionExecutionError, ActionExecutionRequest, ActionExecutionResult, ActionFailureNotification, ActionGroupBuilder, ActionGroupItem, ActionGroupManifest, ActionKind, ActionManifest, ActionModalOptions, ActionMount, type ActionPersistence, ActionPresentationContext, ActionRateLimit, ActionRegistration, ActionResolvable, ActionResolvedState, type ActionResolverContext, ActionSize, ActionSuccessNotification, AdvancedColumnFactory, AdvancedColumnMap, type AdvancedColumnRecordSource, AdvancedFilterColumn, AdvancedFilterCondition, AdvancedFilterValue, AdvancedOperatorFor, AdvancedQueryFilter, AdvancedScalarType, type AggregateDriver, type AggregatePrimitive, BasicFieldFactory, type BasicFormSchema, type BasicFormValues, BooleanColumn, BooleanEntry, BooleanFilter, BoundFormField, type BoundPanelTenantContext, type BuilderBlockDefinition, type BuilderBlockMap, type BuilderBlockValidationIssue, type BuilderBlockValue, BuilderFieldBuilder, type BuiltinActionOptions, CalloutBuilder, type CapabilityHost, ChartWidgetData, CheckboxColumn, CheckboxFieldBuilder, ChoiceFieldBuilder, ChoiceFieldFactory, type ChoiceFieldType, ChoiceOption, type ClientExpression, type ClientExpressionNode, type ClientExpressionOperator, CodeEntry, CodeFieldBuilder, CollectionFieldFactory, type CollectionFieldProperties, type CollectionValue, ColorColumn, ColorEntry, ColorFieldBuilder, ColumnAggregate, ColumnAlignment, ColumnBuilder, ColumnDataSource, type ColumnFactory, type ColumnRecordSource, ColumnResolver, type ColumnResolverContext, type CompiledChoiceFieldDefinition, CompiledColumnDefinition, CompiledDashboardDefinition, type CompiledEntryDefinition, CompiledFieldDefinition, CompiledFilterDefinition, type CompiledGroupDefinition, CompiledNestedResource, CompiledPageDefinition, CompiledPanelDefinition, CompiledPanelTenancy, CompiledSchema, CompiledSchemaComponent, type CompiledSummaryDefinition, CompiledWidgetDefinition, ComponentDefault, type ComponentDefaultLayers, ConstructionBuilder, ContainerComponentBuilder, ContextTypeSources, CustomColumn, CustomComponentBuilder, CustomComponentProperties, type CustomEntryDefinition, CustomFieldBuilder, type CustomFieldDefinition, type CustomFilterOptions, CustomOptionSource, type CustomOptionSourceHandlers, CustomSchemaFilter, type CustomSummaryResolver, CustomWidgetData, DashboardBuilder, DashboardContext, DashboardNavigation, DateFieldBuilder, type DatePickerMode, DateRangeFilter, DateRangeFilterValue, type DeepReadonly, type DefaultPanelActor, type DefaultPanelServices, type DefaultPanelTenant, DefaultableComponentKind, DiscoverableBuilder, DiscoverableDefinition, DiscoverableKind, DiscoveryDirectories, EN_MESSAGES, Effect, EmptyStateBuilder, EntryBuilder, type EntryFactory, type EntryFormat, type EntryManifest, type EntryRecordPath, type EntryRecordPathValue, type EntryRecordSource, type EntryRelatedRecord, type EntryRelationPath, type EntryRendererProps, type EntryRendererRegistration, type EntryRendererRegistryContract, type EntryResolver, type EntryResolverContext, EntrySchemaComponentBuilder, type EntrySchemaSource, type EntryServerHandles, type EntryStateSource, type ExplicitServerResolver, ExtensionFilterBuilder, ExtensionFilterFactory, type ExtensionFilterOptions, ExtensionTypeId, FieldBuilder, FieldClientHints, type FieldPath, type FieldPathValue, FieldPresentationState, FieldResolvable, FieldResolver, FieldResolverContext, FieldsetBuilder, FilterBuilder, FilterCollection, FilterCollectionPlacement, FilterCollectionPresentation, FilterEncoder, FilterExecutionContext, FilterFactory, FilterIndicator, FilterIndicatorResolver, FilterManifest, FilterResponsiveColumns, FilterSchemaComponentBuilder, type FilterSchemaSource, FilterServerHandles, type FilterTypeSource, FormFieldPath, FormFieldPathFor, FormFieldValue, type FormResolverContext, FormSchemaBinding, GridBuilder, GroupBuilder$1 as GroupBuilder, type GroupManifest, type GroupOrder, type GroupResolver, type GroupResolverContext, type GroupStateSnapshot, type GroupedAggregateRequest, type GroupedAggregateRow, type GroupedRecords, type GroupedSummaryDriverAdapter, GroupingState, HiddenFieldBuilder, type HoloAggregateQuery, HoloOptionQuery, HoloTableQuery, IconColumn, IconEntry, ImageColumn, ImageEntry, type InferredResourceBuilder, type EntryResolverContext$1 as InfolistEntryResolverContext, type InlineEditActionExecutor, type InlineEditActionInput, type InlineEditRequest, type InlineEditableColumnManifest, InlineEditorManifest, JsonObject, JsonPrimitive, JsonValue, type KeyValueEntry$1 as KeyValueEntry, KeyValueFieldBuilder, KeyValueEntry as KeyValueInfolistEntry, LabelCapability, type LabelState, type LiteralResolver, MarkdownFieldBuilder, type NamedClientResolver, NestedResourceOptions, NormalizedRelationListRequest, type NotificationResolverContext, type NullResolver, OptionPage, OptionQueryRequest, type OptionResolver, OptionService, OptionServiceLimits, OptionSource, OptionValue, OptionalRuntimeTypeValue, P7AFilterCompatibility, PageBreadcrumb, PageBuilder, PageComponentBody, PageContext, PageNavigation, PageNavigationInput, PageRendererManifest, PageResolvable, type PageResolverContext, PageServerHandles, PageType, type PageTypeSources, PanelAccessContext, PanelActorPresenter, type PanelActorSource, PanelAsset, PanelAuthPageConfiguration, PanelAuthenticatedScope, PanelBootContext, PanelBranding, PanelBuilder, PanelComponentConfiguration, PanelContentWidth, PanelDatabaseNotificationConfiguration, PanelDatabaseNotificationInboxOptions, PanelEmailVerificationPageConfiguration, PanelLoginPageConfiguration, PanelMiddleware, PanelModelTenancyOptions, PanelMultiFactorPageConfiguration, PanelNavigationGroup, PanelNavigationMode, PanelNavigationSeed, PanelNotificationScope, PanelNotificationStore, PanelPasswordResetPageConfiguration, PanelPlugin, PanelPluginInstallation, PanelRegisteredDefinition, type PanelResolverContext, PanelRouteMethod, PanelRouteRegistrar, PanelRouteScope, PanelSubNavigationPosition, PanelTenancyOptions, PanelTenantBillingProvider, PanelTenantExecutionContext, PanelTenantIdentifier, PanelTenantMenuItem, PanelTheme, PanelTokenTheme, PanelUserMenuItem, PluginCompatibility, RadioFieldBuilder, type RadioOption, type RawServerCallback, RecordPath, RecordPathFor, RecordPathValue, RecordTypeSource, RecordTypeValue, RegisteredAction, RegisteredTranslations, RelatedRecord, RelationInputError, RelationListPaginationError, RelationListRequest, type RelationManagerAuthorization, RelationManagerBuilder, type RelationManagerBuilderOptions, type RelationManagerContext, type RelationManagerDefinition, RelationManagerExecutor, type RelationManagerTransaction, RelationOperation, RelationOperationNotAllowedError, type RelationOptionPage, RelationPath, type RelationPersistence, RelationPivotInputError, RelationPresentation, RelationRecordNotFoundError, RelationRecordPage, type RelationValidation, RelationshipOptionAdapter, RelationshipOptionQueryModifier, RelationshipOptionSource, RelationshipSelectFilter, RenderHook, RenderSlotReference, RepeatableEntry, RepeaterFieldBuilder, type Resolvable, type ResolverComponentError, type ResolverContext, type ResolverContextInput, ResolverDependencyCycleError, type ResolverDomain, ResolverOptionSource, type ResourceActionComposer, ResourceAttribute, ResourceAttributes, ResourceBuilder, ResourceCompositionTypes, type ResourceContextTypeSources, ResourceDefinition, ResourceExecutionContext, ResourceGlobalSearch, ResourceInput, ResourceLifecycle, ResourceModel, ResourceModelDefinition, ResourceNavigation, ResourceParentReference, ResourcePersistence, ResourceQuery, ResourceRecord, ResourceRecordFor, ResourceValidation, ResourceWidgetContext, type ResourceWidgetTypeSources, ResponsiveValue, RichEditorFieldBuilder, type RichTextDocument, type RichTextMark, type RichTextMarkType, type RichTextNode, type RichTextNodeType, type RichTextSanitizer, RuntimeTypeSource, RuntimeTypeValue, SchemaBreakpoint, SchemaBuilder, SchemaCollapseProperties, SchemaColumnSpan, SchemaComponentBuilder, type SchemaComponentFactory, SchemaComponentKind, SchemaComponentProperties, SchemaLayoutProperties, SchemaPath, SchemaRenderSlots, type SchemaTypeSource, SchemaVisibilityResolver, type SchemaWidgetContext, ScopedRenderSlots, SectionBuilder, SelectColumn, type SelectColumnOption, SelectFilter, SelectFilterOption, type SelectedOptionResolver, type ServerResolverBatchOptions, type ServerResolverBatchResult, ServerResolverBatcher, type ServerResolverPatch, type ServerResolverRequest, type ServerValueResolver, SingularResourceOptions, SliderFieldBuilder, SlugFieldBuilder, type SlugLocalTransform, SplitBuilder, StaticOptionSource, StatsWidgetData, StepBuilder, type SubmittedBuilderBlock, type SummaryAggregateRequest, SummaryBuilder, type SummaryDriverAdapter, SummaryFactory, type SummaryKind, type SummaryManifest, type SummaryMode, type SummaryResolverContext, type SummaryResult, type SummaryTypeSource, TabBuilder, TableFilterOperator, type TableFilterSnapshot, TableFilterState, GroupBuilder as TableGroupBuilder, GroupFactory as TableGroupFactory, TableQueryDefinition, TableQueryExecutor, TableQueryFilter, TableQueryFilterDefinition, TableQueryResult, TableQueryState, TableRecordIdentifier, TableSelection, TableWidgetData, TabsBuilder, TagsFieldBuilder, TernaryFilter, TernaryFilterValue, TextColumn, TextEntry, TextFieldBuilder, TextFormatter, TextInputColumn, type TextInputMode, TextareaFieldBuilder, ToggleColumn, ToggleFieldBuilder, TranslationArguments, TranslationCatalog, type TranslationKey, TranslationMessage, TranslationReference, TrashedFilter, TrashedFilterValue, UploadFieldBuilder, UploadFieldFactory, UploadMimeInspector, UploadPolicy, VisibilityCapability, type VisibilityState, WidgetBuilder, WidgetColumnSpan, WidgetContext, WidgetDataContext, WidgetFamily, WidgetFilterDefinition, WidgetManifest, type WidgetResolverContext, WidgetResourcePlacement, WidgetSchemaComponentBuilder, type WidgetSchemaSource, WidgetServerHandles, WizardBuilder, actionGroup, actionsFor, advancedColumnsFor, advancedFilterValue, advancedQueryFilter, allowedRelationOperations, arCatalog, asExecutableSummary, asFilterDefinition, assignStableId, assignStableKey, bindFormSchema, bindPanelTenantContext, callout, choiceFields, clientExpression, clientResolver, collectionFields, columnsFor, compileActionManifest, copyableEntryText, createHoloSummaryAdapter, createNavigationSeed, createResourceActionComposer, createResourceWidgetContext, customComponent, customField, defaultSlugTransform, defaultUploadMimeInspector, defineAction, defineChartWidget, defineCreatePage, defineCustomPage, defineCustomWidget, defineDashboard, defineEditPage, defineEntry, defineListPage, definePage, definePanel, defineRelatedRecordPage, defineResource, defineResourceChartWidget, defineResourceCustomWidget, defineResourceStatsWidget, defineResourceTableWidget, defineSchema, defineSingularPage, defineStatsWidget, defineTableWidget, defineUploadPolicy, defineViewPage, dehydrateFieldValue, deriveFieldClientHints, deriveSchemaDefault, deserializeRichText, emptyState, enCatalog, entriesFor, entryValueAt, executeFullQuerySummaries, executeGroupedFullQuery, executeInlineColumnEdit, executePageSummaries, extensionFiltersFor, fields, fieldset, filterCollection, filtersFor, formResolverContextFor, formatEntryState, formatTextValue, grid, group, groupPageRecords, groupingsFor, holoNotificationStore, hydrateFieldValue, isClusterDefinition, isDiscoverableBuilder, isDiscoverableDefinition, isDiscoverableKind, isExportDefinition, isImportDefinition, isPageDefinition, isPanelDefinition, isPluginDefinition, isRelationManagerDefinition, isResourceDefinition, isWidgetDefinition, literal, markDiscoverableDefinition, normalizeAggregateNumber, nullResolver, panelTenantNotificationScope, relationManagersFor, relationSupportsOperation, resolveActionState, resolveEntrySource, resolveFieldDefault, resolveFieldPresentationState, resolvePanelNavigationSeed, schemaComponentsFor, schemaEntry, schemaFilter, schemaWidget, section, selectDefaultDashboard, serializeMarkdown, serializeRichText, serverResolver, split, step, structuralRichTextSanitizer, summariesFor, tab, tabs, trans, uploadExtension, uploadFields, validateBuilderBlocks, widgetContext, withComponentDefaults, wizard };
