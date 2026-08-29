import type {
  ClientActionManifest,
  JsonObject,
  JsonValue,
  SvelteFieldDefinition,
  SvelteTableColumn,
  SvelteTableFilter,
  SvelteTableAction,
  SvelteTableActionGroup,
  SvelteTableActionItem,
} from '@holo-js/panels-svelte'
import type { SchemaManifest } from '@holo-js/panels-client'

export interface ResourceDependency {
  readonly id: string
  readonly kind: 'clear' | 'slug'
  readonly source: string
  readonly target: string
}

export interface ResourceOptions {
  readonly canCreate: boolean
  readonly canEdit: boolean
  readonly dependsOn: string | null
  readonly server: boolean
  readonly values: readonly (number | string)[]
  readonly valuesByDependency: Readonly<Record<string, readonly (number | string)[]>>
}

export interface ResourcePageMetadata {
  readonly selection: JsonObject
  readonly actions: readonly ClientActionManifest[]
  readonly basePath: string
  readonly columns: readonly SvelteTableColumn<Record<string, unknown>>[]
  readonly createLabel: string
  readonly dependencies: readonly ResourceDependency[]
  readonly entries: readonly JsonObject[]
  readonly fields: readonly SvelteFieldDefinition[]
  readonly formActions: readonly ClientActionManifest[]
  readonly cancelFormActions: readonly string[]
  readonly filterMode: 'deferred' | 'live'
  readonly filters: readonly SvelteTableFilter[]
  readonly id: string
  readonly label: string
  readonly options: Readonly<Record<string, ResourceOptions>>
  readonly recordId: string
  readonly recordActions: readonly ClientActionManifest[]
  readonly routeKey: string
  readonly routes: {
    readonly create: string | null
    readonly edit: string | null
    readonly view: string | null
  }
  readonly saveLabel: string
  readonly schema: SchemaManifest<Record<string, unknown>>
  readonly tableActions: readonly SvelteTableActionItem[]
}

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function objectValues(value: JsonValue | undefined): readonly JsonObject[] {
  if (!Array.isArray(value)) return []
  const values: JsonObject[] = []
  for (const item of value) {
    const object = objectValue(item)
    if (object) values.push(object)
  }
  return values
}

function stringValue(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function isSchemaComponent(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const component = value as Record<string, unknown>
  return typeof component.id === 'string'
    && typeof component.key === 'string'
    && ['callout', 'custom', 'empty-state', 'field', 'fieldset', 'grid', 'group', 'section', 'split', 'step', 'tab', 'tabs', 'wizard'].includes(String(component.kind))
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
    && ['small', 'medium', 'large', 'extra-large', 'screen'].includes(String(modal.width))
}

function localPath(value: JsonValue | undefined): string | null {
  const path = stringValue(value)
  return path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path.replace(/\/$/u, '') || '/' : null
}

function optionValues(value: JsonValue | undefined): readonly (number | string)[] {
  return Array.isArray(value) ? value.filter((item): item is number | string => typeof item === 'number' || typeof item === 'string') : []
}

function humanizePath(path: string): string {
  return path
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/^\w/u, character => character.toUpperCase())
}

export function resourceFieldDefinition(value: JsonValue): SvelteFieldDefinition | null {
  const field = objectValue(value)
  const type = stringValue(field?.type)
  const path = stringValue(field?.path)
  const label = stringValue(field?.label) ?? (path ? humanizePath(path) : null)
  if (!field || !type || !path || !label) return null
  return {
    ...(typeof field.debounceMilliseconds === 'number' ? { debounceMilliseconds: field.debounceMilliseconds } : {}),
    ...(typeof field.disabled === 'boolean' ? { disabled: field.disabled } : {}),
    ...(typeof field.helperText === 'string' ? { helperText: field.helperText } : {}),
    ...(typeof field.hint === 'string' ? { hint: field.hint } : {}),
    label,
    path,
    ...(typeof field.placeholder === 'string' ? { placeholder: field.placeholder } : {}),
    properties: { ...objectValue(field.properties), validationRules: Array.isArray(field.rules) ? field.rules : [] },
    ...(typeof field.readOnly === 'boolean' ? { readOnly: field.readOnly } : {}),
    ...(typeof field.required === 'boolean' ? { required: field.required } : {}),
    type,
    ...(typeof field.visible === 'boolean' ? { visible: field.visible } : {}),
  }
}

