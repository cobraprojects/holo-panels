<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Card, CardContent, CardFooter } from '@holo-js/panels-svelte/ui/card'
  import Icon from './Icon.svelte'
  import {
    ClientActionStore,
    ClientEffectSession,
    CollectionStore,
    createBrowserUploadAdapter,
    createUploadStore,
    EntryRenderer,
    FieldRenderer,
    FormStore,
    OptionStore,
    PanelsTransport,
    PanelsPageActions,
    PanelsRenderHook,
    PanelsRenderHookRenderer,
    SvelteActionRenderer,
    SvelteRelationManagerRenderer,
    SvelteTableRenderer,
    TableStateStore,
    toJsonValue,
    toSvelteState,
    type JsonObject,
    type JsonValue,
    type SvelteEntryStore,
    type SvelteComponentRegistry,
    type SvelteRelationManagerRendererProps,
    type SvelteTableGroup,
    type SvelteTableAction,
    type SvelteTableActionItem,
    type SvelteTableSummary,
    type UploadPolicy,
  } from '@holo-js/panels-svelte'
  import type { PanelPageData } from './contracts'
  import {
    jsonRecord,
    jsonRecords,
    resourcePageMetadata,
    resourceOperationIdentifier,
    resourceOperationIdentifiers,
    resourceRoute,
    slugValue,
    type ResourceOptions,
  } from './resource-page'

  let { data, effects, pageActionsTarget, registry }: { readonly data: PanelPageData, readonly effects: ClientEffectSession, readonly pageActionsTarget?: HTMLElement, readonly registry?: SvelteComponentRegistry } = $props()
  const requestController = $derived.by(() => {
    data.page.manifest.path
    return new AbortController()
  })
  const endpoint = $derived(`/holo/panels/${data.panel.manifest.id}`)
  const pageType = $derived(data.page.manifest.pageType)
  const resource = $derived(resourcePageMetadata(data.page.data.resource ?? data.page.manifest.body?.properties.resource, data.page.manifest.path, pageType))
  const resourceScopes = $derived([data.page.manifest.id, ...(resource ? [resource.id] : [])])
  const record = $derived(jsonRecord(data.page.data.record))
  const records = $derived(jsonRecords(data.page.data.records))
  let loadedRelations = $state<SvelteRelationManagerRendererProps['managers'] | null>(null)
  const relations = $derived(loadedRelations ?? relationManagers(data.page.data.relations))
  const readOnlyRelations = $derived(data.panel.manifest.runtime?.readOnlyRelationManagersOnResourceViewPagesByDefault ?? true)
  let persistedRouteIdentifier = $state<number | string>('')
  const currentRouteIdentifier = $derived(persistedRouteIdentifier === '' ? recordRouteIdentifier(record) : persistedRouteIdentifier)
  let loadedGroups = $state<readonly SvelteTableGroup<Record<string, unknown>>[] | null>(null)
  let loadedSummaries = $state<readonly SvelteTableSummary[] | null>(null)
  const renderedGroups = $derived(loadedGroups ?? tableGroups(data.page.data.groups))
  const renderedSummaries = $derived(loadedSummaries ?? tableSummaries(data.page.data.summaries))
  const rowActions = $derived.by(() => {
    if (!resource) return []
    const configured = resource.tableActions
    const defaults = [
      ...(resource.routes.view && !resource.actions.some(action => action.kind === 'view') ? [{ color: null, confirmation: undefined, icon: 'view', id: `${resource.id}.view`, label: 'View', scope: 'row' as const }] : []),
      ...(resource.routes.edit && !resource.actions.some(action => action.kind === 'edit') ? [{ color: null, confirmation: undefined, icon: 'edit', id: `${resource.id}.edit`, label: 'Edit', scope: 'row' as const }] : []),
    ]
    return [...defaults, ...configured]
  })
  const createRoute = $derived(resource?.routes.create ?? null)
  const editRoute = $derived(resourceRoute(resource?.routes.edit ?? null, encodedRouteIdentifier(currentRouteIdentifier)))
  const viewRoute = $derived(resourceRoute(resource?.routes.view ?? null, encodedRouteIdentifier(currentRouteIdentifier)))
  const initialValues = $derived.by(() => {
    const values: Record<string, unknown> = {}
    for (const field of resource?.fields ?? []) setRecordValue(values, field.path, recordValue(record ?? {}, field.path) ?? field.properties?.defaultValue ?? '')
    return values
  })
  const form = $derived.by(() => new FormStore<Record<string, unknown>>(initialValues, {
    dependencies: (resource?.dependencies ?? []).map(dependency => ({
      id: dependency.id,
      paths: [dependency.source],
      recompute: context => {
        if (!context.changedPaths.has(dependency.source) || context.touchedPaths.has(dependency.target)) return []
        return [{
          kind: 'set' as const,
          path: dependency.target,
          value: dependency.kind === 'slug' ? slugValue(context.get(dependency.source)) : null,
        }]
      },
    })),
  }))
  const formState = $derived.by(() => toSvelteState(form))
  onMount(() => {
    const preventUnload = (event: BeforeUnloadEvent): void => {
      if (!data.panel.manifest.runtime?.unsavedChangesAlerts || form.state.dirtyPaths.length === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  })
  const optionStores = $derived.by(() => new Map(Object.entries(resource?.options ?? {}).map(([path, definition]) => [path, optionStore(path, definition)])))
  const collectionStores = $derived.by(() => new Map((resource?.fields ?? []).flatMap((field) => {
    if (!['builder', 'key-value', 'repeater'].includes(field.type)) return []
    const value = toJsonValue(recordValue(initialValues, field.path))
    return [[field.path, new CollectionStore(Array.isArray(value) ? value : [], 'resource-item')] as const]
  })))
  const uploadStores = $derived.by(() => new Map((resource?.fields ?? []).flatMap((field) => {
    const policy = uploadPolicy(field.properties?.uploadPolicy)
    if (field.type !== 'panels:field:upload' || !policy || !resource) return []
    const routeId = recordRouteIdentifier(record)
    const upload = createUploadStore({
      adapter: ownedUploadAdapter(createBrowserUploadAdapter({
        endpoint: `${endpoint}/upload`,
        fieldId: field.path,
        intent: pageType === 'edit' ? 'edit' : 'create',
        panelId: data.panel.manifest.id,
        recordId: routeId === '' ? null : routeId,
        resourceId: resource.id,
      }), requestController.signal),
      context: { actorId: String(data.panel.actor.id ?? 'current'), fieldId: field.path, panelId: data.panel.manifest.id, resourceId: resource.id },
      policy,
    })
    return [[field.path, upload] as const]
  })))
  const table = $derived.by(() => new TableStateStore<Record<string, unknown>, number | string>({
    filterMode: resource?.filterMode ?? 'live',
    panelId: data.panel.manifest.id,
    records,
    tableId: resource?.id ?? data.page.manifest.id,
    total: typeof data.page.data.total === 'number' ? data.page.data.total : records.length,
    visibleColumns: resource?.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path) ?? [],
  }))
  const transport = $derived.by(() => new PanelsTransport({
    adapter: {
      async send(request) {
        const response = await fetch(request.url, { body: request.body, credentials: request.credentials, headers: request.headers, method: request.method, signal: request.signal })
        const contents = await response.text()
        let body: unknown
        try {
          body = contents ? JSON.parse(contents) as unknown : undefined
        } catch {
          body = contents
        }
        return { body, status: response.status }
      },
    },
  }))
  const actionStore = $derived.by(() => new ClientActionStore<JsonObject>({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
          endpoint: `${endpoint}/action`,
          idempotencyKey: request.idempotencyKey,
          panelId: data.panel.manifest.id,
          payload: {
            actionId: request.actionId,
            idempotencyKey: request.idempotencyKey,
            input: request.input,
            mount: request.mount,
            recordIds: toJsonValue(request.recordIds ?? []),
            resourceId: resource?.id ?? '',
            source: pageType,
          },
          signal: requestSignal(requestController.signal, signal),
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        return { effects: [], items: [], result: response.data, status: 'succeeded' }
      },
    },
  }))
  let submitError = $state<string | null>(null)

  $effect(() => {
    loadedRelations = relationManagers(data.page.data.relations)
  })

  $effect(() => {
    loadedGroups = tableGroups(data.page.data.groups)
    loadedSummaries = tableSummaries(data.page.data.summaries)
  })

  $effect(() => {
    if (persistedRouteIdentifier === '') persistedRouteIdentifier = recordRouteIdentifier(record)
  })

  $effect(() => {
    for (const store of optionStores.values()) void store.preload()
  })

  $effect(() => {
    const unsubscribers = [...uploadStores.entries()].map(([path, upload]) => upload.subscribe(snapshot => {
      const stored = snapshot.items.flatMap(item => item.status === 'stored' && item.sessionId && item.token ? [{ id: item.id, sessionId: item.sessionId, token: item.token }] : [])
      const policy = resource?.fields.find(field => field.path === path)?.properties?.uploadPolicy
      form.set(path, uploadPolicy(policy)?.maximumFiles === 1 ? stored[0] ?? '' : stored)
    }))
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      for (const upload of uploadStores.values()) upload.reset()
    }
  })

  $effect(() => {
    const controller = requestController
    const activeForm = form
    const activeActionStore = actionStore
    return () => {
      controller.abort()
      activeForm.cancelRequests()
      while (activeActionStore.activeFrame) activeActionStore.close()
    }
  })

  function requestSignal(owner: AbortSignal, operation?: AbortSignal): AbortSignal {
    return operation ? AbortSignal.any([owner, operation]) : owner
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

  function uploadPolicy(value: unknown): UploadPolicy | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UploadPolicy : null
  }

  function recordIdentifier(item: Readonly<Record<string, unknown>> | null): number | string {
    const value = resource && item ? item[resource.recordId] : undefined
    return typeof value === 'number' || typeof value === 'string' ? value : ''
  }

  function recordRouteValue(item: Readonly<Record<string, unknown>> | null): string {
    return encodedRouteIdentifier(recordRouteIdentifier(item))
  }

  function encodedRouteIdentifier(value: number | string): string {
    return value === '' ? '' : encodeURIComponent(String(value))
  }

  function recordRouteIdentifier(item: Readonly<Record<string, unknown>> | null): number | string {
    return resource ? resourceOperationIdentifier(item, resource.routeKey) : ''
  }

  function displayValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    const serialized = toJsonValue(value)
    return typeof serialized === 'object' ? JSON.stringify(serialized) : String(serialized ?? '')
  }

  function relationFields(value: JsonValue | undefined): NonNullable<SvelteRelationManagerRendererProps['managers'][number]['fields']> {
    if (!Array.isArray(value)) return []
    return value.flatMap((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field) || typeof field.id !== 'string' || typeof field.type !== 'string' || !['date-time', 'number', 'text', 'textarea', 'toggle'].includes(field.type)) return []
      return [{ id: field.id, label: typeof field.label === 'string' ? field.label : field.id, required: field.required === true, type: field.type as 'date-time' | 'number' | 'text' | 'textarea' | 'toggle' }]
    })
  }

  function relationManagers(value: JsonValue | undefined): SvelteRelationManagerRendererProps['managers'] {
    if (!Array.isArray(value)) return []
    return value.flatMap((manager) => {
      if (!manager || typeof manager !== 'object' || Array.isArray(manager) || typeof manager.id !== 'string' || typeof manager.label !== 'string') return []
      const presentation = String(manager.presentation)
      if (!['groupedTabs', 'inline', 'page', 'tabs'].includes(presentation)) return []
      const relationRecords = Array.isArray(manager.records) ? manager.records.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || !item.values || typeof item.values !== 'object' || Array.isArray(item.values) || (typeof item.id !== 'number' && typeof item.id !== 'string')) return []
        return [{ id: item.id, values: item.values }]
      }) : []
      return [{
        badge: typeof manager.badge === 'number' || typeof manager.badge === 'string' ? manager.badge : null,
        columns: Array.isArray(manager.columns) ? manager.columns.flatMap(column => column && typeof column === 'object' && !Array.isArray(column) && typeof column.key === 'string' ? [{ key: column.key, label: typeof column.label === 'string' ? column.label : column.key }] : []) : [],
        fields: relationFields(manager.fields),
        group: typeof manager.group === 'string' ? manager.group : null,
        id: manager.id,
        label: manager.label,
        operations: Array.isArray(manager.operations) ? manager.operations.filter(operation => typeof operation === 'string') as SvelteRelationManagerRendererProps['managers'][number]['operations'] : [],
        presentation: presentation as SvelteRelationManagerRendererProps['managers'][number]['presentation'],
        pivotFields: relationFields(manager.pivotFields),
        records: relationRecords,
        url: typeof manager.url === 'string' ? manager.url : null,
        visible: manager.visible !== false,
      }]
    })
  }

  function recordValue(value: Record<string, unknown>, path: string): unknown {
    let current: unknown = value
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
      current = Reflect.get(current, segment)
    }
    return current
  }

  function executableTableAction(actions: readonly SvelteTableActionItem[], id: string): (SvelteTableAction & { readonly kind?: string }) | null {
    for (const action of actions) {
      if ('kind' in action && action.kind === 'action-group') {
        const nested = executableTableAction(action.actions, id)
        if (nested) return nested
      } else if (action.id === id) {
        return action as SvelteTableAction & { readonly kind?: string }
      }
    }
    return null
  }

  function setRecordValue(value: Record<string, unknown>, path: string, next: unknown): void {
    const segments = path.split('.')
    let current = value
    for (const segment of segments.slice(0, -1)) {
      const child = current[segment]
      const nested = child && typeof child === 'object' && !Array.isArray(child) ? { ...child } : {}
      current[segment] = nested
      current = nested
    }
    const final = segments.at(-1)
    if (final) current[final] = next
  }

  function entryStore(definition: JsonObject, value: Record<string, unknown>): SvelteEntryStore {
    const path = typeof definition.path === 'string' ? definition.path : ''
    const state = toJsonValue(recordValue(value, path))
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
      properties: definition.properties && typeof definition.properties === 'object' && !Array.isArray(definition.properties) ? definition.properties : {},
      state,
      tooltip: null,
      type: typeof definition.type === 'string' ? definition.type : 'text',
      url: null,
    }
    return { snapshot, subscribe: () => () => undefined }
  }

  function tableSummaries(value: JsonValue | undefined): readonly SvelteTableSummary[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || typeof item.label !== 'string') return []
      const summaryValue = item.value && typeof item.value === 'object' ? JSON.stringify(item.value) : item.value ?? ''
      return [{ id: item.id, label: item.label, value: summaryValue }]
    })
  }

  function tableGroups(value: JsonValue | undefined): readonly SvelteTableGroup<Record<string, unknown>>[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.key !== 'string' || typeof item.title !== 'string') return []
      return [{
        collapsed: item.collapsed === true,
        collapsible: item.collapsible === true,
        description: typeof item.description === 'string' ? item.description : null,
        key: item.key,
        records: jsonRecords(item.records),
        summaries: tableSummaries(item.summaries),
        title: item.title,
      }]
    })
  }

  function optionValues(definition: ResourceOptions): readonly (number | string)[] {
    if (!definition.dependsOn) return definition.values
    const dependency = $formState.values[definition.dependsOn]
    return definition.valuesByDependency[String(dependency ?? '')] ?? []
  }

  function optionStore(fieldId: string, definition: ResourceOptions): OptionStore<number | string> {
    const values = optionValues(definition)
    const available = values.map(value => ({ label: String(value), value }))
    const page = { hasMore: false, options: available, page: 1, perPage: 25, total: available.length }
    const dependencies = definition.dependsOn ? { [definition.dependsOn]: toJsonValue(recordValue($formState.values, definition.dependsOn)) } : {}
    return new OptionStore<number | string>({
      dependencies,
      fieldId,
      locale: 'en',
      panelId: data.panel.manifest.id,
      requiredDependencies: definition.dependsOn ? [definition.dependsOn] : [],
      resourceId: resource?.id ?? '',
      tenantKey: String(data.panel.actor.id ?? ''),
      transport: {
        async hydrateSelected(request, selected, signal) {
          if (!definition.server) return available.filter(option => selected.includes(option.value))
          const response = await optionRequest(fieldId, 'hydrate', request, selected, signal)
          return response.options
        },
        async list(request, signal) {
          if (!definition.server) return page
          return await optionRequest(fieldId, 'list', request, [], signal)
        },
        async validateSelection(request, selected, signal) {
          if (!definition.server) return selected.every(value => available.some(option => option.value === value))
          return (await optionRequest(fieldId, 'validate', request, selected, signal)).valid === true
        },
        ...(definition.server && definition.canCreate ? {
          async create(request, label, signal) {
            const response = await optionRequest(fieldId, 'create', request, [], signal, label)
            if (!response.option) throw new Error('The created option response is invalid')
            return response.option
          },
        } : {}),
        ...(definition.server && definition.canEdit ? {
          async edit(request, value, label, signal) {
            const response = await optionRequest(fieldId, 'edit', request, [], signal, label, value)
            if (!response.option) throw new Error('The edited option response is invalid')
            return response.option
          },
        } : {}),
      },
    })
  }

  async function optionRequest(
    fieldId: string,
    action: 'create' | 'edit' | 'hydrate' | 'list' | 'validate',
    request: Readonly<{ readonly dependencies: Readonly<Record<string, JsonValue>>, readonly page: number, readonly perPage: number, readonly search: string }>,
    selectedValues: readonly (number | string)[],
    signal: AbortSignal,
    label?: string,
    value?: number | string,
  ): Promise<{ readonly hasMore: boolean, readonly option?: { readonly label: string, readonly value: number | string }, readonly options: readonly { readonly label: string, readonly value: number | string }[], readonly page: number, readonly perPage: number, readonly total?: number, readonly valid?: boolean }> {
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, {
      endpoint: `${endpoint}/options`,
      panelId: data.panel.manifest.id,
      payload: { action, dependencies: toJsonValue(request.dependencies), fieldId, page: request.page, perPage: request.perPage, resourceId: resource?.id ?? '', search: request.search, selectedValues: toJsonValue(selectedValues), values: toJsonValue($formState.values), ...(label ? { label } : {}), ...(typeof value === 'number' || typeof value === 'string' ? { value } : {}) },
      signal: requestSignal(requestController.signal, signal),
    })
    await effects.apply(response)
    if (!response.ok) throw new Error(response.error.message)
    const options = Array.isArray(response.data.options) ? response.data.options.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const label = item.label
      const value = item.value
      return typeof label === 'string' && (typeof value === 'number' || typeof value === 'string') ? [{ label, value }] : []
    }) : []
    const optionValue = response.data.option
    const option = optionValue && typeof optionValue === 'object' && !Array.isArray(optionValue) && typeof optionValue.label === 'string' && (typeof optionValue.value === 'number' || typeof optionValue.value === 'string')
      ? { label: optionValue.label, value: optionValue.value }
      : undefined
    return { hasMore: response.data.hasMore === true, ...(option ? { option } : {}), options, page: typeof response.data.page === 'number' ? response.data.page : request.page, perPage: typeof response.data.perPage === 'number' ? response.data.perPage : request.perPage, ...(typeof response.data.total === 'number' ? { total: response.data.total } : {}), ...(typeof response.data.valid === 'boolean' ? { valid: response.data.valid } : {}) }
  }

  async function submit(): Promise<void> {
    if (!resource) return
    submitError = null
    try {
      await form.submit(async context => {
        const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'form-submit', supportsIdempotency: true }, {
          endpoint: `${endpoint}/form-submit`,
          panelId: data.panel.manifest.id,
          payload: {
            intent: pageType === 'create' ? 'create' : 'update',
            recordId: recordRouteIdentifier(record),
            resourceId: resource.id,
            source: 'table',
            values: toJsonValue(context.values),
          },
          signal: requestSignal(requestController.signal, context.signal),
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        const savedRecord = jsonRecord(response.data.record)
        const nextRouteIdentifier = resourceOperationIdentifier(savedRecord, resource.routeKey)
        if (nextRouteIdentifier !== '') {
          persistedRouteIdentifier = nextRouteIdentifier
          const redirect = pageType === 'create'
            ? data.panel.manifest.runtime?.resourceCreatePageRedirect ?? 'edit'
            : data.panel.manifest.runtime?.resourceEditPageRedirect ?? null
          if (redirect) {
            const encodedIdentifier = encodedRouteIdentifier(nextRouteIdentifier)
            const target = redirect === 'index' ? resource.basePath : redirect === 'view' ? `${resource.basePath}/${encodedIdentifier}` : `${resource.basePath}/${encodedIdentifier}/edit`
            await goto(target)
          } else if (pageType === 'edit') {
            const nextRoute = resourceRoute(resource.routes.edit, encodedRouteIdentifier(nextRouteIdentifier))
            if (nextRoute) globalThis.history.replaceState(null, '', nextRoute)
          }
        }
        return { commitValues: true }
      })
    } catch (cause) {
      submitError = cause instanceof Error ? cause.message : 'Unable to save record'
    }
  }

  async function runRelation(request: Parameters<NonNullable<SvelteRelationManagerRendererProps['onOperation']>>[0]): Promise<void> {
    if (!resource) throw new Error('Relation operations require resource metadata')
    const ownerId = currentRouteIdentifier
    if (ownerId === '') throw new Error('Relation operations require a persisted owner record')
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
      endpoint: `${endpoint}/action`,
      panelId: data.panel.manifest.id,
      payload: {
        intent: 'relation',
        managerId: request.managerId,
        ownerId,
        ...(request.pivot ? { pivot: toJsonValue(request.pivot) } : {}),
        ...(typeof request.recordId === 'number' || typeof request.recordId === 'string' ? { relatedId: request.recordId } : {}),
        relationOperation: request.operation,
        resourceId: resource.id,
        ...(request.values ? { values: toJsonValue(request.values) } : {}),
      },
      signal: requestController.signal,
    })
    await effects.apply(response)
    if (!response.ok) throw new Error(response.error.message)
    loadedRelations = relationManagers(response.data.relations)
  }

  async function loadRelationOptions(managerId: string, search: string): Promise<readonly { readonly label: string, readonly value: number | string }[]> {
    if (!resource) throw new Error('Relation options require resource metadata')
    const ownerId = currentRouteIdentifier
    if (ownerId === '') throw new Error('Relation options require a persisted owner record')
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, {
      endpoint: `${endpoint}/options`,
      panelId: data.panel.manifest.id,
      payload: { ownerId, relationManagerId: managerId, resourceId: resource.id, search },
      signal: requestController.signal,
    })
    await effects.apply(response)
    if (!response.ok) throw new Error(response.error.message)
    return Array.isArray(response.data.options) ? response.data.options.flatMap(option => option && typeof option === 'object' && !Array.isArray(option) && typeof option.label === 'string' && (typeof option.value === 'number' || typeof option.value === 'string') ? [{ label: option.label, value: option.value }] : []) : []
  }

  async function refreshTable(): Promise<void> {
    if (!resource) return
    const query = table.query
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'table-data' }, {
      endpoint: `${endpoint}/table-data`,
      panelId: data.panel.manifest.id,
      payload: { filters: toJsonValue(query.filters), page: query.page, perPage: query.perPage, resourceId: resource.id, search: query.search, sort: toJsonValue(query.sort) },
      signal: requestController.signal,
    })
    await effects.apply(response)
    if (!response.ok) {
      table.applyError(query.queryVersion, { code: response.error.code, message: response.error.message })
      return
    }
    const nextRecords = jsonRecords(response.data.records)
    const total = typeof response.data.total === 'number' ? response.data.total : nextRecords.length
    loadedGroups = tableGroups(response.data.groups)
    loadedSummaries = tableSummaries(response.data.summaries)
    table.applyData({ queryVersion: query.queryVersion, records: nextRecords, total })
  }
