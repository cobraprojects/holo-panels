<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Card, CardContent, CardFooter } from '@holo-js/panels-svelte/ui/card'
  import {
    ClientActionStore,
    resolveTableActionManifest,
    relationActionPayload,
    relationActionPresentation,
    ClientEffectSession,
    CollectionStore,
    createBrowserUploadAdapter,
    decodeFormOperationPaths,
    decodeFormSetOperations,
    bindUploadStore,
    uploadFormPatch,
    createUploadStore,
    EntryRenderer,
    ResourceForm,
    FormStore,
    formValidationErrors,
    formValidationFailure,
    PanelsTransportError,
    OptionStore,
    PanelsTransport,
    PanelsPageActions,
    PanelsRenderHook,
    PanelsRenderHookRenderer,
    publishPanelActionFailure,
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
    SvelteComponentRegistry as ComponentRegistry,
    type SvelteRelationManagerRendererProps,
    type SvelteTableGroup,
    type SvelteTableAction,
    type SvelteTableActionItem,
    type SvelteTableSummary,
    type UploadPolicy,
  } from '@holo-js/panels-svelte'
  import type { PanelPageData } from './contracts'
  import {
    actionManifest,
    jsonRecord,
    jsonRecords,
    resourcePageMetadata,
    resourceFieldDefinition,
    resourceOptionsFromFields,
    resourceSchemaManifest,
    resourceOperationIdentifier,
      resourceRoute,
    slugValue,
    type ResourcePageMetadata,
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
  let resolvedFields = $state<ResourcePageMetadata['fields'] | null>(null)
  let resolvedSchema = $state<ResourcePageMetadata['schema'] | null>(null)
  let resolvedOptions = $state<ResourcePageMetadata['options'] | null>(null)
  const renderedFields = $derived(resolvedFields ?? resource?.fields ?? [])
  const renderedSchema = $derived(resolvedSchema ?? resource?.schema)
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
  let loadedActionData = $state<JsonObject | null>(null)
  const actionData = $derived(loadedActionData ?? data.page.data)
  const renderedGroups = $derived(loadedGroups ?? tableGroups(data.page.data.groups))
  const renderedSummaries = $derived(loadedSummaries ?? tableSummaries(data.page.data.summaries))
  const rowActions = $derived.by(() => {
    if (!resource) return []
    const configured = resource.tableActions
    const resolve = (items: readonly SvelteTableActionItem[]): readonly SvelteTableActionItem[] => items.map(item => 'kind' in item && item.kind === 'action-group'
      ? { ...item, actions: resolve(item.actions) as readonly SvelteTableAction[] }
      : { ...item, ...(Array.isArray(actionData.tableActions) ? { resolveManifest: (id?: string | number) => resolveTableActionManifest(actionData, item.id, id === undefined ? undefined : id) } : {}) })
    return resolve(configured)
  })
  const initialValues = $derived.by(() => {
    const values: Record<string, unknown> = {}
    for (const field of resource?.fields ?? []) setRecordValue(values, field.path, recordValue(record ?? {}, field.path) ?? field.properties?.defaultValue ?? '')
    return values
  })
  const form = $derived.by(() => new FormStore<Record<string, unknown>>(initialValues, {
    fields: resource?.fields ?? [],
    dependencies: (resource?.dependencies ?? []).map(dependency => ({
      id: dependency.id,
      paths: [dependency.source],
      recompute: context => {
        if (!context.changedPaths.has(dependency.source) || context.editedPaths.has(dependency.target)) return []
        return [{
          kind: 'set' as const,
          path: dependency.target,
          value: dependency.kind === 'slug' ? slugValue(context.get(dependency.source)) : null,
        }]
      },
    })),
  }))
  const formState = $derived.by(() => toSvelteState(form))
  let reactiveFormValues = $state<Record<string, unknown>>({})
  const componentRegistry = $derived(registry ?? new ComponentRegistry())
  onMount(() => {
    const preventUnload = (event: BeforeUnloadEvent): void => {
      if (!data.panel.manifest.runtime?.unsavedChangesAlerts || form.state.dirtyPaths.length === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  })
  const optionStores = $derived.by(() => new Map(Object.entries(resolvedOptions ?? resource?.options ?? {}).map(([path, definition]) => [path, optionStore(path, definition)])))
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
    selection: resource?.selection,
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
  $effect(() => {
    if (!resource || pageType !== 'create' && pageType !== 'edit') return
    let controller: AbortController | null = null
    let previousValues: JsonObject | null = null
    const refresh = (nextValues: Record<string, unknown>): void => {
      const values = toJsonValue(nextValues)
      if (!values || typeof values !== 'object' || Array.isArray(values)) return
      controller?.abort()
      controller = new AbortController()
      const active = controller
      const lifecycleValues = previousValues
      previousValues = values
      void transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'options' }, {
        endpoint: `${endpoint}/options`,
        panelId: data.panel.manifest.id,
        payload: {
          action: 'schema',
          formOperation: pageType,
          lifecycle: lifecycleValues ? 'update' : 'hydrate',
          ...(lifecycleValues ? { previousValues: lifecycleValues } : {}),
          ...(currentRouteIdentifier === '' ? {} : { record: currentRouteIdentifier }),
          resourceId: resource.id,
          values,
        },
        signal: requestSignal(requestController.signal, active.signal),
      }).then((response) => {
        if (!response.ok) throw new Error(response.error.message)
        const fields = Array.isArray(response.data.fields) ? response.data.fields : null
        const schema = resourceSchemaManifest(response.data.schema)
        const nextFields = fields?.flatMap(field => resourceFieldDefinition(field) ?? []) ?? []
        const operationPaths = decodeFormOperationPaths(response.data.operationPaths)
        const operations = decodeFormSetOperations(response.data.operations, operationPaths ?? new Set([...(resource?.fields ?? []), ...nextFields].map(field => field.path)))
        if (!fields || !schema || !operations) throw new Error('Resolved form schema response is invalid')
        resolvedFields = nextFields
        resolvedOptions = resourceOptionsFromFields(fields)
        resolvedSchema = schema
        if (operations.length > 0) form.batch(operations, { notifyReactivity: false })
        const patchedValues = toJsonValue(form.state.values)
        if (patchedValues && typeof patchedValues === 'object' && !Array.isArray(patchedValues)) previousValues = patchedValues
      }).catch(() => {
        if (!active.signal.aborted) publishPanelActionFailure(data.panel.manifest.id)
      })
    }
    reactiveFormValues = form.state.values
    refresh(form.state.values)
    const unsubscribe = form.subscribeReactivity((state) => {
      reactiveFormValues = state.values
      refresh(state.values)
    })
    return () => {
      unsubscribe()
      controller?.abort()
    }
  })
  const actionStore = $derived(createActionStore(pageType))
  const formInput: JsonObject = $derived(Object.fromEntries(Object.entries($formState.values).map(([key, value]) => [key, toJsonValue(value)])))
  const formActionStore = $derived(new ClientActionStore({
    createIdempotencyKey: () => globalThis.crypto.randomUUID(),
    transport: {
      execute: (request, signal) => submit(request.actionId, request.idempotencyKey, request.input, signal),
    },
  }))
  $effect(() => {
    const current = formActionStore
    return () => {
      while (current.activeFrame) current.close()
    }
  })
  const entryHosts = $derived((resource?.entries ?? []).map(definition => ({
    actions: Array.isArray(definition.actionManifests) ? definition.actionManifests.flatMap(value => { const action = actionManifest(value); return action ? [action] : [] }) : [],
    definition,
    store: createActionStore(`infolist:${definition.path}`),
  })))
  let fieldActionVersion = $state(0)
  const fieldActionHosts = $derived(renderedFields.flatMap((definition) => {
    const properties = definition.properties ?? {}
    const mount = pageType === 'create' ? 'page' : 'record'
    const actions = ['hintAction', 'prefixAction', 'suffixAction'].flatMap((property) => {
      const value = properties[property]
      if (!value || typeof value !== 'object' || Array.isArray(value)) return []
      const action = actionManifest(toJsonValue({ ...value, mount }))
      return action ? [action] : []
    })
    if (actions.length === 0) return []
    const store = createActionStore(`form-field:${definition.path}`)
    const unsubscribe = store.subscribe(() => { fieldActionVersion++ })
    return [{ actions, path: definition.path, store, unsubscribe }]
  }))

  function createActionStore(source: string): ClientActionStore<JsonObject> {
    return new ClientActionStore<JsonObject>({
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
            source,
          },
          signal: requestSignal(requestController.signal, signal),
        }).catch((cause: unknown) => {
          publishPanelActionFailure(data.panel.manifest.id)
          throw cause
        })
        try {
          await effects.apply(response)
        } catch (cause: unknown) {
          publishPanelActionFailure(data.panel.manifest.id, response.effects)
          throw cause
        }
        if (!response.ok || response.data.status === 'partial') {
          if (!response.ok && response.error.category === 'validation') throw new PanelsTransportError(response.error)
          publishPanelActionFailure(data.panel.manifest.id, response.effects)
          throw new Error(response.ok ? 'The action could not be completed for every record.' : response.error.message)
        }
        if (source === 'list' || source === 'manage') await refreshTable()
        return { effects: [], items: [], result: response.data, status: 'succeeded' }
      },
    },
    })
  }

  async function executeFieldAction(path: string, actionId: string): Promise<void> {
    const host = fieldActionHosts.find(candidate => candidate.path === path)
    const action = host?.actions.find(candidate => candidate.id === actionId)
    if (!host || !action || host.store.state.frames.some(frame => frame.manifest.id === actionId)) return
    const recordIds = pageType === 'create' || currentRouteIdentifier === '' ? [] : [currentRouteIdentifier]
    host.store.mount(action, formInput)
    if (!action.confirmation && !action.modal) await host.store.submit(recordIds)
  }

  function fieldActionPending(path: string, actionId: string): boolean {
    fieldActionVersion
    return fieldActionHosts.find(candidate => candidate.path === path)?.store.state.frames.some(frame => frame.manifest.id === actionId) === true
  }

  $effect(() => {
    const hosts = fieldActionHosts
    return () => {
      for (const host of hosts) {
        host.unsubscribe()
        host.store.dispose()
      }
    }
  })

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
    const unsubscribers = [...uploadStores.entries()].map(([path, upload]) => {
      const policy = resource?.fields.find(field => field.path === path)?.properties?.uploadPolicy
      return bindUploadStore(form, path, upload, uploadPolicy(policy)?.maximumFiles !== 1)
    })
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      for (const upload of uploadStores.values()) upload.reset()
    }
  })

  $effect(() => {
    const controller = requestController
    const activeForm = form
    const activeActionStore = actionStore
    const activeEntries = entryHosts
    return () => {
      controller.abort()
      activeForm.cancelRequests()
      while (activeActionStore.activeFrame) activeActionStore.close()
      for (const entry of activeEntries) while (entry.store.activeFrame) entry.store.close()
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
        ...relationActionPresentation(manager),
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
    const dependency = reactiveFormValues[definition.dependsOn]
    return definition.valuesByDependency[String(dependency ?? '')] ?? []
  }

  function optionStore(fieldId: string, definition: ResourceOptions): OptionStore<number | string> {
    const values = optionValues(definition)
    const available = values.map(value => ({ label: String(value), value }))
    const page = { hasMore: false, options: available, page: 1, perPage: 25, total: available.length }
    const dependencies = definition.dependsOn ? { [definition.dependsOn]: toJsonValue(recordValue(reactiveFormValues, definition.dependsOn) ?? null) } : {}
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
      payload: { action, dependencies: toJsonValue(request.dependencies), fieldId, page: request.page, perPage: request.perPage, resourceId: resource?.id ?? '', search: request.search, selectedValues: toJsonValue(selectedValues), values: toJsonValue(reactiveFormValues), ...(label ? { label } : {}), ...(typeof value === 'number' || typeof value === 'string' ? { value } : {}) },
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

  async function submit(actionId: string, idempotencyKey: string, values: JsonObject, signal: AbortSignal) {
    if (!resource) throw new Error('The resource form is unavailable.')
    try {
      let intent: JsonValue | undefined
      const outcome = await form.submit(async context => {
        const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'form-submit', supportsIdempotency: true }, {
          endpoint: `${endpoint}/form-submit`,
          idempotencyKey,
          panelId: data.panel.manifest.id,
          payload: {
            actionId,
            idempotencyKey,
            intent: pageType === 'create' ? 'create' : 'update',
            recordId: recordRouteIdentifier(record),
            resourceId: resource.id,
            values,
          },
          signal: requestSignal(requestController.signal, AbortSignal.any([context.signal, signal])),
        })
        await effects.apply(response)
        if (!response.ok) {
          if (response.error.category !== 'validation') publishPanelActionFailure(data.panel.manifest.id, response.effects)
          throw new PanelsTransportError(response.error)
        }
        if (response.data.status === 'partial') throw new Error('The record could not be saved.')
        intent = response.data.formIntent
        const savedRecord = jsonRecord(response.data.record)
        const nextRouteIdentifier = resourceOperationIdentifier(savedRecord, resource.routeKey)
        if (nextRouteIdentifier !== '') {
          if (intent !== 'create-another') persistedRouteIdentifier = nextRouteIdentifier
          const redirect = intent === 'create-another' ? null : pageType === 'create'
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
        return { commitValues: intent !== 'cancel' && intent !== 'create-another', ...uploadFormPatch(form, context.values, savedRecord ?? {}, resource.fields) }
      }, { validate: !resource.cancelFormActions.includes(actionId) })
      if (outcome.status === 'invalid') throw formValidationFailure(form.state.errors)
      if (intent === 'cancel' || intent === 'create-another') form.reset()
      if (intent === 'cancel') await goto(resource.basePath)
      if (outcome.status !== 'applied') throw new Error('The form submission was cancelled.')
      return { effects: [], items: [], status: 'succeeded' as const }
    } catch (cause) {
      if (!formValidationErrors(cause) && !(cause instanceof PanelsTransportError) && !signal.aborted) publishPanelActionFailure(data.panel.manifest.id)
      throw cause
    }
  }

  async function runRelation(request: Parameters<NonNullable<SvelteRelationManagerRendererProps['onOperation']>>[0], signal?: AbortSignal): Promise<void> {
    if (!resource) throw new Error('Relation operations require resource metadata')
    const ownerId = currentRouteIdentifier
    if (ownerId === '') throw new Error('Relation operations require a persisted owner record')
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
      endpoint: `${endpoint}/action`,
      idempotencyKey: request.idempotencyKey,
      panelId: data.panel.manifest.id,
      payload: {
        ...relationActionPayload(request),
        ownerId,
        resourceId: resource.id,
      },
      signal: requestSignal(requestController.signal, signal),
    })
    await effects.apply(response)
    if (!response.ok) throw new PanelsTransportError(response.error)
    if (response.data.status === 'partial') throw new Error('The relation operation could not be completed.')
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
      payload: { selection: toJsonValue(table.selectionPayload()), filters: toJsonValue(query.filters), page: query.page, perPage: query.perPage, resourceId: resource.id, search: query.search, sort: toJsonValue(query.sort) },
      signal: requestController.signal,
    })
    await effects.apply(response)
    if (!response.ok) {
      table.applyError(query.queryVersion, { code: response.error.code, message: response.error.message })
      return
    }
    const nextRecords = jsonRecords(response.data.records)
    if (query.queryVersion !== table.query.queryVersion) return
    const total = typeof response.data.total === 'number' ? response.data.total : nextRecords.length
    loadedGroups = tableGroups(response.data.groups)
    loadedActionData = response.data
    loadedSummaries = tableSummaries(response.data.summaries)
    table.applyData({ queryVersion: query.queryVersion, records: nextRecords, total, selection: response.data.selection && typeof response.data.selection === 'object' && !Array.isArray(response.data.selection) ? response.data.selection : undefined })
  }
