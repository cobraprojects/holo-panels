'use client'

import {
  ClientActionStore,
  actionManifestCollection,
  resolveTableActionManifest,
  relationActionPayload,
  relationActionPresentation,
  CollectionStore,
  createBrowserUploadAdapter,
  decodeFormOperationPaths,
  decodeFormSetOperations,
  decodeSchemaManifest,
  bindUploadStore,
  uploadFormPatch,
  createUploadStore,
  type ClientEffectSession,
  FormStore,
  formValidationErrors,
  formValidationFailure,
  PanelsTransportError,
  OptionStore,
  PanelsTransport,
  publishPanelActionFailure,
  PanelsPageActions,
  PanelsRenderHook,
  ReactActionRenderer,
  ReactEntryRenderer,
  ReactFieldRenderer,
  ReactRelationManagerRenderer,
  ReactSchemaRenderer,
  ReactPanelsRenderHook,
  ReactTableRenderer,
  TableStateStore,
  toJsonValue,
  createDefaultComponentRegistry,
  registerReactFieldRenderers,
  useFormStore,
  type ClientActionManifest,
  type ComponentRegistry,
  type Effect,
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
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Card, CardContent, CardFooter } from './internal-ui'
import { useClientRequestController } from './client-lifecycle'

export interface NextResourceOperationResult {
  readonly data?: JsonObject
  readonly error?: string
  readonly failure?: PanelsTransportError
  readonly effects?: readonly Effect[]
  readonly ok: boolean
}

export interface NextResourceOperationTransport {
  execute(operation: 'action' | 'form-submit' | 'options' | 'table-data', payload: JsonObject, signal?: AbortSignal): Promise<NextResourceOperationResult>
}

type ResourceOperation = Parameters<NextResourceOperationTransport['execute']>[0]

class NextResourceEffectError extends Error {
  constructor(readonly effects: readonly Effect[]) {
    super('Panel response effects could not be applied')
    this.name = 'NextResourceEffectError'
  }
}

const ClientRequestSignalContext = createContext<AbortSignal | null>(null)

function requestSignal(owner: AbortSignal, operation?: AbortSignal): AbortSignal {
  return operation ? AbortSignal.any([owner, operation]) : owner
}

function ownedResourceOperation(transport: NextResourceOperationTransport, owner: AbortSignal): NextResourceOperationTransport {
  return Object.freeze({
    async execute(operation: ResourceOperation, payload: JsonObject, signal?: AbortSignal) {
      const ownedSignal = requestSignal(owner, signal)
      const result = await transport.execute(operation, payload, ownedSignal)
      if (ownedSignal.aborted) throw new DOMException('The operation was aborted', 'AbortError')
      return result
    },
  })
}

