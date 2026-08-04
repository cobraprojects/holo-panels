import type {
  ClientActionManifest,
  JsonObject,
  JsonValue,
  SvelteFieldDefinition,
  SvelteTableColumn,
} from '@holo-js/panels-svelte'

export interface ResourceDependency {
  readonly id: string
  readonly kind: 'clear' | 'slug'
  readonly source: string
  readonly target: string
}

export interface ResourceOptions {
  readonly dependsOn: string | null
  readonly values: readonly (number | string)[]
  readonly valuesByDependency: Readonly<Record<string, readonly (number | string)[]>>
}

export interface ResourcePageMetadata {
  readonly actions: readonly ClientActionManifest[]
  readonly basePath: string
  readonly columns: readonly SvelteTableColumn<Record<string, unknown>>[]
  readonly createLabel: string
  readonly dependencies: readonly ResourceDependency[]
  readonly fields: readonly SvelteFieldDefinition[]
  readonly id: string
  readonly label: string
  readonly options: Readonly<Record<string, ResourceOptions>>
  readonly recordId: string
  readonly routeKey: string
  readonly routes: {
    readonly create: string | null
    readonly edit: string | null
    readonly view: string | null
  }
  readonly saveLabel: string
}

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function stringValue(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function isSchemaComponent(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const component = value as Record<string, unknown>
  return typeof component.id === 'string'
    && typeof component.key === 'string'
    && ['callout', 'custom', 'empty-state', 'fieldset', 'grid', 'group', 'section', 'split', 'step', 'tab', 'tabs', 'wizard'].includes(String(component.kind))
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
    && ['small', 'medium', 'large', 'extra-large', 'screen'].includes(String(modal.width))
}

function localPath(value: JsonValue | undefined): string | null {
  const path = stringValue(value)
  return path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path.replace(/\/$/u, '') || '/' : null
}

function optionValues(value: JsonValue | undefined): readonly (number | string)[] {
  return Array.isArray(value) ? value.filter((item): item is number | string => typeof item === 'number' || typeof item === 'string') : []
}

function fieldDefinition(value: JsonValue): SvelteFieldDefinition | null {
  const field = objectValue(value)
  const type = stringValue(field?.type)
  const path = stringValue(field?.path)
  const label = stringValue(field?.label)
  if (!field || !type || !path || !label) return null
  return {
    ...(typeof field.disabled === 'boolean' ? { disabled: field.disabled } : {}),
    ...(typeof field.helperText === 'string' ? { helperText: field.helperText } : {}),
    ...(typeof field.hint === 'string' ? { hint: field.hint } : {}),
    label,
    path,
    ...(typeof field.placeholder === 'string' ? { placeholder: field.placeholder } : {}),
    ...(objectValue(field.properties) ? { properties: objectValue(field.properties) as JsonObject } : {}),
    ...(typeof field.readOnly === 'boolean' ? { readOnly: field.readOnly } : {}),
    ...(typeof field.required === 'boolean' ? { required: field.required } : {}),
    type,
    ...(typeof field.visible === 'boolean' ? { visible: field.visible } : {}),
  }
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
      hidden: manifest.hidden === true,
      inlineEditor: objectValue(manifest.inlineEditor),
      label: typeof manifest.label === 'string' ? manifest.label : null,
      path,
      sortable: manifest.sortable === true,
      toggleable: manifest.toggleable !== false,
      type,
      width: typeof manifest.width === 'number' || typeof manifest.width === 'string' ? manifest.width : null,
      wrap: manifest.wrap !== false,
    },
  }
}

function actionManifest(value: JsonValue): ClientActionManifest | null {
  const action = objectValue(value)
  const id = stringValue(action?.id)
  const label = stringValue(action?.label)
  const kind = stringValue(action?.kind)
  const mount = stringValue(action?.mount)
  const kinds = new Set(['create', 'custom', 'delete', 'edit', 'force-delete', 'replicate', 'restore', 'view'])
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
      dependsOn: stringValue(definition.dependsOn),
      values: optionValues(definition.values),
      valuesByDependency: Object.freeze(Object.fromEntries(Object.entries(grouped ?? {}).map(([key, item]) => [key, optionValues(item)]))),
    })]]
  })))
}

export function resourcePageMetadata(value: JsonValue | undefined): ResourcePageMetadata | null {
  const resource = objectValue(value)
  const id = stringValue(resource?.id)
  const label = stringValue(resource?.label)
  const basePath = localPath(resource?.basePath)
  const recordId = stringValue(resource?.recordId)
  const routeKey = stringValue(resource?.routeKey)
  const routes = objectValue(resource?.routes)
  if (!resource || !id || !label || !basePath || !recordId || !routeKey) return null
  return Object.freeze({
    actions: Object.freeze(Array.isArray(resource.actions) ? resource.actions.flatMap(item => actionManifest(item) ?? []) : []),
    basePath,
    columns: Object.freeze(Array.isArray(resource.columns) ? resource.columns.flatMap(item => columnDefinition(item) ?? []) : []),
    createLabel: stringValue(resource.createLabel) ?? `Create ${label}`,
    dependencies: Object.freeze(dependencies(resource.dependencies)),
    fields: Object.freeze(Array.isArray(resource.fields) ? resource.fields.flatMap(item => fieldDefinition(item) ?? []) : []),
    id,
    label,
    options: options(resource.options),
    recordId,
    routeKey,
    routes: Object.freeze({
      create: localPath(routes?.create),
      edit: localPath(routes?.edit),
      view: localPath(routes?.view),
    }),
    saveLabel: stringValue(resource.saveLabel) ?? `Save ${label}`,
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
