import {
  ClientActionStore,
  CollectionStore,
  createBrowserUploadAdapter,
  createUploadStore,
  ClientEffectSession,
  ClientNotificationInboxStore,
  ClientToastStore,
  FormStore,
  GlobalSearchStore,
  installPanelSpaNavigation,
  OptionStore,
  PanelsErrorBoundary,
  PanelsAvatar,
  PanelsDropdown,
  PanelsLink,
  PanelsLoadingIndicator,
  PanelsPortalProvider,
  PanelsTransport,
  PanelShellStore,
  panelConfigurationVariables,
  PROTOCOL_VERSION,
  TableStateStore,
  VueActionRenderer,
  VueDashboardRenderer,
  VueEntryRenderer,
  VueFieldRenderer,
  VueNotificationInboxTrigger,
  VueTenantSwitcher,
  VueRelationManagerRenderer,
  VueTableRenderer,
  VueToastViewport,
  WidgetStore,
  createPanelNotificationTransport,
  createPanelTenantSwitcherTransport,
  createDefaultComponentRegistry,
  executePanelAuthRequest,
  registerVueFieldRenderers,
  toJsonValue,
  type ClientActionManifest,
  type ClientNotificationRealtime,
  type ClientSearchResponse,
  type ComponentRegistry,
  type JsonObject,
  type PanelAvatarComponentProps,
  type PanelChromeComponentProps,
  type VueNotificationInboxTriggerProps,
  type VueCompiledField,
  type VueEntryStore,
  type VueRelationManagerRendererProps,
  type VueTableAction,
  type VueTableColumn,
  type VueTableFilter,
  type VueTableGroup,
  type VueTableSummary,
  type VueWidgetManifest,
  type UploadPolicy,
} from '@holo-js/panels-vue'
import { defineAsyncComponent, defineComponent, h, onMounted, onUnmounted, ref, shallowReactive, watchEffect, type Component, type PropType, type VNode } from 'vue'
import type { NuxtPanelPage, NuxtPanelPageData, PanelPageProps } from './contracts'
import { ShadcnButton, ShadcnIcon, ShadcnInput } from './internal-ui'

type ResourceRecord = Record<string, unknown>
type ResourceValues = Record<string, unknown>
type PanelColorMode = 'light' | 'dark' | 'system'

function isPanelColorMode(value: string | null): value is PanelColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function panelColorMode(value: unknown): PanelColorMode {
  return value === 'dark' || value === 'system' ? value : 'light'
}

interface PanelPageRuntime {
  readonly effects: ClientEffectSession
  readonly transport: PanelsTransport
}

interface ResourceOption {
  readonly label: string
  readonly value: number | string
}

export function createNuxtPanelComponentRegistry(): ComponentRegistry {
  return registerVueFieldRenderers(createDefaultComponentRegistry())
}

interface ResourceOptionSource {
  readonly dependency?: string
  readonly options: readonly ResourceOption[]
  readonly optionsByDependency?: Readonly<Record<string, readonly ResourceOption[]>>
  readonly server: boolean
}

interface ResourceField extends VueCompiledField<ResourceValues> {
  readonly defaultValue?: unknown
  readonly optionSource?: ResourceOptionSource
  readonly reactive?: { readonly source: string, readonly transform: 'slug' }
}

interface ResourceAction extends VueTableAction {
  readonly kind: ClientActionManifest['kind']
  readonly path?: string
}

interface ResourceRenderSchema {
  readonly actions: readonly ResourceAction[]
  readonly basePath: string
  readonly columns: readonly VueTableColumn<ResourceRecord>[]
  readonly entries: readonly JsonObject[]
  readonly fields: readonly ResourceField[]
  readonly filters: readonly VueTableFilter[]
  readonly filterMode: 'deferred' | 'live'
  readonly recordTitle: string
  readonly recordActions: readonly ClientActionManifest[]
  readonly resourceId: string
  readonly routeKey: string
  readonly routes: Readonly<{ create: string | null, edit: string | null, view: string | null }>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function searchResponse(value: unknown, panelId: string, term: string): ClientSearchResponse {
  if (!isObject(value)) throw new Error('Global search returned an invalid response')
  const results = Array.isArray(value.results) ? value.results.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.resourceId !== 'string' || typeof item.title !== 'string' || typeof item.url !== 'string') return []
    const details = isObject(item.details) ? Object.fromEntries(Object.entries(item.details).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
    return [{ actions: [], details, icon: typeof item.icon === 'string' ? item.icon : null, id: item.id, image: typeof item.image === 'string' ? item.image : null, resourceId: item.resourceId, title: item.title, url: item.url }]
  }) : []
  return Object.freeze({ panelId, results: Object.freeze(results), term })
}

function isPath(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/u.test(value)
}

function humanizePath(path: string): string {
  return path
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/^\w/u, character => character.toUpperCase())
}

function relationFields(value: unknown): NonNullable<VueRelationManagerRendererProps['managers'][number]['fields']> {
  if (!Array.isArray(value)) return []
  return value.flatMap((field) => {
    if (!isObject(field) || typeof field.id !== 'string' || typeof field.type !== 'string' || !['date-time', 'number', 'text', 'textarea', 'toggle'].includes(field.type)) return []
    return [{ id: field.id, label: typeof field.label === 'string' ? field.label : field.id, required: field.required === true, type: field.type as 'date-time' | 'number' | 'text' | 'textarea' | 'toggle' }]
  })
}

function relationManagers(value: unknown): VueRelationManagerRendererProps['managers'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((manager) => {
    if (!isObject(manager) || typeof manager.id !== 'string' || typeof manager.label !== 'string') return []
    const presentation = String(manager.presentation)
    if (!['groupedTabs', 'inline', 'page', 'tabs'].includes(presentation)) return []
    const records = Array.isArray(manager.records) ? manager.records.flatMap((record) => {
      if (!isObject(record) || !isObject(record.values) || (typeof record.id !== 'number' && typeof record.id !== 'string')) return []
      return [{ id: record.id, values: toJsonValue(record.values) as JsonObject }]
    }) : []
    return [{
      badge: typeof manager.badge === 'number' || typeof manager.badge === 'string' ? manager.badge : null,
      columns: Array.isArray(manager.columns) ? manager.columns.flatMap(column => isObject(column) && typeof column.key === 'string' ? [{ key: column.key, label: typeof column.label === 'string' ? column.label : column.key }] : []) : [],
      fields: relationFields(manager.fields),
      group: typeof manager.group === 'string' ? manager.group : null,
      id: manager.id,
      label: manager.label,
      operations: Array.isArray(manager.operations) ? manager.operations.filter(operation => typeof operation === 'string') as VueRelationManagerRendererProps['managers'][number]['operations'] : [],
      presentation: presentation as VueRelationManagerRendererProps['managers'][number]['presentation'],
      pivotFields: relationFields(manager.pivotFields),
      records,
      url: typeof manager.url === 'string' ? manager.url : null,
      visible: manager.visible !== false,
    }]
  })
}

function clientAction(value: unknown): ClientActionManifest | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return null
  const kind = String(value.kind)
  const mount = typeof value.mount === 'string' ? value.mount : 'record'
  if (!['create', 'custom', 'delete', 'edit', 'force-delete', 'replicate', 'restore', 'view'].includes(kind) || !['bulk', 'modal', 'notification', 'page', 'record'].includes(mount)) return null
  return {
    badge: typeof value.badge === 'string' ? value.badge : null,
    color: typeof value.color === 'string' ? value.color : null,
    confirmation: typeof value.confirmation === 'string' ? value.confirmation : null,
    disabled: value.disabled === true,
    icon: typeof value.icon === 'string' ? value.icon : null,
    id: value.id,
    kind: kind as ClientActionManifest['kind'],
    label: value.label,
    modal: null,
    mount: mount as ClientActionManifest['mount'],
    size: ['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(String(value.size)) ? value.size as ClientActionManifest['size'] : 'medium',
    tooltip: typeof value.tooltip === 'string' ? value.tooltip : null,
    type: typeof value.type === 'string' ? value.type : `core:action:${kind}`,
    visible: value.visible !== false,
  }
}

