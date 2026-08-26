'use client'

import {
  ClientActionStore,
  CollectionStore,
  createBrowserUploadAdapter,
  createUploadStore,
  type ClientEffectSession,
  FormStore,
  OptionStore,
  PanelsTransport,
  PanelsPageActions,
  PanelsRenderHook,
  ReactActionRenderer,
  ReactEntryRenderer,
  ReactFieldRenderer,
  ReactRelationManagerRenderer,
  ReactPanelsRenderHook,
  ReactTableRenderer,
  TableStateStore,
  createDefaultComponentRegistry,
  registerReactFieldRenderers,
  useFormStore,
  type ClientActionManifest,
  type ComponentRegistry,
  type JsonObject,
  type JsonValue,
  type PanelShellBootstrap,
  type ReactCompiledField,
  type ReactEntrySnapshot,
  type ReactEntryStore,
  type ReactRelationManagerRendererProps,
  type ReactTableActionGroup,
  type ReactTableActionItem,
  type ReactTableColumn,
  type ReactTableFilter,
  type ReactTableGroup,
  type ReactTableRendererProps,
  type ReactTableSummary,
  type UploadPolicy,
} from '@holo-js/panels-react'
import { useRouter } from 'next/navigation.js'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Card, CardContent, CardFooter, PanelsIcon } from './internal-ui'

export interface NextResourceOperationResult {
  readonly data?: JsonObject
  readonly error?: string
  readonly ok: boolean
}

export interface NextResourceOperationTransport {
  execute(operation: 'action' | 'form-submit' | 'options' | 'table-data', payload: JsonObject): Promise<NextResourceOperationResult>
}

type ResourceValues = Record<string, JsonValue>

interface ClientResolverContext {
  readonly input: JsonObject
  readonly values: Readonly<ResourceValues>
}

type ClientResolver = (context: ClientResolverContext) => JsonValue

const clientResolvers = new Map<string, ClientResolver>([
  ['clear', () => ''],
  ['slug', ({ input, values }) => slug(text(values[text(input.source)]))],
])

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function object(value: JsonValue | undefined): JsonObject {
  return isObject(value) ? value : {}
}

function objects(value: JsonValue | undefined): readonly JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : []
}

function relationFields(value: JsonValue | undefined): NonNullable<ReactRelationManagerRendererProps['managers'][number]['fields']> {
  return objects(value).flatMap((field) => {
    const id = text(field.id)
    const type = text(field.type)
    if (!id || !['date-time', 'number', 'text', 'textarea', 'toggle'].includes(type)) return []
    return [{ id, label: text(field.label) || id, required: field.required === true, type: type as 'date-time' | 'number' | 'text' | 'textarea' | 'toggle' }]
  })
}

function relationManagers(value: JsonValue | undefined): ReactRelationManagerRendererProps['managers'] {
  return objects(value).flatMap((manager) => {
    const id = text(manager.id)
    const presentation = text(manager.presentation)
    if (!id || !['groupedTabs', 'inline', 'page', 'tabs'].includes(presentation)) return []
    const records = objects(manager.records).flatMap((record) => {
      const recordId = record.id
      return (typeof recordId === 'number' || typeof recordId === 'string') && isObject(record.values)
        ? [{ id: recordId, values: record.values }]
        : []
    })
    return [{
      badge: typeof manager.badge === 'number' || typeof manager.badge === 'string' ? manager.badge : null,
      columns: objects(manager.columns).flatMap(column => text(column.key) ? [{ key: text(column.key), label: text(column.label) || text(column.key) }] : []),
      fields: relationFields(manager.fields),
      group: typeof manager.group === 'string' ? manager.group : null,
      id,
      label: text(manager.label) || id,
      operations: Array.isArray(manager.operations) ? manager.operations.filter(operation => typeof operation === 'string') as ReactRelationManagerRendererProps['managers'][number]['operations'] : [],
      presentation: presentation as ReactRelationManagerRendererProps['managers'][number]['presentation'],
      pivotFields: relationFields(manager.pivotFields),
      records,
      url: typeof manager.url === 'string' ? manager.url : null,
      visible: manager.visible !== false,
    }]
  })
}

function recordsFrom(data: JsonObject): JsonObject[] {
  return Array.isArray(data.records) ? data.records.filter(isObject) : []
}

function valueAtPath(record: JsonObject, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = record
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = current[segment]
  }
  return current
}

function setValueAtPath(target: ResourceValues, path: string, value: JsonValue): void {
  const segments = path.split('.')
  let current = target
  for (const segment of segments.slice(0, -1)) {
    const child = current[segment]
    const nested = child && typeof child === 'object' && !Array.isArray(child) ? { ...child } : {}
    current[segment] = nested
    current = nested
  }
  const final = segments.at(-1)
  if (final) current[final] = value
}