function ownedUploadAdapter(adapter: ReturnType<typeof createBrowserUploadAdapter>, owner: AbortSignal): ReturnType<typeof createBrowserUploadAdapter> {
  const owned: ReturnType<typeof createBrowserUploadAdapter> = {
    create: (context, file, signal) => adapter.create(context, file, requestSignal(owner, signal)),
    delete: (context, id, token, signal) => adapter.delete(context, id, token, requestSignal(owner, signal)),
    deleteExisting: (context, id, signal) => adapter.deleteExisting(context, id, requestSignal(owner, signal)),
    resolve: (context, id, token, signal) => adapter.resolve(context, id, token, requestSignal(owner, signal)),
    write: (context, upload, contents, signal, onProgress) => adapter.write(context, upload, contents, requestSignal(owner, signal), onProgress),
  }
  return Object.freeze(owned)
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
      ...relationActionPresentation(manager),
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
  const validSchema = schema === null || Array.isArray(schemaRecord?.fields) || (
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
    async execute(operation, payload, signal) {
      const descriptor = operation === 'table-data'
        ? { kind: 'read' as const, name: operation }
        : { kind: 'mutation' as const, name: operation, supportsIdempotency: true }
      const response = await transport.execute(descriptor, {
        endpoint: `/holo/panels/${encodeURIComponent(panelId)}/${operation}`,
        panelId,
        payload,
        signal,
      })
      try {
        await effects?.apply(response)
      } catch {
        throw new NextResourceEffectError(response.effects)
      }
      return response.ok
        ? { data: object(response.data), effects: response.effects, ok: true }
        : { effects: response.effects, error: response.error.message, failure: new PanelsTransportError(response.error), ok: false }
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

function tableAction(action: JsonObject, resource: JsonObject, presentation?: JsonObject): ReactTableActionItem | null {
  const id = text(action.id)
  const scope = action.scope
  if (!id || (scope !== 'bulk' && scope !== 'header' && scope !== 'row')) return null
  if (action.kind === 'action-group') {
    const actions = objects(action.actions).flatMap(item => {
      const parsed = tableAction(item, resource, presentation)
      return parsed && !('kind' in parsed) ? [parsed] : []
    })
    if (actions.length === 0) return null
    return {
      actions,
      color: typeof action.color === 'string' ? action.color : null,
      icon: typeof action.icon === 'string' ? action.icon : null,
      id,
      kind: 'action-group',
      emptyStateOnly: action.emptyStateOnly === true,
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
    emptyStateOnly: action.emptyStateOnly === true,
    confirmation: typeof action.confirmation === 'string' ? action.confirmation : undefined,
    icon: typeof action.icon === 'string' ? action.icon : null,
    id,
    label,
    scope,
    ...(presentation && Array.isArray(presentation.tableActions) ? { resolveManifest: (recordId?: string | number) => resolveTableActionManifest(presentation, id, recordId) } : {}),
    ...(scope === 'row' && route
      ? { url: (recordId: string | number) => route.replace(':record', encodeURIComponent(String(recordId))) }
      : {}),
  }
}

function tableActions(table: JsonObject, resource: JsonObject, presentation?: JsonObject): readonly ReactTableActionItem[] {
  return objects(table.actions).flatMap((action) => {
    const parsed = tableAction(action, resource, presentation)
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
  const [actionData, setActionData] = useState(data)
  const actions = useMemo(() => tableActions(table, resource, actionData), [resource, table, actionData])
  const filters = useMemo(() => tableFilters(table), [table])
  const actionDefinitions = useMemo(() => new Map(executableTableActions(objects(table.actions)).map(action => [`${action.scope}:${text(action.id)}`, action])), [table])
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
    selection: object(table.selection),
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
      selection: toJsonValue(store.selectionPayload()),
      search: query.search,
      sort: query.sort.map(item => ({ ...item })),
    }).then((result) => {
      if (!result.ok || !result.data) {
        store.applyError(query.queryVersion, { code: 'table-data-failed', message: result.error ?? 'Unable to load table data.' })
        return
      }
      const nextRecords = recordsFrom(result.data)
      const total = typeof result.data.total === 'number' ? result.data.total : nextRecords.length
      if (query.queryVersion !== store.query.queryVersion) return
      setGroups(tableGroups(result.data.groups))
      setSummaries(tableSummaries(result.data.summaries))
      setActionData(result.data)
      store.applyData({ queryVersion: query.queryVersion, records: nextRecords, total, selection: object(result.data.selection) })
    }).catch(() => store.applyError(query.queryVersion, { code: 'table-data-failed', message: 'Unable to load table data.' }))
  }
  return <div className="hp-resource-page"><ResourcePageActions basePath="" operation={operation} panelId={panelId} registry={registry} resource={resource} source="list" /><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /><ReactTableRenderer
    panelId={panelId}
    registry={registry}
    actions={actions}
    actionTransport={{
      async execute(request, signal) {
        const resolved = resolveTableActionManifest(actionData, request.actionId, request.recordId)
        const actionScope = request.mount === 'bulk' ? 'bulk' : request.mount === 'page' ? 'header' : 'row'
        const manifest = resolved ? { ...resolved, removesRecord: resolved.kind === 'delete' || resolved.kind === 'force-delete', scope: resolved.mount === 'bulk' ? 'bulk' : resolved.mount === 'page' ? 'header' : 'row' } : actionDefinitions.get(`${actionScope}:${request.actionId}`)
        if (!manifest) throw new Error('The requested action is not available.')
        const recordIds = request.selection?.mode === 'explicit'
          ? request.selection.recordIds
          : typeof request.recordId === 'number' || typeof request.recordId === 'string' ? [request.recordId] : []
        const result = await operation.execute('action', { actionId: request.actionId, idempotencyKey: request.idempotencyKey ?? globalThis.crypto.randomUUID(), input: request.input ?? {}, intent: text(manifest.kind) || request.actionId, mount: request.mount ?? (manifest.scope === 'bulk' ? 'bulk' : manifest.scope === 'header' ? 'page' : 'record'), ...(request.selection?.mode === 'all-matching' ? { selection: toJsonValue(request.selection) } : {}), recordIds: [...recordIds], resourceId, source: 'table', tableQuery: toJsonValue(store.query) }, signal)
        if (!result.ok) throw new Error(result.error ?? 'The action could not be completed.')
        if (result.data?.status === 'partial') throw new Error('One or more records could not be updated.')
        if (manifest.mount === 'bulk' || manifest.scope === 'bulk') refresh()
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
    debounceMilliseconds: typeof definition.debounceMilliseconds === 'number' ? definition.debounceMilliseconds : 0,
    disabled: boolean(definition.disabled, false),
    helperText: typeof definition.helperText === 'string' ? definition.helperText : null,
    hint: typeof definition.hint === 'string' ? definition.hint : null,
    label: typeof definition.label === 'string' && definition.label.trim() ? definition.label : humanizePath(path),
    path,
    placeholder: typeof definition.placeholder === 'string' ? definition.placeholder : null,
    properties: { ...object(definition.properties), validationRules: strings(definition.rules) },
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
      recompute: (context: { readonly get: (path: string) => JsonValue, readonly editedPaths: ReadonlySet<string> }) => patches.flatMap((patch) => {
        const path = text(patch.path)
        const resolver = object(patch.resolver)
        const resolve = clientResolvers.get(text(resolver.name))
        if (!path || !resolve || context.editedPaths.has(path)) return []
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

function useStructurallyStableValue<TValue>(value: TValue): TValue {
  const stable = useRef(value)
  if (JSON.stringify(stable.current) !== JSON.stringify(value)) stable.current = value
  return stable.current
}

function ResourceField({ definition, dependencyValues, form, operation, pageOperation, panelId, recordId, registry, resourceId, values }: {
  readonly definition: ReactCompiledField<ResourceValues>
  readonly dependencyValues: Readonly<ResourceValues>
  readonly form: FormStore<ResourceValues>
  readonly operation: NextResourceOperationTransport
  readonly pageOperation: string
  readonly panelId: string
  readonly recordId: JsonValue | undefined
  readonly registry: ComponentRegistry
  readonly resourceId: string
  readonly values: Readonly<ResourceValues>
}): ReactNode {
  const ownerSignal = useContext(ClientRequestSignalContext)
  if (!ownerSignal) throw new Error('Resource fields require a client request owner')
  const dynamic = dependentOptions(definition.properties as JsonObject, dependencyValues)
  const inlineOptions = useMemo(() => staticOptions(definition.properties as JsonObject), [definition.properties])
  const sourceKind = text(Reflect.get(definition.properties, 'optionSource'))
  const serverOptions = !!sourceKind && sourceKind !== 'static'
  const fieldActions = useMemo(() => fieldActionManifests(definition.properties as JsonObject, pageOperation), [definition.properties, pageOperation])
  const fieldActionStore = useMemo(() => new ClientActionStore<JsonObject>({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        if (!fieldActions.some(action => action.id === request.actionId)) throw new Error('The field action is not available.')
        const result = await operation.execute('action', {
          actionId: request.actionId,
          idempotencyKey: request.idempotencyKey,
          input: request.input,
          mount: request.mount,
          recordIds: request.recordIds ? [...request.recordIds] : [],
          resourceId,
          source: `form-field:${definition.path}`,
        }, signal)
        if (!result.ok || result.data?.status === 'partial') {
          publishPanelActionFailure(panelId, result.effects)
          throw result.failure ?? new Error(result.error ?? 'The field action could not be completed.')
        }
        return { effects: [], items: [], result: result.data, status: 'succeeded' }
      },
    },
  }), [definition.path, fieldActions, operation, panelId, resourceId])
  const fieldActionState = useSyncExternalStore(listener => fieldActionStore.subscribe(listener), () => fieldActionStore.state, () => fieldActionStore.state)
  useEffect(() => () => fieldActionStore.dispose(), [fieldActionStore])
  const collection = ['builder', 'key-value', 'repeater'].includes(definition.type)
  const collectionStore = useMemo(() => collection ? new CollectionStore(collectionValues(valueAtPath(values, definition.path)), 'resource-item') : undefined, [collection, definition.path, values])
  const uploadPolicy = useStructurallyStableValue(definition.type === 'panels:field:upload' ? Reflect.get(definition.properties, 'uploadPolicy') as UploadPolicy | undefined : undefined)
  const uploadStore = useMemo(() => uploadPolicy ? createUploadStore({
    adapter: ownedUploadAdapter(createBrowserUploadAdapter({
      endpoint: `/holo/panels/${encodeURIComponent(panelId)}/upload`,
      fieldId: definition.path,
      intent: pageOperation === 'edit' ? 'edit' : 'create',
      panelId,
      recordId: typeof recordId === 'string' || typeof recordId === 'number' ? recordId : null,
      resourceId,
    }), ownerSignal),
    context: { actorId: 'current', fieldId: definition.path, panelId, resourceId },
    policy: uploadPolicy,
  }) : undefined, [definition.path, ownerSignal, pageOperation, panelId, recordId, resourceId, uploadPolicy])
  useEffect(() => {
    const unsubscribe = uploadStore ? bindUploadStore(form, definition.path, uploadStore, uploadPolicy?.maximumFiles !== 1) : undefined
    return () => {
      unsubscribe?.()
      uploadStore?.reset()
    }
  }, [definition.path, form, uploadPolicy?.maximumFiles, uploadStore])
  const optionStore = useMemo(() => dynamic || inlineOptions.length > 0 || serverOptions ? new OptionStore<string | number>({
    dependencies: dynamic ? { [dynamic.dependency]: valueAtPath(dependencyValues, dynamic.dependency) ?? null } : {},
    fieldId: definition.path,
    locale: 'en',
    panelId,
    requiredDependencies: dynamic ? [dynamic.dependency] : [],
    resourceId,
    tenantKey: 'current',
    transport: {
      async hydrateSelected(_request, selected, signal) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'hydrate', dependencies: { ..._request.dependencies }, fieldId: definition.path, resourceId, selectedValues: [...selected], values: { ...values } }, signal)
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to hydrate options.')
          return staticOptions({ options: result.data.options ?? [] })
        }
        return selected.flatMap(value => typeof value === 'string' && value.length > 0 ? [{ label: value, value }] : [])
      },
      async list(request, signal) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'list', dependencies: { ...request.dependencies }, fieldId: definition.path, page: request.page, perPage: request.perPage, resourceId, search: request.search, values: { ...values } }, signal)
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to load options.')
          const available = staticOptions({ options: result.data.options ?? [] })
          return { hasMore: result.data.hasMore === true, options: available, page: request.page, perPage: request.perPage, total: typeof result.data.total === 'number' ? result.data.total : available.length }
        }
        const available = dynamic
          ? (dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []).map(item => ({ disabled: item.disabled === true, label: text(item.label) || text(item.value), value: text(item.value) }))
          : inlineOptions
        return { hasMore: false, options: available, page: 1, perPage: request.perPage }
      },
      async validateSelection(request, selected, signal) {
        if (serverOptions) {
          const result = await operation.execute('options', { action: 'validate', dependencies: { ...request.dependencies }, fieldId: definition.path, resourceId, selectedValues: [...selected], values: { ...values } }, signal)
          return result.ok && result.data?.valid === true
        }
        const available = new Set(dynamic
          ? (dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []).map(item => text(item.value))
          : inlineOptions.map(item => item.value))
        return selected.every(value => available.has(value))
      },
      ...(serverOptions && Reflect.get(definition.properties, 'canCreateOption') === true ? {
        async create(request, label, signal) {
          const result = await operation.execute('options', { action: 'create', dependencies: { ...request.dependencies }, fieldId: definition.path, label, resourceId, values: { ...values } }, signal)
          if (!result.ok || !result.data) throw new Error(result.error ?? 'Unable to create option.')
          const option = staticOptions({ options: [result.data.option ?? null] })[0]
          if (!option) throw new Error('The created option response is invalid.')
          return option
        },
      } : {}),
      ...(serverOptions && Reflect.get(definition.properties, 'canEditOption') === true ? {
        async edit(request, value, label, signal) {
          const result = await operation.execute('options', { action: 'edit', dependencies: { ...request.dependencies }, fieldId: definition.path, label, resourceId, value, values: { ...values } }, signal)
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
    void optionStore.updateDependencies({ [dynamic.dependency]: dependencyValues[dynamic.dependency] ?? null }, optionValue(values[definition.path])).then(async result => {
      if (result.status === 'cleared' && values[definition.path] !== '') form.set(definition.path, '')
      if (dependencyValues[dynamic.dependency] !== null && typeof dependencyValues[dynamic.dependency] !== 'undefined' && dependencyValues[dynamic.dependency] !== '') await optionStore.preload()
    })
  }, [definition.path, dependencyValues, dynamic, form, optionStore, values])
  const recordIds = pageOperation === 'create' || typeof recordId !== 'string' && typeof recordId !== 'number' ? [] : [recordId]
  return <>
    <ReactFieldRenderer
      collectionStore={collectionStore}
      createCollectionItem={definition.type === 'builder' ? blockType => ({ data: {}, type: blockType ?? '' }) : definition.type === 'repeater' ? () => ({}) : undefined}
      definition={definition}
      actionPending={actionId => fieldActionState.frames.some(frame => frame.manifest.id === actionId)}
      executeAction={(actionId) => {
        const action = fieldActions.find(candidate => candidate.id === actionId)
        if (!action || fieldActionStore.state.frames.some(frame => frame.manifest.id === actionId)) return
        fieldActionStore.mount(action, { ...values })
        if (!action.confirmation && !action.modal) void fieldActionStore.submit(recordIds).catch(() => undefined)
      }}
      optionStore={optionStore}
      panelId={panelId}
      registry={registry}
      store={form}
      uploadStore={uploadStore}
    />
    {fieldActions[0] ? <ReactActionRenderer actions={fieldActions} input={{ ...values }} manifest={fieldActions[0]} panelId={panelId} recordIds={recordIds} registry={registry} showTriggers={false} store={fieldActionStore} /> : null}
  </>
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
  const navigate = useRouter().push
  const record = useMemo(() => object(data.record), [data])
  const formManifest = object(resource.form)
  const resourceId = text(resource.id)
  const routeKey = propertyPath(text(resource.routeKey))
  const configuredFields = useMemo(() => objects(formManifest.fields).map(fieldDefinition), [formManifest])
  const configuredSchema = useMemo(
    () => decodeSchemaManifest<ResourceValues>(formManifest.schema) ?? { components: [], id: `${resourceId}-${pageOperation}-form`, kind: 'schema' as const },
    [formManifest.schema, pageOperation, resourceId],
  )
  const [fields, setFields] = useState(configuredFields)
  const [formSchema, setFormSchema] = useState(configuredSchema)
  useEffect(() => {
    setFields(configuredFields)
    setFormSchema(configuredSchema)
  }, [configuredFields, configuredSchema])
  const initialValues = useMemo(() => {
    const values: ResourceValues = {}
    for (const field of configuredFields) {
      const configured = object(objects(formManifest.fields).find(item => item.path === field.path)?.properties).defaultValue
      setValueAtPath(values, field.path, valueAtPath(record, field.path) ?? configured ?? '')
    }
    return values
  }, [configuredFields, formManifest, record])
  const form = useMemo(() => new FormStore<ResourceValues>(initialValues, { dependencies: dependencyDefinitions(formManifest), fields: configuredFields }), [configuredFields, formManifest, initialValues])
  const state = useFormStore<ResourceValues>(form)
  const [reactiveValues, setReactiveValues] = useState<ResourceValues | null>(null)
  const previousLifecycleValues = useRef(new WeakMap<FormStore<ResourceValues>, ResourceValues>())
  useEffect(() => {
    setReactiveValues(null)
    return form.subscribeReactivity(next => setReactiveValues(next.values))
  }, [form])
  useEffect(() => {
    const lifecycle = reactiveValues ? 'update' : 'hydrate'
    const controller = new AbortController()
    const values = reactiveValues ?? form.state.values
    const previousValues = previousLifecycleValues.current.get(form) ?? form.state.values
    previousLifecycleValues.current.set(form, values)
    void operation.execute('options', {
      action: 'schema',
      formOperation: pageOperation,
      lifecycle,
      ...(lifecycle === 'update' ? { previousValues } : {}),
      recordId: record[routeKey] ?? null,
      resourceId,
      values: { ...values },
    }, controller.signal).then((result) => {
      if (!result.ok || !result.data || controller.signal.aborted) return
      const nextFields = objects(result.data.fields).map(fieldDefinition)
      const nextSchema = decodeSchemaManifest<ResourceValues>(result.data.schema)
      const operationPaths = decodeFormOperationPaths(result.data.operationPaths)
      const operations = decodeFormSetOperations(result.data.operations, operationPaths ?? new Set([...configuredFields, ...nextFields].map(field => field.path)))
      if (!nextSchema || !operations) return
      if (nextFields.length > 0 || nextSchema.components.length > 0) {
        setFields(current => JSON.stringify(current) === JSON.stringify(nextFields) ? current : nextFields)
        setFormSchema(current => JSON.stringify(current) === JSON.stringify(nextSchema) ? current : nextSchema)
      }
      if (operations.length > 0) form.batch(operations, { notifyReactivity: false })
      previousLifecycleValues.current.set(form, form.state.values)
    }).catch(() => {
      if (!controller.signal.aborted) publishPanelActionFailure(panelId)
    })
    return () => controller.abort()
  }, [configuredFields, form, operation, pageOperation, panelId, reactiveValues, record, resourceId, routeKey])
  useEffect(() => () => form.cancelRequests(), [form])
  useEffect(() => {
    if (!unsavedChangesAlerts || state.dirtyPaths.length === 0) return
    const preventUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    globalThis.addEventListener('beforeunload', preventUnload)
    return () => globalThis.removeEventListener('beforeunload', preventUnload)
  }, [state.dirtyPaths.length, unsavedChangesAlerts])
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
  const runRelationOperation: NonNullable<ReactRelationManagerRendererProps['onOperation']> = async (request, signal) => {
    const result = await operation.execute('action', {
      ...relationActionPayload(request),
      ownerId: record[routeKey] ?? null,
      resourceId,
    }, signal)
    if (!result.ok || result.data?.status === 'partial') throw result.failure ?? new Error(result.error ?? 'The relation operation could not be completed.')
    setRelations(relationManagers(result.data?.relations))
  }
  const formActions = useMemo(() => objects(formManifest.actions).map(actionManifest).filter((action): action is ClientActionManifest => action !== null), [formManifest])
  const formActionStore = useMemo(() => new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        let completed = false
        let reset = false
        const outcome = await form.submit(async context => {
      const result = await operation.execute('form-submit', { actionId: request.actionId, idempotencyKey: request.idempotencyKey, values: request.input, intent: pageOperation, recordId: record[routeKey] ?? null, resourceId }, AbortSignal.any([context.signal, signal])).catch((cause: unknown) => {
        if (!formValidationErrors(cause) && !signal.aborted) publishPanelActionFailure(panelId)
        throw cause
      })
      if (!result.ok || result.data?.status === 'partial') {
        if (!formValidationErrors(result.failure)) publishPanelActionFailure(panelId, result.effects)
        throw result.failure ?? new Error('The record could not be saved.')
      }
      completed = true
      if (result.data?.formIntent === 'cancel') {
        reset = true
        return { commitValues: false }
      }
      const savedRecord = object(result.data?.record)
      const savedIdentifier = valueAtPath(savedRecord, routeKey)
      const redirect = result.data?.formIntent === 'create-another' ? null : pageOperation === 'create' ? createRedirect : editRedirect
      if (redirect && (typeof savedIdentifier === 'number' || typeof savedIdentifier === 'string')) {
        const encodedIdentifier = encodeURIComponent(String(savedIdentifier))
        const target = redirect === 'index' ? basePath : redirect === 'view' ? `${basePath}/${encodedIdentifier}` : `${basePath}/${encodedIdentifier}/edit`
        navigate(target)
      }
      reset = result.data?.formIntent === 'create-another'
      return { commitValues: !reset, ...uploadFormPatch(form, context.values, savedRecord, fields) }
        }, { validate: objects(formManifest.actions).find(action => action.id === request.actionId)?.formIntent !== 'cancel' })
        if (outcome.status === 'invalid') throw formValidationFailure(form.state.errors)
        if (!completed) throw new Error('The record could not be saved.')
        if (reset) form.reset()
        if (objects(formManifest.actions).find(action => action.id === request.actionId)?.formIntent === 'cancel') navigate(basePath)
        return { effects: [], items: [], status: 'succeeded' as const }
      },
    },
  }), [basePath, createRedirect, editRedirect, form, formManifest, operation, pageOperation, panelId, record, resourceId, routeKey, navigate])
  useEffect(() => () => {
    while (formActionStore.activeFrame) formActionStore.close()
  }, [formActionStore])
  const recordIdentifier = record[routeKey]
  return <>
    {pageOperation === 'create' ? <ResourcePageActions basePath={basePath} operation={operation} panelId={panelId} registry={registry} resource={resource} source="create" /> : pageOperation === 'edit' && (typeof recordIdentifier === 'number' || typeof recordIdentifier === 'string')
      ? <ResourcePageActions basePath={basePath} operation={operation} panelId={panelId} recordId={recordIdentifier} registry={registry} resource={resource} source="edit" />
      : null}
    <form className="hp-resource-form hp:grid hp:gap-6" noValidate onSubmit={event => {
      event.preventDefault()
      event.currentTarget.querySelector<HTMLButtonElement>('[data-action-id]')?.click()
    }}>
      <Card>
        <CardContent className="hp:grid hp:gap-6 hp:pt-6"><ReactSchemaRenderer
          panelId={panelId}
          registry={registry}
          renderContent={({ component }) => {
            if (component.kind !== 'field' || !component.statePath) return null
            const definition = fields.find(field => field.path === component.statePath)
            return definition ? <ResourceField definition={definition} dependencyValues={reactiveValues ?? form.state.values} form={form} key={definition.path} operation={operation} pageOperation={pageOperation} panelId={panelId} recordId={record[routeKey]} registry={registry} resourceId={resourceId} values={state.values} /> : null
          }}
          schema={formSchema}
        /></CardContent>
        <CardFooter className="hp:justify-end">{formActions[0] ? <ReactActionRenderer actions={formActions} input={state.values} manifest={formActions[0]} panelId={panelId} registry={registry} store={formActionStore} /> : null}</CardFooter>
      </Card>
      {state.errors._root?.length ? <ul data-form-errors="" role="alert">{state.errors._root.map((message, index) => <li key={index}>{message}</li>)}</ul> : null}
    </form>
    {relations.length > 0 ? <><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /><ReactRelationManagerRenderer panelId={panelId} registry={registry} loadOptions={loadRelationOptions} managers={relations} onOperation={runRelationOperation} /><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /></> : null}
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
  if (!id || !['associate', 'attach', 'create', 'custom', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'force-delete', 'replicate', 'restore', 'view'].includes(text(kind)) || !['bulk', 'modal', 'notification', 'page', 'record'].includes(text(mount))) return null
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

function fieldActionManifests(properties: JsonObject, pageOperation: string): readonly ClientActionManifest[] {
  const mount = pageOperation === 'create' ? 'page' : 'record'
  return ['hintAction', 'prefixAction', 'suffixAction'].flatMap((property) => {
    const candidate = object(properties[property])
    const manifest = actionManifest({ ...candidate, mount })
    return manifest ? [manifest] : []
  })
}

function ResourcePageActions({ basePath, operation, panelId, recordId, registry, resource, source }: {
  readonly basePath: string
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly recordId?: string | number
  readonly registry: ComponentRegistry
  readonly resource: JsonObject
  readonly source: 'create' | 'edit' | 'list' | 'view'
}): ReactNode {
  const router = useRouter()
  const resourceId = text(resource.id)
  const actions = useMemo(() => objects(resource.actions).map(actionManifest).filter((action): action is ClientActionManifest => action !== null && action.visible && action.mount === (recordId === undefined ? 'page' : 'record')), [recordId, resource])
  const actionKinds = useMemo(() => new Map(actionManifestCollection(actions).map(action => [action.id, action.kind])), [actions])
  const store = useMemo(() => new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        const kind = actionKinds.get(request.actionId)
        if (!kind) {
          publishPanelActionFailure(panelId)
          throw new Error('The requested action is not available.')
        }
        let result: NextResourceOperationResult
        try {
          result = await operation.execute('action', {
            actionId: request.actionId,
            idempotencyKey: request.idempotencyKey,
            input: request.input,
            intent: kind,
            mount: request.mount,
            ...(recordId === undefined ? {} : { recordIds: [recordId] }),
            resourceId,
            source,
          }, signal)
        } catch (cause: unknown) {
          publishPanelActionFailure(panelId, cause instanceof NextResourceEffectError ? cause.effects : [])
          throw cause
        }
        if (!result.ok) {
          if (!formValidationErrors(result.failure)) publishPanelActionFailure(panelId, result.effects)
          throw result.failure ?? new Error(result.error ?? 'The action could not be completed.')
        }
        if (result.data?.status === 'partial') {
          publishPanelActionFailure(panelId, result.effects)
          throw new Error('The record could not be updated.')
        }
        if (recordId !== undefined && (kind === 'delete' || kind === 'force-delete')) router.push(basePath)
        return { effects: [], items: recordId === undefined ? [] : [{ recordId, status: 'succeeded' as const }], status: 'succeeded' as const }
      },
    },
  }), [actionKinds, basePath, operation, recordId, resourceId, source])
  useEffect(() => () => {
    while (store.activeFrame) store.close()
  }, [store])
  if (actions.length === 0) return null
  return <PanelsPageActions>
    {actions[0] ? <ReactActionRenderer actions={actions} manifest={actions[0]} panelId={panelId} recordIds={recordId === undefined ? undefined : [recordId]} registry={registry} store={store} /> : null}
  </PanelsPageActions>
}