function resourceSchema(page: NuxtPanelPageData): ResourceRenderSchema {
  const generated = page.manifest.body?.component === 'resource-page' && isObject(page.manifest.body.properties.resource)
    ? page.manifest.body.properties.resource
    : null
  const generatedForm = generated && isObject(generated.form) ? generated.form : null
  const generatedInfolist = generated && isObject(generated.infolist) ? generated.infolist : null
  const generatedTable = generated && isObject(generated.table) ? generated.table : null
  const schema = generated && generatedForm && generatedTable
    ? {
        actions: generatedTable.actions,
        basePath: `${page.manifest.path.split(/\/:record/u, 1)[0]?.replace(/\/(?:create)$/u, '') ?? ''}`,
        columns: Array.isArray(generatedTable.columns) ? generatedTable.columns.map(manifest => ({ manifest })) : [],
        entries: Array.isArray(generatedInfolist?.entries) ? generatedInfolist.entries : [],
        fields: Array.isArray(generatedForm.fields) ? generatedForm.fields.map((field) => {
          if (!isObject(field)) return field
          const properties = isObject(field.properties) ? field.properties : {}
          const options = Array.isArray(properties.options) ? properties.options : []
          const sourceKind = typeof properties.optionSource === 'string' ? properties.optionSource : ''
          const reactive = properties.specialization === 'slug' && isPath(properties.source)
            ? { source: properties.source, transform: 'slug' as const }
            : undefined
          return { ...field, ...(options.length > 0 || (sourceKind && sourceKind !== 'static') ? { optionSource: { options, server: !!sourceKind && sourceKind !== 'static' } } : {}), ...(reactive ? { reactive } : {}), ...(typeof properties.defaultValue !== 'undefined' ? { defaultValue: properties.defaultValue } : {}) }
        }) : [],
        filters: Array.isArray(generatedTable.filters) ? generatedTable.filters.map(manifest => ({ manifest })) : [],
        filterMode: generatedTable.filterMode === 'deferred' ? 'deferred' : 'live',
        kind: 'resource',
        recordTitle: generated.recordTitle,
        recordActions: Array.isArray(generated.actions) ? generated.actions : [],
        resourceId: generated.id,
        routeKey: generated.routeKey,
        routes: isObject(generated.routes) ? generated.routes : {},
      }
    : page.schema
  if (!isObject(schema) || schema.kind !== 'resource' || typeof schema.resourceId !== 'string' || typeof schema.basePath !== 'string' || !schema.basePath.startsWith('/') || !isPath(schema.routeKey) || !isPath(schema.recordTitle)) {
    throw new Error('Resource pages require a compiled resource render schema')
  }
  if (!Array.isArray(schema.fields) || !Array.isArray(schema.columns) || !Array.isArray(schema.filters) || !Array.isArray(schema.actions)) {
    throw new Error('Resource render schemas require fields, columns, filters, and actions')
  }
  if (!schema.fields.every(item => isObject(item) && isPath(item.path) && typeof item.type === 'string')) throw new Error('Resource render schema fields are invalid')
  if (!schema.columns.every(item => isObject(item) && isObject(item.manifest) && isPath(item.manifest.path) && typeof item.manifest.type === 'string')) throw new Error('Resource render schema columns are invalid')
  const routes = isObject(schema.routes) ? schema.routes : {}
  return {
    actions: (schema.actions as unknown as readonly ResourceAction[]).map((action) => {
      const path = action.kind === 'edit' || action.kind === 'view' ? routes[action.kind] : null
      return { ...action, ...(typeof path === 'string' ? { path } : {}) }
    }),
    basePath: schema.basePath.replace(/\/+$/gu, ''),
    columns: schema.columns as unknown as readonly VueTableColumn<ResourceRecord>[],
    entries: (Array.isArray(schema.entries) ? schema.entries : schema.fields) as JsonObject[],
    fields: (schema.fields as unknown as readonly ResourceField[]).map(field => ({
      ...field,
      label: typeof field.label === 'string' && field.label.trim() ? field.label : humanizePath(field.path),
    })),
    filters: schema.filters as unknown as readonly VueTableFilter[],
    filterMode: schema.filterMode === 'deferred' ? 'deferred' : 'live',
    recordTitle: schema.recordTitle,
    recordActions: (Array.isArray(schema.recordActions) ? schema.recordActions : schema.actions).flatMap(item => clientAction(item) ?? []),
    resourceId: schema.resourceId,
    routeKey: schema.routeKey,
    routes: {
      create: typeof routes.create === 'string' ? routes.create : null,
      edit: typeof routes.edit === 'string' ? routes.edit : null,
      view: typeof routes.view === 'string' ? routes.view : null,
    },
  }
}

function recordsFrom(page: NuxtPanelPageData): ResourceRecord[] {
  if (!Array.isArray(page.data.records)) return []
  return page.data.records.filter(isObject) as ResourceRecord[]
}

function summaryValue(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value
  return value === null || typeof value === 'undefined' ? '' : JSON.stringify(value)
}

function tableSummaries(value: unknown): readonly VueTableSummary[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.label !== 'string') return []
    return [{ id: item.id, label: item.label, value: summaryValue(item.value) }]
  }) : []
}

function tableGroups(value: unknown): readonly VueTableGroup<ResourceRecord>[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    if (!isObject(item) || typeof item.key !== 'string' || typeof item.title !== 'string') return []
    return [{
      collapsed: item.collapsed === true,
      collapsible: item.collapsible === true,
      description: typeof item.description === 'string' ? item.description : null,
      key: item.key,
      records: Array.isArray(item.records) ? item.records.filter(isObject) : [],
      summaries: tableSummaries(item.summaries),
      title: item.title,
    }]
  }) : []
}

function entryStore(definition: JsonObject, record: ResourceRecord): VueEntryStore {
  const path = typeof definition.path === 'string' ? definition.path : ''
  const state = toJsonValue(valueAtPath(record, path))
  const snapshot = {
    actions: Array.isArray(definition.actions) ? definition.actions.filter((item): item is string => typeof item === 'string') : [],
    copyable: definition.copyable === true,
    error: null,
    formattedState: state,
    id: typeof definition.id === 'string' ? definition.id : path,
    inlineLabel: definition.inlineLabel === true,
    label: typeof definition.label === 'string' ? definition.label : null,
    pending: false,
    placeholder: typeof definition.placeholder === 'string' ? definition.placeholder : null,
    properties: isObject(definition.properties) ? definition.properties : {},
    state,
    tooltip: null,
    type: typeof definition.type === 'string' ? definition.type : 'text',
    url: null,
  }
  return { snapshot, subscribe: () => () => undefined }
}

function recordFrom(page: NuxtPanelPageData): ResourceRecord | null {
  return isObject(page.data.record) ? page.data.record : null
}

function valueAtPath(record: Readonly<ResourceRecord>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => isObject(value) ? value[segment] : undefined, record)
}

function setValueAtPath(record: ResourceValues, path: string, value: unknown): void {
  const segments = path.split('.')
  let target = record
  for (const segment of segments.slice(0, -1)) {
    const nested = target[segment]
    if (isObject(nested)) target = nested
    else {
      const created: ResourceValues = {}
      target[segment] = created
      target = created
    }
  }
  const final = segments.at(-1)
  if (final) target[final] = value
}

function slug(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
}

function panelsTransport(): PanelsTransport {
  return new PanelsTransport({
    adapter: {
      async send(request) {
        const response = await fetch(request.url, { body: request.body, credentials: request.credentials, headers: request.headers, method: request.method, signal: request.signal })
        const headers: Record<string, string> = {}
        response.headers.forEach((value, name) => { headers[name] = value })
        return { body: await response.json(), headers, status: response.status }
      },
    },
  })
}

async function mutate(runtime: PanelPageRuntime, panelId: string, operation: 'action' | 'form-submit', payload: JsonObject): Promise<unknown> {
  const response = await runtime.transport.execute({ kind: 'mutation', name: operation, supportsIdempotency: true }, {
    endpoint: `/holo/panels/${encodeURIComponent(panelId)}/${operation}`,
    panelId,
    payload,
  })
  await runtime.effects.apply(response)
  if (!response.ok) throw new Error(response.error.message)
  return response.data
}

function mutationPayload(value: unknown): JsonObject {
  const serialized = toJsonValue(value)
  if (!isObject(serialized)) throw new Error('Resource mutations require JSON object payloads')
  return serialized as JsonObject
}