export function resourceSchemaManifest(value: JsonValue | undefined): SchemaManifest<Record<string, unknown>> | null {
  const schema = objectValue(value)
  if (schema?.kind !== 'schema' || typeof schema.id !== 'string' || !Array.isArray(schema.components) || !schema.components.every(isSchemaComponent)) return null
  return schema as unknown as SchemaManifest<Record<string, unknown>>
}

function columnDefinition(value: JsonValue): SvelteTableColumn<Record<string, unknown>> | null {
  const column = objectValue(value)
  const manifest = objectValue(column?.manifest)
  const path = stringValue(manifest?.path)
  const type = stringValue(manifest?.type)
  if (!manifest || !path || !type) return null
  const alignment = manifest.alignment
  return {
    manifest: {
      alignment: alignment === 'center' || alignment === 'end' ? alignment : 'start',
      copyable: manifest.copyable === true,
      formatters: objectValues(manifest.formatters),
      hidden: manifest.hidden === true,
      inlineEditor: objectValue(manifest.inlineEditor),
      label: typeof manifest.label === 'string' ? manifest.label : null,
      lineClamp: typeof manifest.lineClamp === 'number' ? manifest.lineClamp : null,
      path,
      searchable: manifest.searchable === true,
      sortable: manifest.sortable === true,
      toggleable: manifest.toggleable !== false,
      type,
      width: typeof manifest.width === 'number' || typeof manifest.width === 'string' ? manifest.width : null,
      wrap: manifest.wrap !== false,
    },
  }
}

function filterDefinition(value: JsonValue): SvelteTableFilter | null {
  const filter = objectValue(value)
  const id = stringValue(filter?.id)
  const type = stringValue(filter?.type)
  if (!filter || !id || !type) return null
  const properties = objectValue(filter.properties) ?? {}
  const filterOptions = objectValues(properties.options).flatMap((option) => {
    const current = option.value
    return typeof option.label === 'string' && (current === null || typeof current === 'boolean' || typeof current === 'number' || typeof current === 'string')
      ? [{ disabled: option.disabled === true, label: option.label, value: current }]
      : []
  })
  return {
    manifest: {
      defaultValue: typeof filter.defaultValue === 'undefined' ? null : filter.defaultValue,
      id,
      label: typeof filter.label === 'string' ? filter.label : null,
      properties,
      type,
    },
    ...(filterOptions.length > 0 ? { options: filterOptions } : {}),
  }
}

export function actionManifest(value: JsonValue): ClientActionManifest | null {
  const action = objectValue(value)
  const id = stringValue(action?.id)
  const label = stringValue(action?.label)
  const kind = stringValue(action?.kind)
  const mount = stringValue(action?.mount)
  const kinds = new Set(['associate', 'attach', 'create', 'custom', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'force-delete', 'replicate', 'restore', 'view'])
  const mounts = new Set(['bulk', 'modal', 'notification', 'page', 'record'])
  if (!action || !id || !label || !kind || !mount || !kinds.has(kind) || !mounts.has(mount)) return null
  return {
    badge: typeof action.badge === 'string' ? action.badge : null,
    color: typeof action.color === 'string' ? action.color : null,
    confirmation: typeof action.confirmation === 'string' ? action.confirmation : null,
    disabled: action.disabled === true,
    icon: typeof action.icon === 'string' ? action.icon : null,
    id,
    kind: kind as ClientActionManifest['kind'],
    label,
    modal: isActionModal(action.modal) ? action.modal : null,
    mount: mount as ClientActionManifest['mount'],
    size: action.size === 'extra-small' || action.size === 'small' || action.size === 'large' || action.size === 'extra-large' ? action.size : 'medium',
    tooltip: typeof action.tooltip === 'string' ? action.tooltip : null,
    type: stringValue(action.type) ?? `core:action:${kind}`,
    visible: action.visible !== false,
  }
}

