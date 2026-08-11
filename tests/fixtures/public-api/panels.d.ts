export { PanelTokenName, PanelTokenOverrides, PanelTokenValues, darkPanelTheme, definePanelTheme, lightPanelTheme, panelThemeStyleAttribute, panelThemeVariables, panelTokenNames, panelTokenVariable } from '@holo-js/panels-ui';
import { JsonValue, RuntimeTypeSource, ContextTypeSources, WidgetBuilder, RuntimeTypeValue, OptionalRuntimeTypeValue, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices, ChartWidgetData, JsonObject, PageTypeSources, PageBuilder, StatsWidgetData, TableWidgetData, FormFieldPathFor, ResourceAttributes, TextFieldBuilder, FormFieldValue, TextareaFieldBuilder, CheckboxFieldBuilder, ToggleFieldBuilder, RadioFieldBuilder, DateFieldBuilder, FormFieldPath, HiddenFieldBuilder, SliderFieldBuilder, ColorFieldBuilder, SlugFieldBuilder, OptionValue, ChoiceFieldBuilder, TagsFieldBuilder, KeyValueEntry, KeyValueFieldBuilder, CodeFieldBuilder, MarkdownFieldBuilder, RichEditorFieldBuilder, RepeaterFieldBuilder, BuilderBlockMap, BuilderFieldBuilder, UploadPolicy, UploadFieldBuilder, ExtensionTypeId, CustomFieldDefinition, CustomFieldBuilder, ColumnFactory, DiscoverableDefinition, FilterFactory, TableGroupFactory, SummaryFactory, defineAction as defineAction$1, definePage as definePage$1, definePanel as definePanel$1, ResourceModel, ResourceRecord, ResourceQuery, RecordTypeSource, ResourceContextTypeSources, InferredResourceBuilder, SchemaBuilder } from '@holo-js/panels-core';
export { AccessibleChartModel, AccessibleChartRenderer, AccessibleChartRow, ActionBuilder, ActionGroupBuilder, ActionGroupItem, ActionGroupManifest, ActionPresentationDefinition, ActionPresentationManifest, ActionRateLimit, ActionSize, CalloutBuilder, CapabilityHost, ChartPoint, ChartSeries, ChartWidgetData, CompiledDashboardDefinition, CompiledPageDefinition, CompiledPanelDefinition, CompiledPanelTenancy, CompiledSchema, CompiledSchemaComponent, CompiledWidgetDefinition, ComponentDefault, ConstructionBuilder, ContainerComponentBuilder, ContextTypeSources, CustomComponentBuilder, CustomComponentProperties, CustomWidgetData, DashboardBuilder, DashboardContext, DashboardManifest, DashboardNavigation, DeepReadonly, DefaultPanelActor, DefaultPanelServices, DefaultPanelTenant, DefaultableComponentKind, EmptyStateBuilder, ExecutePanelDatabaseNotificationOperationOptions, FieldsetBuilder, GridBuilder, GroupBuilder, HoloAuth, HoloAuthGuard, JsonObject, LabelCapability, LabelState, NestedResourceOptions, OptionalRuntimeTypeValue, PageAccessError, PageBreadcrumb, PageBuilder, PageComponentBody, PageContext, PageLayoutSlot, PageManifest, PageNavigation, PageNavigationInput, PageResolvable, PageServerHandles, PageType, PageTypeSources, PanelAccessContext, PanelActiveTenantPersistence, PanelActorPresenter, PanelActorSource, PanelAssetKind, PanelAssetManifest, PanelAuthContext, PanelAuthPageConfiguration, PanelAuthenticatedScope, PanelAuthorizationLayer, PanelAuthorizationRequest, PanelBootstrap, PanelBranding, PanelDarkMode, PanelDatabaseNotificationConfiguration, PanelDatabaseNotificationIdentity, PanelDatabaseNotificationInboxOptions, PanelDatabaseNotificationItem, PanelDatabaseNotificationOperationResult, PanelDatabaseNotificationPage, PanelDatabaseNotificationPayload, PanelDatabaseNotificationPlacement, PanelBuilder as PanelDefinition, PanelEmailVerificationPageConfiguration, PanelGeneratorTemplate, PanelIconDefinition, PanelIconPath, PanelLoginPageConfiguration, PanelLogoutPageConfiguration, PanelManifest, PanelModelTenancyOptions, PanelMultiFactorPageConfiguration, PanelNavigationMode, PanelNavigationSeed, PanelNotification, PanelNotificationAccessError, PanelNotificationAction, PanelNotificationActionKind, PanelNotificationAuthorization, PanelNotificationBootstrap, PanelNotificationInbox, PanelNotificationOperation, PanelNotificationPresentation, PanelNotificationRecipient, PanelNotificationRecipientResolver, PanelNotificationRecord, PanelNotificationRequestError, PanelNotificationScope, PanelNotificationStatus, PanelNotificationStore, PanelNotificationStorePage, PanelNotificationStorePagination, PanelNotificationStoreQuery, PanelOperation, PanelPackageModuleContribution, PanelPasswordResetPageConfiguration, PanelPermissionSubject, PanelPlugin, PanelPluginAsset, PanelPluginBuilder, PanelPluginContribution, PanelPluginContributionDefinition, PanelPluginIcon, PanelPluginInstallation, PanelProfilePageConfiguration, PanelQueuedTenantContext, PanelRenderSlot, PanelRendererFramework, PanelRendererRegistration, PanelRuntime, PanelRuntimeError, PanelTenancyManifest, PanelTenancyOptions, PanelTenantBillingProvider, PanelTenantBootstrap, PanelTenantIdentifier, PanelTenantIdentity, PanelTenantMenuItem, PanelTenantPresentation, PanelTenantPresentationInput, PanelTheme, PanelTranslationContribution, PanelUserMenuItem, PanelsConfiguration, RecordTypeSource, RecordTypeValue, RenderSlotReference, ResolvedPageData, ResolvedWidget, ResourceActionComposer, ResourceAttribute, ResourceAttributes, ResourceAuthorization, ResourceCapabilities, ResourceClientManifest, ResourceBuilder as ResourceDefinition, ResourceExecutionContext, ResourceExecutor, ResourceExecutorOptions, ResourceGlobalSearch, ResourceIdentifier, ResourceInput, ResourceInputError, ResourceLifecycle, ResourceModel, ResourceModelDefinition, ResourceMutationResult, ResourceNavigation, ResourceOperation, ResourceParentReference, ResourcePersistence, ResourceQuery, ResourceRecord, ResourceRecordFor, ResourceRecordNotFoundError, ResourceRenderSlot, ResourceTransaction, ResourceValidation, ResourceWidgetContext, ResponsiveValue, RuntimeTypeSource, RuntimeTypeValue, SchemaBreakpoint, SchemaBuilder, SchemaCollapseProperties, SchemaColumnSpan, SchemaComponentBuilder, SchemaComponentFactory, SchemaComponentKind, SchemaComponentManifest, SchemaComponentPatch, SchemaComponentProperties, SchemaJsonValue, SchemaLayoutProperties, SchemaManifest, SchemaPath, SchemaRenderSlots, SchemaTraversalContext, SchemaTypeSource, SchemaValueAtPath, SchemaVisibilityResolver, ScopedRenderSlotManifest, ScopedRenderSlots, SectionBuilder, SingularResourceOptions, SplitBuilder, StatsWidgetData, StepBuilder, TabBuilder, TableWidgetData, TabsBuilder, TargetedSchemaPatch, VisibilityCapability, VisibilityState, WidgetAccessError, WidgetBuilder, WidgetColumnSpan, WidgetContext, WidgetDataContext, WidgetFamily, WidgetFilterDefinition, WidgetFilterState, WidgetLayout, WidgetManifest, WidgetPolling, WidgetResourcePlacement, WidgetServerHandles, WidgetStat, WizardBuilder, actionGroup, actionsFor, advancedColumnsFor, applySchemaNodePatches, assignStableId, assignStableKey, callout, choiceFields, collectionFields, columnsFor, componentDefault, createAccessibleChartModel, createExtensionTypeId, createGeneratedResourcePage, createNavigationSeed, createResourceActionComposer, createResourceWidgetContext, csvExportFormat, csvImportFormat, customComponent, databaseNotificationPayload, defineCustomWidget, defineDashboard, defineExporter, defineImporter, definePanelPlugin, definePanelsConfig, defineResourceChartWidget, defineResourceCustomWidget, defineResourceStatsWidget, defineResourceTableWidget, emptyState, entriesFor, evaluateSchemaVisibility, executePanelDatabaseNotificationOperation, fields, fieldset, filtersFor, findSchemaComponent, generatedResourcePageManifests, grid, group, holoNotificationStore, isPanelDatabaseNotificationPayload, panelNotification, patchSchemaNode, preparePageRoutes, relationManagersFor, renderAccessibleChart, requireResolvedWidget, resolveTableWidgetData, resolveWidget, schemaComponentsFor, section, selectDefaultDashboard, split, step, summariesFor, tab, tabs, traverseSchema, uploadFields, widgetContext, wizard } from '@holo-js/panels-core';
export { ClientEffectHandler, ClientEffectSession, ClientEffectSessionOptions, ClientNotificationActionHandler, ClientNotificationInboxListener, ClientNotificationInboxOptions, ClientNotificationInboxState, ClientNotificationInboxStore, ClientNotificationRealtime, ClientNotificationTransport, ClientToast, ClientToastState, ClientToastStateListener, ClientToastStore, PanelNotificationTransportOptions, PanelShellBootstrap, PanelShellError, PanelShellErrorCode, PanelShellManifest, PanelShellMenuItem, PanelShellNavigationItem, PanelShellNavigationMode, PanelShellState, PanelShellStateListener, PanelShellStore, PanelShellViewport, WidgetClientFilter, WidgetClientManifest, WidgetClientState, WidgetClientStatus, WidgetFilterPersistence, WidgetFilterStorage, WidgetGridPlacement, WidgetLoadResult, WidgetLoader, WidgetScheduler, WidgetStateListener, WidgetStore, WidgetViewport, createPanelNotificationTransport, fluxNotificationRealtime, resolveWidgetGrid, widgetGridColumns, widgetViewport } from '@holo-js/panels-client';