function ResourceEntry({ definition, operation, panelId, record, recordId, registry, resourceId }: {
  readonly definition: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly record: JsonObject
  readonly recordId: number | string
  readonly registry: ComponentRegistry
  readonly resourceId: string
}): ReactNode {
  const actions = useMemo(() => objects(definition.actionManifests).map(actionManifest).filter((action): action is ClientActionManifest => action !== null && action.visible), [definition])
  const source = `infolist:${text(definition.path)}`
  const store = useMemo(() => new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        if (!actionManifestCollection(actions).some(action => action.id === request.actionId)) throw new Error('The entry action is not available.')
        const result = await operation.execute('action', { actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, mount: request.mount, recordIds: [recordId], resourceId, source }, signal).catch((cause: unknown) => {
          if (!signal.aborted) publishPanelActionFailure(panelId, cause instanceof NextResourceEffectError ? cause.effects : [])
          throw cause
        })
        if (!result.ok || result.data?.status === 'partial') {
          if (!formValidationErrors(result.failure)) publishPanelActionFailure(panelId, result.effects)
          throw result.failure ?? new Error(result.error ?? 'The entry action could not be completed.')
        }
        return { effects: [], items: [], status: 'succeeded' as const }
      },
    },
  }), [actions, operation, recordId, resourceId, source])
  useEffect(() => () => {
    while (store.activeFrame) store.close()
  }, [store])
  return <ReactEntryRenderer actions={actions} actionStore={store} panelId={panelId} recordIds={[recordId]} registry={registry} store={entryStore(definition, record)} />
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
  const runRelationOperation: NonNullable<ReactRelationManagerRendererProps['onOperation']> = async (request, signal) => {
    const result = await operation.execute('action', {
      ...relationActionPayload(request), ownerId: record[routeKey] ?? null, resourceId,
    }, signal)
    if (!result.ok || result.data?.status === 'partial') throw new Error(result.error ?? 'The relation operation could not be completed.')
    setRelations(relationManagers(result.data?.relations))
  }
  return <article className="hp-resource-view"><h2>{text(record[recordTitle])}</h2>
    <ResourcePageActions basePath={basePath} operation={operation} panelId={panelId} recordId={text(record[routeKey])} registry={registry} resource={resource} source="view" />
    <div className="hp-infolist">{entries.map(definition => <ResourceEntry definition={definition} key={text(definition.id) || text(definition.path)} operation={operation} panelId={panelId} record={record} recordId={text(record[routeKey])} registry={registry} resourceId={resourceId} />)}</div>
    {relations.length > 0 ? <><ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={panelManifest} registry={registry} scopes={renderHookScopes} />{readOnlyRelations
      ? <ReactRelationManagerRenderer panelId={panelId} registry={registry} managers={relations} />
      : <ReactRelationManagerRenderer panelId={panelId} registry={registry} loadOptions={loadRelationOptions} managers={relations} onOperation={runRelationOperation} />}<ReactPanelsRenderHook data={data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={panelManifest} registry={registry} scopes={renderHookScopes} /></> : null}
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
  const requestController = useClientRequestController()
  const registry = useMemo(
    () => registryInput ?? registerReactFieldRenderers(createDefaultComponentRegistry()),
    [registryInput],
  )
  const operation = useMemo(
    () => ownedResourceOperation(operationInput ?? browserTransport(panelId, effects), requestController.signal),
    [effects, operationInput, panelId, requestController.signal],
  )
  const pageOperation = text(properties.operation) || 'view'
  const resource = object(properties.resource)
  const basePath = resourcePath(panelPath, resource)
  const renderHookManifest = panelManifest ?? Object.freeze({ id: panelId, slots: Object.freeze({}) })
  const page = pageOperation === 'list'
    ? <ResourceList data={data} operation={operation} panelId={panelId} panelManifest={renderHookManifest} registry={registry} renderHookScopes={renderHookScopes} resource={resource} />
    : pageOperation === 'create' || pageOperation === 'edit'
      ? <ResourceForm basePath={basePath} createRedirect={createRedirect} data={data} editRedirect={editRedirect} operation={operation} pageOperation={pageOperation} panelId={panelId} panelManifest={renderHookManifest} registry={registry} renderHookScopes={renderHookScopes} resource={resource} unsavedChangesAlerts={unsavedChangesAlerts} />
      : <ResourceView basePath={basePath} data={data} operation={operation} panelId={panelId} panelManifest={renderHookManifest} readOnlyRelations={readOnlyRelations} registry={registry} renderHookScopes={renderHookScopes} resource={resource} />
  return <ClientRequestSignalContext.Provider value={requestController.signal}>{page}</ClientRequestSignalContext.Provider>
}