function dependencies(value: JsonValue | undefined): readonly ResourceDependency[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const dependency = objectValue(item)
    const id = stringValue(dependency?.id)
    const source = stringValue(dependency?.source)
    const target = stringValue(dependency?.target)
    const kind = dependency?.kind
    return id && source && target && (kind === 'clear' || kind === 'slug') ? [{ id, kind, source, target }] : []
  })
}

function options(value: JsonValue | undefined): Readonly<Record<string, ResourceOptions>> {
  const source = objectValue(value)
  if (!source) return {}
  return Object.freeze(Object.fromEntries(Object.entries(source).flatMap(([path, raw]) => {
    const definition = objectValue(raw)
    if (!definition) return []
    const grouped = objectValue(definition.valuesByDependency)
    return [[path, Object.freeze({
      canCreate: definition.canCreate === true,
      canEdit: definition.canEdit === true,
      dependsOn: stringValue(definition.dependsOn),
      server: definition.server === true,
      values: optionValues(definition.values),
      valuesByDependency: Object.freeze(Object.fromEntries(Object.entries(grouped ?? {}).map(([key, item]) => [key, optionValues(item)]))),
    })]]
  })))
}

export function resourceOptionsFromFields(fields: readonly JsonValue[]): Readonly<Record<string, ResourceOptions>> {
  return options(Object.fromEntries(fields.flatMap((item) => {
    const field = objectValue(item)
    const path = stringValue(field?.path)
    const properties = objectValue(field?.properties)
    const choices = Array.isArray(properties?.options) ? properties.options : []
    const values = choices.flatMap((choice) => {
      const option = objectValue(choice)
      return typeof option?.value === 'string' || typeof option?.value === 'number' ? [option.value] : []
    })
    const sourceKind = stringValue(properties?.optionSource)
    return path && (values.length > 0 || !!sourceKind && sourceKind !== 'static') ? [[path, {
      canCreate: properties?.canCreateOption === true,
      canEdit: properties?.canEditOption === true,
      server: !!sourceKind && sourceKind !== 'static',
      values,
    }]] : []
  })) as unknown as JsonValue)
}