function collectionValues(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function isSchemaComponent(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const component = value as Record<string, unknown>
  return typeof component.id === 'string'
    && typeof component.key === 'string'
    && ['callout', 'custom', 'empty-state', 'fieldset', 'grid', 'group', 'section', 'split', 'step', 'tab', 'tabs', 'wizard'].includes(text(component.kind))
    && typeof component.type === 'string'
    && typeof component.visible === 'boolean'
    && typeof component.dynamicVisibility === 'boolean'
    && Array.isArray(component.children)
    && component.children.every(isSchemaComponent)
    && !!component.layout && typeof component.layout === 'object' && !Array.isArray(component.layout)
    && !!component.extraAttributes && typeof component.extraAttributes === 'object' && !Array.isArray(component.extraAttributes)
    && !!component.slots && typeof component.slots === 'object' && !Array.isArray(component.slots)
    && !!component.properties && typeof component.properties === 'object' && !Array.isArray(component.properties)
}

function isRenderSlot(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const slot = value as Record<string, unknown>
  return typeof slot.component === 'string'
    && (typeof slot.order === 'undefined' || typeof slot.order === 'number')
    && (typeof slot.properties === 'undefined' || (!!slot.properties && typeof slot.properties === 'object' && !Array.isArray(slot.properties)))
}

function isActionModal(value: unknown): value is NonNullable<ClientActionManifest['modal']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const modal = value as Record<string, unknown>
  const schema = modal.schema
  const schemaRecord = schema && typeof schema === 'object' && !Array.isArray(schema) ? schema as Record<string, unknown> : null
  const validSchema = schema === null || (
    schemaRecord?.kind === 'schema'
    && typeof schemaRecord.id === 'string'
    && Array.isArray(schemaRecord.components)
    && schemaRecord.components.every(isSchemaComponent)
  )
  return (modal.content === null || isRenderSlot(modal.content))
    && (modal.description === null || typeof modal.description === 'string')
    && (modal.footer === null || isRenderSlot(modal.footer))
    && (modal.heading === null || typeof modal.heading === 'string')
    && Array.isArray(modal.nestedActions)
    && modal.nestedActions.every(item => typeof item === 'string')
    && validSchema
    && typeof modal.slideOver === 'boolean'
    && ['small', 'medium', 'large', 'extra-large', 'screen'].includes(text(modal.width))
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

function strings(value: JsonValue | undefined): readonly string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

function optionValue(value: JsonValue | undefined): string | readonly string[] | null {
  if (typeof value === 'string') return value ? value : null
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    const selected = value.filter(item => item.length > 0)
    return selected.length > 0 ? selected : null
  }
  return null
}

function propertyPath(value: string): string {
  if (!/^[a-z][A-Za-z0-9_]*(?:\.[a-z][A-Za-z0-9_]*)*$/u.test(value)) throw new Error(`[Holo Panels] Invalid resource property path "${value}".`)
  return value
}

function humanizePath(path: string): string {
  return path
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/^\w/u, character => character.toUpperCase())
}

function resourcePath(panelPath: string, resource: JsonObject): string {
  const resourceSlug = text(resource.slug)
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(resourceSlug)) throw new Error('[Holo Panels] Resource pages require a stable resource slug.')
  const panelBase = panelPath === '/' ? '' : panelPath.replace(/\/$/u, '')
  return `${panelBase}/${encodeURIComponent(resourceSlug)}`
}

function browserTransport(panelId: string, effects?: ClientEffectSession): NextResourceOperationTransport {
  const transport = new PanelsTransport({
    adapter: {
      async send(request) {
        const response = await fetch(request.url, request)
        return { body: await response.json() as unknown, status: response.status }
      },
    },
  })
  return {
    async execute(operation, payload) {
      const descriptor = operation === 'table-data'
        ? { kind: 'read' as const, name: operation }
        : { kind: 'mutation' as const, name: operation, supportsIdempotency: true }
      const response = await transport.execute(descriptor, {
        endpoint: `/holo/panels/${encodeURIComponent(panelId)}/${operation}`,
        panelId,
        payload,
      })
      await effects?.apply(response)
      return response.ok ? { data: object(response.data), ok: true } : { error: response.error.message, ok: false }
    },
  }
}

function configuredRoute(resource: JsonObject, name: 'create' | 'edit' | 'view', recordId?: string | number): string | null {
  const value = object(resource.routes)[name]
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  return typeof recordId === 'number' || typeof recordId === 'string'
    ? value.replace(':record', encodeURIComponent(String(recordId)))
    : value
}

function tableColumn(definition: JsonObject, resource: JsonObject, routeKey: string, recordLink: string): ReactTableColumn<JsonObject> {
  const path = propertyPath(text(definition.path))
  return {
    manifest: {
      alignment: definition.alignment === 'center' || definition.alignment === 'end' ? definition.alignment : 'start',
      copyable: boolean(definition.copyable, false),
      formatters: objects(definition.formatters),
      hidden: boolean(definition.hidden, false),
      inlineEditor: isObject(definition.inlineEditor) ? definition.inlineEditor : null,
      label: typeof definition.label === 'string' ? definition.label : null,
      lineClamp: typeof definition.lineClamp === 'number' ? definition.lineClamp : null,
      path,
      searchable: boolean(definition.searchable, false),
      sortable: boolean(definition.sortable, true),
      toggleable: boolean(definition.toggleable, true),
      type: text(definition.type) || 'text',
      width: typeof definition.width === 'string' || typeof definition.width === 'number' ? definition.width : null,
      wrap: boolean(definition.wrap, true),
    },
    ...(path === recordLink && configuredRoute(resource, 'view') ? { url: (record: Readonly<JsonObject>) => configuredRoute(resource, 'view', text(record[routeKey])) } : {}),
  }
}