</script>

{#if !resource}
  <div role="alert">Resource page metadata is unavailable.</div>
{:else if pageType === 'list' || pageType === 'manage'}
  <div class="hp-resource-page">
    <PanelsPageActions to={pageActionsTarget}>
      {@const actions = resource.recordActions.filter(action => action.mount === 'page' && action.visible)}
      {#if actions[0]}<SvelteActionRenderer action={actions[0]} {actions} panelId={data.panel.manifest.id} {registry} store={actionStore} />{/if}
    </PanelsPageActions>
  <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />
  <SvelteTableRenderer table={{
    actions: rowActions,
    actionTransport: {
      async execute(request, signal) {
        const action = resolveTableActionManifest(actionData, request.actionId, request.recordId) ?? executableTableAction(resource.tableActions, request.actionId)
        if (!action) throw new Error('Resource action is unavailable')
        const response = await transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
          endpoint: `${endpoint}/action`,
          idempotencyKey: request.idempotencyKey ?? globalThis.crypto.randomUUID(),
          panelId: data.panel.manifest.id,
          payload: {
            actionId: request.actionId,
            idempotencyKey: request.idempotencyKey ?? globalThis.crypto.randomUUID(),
            input: request.input ?? {},
            intent: action.kind ?? request.actionId,
            mount: request.mount ?? ('mount' in action ? action.mount : action.scope === 'bulk' ? 'bulk' : action.scope === 'header' ? 'page' : 'record'),
            ...(request.selection?.mode === 'all-matching' ? { selection: toJsonValue(request.selection) } : {}),
            recordIds: toJsonValue(request.selection?.mode === 'explicit'
              ? request.selection.recordIds
              : (request.recordId === undefined ? [] : [request.recordId])),
            resourceId: resource.id,
            source: 'table',
            tableQuery: toJsonValue(table.query),
          },
          signal: requestSignal(requestController.signal, signal),
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        if (response.data.status === 'partial') throw new Error('One or more records could not be updated.')
        await refreshTable()
      },
    },
    caption: resource.label,
    registry,
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
    getRecordId: recordRouteIdentifier,
    groups: renderedGroups,
    onQueryChange: () => { void refreshTable() },
    store: table,
    summaries: renderedSummaries,
  }} />
  <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />
  </div>
{:else if pageType === 'create' || pageType === 'edit'}
  {#if pageType === 'create' || pageType === 'edit' && currentRouteIdentifier !== ''}
    <PanelsPageActions to={pageActionsTarget}>
      {@const actions = resource.recordActions.filter(action => action.visible && action.mount === (pageType === 'create' ? 'page' : 'record'))}
      {#if actions[0]}<SvelteActionRenderer action={actions[0]} {actions} panelId={data.panel.manifest.id} recordIds={pageType === 'create' ? [] : [currentRouteIdentifier]} {registry} store={actionStore} />{/if}
    </PanelsPageActions>
  {/if}
  <form class="hp-resource-form hp:grid hp:gap-6" novalidate onsubmit={(event) => {
    event.preventDefault()
    event.currentTarget.querySelector<HTMLButtonElement>('[data-action-id]')?.click()
  }}>
    <Card>
      <CardContent class="hp:grid hp:gap-6 hp:pt-6">
        <ResourceForm actionPending={fieldActionPending} executeAction={(path: string, actionId: string) => { void executeFieldAction(path, actionId).catch(() => undefined) }} fields={renderedFields} {form} {collectionStores} {optionStores} panelId={data.panel.manifest.id} registry={componentRegistry} schema={renderedSchema} {uploadStores} />
        {#each fieldActionHosts as host (host.path)}
          {#if host.actions[0]}<SvelteActionRenderer action={host.actions[0]} actions={host.actions} input={formInput} panelId={data.panel.manifest.id} recordIds={pageType === 'create' || currentRouteIdentifier === '' ? [] : [currentRouteIdentifier]} {registry} showTriggers={false} store={host.store} />{/if}
        {/each}
      </CardContent>
      <CardFooter class="hp:justify-end">{#if resource.formActions[0]}<SvelteActionRenderer action={resource.formActions[0]} actions={resource.formActions} input={formInput} panelId={data.panel.manifest.id} {registry} store={formActionStore} />{/if}</CardFooter>
    </Card>
    {#if $formState.errors._root?.length}<ul data-form-errors="" role="alert">{#each $formState.errors._root as message}<li>{message}</li>{/each}</ul>{/if}
  </form>
  {#if relations.length > 0}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} /><SvelteRelationManagerRenderer relations={{ loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation, panelId: data.panel.manifest.id, registry }} /><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />{/if}
{:else if pageType === 'view' && record}
  <article class="hp-resource-view"><div class="hp-infolist">
    {#each entryHosts as entry (String(entry.definition.id ?? entry.definition.path))}
      <EntryRenderer actions={entry.actions} actionStore={entry.store} panelId={data.panel.manifest.id} recordIds={[recordRouteIdentifier(record)]} {registry} store={entryStore(entry.definition, record)} />
    {/each}
  </div>
  <PanelsPageActions to={pageActionsTarget}>
    {@const actions = resource.recordActions.filter(action => action.visible && action.mount === 'record')}
    {#if actions[0]}<SvelteActionRenderer action={actions[0]} {actions} panelId={data.panel.manifest.id} recordIds={[recordRouteIdentifier(record)]} {registry} store={actionStore} />{/if}
  </PanelsPageActions>
  {#if relations.length > 0}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE} manifest={data.panel.manifest} {registry} scopes={resourceScopes} /><SvelteRelationManagerRenderer relations={readOnlyRelations ? { managers: relations, panelId: data.panel.manifest.id } : { loadOptions: loadRelationOptions, managers: relations, onOperation: runRelation, panelId: data.panel.manifest.id, registry }} /><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER} manifest={data.panel.manifest} {registry} scopes={resourceScopes} />{/if}
  </article>
{/if}