interface PageFactory {
    <TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>): PageBuilder<TData, OptionalRuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    (id: string): PageBuilder<JsonObject, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>;
}
interface WidgetFactory<TData extends JsonValue> {
    <TActorSource extends RuntimeTypeSource, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(id: string, sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>): WidgetBuilder<TData, RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>;
    (id: string): WidgetBuilder<TData, DefaultPanelActor, DefaultPanelTenant, DefaultPanelServices>;
}
declare const defineCreatePage: PageFactory;
declare const defineCustomPage: PageFactory;
declare const defineEditPage: PageFactory;
declare const defineListPage: PageFactory;
declare const defineRelatedRecordPage: PageFactory;
declare const defineSingularPage: PageFactory;
declare const defineViewPage: PageFactory;
declare const defineChartWidget: WidgetFactory<ChartWidgetData>;
declare const defineStatsWidget: WidgetFactory<StatsWidgetData>;
declare const defineTableWidget: WidgetFactory<TableWidgetData>;

type ModelSource = {
    readonly definition?: {
        readonly relations?: Readonly<Record<string, unknown>>;
        readonly table?: {
            readonly columns?: Readonly<Record<string, {
                readonly kind?: string;
            }>>;
        };
    };
    create(...parameters: never[]): object | Promise<object>;
};
type ModelRecord<TSource extends ModelSource> = Awaited<ReturnType<TSource['create']>>;
type PreviousDepth = [never, 0, 1, 2, 3, 4];
type RelatedSource<TRelation> = TRelation extends {
    readonly related: () => infer TSource extends ModelSource;
} ? TSource : never;
type RelatedRecord<TRelation, TDepth extends number> = RelatedSource<TRelation> extends infer TSource extends ModelSource ? ModelRecord<TSource> & ModelRelationValues<TSource, TDepth> : never;
type RelatedValue<TRelation, TDepth extends number> = TRelation extends {
    readonly kind: 'belongsToMany' | 'hasMany' | 'hasManyThrough' | 'morphMany' | 'morphToMany' | 'morphedByMany';
} ? readonly RelatedRecord<TRelation, TDepth>[] : TRelation extends {
    readonly kind: 'morphTo';
} ? object | null : RelatedRecord<TRelation, TDepth> | null;
type ModelRelationValues<TSource extends ModelSource, TDepth extends number = 3> = TDepth extends 0 ? object : TSource extends {
    readonly definition: {
        readonly relations: infer TRelations extends Readonly<Record<string, unknown>>;
    };
} ? string extends keyof TRelations ? object : {
    readonly [TName in keyof TRelations & string]: RelatedValue<TRelations[TName], PreviousDepth[TDepth]>;
} : object;
type ModelRecordWithRelations<TSource extends ModelSource> = ModelRecord<TSource> & ModelRelationValues<TSource>;
type ValuesFor<TRecord> = ResourceAttributes<TRecord>;
type TextValue = string | number | null | undefined;
type StringValue = string | null | undefined;
type BooleanValue = boolean | null | undefined;
type DateValue = Date | null | undefined;
type ArrayValue = readonly unknown[] | null | undefined;
declare class ModelFieldFactory<TRecord> {
    #private;
    constructor(source: ModelSource);
    text<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string | number>>(path: TPath): TextFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & TextValue, TRecord>;
    textarea<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): TextareaFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    checkbox<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean>>(path: TPath): CheckboxFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & BooleanValue, TRecord>;
    toggle<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean>>(path: TPath): ToggleFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & BooleanValue, TRecord>;
    radio<TPath extends FormFieldPathFor<ValuesFor<TRecord>, boolean | number | string>>(path: TPath): RadioFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (boolean | number | string | null | undefined), TRecord>;
    date<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord>;
    time<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord>;
    dateTime<TPath extends FormFieldPathFor<ValuesFor<TRecord>, Date>>(path: TPath): DateFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & DateValue, TRecord>;
    hidden<TPath extends FormFieldPath<ValuesFor<TRecord>>>(path: TPath): HiddenFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, TRecord>;
    slider<TPath extends FormFieldPathFor<ValuesFor<TRecord>, number>>(path: TPath): SliderFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (number | null | undefined), TRecord>;
    color<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): ColorFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    slug<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): SlugFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    select<TPath extends FormFieldPathFor<ValuesFor<TRecord>, OptionValue>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'select', TRecord>;
    multiselect<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'multiselect', TRecord>;
    checkboxList<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : never, OptionValue>, 'checkbox-list', TRecord>;
    toggleButtons<TPath extends FormFieldPathFor<ValuesFor<TRecord>, OptionValue | readonly OptionValue[]>>(path: TPath): ChoiceFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath>, Extract<NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>> extends readonly (infer TItem)[] ? TItem : NonNullable<FormFieldValue<ValuesFor<TRecord>, TPath>>, OptionValue>, 'toggle-buttons', TRecord>;
    tags<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly string[]>>(path: TPath): TagsFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (readonly string[] | null | undefined), TRecord>;
    keyValue<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly KeyValueEntry[]>>(path: TPath): KeyValueFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & (readonly KeyValueEntry[] | null | undefined), TRecord>;
    code<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): CodeFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    markdown<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): MarkdownFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    richEditor<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string>>(path: TPath): RichEditorFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & StringValue, TRecord>;
    repeater<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly object[]>>(path: TPath): RepeaterFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & ArrayValue, TRecord>;
    builder<TPath extends FormFieldPathFor<ValuesFor<TRecord>, readonly object[]>, TBlocks extends BuilderBlockMap>(path: TPath, blocks: TBlocks): BuilderFieldBuilder<ValuesFor<TRecord>, TPath, FormFieldValue<ValuesFor<TRecord>, TPath> & ArrayValue, TBlocks, TRecord>;
    file<TPath extends FormFieldPathFor<ValuesFor<TRecord>, string | readonly string[]>>(path: TPath, policy: UploadPolicy): UploadFieldBuilder<ValuesFor<TRecord>, TPath, TRecord>;
    custom<TPath extends FormFieldPath<ValuesFor<TRecord>>, TValue, TType extends ExtensionTypeId<'field'>, TProperties extends JsonObject, TContext>(path: TPath, typeId: TType, definition: CustomFieldDefinition<TValue, TProperties, TContext>): CustomFieldBuilder<ValuesFor<TRecord>, TPath, TValue, TType, TProperties, TRecord>;
}
declare function modelColumns<TSource extends ModelSource>(source: TSource): ColumnFactory<ModelRecordWithRelations<TSource>>;
type ModelComponentSource = ModelSource;

