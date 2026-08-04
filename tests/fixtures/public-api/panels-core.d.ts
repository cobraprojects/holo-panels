import { F as FieldClientHints, a as FormFieldPath, b as FormFieldValue, B as BoundFormField, c as FieldResolvable, d as FieldResolver, C as CompiledFieldDefinition, e as FieldResolverContext, f as FieldPresentationState, R as RecordPath, g as RelationPath, h as RelatedRecord, i as RecordPathValue, j as FilterIndicatorResolver, k as CompiledFilterDefinition, l as FilterServerHandles, m as FilterEncoder, n as FilterManifest, o as FormFieldPathFor, O as OptionValue, p as ChoiceOption, q as OptionSource, r as OptionQueryRequest, s as OptionPage, t as OptionServiceLimits, H as HoloOptionQuery, u as RelationshipOptionAdapter, v as RelationshipOptionQueryModifier, U as UploadMimeInspector, w as UploadPolicy, T as TemporaryUploadServiceOptions, x as CreateTemporaryUploadInput, y as TemporaryUploadDescriptor, W as WriteTemporaryUploadInput, S as StoredUploadDescriptor, z as ResolveTemporaryUploadInput, D as DeleteTemporaryUploadInput, M as MediaAttachmentTarget, A as MediaAttachmentResult, E as UploadEndpointRequest, G as UploadEndpointResponse, I as UploadStorageAdapter, J as ActionDefinition, K as ActionContext, L as ActionResolvedState, N as ActionManifest, P as ActionMount, Q as ActionKind, V as ActionEngineOptions, X as ActionExecutionRequest, Y as ActionExecutionResult, Z as Effect, _ as ActionGroupItem, $ as ActionGroupManifest, a0 as RelationOperation, a1 as NormalizedRelationListRequest, a2 as RelationRecordPage, a3 as RelationPresentation, a4 as RelationListRequest, a5 as RecordPathFor, a6 as ColumnResolver, a7 as ColumnAlignment, a8 as ColumnDataSource, a9 as TextFormatter, aa as InlineEditorManifest, ab as CompiledColumnDefinition, ac as ColumnAggregate, ad as AdvancedOperatorFor, ae as AdvancedScalarType, af as AdvancedFilterColumn, ag as AdvancedColumnMap, ah as AdvancedFilterValue, ai as AdvancedFilterCondition, aj as DateRangeFilterValue, ak as SelectFilterOption, al as FilterExecutionContext, am as TernaryFilterValue, an as TrashedFilterValue, ao as FilterResponsiveColumns, ap as FilterCollectionPlacement, aq as FilterCollectionPresentation, ar as FilterIndicator, as as P7AFilterCompatibility, at as TranslationReference, au as TranslationCatalog, av as RegisteredTranslations, aw as TranslationArguments, ax as TranslationMessage } from './browser-D5Nbg1CR.js';
export { ay as ActionFailureNotification, az as ActionItemResult, aA as ActionItemStatus, aB as ActionModalManifest, aC as ActionModalOptions, aD as ActionModalWidth, aE as ActionNotificationSender, aF as ActionPresentationDefinition, aG as ActionPresentationManifest, aH as ActionRateLimit, aI as ActionRecordResolver, aJ as ActionResolvable, aK as ActionSize, aL as ActionSuccessNotification, aM as ActionTransaction, aN as AnyAdvancedFilterColumn, aO as CloseModalEffect, aP as ColumnManifest, aQ as ColumnServerHandles, aR as DownloadEffect, aS as ErrorCategory, aT as ErrorEnvelope, aU as FieldLayout, aV as FieldOperation, aW as FieldStateCodec, aX as FilterLayout, aY as FilterMode, aZ as FocusEffect, a_ as FormValues, a$ as HoloOptionPage, b0 as IDEMPOTENCY_HEADER, b1 as InlineEditorKind, b2 as InvalidateTableEffect, b3 as LocaleDirection, b4 as ManifestSerializationError, b5 as MediaAttachmentBuilder, b6 as OptionDependencies, b7 as PROTOCOL_VERSION, b8 as PanelNotification, b9 as PanelNotificationAccessError, ba as PanelNotificationInbox, bb as PanelsError, bc as PanelsTransportError, bd as PluralCategory, be as PluralTranslation, bf as ProtocolCompatibilityError, bg as ProtocolVersion, bh as RedirectEffect, bi as RefreshEffect, bj as RelationshipOptionContext, bk as RequestEnvelope, bl as ResponseEnvelope, bm as SchemaTraversalContext, bn as SuccessEnvelope, bo as SupportedFilterOperator, bp as TRANSLATION_REFERENCE_KIND, bq as TRANSPORT_REQUEST_FIELD, br as TableWidgetExecutor, bs as ToastEffect, bt as TranslationCatalogRegistry, bu as TranslationCatalogSet, bv as TranslationCatalogSource, bw as TranslationLookup, bx as TranslationReplacementMap, by as TranslationReplacementNames, bz as TranslationReplacementValue, bA as TranslationReplacements, bB as TransportDecodedRequest, bC as TransportDecodingError, bD as TransportOperation, bE as TransportOperationKind, bF as TransportRequestOptions, bG as TransportServerRequestLike, bH as TransportServerResult, bI as UploadActorContext, bJ as UploadAuthorizationRequest, bK as UploadAuthorizer, bL as UploadEndpointBody, bM as UploadOperation, bN as UploadStorageListPage, bO as UploadStorageListRequest, bP as WidgetAccessError, bQ as applySchemaManifestPatches, bR as applySchemaNodePatches, bS as assertJsonSafe, bT as assertProtocolCompatible, bU as assertUntranslatedStableKey, bV as canonicalLocale, bW as createAccessibleChartModel, bX as createRequestEnvelope, bY as createTranslationReference, bZ as databaseNotificationPayload, b_ as decodeRequestEnvelope, b$ as decodeResponseEnvelope, c0 as decodeTransportServerRequest, c1 as defineTranslationCatalog, c2 as defineTransportOperation, c3 as evaluateSchemaVisibility, c4 as findSchemaComponent, c5 as isPanelDatabaseNotificationPayload, c6 as isProtocolCompatible, c7 as isTranslationReference, c8 as normalizeTransportError, c9 as panelNotification, ca as parseProtocolVersion, cb as patchSchemaManifestNode, cc as patchSchemaNode, cd as renderAccessibleChart, ce as requireResolvedWidget, cf as resolveTableWidgetData, cg as resolveWidget, ch as serializeManifest, ci as toJsonValue, cj as traverseSchema, ck as traverseSchemaManifest } from './browser-D5Nbg1CR.js';
import { S as SchemaComponentKind, a as SchemaVisibilityResolver, R as ResponsiveValue, b as SchemaColumnSpan, C as CompiledSchemaComponent, c as SchemaComponentProperties, d as SchemaLayoutProperties, e as CustomComponentProperties, f as SchemaCollapseProperties, g as SchemaPath, h as CompiledSchema, i as SchemaBreakpoint, j as SchemaRenderSlots, W as WidgetServerHandles, k as WidgetColumnSpan, l as WidgetFilterDefinition, m as CompiledWidgetDefinition, n as WidgetFamily, o as WidgetDataContext, p as ChartWidgetData, E as ExtensionTypeId, q as CustomWidgetData, r as StatsWidgetData, T as TableWidgetData, s as WidgetContext, t as WidgetManifest, P as PluginCompatibility, u as PanelNotificationStore, D as DashboardContext, v as DashboardNavigation, w as CompiledDashboardDefinition, x as WidgetResourcePlacement, y as ResourceWidgetContext, z as PanelNotificationScope } from './contracts-WEhwEL_y.js';
export { A as AccessibleChartModel, B as AccessibleChartRenderer, F as AccessibleChartRow, G as ActionNode, H as ActionProperties, I as ChartPoint, J as ChartSeries, K as ClientRegistryReference, L as ColumnNode, M as ColumnProperties, N as CompiledNode, O as DashboardManifest, Q as DuplicateRegistrationError, U as EntryNode, V as EntryProperties, X as ExportNode, Y as ExportProperties, Z as ExtensionRegistration, _ as ExtensionRegistry, $ as FieldNode, a0 as FieldProperties, a1 as FilterNode, a2 as FilterProperties, a3 as ImportNode, a4 as ImportProperties, a5 as LayoutNode, a6 as LayoutProperties, a7 as MissingRendererError, a8 as NavigationNode, a9 as NavigationProperties, aa as NodeKind, ab as NotificationNode, ac as NotificationProperties, ad as PageNode, ae as PageProperties, af as PanelDatabaseNotificationItem, ag as PanelDatabaseNotificationPage, ah as PanelDatabaseNotificationPayload, ai as PanelNode, aj as PanelNotificationAction, ak as PanelNotificationActionKind, al as PanelNotificationAuthorization, am as PanelNotificationOperation, an as PanelNotificationPresentation, ao as PanelNotificationRecipient, ap as PanelNotificationRecipientResolver, aq as PanelNotificationRecord, ar as PanelNotificationStatus, as as PanelNotificationStorePage, at as PanelNotificationStorePagination, au as PanelNotificationStoreQuery, av as PanelProperties, aw as PluginCompatibilityError, ax as PublicNode, ay as PublicSourceLocation, az as RegistryKind, aA as ResolvedWidget, aB as ResourceNode, aC as ResourceProperties, aD as SCHEMA_BREAKPOINTS, aE as SchemaComponentManifest, aF as SchemaComponentPatch, aG as SchemaJsonValue, aH as SchemaLeafKind, aI as SchemaLeafManifest, aJ as SchemaManifest, aK as SchemaNode, aL as SchemaProperties, aM as SchemaValueAtPath, aN as ServerHandles, aO as SourceLocation, aP as SummaryNode, aQ as SummaryProperties, aR as TableNode, aS as TableProperties, aT as TargetedSchemaPatch, aU as VersionRange, aV as WidgetFilterState, aW as WidgetLayout, aX as WidgetNode, aY as WidgetPolling, aZ as WidgetProperties, a_ as WidgetStat, a$ as assertPluginCompatible, b0 as createExtensionTypeId, b1 as createSourceLocation, b2 as exposeSourceLocation, b3 as rendererRegistryName } from './contracts-WEhwEL_y.js';
import { C as ComponentDefault, D as DefaultableComponentKind, P as PageServerHandles, a as PageComponentBody, b as PageResolvable, c as PageContext, d as PageBreadcrumb, e as PageNavigation, f as PageRendererManifest, g as PageLayoutSlot, h as CompiledPageDefinition, i as PageType, j as PageNavigationInput, k as PanelNavigationSeed, l as PanelAccessContext, m as PanelActorPresenter, n as CompiledPanelAuth, o as PanelBranding, p as PanelDatabaseNotificationConfiguration, q as PanelDatabaseNotificationInboxOptions, r as PanelNavigationMode, s as PanelPlugin, t as PanelTheme, u as CompiledPanelTenancy, v as PanelUserMenuItem, w as CompiledPanelDefinition, x as PanelAuthPageConfiguration, y as PanelTenantIdentifier, z as PanelTenancyOptions, A as PanelPluginInstallation, B as PanelAuthenticatedScope, E as PanelTenantExecutionContext } from './server-mwynKWAM.js';
export { F as ExecutePanelAuthOperationOptions, G as ExecutePanelDatabaseNotificationOperationOptions, H as ExecutePanelTenantOperationOptions, I as ExecutePanelTenantSwitchOptions, J as HoloAuth, K as HoloAuthGuard, L as PageAccessError, M as PageManifest, N as PanelActiveTenantPersistence, O as PanelAssetKind, Q as PanelAssetManifest, R as PanelAuthContext, S as PanelAuthOperation, T as PanelAuthOperationOutcome, U as PanelAuthorizationLayer, V as PanelAuthorizationRequest, W as PanelBootstrap, X as PanelDarkMode, Y as PanelDatabaseNotificationIdentity, Z as PanelDatabaseNotificationOperationResult, _ as PanelDatabaseNotificationPlacement, $ as PanelEmailVerificationPageConfiguration, a0 as PanelGeneratorTemplate, a1 as PanelIconDefinition, a2 as PanelIconPath, a3 as PanelLoginPageConfiguration, a4 as PanelLogoutPageConfiguration, a5 as PanelManifest, a6 as PanelMultiFactorPageConfiguration, a7 as PanelNotificationBootstrap, a8 as PanelNotificationRequestError, a9 as PanelOperation, aa as PanelPackageModuleContribution, ab as PanelPasswordResetPageConfiguration, ac as PanelPermissionSubject, ad as PanelPluginAsset, ae as PanelPluginBuilder, af as PanelPluginContribution, ag as PanelPluginContributionDefinition, ah as PanelPluginIcon, ai as PanelProfilePageConfiguration, aj as PanelQueuedTenantContext, ak as PanelRendererFramework, al as PanelRendererRegistration, am as PanelRuntime, an as PanelRuntimeError, ao as PanelTenancyManifest, ap as PanelTenantBootstrap, aq as PanelTenantIdentity, ar as PanelTenantOperation, as as PanelTenantOperationError, at as PanelTenantOperationFailure, au as PanelTenantOperationResult, av as PanelTenantPresentation, aw as PanelTenantPresentationInput, ax as PanelTenantScopedQuery, ay as PanelTenantSwitchResult, az as PanelTranslationContribution, aA as PanelsConfiguration, aB as ResolvedPageData, aC as ResourceExecutor, aD as ResourceExecutorOptions, aE as ResourceInputError, aF as ResourceMutationResult, aG as ResourceNestedExecution, aH as ResourceRecordNotFoundError, aI as componentDefault, aJ as definePanelPlugin, aK as definePanelsConfig, aL as executePanelAuthOperation, aM as executePanelDatabaseNotificationOperation, aN as executePanelTenantOperation, aO as executePanelTenantSwitch, aP as panelAuthOperationStatus, aQ as panelTenantOperationStatus, aR as preparePageRoutes, aS as resolvePageData, aT as toSchemaManifest } from './server-mwynKWAM.js';
import { D as DiscoverableDefinition, a as DiscoverableBuilder, b as DiscoverableKind, c as DiscoveryDirectories } from './contracts-BXaz6MmY.js';
export { C as ClientManifestValue, d as CompiledNestedResource, e as DISCOVERABLE_KINDS, f as DISCOVERY_MARKER, N as NestedResourceOptions, R as ResourceAttribute, g as ResourceAttributes, h as ResourceAuthorization, i as ResourceCapabilities, j as ResourceClientManifest, k as ResourceDefinition, l as ResourceExecutionContext, m as ResourceGlobalSearch, n as ResourceIdentifier, o as ResourceInput, p as ResourceLifecycle, q as ResourceModel, r as ResourceModelDefinition, s as ResourceNavigation, t as ResourceOperation, u as ResourceParentReference, v as ResourceParentRegistry, w as ResourcePersistence, x as ResourceQuery, y as ResourceRecord, z as ResourceRecordFor, A as ResourceTransaction, B as ResourceValidation, S as SingularResourceOptions } from './contracts-BXaz6MmY.js';
export { C as CompiledExportColumn, a as CompiledExportFormat, b as CompiledImportColumn, c as CompiledImportFormat, d as CsvExportOptions, e as CsvImportLimits, f as CsvImportOptions, E as ExecuteTransferExportRequest, g as ExportAggregateKind, h as ExportAggregatePlan, i as ExportCell, j as ExportColumnBatchContext, k as ExportColumnBatchValueContext, l as ExportColumnBuilder, m as ExportColumnManifest, n as ExportColumnOption, o as ExportEngineError, p as ExportEngineErrorCode, q as ExportFormatAdapter, r as ExportFormatArtifact, s as ExportFormatInput, t as ExportPathValue, u as ExportQueryAdapter, v as ExportRecordPath, w as ExportRelationPath, x as ExporterBuilder, y as ExporterDefinition, z as ExporterManifest, A as ExporterServerDefinition, F as FinalizeTransferExportPartsOptions, H as HoloTransferCompletionNotifier, B as HoloTransferNotificationDefinitions, D as HoloTransferStorageOptions, G as HoloTransferStoreOptions, I as ImportColumnBuilder, J as ImportColumnManifest, K as ImportFormatAdapter, L as ImportFormatInspection, M as ImportLimits, N as ImportMutationAdapter, O as ImportMutationDecision, P as ImportRowExecutionContext, Q as ImporterBuilder, R as ImporterDefinition, S as ImporterManifest, T as ImporterServerDefinition, U as InferredResourceBuilder, V as PersistTransferExportPartOptions, W as ResourceBuilder, X as ResourceContextTypeSources, Y as StartExportRequest, Z as StartImportRequest, _ as TransferArtifactDigest, $ as TransferArtifactWriter, a0 as TransferCompletionNotifier, a1 as TransferExecutionContext, a2 as TransferExecutionInput, a3 as TransferExportChunk, a4 as TransferExportExecutionInput, a5 as TransferExportResult, a6 as TransferFailureRows, a7 as TransferIdentity, a8 as TransferIdentityValue, a9 as TransferImportExecutionInput, aa as TransferInputSource, ab as TransferNextChunk, ac as TransferOperationIdentity, ad as TransferOperationKind, ae as TransferOperationProgress, af as TransferOperationRecord, ag as TransferOperationRequest, ah as TransferOperationStatus, ai as TransferOperationStore, aj as TransferOutboxDispatchResult, ak as TransferOutboxDispatcher, al as TransferOutboxDispatcherOptions, am as TransferOutboxEvent, an as TransferOutboxFailure, ao as TransferOutboxLease, ap as TransferOutboxRecord, aq as TransferPartsError, ar as TransferPartsErrorCode, as as TransferPolicy, at as TransferProgressTransition, au as TransferQueueAdapter, av as TransferQueueConfiguration, aw as TransferQueueEnvelope, ax as TransferResultPart, ay as TransferRetentionConfiguration, az as TransferSanitizedError, aA as TransferSnapshotError, aB as TransferStorageAdapter, aC as TransferStorageConfiguration, aD as TransferStorageError, aE as TransferStoredArtifact, aF as TransferUploadResolver, aG as WriteTransferResultPartOptions, aH as XlsxExportOptions, aI as createHoloTransferOperationStore, aJ as createHoloTransferStorage, aK as createPanelTransferTables, aL as csvExportFormat, aM as csvImportFormat, aN as defineExporter, aO as defineImporter, aP as defineResource, aQ as executeTransferExport, aR as finalizeTransferExportParts, aS as holoTransferCompletionNotifier, aT as persistTransferExportPart, aU as readTransferResultParts, aV as snapshotTransferUpload, aW as transferDefinitionRevision, aX as writeTransferResultPart, aY as xlsxExportFormat } from './transfers-BD_3nfbz.js';
import { J as JsonObject, b as RenderSlotReference, c as RecordTypeSource, d as RecordTypeValue, e as RuntimeTypeSource, f as RuntimeTypeValue, a as JsonValue, g as TableQueryFilterDefinition, C as ContextTypeSources, O as OptionalRuntimeTypeValue, S as ScopedRenderSlots, P as PanelRenderSlot, T as TableQueryState, h as JsonPrimitive, i as TableFilterOperator, j as TableQueryFilter, H as HoloTableQuery, k as TableQueryDefinition, l as TableQueryResult, m as TableRecordIdentifier, n as TableSelection } from './contracts-BHzklEOG.js';
export { A as AllTableQueryResult, o as CursorTableQueryResult, p as HoloCursorPaginatedResult, q as HoloPaginatedResult, r as HoloPaginationMeta, s as HoloSimplePaginatedResult, t as HoloSimplePaginationMeta, u as JsonArray, v as PageTableQueryResult, w as RenderSlotSource, R as ResourceRenderSlot, x as ScopedRenderSlotManifest, y as SimpleTableQueryResult, z as TableAggregateKind, B as TablePaginationMode, D as TableQueryAggregateDefinition, E as TableQueryColumnDefinition, F as TableQueryScalar, G as TableQuerySort, I as TableSortDirection } from './contracts-BHzklEOG.js';
import { FieldDefinition, FormSchema, InferFormData, StandardSchemaV1Issue, WebFileLike } from '@holo-js/forms';
import { RelationDefinition } from '@holo-js/db';
import '@holo-js/notifications';