function optionsFor(source: ResourceOptionSource, dependencies: Readonly<Record<string, unknown>>): readonly ResourceOption[] {
  if (!source.dependency) return source.options
  const selected = dependencies[source.dependency]
  if (typeof selected !== 'string' && typeof selected !== 'number') return []
  return source.optionsByDependency?.[String(selected)] ?? []
}

function optionStore(panelId: string, resourceId: string, field: ResourceField, values: Readonly<ResourceValues>): OptionStore<string | number> | undefined {
  const source = field.optionSource
  if (!source) return undefined
  const dependency = source.dependency
  const dependencyValue = dependency ? valueAtPath(values, dependency) : undefined
  return new OptionStore({
    dependencies: dependency ? { [dependency]: typeof dependencyValue === 'string' || typeof dependencyValue === 'number' ? dependencyValue : null } : {},
    fieldId: field.path,
    locale: 'en',
    panelId,
    ...(dependency ? { requiredDependencies: [dependency] } : {}),
    resourceId,
    tenantKey: 'current',
    transport: {
      async hydrateSelected(request, selectedValues) {
        if (source.server) {
          const response = await runtimeOptions(panelId, resourceId, field.path, 'hydrate', request, selectedValues, fieldValues(values))
          return response.options
        }
        const selected = new Set(selectedValues)
        return optionsFor(source, request.dependencies).filter(option => selected.has(option.value))
      },
      async list(request) {
        if (source.server) return await runtimeOptions(panelId, resourceId, field.path, 'list', request, [], fieldValues(values))
        const options = optionsFor(source, request.dependencies)
        return { hasMore: false, options, page: request.page, perPage: request.perPage, total: options.length }
      },
      async validateSelection(request, selectedValues) {
        if (source.server) return (await runtimeOptions(panelId, resourceId, field.path, 'validate', request, selectedValues, fieldValues(values))).valid === true
        const allowed = new Set(optionsFor(source, request.dependencies).map(option => option.value))
        return selectedValues.every(value => allowed.has(value))
      },
      ...(source.server && field.properties.canCreateOption === true ? {
        async create(request, label) {
          const result = await runtimeOptions(panelId, resourceId, field.path, 'create', request, [], fieldValues(values), label)
          if (!result.option) throw new Error('The created option response is invalid')
          return result.option
        },
      } : {}),
      ...(source.server && field.properties.canEditOption === true ? {
        async edit(request, value, label) {
          const result = await runtimeOptions(panelId, resourceId, field.path, 'edit', request, [], fieldValues(values), label, value)
          if (!result.option) throw new Error('The edited option response is invalid')
          return result.option
        },
      } : {}),
    },
  })
}

function fieldValues(values: Readonly<ResourceValues>): JsonObject {
  return mutationPayload(values)
}

async function runtimeOptions(
  panelId: string,
  resourceId: string,
  fieldId: string,
  action: 'create' | 'edit' | 'hydrate' | 'list' | 'validate',
  request: Readonly<{ readonly dependencies: Readonly<Record<string, unknown>>, readonly page: number, readonly perPage: number, readonly search: string }>,
  selectedValues: readonly (number | string)[],
  values: JsonObject,
  label?: string,
  value?: number | string,
): Promise<{ readonly hasMore: boolean, readonly option?: ResourceOption, readonly options: readonly ResourceOption[], readonly page: number, readonly perPage: number, readonly total?: number, readonly valid?: boolean }> {
  const transport = panelsTransport()
  const payload = mutationPayload({ action, dependencies: request.dependencies, fieldId, page: request.page, perPage: request.perPage, resourceId, search: request.search, selectedValues, values, ...(label ? { label } : {}), ...(typeof value === 'number' || typeof value === 'string' ? { value } : {}) })
  const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, { endpoint: `/holo/panels/${encodeURIComponent(panelId)}/options`, panelId, payload })
  if (!response.ok) throw new Error(response.error.message)
  const data = response.data
  const options = Array.isArray(data.options) ? data.options.filter((option): option is JsonObject => isObject(option)).flatMap((option) => typeof option.label === 'string' && (typeof option.value === 'number' || typeof option.value === 'string') ? [{ label: option.label, value: option.value }] : []) : []
  const option = isObject(data.option) && typeof data.option.label === 'string' && (typeof data.option.value === 'number' || typeof data.option.value === 'string') ? { label: data.option.label, value: data.option.value } : undefined
  return { hasMore: data.hasMore === true, ...(option ? { option } : {}), options, page: typeof data.page === 'number' ? data.page : request.page, perPage: typeof data.perPage === 'number' ? data.perPage : request.perPage, ...(typeof data.total === 'number' ? { total: data.total } : {}), ...(typeof data.valid === 'boolean' ? { valid: data.valid } : {}) }
}

function initialValues(schema: ResourceRenderSchema, record: ResourceRecord | null): ResourceValues {
  const values: ResourceValues = {}
  for (const field of schema.fields) setValueAtPath(values, field.path, record ? valueAtPath(record, field.path) ?? '' : field.defaultValue ?? '')
  return values
}

