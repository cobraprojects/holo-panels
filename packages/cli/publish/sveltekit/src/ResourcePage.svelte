<script lang="ts">
  import {
    ClientActionStore,
    ClientEffectSession,
    FieldRenderer,
    FormStore,
    OptionStore,
    PanelsTransport,
    SvelteActionRenderer,
    SvelteTableRenderer,
    TableStateStore,
    toJsonValue,
    toSvelteState,
    type JsonObject,
    type JsonValue,
  } from '@holo-js/panels-svelte'
  import type { PanelPageData } from './contracts'
  import {
    jsonRecord,
    jsonRecords,
    resourcePageMetadata,
    resourceRoute,
    slugValue,
    type ResourceOptions,
  } from './resource-page'

  let { data, effects }: { readonly data: PanelPageData, readonly effects: ClientEffectSession } = $props()
  const endpoint = $derived(`/_holo/panels/${data.panel.manifest.id}`)
  const pageType = $derived(data.page.manifest.pageType)
  const resource = $derived(resourcePageMetadata(data.page.data.resource))
  const record = $derived(jsonRecord(data.page.data.record))
  const records = $derived(jsonRecords(data.page.data.records))
  const createRoute = $derived(resource?.routes.create ?? null)
  const editRoute = $derived(resourceRoute(resource?.routes.edit ?? null, recordRouteValue(record)))
  const initialValues = $derived.by(() => Object.fromEntries((resource?.fields ?? []).map(field => [field.path, record?.[field.path] ?? ''])))
  const form = $derived.by(() => new FormStore<Record<string, unknown>>(initialValues, {
    dependencies: (resource?.dependencies ?? []).map(dependency => ({
      id: dependency.id,
      paths: [dependency.source],
      recompute: context => {
        if (!context.changedPaths.has(dependency.source)) return []
        return [{
          kind: 'set' as const,
          path: dependency.target,
          value: dependency.kind === 'slug' ? slugValue(context.get(dependency.source)) : null,
        }]
      },
    })),
  }))
  const formState = $derived.by(() => toSvelteState(form))
  const optionStores = $derived.by(() => new Map(Object.entries(resource?.options ?? {}).map(([path, definition]) => [path, optionStore(path, definition)])))
  const table = $derived.by(() => new TableStateStore<Record<string, unknown>, number | string>({
    panelId: data.panel.manifest.id,
    records,
    tableId: resource?.id ?? data.page.manifest.id,
    total: records.length,
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
            input: request.input,
            recordIds: toJsonValue(request.recordIds ?? []),
            resourceId: resource?.id ?? '',
          },
          signal,
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        return { effects: [], items: [], result: response.data, status: 'succeeded' }
      },
    },
  }))
  let submitError = $state<string | null>(null)

  $effect(() => {
    for (const store of optionStores.values()) void store.preload()
  })

  function recordIdentifier(item: Readonly<Record<string, unknown>> | null): number | string {
    const value = resource && item ? item[resource.recordId] : undefined
    return typeof value === 'number' || typeof value === 'string' ? value : ''
  }

  function recordRouteValue(item: Readonly<Record<string, unknown>> | null): string {
    const value = resource && item ? item[resource.routeKey] : undefined
    return typeof value === 'number' || typeof value === 'string' ? encodeURIComponent(String(value)) : ''
  }

  function displayValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    const serialized = toJsonValue(value)
    return typeof serialized === 'object' ? JSON.stringify(serialized) : String(serialized ?? '')
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
    const dependencies = definition.dependsOn ? { [definition.dependsOn]: toJsonValue($formState.values[definition.dependsOn]) } : {}
    return new OptionStore<number | string>({
      dependencies,
      fieldId,
      locale: 'en',
      panelId: data.panel.manifest.id,
      requiredDependencies: definition.dependsOn ? [definition.dependsOn] : [],
      resourceId: resource?.id ?? '',
      tenantKey: String(data.panel.actor.id ?? ''),
      transport: {
        hydrateSelected: async (_request, selected) => available.filter(option => selected.includes(option.value)),
        list: async () => page,
        validateSelection: async (_request, selected) => selected.every(value => available.some(option => option.value === value)),
      },
    })
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
            recordId: recordIdentifier(record),
            resourceId: resource.id,
            values: toJsonValue(context.values),
          },
          signal: context.signal,
        })
        await effects.apply(response)
        if (!response.ok) throw new Error(response.error.message)
        return { commitValues: true }
      })
    } catch (cause) {
      submitError = cause instanceof Error ? cause.message : 'Unable to save record'
    }
  }

  async function refreshTable(): Promise<void> {
    if (!resource) return
    const query = table.query
    const response = await transport.execute<JsonObject, JsonObject>({ kind: 'read', name: 'table-data' }, {
      endpoint: `${endpoint}/table-data`,
      panelId: data.panel.manifest.id,
      payload: { filters: toJsonValue(query.filters.values), resourceId: resource.id, search: query.search, sort: toJsonValue(query.sort) },
    })
    await effects.apply(response)
    if (!response.ok) {
      table.applyError(query.queryVersion, { code: response.error.code, message: response.error.message })
      return
    }
    const nextRecords = jsonRecords(response.data.records)
    const total = typeof response.data.total === 'number' ? response.data.total : nextRecords.length
    table.applyData({ queryVersion: query.queryVersion, records: nextRecords, total })
  }