declare function deriveFieldClientHints(definition: FieldDefinition): FieldClientHints;
declare function deriveSchemaDefault<TValue>(definition: FieldDefinition): TValue | undefined;

declare abstract class FieldBuilder<TValues, TPath extends FormFieldPath<TValues>, TValue = FormFieldValue<TValues, TPath>, TType extends string = string, TRecord = unknown> {
    #private;
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
    action(id: string): this;
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
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "widget";
    constructor(id: string, family: WidgetFamily, type: string);
    heading(value: string | null): this;
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
type ResourceWidgetFromSources<TData extends JsonValue, TRecordSource extends RecordTypeSource, TActorSource extends RuntimeTypeSource | undefined, TTenantSource extends RuntimeTypeSource | undefined, TServicesSource extends RuntimeTypeSource | undefined> = WidgetBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>, RecordTypeValue<TRecordSource>>;
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

declare class TemporaryUploadService {
    #private;
    constructor(options: TemporaryUploadServiceOptions);
    create(input: CreateTemporaryUploadInput): Promise<TemporaryUploadDescriptor>;
    write(input: WriteTemporaryUploadInput): Promise<StoredUploadDescriptor>;
    resolve(input: ResolveTemporaryUploadInput): Promise<StoredUploadDescriptor>;
    delete(input: DeleteTemporaryUploadInput): Promise<void>;
    attachToMedia(input: ResolveTemporaryUploadInput, target: MediaAttachmentTarget, collection?: string): Promise<MediaAttachmentResult>;
    cleanupExpired(): Promise<number>;
    private activeUploads;
    private storagePages;
    private assertAccess;
    private assertContext;
    private authorize;
    private metadataDirectory;
    private paths;
    private requireMetadata;
    private storedDescriptor;
    private withLock;
}
declare class UploadStoragePaginationError extends Error {
    constructor();
}
declare function createTemporaryUploadService(options: TemporaryUploadServiceOptions): TemporaryUploadService;
declare const PANELS_CLEAN_TEMPORARY_UPLOADS_JOB = "panels:uploads:cleanup";
declare function runTemporaryUploadCleanupJob(service: TemporaryUploadService): Promise<{
    readonly removed: number;
}>;

declare function handleUploadEndpoint(service: TemporaryUploadService, request: UploadEndpointRequest): Promise<UploadEndpointResponse>;

declare function createHoloUploadStorage(diskName: string): UploadStorageAdapter;

declare function resolveActionState<TRecord, TActor, TTenant, TServices>(definition: Pick<ActionDefinition<TRecord, JsonObject, unknown, TActor, TTenant, TServices>, 'disabled' | 'label' | 'visible'>, context: ActionContext<TRecord, TActor, TTenant, TServices>): Promise<ActionResolvedState>;
declare function compileActionManifest<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>, label: string, context: ActionContext<TRecord, TActor, TTenant, TServices>, state?: Pick<ActionResolvedState, 'disabled' | 'visible'>): Promise<Readonly<ActionManifest>>;

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

