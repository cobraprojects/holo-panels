'use client'

import {
  ClientActionStore,
  type ClientEffectSession,
  FormStore,
  OptionStore,
  PanelsTransport,
  ReactActionRenderer,
  ReactEntryRenderer,
  ReactFieldRenderer,
  ReactTableRenderer,
  TableStateStore,
  createComponentRegistry,
  registerReactFieldRenderers,
  useFormStore,
  type ClientActionManifest,
  type JsonObject,
  type JsonValue,
  type ReactCompiledField,
  type ReactEntrySnapshot,
  type ReactEntryStore,
  type ReactTableAction,
  type ReactTableColumn,
} from '@holo-js/panels-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

export interface NextResourceOperationResult {
  readonly error?: string
  readonly ok: boolean
}

export interface NextResourceOperationTransport {
  execute(operation: 'action' | 'form-submit', payload: JsonObject): Promise<NextResourceOperationResult>
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

function recordsFrom(data: JsonObject): JsonObject[] {
  return Array.isArray(data.records) ? data.records.filter(isObject) : []
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
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
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/u.test(value)) throw new Error(`[Holo Panels] Invalid resource property path "${value}".`)
  return value
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
      const descriptor = { kind: 'mutation' as const, name: operation, supportsIdempotency: true }
      const response = await transport.execute(descriptor, {
        endpoint: `/_holo/panels/${encodeURIComponent(panelId)}/${operation}`,
        panelId,
        payload,
      })
      await effects?.apply(response)
      return response.ok ? { ok: true } : { error: response.error.message, ok: false }
    },
  }
}

function tableColumn(definition: JsonObject, basePath: string, routeKey: string, recordLink: string): ReactTableColumn<JsonObject> {
  const path = propertyPath(text(definition.path))
  return {
    manifest: {
      alignment: definition.alignment === 'center' || definition.alignment === 'end' ? definition.alignment : 'start',
      copyable: boolean(definition.copyable, false),
      hidden: boolean(definition.hidden, false),
      inlineEditor: isObject(definition.inlineEditor) ? definition.inlineEditor : null,
      label: typeof definition.label === 'string' ? definition.label : null,
      path,
      sortable: boolean(definition.sortable, true),
      toggleable: boolean(definition.toggleable, true),
      type: text(definition.type) || 'text',
      width: typeof definition.width === 'string' || typeof definition.width === 'number' ? definition.width : null,
      wrap: boolean(definition.wrap, true),
    },
    ...(path === recordLink ? {
      render: (value: unknown, record: Readonly<JsonObject>) => <><a href={`${basePath}/${encodeURIComponent(text(record[routeKey]))}`}>{text(value)}</a> <a href={`${basePath}/${encodeURIComponent(text(record[routeKey]))}/edit`}>Edit</a></>,
    } : {}),
  }
}

function tableActions(table: JsonObject): readonly ReactTableAction[] {
  return objects(table.actions).flatMap((action) => {
    const id = text(action.id)
    const label = text(action.label)
    const scope = action.scope
    if (!id || !label || (scope !== 'bulk' && scope !== 'header' && scope !== 'row')) return []
    return [{ confirmation: typeof action.confirmation === 'string' ? action.confirmation : undefined, id, label, scope }]
  })
}

function ResourceList({ basePath, data, operation, panelId, resource }: {
  readonly basePath: string
  readonly data: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly resource: JsonObject
}): ReactNode {
  const records = useMemo(() => recordsFrom(data), [data])
  const table = object(resource.table)
  const routeKey = propertyPath(text(resource.routeKey))
  const columns = useMemo(() => objects(table.columns).map(definition => tableColumn(definition, basePath, routeKey, text(table.recordLink))), [basePath, routeKey, table])
  const actions = useMemo(() => tableActions(table), [table])
  const actionDefinitions = useMemo(() => new Map(objects(table.actions).map(action => [text(action.id), action])), [table])
  const resourceId = text(resource.id)
  const labels = object(resource.labels)
  const store = useMemo(() => new TableStateStore<JsonObject, string>({
    filterMode: table.filterMode === 'deferred' ? 'deferred' : 'live',
    panelId,
    records,
    tableId: resourceId,
    total: records.length,
    visibleColumns: columns.filter(item => !item.manifest.hidden).map(item => item.manifest.path),
  }), [columns, panelId, records, resourceId, table.filterMode])
  const refresh = (): void => {
    const search = store.query.search.toLowerCase()
    const visible = records.filter(record => Object.values(record).some(value => (typeof value === 'string' || typeof value === 'number') && String(value).toLowerCase().includes(search)))
    store.applyData({ queryVersion: store.query.queryVersion, records: visible, total: visible.length })
  }
  return <div><a href={`${basePath}/create`}>{text(labels.create) || 'Create'}</a><ReactTableRenderer
    actions={actions}
    actionTransport={{
      async execute(request) {
        const manifest = actionDefinitions.get(request.actionId)
        if (!manifest) throw new Error('The requested action is not available.')
        const result = await operation.execute('action', { actionId: request.actionId, intent: text(manifest.kind) || request.actionId, recordId: request.recordId ?? null, resourceId })
        if (!result.ok) throw new Error(result.error ?? 'The action could not be completed.')
        if (manifest.removesRecord === true && request.recordId !== undefined) {
          const remaining = store.snapshot.records.filter(record => text(record[routeKey]) !== String(request.recordId))
          store.applyData({ queryVersion: store.query.queryVersion, records: remaining, total: remaining.length })
        }
      },
    }}
    caption={text(labels.plural) || resourceId}
    columns={columns}
    getRecordId={record => text(record[routeKey])}
    onQueryChange={refresh}
    store={store}
  /></div>
}