type ComponentValueKind = 'boolean' | 'date-time' | 'number' | 'text';
interface ComponentDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> {
    readonly key: TKey;
    readonly type: string;
    readonly valueKind: TValueKind;
    label(value: string): this;
}
interface FieldDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> extends ComponentDescriptor<TKey, TValueKind> {
    readonly disabledState: boolean;
    readonly helperTextValue?: string;
    readonly placeholderValue?: string;
    readonly requiredState: boolean;
    disabled(value?: boolean): this;
    helperText(value: string): this;
    placeholder(value: string): this;
    required(): this;
}
interface ColumnDescriptor<TKey extends string, TValueKind extends ComponentValueKind = ComponentValueKind> extends ComponentDescriptor<TKey, TValueKind> {
    readonly searchableState: boolean;
    readonly sortableState: boolean;
    readonly toggleableState: boolean;
    searchable(value?: boolean): this;
    sortable(value?: boolean): this;
    toggleable(value?: boolean): this;
}
type DescriptorValue<TValueKind extends ComponentValueKind> = TValueKind extends 'boolean' ? boolean : TValueKind extends 'number' ? number : TValueKind extends 'date-time' ? Date : string;
type CheckedDescriptor<TRecord, TDescriptor> = TDescriptor extends ComponentDescriptor<infer TKey, infer TValueKind> ? TKey extends Extract<keyof ResourceAttributes<TRecord>, string> ? NonNullable<ResourceAttributes<TRecord>[TKey]> extends DescriptorValue<TValueKind> ? TDescriptor : never : never : never;
type CheckedDescriptors<TRecord, TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[]> = {
    readonly [TIndex in keyof TDescriptors]: CheckedDescriptor<TRecord, TDescriptors[TIndex]>;
};
declare const field: Readonly<{
    boolean: <TKey extends string>(key: TKey) => FieldDescriptor<TKey, "boolean">;
    dateTime: <TKey extends string>(key: TKey) => FieldDescriptor<TKey, "date-time">;
    number: <TKey extends string>(key: TKey) => FieldDescriptor<TKey, "number">;
    text: <TKey extends string>(key: TKey) => FieldDescriptor<TKey, "text">;
}>;
declare const column: Readonly<{
    boolean: <TKey extends string>(key: TKey) => ColumnDescriptor<TKey, "boolean">;
    dateTime: <TKey extends string>(key: TKey) => ColumnDescriptor<TKey, "date-time">;
    number: <TKey extends string>(key: TKey) => ColumnDescriptor<TKey, "number">;
    text: <TKey extends string>(key: TKey) => ColumnDescriptor<TKey, "text">;
}>;
declare class SchemaDefinition<TRecord> {
    #private;
    readonly definitionKind: "schema";
    readonly resourceRecordType: TRecord;
    constructor(source?: ModelComponentSource);
    fields<const TFields extends readonly {
        compile(): {
            readonly kind: 'field';
            readonly path: string;
        };
    }[]>(configure: (field: ModelFieldFactory<TRecord>) => TFields): this;
    fields<const TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[]>(descriptors: TDescriptors, ..._validation: TDescriptors extends CheckedDescriptors<TRecord, TDescriptors> ? [] : [error: never]): this;
    get components(): readonly ComponentDescriptor<string, ComponentValueKind>[];
    compile(): Readonly<{
        fields: readonly object[];
    }>;
}
declare class TableDefinition<TRecord> {
    #private;
    readonly definitionKind: "table";
    readonly resourceRecordType: TRecord;
    constructor(source?: ModelComponentSource);
    columns<const TColumns extends readonly {
        compile(): {
            readonly kind: 'column';
            readonly manifest: {
                readonly path: string;
            };
        };
    }[]>(configure: (column: ColumnFactory<TRecord>) => TColumns): this;
    columns<const TDescriptors extends readonly ComponentDescriptor<string, ComponentValueKind>[]>(descriptors: TDescriptors, ..._validation: TDescriptors extends CheckedDescriptors<TRecord, TDescriptors> ? [] : [error: never]): this;
    get components(): readonly ComponentDescriptor<string, ComponentValueKind>[];
    filters<const TFilters extends readonly {
        compile(): object;
    }[]>(configure: (filter: FilterFactory<TRecord>) => TFilters): this;
    deferFilters(value?: boolean): this;
    groups<const TGroups extends readonly {
        compile(): object;
    }[]>(configure: (group: TableGroupFactory<TRecord>) => TGroups): this;
    summaries<const TSummaries extends readonly {
        compile(): object;
    }[]>(configure: (summary: SummaryFactory<TRecord>) => TSummaries): this;
    compile(): Readonly<{
        columns: readonly object[];
        filterMode: 'deferred' | 'live';
        filters: readonly object[];
        groups: readonly object[];
        serverColumns: readonly object[];
        serverFilters: readonly object[];
        serverGroups: readonly object[];
        serverSummaries: readonly object[];
        summaries: readonly object[];
    }>;
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
type DefinitionTableRecord<TSource extends DefinitionRecordSource> = TSource extends ModelComponentSource ? ModelRecordWithRelations<TSource> : DefinitionRecord<TSource>;
declare function defineSchema<TSource extends DefinitionRecordSource>(source: TSource): SchemaDefinition<DefinitionRecord<TSource>>;
declare function defineSchema(): SchemaDefinition<object>;
declare function defineSchema<TSource extends DefinitionRecordSource>(id: string, source: TSource): SchemaBuilder<DefinitionRecord<TSource>, unknown>;
declare function defineSchema<TSource extends DefinitionRecordSource, TContextSource extends {
    readonly prototype: object;
}>(id: string, source: TSource, context: TContextSource): SchemaBuilder<DefinitionRecord<TSource>, TContextSource['prototype']>;
declare function defineSchema(id: string): SchemaBuilder<Readonly<Record<string, unknown>>, unknown>;
declare function defineTable<TSource extends DefinitionRecordSource>(source: TSource): TableDefinition<DefinitionTableRecord<TSource>>;
declare function defineTable(): TableDefinition<object>;

declare const definePanel: typeof definePanel$1;
declare const definePage: typeof definePage$1;
interface ResourceFactory {
    <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>, TActorSource extends RecordTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined>(model: TModel, sources: ResourceContextTypeSources<TActorSource, TTenantSource>): InferredResourceBuilder<TModel, TActorSource extends RecordTypeSource ? Extract<RuntimeTypeValue<TActorSource>, object> : DefaultPanelActor, OptionalRuntimeTypeValue<TTenantSource>>;
    <TModel extends ResourceModel<ResourceRecord, ResourceQuery<unknown, ResourceRecord>>>(model: TModel): InferredResourceBuilder<TModel, DefaultPanelActor, DefaultPanelTenant>;
}
declare const defineResource: ResourceFactory;
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
declare const defineAction: typeof defineAction$1;
declare const defineColumn: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"column", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineEntry: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"entry", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineField: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"field", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineFilter: <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource) => CustomDefinitionBuilder<"filter", OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>>;
declare const defineCluster: (id: string) => DiscoverableDefinition<"cluster">;
declare const defineResourcePage: typeof definePage$1;
declare const defineWidget: (id: string) => DiscoverableDefinition<"widget">;
type RelationManagerDefinition<TRecord> = DiscoverableDefinition<'relation-manager'> & {
    readonly record?: TRecord;
    readonly resourceRecordType: TRecord;
};
declare function defineRelationManager<TSource extends DefinitionRecordSource>(id: string, source: TSource): RelationManagerDefinition<DefinitionRecord<TSource>>;
declare function defineRelationManager(id: string): RelationManagerDefinition<object>;

export { type ColumnDescriptor, type CompiledCustomDefinition, type ComponentDescriptor, type ComponentValueKind, CustomDefinitionBuilder, type DefinitionRecord, type DefinitionRecordSource, type FieldDescriptor, type ModelComponentSource, ModelFieldFactory, type ModelRecordWithRelations, type RelationManagerDefinition, SchemaDefinition, TableDefinition, column, defineAction, defineChartWidget, defineCluster, defineColumn, defineCreatePage, defineCustomPage, defineEditPage, defineEntry, defineField, defineFilter, defineListPage, definePage, definePanel, defineRelatedRecordPage, defineRelationManager, defineResource, defineResourcePage, defineSchema, defineSingularPage, defineStatsWidget, defineTable, defineTableWidget, defineViewPage, defineWidget, field, modelColumns };