function tableAction(action: JsonObject, resource: JsonObject): ReactTableActionItem | null {
  const id = text(action.id)
  const scope = action.scope
  if (!id || (scope !== 'bulk' && scope !== 'header' && scope !== 'row')) return null
  if (action.kind === 'action-group') {
    const actions = objects(action.actions).flatMap(item => {
      const parsed = tableAction(item, resource)
      return parsed && !('kind' in parsed) ? [parsed] : []
    })
    if (actions.length === 0) return null
    return {
      actions,
      color: typeof action.color === 'string' ? action.color : null,
      icon: typeof action.icon === 'string' ? action.icon : null,
      id,
      kind: 'action-group',
      label: typeof action.label === 'string' ? action.label : null,
      scope,
    } satisfies ReactTableActionGroup
  }
  const label = text(action.label)
  if (!label) return null
  const kind = text(action.kind)
  const route = kind === 'view' || kind === 'edit' ? configuredRoute(resource, kind) : null
  return {
    color: typeof action.color === 'string' ? action.color : null,
    confirmation: typeof action.confirmation === 'string' ? action.confirmation : undefined,
    icon: typeof action.icon === 'string' ? action.icon : null,
    id,
    label,
    scope,
    ...(scope === 'row' && route
      ? { url: (recordId: string | number) => route.replace(':record', encodeURIComponent(String(recordId))) }
      : {}),
  }
}

function tableActions(table: JsonObject, resource: JsonObject): readonly ReactTableActionItem[] {
  return objects(table.actions).flatMap((action) => {
    const parsed = tableAction(action, resource)
    return parsed ? [parsed] : []
  })
}

function executableTableActions(actions: readonly JsonObject[]): readonly JsonObject[] {
  return actions.flatMap(action => action.kind === 'action-group'
    ? executableTableActions(objects(action.actions))
    : [action])
}