function fieldDefinition(definition: JsonObject): ReactCompiledField<ResourceValues> {
  const path = propertyPath(text(definition.path))
  return {
    disabled: boolean(definition.disabled, false),
    helperText: typeof definition.helperText === 'string' ? definition.helperText : null,
    hint: typeof definition.hint === 'string' ? definition.hint : null,
    label: typeof definition.label === 'string' ? definition.label : null,
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
      recompute: (context: { readonly get: (path: string) => JsonValue }) => patches.flatMap((patch) => {
        const path = text(patch.path)
        const resolver = object(patch.resolver)
        const resolve = clientResolvers.get(text(resolver.name))
        if (!path || !resolve) return []
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
  const selected = text(values[dependency])
  return { dependency, options: objects(mapped[selected]) }
}

function ResourceField({ definition, form, panelId, registry, resourceId, values }: {
  readonly definition: ReactCompiledField<ResourceValues>
  readonly form: FormStore<ResourceValues>
  readonly panelId: string
  readonly registry: ReturnType<typeof createComponentRegistry>
  readonly resourceId: string
  readonly values: Readonly<ResourceValues>
}): ReactNode {
  const dynamic = dependentOptions(definition.properties as JsonObject, values)
  const optionStore = useMemo(() => dynamic ? new OptionStore<string>({
    dependencies: { [dynamic.dependency]: values[dynamic.dependency] ?? null },
    fieldId: definition.path,
    locale: 'en',
    panelId,
    requiredDependencies: [dynamic.dependency],
    resourceId,
    tenantKey: 'current',
    transport: {
      async hydrateSelected(_request, selected) {
        return selected.flatMap(value => typeof value === 'string' && value.length > 0 ? [{ label: value, value }] : [])
      },
      async list(request) {
        const available = dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []
        return { hasMore: false, options: available.map(item => ({ disabled: item.disabled === true, label: text(item.label) || text(item.value), value: text(item.value) })), page: 1, perPage: request.perPage }
      },
      async validateSelection(request, selected) {
        const available = new Set((dependentOptions(definition.properties as JsonObject, request.dependencies)?.options ?? []).map(item => text(item.value)))
        return selected.every(value => available.has(value))
      },
    },
  }) : undefined, [definition.path, definition.properties, dynamic, panelId, resourceId, values])
  useEffect(() => {
    if (!dynamic || !optionStore) return
    void optionStore.updateDependencies({ [dynamic.dependency]: values[dynamic.dependency] ?? null }, optionValue(values[definition.path])).then(async result => {
      if (result.status === 'cleared' && values[definition.path] !== '') form.set(definition.path, '')
      if (values[dynamic.dependency] !== null && typeof values[dynamic.dependency] !== 'undefined' && values[dynamic.dependency] !== '') await optionStore.preload()
    })
  }, [definition.path, dynamic, form, optionStore, values])
  return <ReactFieldRenderer definition={definition} optionStore={optionStore} panelId={panelId} registry={registry} store={form} />
}

function ResourceForm({ data, operation, pageOperation, panelId, resource }: {
  readonly data: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly pageOperation: string
  readonly panelId: string
  readonly resource: JsonObject
}): ReactNode {
  const record = useMemo(() => object(data.record), [data])
  const formManifest = object(resource.form)
  const fields = useMemo(() => objects(formManifest.fields).map(fieldDefinition), [formManifest])
  const initialValues = useMemo(() => Object.fromEntries(fields.map(field => [field.path, record[field.path] ?? object(objects(formManifest.fields).find(item => item.path === field.path)?.properties).defaultValue ?? ''])), [fields, formManifest, record])
  const form = useMemo(() => new FormStore<ResourceValues>(initialValues, { dependencies: dependencyDefinitions(formManifest) }), [formManifest, initialValues])
  const state = useFormStore(form)
  const registry = useMemo(() => registerReactFieldRenderers(createComponentRegistry()), [])
  const [saved, setSaved] = useState(false)
  const labels = object(resource.labels)
  const resourceId = text(resource.id)
  const routeKey = propertyPath(text(resource.routeKey))
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSaved(false)
    await form.submit(async context => {
      const errors = Object.fromEntries(fields.filter(field => field.required && (context.values[field.path] === '' || context.values[field.path] === null || typeof context.values[field.path] === 'undefined')).map(field => [field.path, 'This field is required.']))
      if (Object.keys(errors).length > 0) return { errors, focusFirstError: true }
      const result = await operation.execute('form-submit', { ...context.values, intent: pageOperation, recordId: record[routeKey] ?? null, resourceId })
      if (!result.ok) return { errors: { [fields[0]?.path ?? routeKey]: result.error ?? 'The record could not be saved.' }, focusFirstError: true }
      setSaved(true)
      return { commitValues: true }
    })
  }
  return <form onSubmit={event => void submit(event)}>
    {fields.map(definition => <ResourceField definition={definition} form={form} key={definition.path} panelId={panelId} registry={registry} resourceId={resourceId} values={state.values} />)}
    <button disabled={state.submitting} type="submit">{state.submitting ? text(labels.saving) || 'Saving…' : text(labels.save) || 'Save'}</button>
    {saved ? <p role="status">{text(labels.saved) || 'Saved.'}</p> : null}
  </form>
}

function entryStore(definition: JsonObject, record: JsonObject): ReactEntryStore {
  const path = propertyPath(text(definition.path))
  const value = record[path] ?? null
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
    confirmation: typeof value.confirmation === 'string' ? value.confirmation : null,
    disabled: boolean(value.disabled, false),
    id,
    kind: kind as ClientActionManifest['kind'],
    label: text(value.label) || id,
    mount: mount as ClientActionManifest['mount'],
    schema: isObject(value.schema) && Array.isArray(value.schema.fields) ? { ...value.schema, fields: value.schema.fields } : null,
    visible: boolean(value.visible, true),
  }
}

function ResourceView({ basePath, data, operation, panelId, resource }: {
  readonly basePath: string
  readonly data: JsonObject
  readonly operation: NextResourceOperationTransport
  readonly panelId: string
  readonly resource: JsonObject
}): ReactNode {
  const record = useMemo(() => object(data.record), [data])
  const routeKey = propertyPath(text(resource.routeKey))
  const recordTitle = propertyPath(text(resource.recordTitle))
  const resourceId = text(resource.id)
  const entries = objects(object(resource.infolist).entries)
  const actions = objects(resource.actions).map(actionManifest).filter((action): action is ClientActionManifest => action !== null)
  const actionKinds = useMemo(() => new Map(actions.map(action => [action.id, action.kind])), [actions])
  const [completedAction, setCompletedAction] = useState<string | null>(null)
  const registry = useMemo(() => createComponentRegistry(), [])
  const actionStore = useMemo(() => new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request) {
        const result = await operation.execute('action', { actionId: request.actionId, intent: actionKinds.get(request.actionId) ?? request.actionId, recordId: request.recordIds?.[0] ?? null, resourceId })
        if (!result.ok) throw new Error(result.error ?? 'The action could not be completed.')
        setCompletedAction(request.actionId)
        return { effects: [], items: [{ recordId: request.recordIds?.[0] ?? '', status: 'succeeded' as const }], status: 'succeeded' as const }
      },
    },
  }), [actionKinds, operation, resourceId])
  if (completedAction && actions.find(action => action.id === completedAction)?.kind === 'delete') return <p role="status">{text(object(resource.labels).deleted) || 'Deleted.'}</p>
  return <article><h2>{text(record[recordTitle])}</h2>
    <div>{entries.map(definition => <ReactEntryRenderer key={text(definition.id) || text(definition.path)} panelId={panelId} registry={registry} store={entryStore(definition, record)} />)}</div>
    <a href={`${basePath}/${encodeURIComponent(text(record[routeKey]))}/edit`}>{text(object(resource.labels).edit) || 'Edit'}</a>
    {actions.map(manifest => <ReactActionRenderer key={manifest.id} manifest={manifest} panelId={panelId} recordIds={[text(record[routeKey])]} registry={registry} store={actionStore} />)}
  </article>
}

export function NextPanelResourcePage({ data, effects, operation: operationInput, panelId, panelPath, properties }: {
  readonly data: JsonObject
  readonly effects?: ClientEffectSession
  readonly operation?: NextResourceOperationTransport
  readonly panelId: string
  readonly panelPath: string
  readonly properties: JsonObject
}): ReactNode {
  const operation = useMemo(() => operationInput ?? browserTransport(panelId, effects), [effects, operationInput, panelId])
  const pageOperation = text(properties.operation) || 'view'
  const resource = object(properties.resource)
  const basePath = resourcePath(panelPath, resource)
  if (pageOperation === 'list') return <ResourceList basePath={basePath} data={data} operation={operation} panelId={panelId} resource={resource} />
  if (pageOperation === 'create' || pageOperation === 'edit') return <ResourceForm data={data} operation={operation} pageOperation={pageOperation} panelId={panelId} resource={resource} />
  return <ResourceView basePath={basePath} data={data} operation={operation} panelId={panelId} resource={resource} />
}
