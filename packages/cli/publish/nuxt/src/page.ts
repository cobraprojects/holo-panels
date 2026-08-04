import {
  ClientActionStore,
  ClientEffectSession,
  ClientNotificationInboxStore,
  ClientToastStore,
  FormStore,
  OptionStore,
  PanelsErrorBoundary,
  PanelsLink,
  PanelsLoadingIndicator,
  PanelsTransport,
  PROTOCOL_VERSION,
  TableStateStore,
  VueActionRenderer,
  VueFieldRenderer,
  VueNotificationInboxTrigger,
  VueTableRenderer,
  VueToastViewport,
  createPanelNotificationTransport,
  createDefaultComponentRegistry,
  toJsonValue,
  type ClientActionManifest,
  type ClientNotificationRealtime,
  type JsonObject,
  type VueCompiledField,
  type VueTableAction,
  type VueTableColumn,
  type VueTableFilter,
} from '@holo-js/panels-vue'
import { defineAsyncComponent, defineComponent, h, onMounted, onUnmounted, type Component, type PropType, type VNode } from 'vue'
import type { NuxtPanelPage, NuxtPanelPageData, PanelPageProps } from './contracts'

type ResourceRecord = Record<string, unknown>
type ResourceValues = Record<string, unknown>

interface PanelPageRuntime {
  readonly effects: ClientEffectSession
  readonly transport: PanelsTransport
}

interface ResourceOption {
  readonly label: string
  readonly value: number | string
}

interface ResourceOptionSource {
  readonly dependency?: string
  readonly options: readonly ResourceOption[]
  readonly optionsByDependency?: Readonly<Record<string, readonly ResourceOption[]>>
}

interface ResourceField extends VueCompiledField<ResourceValues> {
  readonly defaultValue?: unknown
  readonly optionSource?: ResourceOptionSource
  readonly reactive?: { readonly source: string, readonly transform: 'slug' }
}

interface ResourceAction extends VueTableAction {
  readonly kind: 'delete' | 'edit' | 'view'
  readonly path?: string
}

interface ResourceRenderSchema {
  readonly actions: readonly ResourceAction[]
  readonly basePath: string
  readonly columns: readonly VueTableColumn<ResourceRecord>[]
  readonly fields: readonly ResourceField[]
  readonly filters: readonly VueTableFilter[]
  readonly recordTitle: string
  readonly resourceId: string
  readonly routeKey: string
}

const registry = createDefaultComponentRegistry()

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPath(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/u.test(value)
}

function resourceSchema(page: NuxtPanelPageData): ResourceRenderSchema {
  const schema = page.schema
  if (!isObject(schema) || schema.kind !== 'resource' || typeof schema.resourceId !== 'string' || typeof schema.basePath !== 'string' || !schema.basePath.startsWith('/') || !isPath(schema.routeKey) || !isPath(schema.recordTitle)) {
    throw new Error('Resource pages require a compiled resource render schema')
  }
  if (!Array.isArray(schema.fields) || !Array.isArray(schema.columns) || !Array.isArray(schema.filters) || !Array.isArray(schema.actions)) {
    throw new Error('Resource render schemas require fields, columns, filters, and actions')
  }
  if (!schema.fields.every(item => isObject(item) && isPath(item.path) && typeof item.type === 'string')) throw new Error('Resource render schema fields are invalid')
  if (!schema.columns.every(item => isObject(item) && isObject(item.manifest) && isPath(item.manifest.path) && typeof item.manifest.type === 'string')) throw new Error('Resource render schema columns are invalid')
  return {
    actions: schema.actions as unknown as readonly ResourceAction[],
    basePath: schema.basePath.replace(/\/+$/gu, ''),
    columns: schema.columns as unknown as readonly VueTableColumn<ResourceRecord>[],
    fields: schema.fields as unknown as readonly ResourceField[],
    filters: schema.filters as unknown as readonly VueTableFilter[],
    recordTitle: schema.recordTitle,
    resourceId: schema.resourceId,
    routeKey: schema.routeKey,
  }
}