declare class ActionExecutionError extends Error {
    readonly code: 'denied' | 'failed' | 'idempotency-conflict' | 'rate-limited' | 'record-not-found' | 'stale';
    readonly effects: readonly Effect[];
    constructor(code: 'denied' | 'failed' | 'idempotency-conflict' | 'rate-limited' | 'record-not-found' | 'stale', message: string, effects?: readonly Effect[]);
}
declare class ActionEngine<TRecord, TRecordId extends number | string, TActor, TTenant, TServices> {
    #private;
    readonly options: ActionEngineOptions<TRecord, TRecordId, TActor, TTenant>;
    constructor(options: ActionEngineOptions<TRecord, TRecordId, TActor, TTenant>);
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
    slots: ScopedRenderSlots<PageLayoutSlot>;
    subheading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>;
    title?: PageResolvable<PageContext<TActor, TTenant, TServices>, string>;
}
declare class PageBuilder<TData extends JsonObject = JsonObject, TActor = unknown, TTenant = unknown, TServices = unknown> extends ConstructionBuilder<PageState<TData, TActor, TTenant, TServices>, CompiledPageDefinition<TData, TActor, TTenant, TServices>> implements DiscoverableBuilder<'page'> {
    readonly id: string;
    readonly pageType: PageType;
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
    slot(slot: PageLayoutSlot, reference: string | RenderSlotReference): this;
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

declare function createNavigationSeed(pages: readonly CompiledPageDefinition<JsonObject, unknown, unknown, unknown>[]): readonly PanelNavigationSeed[];

interface PanelState<TActor> {
    access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>;
    actorPresenter: PanelActorPresenter<TActor>;
    auth: ((path: string) => CompiledPanelAuth<TActor>) | null;
    branding: PanelBranding;
    databaseNotifications: PanelDatabaseNotificationConfiguration | null;
    databaseNotificationInbox: PanelDatabaseNotificationInboxOptions<TActor> | null;
    defaults: readonly ComponentDefault[];
    defaultPanel: boolean;
    discover: DiscoveryDirectories;
    guard: string;
    navigation: PanelNavigationSeed[];
    navigationMode: PanelNavigationMode;
    path: string;
    plugins: readonly PanelPlugin<TActor>[];
    sidebarCollapsible: boolean;
    slots: ScopedRenderSlots<PanelRenderSlot>;
    theme: PanelTheme;
    tenancy: CompiledPanelTenancy<TActor> | null;
    userMenu: PanelUserMenuItem[];
}
interface PanelDiscoveryServer {
    readonly plugins: readonly {
        readonly compatibility: PluginCompatibility;
        readonly contributions: PanelPluginInstallation<unknown>['contributions'];
        readonly id: string;
        readonly packageName: string;
    }[];
}
declare class PanelBuilder<TActor = unknown> extends ConstructionBuilder<PanelState<TActor>, CompiledPanelDefinition<TActor>> implements DiscoverableBuilder<'panel'> {
    readonly id: string;
    readonly discoveryMarker: "@holo-js/panels/discovery/v1";
    readonly kind: "panel";
    constructor(id: string);
    get route(): string;
    get guardName(): string;
    get discover(): Readonly<DiscoveryDirectories>;
    get client(): Readonly<Record<string, string>>;
    path(value: string): this;
    guard(value: string): this;
    defaultPanel(value?: boolean): this;
    ['default'](value?: boolean): this;
    access(policy: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>): this;
    auth<TProfileValues extends Readonly<Record<string, unknown>>, TProfileField extends Extract<keyof TProfileValues, string>, TTenantSource extends RuntimeTypeSource, TServicesSource extends RuntimeTypeSource>(sources: {
        readonly services: TServicesSource;
        readonly tenant: TTenantSource;
    }, options: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, RuntimeTypeValue<TTenantSource>, RuntimeTypeValue<TServicesSource>>): this;
    auth<TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>, TProfileField extends Extract<keyof TProfileValues, string> = Extract<keyof TProfileValues, string>, TTenant = unknown, TServices = unknown>(options: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices>): this;
    presentActor(presenter: PanelActorPresenter<TActor>): this;
    plugin<TTenant = unknown>(plugin: PanelPlugin<TActor, TTenant>): this;
    defaults(...defaults: readonly ComponentDefault[]): this;
    slot(slot: PanelRenderSlot, reference: string | RenderSlotReference): this;
    tenancy<TTenantSource extends RuntimeTypeSource, TTenantId extends PanelTenantIdentifier, TRegistrationValues extends Readonly<Record<string, unknown>>, TProfileValues extends Readonly<Record<string, unknown>>>(options: PanelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>, TTenantId, TTenantSource, TRegistrationValues, TProfileValues>): this;
    databaseNotifications(options?: Partial<PanelDatabaseNotificationConfiguration>): this;
    databaseNotificationInbox(options: PanelDatabaseNotificationInboxOptions<TActor>): this;
    branding(value: {
        readonly favicon?: string | null;
        readonly logo?: string | null;
        readonly name?: string;
    }): this;
    theme(value: Partial<PanelTheme>): this;
    navigationMode(value: PanelNavigationMode): this;
    collapsibleSidebar(value?: boolean): this;
    navigation(items: readonly PanelNavigationSeed[]): this;
    userMenu(items: readonly PanelUserMenuItem[]): this;
    discoverResources(path?: string): this;
    discoverPages(path?: string): this;
    discoverWidgets(path?: string): this;
    discoverClusters(path?: string): this;
    compileDiscoveryDefinition(): DiscoverableDefinition<'panel', PanelDiscoveryServer>;
    protected createDefinition(state: Readonly<PanelState<TActor>>): CompiledPanelDefinition<TActor>;
    private installPlugin;
    private writeDiscovery;
}
interface PanelActorSource<TActor extends object> {
    readonly prototype: TActor;
}
declare function definePanel<TActor extends object>(id: string, actor: PanelActorSource<TActor>): PanelBuilder<TActor>;
declare function definePanel(id: string): PanelBuilder<unknown>;

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

export { ActionContext, ActionDefinition, ActionEngine, ActionEngineOptions, ActionExecutionError, ActionExecutionRequest, ActionExecutionResult, ActionGroupBuilder, ActionGroupItem, ActionGroupManifest, ActionKind, ActionManifest, ActionMount, type ActionPersistence, ActionResolvedState, type ActionResolverContext, AdvancedColumnFactory, AdvancedColumnMap, type AdvancedColumnRecordSource, AdvancedFilterColumn, AdvancedFilterCondition, AdvancedFilterValue, AdvancedOperatorFor, AdvancedQueryFilter, AdvancedScalarType, type AggregateDriver, type AggregatePrimitive, BasicFieldFactory, type BasicFormSchema, type BasicFormValues, BooleanColumn, BooleanEntry, BooleanFilter, BoundFormField, type BoundPanelTenantContext, type BuilderBlockDefinition, type BuilderBlockMap, type BuilderBlockValidationIssue, type BuilderBlockValue, BuilderFieldBuilder, type BuiltinActionOptions, CalloutBuilder, type CapabilityHost, ChartWidgetData, CheckboxColumn, CheckboxFieldBuilder, ChoiceFieldBuilder, ChoiceFieldFactory, type ChoiceFieldType, ChoiceOption, type ClientExpression, type ClientExpressionNode, type ClientExpressionOperator, CodeEntry, CodeFieldBuilder, CollectionFieldFactory, type CollectionFieldProperties, type CollectionValue, ColorColumn, ColorEntry, ColorFieldBuilder, ColumnAggregate, ColumnAlignment, ColumnBuilder, ColumnDataSource, type ColumnFactory, type ColumnRecordSource, ColumnResolver, type ColumnResolverContext, type CompiledChoiceFieldDefinition, CompiledColumnDefinition, CompiledDashboardDefinition, type CompiledEntryDefinition, CompiledFieldDefinition, CompiledFilterDefinition, type CompiledGroupDefinition, CompiledPageDefinition, CompiledPanelDefinition, CompiledPanelTenancy, CompiledSchema, CompiledSchemaComponent, type CompiledSummaryDefinition, CompiledWidgetDefinition, ComponentDefault, type ComponentDefaultLayers, ConstructionBuilder, ContainerComponentBuilder, ContextTypeSources, CreateTemporaryUploadInput, CustomColumn, CustomComponentBuilder, CustomComponentProperties, type CustomEntryDefinition, CustomFieldBuilder, type CustomFieldDefinition, type CustomFilterOptions, CustomOptionSource, type CustomOptionSourceHandlers, CustomSchemaFilter, type CustomSummaryResolver, CustomWidgetData, DashboardBuilder, DashboardContext, DashboardNavigation, DateFieldBuilder, type DatePickerMode, DateRangeFilter, DateRangeFilterValue, type DeepReadonly, DefaultableComponentKind, DeleteTemporaryUploadInput, DiscoverableBuilder, DiscoverableDefinition, DiscoverableKind, DiscoveryDirectories, EN_MESSAGES, Effect, EmptyStateBuilder, EntryBuilder, type EntryFactory, type EntryFormat, type EntryManifest, type EntryRecordPath, type EntryRecordPathValue, type EntryRecordSource, type EntryRelatedRecord, type EntryRelationPath, type EntryRendererProps, type EntryRendererRegistration, type EntryRendererRegistryContract, type EntryResolver, type EntryResolverContext, EntrySchemaComponentBuilder, type EntrySchemaSource, type EntryServerHandles, type EntryStateSource, type ExplicitServerResolver, ExtensionFilterBuilder, ExtensionFilterFactory, type ExtensionFilterOptions, ExtensionTypeId, FieldBuilder, FieldClientHints, type FieldPath, type FieldPathValue, FieldPresentationState, FieldResolvable, FieldResolver, FieldResolverContext, FieldsetBuilder, FilterBuilder, FilterCollection, FilterCollectionPlacement, FilterCollectionPresentation, FilterEncoder, FilterExecutionContext, FilterFactory, FilterIndicator, FilterIndicatorResolver, FilterManifest, FilterResponsiveColumns, FilterSchemaComponentBuilder, type FilterSchemaSource, FilterServerHandles, type FilterTypeSource, FormFieldPath, FormFieldPathFor, FormFieldValue, type FormResolverContext, FormSchemaBinding, GridBuilder, GroupBuilder$1 as GroupBuilder, type GroupManifest, type GroupOrder, type GroupResolver, type GroupResolverContext, type GroupStateSnapshot, type GroupedAggregateRequest, type GroupedAggregateRow, type GroupedRecords, type GroupedSummaryDriverAdapter, GroupingState, HiddenFieldBuilder, type HoloAggregateQuery, HoloOptionQuery, HoloTableQuery, IconColumn, IconEntry, ImageColumn, ImageEntry, type EntryResolverContext$1 as InfolistEntryResolverContext, type InlineEditActionExecutor, type InlineEditActionInput, type InlineEditRequest, type InlineEditableColumnManifest, InlineEditorManifest, JsonObject, JsonPrimitive, JsonValue, type KeyValueEntry$1 as KeyValueEntry, KeyValueFieldBuilder, KeyValueEntry as KeyValueInfolistEntry, LabelCapability, type LabelState, type LiteralResolver, MarkdownFieldBuilder, MediaAttachmentResult, MediaAttachmentTarget, type NamedClientResolver, NormalizedRelationListRequest, type NotificationResolverContext, type NullResolver, OptionPage, OptionQueryRequest, type OptionResolver, OptionService, OptionServiceLimits, OptionSource, OptionValue, OptionalRuntimeTypeValue, P7AFilterCompatibility, PANELS_CLEAN_TEMPORARY_UPLOADS_JOB, PageBreadcrumb, PageBuilder, PageComponentBody, PageContext, PageLayoutSlot, PageNavigation, PageNavigationInput, PageRendererManifest, PageResolvable, type PageResolverContext, PageServerHandles, PageType, type PageTypeSources, PanelAccessContext, PanelActorPresenter, type PanelActorSource, PanelAuthPageConfiguration, PanelAuthenticatedScope, PanelBranding, PanelBuilder, PanelDatabaseNotificationConfiguration, PanelDatabaseNotificationInboxOptions, PanelNavigationMode, PanelNavigationSeed, PanelNotificationScope, PanelNotificationStore, PanelPlugin, PanelPluginInstallation, PanelRenderSlot, type PanelResolverContext, PanelTenancyOptions, PanelTenantExecutionContext, PanelTenantIdentifier, PanelTheme, PanelUserMenuItem, PluginCompatibility, RadioFieldBuilder, type RadioOption, type RawServerCallback, RecordPath, RecordPathFor, RecordPathValue, RecordTypeSource, RecordTypeValue, RegisteredTranslations, RelatedRecord, RelationInputError, RelationListPaginationError, RelationListRequest, type RelationManagerAuthorization, RelationManagerBuilder, type RelationManagerBuilderOptions, type RelationManagerContext, type RelationManagerDefinition, RelationManagerExecutor, type RelationManagerTransaction, RelationOperation, RelationOperationNotAllowedError, type RelationOptionPage, RelationPath, type RelationPersistence, RelationPivotInputError, RelationPresentation, RelationRecordNotFoundError, RelationRecordPage, type RelationValidation, RelationshipOptionAdapter, RelationshipOptionQueryModifier, RelationshipOptionSource, RelationshipSelectFilter, RenderSlotReference, RepeatableEntry, RepeaterFieldBuilder, type Resolvable, ResolveTemporaryUploadInput, type ResolverComponentError, type ResolverContext, type ResolverContextInput, ResolverDependencyCycleError, type ResolverDomain, ResolverOptionSource, ResourceWidgetContext, type ResourceWidgetTypeSources, ResponsiveValue, RichEditorFieldBuilder, type RichTextDocument, type RichTextMark, type RichTextMarkType, type RichTextNode, type RichTextNodeType, type RichTextSanitizer, RuntimeTypeSource, RuntimeTypeValue, SchemaBreakpoint, SchemaBuilder, SchemaCollapseProperties, SchemaColumnSpan, SchemaComponentBuilder, type SchemaComponentFactory, SchemaComponentKind, SchemaComponentProperties, SchemaLayoutProperties, SchemaPath, SchemaRenderSlots, type SchemaTypeSource, SchemaVisibilityResolver, type SchemaWidgetContext, ScopedRenderSlots, SectionBuilder, SelectColumn, type SelectColumnOption, SelectFilter, SelectFilterOption, type SelectedOptionResolver, type ServerResolverBatchOptions, type ServerResolverBatchResult, ServerResolverBatcher, type ServerResolverPatch, type ServerResolverRequest, type ServerValueResolver, SliderFieldBuilder, SlugFieldBuilder, type SlugLocalTransform, SplitBuilder, StaticOptionSource, StatsWidgetData, StepBuilder, StoredUploadDescriptor, type SubmittedBuilderBlock, type SummaryAggregateRequest, SummaryBuilder, type SummaryDriverAdapter, SummaryFactory, type SummaryKind, type SummaryManifest, type SummaryMode, type SummaryResolverContext, type SummaryResult, type SummaryTypeSource, TabBuilder, TableFilterOperator, type TableFilterSnapshot, TableFilterState, GroupBuilder as TableGroupBuilder, GroupFactory as TableGroupFactory, TableQueryDefinition, TableQueryExecutor, TableQueryFilter, TableQueryFilterDefinition, TableQueryResult, TableQueryState, TableRecordIdentifier, TableSelection, TableWidgetData, TabsBuilder, TagsFieldBuilder, TemporaryUploadDescriptor, TemporaryUploadService, TemporaryUploadServiceOptions, TernaryFilter, TernaryFilterValue, TextColumn, TextEntry, TextFieldBuilder, TextFormatter, TextInputColumn, type TextInputMode, TextareaFieldBuilder, ToggleColumn, ToggleFieldBuilder, TranslationArguments, TranslationCatalog, type TranslationKey, TranslationMessage, TranslationReference, TrashedFilter, TrashedFilterValue, UploadEndpointRequest, UploadEndpointResponse, UploadFieldBuilder, UploadFieldFactory, UploadMimeInspector, UploadPolicy, UploadStorageAdapter, UploadStoragePaginationError, VisibilityCapability, type VisibilityState, WidgetBuilder, WidgetColumnSpan, WidgetContext, WidgetDataContext, WidgetFamily, WidgetFilterDefinition, WidgetManifest, type WidgetResolverContext, WidgetResourcePlacement, WidgetSchemaComponentBuilder, type WidgetSchemaSource, WidgetServerHandles, WizardBuilder, WriteTemporaryUploadInput, actionGroup, actionsFor, advancedColumnsFor, advancedFilterValue, advancedQueryFilter, allowedRelationOperations, arCatalog, asExecutableSummary, asFilterDefinition, assignStableId, assignStableKey, bindFormSchema, bindPanelTenantContext, callout, choiceFields, clientExpression, clientResolver, collectionFields, columnsFor, compileActionManifest, copyableEntryText, createHoloSummaryAdapter, createHoloUploadStorage, createNavigationSeed, createResourceWidgetContext, createTemporaryUploadService, customComponent, customField, defaultSlugTransform, defaultUploadMimeInspector, defineChartWidget, defineCreatePage, defineCustomPage, defineCustomWidget, defineDashboard, defineEditPage, defineEntry, defineListPage, definePage, definePanel, defineRelatedRecordPage, defineResourceChartWidget, defineResourceCustomWidget, defineResourceStatsWidget, defineResourceTableWidget, defineSchema, defineSingularPage, defineStatsWidget, defineTableWidget, defineUploadPolicy, defineViewPage, dehydrateFieldValue, deriveFieldClientHints, deriveSchemaDefault, deserializeRichText, emptyState, enCatalog, entriesFor, entryValueAt, executeFullQuerySummaries, executeGroupedFullQuery, executeInlineColumnEdit, executePageSummaries, extensionFiltersFor, fields, fieldset, filterCollection, filtersFor, formResolverContextFor, formatEntryState, formatTextValue, grid, group, groupPageRecords, groupingsFor, handleUploadEndpoint, holoNotificationStore, hydrateFieldValue, isClusterDefinition, isDiscoverableBuilder, isDiscoverableDefinition, isDiscoverableKind, isExportDefinition, isImportDefinition, isPageDefinition, isPanelDefinition, isPluginDefinition, isRelationManagerDefinition, isResourceDefinition, isWidgetDefinition, literal, markDiscoverableDefinition, normalizeAggregateNumber, nullResolver, panelTenantNotificationScope, relationManagersFor, relationSupportsOperation, resolveActionState, resolveEntrySource, resolveFieldDefault, resolveFieldPresentationState, runTemporaryUploadCleanupJob, schemaComponentsFor, schemaEntry, schemaFilter, schemaWidget, section, selectDefaultDashboard, serializeMarkdown, serializeRichText, serverResolver, split, step, structuralRichTextSanitizer, summariesFor, tab, tabs, trans, uploadExtension, uploadFields, validateBuilderBlocks, widgetContext, withComponentDefaults, wizard };