</script>

{#if !resource}
  <div role="alert">Resource page metadata is unavailable.</div>
{:else if pageType === 'list'}
  <div class="hp-resource-page">
    {#if createRoute && resource.recordActions.some(action => action.kind === 'create' && data.page.manifest.actions.header.includes(action.id))}
      {@const createAction = resource.recordActions.find(action => action.kind === 'create')}
      <PanelsPageActions to={pageActionsTarget}><Button class="hp-button hp-action-trigger" data-action-id={createAction?.id} data-color={createAction?.color ?? undefined} href={createRoute}>{#if createAction?.icon}<Icon name={createAction.icon} />{/if}<span>{createAction?.label ?? resource.createLabel}</span></Button></PanelsPageActions>
    {/if}
  <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />
  <SvelteTableRenderer table={{
    actions: rowActions,
    actionTransport: {
      async execute(request, signal) {
        const action = executableTableAction(resource.tableActions, request.actionId)
        if (!action) throw new Error('Resource action is unavailable')
        const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
          endpoint: `${endpoint}/action`,
          idempotencyKey: globalThis.crypto.randomUUID(),
          panelId: data.panel.manifest.id,
          payload: {
            actionId: request.actionId,
            idempotencyKey: globalThis.crypto.randomUUID(),
            intent: action.kind ?? request.actionId,
            mount: action.scope === 'bulk' ? 'bulk' : 'record',
            recordIds: toJsonValue(request.selection?.mode === 'explicit'
              ? request.selection.recordIds
              : resourceOperationIdentifiers(records, resource.recordId, resource.routeKey, request.recordId)),
            resourceId: resource.id,
          },
          signal: requestSignal(requestController.signal, signal),
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        await refreshTable()
      },
    },
    caption: resource.label,
    panelId: data.panel.manifest.id,
    columns: resource.columns,
    filterPresentation: {
      columns: { default: 2 },
      id: `${resource.id}-filters`,
      placement: 'dropdown',
      schema: { components: [], id: `${resource.id}-filters`, kind: 'schema' },
      slots: {},
    },
    filters: resource.filters,
    getRecordActionUrl: (action, item) => {
      const manifest = resource.actions.find(candidate => candidate.id === action.id)
      const kind = manifest?.kind ?? (action.id === `${resource.id}.view` ? 'view' : action.id === `${resource.id}.edit` ? 'edit' : null)
      return kind === 'view' || kind === 'edit'
        ? resourceRoute(kind === 'edit' ? resource.routes.edit : resource.routes.view, recordRouteValue(item))
        : null
    },
    getRecordId: recordIdentifier,
    groups: renderedGroups,
    onQueryChange: () => { void refreshTable() },
    store: table,
    summaries: renderedSummaries,
  }} />
  <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />
  </div>
{:else if pageType === 'create' || pageType === 'edit'}
  {#if pageType === 'edit' && currentRouteIdentifier !== ''}
    <PanelsPageActions to={pageActionsTarget}>
      {#each resource.recordActions.filter(action => action.visible && data.page.manifest.actions.header.includes(action.id)) as action (action.id)}
        {#if action.kind === 'view' && viewRoute}
          <Button class="hp-button hp-action-trigger" data-action-id={action.id} data-color={action.color ?? undefined} href={viewRoute} variant="outline">{#if action.icon}<Icon name={action.icon} />{/if}<span>{action.label}</span></Button>
        {:else if action.kind !== 'edit' && action.kind !== 'create'}
          <SvelteActionRenderer {action} panelId={data.panel.manifest.id} recordIds={[currentRouteIdentifier]} store={actionStore} />
        {/if}
      {/each}
    </PanelsPageActions>
  {/if}
  <form class="hp-resource-form hp:grid hp:gap-6" onsubmit={(event) => { event.preventDefault(); void submit() }}>
    <Card>
      <CardContent class="hp:grid hp:gap-6 hp:pt-6">{#each resource.fields as definition (definition.path)}<FieldRenderer {definition} {form} collectionStore={collectionStores.get(definition.path)} optionStore={optionStores.get(definition.path)} panelId={data.panel.manifest.id} uploadStore={uploadStores.get(definition.path)} />{/each}</CardContent>
      <CardFooter class="hp:justify-end"><Button class="hp-form-actions hp-button hp-button-primary" disabled={form.state.submitting} type="submit">{form.state.submitting ? 'Saving…' : resource.saveLabel}</Button></CardFooter>
    </Card>
  </form>
  {#if submitError}<div role="alert">{submitError}</div>{/if}
  {#if relations.length > 0}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} /><SvelteRelationManagerRenderer relations={{ loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation, panelId: data.panel.manifest.id }} /><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />{/if}
{:else if pageType === 'view' && record}
  <article class="hp-resource-view"><div class="hp-infolist">
    {#each resource.entries as definition (String(definition.id ?? definition.path))}
      <EntryRenderer panelId={data.panel.manifest.id} store={entryStore(definition, record)} />
    {/each}
  </div>
  {#if editRoute && resource.recordActions.some(action => action.kind === 'edit' && data.page.manifest.actions.header.includes(action.id))}
    {@const editAction = resource.recordActions.find(action => action.kind === 'edit')}
    <PanelsPageActions to={pageActionsTarget}><Button class="hp-button hp-action-trigger" data-action-id={editAction?.id} data-color={editAction?.color ?? undefined} href={editRoute} variant="outline">{#if editAction?.icon}<Icon name={editAction.icon} />{/if}<span>{editAction?.label ?? `Edit ${resource.label}`}</span></Button></PanelsPageActions>
  {/if}
  <PanelsPageActions to={pageActionsTarget}>
    {#each resource.recordActions.filter(action => action.mount === 'record' && action.visible && action.kind !== 'edit' && action.kind !== 'view' && action.kind !== 'create') as action (action.id)}
      <SvelteActionRenderer {action} panelId={data.panel.manifest.id} recordIds={[recordRouteIdentifier(record)]} store={actionStore} />
    {/each}
  </PanelsPageActions>
  {#if relations.length > 0}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} /><SvelteRelationManagerRenderer relations={readOnlyRelations ? { managers: relations, panelId: data.panel.manifest.id } : { loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation, panelId: data.panel.manifest.id }} /><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />{/if}
  </article>
{/if}