function recordsFrom(page: NuxtPanelPageData): ResourceRecord[] {
  if (!Array.isArray(page.data.records)) return []
  return page.data.records.filter(isObject) as ResourceRecord[]
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

async function mutate(runtime: PanelPageRuntime, panelId: string, payload: JsonObject): Promise<unknown> {
  const response = await runtime.transport.execute({ kind: 'mutation', name: 'form-submit', supportsIdempotency: true }, {
    endpoint: `/_holo/panels/${encodeURIComponent(panelId)}/form-submit`,
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
      async hydrateSelected(request, values) {
        const selected = new Set(values)
        return optionsFor(source, request.dependencies).filter(option => selected.has(option.value))
      },
      async list(request) {
        const options = optionsFor(source, request.dependencies)
        return { hasMore: false, options, page: request.page, perPage: request.perPage, total: options.length }
      },
      async validateSelection(request, values) {
        const allowed = new Set(optionsFor(source, request.dependencies).map(option => option.value))
        return values.every(value => allowed.has(value))
      },
    },
  })
}

function initialValues(schema: ResourceRenderSchema, record: ResourceRecord | null): ResourceValues {
  const values: ResourceValues = record ? structuredClone(record) : {}
  if (record) return values
  for (const field of schema.fields) setValueAtPath(values, field.path, field.defaultValue ?? '')
  return values
}

function formPage(page: NuxtPanelPageData, panelId: string, schema: ResourceRenderSchema, runtime: PanelPageRuntime): VNode {
  const record = recordFrom(page)
  const values = initialValues(schema, record)
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
  const optionStores = new Map(schema.fields.flatMap(field => {
    const options = optionStore(panelId, schema.resourceId, field, values)
    return options ? [[field.path, options] as const] : []
  }))
  store.subscribe((next, previous) => {
    for (const field of schema.fields) {
      const dependency = field.optionSource?.dependency
      const options = optionStores.get(field.path)
      if (!dependency || !options || valueAtPath(next.values, dependency) === valueAtPath(previous.values, dependency)) continue
      const selected = valueAtPath(next.values, field.path)
      const dependencyValue = valueAtPath(next.values, dependency)
      void options.updateDependencies({ [dependency]: typeof dependencyValue === 'string' || typeof dependencyValue === 'number' ? dependencyValue : null }, typeof selected === 'string' || typeof selected === 'number' ? selected : null).then((result) => {
        if (result.status === 'cleared') store.batch([{ kind: 'set', path: field.path, value: '', touch: false }])
      })
    }
  })
  const submit = async (): Promise<void> => {
    await store.submit(async request => {
      const routeValue = record ? valueAtPath(record, schema.routeKey) : undefined
      await mutate(runtime, panelId, mutationPayload({
        mutation: page.manifest.pageType === 'create' ? 'create' : 'update',
        ...(typeof routeValue === 'string' || typeof routeValue === 'number' ? { record: routeValue } : {}),
        resourceId: schema.resourceId,
        ...request.values,
      }))
      return { commitValues: true }
    })
  }
  return h('form', { 'data-resource-crud': page.manifest.pageType, onSubmit: (event: Event) => { event.preventDefault(); void submit().catch(() => undefined) } }, [
    ...schema.fields.map(definition => h(VueFieldRenderer, { field: { definition, optionStore: optionStores.get(definition.path), panelId, registry, store }, key: definition.path })),
    h('button', { type: 'submit' }, 'Save'),
  ])
}

function recordId(record: Readonly<ResourceRecord>, routeKey: string): number | string {
  const value = valueAtPath(record, routeKey)
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Resource records require a valid route key')
  return value
}

function actionLocation(schema: ResourceRenderSchema, action: ResourceAction, routeValue: number | string): string {
  const encoded = encodeURIComponent(String(routeValue))
  if (action.path) return action.path.replaceAll('{record}', encoded)
  const recordPath = `${schema.basePath}/${encoded}`
  return action.kind === 'edit' ? `${recordPath}/edit` : recordPath
}