function tableFilters(table: JsonObject): readonly ReactTableFilter[] {
  return objects(table.filters).flatMap((filter) => {
    const id = text(filter.id)
    const type = text(filter.type)
    if (!id || !type) return []
    const properties = object(filter.properties)
    const options = objects(properties.options).flatMap((option) => {
      const value = option.value
      return typeof option.label === 'string' && (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string')
        ? [{ disabled: option.disabled === true, label: option.label, value }]
        : []
    })
    return [{
      manifest: {
        defaultValue: typeof filter.defaultValue === 'undefined' ? null : filter.defaultValue,
        id,
        label: typeof filter.label === 'string' ? filter.label : null,
        properties,
        type,
      },
      ...(options.length > 0 ? { options } : {}),
    }]
  })
}

function summaryValue(value: JsonValue | undefined): ReactNode {
  return value && typeof value === 'object' ? JSON.stringify(value) : value ?? ''
}

function tableSummaries(value: JsonValue | undefined): readonly ReactTableSummary[] {
  return objects(value).flatMap((summary) => {
    const id = text(summary.id)
    const label = text(summary.label)
    return id && label ? [{ id, label, value: summaryValue(summary.value) }] : []
  })
}

function tableGroups(value: JsonValue | undefined): readonly ReactTableGroup<JsonObject>[] {
  return objects(value).flatMap((group) => {
    const key = text(group.key)
    const title = text(group.title)
    if (!key || !title) return []
    return [{
      collapsed: boolean(group.collapsed, false),
      collapsible: boolean(group.collapsible, false),
      description: typeof group.description === 'string' ? group.description : null,
      key,
      records: objects(group.records),
      summaries: tableSummaries(group.summaries),
      title,
    }]
  })
}

function ResourceList({ data, operation, panelId, panelManifest, registry, renderHookScopes, resource }: {
  readonly data: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly panelManifest: Pick<PanelShellBootstrap['manifest'], 'id' | 'slots'>
  readonly registry: ComponentRegistry
  readonly renderHookScopes: readonly string[]
  readonly resource: JsonObject
}): ReactNode {
  const records = useMemo(() => recordsFrom(data), [data])
  const table = object(resource.table)
  const routeKey = propertyPath(text(resource.routeKey))
  const columnDefinitions = useMemo(() => objects(table.columns), [table])
  const configuredRecordLink = text(table.recordLink)
  const recordLink = columnDefinitions.some(definition => definition.path === configuredRecordLink)
    ? configuredRecordLink
    : propertyPath(text(resource.recordTitle))
  const columns = useMemo(() => columnDefinitions.map(definition => tableColumn(definition, resource, routeKey, recordLink)), [columnDefinitions, recordLink, resource, routeKey])
  const actions = useMemo(() => tableActions(table, resource), [resource, table])
  const filters = useMemo(() => tableFilters(table), [table])
  const actionDefinitions = useMemo(() => new Map(executableTableActions(objects(table.actions)).map(action => [text(action.id), action])), [table])
  const [groups, setGroups] = useState(() => tableGroups(data.groups))
  const [summaries, setSummaries] = useState(() => tableSummaries(data.summaries))
  const resourceId = text(resource.id)
  const labels = object(resource.labels)
  const filterPresentation = useMemo<ReactTableRendererProps<JsonObject, string>['filterPresentation']>(() => ({
    columns: Object.freeze({ default: 2 }),
    id: `${resourceId}-filters`,
    placement: 'dropdown',
    schema: Object.freeze({ components: Object.freeze([]), id: `${resourceId}-filters`, kind: 'schema' }),
    slots: Object.freeze({}),
  }), [resourceId])
  const store = useMemo(() => new TableStateStore<JsonObject, string>({
    filterMode: table.filterMode === 'deferred' ? 'deferred' : 'live',
    panelId,
    records,
    tableId: resourceId,
    total: typeof data.total === 'number' ? data.total : records.length,
    visibleColumns: columns.filter(item => !item.manifest.hidden).map(item => item.manifest.path),
  }), [columns, data.total, panelId, records, resourceId, table.filterMode])
  const refresh = (): void => {
    const query = store.query
    void operation.execute('table-data', {
      filters: query.filters,
      page: query.page,
      perPage: query.perPage,
      resourceId,
      search: query.search,
      sort: query.sort.map(item => ({ ...item })),
    }).then((result) => {
      if (!result.ok || !result.data) {
        store.applyError(query.queryVersion, { code: 'table-data-failed', message: result.error ?? 'Unable to load table data.' })
        return
      }
      const nextRecords = recordsFrom(result.data)
      const total = typeof result.data.total === 'number' ? result.data.total : nextRecords.length
      setGroups(tableGroups(result.data.groups))
      setSummaries(tableSummaries(result.data.summaries))
      store.applyData({ queryVersion: query.queryVersion, records: nextRecords, total })
    }).catch(() => store.applyError(query.queryVersion, { code: 'table-data-failed', message: 'Unable to load table data.' }))
  }
  const createAction = objects(resource.actions).find(action => action.kind === 'create' && action.visible !== false)
  const createRoute = configuredRoute(resource, 'create')
  return <div className="hp-resource-page">{createAction && createRoute ? <PanelsPageActions><Button asChild className="hp-action-trigger"><a data-action-id={text(createAction.id)} data-color={text(createAction.color) || undefined} href={createRoute}>{typeof createAction.icon === 'string' ? <PanelsIcon name={createAction.icon} /> : null}<span>{text(createAction.label) || text(labels.create) || 'Create'}</span></a></Button></PanelsPageActions> : null}<ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /><ReactTableRenderer
    actions={actions}
    actionTransport={{
      async execute(request) {
        const manifest = actionDefinitions.get(request.actionId)
        if (!manifest) throw new Error('The requested action is not available.')
        const recordIds = request.selection?.mode === 'explicit'
          ? request.selection.recordIds
          : typeof request.recordId === 'number' || typeof request.recordId === 'string' ? [request.recordId] : []
        const result = await operation.execute('action', { actionId: request.actionId, idempotencyKey: globalThis.crypto.randomUUID(), intent: text(manifest.kind) || request.actionId, recordIds: [...recordIds], resourceId })
        if (!result.ok) throw new Error(result.error ?? 'The action could not be completed.')
        if (result.data?.status === 'partial') throw new Error('One or more records could not be updated.')
        if ((manifest.removesRecord === true || manifest.kind === 'delete' || manifest.kind === 'force-delete') && request.recordId !== undefined) {
          const remaining = store.snapshot.records.filter(record => text(record[routeKey]) !== String(request.recordId))
          setGroups(current => current.map(group => ({
            ...group,
            records: group.records.filter(record => text(record[routeKey]) !== String(request.recordId)),
          })).filter(group => group.records.length > 0))
          store.applyData({ queryVersion: store.query.queryVersion, records: remaining, total: Math.max(0, store.snapshot.total - 1) })
        }
      },
    }}
    caption={text(labels.plural) || resourceId}
    columns={columns}
    filterPresentation={filterPresentation}
    filters={filters}
    getRecordId={record => text(record[routeKey])}
    groups={groups.length > 0 ? groups : undefined}
    onQueryChange={refresh}
    store={store}
    summaries={summaries}
  /><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /></div>
}

function fieldDefinition(definition: JsonObject): ReactCompiledField<ResourceValues> {
  const path = propertyPath(text(definition.path))
  return {
    disabled: boolean(definition.disabled, false),
    helperText: typeof definition.helperText === 'string' ? definition.helperText : null,
    hint: typeof definition.hint === 'string' ? definition.hint : null,
    label: typeof definition.label === 'string' && definition.label.trim() ? definition.label : humanizePath(path),
    path,
    placeholder: typeof definition.placeholder === 'string' ? definition.placeholder : null,
    properties: object(definition.properties),
    readOnly: boolean(definition.readOnly, false),
    required: boolean(definition.required, false),
    type: text(definition.type),
    visible: boolean(definition.visible, true),
  }
}

function dependencyDefinitions(form: JsonObject) {
  return objects(form.dependencies).flatMap((dependency) => {
    const id = text(dependency.id)
    const paths = strings(dependency.paths)
    const patches = objects(dependency.patches)
    if (!id || paths.length === 0 || patches.length === 0) return []
    return [{
      id,
      paths,
      recompute: (context: { readonly get: (path: string) => JsonValue, readonly touchedPaths: ReadonlySet<string> }) => patches.flatMap((patch) => {
        const path = text(patch.path)
        const resolver = object(patch.resolver)
        const resolve = clientResolvers.get(text(resolver.name))
        if (!path || !resolve || context.touchedPaths.has(path)) return []
        const values = Object.fromEntries(paths.map(source => [source, context.get(source)]))
        return [{ kind: 'set' as const, path, value: resolve({ input: object(resolver.input), values }) }]
      }),
    }]
  })
}

function dependentOptions(properties: JsonObject, values: Readonly<ResourceValues>): { readonly dependency: string, readonly options: readonly JsonObject[] } | null {
  const source = object(properties.optionSource)
  if (source.kind !== 'dependent-map') return null
  const dependency = text(source.dependency)
  const mapped = object(source.options)
  const selected = text(valueAtPath(values, dependency))
  return { dependency, options: objects(mapped[selected]) }
}

function staticOptions(properties: JsonObject): readonly { readonly disabled: boolean, readonly label: string, readonly value: number | string }[] {
  return objects(properties.options).flatMap((option) => {
    const value = option.value
    if (typeof value !== 'string' && typeof value !== 'number') return []
    return [{ disabled: option.disabled === true, label: text(option.label) || String(value), value }]
  })
}

function ResourceField({ definition, form, operation, pageOperation, panelId, recordId, registry, resourceId, values }: {
  readonly definition: ReactCompiledField<ResourceValues>
  readonly form: FormStore<ResourceValues>
  readonly operation: NextResourceOperationTransport
  readonly pageOperation: string
  readonly panelId: string
  readonly recordId: JsonValue | undefined
  readonly registry: ComponentRegistry
  readonly resourceId: string
  readonly values: Readonly<ResourceValues>
}): ReactNode {
  const dynamic = dependentOptions(definition.properties as JsonObject, values)
  const inlineOptions = useMemo(() => staticOptions(definition.properties as JsonObject), [definition.properties])
  const sourceKind = text(Reflect.get(definition.properties, 'optionSource'))
  const serverOptions = !!sourceKind && sourceKind !== 'static'
  const collection = ['builder', 'key-value', 'repeater'].includes(definition.type)
  const collectionStore = useMemo(() => collection ? new CollectionStore(collectionValues(valueAtPath(values, definition.path)), 'resource-item') : undefined, [collection, definition.path, values])
  const uploadPolicy = definition.type === 'panels:field:upload' ? Reflect.get(definition.properties, 'uploadPolicy') as UploadPolicy | undefined : undefined
  const uploadStore = useMemo(() => uploadPolicy ? createUploadStore({
    adapter: createBrowserUploadAdapter({
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/upload`,
      fieldId: definition.path,
      intent: pageOperation === 'edit' ? 'edit' : 'create',
      panelId,
      recordId: typeof recordId === 'string' || typeof recordId === 'number' ? recordId : null,
      resourceId,
    }),
    context: { actorId: 'current', fieldId: definition.path, panelId, resourceId },
    policy: uploadPolicy,
  }) : undefined, [definition.path, pageOperation, panelId, recordId, resourceId, uploadPolicy])
  useEffect(() => uploadStore?.subscribe((snapshot) => {
    const stored = snapshot.items.filter(item => item.status === 'stored' && item.sessionId && item.token).map(item => ({ id: item.id, sessionId: item.sessionId!, token: item.token! }))
    form.set(definition.path, (uploadPolicy?.maximumFiles === 1 ? stored[0] ?? '' : stored) as JsonValue)
  }), [definition.path, form, uploadPolicy?.maximumFiles, uploadStore])
  const optionStore = useMemo(() => dynamic || inlineOptions.length > 0 || serverOptions ? new OptionStore<string | number>({
    dependencies: dynamic ? { [dynamic.dependency]: valueAtPath(values, dynamic.dependency) ?? null } : {},
    fieldId: definition.path,
    locale: 'en',
    panelId,
    requiredDependencies: dynamic ? [dynamic.dependency] : [],
    resourceId,
    tenantKey: 'current',
    transport: {
      async hydrateSelected(_request, selected) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'hydrate', dependencies: { ..._request.dependencies }, fieldId: definition.path, resourceId, selectedValues: [...selected], values: { ...values } })
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to hydrate options.')
          return staticOptions({ options: result.data.options ?? [] })
        }
        return selected.flatMap(value => typeof value === 'string' && value.length > 0 ? [{ label: value, value }] : [])
      },
      async list(request) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'list', dependencies: { ...request.dependencies }, fieldId: definition.path, page: request.page, perPage: request.perPage, resourceId, search: request.search, values: { ...values } })
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to load options.')
          const available = staticOptions({ options: result.data.options ?? [] })
          return { hasMore: result.data.hasMore === true, options: available, page: request.page, perPage: request.perPage, total: typeof result.data.total === 'number' ? result.data.total : available.length }
        }
        const available = dynamic
          ? (dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []).map(item => ({ disabled: item.disabled === true, label: text(item.label) || text(item.value), value: text(item.value) }))
          : inlineOptions
        return { hasMore: false, options: available, page: 1, perPage: request.perPage }
      },
      async validateSelection(request, selected) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'validate', dependencies: { ...request.dependencies }, fieldId: definition.path, resourceId, selectedValues: [...selected], values: { ...values } })
          return result.ok && result.data?.valid === true
        }
        const available = new Set(dynamic
          ? (dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []).map(item => text(item.value))
          : inlineOptions.map(item => item.value))
        return selected.every(value => available.has(value))
      },
      ...(serverOptions && Reflect.get(definition.properties, 'canCreateOption') === true ? {
        async create(request, label) {
          const result = await operation.execute('options', { action: 'create', dependencies: { ...request.dependencies }, fieldId: definition.path, label, resourceId, values: { ...values } })
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to create option.')
          const option = staticOptions({ options: [result.data.option ?? null] })[0]
          if (!option) throw new Error('The created option response is invalid.')
          return option
        },
      } : {}),
      ...(serverOptions && Reflect.get(definition.properties, 'canEditOption') === true ? {
        async edit(request, value, label) {
          const result = await operation.execute('options', { action: 'edit', dependencies: { ...request.dependencies }, fieldId: definition.path, label, resourceId, value, values: { ...values } })
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to edit option.')
          const option = staticOptions({ options: [result.data.option ?? null] })[0]
          if (!option) throw new Error('The edited option response is invalid.')
          return option
        },
      } : {}),
    },
  }) : undefined, [definition.path, dynamic, inlineOptions, operation, panelId, resourceId, serverOptions, values])
  useEffect(() => {
    if (!dynamic || !optionStore) return
    void optionStore.updateDependencies({ [dynamic.dependency]: values[dynamic.dependency] ?? null }, optionValue(values[definition.path])).then(async result => {
      if (result.status === 'cleared' && values[definition.path] !== '') form.set(definition.path, '')
      if (values[dynamic.dependency] !== null && typeof values[dynamic.dependency] !== 'undefined' && values[dynamic.dependency] !== '') await optionStore.preload()
    })
  }, [definition.path, dynamic, form, optionStore, values])
  return <ReactFieldRenderer
    collectionStore={collectionStore}
    createCollectionItem={definition.type === 'builder' ? blockType => ({ data: {}, type: blockType ?? '' }) : definition.type === 'repeater' ? () => ({}) : undefined}
    definition={definition}
    optionStore={optionStore}
    panelId={panelId}
    registry={registry}
    store={form}
    uploadStore={uploadStore}
  />
}

function ResourceForm({ basePath, createRedirect, data, editRedirect, operation, pageOperation, panelId, panelManifest, registry, renderHookScopes, resource, unsavedChangesAlerts }: {
  readonly basePath: string
  readonly createRedirect: 'edit' | 'index' | 'view'
  readonly data: JsonObject
  readonly editRedirect: 'index' | 'view' | null
  readonly operation: NextResourceOperationTransport
  readonly pageOperation: string
  readonly panelId: string
  readonly panelManifest: Pick<PanelShellBootstrap['manifest'], 'id' | 'slots'>
  readonly registry: ComponentRegistry
  readonly renderHookScopes: readonly string[]
  readonly resource: JsonObject
  readonly unsavedChangesAlerts: boolean
}): ReactNode {
  const router = useRouter()
  const record = useMemo(() => object(data.record), [data])
  const formManifest = object(resource.form)
  const fields = useMemo(() => objects(formManifest.fields).map(fieldDefinition), [formManifest])
  const initialValues = useMemo(() => {
    const values: ResourceValues = {}
    for (const field of fields) {
      const configured = object(objects(formManifest.fields).find(item => item.path === field.path)?.properties).defaultValue
      setValueAtPath(values, field.path, valueAtPath(record, field.path) ?? configured ?? '')
    }
    return values
  }, [fields, formManifest, record])
  const form = useMemo(() => new FormStore<ResourceValues>(initialValues, { dependencies: dependencyDefinitions(formManifest) }), [formManifest, initialValues])
  const state = useFormStore<ResourceValues>(form)
  useEffect(() => {
    if (!unsavedChangesAlerts || state.dirtyPaths.length === 0) return
    const preventUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    globalThis.addEventListener('beforeunload', preventUnload)
    return () => globalThis.removeEventListener('beforeunload', preventUnload)
  }, [state.dirtyPaths.length, unsavedChangesAlerts])
  const [saved, setSaved] = useState(false)
  const labels = object(resource.labels)
  const resourceId = text(resource.id)
  const routeKey = propertyPath(text(resource.routeKey))
  const [relations, setRelations] = useState(() => relationManagers(data.relations))
  useEffect(() => setRelations(relationManagers(data.relations)), [data.relations])
  const loadRelationOptions: NonNullable<ReactRelationManagerRendererProps['loadOptions']> = async (managerId, search) => {
    const result = await operation.execute('options', {
      ownerId: record[routeKey] ?? null,
      relationManagerId: managerId,
      resourceId,
      search,
    })
    if (!result.ok) throw new Error(result.error ?? 'Related records could not be loaded.')
    return objects(result.data?.options).flatMap(option => {
      const value = option.value
      const optionLabel = text(option.label)
      return (typeof value === 'number' || typeof value === 'string') && optionLabel ? [{ label: optionLabel, value }] : []
    })
  }
  const runRelationOperation: NonNullable<ReactRelationManagerRendererProps['onOperation']> = async (request) => {
    const result = await operation.execute('action', {
      intent: 'relation',
      managerId: request.managerId,
      ownerId: record[routeKey] ?? null,
      ...(request.pivot ? { pivot: { ...request.pivot } } : {}),
      ...(typeof request.recordId === 'number' || typeof request.recordId === 'string' ? { relatedId: request.recordId } : {}),
      relationOperation: request.operation,
      resourceId,
      ...(request.values ? { values: { ...request.values } } : {}),
    })
    if (!result.ok) throw new Error(result.error ?? 'The relation operation could not be completed.')
    setRelations(relationManagers(result.data?.relations))
  }
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSaved(false)
    await form.submit(async context => {
      const errors = Object.fromEntries(fields.filter(field => field.required && (context.values[field.path] === '' || context.values[field.path] === null || typeof context.values[field.path] === 'undefined')).map(field => [field.path, 'This field is required.']))
      if (Object.keys(errors).length > 0) return { errors, focusFirstError: true }
      const result = await operation.execute('form-submit', { ...context.values, intent: pageOperation, recordId: record[routeKey] ?? null, resourceId })
      if (!result.ok) return { errors: { [fields[0]?.path ?? routeKey]: result.error ?? 'The record could not be saved.' }, focusFirstError: true }
      setSaved(true)
      const savedRecord = object(result.data?.record)
      const savedIdentifier = valueAtPath(savedRecord, routeKey)
      const redirect = pageOperation === 'create' ? createRedirect : editRedirect
      if (redirect && (typeof savedIdentifier === 'number' || typeof savedIdentifier === 'string')) {
        const encodedIdentifier = encodeURIComponent(String(savedIdentifier))
        const target = redirect === 'index' ? basePath : redirect === 'view' ? `${basePath}/${encodedIdentifier}` : `${basePath}/${encodedIdentifier}/edit`
        router.push(target)
      }
      return { commitValues: true }
    })
  }
  const recordIdentifier = record[routeKey]
  return <>
    {pageOperation === 'edit' && (typeof recordIdentifier === 'number' || typeof recordIdentifier === 'string')
      ? <ResourcePageActions basePath={basePath} operation={operation} panelId={panelId} recordId={recordIdentifier} registry={registry} resource={resource} />
      : null}
    <form className="hp-resource-form hp:grid hp:gap-6" onSubmit={event => void submit(event)}>
      <Card>
        <CardContent className="hp:grid hp:gap-6 hp:pt-6">{fields.map(definition => <ResourceField definition={definition} form={form} key={definition.path} operation={operation} pageOperation={pageOperation} panelId={panelId} recordId={record[routeKey]} registry={registry} resourceId={resourceId} values={state.values} />)}</CardContent>
        <CardFooter className="hp:justify-end"><Button className="hp-form-actions hp-button hp-button-primary" disabled={state.submitting} type="submit">{state.submitting ? text(labels.saving) || 'Saving…' : text(labels.save) || 'Save'}</Button></CardFooter>
      </Card>
      {saved ? <p className="hp:text-sm hp:text-muted-foreground" role="status">{text(labels.saved) || 'Saved.'}</p> : null}
    </form>
    {relations.length > 0 ? <><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /><ReactRelationManagerRenderer loadOptions={loadRelationOptions} managers={relations} onOperation={runRelationOperation} /><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /></> : null}
  </>
}

function entryStore(definition: JsonObject, record: JsonObject): ReactEntryStore {
  const path = propertyPath(text(definition.path))
  const value = valueAtPath(record, path) ?? null
  const snapshot: ReactEntrySnapshot = Object.freeze({
    actions: strings(definition.actions),
    copyable: boolean(definition.copyable, false),
    error: null,
    formattedState: value,
    id: text(definition.id) || path,
    inlineLabel: boolean(definition.inlineLabel, false),
    label: typeof definition.label === 'string' ? definition.label : null,
    pending: false,
    placeholder: typeof definition.placeholder === 'string' ? definition.placeholder : null,
    properties: object(definition.properties),
    state: value,
    tooltip: null,
    type: text(definition.type) || 'text',
    url: null,
  })
  return { snapshot, subscribe: () => () => undefined }
}

function actionManifest(value: JsonObject): ClientActionManifest | null {
  const id = text(value.id)
  const kind = value.kind
  const mount = value.mount
  if (!id || !['create', 'custom', 'delete', 'edit', 'force-delete', 'replicate', 'restore', 'view'].includes(text(kind)) || !['bulk', 'modal', 'notification', 'page', 'record'].includes(text(mount))) return null
  return {
    badge: typeof value.badge === 'string' ? value.badge : null,
    color: typeof value.color === 'string' ? value.color : null,
    confirmation: typeof value.confirmation === 'string' ? value.confirmation : null,
    disabled: boolean(value.disabled, false),
    icon: typeof value.icon === 'string' ? value.icon : null,
    id,
    kind: kind as ClientActionManifest['kind'],
    label: text(value.label) || id,
    modal: isActionModal(value.modal) ? value.modal : null,
    mount: mount as ClientActionManifest['mount'],
    size: ['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(text(value.size)) ? value.size as ClientActionManifest['size'] : 'medium',
    tooltip: typeof value.tooltip === 'string' ? value.tooltip : null,
    type: text(value.type) || `core:action:${text(kind)}`,
    visible: boolean(value.visible, true),
  }
}

function ResourcePageActions({ basePath, operation, panelId, recordId, registry, resource }: {
  readonly basePath: string
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly recordId: string | number
  readonly registry: ComponentRegistry
  readonly resource: JsonObject
}): ReactNode {
  const router = useRouter()
  const resourceId = text(resource.id)
  const actions = useMemo(() => objects(resource.actions).map(actionManifest).filter((action): action is ClientActionManifest => action !== null && action.visible), [resource])
  const executableActions = useMemo(() => actions.filter(action => action.kind !== 'edit' && action.kind !== 'view' && action.kind !== 'create'), [actions])
  const actionKinds = useMemo(() => new Map(executableActions.map(action => [action.id, action.kind])), [executableActions])
  const store = useMemo(() => new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request) {
        const kind = actionKinds.get(request.actionId)
        if (!kind) throw new Error('The requested action is not available.')
        const result = await operation.execute('action', {
          actionId: request.actionId,
          idempotencyKey: request.idempotencyKey,
          input: request.input,
          intent: kind,
          recordIds: [recordId],
          resourceId,
        })
        if (!result.ok) throw new Error(result.error ?? 'The action could not be completed.')
        if (result.data?.status === 'partial') throw new Error('The record could not be updated.')
        if (kind === 'delete' || kind === 'force-delete') router.push(basePath)
        return { effects: [], items: [{ recordId, status: 'succeeded' as const }], status: 'succeeded' as const }
      },
    },
  }), [actionKinds, basePath, operation, recordId, resourceId])
  if (actions.length === 0) return null
  return <PanelsPageActions>
    {actions.map((action) => {
      if (action.kind === 'edit' || action.kind === 'view') {
        const route = configuredRoute(resource, action.kind, recordId)
        return route ? <Button asChild className="hp-action-trigger" key={action.id} variant="outline"><a data-action-id={action.id} data-color={action.color ?? undefined} href={route}>{action.icon ? <PanelsIcon name={action.icon} /> : null}<span>{action.label}</span></a></Button> : null
      }
      if (action.kind === 'create') return null
      return <ReactActionRenderer key={action.id} manifest={action} panelId={panelId} recordIds={[recordId]} registry={registry} store={store} />
    })}
  </PanelsPageActions>
}

function ResourceView({ basePath, data, operation, panelId, panelManifest, readOnlyRelations, registry, renderHookScopes, resource }: {
  readonly basePath: string
  readonly data: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly panelManifest: Pick<PanelShellBootstrap['manifest'], 'id' | 'slots'>
  readonly readOnlyRelations: boolean
  readonly registry: ComponentRegistry
  readonly renderHookScopes: readonly string[]
  readonly resource: JsonObject
}): ReactNode {
  const record = useMemo(() => object(data.record), [data])
  const routeKey = propertyPath(text(resource.routeKey))
  const recordTitle = propertyPath(text(resource.recordTitle))
  const resourceId = text(resource.id)
  const entries = objects(object(resource.infolist).entries)
  const [relations, setRelations] = useState(() => relationManagers(data.relations))
  useEffect(() => setRelations(relationManagers(data.relations)), [data.relations])
  const loadRelationOptions: NonNullable<ReactRelationManagerRendererProps['loadOptions']> = async (managerId, search) => {
    const result = await operation.execute('options', { ownerId: record[routeKey] ?? null, relationManagerId: managerId, resourceId, search })
    if (!result.ok) throw new Error(result.error ?? 'Related records could not be loaded.')
    return objects(result.data?.options).flatMap(option => {
      const value = option.value
      const label = text(option.label)
      return (typeof value === 'number' || typeof value === 'string') && label ? [{ label, value }] : []
    })
  }
  const runRelationOperation: NonNullable<ReactRelationManagerRendererProps['onOperation']> = async (request) => {
    const result = await operation.execute('action', {
      intent: 'relation',
      managerId: request.managerId,
      ownerId: record[routeKey] ?? null,
      ...(request.pivot ? { pivot: { ...request.pivot } } : {}),
      ...(typeof request.recordId === 'number' || typeof request.recordId === 'string' ? { relatedId: request.recordId } : {}),
      relationOperation: request.operation,
      resourceId,
      ...(request.values ? { values: { ...request.values } } : {}),
    })
    if (!result.ok) throw new Error(result.error ?? 'The relation operation could not be completed.')
    setRelations(relationManagers(result.data?.relations))
  }
  return <article className="hp-resource-view"><h2>{text(record[recordTitle])}</h2>
    <ResourcePageActions basePath={basePath} operation={operation} panelId={panelId} recordId={text(record[routeKey])} registry={registry} resource={resource} />
    <div className="hp-infolist">{entries.map(definition => <ReactEntryRenderer key={text(definition.id) || text(definition.path)} panelId={panelId} registry={registry} store={entryStore(definition, record)} />)}</div>
    {relations.length > 0 ? <><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} />{readOnlyRelations
      ? <ReactRelationManagerRenderer managers={relations} />
      : <ReactRelationManagerRenderer loadOptions={loadRelationOptions} managers={relations} onOperation={runRelationOperation} />}<ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /></> : null}
  </article>
}

export function NextPanelResourcePage({ createRedirect = 'edit', data, editRedirect = null, effects, operation: operationInput, panelId, panelManifest, panelPath, properties, readOnlyRelations = true, registry: registryInput, renderHookScopes = [], unsavedChangesAlerts = false }: {
  readonly createRedirect?: 'edit' | 'index' | 'view'
  readonly data: JsonObject
  readonly editRedirect?: 'index' | 'view' | null
  readonly effects?: ClientEffectSession
  readonly operation?: NextResourceOperationTransport
  readonly panelId: string
  readonly panelManifest?: Pick<PanelShellBootstrap['manifest'], 'id' | 'slots'>
  readonly panelPath: string
  readonly properties: JsonObject
  readonly readOnlyRelations?: boolean
  readonly registry?: ComponentRegistry
  readonly renderHookScopes?: readonly string[]
  readonly unsavedChangesAlerts?: boolean
}): ReactNode {
  const registry = useMemo(
    () => registryInput ?? registerReactFieldRenderers(createDefaultComponentRegistry()),
    [registryInput],
  )
  const operation = useMemo(() => operationInput ?? browserTransport(panelId, effects), [effects, operationInput, panelId])
  const pageOperation = text(properties.operation) || 'view'
  const resource = object(properties.resource)
  const basePath = resourcePath(panelPath, resource)
  const renderHookManifest = panelManifest ?? Object.freeze({ id: panelId, slots: Object.freeze({}) })
  if (pageOperation === 'list') return <ResourceList data={data} operation={operation} panelId={panelId} panelManifest={renderHookManifest} registry={registry} renderHookScopes={renderHookScopes} resource={resource} />
  if (pageOperation === 'create' || pageOperation === 'edit') return <ResourceForm basePath={basePath} createRedirect={createRedirect} data={data} editRedirect={editRedirect} operation={operation} pageOperation={pageOperation} panelId={panelId} panelManifest={renderHookManifest} registry={registry} renderHookScopes={renderHookScopes} resource={resource} unsavedChangesAlerts={unsavedChangesAlerts} />
  return <ResourceView basePath={basePath} data={data} operation={operation} panelId={panelId} panelManifest={renderHookManifest} readOnlyRelations={readOnlyRelations} registry={registry} renderHookScopes={renderHookScopes} resource={resource} />
}