</script>

{#if !resource}
  <div role="alert">Resource page metadata is unavailable.</div>
{:else if pageType === 'list'}
  {#if createRoute && data.page.manifest.actions.header.includes(`${resource.id}.create`)}
    <a href={createRoute}>{resource.createLabel}</a>
  {/if}
  <SvelteTableRenderer table={{
    caption: resource.label,
    columns: resource.columns,
    getRecordId: recordIdentifier,
    onQueryChange: () => { void refreshTable() },
    store: table,
  }} />
  <ul aria-label={`${resource.label} record navigation`}>
    {#each records as item (recordIdentifier(item))}
      {@const routeValue = recordRouteValue(item)}
      {@const viewRoute = resourceRoute(resource.routes.view, routeValue)}
      {@const rowEditRoute = resourceRoute(resource.routes.edit, routeValue)}
      <li>
        {#if viewRoute}<a href={viewRoute}>View {displayValue(item[resource.routeKey])}</a>{/if}
        {#if rowEditRoute}<a href={rowEditRoute}>Edit {displayValue(item[resource.routeKey])}</a>{/if}
      </li>
    {/each}
  </ul>
{:else if pageType === 'create' || pageType === 'edit'}
  <form onsubmit={(event) => { event.preventDefault(); void submit() }}>
    {#each resource.fields as definition (definition.path)}
      <FieldRenderer {definition} {form} optionStore={optionStores.get(definition.path)} panelId={data.panel.manifest.id} />
    {/each}
    <button disabled={form.state.submitting} type="submit">{form.state.submitting ? 'Saving…' : resource.saveLabel}</button>
  </form>
  {#if submitError}<div role="alert">{submitError}</div>{/if}
{:else if pageType === 'view' && record}
  <dl>
    {#each resource.fields as definition (definition.path)}
      <dt>{definition.label}</dt><dd>{displayValue(record[definition.path])}</dd>
    {/each}
  </dl>
  {#if editRoute && data.page.manifest.actions.header.includes(`${resource.id}.edit`)}
    <a href={editRoute}>Edit {resource.label}</a>
  {/if}
  {#each resource.actions.filter(action => action.mount === 'record' && action.visible) as action (action.id)}
    <SvelteActionRenderer {action} panelId={data.panel.manifest.id} recordIds={[recordIdentifier(record)]} store={actionStore} />
  {/each}
{/if}