function navigableColumns(schema: ResourceRenderSchema): readonly VueTableColumn<ResourceRecord>[] {
  const viewAction = schema.actions.find(action => action.kind === 'view')
  if (!viewAction) return schema.columns
  return schema.columns.map(column => column.manifest.path === schema.recordTitle
    ? {
        ...column,
        render: (value: unknown, record: Readonly<ResourceRecord>) => h(PanelsLink, { href: actionLocation(schema, viewAction, recordId(record, schema.routeKey)) }, () => String(value ?? '')),
      }
    : column)
}

function tablePage(page: NuxtPanelPageData, panelId: string, schema: ResourceRenderSchema, runtime: PanelPageRuntime): VNode {
  const records = recordsFrom(page)
  const visibleColumns = schema.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path)
  const store = new TableStateStore<ResourceRecord>({ panelId, records, tableId: schema.resourceId, total: records.length, visibleColumns })
  if (typeof page.data.search === 'string') store.setSearch(page.data.search)
  for (const filter of schema.filters) {
    const value = page.data[filter.manifest.id]
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null) store.setFilter(filter.manifest.id, value)
  }
  const navigate = (): void => {
    if (typeof window !== 'undefined') window.location.assign(`${window.location.pathname}?${store.toQueryString()}`)
  }
  return h(VueTableRenderer, {
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
          await mutate(runtime, panelId, { actionId: request.actionId, mutation: 'delete', record: request.recordId, resourceId: schema.resourceId })
        },
      },
      actions: schema.actions,
      caption: page.title,
      columns: navigableColumns(schema),
      filters: schema.filters,
      getRecordId: (record: ResourceRecord) => recordId(record, schema.routeKey),
      onQueryChange: navigate,
      store,
    },
  })
}

function viewPage(page: NuxtPanelPageData, panelId: string, schema: ResourceRenderSchema, runtime: PanelPageRuntime): VNode {
  const record = recordFrom(page)
  const deleteAction = schema.actions.find(action => action.kind === 'delete')
  const editAction = schema.actions.find(action => action.kind === 'edit')
  const routeValue = record ? recordId(record, schema.routeKey) : null
  const action: ClientActionManifest = {
    confirmation: deleteAction?.confirmation ?? null,
    disabled: !record || !deleteAction,
    id: deleteAction?.id ?? `${schema.resourceId}.delete`,
    kind: 'delete',
    label: deleteAction?.label ?? 'Delete',
    mount: 'record',
    schema: null,
    visible: !!deleteAction,
  }
  const store = new ClientActionStore({
    createIdempotencyKey: () => crypto.randomUUID(),
    transport: {
      async execute() {
        if (routeValue === null) throw new Error('Resource record is unavailable')
        await mutate(runtime, panelId, { actionId: action.id, mutation: 'delete', record: routeValue, resourceId: schema.resourceId })
        return { effects: [], items: [], status: 'succeeded' }
      },
    },
  })
  return h('section', { 'data-resource-crud': 'view' }, [
    editAction && routeValue !== null ? h(PanelsLink, { href: actionLocation(schema, editAction, routeValue) }, () => editAction.label) : null,
    h('dl', record ? schema.fields.flatMap(field => [h('dt', field.label ?? field.path), h('dd', String(valueAtPath(record, field.path) ?? ''))]) : []),
    h(VueActionRenderer, { action, panelId, recordIds: routeValue === null ? [] : [routeValue], store }),
  ])
}

const VueResourcePage = defineComponent({
  name: 'VueResourcePage',
  props: {
    effects: { type: Object as PropType<ClientEffectSession>, required: true },
    page: { type: Object as PropType<NuxtPanelPageData>, required: true },
    panelId: { type: String, required: true },
    transport: { type: Object as PropType<PanelsTransport>, required: true },
  },
  setup(props) {
    const schema = resourceSchema(props.page)
    return () => props.page.manifest.pageType === 'list'
      ? tablePage(props.page, props.panelId, schema, { effects: props.effects, transport: props.transport })
      : props.page.manifest.pageType === 'view'
        ? viewPage(props.page, props.panelId, schema, { effects: props.effects, transport: props.transport })
        : formPage(props.page, props.panelId, schema, { effects: props.effects, transport: props.transport })
  },
})