function tableAction(value: JsonValue): SvelteTableActionItem | null {
  const action = objectValue(value)
  const id = stringValue(action?.id)
  const scope = stringValue(action?.scope)
  if (!action || !id || (scope !== 'bulk' && scope !== 'header' && scope !== 'row')) return null
  if (action.kind === 'action-group') {
    const actions = objectValues(action.actions).flatMap(item => {
      const parsed = tableAction(item)
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
    } satisfies SvelteTableActionGroup
  }
  const label = stringValue(action.label)
  if (!label) return null
  return {
    color: typeof action.color === 'string' ? action.color : null,
    emptyStateOnly: action.emptyStateOnly === true,
    confirmation: typeof action.confirmation === 'string' ? action.confirmation : undefined,
    icon: typeof action.icon === 'string' ? action.icon : null,
    id,
    label,
    scope,
  } satisfies SvelteTableAction
}

function generatedActionManifests(value: JsonValue | undefined): JsonObject[] {
  return objectValues(value).flatMap(item => item.kind === 'action-group' ? generatedActionManifests(item.actions) : [item]).flatMap((action) => {
    const id = stringValue(action.id)
    const kind = stringValue(action.kind)
    const label = stringValue(action.label)
    const scope = stringValue(action.scope)
    if (!id || !kind || !label || (scope !== 'bulk' && scope !== 'header' && scope !== 'row')) return []
    return [{ ...action, mount: scope === 'bulk' ? 'bulk' : scope === 'header' ? 'page' : 'record' }]
  })
}

function generatedBasePath(pagePath: string, pageType?: string): string {
  const templateBasePath = pagePath.split('/:record/u', 1)[0]
  if (templateBasePath !== pagePath) return templateBasePath ?? pagePath
  if (pageType === 'create') return pagePath.replace(/\/create$/u, '')
  if (pageType === 'edit') return pagePath.replace(/\/[^/]+\/edit$/u, '')
  if (pageType === 'view') return pagePath.replace(/\/[^/]+$/u, '')
  return pagePath
}

function generatedResource(value: JsonObject, pagePath: string | undefined, pageType?: string): JsonObject | null {
  const form = objectValue(value.form)
  const infolist = objectValue(value.infolist)
  const table = objectValue(value.table)
  const labels = objectValue(value.labels)
  const configuredRoutes = objectValue(value.routes)
  if (!form || !table || !labels || !pagePath) return null
  const id = stringValue(value.id)
  const routeKey = stringValue(value.routeKey)
  const recordId = stringValue(value.recordId)
  if (!id || !routeKey || !recordId) return null
  const basePath = generatedBasePath(pagePath, pageType)
  const fields = Array.isArray(form.fields) ? form.fields : []
  const fieldOptions = resourceOptionsFromFields(fields)
  const generatedDependencies = Array.isArray(form.dependencies) ? form.dependencies.flatMap((item) => {
    const dependency = objectValue(item)
    const id = stringValue(dependency?.id)
    const source = Array.isArray(dependency?.paths) ? dependency.paths.find(path => typeof path === 'string') : null
    const patch = Array.isArray(dependency?.patches) ? objectValue(dependency.patches[0]) : null
    const target = stringValue(patch?.path)
    const resolver = objectValue(patch?.resolver)
    return id && typeof source === 'string' && target && resolver?.name === 'slug' ? [{ id, kind: 'slug', source, target }] : []
  }) : []
  return {
    actions: generatedActionManifests(table.actions),
    basePath,
    columns: Array.isArray(table.columns) ? table.columns.map(manifest => ({ manifest })) : [],
    createLabel: labels.create ?? null,
    dependencies: generatedDependencies,
    entries: Array.isArray(infolist?.entries) ? infolist.entries : [],
    fields,
    formActions: form.actions ?? [],
    schema: form.schema ?? null,
    filterMode: table.filterMode === 'deferred' ? 'deferred' : 'live',
    selection: table.selection ?? {},
    filters: Array.isArray(table.filters) ? table.filters : [],
    id,
    label: labels.plural ?? id,
    options: fieldOptions as unknown as JsonObject,
    recordId,
    recordActions: value.actions ?? [],
    routeKey,
    routes: {
      create: configuredRoutes ? localPath(configuredRoutes.create) : `${basePath}/create`,
      edit: configuredRoutes ? localPath(configuredRoutes.edit) : `${basePath}/:record/edit`,
      view: configuredRoutes ? localPath(configuredRoutes.view) : `${basePath}/:record`,
    },
    saveLabel: labels.save ?? null,
    tableActions: Array.isArray(table.actions) ? table.actions : [],
  }
}

export function resourcePageMetadata(value: JsonValue | undefined, pagePath?: string, pageType?: string): ResourcePageMetadata | null {
  const source = objectValue(value)
  const resource = source ? generatedResource(source, pagePath, pageType) ?? source : null
  const id = stringValue(resource?.id)
  const label = stringValue(resource?.label)
  const basePath = localPath(resource?.basePath)
  const recordId = stringValue(resource?.recordId)
  const routeKey = stringValue(resource?.routeKey)
  const routes = objectValue(resource?.routes)
  if (!resource || !id || !label || !basePath || !recordId || !routeKey) return null
  const entries = objectValues(resource.entries)
  const inferredEntries = entries.length > 0 ? entries : objectValues(resource.fields).flatMap((field) => {
    const path = stringValue(field.path)
    if (!path) return []
    return [{
      actions: [],
      copyable: false,
      id: `${id}-${path}`,
      inlineLabel: false,
      label: stringValue(field.label),
      path,
      placeholder: null,
      properties: {},
      type: 'text',
    }]
  })
  return Object.freeze({
    actions: Object.freeze(Array.isArray(resource.actions) ? resource.actions.flatMap(item => actionManifest(item) ?? []) : []),
    basePath,
    columns: Object.freeze(Array.isArray(resource.columns) ? resource.columns.flatMap(item => columnDefinition(item) ?? []) : []),
    createLabel: stringValue(resource.createLabel) ?? `Create ${label}`,
    dependencies: Object.freeze(dependencies(resource.dependencies)),
    entries: Object.freeze(inferredEntries),
    fields: Object.freeze(Array.isArray(resource.fields) ? resource.fields.flatMap(item => resourceFieldDefinition(item) ?? []) : []),
    formActions: Object.freeze(Array.isArray(resource.formActions) ? resource.formActions.flatMap(item => actionManifest(item) ?? []) : []),
    cancelFormActions: Object.freeze(Array.isArray(resource.formActions) ? resource.formActions.flatMap(item => {
      const action = objectValue(item)
      return action?.formIntent === 'cancel' && typeof action.id === 'string' ? [action.id] : []
    }) : []),
    filterMode: resource.filterMode === 'deferred' ? 'deferred' : 'live',
    selection: objectValue(resource.selection) ?? {},
    filters: Object.freeze(Array.isArray(resource.filters) ? resource.filters.flatMap(item => filterDefinition(item) ?? []) : []),
    id,
    label,
    options: options(resource.options),
    schema: resourceSchemaManifest(resource.schema) ?? {
      components: Array.isArray(resource.fields) ? resource.fields.flatMap((item, index) => {
        const field = objectValue(item)
        const path = stringValue(field?.path)
        return path ? [{ children: [], dynamicVisibility: false, extraAttributes: {}, id: `${id}-${index}`, key: path, kind: 'field', layout: {}, properties: {}, slots: {}, statePath: path, type: 'field', visible: field?.visible !== false }] : []
      }) : [],
      id: `${id}-form`,
      kind: 'schema' as const,
    },
    recordId,
    recordActions: Object.freeze((Array.isArray(resource.recordActions) ? resource.recordActions : Array.isArray(resource.actions) ? resource.actions : []).flatMap(item => actionManifest(item) ?? [])),
    routeKey,
    routes: Object.freeze({
      create: localPath(routes?.create),
      edit: localPath(routes?.edit),
      view: localPath(routes?.view),
    }),
    saveLabel: stringValue(resource.saveLabel) ?? `Save ${label}`,
    tableActions: Object.freeze(Array.isArray(resource.tableActions) ? resource.tableActions.flatMap(item => tableAction(item) ?? []) : Array.isArray(resource.actions) ? resource.actions.flatMap(item => tableAction(item) ?? []) : []),
  })
}

export function jsonRecord(value: JsonValue | undefined): Record<string, unknown> | null {
  return objectValue(value)
}

export function jsonRecords(value: JsonValue | undefined): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  const records: Record<string, unknown>[] = []
  for (const item of value) {
    const record = objectValue(item)
    if (record) records.push(record)
  }
  return records
}

export function slugValue(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

export function resourceRoute(template: string | null, record: string): string | null {
  if (!template || !record) return null
  return template.replace(':record', record)
}

export function resourceOperationIdentifier(record: Readonly<Record<string, unknown>> | null, routeKey: string): number | string {
  const value = record?.[routeKey]
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

export function resourceOperationIdentifiers(
  records: readonly Readonly<Record<string, unknown>>[],
  recordKey: string,
  routeKey: string,
  selectedId: number | string | undefined,
): readonly (number | string)[] {
  if (typeof selectedId === 'undefined') return []
  const record = records.find(candidate => candidate[recordKey] === selectedId) ?? null
  const identifier = resourceOperationIdentifier(record, routeKey)
  return identifier === '' ? [] : [identifier]
}