function formPage(page: NuxtPanelPageData, panelId: string, registry: ComponentRegistry, schema: ResourceRenderSchema, runtime: PanelPageRuntime, createRedirect: 'edit' | 'index' | 'view', editRedirect: 'index' | 'view' | null, unsavedChangesAlerts: boolean): () => VNode {
  const record = recordFrom(page)
  let routeValue = record ? valueAtPath(record, schema.routeKey) : undefined
  const values = initialValues(schema, record)
  const relations = relationManagers(page.data.relations)
  const store = new FormStore(values, {
    dependencies: schema.fields.flatMap(field => field.reactive
      ? [{
          id: `${schema.resourceId}:${field.path}`,
          paths: [field.reactive.source],
          recompute: (context: { readonly changedPaths: ReadonlySet<string>, get(path: string): unknown }) => context.changedPaths.has(field.reactive?.source ?? '')
            ? [{ kind: 'set' as const, path: field.path, value: slug(context.get(field.reactive?.source ?? '')) }]
            : [],
        }]
      : []),
  })
  const preventUnload = (event: BeforeUnloadEvent): void => {
    if (!unsavedChangesAlerts || store.state.dirtyPaths.length === 0) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', preventUnload))
  onUnmounted(() => window.removeEventListener('beforeunload', preventUnload))
  const optionStores = new Map(schema.fields.flatMap(field => {
    const options = optionStore(panelId, schema.resourceId, field, values)
    return options ? [[field.path, options] as const] : []
  }))
  const collectionStores = new Map(schema.fields.flatMap(field => {
    if (!['builder', 'key-value', 'repeater'].includes(field.type)) return []
    const value = valueAtPath(values, field.path)
    return [[field.path, new CollectionStore(Array.isArray(value) ? value : [], 'resource-item')] as const]
  }))
  const uploadStores = new Map(schema.fields.flatMap(field => {
    const uploadPolicy = isObject(field.properties.uploadPolicy) ? field.properties.uploadPolicy as unknown as UploadPolicy : undefined
    if (field.type !== 'panels:field:upload' || !uploadPolicy) return []
    const upload = createUploadStore({
      adapter: createBrowserUploadAdapter({
        endpoint: `/holo/panels/${encodeURIComponent(panelId)}/upload`,
        fieldId: field.path,
        intent: page.manifest.pageType === 'edit' ? 'edit' : 'create',
        panelId,
        recordId: typeof routeValue === 'string' || typeof routeValue === 'number' ? routeValue : null,
        resourceId: schema.resourceId,
      }),
      context: { actorId: 'current', fieldId: field.path, panelId, resourceId: schema.resourceId },
      policy: uploadPolicy,
    })
    upload.subscribe(snapshot => {
      const stored = snapshot.items.flatMap(item => item.status === 'stored' && item.token ? [{ id: item.id, token: item.token }] : [])
      store.batch([{ kind: 'set', path: field.path, touch: true, value: uploadPolicy.maximumFiles === 1 ? stored[0] ?? '' : stored }])
    })
    return [[field.path, upload] as const]
  }))
  store.subscribe((next, previous) => {
    for (const field of schema.fields) {
      const dependency = field.optionSource?.dependency
      const options = optionStores.get(field.path)
      if (!dependency || !options || valueAtPath(next.values, dependency) === valueAtPath(previous.values, dependency)) continue
      const selected = valueAtPath(next.values, field.path)
      const dependencyValue = valueAtPath(next.values, dependency)
      void options.updateDependencies({ [dependency]: typeof dependencyValue === 'string' || typeof dependencyValue === 'number' ? dependencyValue : null }, typeof selected === 'string' || typeof selected === 'number' ? selected : null).then(async (result) => {
        if (result.status === 'cleared') store.batch([{ kind: 'set', path: field.path, value: '', touch: false }])
        if (typeof dependencyValue === 'string' || typeof dependencyValue === 'number') await options.preload()
      })
    }
  })
  const submit = async (): Promise<void> => {
    await store.submit(async request => {
      const result = await mutate(runtime, panelId, 'form-submit', mutationPayload({
        mutation: page.manifest.pageType === 'create' ? 'create' : 'update',
        ...(typeof routeValue === 'string' || typeof routeValue === 'number' ? { record: routeValue } : {}),
        resourceId: schema.resourceId,
        ...request.values,
      }))
      if (isObject(result) && isObject(result.record)) {
        const nextRouteValue = valueAtPath(result.record, schema.routeKey)
        if (typeof nextRouteValue === 'string' || typeof nextRouteValue === 'number') {
          routeValue = nextRouteValue
          const redirect = page.manifest.pageType === 'create' ? createRedirect : editRedirect
          const encodedRouteValue = encodeURIComponent(String(nextRouteValue))
          if (redirect) {
            const target = redirect === 'index' ? schema.basePath : redirect === 'view' ? `${schema.basePath}/${encodedRouteValue}` : `${schema.basePath}/${encodedRouteValue}/edit`
            window.location.assign(target)
          } else if (page.manifest.pageType === 'edit') {
            window.history.replaceState(null, '', `${schema.basePath}/${encodedRouteValue}/edit`)
          }
        }
      }
      return { commitValues: true }
    })
  }
  const runRelation: NonNullable<VueRelationManagerRendererProps['onOperation']> = async (request) => {
    if (typeof routeValue !== 'string' && typeof routeValue !== 'number') throw new Error('Relation operations require a persisted owner record')
    await mutate(runtime, panelId, 'action', mutationPayload({
      intent: 'relation',
      managerId: request.managerId,
      ownerId: routeValue,
      ...(request.pivot ? { pivot: request.pivot } : {}),
      ...(typeof request.recordId === 'string' || typeof request.recordId === 'number' ? { relatedId: request.recordId } : {}),
      relationOperation: request.operation,
      resourceId: schema.resourceId,
      ...(request.values ? { values: request.values } : {}),
    }))
    window.location.reload()
  }
  const loadRelationOptions: NonNullable<VueRelationManagerRendererProps['loadOptions']> = async (managerId, search) => {
    if (typeof routeValue !== 'string' && typeof routeValue !== 'number') throw new Error('Relation options require a persisted owner record')
    const response = await runtime.transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, {
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/options`,
      panelId,
      payload: mutationPayload({ ownerId: routeValue, relationManagerId: managerId, resourceId: schema.resourceId, search }),
    })
    if (!response.ok) throw new Error(response.error.message)
    return Array.isArray(response.data.options) ? response.data.options.flatMap(option => isObject(option) && typeof option.label === 'string' && (typeof option.value === 'number' || typeof option.value === 'string') ? [{ label: option.label, value: option.value }] : []) : []
  }
  return () => h('div', { class: 'hp-resource-page' }, [
    h('form', { class: 'hp-resource-form', 'data-resource-crud': page.manifest.pageType, 'data-slot': 'card', onSubmit: (event: Event) => { event.preventDefault(); void submit().catch(() => undefined) } }, [
      ...schema.fields.map(definition => h(VueFieldRenderer, { field: { collectionStore: collectionStores.get(definition.path), createCollectionItem: definition.type === 'builder' ? (blockType?: string) => ({ data: {}, type: blockType ?? '' }) : definition.type === 'repeater' ? () => ({}) : undefined, definition, optionStore: optionStores.get(definition.path), panelId, registry, store, uploadStore: uploadStores.get(definition.path) }, key: definition.path })),
      h('div', { class: 'hp-form-actions' }, [h(ShadcnButton, { class: 'hp-button hp-button-primary', type: 'submit' }, 'Save')]),
    ]),
    relations.length > 0 ? h(VueRelationManagerRenderer, { relations: { loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation } }) : null,
  ])
}

function recordId(record: Readonly<ResourceRecord>, routeKey: string): number | string {
  const value = valueAtPath(record, routeKey)
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Resource records require a valid route key')
  return value
}

function actionLocation(schema: ResourceRenderSchema, action: ResourceAction, routeValue: number | string): string {
  const encoded = encodeURIComponent(String(routeValue))
  if (action.path) return action.path.replaceAll('{record}', encoded).replaceAll(':record', encoded)
  const recordPath = `${schema.basePath}/${encoded}`
  return action.kind === 'edit' ? `${recordPath}/edit` : recordPath
}

function navigableColumns(schema: ResourceRenderSchema): readonly VueTableColumn<ResourceRecord>[] {
  const viewAction = schema.actions.find(action => action.kind === 'view')
  if (!viewAction) return schema.columns
  return schema.columns.map(column => column.manifest.path === schema.recordTitle
    ? {
        ...column,
        url: (record: Readonly<ResourceRecord>) => actionLocation(schema, viewAction, recordId(record, schema.routeKey)),
      }
    : column)
}

function tablePage(page: NuxtPanelPageData, panelId: string, schema: ResourceRenderSchema, runtime: PanelPageRuntime): VNode {
  const records = recordsFrom(page)
  const visibleColumns = schema.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path)
  const store = new TableStateStore<ResourceRecord>({ filterMode: schema.filterMode, panelId, records, tableId: schema.resourceId, total: typeof page.data.total === 'number' ? page.data.total : records.length, visibleColumns })
  const groups = shallowReactive([...tableGroups(page.data.groups)])
  const summaries = shallowReactive([...tableSummaries(page.data.summaries)])
  if (typeof page.data.search === 'string') store.setSearch(page.data.search)
  for (const filter of schema.filters) {
    const value = page.data[filter.manifest.id]
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null) store.setFilter(filter.manifest.id, value)
  }
  const refresh = (): void => {
    const query = store.query
    void runtime.transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'table-data' }, {
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/table-data`,
      panelId,
      payload: mutationPayload({ filters: query.filters, page: query.page, perPage: query.perPage, resourceId: schema.resourceId, search: query.search, sort: query.sort }),
    }).then(async (response) => {
      await runtime.effects.apply(response)
      if (!response.ok) {
        store.applyError(query.queryVersion, { code: response.error.code, message: response.error.message })
        return
      }
      const nextRecords: ResourceRecord[] = Array.isArray(response.data.records) ? response.data.records.flatMap(item => isObject(item) ? [item] : []) : []
      groups.splice(0, groups.length, ...tableGroups(response.data.groups))
      summaries.splice(0, summaries.length, ...tableSummaries(response.data.summaries))
      store.applyData({ queryVersion: query.queryVersion, records: nextRecords, total: typeof response.data.total === 'number' ? response.data.total : nextRecords.length })
      if (typeof window !== 'undefined') window.history.replaceState(null, '', `${window.location.pathname}?${store.toQueryString()}`)
    })
  }
  const createAction = schema.recordActions.find(action => action.kind === 'create' && action.visible)
  return h('div', { class: 'hp-resource-page' }, [createAction && schema.routes.create ? h('div', { class: 'hp-resource-toolbar' }, [h(PanelsLink, { class: 'hp-button hp-button-primary', href: schema.routes.create }, () => createAction.label)]) : null, h(VueTableRenderer, {
    table: {
      actionTransport: {
        async execute(request: { readonly actionId: string, readonly recordId?: number | string }) {
          if (request.recordId === undefined) return
          const action = schema.actions.find(candidate => candidate.id === request.actionId)
          if (!action) throw new Error('Resource action is unavailable')
          if (action.kind === 'edit' || action.kind === 'view') {
            if (typeof window !== 'undefined') window.location.assign(actionLocation(schema, action, request.recordId))
            return
          }
          await mutate(runtime, panelId, 'action', { actionId: request.actionId, idempotencyKey: crypto.randomUUID(), recordIds: [request.recordId], resourceId: schema.resourceId })
          refresh()
        },
      },
      actions: schema.actions,
      caption: page.title,
      columns: navigableColumns(schema),
      filterPresentation: {
        columns: Object.freeze({ default: 2 }),
        id: `${schema.resourceId}-filters`,
        placement: 'dropdown',
        schema: Object.freeze({ components: Object.freeze([]), id: `${schema.resourceId}-filters`, kind: 'schema' }),
        slots: Object.freeze({}),
      },
      filters: schema.filters,
      groups,
      getRecordId: (record: ResourceRecord) => recordId(record, schema.routeKey),
      onQueryChange: refresh,
      store,
      summaries,
    },
  })])
}