function resourceComponent(page: NuxtPanelPageData, resolveResource: PanelPageProps['resolveResource']): Component | null {
  if (!resolveResource) return page.manifest.body?.component === 'resource-page' ? VueResourcePage : null
  return defineAsyncComponent({ loader: async () => await resolveResource(page), loadingComponent: PanelsLoadingIndicator })
}

function navigation(page: NuxtPanelPage): VNode {
  const activePath = page.path.split(/[?]/u, 1)[0] ?? page.path
  return h('nav', { 'aria-label': 'Panel navigation', class: 'hp-panel-navigation' }, page.bootstrap.manifest.navigation.map(item => h(PanelsLink, {
    current: activePath === item.path || activePath.startsWith(`${item.path}/`), href: item.path, key: item.id,
  }, () => [item.icon ? h('span', { 'aria-hidden': 'true', 'data-icon': item.icon }) : null, item.label, item.badge ? h('span', { class: 'hp-panel-navigation__badge' }, item.badge) : null])))
}

function pageBody(page: NuxtPanelPage, resolveResource: PanelPageProps['resolveResource'], runtime: PanelPageRuntime): VNode {
  const component = resourceComponent(page.page, resolveResource)
  if (component) return h(component, { effects: runtime.effects, page: page.page, panelId: page.bootstrap.manifest.id, transport: runtime.transport })
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
    resolveResource: { type: Function as PropType<PanelPageProps['resolveResource']>, default: undefined },
  },
  setup(props) {
    const panelId = props.page.bootstrap.manifest.id
    const transport = panelsTransport()
    const toastStore = new ClientToastStore()
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
    onMounted(() => {
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
    const realtime = realtimeFrom(props.page, props.notificationRealtime)
    const inboxStore = configuration
      ? new ClientNotificationInboxStore({
          polling: configuration.polling,
          ...(realtime ? { realtime } : {}),
          transport: createPanelNotificationTransport(transport, {
            endpoint: `/_holo/panels/${encodeURIComponent(panelId)}/notification`,
            panelId,
          }),
        })
      : null
    let disposed = false
    onUnmounted(() => {
      if (disposed) return
      disposed = true
      effects.dispose()
    })

    return (): VNode => {
      const { bootstrap, page } = props.page
      const notificationTrigger = inboxStore && configuration
        ? h(VueNotificationInboxTrigger, {
            navigate: browserNavigate,
            panelId,
            placement: configuration.placement,
            store: inboxStore,
          })
        : null
      return h(PanelsErrorBoundary, {}, {
        default: () => h('div', { class: ['hp-panel', `hp-panel--${bootstrap.manifest.navigationMode}`], 'data-panels-panel': bootstrap.manifest.id, 'data-panels-theme': bootstrap.manifest.theme.darkMode }, [
          h('header', { class: 'hp-panel-header' }, [bootstrap.manifest.branding.logo ? h('img', { alt: bootstrap.manifest.branding.name, src: bootstrap.manifest.branding.logo }) : null, h('span', { class: 'hp-panel-brand' }, bootstrap.manifest.branding.name), configuration?.placement === 'topbar' ? notificationTrigger : null]),
          navigation(props.page),
          configuration?.placement === 'sidebar' ? notificationTrigger : null,
          h('main', { class: 'hp-panel-content' }, [h('nav', { 'aria-label': 'Breadcrumbs' }, page.breadcrumbs.map((item, index) => h(PanelsLink, { href: item.path, key: `${item.path}:${index}` }, () => item.label))), h('h1', page.heading ?? page.title), page.subheading ? h('p', page.subheading) : null, pageBody(props.page, props.resolveResource, { effects, transport })]),
          h(VueToastViewport, { navigate: browserNavigate, store: toastStore }),
        ]),
        fallback: () => h('section', { role: 'alert', 'data-panels-error': '500' }, [h('h1', 'Panel unavailable')]),
      })
    }
  },
})