function viewPage(page: NuxtPanelPageData, panelId: string, readOnlyRelations: boolean, registry: ComponentRegistry, schema: ResourceRenderSchema, runtime: PanelPageRuntime): VNode {
  const record = recordFrom(page)
  const editAction = schema.recordActions.find(action => action.kind === 'edit')
  const routeValue = record ? recordId(record, schema.routeKey) : null
  const actions = schema.recordActions.filter(action => action.mount === 'record' && action.visible && !['create', 'edit', 'view'].includes(action.kind))
  const relations = relationManagers(page.data.relations)
  const store = new ClientActionStore({
    createIdempotencyKey: () => crypto.randomUUID(),
    transport: {
      async execute(request) {
        if (routeValue === null) throw new Error('Resource record is unavailable')
        if (!actions.some(action => action.id === request.actionId)) throw new Error('Resource action is unavailable')
        await mutate(runtime, panelId, 'action', { actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, recordIds: [routeValue], resourceId: schema.resourceId })
        return { effects: [], items: [], status: 'succeeded' }
      },
    },
  })
  const runRelation: NonNullable<VueRelationManagerRendererProps['onOperation']> = async (request) => {
    if (routeValue === null) throw new Error('Relation operations require a persisted owner record')
    await mutate(runtime, panelId, 'action', mutationPayload({
      intent: 'relation',
      managerId: request.managerId,
      ownerId: routeValue,
      ...(request.pivot ? { pivot: request.pivot } : {}),
      ...(typeof request.recordId === 'string' || typeof request.recordId === 'number' ? { relatedId: request.recordId } : {}),
      relationOperation: request.operation,
      resourceId: schema.resourceId,
      ...(request.values ? { values: request.values } : {}),
    }))
    window.location.reload()
  }
  const loadRelationOptions: NonNullable<VueRelationManagerRendererProps['loadOptions']> = async (managerId, search) => {
    if (routeValue === null) throw new Error('Relation options require a persisted owner record')
    const response = await runtime.transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, {
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/options`,
      panelId,
      payload: mutationPayload({ ownerId: routeValue, relationManagerId: managerId, resourceId: schema.resourceId, search }),
    })
    if (!response.ok) throw new Error(response.error.message)
    return Array.isArray(response.data.options) ? response.data.options.flatMap(option => isObject(option) && typeof option.label === 'string' && (typeof option.value === 'number' || typeof option.value === 'string') ? [{ label: option.label, value: option.value }] : []) : []
  }
  return h('section', { class: 'hp-resource-view', 'data-resource-crud': 'view' }, [
    editAction && schema.routes.edit && routeValue !== null ? h('div', { class: 'hp-form-actions' }, [h(PanelsLink, { class: 'hp-button', href: schema.routes.edit.replace(':record', encodeURIComponent(String(routeValue))) }, () => editAction.label)]) : null,
    h('div', { class: 'hp-infolist' }, record ? schema.entries.map(entry => h(VueEntryRenderer, { entry: { panelId, store: entryStore(entry, record) } })) : []),
    ...actions.map(action => h(VueActionRenderer, { action, panelId, recordIds: routeValue === null ? [] : [routeValue], store })),
    relations.length > 0 ? h(VueRelationManagerRenderer, { relations: readOnlyRelations ? { managers: relations } : { loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation } }) : null,
  ])
}

const VueResourcePage = defineComponent({
  name: 'VueResourcePage',
  props: {
    effects: { type: Object as PropType<ClientEffectSession>, required: true },
    page: { type: Object as PropType<NuxtPanelPageData>, required: true },
    panelId: { type: String, required: true },
    registry: { type: Object as PropType<ComponentRegistry>, required: true },
    readOnlyRelations: { type: Boolean, default: true },
    resourceCreatePageRedirect: { type: String as PropType<'edit' | 'index' | 'view'>, default: 'edit' },
    resourceEditPageRedirect: { type: String as PropType<'index' | 'view' | null>, default: null },
    transport: { type: Object as PropType<PanelsTransport>, required: true },
    unsavedChangesAlerts: { type: Boolean, default: false },
  },
  setup(props) {
    const schema = resourceSchema(props.page)
    const runtime = { effects: props.effects, transport: props.transport }
    if (props.page.manifest.pageType === 'create' || props.page.manifest.pageType === 'edit') {
      return formPage(props.page, props.panelId, props.registry, schema, runtime, props.resourceCreatePageRedirect, props.resourceEditPageRedirect, props.unsavedChangesAlerts)
    }
    return () => props.page.manifest.pageType === 'list'
      ? tablePage(props.page, props.panelId, schema, runtime)
      : props.page.manifest.pageType === 'view'
        ? viewPage(props.page, props.panelId, props.readOnlyRelations, props.registry, schema, runtime)
        : null
  },
})

function resourceComponent(page: NuxtPanelPageData, resolveResource: PanelPageProps['resolveResource']): Component | null {
  if (!resolveResource) return page.manifest.body?.component === 'resource-page' ? VueResourcePage : null
  return defineAsyncComponent({ loader: async () => await resolveResource(page), loadingComponent: PanelsLoadingIndicator })
}

function navigationIcon(name: string): VNode {
  return ShadcnIcon(name, 'hp-panel-icon')
}

function configuredIcon(icons: JsonObject | undefined, name: string | null): string | null {
  if (!name) return null
  const configured = icons?.[name]
  return typeof configured === 'string' && configured.trim() ? configured : name
}

function actorLabel(actor: JsonObject): string {
  for (const key of ['name', 'email', 'username']) {
    const value = actor[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Account'
}

function actorAvatarUrl(actor: JsonObject): string | null {
  for (const key of ['avatarUrl', 'avatar_url', 'avatar', 'image']) {
    const value = actor[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type PanelNavigationItem = NuxtPanelPage['bootstrap']['manifest']['navigation'][number]

function orderedNavigation(items: readonly PanelNavigationItem[]): readonly Readonly<{ readonly depth: number, readonly item: PanelNavigationItem }>[] {
  const children = new Map<string | null, PanelNavigationItem[]>()
  for (const item of items) {
    const siblings = children.get(item.parent) ?? []
    siblings.push(item)
    children.set(item.parent, siblings)
  }
  const ordered: { depth: number, item: PanelNavigationItem }[] = []
  const append = (parent: string | null, depth: number): void => {
    for (const item of children.get(parent) ?? []) {
      ordered.push({ depth, item })
      append(item.id, depth + 1)
    }
  }
  append(null, 0)
  return ordered
}

function navigationLink(item: PanelNavigationItem, depth: number, activePath: string, mode: 'sidebar' | 'topbar', close: () => void): VNode {
  return h(PanelsLink, {
    current: activePath === item.path || activePath.startsWith(`${item.path}/`),
    'data-slot': 'sidebar-menu-button',
    href: item.path,
    key: item.id,
    onClick: close,
    style: { '--hp-navigation-depth': depth },
    title: mode === 'sidebar' ? item.label : undefined,
  }, () => [item.icon ? navigationIcon(item.icon) : null, h('span', item.label), item.badge ? h('span', { class: 'hp-panel-badge' }, item.badge) : null])
}

function navigation(page: NuxtPanelPage, mode: 'sidebar' | 'topbar', open: boolean, id: string, close: () => void): VNode {
  const activePath = page.path.split(/[?]/u, 1)[0] ?? page.path
  const ordered = orderedNavigation(page.bootstrap.manifest.navigation.map(item => ({
    ...item,
    icon: configuredIcon(page.bootstrap.manifest.icons, item.icon),
  })))
  const items: VNode[] = []
  if (mode === 'topbar') {
    for (const { depth, item } of ordered) items.push(navigationLink(item, depth, activePath, mode, close))
  } else {
    for (let index = 0; index < ordered.length;) {
      const current = ordered[index]!
      if (!current.item.group) {
        items.push(navigationLink(current.item, current.depth, activePath, mode, close))
        index += 1
        continue
      }
      const group = current.item.group
      const grouped: VNode[] = []
      while (index < ordered.length && ordered[index]!.item.group === group) {
        const entry = ordered[index]!
        grouped.push(navigationLink(entry.item, entry.depth, activePath, mode, close))
        index += 1
      }
      const configuration = page.bootstrap.manifest.navigationGroups?.find(candidate => candidate.label === group)
      const collapsible = page.bootstrap.manifest.layout?.collapsibleNavigationGroups !== false && configuration?.collapsible !== false
      if (!collapsible) {
        items.push(h('section', { class: 'hp-panel-navigation-section', key: group }, [h('div', { class: 'hp-panel-navigation-group', title: group }, group), ...grouped]))
        continue
      }
      items.push(h('details', { class: 'hp-panel-navigation-section', key: group, open: true }, [h('summary', {
        class: 'hp-panel-navigation-group',
        title: group,
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          const details = (event.currentTarget as HTMLElement).parentElement
          if (details?.tagName === 'DETAILS') details.toggleAttribute('open')
        },
      }, group), ...grouped]))
    }
  }
  return h('nav', { 'aria-label': 'Panel navigation', class: ['hp-panel-navigation', 'hp-panel-navigation-body', mode === 'topbar' ? 'hp-panel-navigation--topbar hp-panel-topbar-center' : null], 'data-open': open ? 'true' : 'false', 'data-slot': mode === 'sidebar' ? 'sidebar-content' : 'navigation-menu', id }, items)
}

function pageBody(page: NuxtPanelPage, registry: ComponentRegistry, resolveResource: PanelPageProps['resolveResource'], runtime: PanelPageRuntime): VNode {
  const component = resourceComponent(page.page, resolveResource)
  if (component) return h(component, { effects: runtime.effects, key: page.path, page: page.page, panelId: page.bootstrap.manifest.id, readOnlyRelations: page.bootstrap.manifest.runtime?.readOnlyRelationManagersOnResourceViewPagesByDefault ?? true, registry, resourceCreatePageRedirect: page.bootstrap.manifest.runtime?.resourceCreatePageRedirect ?? 'edit', resourceEditPageRedirect: page.bootstrap.manifest.runtime?.resourceEditPageRedirect ?? null, transport: runtime.transport, unsavedChangesAlerts: page.bootstrap.manifest.runtime?.unsavedChangesAlerts ?? false })
  return h('section', { 'data-panels-page-type': page.page.manifest.pageType })
}

const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u

function browserNavigate(url: string, replace = false): void {
  if (typeof window === 'undefined') return
  if (replace) window.location.replace(url)
  else window.location.assign(url)
}

function dispatchPanelEvent(name: string, detail: Readonly<Record<string, unknown>>): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function focusComponent(componentId: string): void {
  if (typeof document === 'undefined') return
  const candidate = Array.from(document.querySelectorAll<HTMLElement>('[data-component-id]'))
    .find(element => element.dataset.componentId === componentId)
  candidate?.focus()
}

function downloadFile(url: string, filename?: string): void {
  if (typeof document === 'undefined') return
  const anchor = document.createElement('a')
  anchor.href = url
  if (filename) anchor.download = filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

function realtimeFrom(
  page: NuxtPanelPage,
  factory: PanelPageProps['notificationRealtime'],
): ClientNotificationRealtime | undefined {
  const configuration = page.bootstrap.manifest.databaseNotifications
  const channel = page.bootstrap.notifications?.realtimeChannel
  if (
    typeof window === 'undefined'
    || !configuration?.realtime
    || !factory
    || typeof channel !== 'string'
    || !REALTIME_CHANNEL.test(channel)
  ) return undefined
  return factory(channel)
}

export const PanelPage = defineComponent({
  name: 'PanelPage',
  props: {
    notificationRealtime: { type: Function as PropType<PanelPageProps['notificationRealtime']>, default: undefined },
    page: { type: Object as PropType<NuxtPanelPage>, required: true },
    registry: { type: Object as PropType<PanelPageProps['registry']>, default: undefined },
    resolveResource: { type: Function as PropType<PanelPageProps['resolveResource']>, default: undefined },
  },
  setup(props) {
    const ready = ref(false)
    const panelId = props.page.bootstrap.manifest.id
    const registry = props.registry ?? createNuxtPanelComponentRegistry()
    const TopbarComponent = props.page.bootstrap.manifest.components?.topbar
      ? registry.resolve(props.page.bootstrap.manifest.components.topbar, panelId, 'panel topbar')
      : null
    const SidebarComponent = props.page.bootstrap.manifest.components?.sidebar
      ? registry.resolve(props.page.bootstrap.manifest.components.sidebar, panelId, 'panel sidebar')
      : null
    const AvatarComponent = props.page.bootstrap.manifest.branding.avatarProvider
      ? registry.resolve(props.page.bootstrap.manifest.branding.avatarProvider, panelId, 'panel avatar provider')
      : null
    const transport = panelsTransport()
    const tenantShell = props.page.bootstrap.tenancy ? (() => {
      const store = new PanelShellStore(panelId)
      store.bootstrap(props.page.bootstrap, props.page.path)
      return { store, transport: createPanelTenantSwitcherTransport(transport, panelId) }
    })() : null
    const toastStore = new ClientToastStore()
    const viewportWidth = ref(1280)
    const mobileNavigation = ref(false)
    const navigationOpen = ref(false)
    const sidebarCollapsed = ref(false)
    const portalContainer = ref<HTMLElement | null>(null)
    const navigationId = `hp-panel-navigation-${panelId}`
    const navigationToggleId = `hp-panel-navigation-toggle-${panelId}`
    const dismissMobileNavigation = (): void => {
      navigationOpen.value = false
      window.queueMicrotask(() => window.document.getElementById(navigationToggleId)?.focus())
    }
    const colorMode = ref<PanelColorMode>(panelColorMode(props.page.bootstrap.manifest.theme.darkMode))
    const widgetStore = (widget: NuxtPanelPage['widgets']['header'][number]): WidgetStore => new WidgetStore(
      widget.manifest,
      async () => widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
      { initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status } },
    )
    const headerWidgets = props.page.widgets.header.map(widget => ({ manifest: widget.manifest as VueWidgetManifest, panelId, registry, store: widgetStore(widget) }))
    const footerWidgets = props.page.widgets.footer.map(widget => ({ manifest: widget.manifest as VueWidgetManifest, panelId, registry, store: widgetStore(widget) }))
    const searchConfiguration = props.page.bootstrap.manifest.globalSearchConfiguration
    const searchStore = props.page.bootstrap.manifest.globalSearch ? new GlobalSearchStore({
      async search(term, signal) {
        const response = await transport.execute({ kind: 'read', name: 'global-search' }, {
          endpoint: `/holo/panels/${encodeURIComponent(panelId)}/global-search`,
          panelId,
          payload: { term },
          signal,
        })
        if (!response.ok) throw new Error(response.error.message)
        return searchResponse(response.data, panelId, term)
      },
    }, {
      debounceMilliseconds: searchConfiguration?.debounce,
      keybindings: searchConfiguration?.keybindings,
    }) : null
    const searchState = ref(searchStore?.snapshot ?? null)
    let unsubscribeSearch: (() => void) | undefined
    let unregisterMobileQuery: (() => void) | undefined
    let unregisterResize: (() => void) | undefined
    let unregisterSearchShortcut: (() => void) | undefined
    let unregisterSpa: (() => void) | undefined
    const shellElement = ref<HTMLElement | null>(null)
    const effects = new ClientEffectSession({
      panelId,
      toastStore,
      closeModal: async effect => dispatchPanelEvent('holo-panels:close-modal', { panelId, ...(effect.id ? { id: effect.id } : {}) }),
      download: async effect => downloadFile(effect.url, effect.filename),
      focus: async effect => focusComponent(effect.componentId),
      invalidateTable: async effect => dispatchPanelEvent('holo-panels:invalidate-table', { panelId, tableId: effect.tableId }),
      redirect: async effect => browserNavigate(effect.url, effect.replace),
      refresh: async effect => dispatchPanelEvent('holo-panels:refresh', { panelId, target: effect.target ?? 'page' }),
    })
    watchEffect(() => {
      const container = portalContainer.value
      if (!container) return
      container.dataset.holoPanel = ''
      container.dataset.panel = panelId
      container.dataset.theme = colorMode.value
      container.dataset.density = props.page.bootstrap.manifest.theme.density
      container.removeAttribute('style')
      for (const [name, value] of Object.entries(panelConfigurationVariables(props.page.bootstrap.manifest))) {
        container.style.setProperty(name, value)
      }
    })
    onMounted(() => {
      const portal = window.document.createElement('div')
      portal.className = 'hp-panel-portal-host'
      const owner = shellElement.value ?? window.document.documentElement
      portal.dir = owner.closest<HTMLElement>('[dir="rtl"], [dir="ltr"]')?.dir
        ?? window.getComputedStyle(owner).direction
      window.document.body.append(portal)
      portalContainer.value = portal
      ready.value = true
      const storedColorMode = window.localStorage.getItem(`holo-panels:${panelId}:color-mode`)
      if (isPanelColorMode(storedColorMode)) colorMode.value = storedColorMode
      const updateWidth = (): void => { viewportWidth.value = window.innerWidth }
      updateWidth()
      window.addEventListener('resize', updateWidth)
      unregisterResize = () => window.removeEventListener('resize', updateWidth)
      const mobileQuery = window.matchMedia('(width <= 48rem)')
      const updateMobileNavigation = (): void => { mobileNavigation.value = mobileQuery.matches }
      updateMobileNavigation()
      mobileQuery.addEventListener('change', updateMobileNavigation)
      unregisterMobileQuery = () => mobileQuery.removeEventListener('change', updateMobileNavigation)
      const searchShortcut = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && mobileNavigation.value && navigationOpen.value) {
          event.preventDefault()
          dismissMobileNavigation()
          return
        }
        if (!searchStore?.shortcut(event.key, { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })) return
        event.preventDefault()
        window.document.querySelector<HTMLInputElement>('[data-panel-global-search]')?.focus()
      }
      window.addEventListener('keydown', searchShortcut)
      unregisterSearchShortcut = () => window.removeEventListener('keydown', searchShortcut)
      unsubscribeSearch = searchStore?.subscribe(state => { searchState.value = state })
      const runtime = props.page.bootstrap.manifest.runtime
      if (runtime?.spa && shellElement.value) {
        unregisterSpa = installPanelSpaNavigation(shellElement.value, {
          exceptions: runtime.spaUrlExceptions,
          navigate: url => {
            window.history.pushState({}, '', url)
            window.dispatchEvent(new PopStateEvent('popstate'))
          },
          prefetching: runtime.spaPrefetching ?? false,
        })
      }
      if (!props.page.effects?.length) return
      void effects.apply({
        data: null,
        effects: [...props.page.effects],
        id: 'session-effects',
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
      }).catch(() => undefined)
    })
    const configuration = props.page.bootstrap.manifest.databaseNotifications
    const NotificationTrigger = configuration?.component
      ? registry.resolve(configuration.component, panelId, 'database notification component')
      : VueNotificationInboxTrigger
    const realtime = realtimeFrom(props.page, props.notificationRealtime)
    const inboxStore = configuration
      ? new ClientNotificationInboxStore({
          polling: configuration.polling,
          ...(realtime ? { realtime } : {}),
          transport: createPanelNotificationTransport(transport, {
            endpoint: `/holo/panels/${encodeURIComponent(panelId)}/notification`,
            panelId,
          }),
        })
      : null
    let disposed = false
    onUnmounted(() => {
      if (disposed) return
      disposed = true
      unsubscribeSearch?.()
      unregisterMobileQuery?.()
      unregisterResize?.()
      unregisterSearchShortcut?.()
      unregisterSpa?.()
      portalContainer.value?.remove()
      portalContainer.value = null
      effects.dispose()
    })

    return (): VNode => {
      const { bootstrap, page } = props.page
      const account = actorLabel(bootstrap.actor)
      const avatarUrl = actorAvatarUrl(bootstrap.actor)
      const themeMenuItems = bootstrap.manifest.theme.switcher === false ? [] : [
        { id: 'panel-theme-light', label: `${colorMode.value === 'light' ? '✓ ' : ''}Light theme` },
        { id: 'panel-theme-dark', label: `${colorMode.value === 'dark' ? '✓ ' : ''}Dark theme` },
        { id: 'panel-theme-system', label: `${colorMode.value === 'system' ? '✓ ' : ''}System theme` },
      ]
      const userMenuItems = [
        ...themeMenuItems,
        ...(bootstrap.manifest.auth?.profile && !bootstrap.manifest.userMenu.some(item => item.id === 'profile') ? [{ icon: configuredIcon(bootstrap.manifest.icons, 'user'), id: 'profile', label: 'Profile' }] : []),
        ...bootstrap.manifest.userMenu.map(item => ({ icon: configuredIcon(bootstrap.manifest.icons, item.icon), id: item.id, label: item.label })),
        ...(bootstrap.manifest.auth?.logout ? [{ icon: configuredIcon(bootstrap.manifest.icons, 'log-out'), id: 'panel-logout', label: 'Sign out' }] : []),
      ]
      const notificationTrigger = inboxStore && configuration
        ? h(NotificationTrigger, {
            lazy: configuration.lazy ?? true,
            navigate: browserNavigate,
            panelId,
            placement: configuration.placement,
            registry,
            store: inboxStore,
          } satisfies VueNotificationInboxTriggerProps)
        : null
      const globalSearch = searchStore && searchState.value ? h('div', { class: 'hp-global-search hp-panel-topbar-center', 'data-slot': 'command', role: 'search' }, [
        h('label', [h('span', { class: 'hp-sr-only' }, 'Global search'), ShadcnIcon('search', 'hp-global-search-icon'), h(ShadcnInput, {
          'aria-controls': 'hp-global-search-results',
          'aria-expanded': searchState.value.open,
          'data-panel-global-search': '',
          onFocus: () => searchStore.open(),
          onInput: (event: Event) => searchStore.input((event.currentTarget as HTMLInputElement).value),
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') searchStore.move(event.key === 'ArrowDown' ? 1 : -1)
            else if (event.key === 'Enter') {
              const url = searchStore.selectedUrl()
              if (url) browserNavigate(url)
            } else if (event.key === 'Escape') searchStore.close()
          },
          placeholder: searchConfiguration?.fieldSuffix ?? 'Search…',
          role: 'combobox',
          value: searchState.value.term,
        }), searchConfiguration?.keybindingSuffix ? h('kbd', searchConfiguration.keybindingSuffix) : null]),
        searchState.value.loading ? h('span', { 'aria-live': 'polite', role: 'status' }, 'Searching…') : null,
        searchState.value.error ? h('span', { role: 'alert' }, searchState.value.error) : null,
        h('ul', { 'data-slot': 'command-list', id: 'hp-global-search-results', role: 'listbox' }, searchState.value.results.map((result, index) => h('li', { 'aria-selected': index === searchState.value?.selectedIndex, 'data-slot': 'command-item', key: `${result.resourceId}:${result.id}`, role: 'option' }, [h('a', { href: result.url }, result.title)]))),
      ]) : null
      const toggleNavigation = (): void => {
        if (mobileNavigation.value || bootstrap.manifest.navigationMode === 'topbar') {
          navigationOpen.value = !navigationOpen.value
          return
        }
        if (bootstrap.manifest.sidebarCollapsible) sidebarCollapsed.value = !sidebarCollapsed.value
      }
      return h(PanelsErrorBoundary, {}, {
        default: () => h(PanelsPortalProvider, { container: portalContainer.value }, {
          default: () => h('div', {
          'aria-busy': ready.value ? undefined : 'true',
          class: ['hp-panel', 'hp-panel-shell', `hp-panel--${bootstrap.manifest.navigationMode}`],
          'data-holo-panel': '',
          'data-panels-panel': bootstrap.manifest.id,
          'data-panels-ready': ready.value ? 'true' : 'false',
          'data-panels-theme': colorMode.value,
          'data-theme': colorMode.value,
          'data-density': bootstrap.manifest.theme.density,
          'data-navigation': bootstrap.manifest.navigationMode,
          'data-navigation-open': navigationOpen.value ? 'true' : 'false',
          'data-sidebar-collapsed': sidebarCollapsed.value ? 'true' : 'false',
          'data-sidebar-collapsible': bootstrap.manifest.sidebarCollapsible ? 'true' : 'false',
          'data-sidebar-fully-collapsible': bootstrap.manifest.layout?.sidebarFullyCollapsible ? 'true' : 'false',
          'data-slot': 'sidebar-wrapper',
          'data-width': bootstrap.manifest.layout?.maxContentWidth === 'full' ? 'full' : 'constrained',
          inert: ready.value ? undefined : '',
          ref: shellElement,
          style: panelConfigurationVariables(bootstrap.manifest),
        }, [
          ...bootstrap.manifest.assets?.map(asset => asset.type === 'css'
            ? h('link', { 'data-panel-asset': asset.id, href: asset.src, key: asset.id, rel: 'stylesheet' })
            : h('script', { 'data-panel-asset': asset.id, defer: true, key: asset.id, src: asset.src })) ?? [],
          bootstrap.manifest.layout?.topbar === false ? null : TopbarComponent ? h(TopbarComponent, {
            actor: props.page.bootstrap.actor,
            manifest: bootstrap.manifest,
            page,
          } satisfies PanelChromeComponentProps<typeof page>) : h('header', { class: 'hp-panel-header' }, [
            bootstrap.manifest.navigationEnabled === false ? null : h(ShadcnButton, { 'aria-controls': bootstrap.manifest.navigationMode === 'topbar' || !SidebarComponent ? navigationId : undefined, 'aria-expanded': mobileNavigation.value ? navigationOpen.value : !sidebarCollapsed.value, 'aria-label': 'Toggle navigation', class: 'hp-panel-navigation-toggle hp-panel-topbar-start-action', 'data-variant': 'ghost', id: navigationToggleId, onClick: toggleNavigation, type: 'button' }, () => ShadcnIcon('menu')),
            h(PanelsLink, { class: ['hp-panel-brand', 'hp-panel-topbar-start', bootstrap.manifest.navigationMode === 'sidebar' ? 'hp-panel-navigation-header' : null], href: bootstrap.manifest.routing?.homeUrl ?? bootstrap.manifest.path }, () => [bootstrap.manifest.branding.logo ? h('img', { alt: '', src: bootstrap.manifest.branding.logo }) : h('span', { 'aria-hidden': 'true', class: 'hp-panel-brand-mark' }, 'H'), h('strong', bootstrap.manifest.branding.name)]),
            bootstrap.manifest.navigationEnabled !== false && bootstrap.manifest.navigationMode === 'topbar' ? navigation(props.page, 'topbar', navigationOpen.value, navigationId, () => { navigationOpen.value = false }) : null,
            globalSearch,
            h('div', { class: 'hp-panel-header-actions hp-panel-topbar-end hp-panel-actions--compact' }, [
              tenantShell && bootstrap.manifest.tenancy?.switcher !== false ? h('div', { class: 'hp-panel-tenant-action hp-panel-action--compact' }, [h(VueTenantSwitcher, { shell: { onSwitched: () => window.location.reload(), ...tenantShell } })]) : null,
              configuration?.placement === 'topbar' ? h('div', { class: 'hp-panel-notification-action hp-panel-action--compact' }, [notificationTrigger]) : null,
              bootstrap.manifest.userMenuEnabled === false ? null : h('div', { class: 'hp-panel-user-trigger hp-panel-user-action hp-panel-action--compact' }, [
                AvatarComponent
                  ? h(AvatarComponent, { actor: props.page.bootstrap.actor, label: account } satisfies PanelAvatarComponentProps)
                  : avatarUrl
                    ? h(PanelsAvatar, { alt: account, src: avatarUrl })
                    : h('span', { 'aria-hidden': 'true', class: 'hp-avatar hp-panel-user-avatar hp-panel-user-glyph', 'data-slot': 'avatar-fallback' }, [ShadcnIcon('user')]),
                h(PanelsDropdown, { ariaLabel: 'Account menu', items: userMenuItems, label: account, onSelect: (id: string) => {
                  const mode = id.replace('panel-theme-', '')
                  if (isPanelColorMode(mode)) {
                    colorMode.value = mode
                    window.localStorage.setItem(`holo-panels:${panelId}:color-mode`, mode)
                    return
                  }
                  if (id === 'profile' && bootstrap.manifest.auth?.profile && !bootstrap.manifest.userMenu.some(item => item.id === 'profile')) {
                    browserNavigate(bootstrap.manifest.auth.profile.path)
                    return
                  }
                  if (id === 'panel-logout') {
                    void executePanelAuthRequest({ csrfToken: '', operation: 'logout', panelId, payload: {} }).then(result => {
                      if (result.ok) window.location.assign(result.url ?? bootstrap.manifest.auth?.login?.path ?? bootstrap.manifest.path)
                    })
                    return
                  }
                  const item = bootstrap.manifest.userMenu.find(candidate => candidate.id === id)
                  if (item) browserNavigate(item.path)
                } }),
              ]),
            ]),
          ]),
          bootstrap.manifest.navigationEnabled !== false && bootstrap.manifest.navigationMode === 'sidebar'
            ? [
                h('button', { 'aria-hidden': !mobileNavigation.value || !navigationOpen.value ? 'true' : undefined, 'aria-label': 'Close navigation', class: 'hp-panel-navigation-backdrop', 'data-open': navigationOpen.value ? 'true' : 'false', 'data-slot': 'navigation-backdrop', hidden: !mobileNavigation.value || !navigationOpen.value, onClick: dismissMobileNavigation, tabindex: -1, type: 'button' }),
                SidebarComponent
                  ? h(SidebarComponent, { actor: props.page.bootstrap.actor, manifest: bootstrap.manifest, page } satisfies PanelChromeComponentProps<typeof page>)
                  : h('aside', { 'aria-hidden': mobileNavigation.value && !navigationOpen.value ? 'true' : undefined, class: 'hp-panel-sidebar', 'data-open': navigationOpen.value ? 'true' : 'false', 'data-slot': 'sidebar', inert: mobileNavigation.value && !navigationOpen.value ? '' : undefined }, [
                      navigation(props.page, 'sidebar', navigationOpen.value, navigationId, () => { navigationOpen.value = false }),
                      configuration?.placement === 'sidebar' ? h('div', { class: 'hp-panel-navigation-footer hp-panel-actions--compact' }, [h('div', { class: 'hp-panel-notification-action hp-panel-action--compact' }, [notificationTrigger])]) : null,
                    ]),
                SidebarComponent && configuration?.placement === 'sidebar' ? h('div', { class: 'hp-panel-navigation-footer hp-panel-actions--compact' }, [h('div', { class: 'hp-panel-notification-action hp-panel-action--compact' }, [notificationTrigger])]) : null,
              ]
            : null,
          h('main', { class: 'hp-panel-content', 'data-slot': 'sidebar-inset' }, [
            bootstrap.manifest.layout?.breadcrumbs === false ? null : h('nav', { 'aria-label': 'Breadcrumbs', class: 'hp-panel-breadcrumbs' }, [h('ol', page.breadcrumbs.map((item, index) => h('li', { key: `${item.path}:${index}` }, [h(PanelsLink, { href: item.path }, () => item.label)])))]),
            h('header', { class: 'hp-panel-page-header hp-panel-main-header' }, [h('div', [h('h1', page.heading ?? page.title), page.subheading ? h('p', page.subheading) : null])]),
            h('div', { class: 'hp-panel-main-body' }, [
              headerWidgets.length > 0 ? h(VueDashboardRenderer, { dashboard: { dashboardId: `${page.manifest.id}-header`, label: 'Page header widgets', viewportWidth: viewportWidth.value, widgets: headerWidgets } }) : null,
              pageBody(props.page, registry, props.resolveResource, { effects, transport }),
              footerWidgets.length > 0 ? h(VueDashboardRenderer, { dashboard: { dashboardId: `${page.manifest.id}-footer`, label: 'Page footer widgets', viewportWidth: viewportWidth.value, widgets: footerWidgets } }) : null,
            ]),
          ]),
          h(VueToastViewport, { navigate: browserNavigate, store: toastStore }),
        ]),
        }),
        fallback: () => h('section', { role: 'alert', 'data-panels-error': '500' }, [h('h1', 'Panel unavailable')]),
      })
    }
  },
})
