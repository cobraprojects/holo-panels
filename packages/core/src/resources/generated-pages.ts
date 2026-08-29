import type { JsonObject, JsonValue } from '../protocol/json'
import { ValidationException } from '@holo-js/forms/schema'
import { validateFormFields } from '../fields/validation'
import { toJsonValue } from '../protocol/serialization'
import { getGeneratedTableDefinition, type RelationDefinition } from '@holo-js/db'
import { ActionEngine, builtInActionPresentation, compileActionManifest, resolveActionState, type ActionDefinition, type ActionKind, type ActionManifest, type ActionModalWidth, type ActionMount, type ActionSize } from '../actions'
import type { Effect } from '../protocol/effects'
import type { CompiledPanelDefinition } from '../panels/contracts'
import { actionExecutionPermissions, resourceActionPermissions, authorizePanelActionPermissions } from '../actions/authorization'
import { ActionEngineState, ActionExecutionError } from '../actions/engine'
import { actionCacheIdentity } from '../actions/identity'
import { findRegisteredAction } from '../actions/registration'
import type { CompiledPageDefinition, PageContext, PageManifest, PageType } from '../pages/contracts'
import { defaultSlugTransform } from '../fields/basic'
import { OptionService, type OptionQueryRequest, type OptionSource, type OptionValue } from '../fields/options'
import { createTemporaryUploadService, type UploadPolicy, type UploadStorageAdapter } from '../fields/upload'
import type { TableQueryFilter, TableQueryScalar, TableQuerySort, TableQueryState } from '../tables/query'
import {
  asExecutableSummary,
  executePageSummaries,
  groupPageRecords,
  type CompiledGroupDefinition,
  type CompiledSummaryDefinition,
} from '../tables/grouping'
import { ResourceExecutor } from './executor'
import { infolistComponents } from './infolist-actions'
import { serializeResourceRecord } from './resource-serialization'
import { authorizeHoloPolicy, canHoloPolicy, isHoloPolicyMissingError } from './holo-authorization'
import type { ResourceDefinition, ResourceModel, ResourceQuery, ResourceRecord } from './contracts'
import { RelationManagerExecutor, RelationRecordNotFoundError } from '../relations/executor'
import { allowedRelationOperations } from '../relations/metadata'
import type { RelationManagerDefinition, RelationOperation } from '../relations/contracts'
import { resolveResourceForm, resourceFormSchema, resourceSchemaFields } from './form-schema'

interface RuntimeRecord extends ResourceRecord {
  toJSON(): Readonly<Record<string, unknown>>
}

interface RuntimeQuery extends ResourceQuery<RuntimeQuery, RuntimeRecord> {
  get(): Promise<readonly RuntimeRecord[]>
  limit(value: number): RuntimeQuery
  orWhereLike(column: string, pattern: string): RuntimeQuery
  orWhereRelation(relation: string, column: string, operator: 'like', value: string): RuntimeQuery
  where(callback: (query: RuntimeQuery) => RuntimeQuery): RuntimeQuery
  where(column: string, operator: '=', value: number | string): RuntimeQuery
  whereLike(column: string, pattern: string): RuntimeQuery
  whereRelation(relation: string, column: string, operator: 'like', value: string): RuntimeQuery
  with(relations: readonly string[]): RuntimeQuery
}

type RuntimeDefinition = ResourceDefinition<
  ResourceModel<RuntimeRecord, RuntimeQuery>,
  RuntimeRecord,
  RuntimeQuery,
  Readonly<Record<string, unknown>>,
  object,
  unknown,
  boolean
>

const resourceActionStates = new WeakMap<object, Map<string, ActionEngineState<number | string>>>()

function resourceActionState(model: object, scope: string): ActionEngineState<number | string> {
  const states = resourceActionStates.get(model) ?? new Map<string, ActionEngineState<number | string>>()
  const state = states.get(scope) ?? new ActionEngineState<number | string>()
  states.set(scope, state)
  if (states.size > 1000) {
    const oldest = states.keys().next().value
    if (oldest !== undefined) states.delete(oldest)
  }
  resourceActionStates.set(model, states)
  return state
}

interface GeneratedResourcePageOptions {
  readonly panelPath: string
  readonly resource: object
}

export interface GeneratedResourceOperationInput {
  readonly context: {
    readonly actor: object
    readonly signal: AbortSignal
    readonly strictAuthorization?: boolean
    readonly tenant: unknown
    readonly tenantBindings?: Readonly<Record<string, number | string>>
    readonly uploadStorage?: UploadStorageAdapter
    readonly scopeTenantQuery?: <TQuery>(query: TQuery) => TQuery
  }
  readonly operation: 'action' | 'form-submit' | 'options' | 'table-data'
  readonly panel?: CompiledPanelDefinition<object>
  readonly panelId: string
  readonly payload: JsonObject
  readonly strictAuthorization?: boolean
}

export interface GeneratedUploadOperationInput {
  readonly contents?: Uint8Array
  readonly context: GeneratedResourceOperationInput['context']
  readonly panelId: string
  readonly payload: JsonObject
  readonly strictAuthorization?: boolean
}

export interface GeneratedResourceOperationResult {
  readonly data: JsonObject
  readonly effects: readonly Effect[]
}

export interface GeneratedGlobalSearchInput {
  readonly actor: object
  readonly panelId: string
  readonly panelPath: string
  readonly resources: readonly object[]
  readonly resourceOptIn?: boolean
  readonly scopeTenantQuery?: <TQuery>(query: TQuery) => TQuery
  readonly signal: AbortSignal
  readonly strictAuthorization?: boolean
  readonly tenant: unknown
  readonly tenantBindings?: Readonly<Record<string, number | string>>
  readonly term: string
}

function objectMember(value: object | undefined, key: string): object | undefined {
  if (!value || !(key in value)) return undefined
  const member = Reflect.get(value, key)
  return member && typeof member === 'object' ? member : undefined
}

function arrayMember(value: object | undefined, key: string): readonly object[] {
  if (!value || !(key in value)) return Object.freeze([])
  const member = Reflect.get(value, key)
  return Array.isArray(member) ? member.filter(item => item && typeof item === 'object') : Object.freeze([])
}

function resourceFilterOptions(value: unknown): JsonObject[] {
  if (Array.isArray(value)) {
    return value.flatMap((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return []
      const label = Reflect.get(option, 'label')
      const optionValue = Reflect.get(option, 'value')
      if (typeof label !== 'string' || ![null, 'boolean', 'number', 'string'].includes(optionValue === null ? null : typeof optionValue)) return []
      return [{ disabled: Reflect.get(option, 'disabled') === true, label, value: optionValue as boolean | number | string | null }]
    })
  }
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([optionValue, label]) => typeof label === 'string'
    ? [{ disabled: false, label, value: optionValue }]
    : [])
}

function resourceFilters(table: object | undefined): readonly JsonObject[] {
  return Object.freeze(arrayMember(table, 'filters').flatMap((filter) => {
    const id = Reflect.get(filter, 'id')
    const type = Reflect.get(filter, 'type')
    if (typeof id !== 'string' || typeof type !== 'string') return []
    const existingProperties = objectMember(filter, 'properties')
    const relationship = Reflect.get(filter, 'relationship')
    const schema = Reflect.get(filter, 'schema')
    const properties = existingProperties
      ? toJsonValue(existingProperties)
      : {
          multiple: Reflect.get(filter, 'multiple') === true,
          options: resourceFilterOptions(Reflect.get(filter, 'options')),
          preload: Reflect.get(filter, 'preload') === true,
          relationship: relationship === undefined ? null : toJsonValue(relationship),
          schema: schema === undefined ? null : toJsonValue(schema),
          searchable: Reflect.get(filter, 'searchable') === true,
        }
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []
    const rawLayout = Reflect.get(filter, 'layout')
    const layout = rawLayout === undefined ? null : toJsonValue(rawLayout)
    return [{
      defaultValue: Reflect.get(filter, 'defaultValue') === undefined ? null : toJsonValue(Reflect.get(filter, 'defaultValue')),
      id,
      label: typeof Reflect.get(filter, 'label') === 'string' ? Reflect.get(filter, 'label') as string : null,
      layout: layout && typeof layout === 'object' && !Array.isArray(layout) ? layout : {},
      mode: Reflect.get(filter, 'mode') === 'deferred' ? 'deferred' as const : 'live' as const,
      properties,
      type,
    }]
  }))
}

function compositionArrayMember(value: object | undefined, key: string): readonly object[] {
  if (!value || !(key in value)) return Object.freeze([])
  const member = Reflect.get(value, key)
  return Array.isArray(member)
    ? member.filter((item): item is object => item !== null && (typeof item === 'object' || typeof item === 'function'))
    : Object.freeze([])
}

function compiledObject(value: object | undefined): object | undefined {
  if (!value) return undefined
  const compiled = 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
  return compiled && typeof compiled === 'object' ? compiled : undefined
}

function compiledObjectMember(value: object | undefined, key: string): object | undefined {
  return compiledObject(objectMember(value, key))
}

function label(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/\b\w/gu, character => character.toUpperCase())
}

function valueAtPath(value: unknown, path: string): unknown {
  let current = value
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined
    current = Reflect.get(current, segment)
  }
  return current
}

function setValueAtPath(target: Record<string, JsonValue>, path: string, value: JsonValue): void {
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

function displayValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return String(value)
  return ''
}

function staticActionValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function staticActionObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const serialized = toJsonValue(value)
  return serialized && typeof serialized === 'object' && !Array.isArray(serialized) ? serialized : null
}

function staticActionPresentationValue(value: unknown, fallback: string | null): string | null {
  if (typeof value === 'undefined') return fallback
  return staticActionValue(value)
}

function actionLabel(action: object): string {
  const configured = Reflect.get(action, 'label')
  return typeof configured === 'string' && configured.trim() ? configured.trim() : label(String(Reflect.get(action, 'id') ?? 'action'))
}

function actionManifestSeed(action: object): ActionManifest {
  const modal = objectMember(action, 'modal')
  const nestedActions = modal && Array.isArray(Reflect.get(modal, 'nestedActions'))
    ? Reflect.get(modal, 'nestedActions').filter((item: unknown): item is string => typeof item === 'string')
    : []
  const kindValue = Reflect.get(action, 'kind')
  const kind = (['associate', 'attach', 'create', 'custom', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'force-delete', 'replicate', 'restore', 'view'].includes(String(kindValue)) ? kindValue : 'custom') as ActionKind
  const defaults = builtInActionPresentation(kind === 'custom' ? String(Reflect.get(action, 'id')) : kind)
  return {
    badge: staticActionValue(Reflect.get(action, 'badge')),
    color: staticActionPresentationValue(Reflect.get(action, 'color'), defaults?.color ?? null),
    confirmation: staticActionPresentationValue(Reflect.get(action, 'confirmation'), defaults?.confirmation ?? null),
    disabled: Reflect.get(action, 'disabled') === true,
    icon: staticActionPresentationValue(Reflect.get(action, 'icon'), defaults?.icon ?? null),
    id: String(Reflect.get(action, 'id')),
    kind,
    label: actionLabel(action),
    modal: modal
      ? {
          alignment: ['center', 'end', 'start'].includes(String(Reflect.get(modal, 'alignment'))) ? Reflect.get(modal, 'alignment') as 'center' | 'end' | 'start' : 'center',
          autofocus: Reflect.get(modal, 'autofocus') !== false,
          cancelActionLabel: staticActionValue(Reflect.get(modal, 'cancelActionLabel')),
          closeByClickingAway: Reflect.get(modal, 'closeByClickingAway') !== false,
          closeByEscaping: Reflect.get(modal, 'closeByEscaping') !== false,
          content: staticActionObject(Reflect.get(modal, 'content')),
          description: staticActionValue(Reflect.get(modal, 'description')),
          footer: staticActionObject(Reflect.get(modal, 'footer')),
          heading: staticActionValue(Reflect.get(modal, 'heading')),
          icon: staticActionValue(Reflect.get(modal, 'icon')),
          iconColor: staticActionValue(Reflect.get(modal, 'iconColor')),
          nestedActions,
          schema: staticActionObject(Reflect.get(modal, 'schema')),
          slideOver: Reflect.get(modal, 'slideOver') === true,
          stickyFooter: Reflect.get(modal, 'stickyFooter') === true,
          stickyHeader: Reflect.get(modal, 'stickyHeader') === true,
          submitActionLabel: staticActionValue(Reflect.get(modal, 'submitActionLabel')),
          width: ['small', 'medium', 'large', 'extra-large', 'screen'].includes(String(Reflect.get(modal, 'width')))
            ? Reflect.get(modal, 'width') as ActionModalWidth
            : 'medium',
        }
      : null,
    mount: (['bulk', 'modal', 'notification', 'page', 'record'].includes(String(Reflect.get(action, 'mount'))) ? Reflect.get(action, 'mount') : 'record') as ActionMount,
    size: (['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(String(Reflect.get(action, 'size'))) ? Reflect.get(action, 'size') : 'medium') as ActionSize,
    tooltip: staticActionValue(Reflect.get(action, 'tooltip')),
    type: staticActionValue(Reflect.get(action, 'type')) ?? kind,
    visible: Reflect.get(action, 'visible') !== false,
  }
}

function relationPaths(paths: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(paths.flatMap((path) => {
    const segments = path.split('.')
    return segments.length > 1 ? [segments.slice(0, -1).join('.')] : []
  }))].sort())
}

function applySearch(query: RuntimeQuery, attributes: readonly string[], term: string): RuntimeQuery {
  return query.where(group => attributes.reduce((current, path, index) => {
    const segments = path.split('.')
    if (segments.length === 1) return index === 0 ? current.whereLike(path, term) : current.orWhereLike(path, term)
    const relation = segments.slice(0, -1).join('.')
    const column = segments.at(-1)!
    return index === 0
      ? current.whereRelation(relation, column, 'like', term)
      : current.orWhereRelation(relation, column, 'like', term)
  }, group))
}

function singularize(value: string): string {
  if (/ies$/iu.test(value)) return `${value.slice(0, -3)}y`
  if (/s$/iu.test(value)) return value.slice(0, -1)
  return value
}

function resourceSlug(definition: RuntimeDefinition): string {
  return typeof definition.slug === 'string' && definition.slug ? definition.slug : definition.id
}

function resourcePrimaryKey(definition: RuntimeDefinition): string {
  const model = objectMember(definition, 'model')
  const modelDefinition = objectMember(model, 'definition')
  const primaryKey = modelDefinition ? Reflect.get(modelDefinition, 'primaryKey') : undefined
  if (typeof primaryKey === 'string' && primaryKey) return primaryKey
  return typeof definition.routeKey === 'string' && definition.routeKey ? definition.routeKey : 'id'
}

function resourceDefinition(value: object): RuntimeDefinition {
  const compiled = 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
  if (!compiled || typeof compiled !== 'object' || Reflect.get(compiled, 'kind') !== 'resource') {
    throw new TypeError('[Holo Panels] Generated resource pages require a compiled resource definition.')
  }
  return compiled as RuntimeDefinition
}

function resourceWidgetIds(definition: RuntimeDefinition): readonly string[] {
  const ids = compositionArrayMember(definition, 'widgets').flatMap((widget) => {
    const compiled = 'compile' in widget && typeof widget.compile === 'function' ? widget.compile() : widget
    if (!compiled || typeof compiled !== 'object') return []
    const manifest = objectMember(compiled, 'manifest')
    const id = manifest ? Reflect.get(manifest, 'id') : Reflect.get(compiled, 'id')
    return typeof id === 'string' && id ? [id] : []
  })
  return Object.freeze([...new Set(ids)])
}

type RuntimeRelationManager = RelationManagerDefinition<
  RuntimeRecord,
  object,
  object,
  Readonly<Record<string, unknown>>,
  Readonly<Record<string, unknown>>,
  number | string,
  object,
  unknown
>

function relationRecord(value: unknown): Readonly<Record<string, JsonValue>> {
  const prepared = value && typeof value === 'object' && 'toJSON' in value && typeof value.toJSON === 'function'
    ? serializeResourceRecord(value as { toJSON(): object })
    : value
  const serialized = toJsonValue(prepared)
  return serialized && typeof serialized === 'object' && !Array.isArray(serialized) ? serialized : {}
}

function relatedDefinition(relation: object): object | null {
  const related = Reflect.get(relation, 'related')
  if (typeof related !== 'function') return null
  const source = Reflect.apply(related, relation, [])
  if (!source || typeof source !== 'object') return null
  const definition = Reflect.get(source, 'definition')
  return definition && typeof definition === 'object' ? definition : source
}

function relationWritableFields(relation: object): readonly string[] {
  const definition = relatedDefinition(relation)
  const columns = definition ? objectMember(objectMember(definition, 'table'), 'columns') : undefined
  if (!definition || !columns) return Object.freeze([])
  const primaryKey = String(Reflect.get(definition, 'primaryKey') ?? 'id')
  const fillable = Array.isArray(Reflect.get(definition, 'fillable'))
    ? (Reflect.get(definition, 'fillable') as readonly unknown[]).filter((value: unknown): value is string => typeof value === 'string')
    : Object.keys(columns)
  const guarded = new Set(Array.isArray(Reflect.get(definition, 'guarded'))
    ? Reflect.get(definition, 'guarded').filter((value: unknown): value is string => typeof value === 'string')
    : [])
  const relationBindings = new Set([
    typeof Reflect.get(relation, 'foreignKey') === 'string' ? String(Reflect.get(relation, 'foreignKey')) : '',
    typeof Reflect.get(relation, 'morphIdColumn') === 'string' ? String(Reflect.get(relation, 'morphIdColumn')) : '',
    typeof Reflect.get(relation, 'morphTypeColumn') === 'string' ? String(Reflect.get(relation, 'morphTypeColumn')) : '',
  ])
  return Object.freeze(fillable.filter(field => field !== primaryKey && !guarded.has(field) && !relationBindings.has(field)))
}

function columnFieldType(columns: object | undefined, field: string): string {
  const column = columns ? objectMember(columns, field) : undefined
  const kind = column ? String(Reflect.get(column, 'kind') ?? '') : ''
  if (kind === 'boolean') return 'toggle'
  if (['date', 'datetime', 'timestamp'].includes(kind)) return 'date-time'
  if (['bigInteger', 'decimal', 'integer', 'real', 'snowflake'].includes(kind)) return 'number'
  if (kind === 'text') return 'textarea'
  return 'text'
}

function relationFieldType(relation: object, field: string): string {
  const definition = relatedDefinition(relation)
  return columnFieldType(definition ? objectMember(objectMember(definition, 'table'), 'columns') : undefined, field)
}

function relationFields(relation: object, fields: readonly string[]): readonly JsonObject[] {
  return Object.freeze(fields.map(field => Object.freeze({ id: field, label: label(field), required: true, type: relationFieldType(relation, field) })))
}

function pivotTableColumns(relation: object): object {
  const pivotTableValue = Reflect.get(relation, 'pivotTable')
  const pivotTable = pivotTableValue && typeof pivotTableValue === 'object'
    ? pivotTableValue
    : typeof pivotTableValue === 'string' ? getGeneratedTableDefinition(pivotTableValue) ?? null : null
  return pivotTable ? objectMember(pivotTable, 'columns') ?? {} : {}
}

function relationPivotFields(relation: object, fields: readonly string[]): readonly JsonObject[] {
  const columns = pivotTableColumns(relation)
  return Object.freeze(fields.map(field => Object.freeze({ id: field, label: label(field), required: false, type: columnFieldType(columns, field) })))
}

function automaticPivotFields(relation: RelationDefinition, context: GeneratedResourceOperationInput['context']): Readonly<{
  readonly bindings: Readonly<Record<string, number | string>>
  readonly writable: readonly string[]
}> {
  const columns = pivotTableColumns(relation)
  const bindings: Record<string, number | string> = {}
  if ('id' in columns) bindings.id = globalThis.crypto.randomUUID()
  const timestamp = new Date().toISOString()
  for (const field of ['createdAt', 'created_at', 'updatedAt', 'updated_at']) {
    if (field in columns && 'pivotColumns' in relation && relation.pivotColumns.includes(field)) bindings[field] = timestamp
  }
  for (const [binding, value] of Object.entries(context.tenantBindings ?? {})) {
    const field = binding in columns ? binding : camelCase(binding)
    if (field in columns) bindings[field] = value
  }
  const reserved = new Set(['id', 'tenantId', 'tenant_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at', ...Object.keys(bindings)])
  const writable = Object.freeze(('pivotColumns' in relation ? relation.pivotColumns : []).filter(field => !reserved.has(field)))
  return Object.freeze({
    bindings: Object.freeze(bindings),
    writable,
  })
}

function relationManager(
  definition: RuntimeDefinition,
  managerId: string,
): { readonly compiled: object, readonly operations: readonly RelationOperation[], readonly relation: RelationDefinition, readonly relationName: string, readonly runtime: RuntimeRelationManager | null } {
  const candidate = compositionArrayMember(definition, 'relations').find((manager) => {
    const compiled = 'compile' in manager && typeof manager.compile === 'function' ? manager.compile() : manager
    return compiled && typeof compiled === 'object' && String(Reflect.get(compiled, 'id') ?? Reflect.get(compiled, 'relationName') ?? '') === managerId
  })
  const compiled = candidate && 'compile' in candidate && typeof candidate.compile === 'function' ? candidate.compile() : candidate
  if (!compiled || typeof compiled !== 'object') throw new Error('[Holo Panels] The relation manager is not registered for this resource.')
  const relationName = String(Reflect.get(compiled, 'relationName') ?? Reflect.get(compiled, 'id') ?? '')
  const modelRelations = Reflect.get(definition.model.definition, 'relations')
  const relation = Reflect.get(compiled, 'relation') ?? (modelRelations && typeof modelRelations === 'object' ? Reflect.get(modelRelations, relationName) : undefined)
  if (!relationName || !relation || typeof relation !== 'object') throw new Error('[Holo Panels] The relation manager references an unknown model relation.')
  const configured = Reflect.get(compiled, 'persistence') && Reflect.get(compiled, 'authorization')
  return Object.freeze({
    compiled,
    operations: relationManagerOperations(compiled, relation as RelationDefinition),
    relation: relation as RelationDefinition,
    relationName,
    runtime: configured ? compiled as RuntimeRelationManager : null,
  })
}

function relationOperation(value: JsonValue | undefined): RelationOperation {
  const operations: readonly RelationOperation[] = ['associate', 'attach', 'create', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'list', 'select', 'view']
  if (typeof value !== 'string' || !operations.includes(value as RelationOperation)) throw new Error('[Holo Panels] The relation operation is invalid.')
  return value as RelationOperation
}

function relationIdentifier(payload: JsonObject, key: 'ownerId' | 'relatedId'): number | string {
  const value = payload[key]
  if (typeof value !== 'number' && (typeof value !== 'string' || !value)) throw new Error(`[Holo Panels] Relation operations require a valid ${key}.`)
  return value
}

function relationInput(payload: JsonObject, key: 'pivot' | 'values', allowed: readonly string[]): Readonly<Record<string, JsonValue>> {
  const value = payload[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({})
  const permitted = new Set(allowed)
  for (const field of Object.keys(value)) {
    if (!permitted.has(field)) throw new Error(`[Holo Panels] Relation input field "${field}" is not writable.`)
  }
  return Object.freeze({ ...value })
}

function isRuntimeResourceModel(value: unknown): value is ResourceModel<RuntimeRecord, RuntimeQuery> {
  if (!value || typeof value !== 'object' && typeof value !== 'function') return false
  const definition = Reflect.get(value, 'definition')
  return !!definition && typeof definition === 'object'
    && typeof Reflect.get(value, 'create') === 'function'
    && typeof Reflect.get(value, 'getConnectionName') === 'function'
    && typeof Reflect.get(value, 'query') === 'function'
    && typeof Reflect.get(value, 'unguarded') === 'function'
}

function relatedModel(relation: RelationDefinition): ResourceModel<RuntimeRecord, RuntimeQuery> {
  if (!('related' in relation) || typeof relation.related !== 'function') throw new Error('[Holo Panels] This relation does not expose a related model.')
  const model = relation.related()
  if (!isRuntimeResourceModel(model)) throw new Error('[Holo Panels] The related model is invalid.')
  return model
}

function tenantBindingsForModel(
  model: ResourceModel<RuntimeRecord, RuntimeQuery>,
  context: GeneratedResourceOperationInput['context'],
): Readonly<Record<string, number | string>> {
  const columns = model.definition.table?.columns ?? {}
  return Object.freeze(Object.fromEntries(Object.entries(context.tenantBindings ?? {}).flatMap(([binding, value]) => {
    const field = binding in columns ? binding : camelCase(binding)
    return field in columns ? [[field, value]] : []
  })))
}

async function relatedCandidate(
  relation: RelationDefinition,
  id: number | string,
  context: GeneratedResourceOperationInput['context'],
): Promise<RuntimeRecord> {
  const model = relatedModel(relation)
  let query = model.query()
  const bindings = tenantBindingsForModel(model, context)
  if (Object.keys(bindings).length > 0) {
    for (const [field, value] of Object.entries(bindings)) query = query.where(field, '=', value)
  } else if (context.scopeTenantQuery) query = context.scopeTenantQuery(query)
  const record = await query.where(model.definition.primaryKey, '=', id).first()
  if (!record || !matchesTenantBindings(record, context)) throw new RelationRecordNotFoundError()
  return record
}

async function ownedRelatedRecord(
  owner: RuntimeRecord,
  relationName: string,
  relation: RelationDefinition,
  id: number | string,
  context: GeneratedResourceOperationInput['context'],
): Promise<RuntimeRecord> {
  const primaryKey = relatedModel(relation).definition.primaryKey
  const records = await automaticRelationRecords(owner, relationName, context)
  const record = records.find(candidate => candidate && typeof candidate === 'object' && Reflect.get(candidate, primaryKey) === id)
  if (!record || typeof record !== 'object') throw new RelationRecordNotFoundError()
  return record as RuntimeRecord
}

async function invokeRecord<TResult>(record: object, method: string, parameters: readonly unknown[]): Promise<TResult> {
  const operation = Reflect.get(record, method)
  if (typeof operation !== 'function') throw new Error(`[Holo Panels] The Holo model does not support relation method "${method}".`)
  return await Reflect.apply(operation, record, parameters) as TResult
}

function relationColumns(
  manager: object,
  relation: object,
  records: readonly Readonly<Record<string, JsonValue>>[],
): readonly JsonObject[] {
  const configured = arrayMember(compiledObjectMember(manager, 'table'), 'columns').flatMap((column) => {
    const path = Reflect.get(column, 'path')
    if (typeof path !== 'string' || !path) return []
    const configuredLabel = Reflect.get(column, 'label')
    return [{ key: path, label: typeof configuredLabel === 'string' && configuredLabel ? configuredLabel : label(path) }]
  })
  if (configured.length > 0) return Object.freeze(configured)
  const definition = relatedDefinition(relation)
  const table = definition ? objectMember(definition, 'table') : undefined
  const columns = table ? objectMember(table, 'columns') : undefined
  const hidden = new Set(Array.isArray(definition && Reflect.get(definition, 'hidden'))
    ? Reflect.get(definition!, 'hidden') as readonly string[]
    : [])
  const keys = columns
    ? Object.keys(columns).filter(key => !hidden.has(key))
    : Object.keys(records[0] ?? {})
  return Object.freeze(keys.map(key => Object.freeze({ key, label: label(key) })))
}

function relationManagerOperations(manager: object, relation: RelationDefinition): readonly RelationOperation[] {
  const allowed = new Set(allowedRelationOperations(relation))
  const configured = Reflect.get(manager, 'operations')
  if (Array.isArray(configured)) {
    return Object.freeze(configured.filter((operation): operation is RelationOperation => typeof operation === 'string' && allowed.has(operation as RelationOperation)))
  }
  return Object.freeze(compositionArrayMember(manager, 'actions').flatMap((action) => {
    const kind = Reflect.get(action, 'kind')
    return typeof kind === 'string' && allowed.has(kind as RelationOperation) ? [kind as RelationOperation] : []
  }))
}

function relationActions(manager: object, relation: RelationDefinition): readonly ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>[] {
  const declared = compositionArrayMember(manager, 'actions')
  const definitions = declared.length > 0 ? declared : relationManagerOperations(manager, relation).filter(operation => operation !== 'list').map(kind => ({ id: kind === 'editPivot' ? 'edit-pivot' : kind, kind }))
  return definitions.map(value => {
    const action = value as Partial<ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>>
    if (!action.id || !action.kind) throw new Error('Relation actions require registered IDs and kinds')
    const defaults = builtInActionPresentation(action.kind)
    return {
      ...defaults,
      ...action,
      authorize: action.authorize ?? (() => true),
      handle: action.handle ?? (() => undefined),
      id: action.id,
      kind: action.kind,
      label: action.label ?? label(action.id),
      mount: action.mount ?? (['create', 'associate', 'attach'].includes(action.kind) ? 'page' : 'record'),
    }
  })
}

async function relationActionManifests(actions: ReturnType<typeof relationActions>, context: GeneratedResourceOperationInput['context'], record: RuntimeRecord | null, editable: boolean, owner: RuntimeRecord): Promise<readonly ActionManifest[]> {
  return Promise.all(actions.filter(action => (record ? action.mount === 'record' : action.mount !== 'record') && (editable || action.kind === 'view')).map(async action => {
    const scope = { ...context, owner, mount: action.mount, record, selectedRecords: [], services: undefined }
    const state = await resolveActionState(action, scope)
    return compileActionManifest(action, state.label, scope, state)
  }))
}

function camelCase(value: string): string {
  return value.replace(/_([a-z0-9])/gu, (_match, character: string) => character.toUpperCase())
}

function matchesTenantBindings(record: object, context: GeneratedResourceOperationInput['context']): boolean {
  if (!context.tenantBindings) return true
  const values = relationRecord(record)
  return Object.entries(context.tenantBindings).every(([binding, expected]) => {
    const key = binding in values ? binding : camelCase(binding)
    return !(key in values) || values[key] === expected
  })
}

async function automaticRelationRecords(
  owner: RuntimeRecord,
  relationName: string,
  context: GeneratedResourceOperationInput['context'],
): Promise<readonly unknown[]> {
  const load = Reflect.get(owner, 'load')
  if (typeof load !== 'function') throw new Error(`[Holo Panels] Relation manager "${relationName}" requires a Holo model record.`)
  await Reflect.apply(load, owner, [relationName])
  const getRelation = Reflect.get(owner, 'getRelation')
  const value = typeof getRelation === 'function' ? Reflect.apply(getRelation, owner, [relationName]) : Reflect.get(owner, relationName)
  const records = Array.isArray(value) ? value : value === null || typeof value === 'undefined' ? [] : [value]
  const authorized: unknown[] = []
  for (const record of records) {
    if (!record || typeof record !== 'object' || !matchesTenantBindings(record, context)) continue
    try {
      await authorizeHoloPolicy(context.actor, 'view', record, context.strictAuthorization)
      authorized.push(record)
    } catch {
      continue
    }
  }
  return Object.freeze(authorized)
}

async function resourceRelations(
  definition: RuntimeDefinition,
  owner: RuntimeRecord,
  context: GeneratedResourceOperationInput['context'],
  editable: boolean,
): Promise<readonly object[]> {
  const managers = await Promise.all(compositionArrayMember(definition, 'relations').map(async (manager) => {
    const compiled = 'compile' in manager && typeof manager.compile === 'function' ? manager.compile() : manager
    const relationName = String(Reflect.get(compiled, 'relationName') ?? Reflect.get(compiled, 'id') ?? '')
    const modelRelations = Reflect.get(definition.model.definition, 'relations')
    const relation = Reflect.get(compiled, 'relation') ?? (modelRelations && typeof modelRelations === 'object' ? Reflect.get(modelRelations, relationName) : undefined)
    if (!relationName || !relation || typeof relation !== 'object') throw new Error(`[Holo Panels] Resource "${definition.id}" references an unknown relation manager.`)
    const configured = Reflect.get(compiled, 'persistence') && Reflect.get(compiled, 'authorization')
    const runtime = configured ? compiled as unknown as RuntimeRelationManager : null
    const managerContext = { actor: context.actor, owner, signal: context.signal, tenant: context.tenant }
    const visible = runtime ? await runtime.visible(managerContext) : true
    const badge = runtime ? await runtime.badge?.(managerContext) ?? null : null
    const page = runtime
      ? await new RelationManagerExecutor(runtime).list({ includeTotal: true, page: 1, perPage: 25 }, managerContext)
      : { records: await automaticRelationRecords(owner, relationName, context) }
    const records = page.records.map(relationRecord)
    const related = relatedDefinition(relation)
    const primaryKey = related && typeof Reflect.get(related, 'primaryKey') === 'string' ? String(Reflect.get(related, 'primaryKey')) : 'id'
    const serializedRecords = records.map((record) => {
      const id = record[primaryKey]
      if (typeof id !== 'number' && typeof id !== 'string') throw new Error(`[Holo Panels] Related records require a string or numeric "${primaryKey}".`)
      return Object.freeze({ id, values: record })
    })
    const operations = relationManagerOperations(compiled, relation as RelationDefinition)
    const actions = relationActions(compiled, relation as RelationDefinition)
    const writableFields = runtime?.writableInputFields ?? relationWritableFields(relation)
    const writablePivotFields = runtime?.writablePivotFields ?? automaticPivotFields(relation as RelationDefinition, context).writable
    return Object.freeze({
      actions: await relationActionManifests(actions, context, null, editable, owner),
      badge,
      columns: relationColumns(compiled, relation, records),
      fields: relationFields(relation, writableFields),
      group: runtime?.group ?? null,
      id: String(Reflect.get(compiled, 'id') ?? relationName),
      label: label(String(Reflect.get(compiled, 'id') ?? relationName)),
      operations: editable ? operations : operations.filter(operation => operation === 'list' || operation === 'view'),
      pivotFields: relationPivotFields(relation, writablePivotFields),
      presentation: runtime?.presentation ?? 'inline',
      records: serializedRecords,
      recordActions: await Promise.all(page.records.map(async (record, index) => ({
        actions: await relationActionManifests(actions, context, record as RuntimeRecord, editable, owner),
        recordId: serializedRecords[index]?.id,
      }))),
      url: null,
      visible,
    })
  }))
  return Object.freeze(managers)
}

function uploadActorId(actor: object): string {
  const value = Reflect.get(actor, 'id')
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('[Holo Panels] Upload actors require a stable string or numeric ID.')
  return String(value)
}

function uploadTenantId(tenant: unknown): string | undefined {
  if (typeof tenant === 'string' || typeof tenant === 'number') return String(tenant)
  if (!tenant || typeof tenant !== 'object') return undefined
  const value = Reflect.get(tenant, 'id')
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

function uploadField(definition: RuntimeDefinition, fieldId: string): { readonly path: string, readonly policy: UploadPolicy } {
  const field = resourceSchemaFields(definition.form).find(candidate => Reflect.get(candidate, 'path') === fieldId)
  if (!field || Reflect.get(field, 'type') !== 'panels:field:upload') throw new Error('[Holo Panels] The requested upload field is not registered for this resource.')
  const properties = objectMember(field, 'properties')
  const policy = objectMember(properties, 'uploadPolicy')
  if (!policy) throw new Error('[Holo Panels] The requested upload field has no server policy.')
  return { path: fieldId, policy: policy as UploadPolicy }
}

function uploadService(
  definition: RuntimeDefinition,
  fieldId: string,
  input: GeneratedUploadOperationInput,
) {
  const field = uploadField(definition, fieldId)
  const executor = new ResourceExecutor(definition, { strictAuthorization: input.strictAuthorization })
  const identifier = recordIdentifier(input.payload)
  const resourceContext = input.context
  return {
    field,
    service: createTemporaryUploadService({
      authorize: async () => {
        if (identifier === null) await executor.authorizeCreate(resourceContext)
        else await executor.authorizeUpdate(identifier, resourceContext)
        return true
      },
      policy: field.policy,
      ...(input.context.uploadStorage ? { storage: input.context.uploadStorage } : {}),
    }),
  }
}

function uploadActorContext(definition: RuntimeDefinition, fieldId: string, input: GeneratedUploadOperationInput) {
  const tenantId = uploadTenantId(input.context.tenant)
  return {
    actorId: uploadActorId(input.context.actor),
    fieldId,
    panelId: input.panelId,
    resourceId: definition.id,
    ...(tenantId ? { tenantId } : {}),
  }
}

async function finalizedUploadValues(
  definition: RuntimeDefinition,
  values: JsonObject,
  input: GeneratedResourceOperationInput,
  record: RuntimeRecord | null = null,
): Promise<JsonObject> {
  const result: JsonObject = { ...values }
  for (const field of resourceSchemaFields(definition.form)) {
    if (Reflect.get(field, 'type') !== 'panels:field:upload') continue
    const fieldId = Reflect.get(field, 'path')
    if (typeof fieldId !== 'string') continue
    const value = valueAtPath(result, fieldId)
    const descriptors = Array.isArray(value) ? value : value ? [value] : []
    if (descriptors.length === 0) continue
    const existing = record ? valueAtPath(record.toJSON(), fieldId) : undefined
    const retained = new Set(Array.isArray(existing) ? existing.filter((path): path is string => typeof path === 'string') : typeof existing === 'string' ? [existing] : [])
    const uploadInput: GeneratedUploadOperationInput = {
      context: input.context,
      panelId: input.panelId,
      payload: input.payload,
    }
    const { service } = uploadService(definition, fieldId, uploadInput)
    const policy = objectMember(objectMember(field, 'properties'), 'uploadPolicy')
    const maximumFiles = policy ? Reflect.get(policy, 'maximumFiles') : undefined
    if (typeof maximumFiles === 'number' && descriptors.length > maximumFiles) throw new Error('[Holo Panels] Upload file count exceeds the configured limit.')
    const context = uploadActorContext(definition, fieldId, uploadInput)
    const paths: string[] = []
    for (const descriptor of descriptors) {
      if (typeof descriptor === 'string') {
        if (!retained.has(descriptor)) throw new Error('[Holo Panels] Upload paths must belong to the current record.')
        paths.push(descriptor)
        continue
      }
      if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) throw new Error('[Holo Panels] Upload form values contain an invalid descriptor.')
      const id = Reflect.get(descriptor, 'id')
      const sessionId = Reflect.get(descriptor, 'sessionId')
      const token = Reflect.get(descriptor, 'token')
      if (typeof id !== 'string' || typeof sessionId !== 'string' || typeof token !== 'string') throw new Error('[Holo Panels] Upload form values contain an invalid descriptor.')
      paths.push((await service.finalizeToStorage({ ...context, id, sessionId, token })).path)
    }
    setValueAtPath(result, fieldId, Array.isArray(value) ? paths : paths[0] ?? null)
  }
  return result
}

function jsonObject(value: object): JsonObject {
  const serialized = toJsonValue(value)
  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('[Holo Panels] Generated resource data must be JSON-safe.')
  return serialized
}

function explicitResourcePages(definition: RuntimeDefinition): readonly object[] {
  return (definition.pages ?? []).filter(page => ['create', 'edit', 'list', 'view'].includes(String(Reflect.get(page, 'pageType'))))
}

function resourcePageActions(definition: RuntimeDefinition, pageType: PageType): readonly object[] {
  const page = explicitResourcePages(definition).find(candidate => Reflect.get(candidate, 'pageType') === pageType)
  if (!page) return []
  const actions = Reflect.get(page, 'actions')
  if (Array.isArray(actions)) return actions.filter((action: unknown): action is object => typeof action === 'object' && action !== null)
  if (!actions || typeof actions !== 'object') return []
  const header = Reflect.get(actions, 'header')
  const footer = Reflect.get(actions, 'footer')
  return [...(Array.isArray(header) ? header : []), ...(Array.isArray(footer) ? footer : [])]
}

function resourceFormActions(definition: RuntimeDefinition, pageType: PageType): readonly object[] {
  const registered = (definition.actions ?? []).filter(action => Reflect.get(action, 'source') === `${pageType}:form`)
  if (explicitResourcePages(definition).length > 0 || registered.length > 0 || !['create', 'edit'].includes(pageType)) return registered
  const kind = pageType === 'create' ? 'create' : 'edit'
  return [{ ...builtInActionPresentation(kind), authorize: () => true, formIntent: 'submit', handle: () => undefined, id: kind, kind, label: kind === 'create' ? 'Create' : 'Save', mount: kind === 'create' ? 'page' : 'record', source: `${pageType}:form`, usesDefaultHandler: true }]
}

function resourceRoutes(definition: RuntimeDefinition, basePath: string): JsonObject {
  const pages = explicitResourcePages(definition)
  if (pages.length === 0) {
    return { create: `${basePath}/create`, edit: `${basePath}/:record/edit`, view: `${basePath}/:record` }
  }
  const entries = pages.flatMap((page) => {
    const pageType = Reflect.get(page, 'pageType')
    const path = Reflect.get(page, 'path')
    if (!['create', 'edit', 'view'].includes(String(pageType)) || typeof path !== 'string') return []
    const suffix = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/gu, '').replaceAll('{record}', ':record')}`
    return [[String(pageType), `${basePath}${suffix}`] as const]
  })
  return Object.fromEntries(entries) as JsonObject
}

function resourceFieldProperties(field: object, fields: readonly object[]): Readonly<Record<string, unknown>> {
  const properties = objectMember(field, 'properties') ?? {}
  const path = Reflect.get(field, 'path')
  const conventionalSlug = path === 'slug'
    && typeof Reflect.get(properties, 'specialization') !== 'string'
    && fields.some(candidate => Reflect.get(candidate, 'path') === 'title')
  return conventionalSlug
    ? { ...properties, source: 'title', specialization: 'slug' }
    : properties as Readonly<Record<string, unknown>>
}

function resourceFormFields(definition: RuntimeDefinition) {
  const compiledFields = resourceSchemaFields(definition.form)
  return compiledFields.map((field) => {
    const path = String(Reflect.get(field, 'path'))
    const source = objectMember(objectMember(field, 'server'), 'options')
    const manifestOptions = source && 'manifestOptions' in source && typeof source.manifestOptions === 'function'
      ? Reflect.apply(source.manifestOptions, source, [])
      : undefined
    const properties = {
      ...resourceFieldProperties(field, compiledFields),
      ...(objectMember(field, 'clientHints') ? { validationHints: objectMember(field, 'clientHints') } : {}),
      ...(Array.isArray(manifestOptions) ? { options: manifestOptions } : {}),
    }
    const specialization = Reflect.get(properties, 'specialization')
    return {
      debounceMilliseconds: typeof Reflect.get(field, 'debounceMilliseconds') === 'number' ? Reflect.get(field, 'debounceMilliseconds') : 0,
      disabled: Reflect.get(field, 'disabled') === true,
      helperText: typeof Reflect.get(field, 'helperText') === 'string' ? Reflect.get(field, 'helperText') : null,
      hint: typeof Reflect.get(field, 'hint') === 'string' ? Reflect.get(field, 'hint') : null,
      label: typeof Reflect.get(field, 'label') === 'string' ? Reflect.get(field, 'label') : label(path),
      path,
      placeholder: typeof Reflect.get(field, 'placeholder') === 'string' ? Reflect.get(field, 'placeholder') : null,
      properties,
      readOnly: Reflect.get(field, 'readOnly') === true,
      required: Reflect.get(field, 'required') === true,
      rules: Array.isArray(Reflect.get(field, 'rules')) ? Reflect.get(field, 'rules') as readonly string[] : [],
      type: specialization === 'slug' ? 'slug' : String(Reflect.get(field, 'type') ?? 'text'),
      visible: Reflect.get(field, 'visible') !== false,
    }
  })
}

async function resolvedResourceFormFields(
  definition: RuntimeDefinition,
  context: Readonly<{ actor: object, services?: unknown, signal: AbortSignal, tenant: unknown }>,
  record: RuntimeRecord | null,
  mount: 'page' | 'record',
): Promise<ReturnType<typeof resourceFormFields>> {
  const compiledFields = resourceSchemaFields(definition.form)
  const fields = resourceFormFields(definition)
  return Promise.all(fields.map(async (field) => {
    const compiledField = compiledFields.find(candidate => Reflect.get(candidate, 'path') === field.path)
    const actions = arrayMember(objectMember(compiledField, 'server'), 'actions')
    if (actions.length === 0) return field
    const properties: Record<string, unknown> = { ...field.properties }
    for (const candidate of actions) {
      const action = { ...(candidate as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, unknown>), mount, source: `form-field:${field.path}` }
      const scope = { actor: context.actor, mount, record, services: context.services, signal: context.signal, tenant: context.tenant }
      const state = await resolveActionState(action, scope)
      const manifest = await compileActionManifest(action, state.label, scope, state)
      const position = Reflect.get(candidate, 'position')
      if (position === 'hint') properties.hintAction = manifest
      if (position === 'prefix') properties.prefixAction = manifest
      if (position === 'suffix') properties.suffixAction = manifest
    }
    return { ...field, properties }
  }))
}

function resourceModalAction<TServices>(
  action: ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, TServices>,
  definition: RuntimeDefinition,
  record: RuntimeRecord | null,
): typeof action {
  if (action.url || action.modal?.schema || action.mount === 'bulk' || !['create', 'edit', 'view'].includes(action.kind) || resourceRoutes(definition, '')[action.kind] !== undefined) return action
  const values = record ? serializeResourceRecord(record) : {}
  const fields = resourceFormFields(definition).filter(field => action.kind === 'view' || definition.writableAttributes.includes(field.path)).map(field => ({
    ...field,
    defaultValue: valueAtPath(values, field.path) ?? Reflect.get(field.properties, 'defaultValue') ?? '',
    kind: 'field',
    readOnly: action.kind === 'view' || field.readOnly,
  }))
  return { ...action, modal: { ...action.modal, schema: jsonObject({ fields }) } }
}

function resourceProperties(definition: RuntimeDefinition, pageType: PageType, basePath: string): JsonObject {
  const table = definition.table
  const slug = resourceSlug(definition)
  const capabilities = definition.capabilities ?? { delete: true, forceDelete: false, restore: false }
  const fields = resourceFormFields(definition)
  const columns = arrayMember(table, 'columns').map(column => ({
    alignment: Reflect.get(column, 'alignment') === 'center' || Reflect.get(column, 'alignment') === 'end' ? Reflect.get(column, 'alignment') : 'start',
    copyable: Reflect.get(column, 'copyable') === true,
    dataSource: objectMember(column, 'dataSource') ?? { kind: 'path' },
    formatters: arrayMember(column, 'formatters'),
    hidden: Reflect.get(column, 'hidden') === true,
    inlineEditor: objectMember(column, 'inlineEditor') ?? null,
    label: typeof Reflect.get(column, 'label') === 'string' ? Reflect.get(column, 'label') : null,
    lineClamp: Number.isSafeInteger(Reflect.get(column, 'lineClamp')) && Number(Reflect.get(column, 'lineClamp')) > 0 ? Reflect.get(column, 'lineClamp') : null,
    path: String(Reflect.get(column, 'path')),
    searchable: Reflect.get(column, 'searchable') === true,
    sortable: Reflect.get(column, 'sortable') === true,
    toggleable: Reflect.get(column, 'toggleable') !== false,
    type: String(Reflect.get(column, 'type') ?? 'text'),
    width: typeof Reflect.get(column, 'width') === 'string' || typeof Reflect.get(column, 'width') === 'number' ? Reflect.get(column, 'width') : null,
    wrap: Reflect.get(column, 'wrap') !== false,
  }))
  const dependencies = fields.flatMap((field) => {
    const source = Reflect.get(field.properties, 'source')
    if (field.type !== 'slug' || typeof source !== 'string') return []
    return [{ id: `${definition.id}-${field.path.replaceAll('.', '-')}`, patches: [{ path: field.path, resolver: { input: { source }, name: 'slug' } }], paths: [source] }]
  })
  const navigation = definition.navigation ?? {}
  const plural = typeof navigation.label === 'string' ? navigation.label : label(slug)
  const singular = singularize(plural)
  const configuredActions = (definition.actions ?? []).filter(action => !String(Reflect.get(action, 'source')).startsWith('infolist:') && !String(Reflect.get(action, 'source')).startsWith('form-field:') && !String(Reflect.get(action, 'source')).endsWith(':form')).map(action => actionManifestSeed(action))
  const hasExplicitPages = explicitResourcePages(definition).length > 0
  const pageActionScope = pageType === 'edit' || pageType === 'view' ? 'record' : 'header'
  const pageActions = resourcePageActions(definition, pageType).map(action => 'manifest' in action && typeof action.manifest === 'function'
    ? action.manifest(pageActionScope) as ActionManifest
    : actionManifestSeed(action))
  const recordActions = hasExplicitPages ? pageActions : configuredActions.filter(action => action.mount === 'record')
  const tableActions = configuredActions.flatMap(action => {
    const scope = action.mount === 'bulk' ? 'bulk' : action.mount === 'page' ? 'header' : action.mount === 'record' ? 'row' : null
    return scope ? [{ color: action.color, confirmation: action.confirmation, icon: action.icon, id: action.id, kind: action.kind, label: action.label, removesRecord: false, scope }] : []
  })
  const configuredEntries = infolistComponents(definition.infolist).map(entry => objectMember(entry, 'manifest') ?? entry)
  const entries = (configuredEntries.length > 0 ? configuredEntries : fields).map((entry, index) => {
    const source = objectMember(entry, 'source')
    const pathValue = Reflect.get(entry, 'path') ?? Reflect.get(source ?? {}, 'path')
    const path = typeof pathValue === 'string' ? pathValue : String(index)
    const entryProperties = objectMember(entry, 'properties') ?? {}
    const formatters = arrayMember(entry, 'formatters')
    return {
      actions: Array.isArray(Reflect.get(entry, 'actions')) ? Reflect.get(entry, 'actions') : [],
      copyable: Reflect.get(entry, 'copyable') === true,
      id: `${definition.id}-${path.replaceAll('.', '-')}`,
      inlineLabel: Reflect.get(entry, 'inlineLabel') === true,
      label: typeof Reflect.get(entry, 'label') === 'string' ? Reflect.get(entry, 'label') : label(path),
      path,
      placeholder: typeof Reflect.get(entry, 'placeholder') === 'string' ? Reflect.get(entry, 'placeholder') : null,
      properties: formatters.length > 0 ? { ...entryProperties, formats: formatters } : entryProperties,
      type: String(Reflect.get(entry, 'type') ?? 'text'),
    }
  })
  const configuredTableActions = arrayMember(table, 'actions')
  const properties = {
    resource: {
      actions: recordActions,
      capabilities,
      form: {
        actions: resourceFormActions(definition, pageType).map(action => ({ ...actionManifestSeed(action), formIntent: Reflect.get(action, 'formIntent') ?? 'submit' })),
        dependencies,
        fields,
        schema: resourceFormSchema(definition.form, `${definition.id}-${pageType}-form`),
      },
      id: definition.id,
      infolist: {
        entries,
      },
      labels: {
        create: `Create ${singular.toLowerCase()}`,
        deleted: `${singular} deleted.`,
        edit: `Edit ${singular.toLowerCase()}`,
        plural,
        save: `Save ${singular.toLowerCase()}`,
        saved: `${singular} saved.`,
        saving: 'Saving…',
      },
      recordTitle: definition.recordTitle ?? 'id',
      recordId: resourcePrimaryKey(definition),
      routeKey: definition.routeKey ?? 'id',
      routes: resourceRoutes(definition, basePath),
      slug,
      table: {
        actions: configuredTableActions.length > 0 ? configuredTableActions : tableActions,
        columns,
        filterMode: table && Reflect.get(table, 'filterMode') === 'deferred' ? 'deferred' : 'live',
        filters: resourceFilters(table),
        groups: arrayMember(table, 'groups'),
        recordLink: definition.recordTitle ?? 'id',
        summaries: arrayMember(table, 'summaries'),
        selection: objectMember(table, 'selection') ?? {},
      },
    },
  }
  const serialized = toJsonValue(properties)
  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('[Holo Panels] Generated resource page properties must be JSON-safe.')
  return serialized
}

function pageManifest(
  definition: RuntimeDefinition,
  panelPath: string,
  pageType: PageType,
): PageManifest {
  const slug = resourceSlug(definition)
  const listPath = `${panelPath === '/' ? '' : panelPath}/${slug}`
  const suffix = pageType === 'create' ? '/create' : pageType === 'list' ? '' : pageType === 'edit' ? '/:record/edit' : '/:record'
  const id = pageType === 'list' ? definition.id : `${definition.id}-${pageType}`
  const navigation = definition.navigation ?? {}
  const plural = typeof navigation.label === 'string' ? navigation.label : label(slug)
  const widgetIds = resourceWidgetIds(definition)
  const explicitPage = explicitResourcePages(definition).find(page => Reflect.get(page, 'pageType') === pageType)
  const explicitActions = explicitPage ? resourcePageActions(definition, pageType) : []
  return Object.freeze({
    actions: {
      footer: [],
      header: explicitPage ? explicitActions.map((action: object) => String(Reflect.get(action, 'id'))) : pageType === 'list' ? [`${definition.id}.create`] : [],
    },
    body: { component: 'resource-page', properties: { ...resourceProperties(definition, pageType, listPath), operation: pageType } },
    id,
    navigation: pageType === 'list'
      ? {
          badge: null,
          group: navigation.group ?? null,
          icon: navigation.icon ?? null,
          label: plural,
          parent: null,
          sort: navigation.sort ?? 0,
        }
      : null,
    pageType,
    path: `${listPath}${suffix}`,
    renderer: null,
    schemaId: null,
    widgets: { footer: [], header: pageType === 'list' ? widgetIds : [] },
  })
}

export function generatedResourcePageManifests(options: GeneratedResourcePageOptions): readonly PageManifest[] {
  const definition = resourceDefinition(options.resource)
  const explicitPages = explicitResourcePages(definition)
  if (explicitPages.length > 0) {
    return Object.freeze(explicitPages.map((page) => {
      const pageType = Reflect.get(page, 'pageType') as PageType
      const manifest = pageManifest(definition, options.panelPath, pageType)
      const path = String(Reflect.get(page, 'path'))
      const suffix = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/gu, '').replaceAll('{record}', ':record')}`
      const slug = resourceSlug(definition)
      const listPath = `${options.panelPath === '/' ? '' : options.panelPath}/${slug}`
      return Object.freeze({ ...manifest, path: `${listPath}${suffix}` })
    }))
  }
  const pageTypes: readonly PageType[] = definition.singular !== null && typeof definition.singular !== 'undefined'
    ? ['singular']
    : (definition.capabilities?.delete ?? true) ? ['list', 'create', 'view', 'edit'] : ['list', 'view']
  return Object.freeze(pageTypes.map(pageType => pageManifest(definition, options.panelPath, pageType)))
}

export function createGeneratedResourcePage(resource: object, manifest: PageManifest): CompiledPageDefinition<JsonObject, object, unknown, unknown> {
  const definition = resourceDefinition(resource)
  const navigation = definition.navigation ?? {}
  const slug = resourceSlug(definition)
  const plural = typeof navigation.label === 'string' ? navigation.label : label(slug)
  const load = async (context: PageContext<object, unknown, unknown>): Promise<JsonObject> => {
    const executor = new ResourceExecutor(definition, { strictAuthorization: context.strictAuthorization })
    const executionContext = { actor: context.actor, signal: context.signal, strictAuthorization: context.strictAuthorization, tenant: context.tenant }
    if (manifest.pageType === 'list') {
      const tableState = Object.freeze({ includeTotal: true, page: 1, pagination: 'page' as const, perPage: 25 })
      const table = await executor.table(tableState, executionContext, record => resolveGeneratedRowActions(definition, executionContext, record))
      const presentation = await tablePresentation(definition, table.records, executionContext)
      return jsonObject({ groups: presentation.groups, operation: 'list', records: table.records, resourceId: definition.id, rowActions: table.recordPresentations, summaries: presentation.summaries, tableActions: await resolveGeneratedTableActions(definition, executionContext), tableState, total: table.total })
    }
    if (manifest.pageType === 'create') return { operation: 'create', resourceId: definition.id }
    const record = context.parameters.record
    if (!record) throw new Error('[Holo Panels] Generated record pages require a record route parameter.')
    const [serialized, owner] = await Promise.all([
      executor.serialize(record, executionContext),
      executor.resolveActionRecord(record, executionContext),
    ])
    if (!owner) throw new Error('[Holo Panels] Generated record pages require an authorized record.')
    return jsonObject({
      operation: manifest.pageType,
      record: serialized,
      relations: await resourceRelations(definition, owner, executionContext, manifest.pageType === 'edit'),
      resourceId: definition.id,
    })
  }
  return Object.freeze({
    kind: 'page',
    manifest,
    server: {
      authorize: (context: PageContext<object, unknown, unknown>) => canHoloPolicy(context.actor, 'viewAny', definition.model, context.strictAuthorization),
      breadcrumbs: [{ label: plural, path: manifest.path.split('/:record')[0]! }],
      heading: manifest.pageType === 'list' ? null : `${label(manifest.pageType)} ${label(singularize(plural))}`,
      load,
      manifest: (context: PageContext<object, unknown, unknown>) => resolveGeneratedPageActions(definition, manifest, context),
      title: plural,
    },
  })
}

async function resolveGeneratedRowActions(definition: RuntimeDefinition, context: GeneratedResourceOperationInput['context'], record: RuntimeRecord): Promise<JsonObject> {
  return jsonObject({ actions: await resolveGeneratedTableActions(definition, context, record), recordId: valueAtPath(record.toJSON(), definition.routeKey ?? definition.model.definition.primaryKey) })
}

async function resolveGeneratedTableActions(definition: RuntimeDefinition, context: GeneratedResourceOperationInput['context'], record: RuntimeRecord | null = null): Promise<readonly object[]> {
  const resolve = async (entries: readonly object[]): Promise<readonly object[]> => Promise.all(entries.map(async entry => {
    if (Reflect.get(entry, 'kind') === 'action-group') return { ...entry, actions: await resolve(arrayMember(entry, 'actions')) }
    const mount: ActionMount = Reflect.get(entry, 'scope') === 'bulk' ? 'bulk' : Reflect.get(entry, 'scope') === 'header' ? 'page' : 'record'
    if ((mount === 'record') !== (record !== null)) return entry
    const candidates = (definition.actions ?? []).filter(action => action.id === Reflect.get(entry, 'id') && action.mount === mount && (!Reflect.get(action, 'source') || Reflect.get(action, 'source') === 'table'))
    if (candidates.length > 1) throw new Error('[Holo Panels] The table action registration is ambiguous.')
    const action = candidates[0] as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined> | undefined
    if (!action) return entry
    const scope = { ...context, mount, record, selectedRecords: record ? [record] : [], services: undefined }
    const state = await resolveActionState(action, scope)
    return { ...entry, ...await compileActionManifest(resourceModalAction(action, definition, record), state.label, scope, state) }
  }))
  return resolve(arrayMember(definition.table, 'actions'))
}

async function resolveGeneratedPageActions(
  definition: RuntimeDefinition,
  manifest: PageManifest,
  context: PageContext<object, unknown, unknown>,
): Promise<PageManifest> {
  const properties = manifest.body?.properties
  const resource = properties && objectMember(properties, 'resource')
  if (!manifest.body || !resource) return manifest
  const entries = arrayMember(resource, 'actions').map((entry) => {
    const candidates = (definition.actions ?? []).filter(action => action.id === Reflect.get(entry, 'id')
      && action.mount === Reflect.get(entry, 'mount')
      && (!Reflect.get(action, 'source') || Reflect.get(action, 'source') === manifest.pageType))
    if (candidates.length > 1) throw new Error('[Holo Panels] The generated page action registration is ambiguous.')
    return { definition: candidates[0], manifest: entry }
  })
  const infolist = objectMember(resource, 'infolist')
  const infolistEntries = arrayMember(infolist, 'entries')
  const infolistActions = (definition.actions ?? []).filter(action => String(Reflect.get(action, 'source')).startsWith('infolist:'))
  const form = objectMember(resource, 'form')
  const formActions = resourceFormActions(definition, manifest.pageType)
  const fieldActions = resourceSchemaFields(definition.form).some(field => arrayMember(objectMember(field, 'server'), 'actions').length > 0)
  if (!entries.some(entry => entry.definition) && infolistActions.length === 0 && formActions.length === 0 && !fieldActions) return manifest
  const executor = new ResourceExecutor(definition, { strictAuthorization: context.strictAuthorization })
  const recordId = manifest.pageType === 'edit' || manifest.pageType === 'view' ? context.parameters.record : undefined
  const record = recordId ? await executor.resolveActionRecord(recordId, context) : null
  const actions = await Promise.all(entries.map(async (entry) => {
    if (!entry.definition) return entry.manifest
    const compiled = resourceModalAction(entry.definition as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, unknown>, definition, record)
    const scope = { actor: context.actor, mount: compiled.mount, record, services: context.services, signal: context.signal, tenant: context.tenant }
    const state = await resolveActionState(compiled, scope)
    return { ...entry.manifest, ...await compileActionManifest(compiled, state.label, scope, state) }
  }))
  const resolvedFormActions = await Promise.all(formActions.map(async (action) => {
    const compiled = action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, unknown>
    const scope = { actor: context.actor, mount: compiled.mount, record, services: context.services, signal: context.signal, tenant: context.tenant }
    const state = await resolveActionState(compiled, scope)
    return { ...await compileActionManifest(compiled, state.label, scope, state), formIntent: Reflect.get(action, 'formIntent') ?? 'submit' }
  }))
  const resolvedFields = await resolvedResourceFormFields(definition, context, record, manifest.pageType === 'create' ? 'page' : 'record')
  const resolvedEntries = await Promise.all(infolistEntries.map(async (entry) => {
    const registered = infolistActions.filter(action => Reflect.get(action, 'source') === `infolist:${String(Reflect.get(entry, 'path'))}`)
    const actionManifests = await Promise.all(registered.map(async (action) => {
      const compiled = action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, unknown>
      const scope = { actor: context.actor, mount: compiled.mount, record, services: context.services, signal: context.signal, tenant: context.tenant }
      const state = await resolveActionState(compiled, scope)
      return compileActionManifest(compiled, state.label, scope, state)
    }))
    return actionManifests.length > 0 ? { ...entry, actionManifests } : entry
  }))
  const body = {
    ...manifest.body,
    properties: jsonObject({
      ...properties,
      resource: { ...resource, actions, ...(form ? { form: { ...form, actions: resolvedFormActions, fields: resolvedFields } } : {}), ...(infolist ? { infolist: { ...infolist, entries: resolvedEntries } } : {}) },
    }),
  }
  return Object.freeze({ ...manifest, body })
}

function recordIdentifier(payload: JsonObject): number | string | null {
  const direct = payload.recordId ?? payload.record
  if (typeof direct === 'number' || typeof direct === 'string' && direct.length > 0) return direct
  const records = payload.recordIds
  const first = Array.isArray(records) ? records[0] : undefined
  return typeof first === 'number' || typeof first === 'string' && first.length > 0 ? first : null
}

function mutationValues(payload: JsonObject): Readonly<Record<string, JsonValue>> {
  const nested = payload.values
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested
  const reserved = new Set(['actionId', 'idempotencyKey', 'intent', 'mutation', 'record', 'recordId', 'recordIds', 'resourceId'])
  return Object.freeze(Object.fromEntries(Object.entries(payload).filter(([key]) => !reserved.has(key))))
}

async function validateRequiredValues(definition: RuntimeDefinition, values: Readonly<Record<string, JsonValue>>, creating: boolean): Promise<void> {
  const errors = await validateFormFields(resourceFormFields(definition).filter(field => creating || valueAtPath(values, field.path) !== undefined), values)
  if (Object.keys(errors).length) throw new ValidationException({ ...errors })
  for (const field of resourceSchemaFields(definition.form)) {
    const path = Reflect.get(field, 'path')
    if (typeof path !== 'string') continue
    const value = valueAtPath(values, path)
    if (typeof value === 'undefined') continue
    const source = objectMember(objectMember(field, 'server'), 'options')
    const choices = source && 'manifestOptions' in source && typeof source.manifestOptions === 'function'
      ? Reflect.apply(source.manifestOptions, source, [])
      : []
    if (Array.isArray(choices) && choices.length > 0 && !choices.some(option => option && typeof option === 'object' && Reflect.get(option, 'value') === value)) {
      throw new ValidationException({ [path]: ['The selected option is unavailable.'] })
    }
  }
}

function optionValues(value: JsonValue | undefined): readonly OptionValue[] {
  if (typeof value === 'number' || typeof value === 'string') return value === '' ? Object.freeze([]) : Object.freeze([value])
  if (!Array.isArray(value)) return Object.freeze([])
  return Object.freeze(value.filter((item): item is OptionValue => typeof item === 'number' || typeof item === 'string'))
}

function trustedTenantKey(context: GeneratedResourceOperationInput['context']): string {
  const bound = context.tenantBindings ? Object.values(context.tenantBindings)[0] : undefined
  const value = bound ?? context.tenant
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return 'shared'
}

function optionRequest(
  definition: RuntimeDefinition,
  fieldId: string,
  input: GeneratedResourceOperationInput,
): OptionQueryRequest {
  const dependencies = input.payload.dependencies && typeof input.payload.dependencies === 'object' && !Array.isArray(input.payload.dependencies)
    ? input.payload.dependencies
    : {}
  return Object.freeze({
    dependencies,
    fieldId,
    locale: typeof input.payload.locale === 'string' ? input.payload.locale : 'en',
    page: typeof input.payload.page === 'number' ? input.payload.page : 1,
    panelId: input.panelId,
    perPage: typeof input.payload.perPage === 'number' ? input.payload.perPage : 25,
    resourceId: definition.id,
    search: typeof input.payload.search === 'string' ? input.payload.search : '',
    selectedValues: optionValues(input.payload.selectedValues),
    tenantKey: trustedTenantKey(input.context),
  })
}

function fieldResolverContext(
  field: object,
  values: Readonly<Record<string, JsonValue>>,
  input: GeneratedResourceOperationInput,
): object {
  const path = String(Reflect.get(field, 'path'))
  return Object.freeze({
    actor: input.context.actor,
    get: (dependency: string): JsonValue | undefined => valueAtPath(values, dependency) as JsonValue | undefined,
    operation: input.payload.formOperation === 'edit' ? 'edit' : 'create',
    path,
    tenant: input.context.tenant,
    tenantBindings: input.context.tenantBindings,
    tenantCacheKey: trustedTenantKey(input.context),
    value: valueAtPath(values, path),
    values,
  })
}

function registeredOptionField(definition: RuntimeDefinition, fieldId: string): Readonly<{ field: object, source: OptionSource<OptionValue, object> }> {
  const field = resourceSchemaFields(definition.form).find(candidate => Reflect.get(candidate, 'path') === fieldId)
  const source = objectMember(objectMember(field, 'server'), 'options')
  if (!field || !source || typeof Reflect.get(source, 'list') !== 'function' || typeof Reflect.get(source, 'hydrateSelected') !== 'function') {
    throw new Error(`[Holo Panels] Option field "${fieldId}" is not registered.`)
  }
  return Object.freeze({ field, source: source as OptionSource<OptionValue, object> })
}

async function validateOptionValues(
  definition: RuntimeDefinition,
  values: Readonly<Record<string, JsonValue>>,
  input: GeneratedResourceOperationInput,
): Promise<void> {
  for (const field of resourceSchemaFields(definition.form)) {
    const path = Reflect.get(field, 'path')
    if (typeof path !== 'string' || typeof valueAtPath(values, path) === 'undefined') continue
    const source = objectMember(objectMember(field, 'server'), 'options')
    if (!source || typeof Reflect.get(source, 'hydrateSelected') !== 'function') continue
    const selectedValues = optionValues(valueAtPath(values, path) as JsonValue | undefined)
    if (selectedValues.length === 0) continue
    const service = new OptionService(source as OptionSource<OptionValue, object>)
    const request = optionRequest(definition, path, { ...input, payload: { ...input.payload, selectedValues: [...selectedValues] } })
    await service.validateSubmission(request, selectedValues, fieldResolverContext(field, values, input), input.context.signal)
  }
}

async function executeOptions(
  definition: RuntimeDefinition,
  input: GeneratedResourceOperationInput,
): Promise<JsonObject> {
  if (typeof input.payload.relationManagerId === 'string') {
    return executeRelationOptions(definition, input)
  }
  const fieldId = typeof input.payload.fieldId === 'string' ? input.payload.fieldId : ''
  if (input.payload.action === 'schema') {
    const executor = new ResourceExecutor(definition, { strictAuthorization: input.strictAuthorization })
    const identifier = recordIdentifier(input.payload)
    if (identifier === null) await executor.authorizeCreate(input.context)
    const record = identifier === null ? null : await executor.resolveUpdateRecord(identifier, input.context)
    const sourceValues = input.payload.values && typeof input.payload.values === 'object' && !Array.isArray(input.payload.values) ? input.payload.values : {}
    const resolved = await resolveFormDefinition(definition, sourceValues, input, record)
    const fields = await resolvedResourceFormFields(resolved.definition, input.context, record, identifier === null ? 'page' : 'record')
    const operationPaths = [...new Set([...(definition.writableAttributes ?? []), ...fields.map(field => field.path)])]
    return jsonObject({ fields, operationPaths, operations: resolved.operations, schema: resourceFormSchema(resolved.definition.form, `${definition.id}-${resolved.context.operation}-form`) })
  }
  const { field, source } = registeredOptionField(definition, fieldId)
  const service = new OptionService(source)
  const request = optionRequest(definition, fieldId, input)
  const values = input.payload.values && typeof input.payload.values === 'object' && !Array.isArray(input.payload.values) ? input.payload.values : {}
  const context = fieldResolverContext(field, values, input)
  const action = typeof input.payload.action === 'string' ? input.payload.action : 'list'
  if (action === 'hydrate') return jsonObject({ options: await service.hydrateSelected(request, optionValues(input.payload.selectedValues), context, input.context.signal) })
  if (action === 'validate') return jsonObject({ valid: (await service.validateSubmission(request, optionValues(input.payload.selectedValues), context, input.context.signal)).length === optionValues(input.payload.selectedValues).length })
  if (action === 'create' && typeof input.payload.label === 'string') return jsonObject({ option: await service.create(input.payload.label, request, context) })
  if (action === 'edit' && typeof input.payload.label === 'string' && (typeof input.payload.value === 'number' || typeof input.payload.value === 'string')) return jsonObject({ option: await service.edit(input.payload.value, input.payload.label, request, context) })
  if (action !== 'list') throw new Error('[Holo Panels] Option operation is not registered.')
  return jsonObject(await service.list(request, context, input.context.signal))
}

async function resolveFormDefinition(
  definition: RuntimeDefinition,
  values: Readonly<Record<string, JsonValue>>,
  input: GeneratedResourceOperationInput,
  record: RuntimeRecord | null = null,
): Promise<Readonly<{ context: Readonly<{ operation: string }>, definition: RuntimeDefinition, operations: readonly object[], values: Readonly<Record<string, JsonValue>> }>> {
  const mutable = structuredClone(values) as Record<string, JsonValue>
  const operations: object[] = []
  const context = {
    get: (path: string) => valueAtPath(mutable, path),
    operation: input.payload.formOperation === 'edit' || recordIdentifier(input.payload) !== null ? 'edit' : 'create',
    record,
    set: (path: string, value: JsonValue) => {
      setValueAtPath(mutable, path, value)
      operations.push({ kind: 'set', path, value })
    },
  }
  let form = await resolveResourceForm(definition.form, context)
  const lifecycle = input.payload.lifecycle
  const previousValues = input.payload.previousValues && typeof input.payload.previousValues === 'object' && !Array.isArray(input.payload.previousValues) ? input.payload.previousValues : {}
  if (lifecycle === 'hydrate' || lifecycle === 'update') {
    const processedPaths = new Set<string>()
    while (true) {
      const operationCount = operations.length
      for (const field of resourceSchemaFields(form)) {
        const path = Reflect.get(field, 'path')
        if (typeof path !== 'string' || processedPaths.has(path)) continue
        if (processedPaths.size >= 1_000) throw new Error('[Holo Panels] Form lifecycle resolution exceeded 1,000 fields.')
        processedPaths.add(path)
        const server = objectMember(field, 'server') ?? {}
        const callback = lifecycle === 'hydrate' ? Reflect.get(server, 'afterStateHydrated') : Reflect.get(server, 'afterStateUpdated')
        if (typeof callback !== 'function') continue
        const state = valueAtPath(mutable, path)
        const previous = valueAtPath(previousValues, path)
        if (lifecycle === 'update' && JSON.stringify(state) === JSON.stringify(previous)) continue
        await Reflect.apply(callback, field, lifecycle === 'hydrate' ? [state, context] : [state, previous, context])
      }
      if (operations.length === operationCount) break
      form = await resolveResourceForm(definition.form, context)
    }
  }
  return Object.freeze({ context, definition: { ...definition, ...(form ? { form } : {}) }, operations: Object.freeze(operations), values: Object.freeze(mutable) })
}

function relationOptionRequest(
  definition: RuntimeDefinition,
  managerId: string,
  input: GeneratedResourceOperationInput,
): OptionQueryRequest<number | string> {
  return Object.freeze({
    dependencies: {},
    fieldId: managerId,
    locale: typeof input.payload.locale === 'string' ? input.payload.locale : 'en',
    page: typeof input.payload.page === 'number' ? input.payload.page : 1,
    panelId: input.panelId,
    perPage: typeof input.payload.perPage === 'number' ? input.payload.perPage : 25,
    resourceId: definition.id,
    search: typeof input.payload.search === 'string' ? input.payload.search : '',
    tenantKey: String(input.context.tenant ?? ''),
  })
}

function relatedRecordLabel(record: RuntimeRecord, definition: ResourceModel<RuntimeRecord, RuntimeQuery>['definition']): string {
  const values = record.toJSON()
  for (const field of ['name', 'title', 'label', 'email', definition.primaryKey]) {
    const value = values[field]
    if (typeof value === 'number' || typeof value === 'string' && value.trim()) return String(value)
  }
  return String(values[definition.primaryKey] ?? '')
}

async function executeRelationOptions(
  definition: RuntimeDefinition,
  input: GeneratedResourceOperationInput,
): Promise<JsonObject> {
  const managerId = input.payload.relationManagerId as string
  const ownerId = relationIdentifier(input.payload, 'ownerId')
  const manager = relationManager(definition, managerId)
  const operations = allowedRelationOperations(manager.relation)
  if (!operations.includes('select') && !operations.includes('associate') && !operations.includes('attach')) {
    throw new Error('[Holo Panels] This relation does not allow record selection.')
  }
  const executor = new ResourceExecutor(definition, { strictAuthorization: input.strictAuthorization })
  await executor.authorizeUpdate(ownerId, input.context)
  const owner = await executor.resolveActionRecord(ownerId, input.context)
  if (!owner) throw new Error('[Holo Panels] The relation owner was not found.')
  const request = relationOptionRequest(definition, managerId, input)
  const context = { actor: input.context.actor, owner, signal: input.context.signal, strictAuthorization: input.strictAuthorization, tenant: input.context.tenant }
  if (manager.runtime) {
    const service = new RelationManagerExecutor(manager.runtime).optionService()
    return jsonObject(await service.list(request, context, input.context.signal))
  }
  if (request.page !== 1) return jsonObject({ hasMore: false, options: [], page: request.page, perPage: request.perPage, total: 0 })
  const model = relatedModel(manager.relation)
  let query = model.query()
  const bindings = tenantBindingsForModel(model, input.context)
  if (Object.keys(bindings).length > 0) {
    for (const [field, value] of Object.entries(bindings)) query = query.where(field, '=', value)
  } else if (input.context.scopeTenantQuery) query = input.context.scopeTenantQuery(query)
  const labelField = ['name', 'title', 'label', 'email'].find(field => field in (model.definition.table?.columns ?? {})) ?? model.definition.primaryKey
  if (request.search.trim()) query = query.whereLike(labelField, `%${request.search.trim()}%`)
  const candidates = await query.limit(Math.min(request.perPage, 50) + 1).get()
  const existing = await automaticRelationRecords(owner, manager.relationName, input.context)
  const existingIds = new Set(existing.map(record => String(relationRecord(record)[model.definition.primaryKey] ?? '')))
  const authorized: RuntimeRecord[] = []
  for (const candidate of candidates) {
    try {
      await authorizeHoloPolicy(input.context.actor, 'view', candidate, input.strictAuthorization)
      const identifier = candidate.toJSON()[model.definition.primaryKey]
      if (matchesTenantBindings(candidate, input.context) && !existingIds.has(String(identifier ?? ''))) authorized.push(candidate)
    } catch {
      continue
    }
  }
  const records = authorized.slice(0, Math.min(request.perPage, 50))
  return jsonObject({
    hasMore: authorized.length > records.length,
    options: records.map(record => ({ label: relatedRecordLabel(record, model.definition), value: record.toJSON()[model.definition.primaryKey] as number | string })),
    page: request.page,
    perPage: request.perPage,
  })
}

async function normalizeValues(
  definition: RuntimeDefinition,
  values: Readonly<Record<string, JsonValue>>,
  input: GeneratedResourceOperationInput,
  record: RuntimeRecord | null = null,
): Promise<Readonly<Record<string, JsonValue>>> {
  const normalized = structuredClone(values) as Record<string, JsonValue>
  const fields = resourceSchemaFields(definition.form)
  for (const field of fields) {
    const path = Reflect.get(field, 'path')
    const properties = resourceFieldProperties(field, fields)
    const value = typeof path === 'string' ? valueAtPath(normalized, path) : undefined
    if (typeof path === 'string' && Reflect.get(properties, 'specialization') === 'slug' && typeof value === 'string') {
      const source = Reflect.get(properties, 'source')
      const sourceValue = typeof source === 'string' ? valueAtPath(normalized, source) : undefined
      setValueAtPath(normalized, path, defaultSlugTransform(value || (typeof sourceValue === 'string' ? sourceValue : '')))
    }
    const dehydrate = Reflect.get(objectMember(field, 'server') ?? {}, 'dehydrateStateUsing')
    if (typeof path === 'string' && typeof dehydrate === 'function') {
      const context = {
        get: (dependency: string) => valueAtPath(normalized, dependency),
        operation: input.payload.formOperation === 'edit' || recordIdentifier(input.payload) !== null ? 'edit' : 'create',
        record,
        set: (dependency: string, next: JsonValue) => setValueAtPath(normalized, dependency, next),
      }
      setValueAtPath(normalized, path, await Reflect.apply(dehydrate, field, [value, context]) as JsonValue)
    }
  }
  return Object.freeze(normalized)
}

async function tableQueryState(
  definition: RuntimeDefinition,
  input: GeneratedResourceOperationInput,
): Promise<TableQueryState> {
  const payload = input.payload
  const filtersValue = payload.filters && typeof payload.filters === 'object' && !Array.isArray(payload.filters) ? payload.filters : {}
  const filters: TableQueryFilter[] = []
  for (const [id, value] of Object.entries(filtersValue)) {
    if (value === '' || typeof value === 'undefined') continue
    const compiled = arrayMember(definition.table, 'serverFilters').find(candidate => Reflect.get(objectMember(candidate, 'manifest') ?? {}, 'id') === id)
    const encode = Reflect.get(objectMember(compiled, 'server') ?? {}, 'encode')
    if (compiled && typeof encode === 'function') {
      const encoded = await Reflect.apply(encode, objectMember(compiled, 'server'), [value, { context: input.context, signal: input.context.signal }]) as TableQueryFilter | readonly TableQueryFilter[] | null
      if (encoded) filters.push(...(Array.isArray(encoded) ? encoded : [encoded]))
      continue
    }
    const column = arrayMember(definition.table, 'columns').find(candidate => Reflect.get(candidate, 'path') === id)
    if (!column || value !== null && typeof value !== 'boolean' && typeof value !== 'number' && typeof value !== 'string') {
      throw new Error(`[Holo Panels] Table filter "${id}" is not registered.`)
    }
    filters.push({ id, operator: '=', value: value as TableQueryScalar })
  }
  const sort: TableQuerySort[] = Array.isArray(payload.sort) ? payload.sort.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('[Holo Panels] Table sort is invalid.')
    const column = Reflect.get(item, 'column')
    const direction = Reflect.get(item, 'direction')
    if (typeof column !== 'string' || (direction !== 'asc' && direction !== 'desc')) throw new Error('[Holo Panels] Table sort is invalid.')
    return { column, direction }
  }) : []
  return Object.freeze({
    filters: Object.freeze(filters),
    includeTotal: true,
    page: typeof payload.page === 'number' ? payload.page : 1,
    pagination: 'page',
    perPage: typeof payload.perPage === 'number' ? payload.perPage : 25,
    search: typeof payload.search === 'string' ? payload.search : '',
    sort: Object.freeze(sort),
  })
}

function configuredAction(
  definition: RuntimeDefinition,
  actionId: string,
  mount: ActionMount | null,
  source: string | null,
): ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined> {
  const candidates = (definition.actions ?? []).flatMap(candidate => {
    const registered = candidate as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>
    const action = findRegisteredAction(registered, actionId)
    return action ? [{ ...action, source: Reflect.get(candidate, 'source') }] : []
  })
  const sourcedCandidates = source ? candidates.filter(candidate => Reflect.get(candidate, 'source') === source) : candidates
  const mountedCandidates = mount ? sourcedCandidates.filter(candidate => candidate.mount === mount) : sourcedCandidates
  const action = mountedCandidates.length === 1 ? mountedCandidates[0] : undefined
  if (!action || typeof Reflect.get(action, 'authorize') !== 'function' || typeof Reflect.get(action, 'handle') !== 'function') {
    throw new Error('[Holo Panels] The generated resource action is not registered.')
  }
  return action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>
}

function executableResourceAction(
  action: ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>,
  definition: RuntimeDefinition,
  executor: ResourceExecutor<RuntimeDefinition['model'], RuntimeRecord, RuntimeQuery, Readonly<Record<string, unknown>>, object, unknown, boolean>,
  input: GeneratedResourceOperationInput,
): ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined> {
  if (action.usesDefaultHandler === false || action.kind === 'custom') return action
  if (Reflect.get(action, 'formIntent') === 'cancel') return action
  if (String(Reflect.get(action, 'source')).endsWith(':form')) return {
    ...action,
    handle: async (submitted: JsonObject, context: Parameters<typeof action.handle>[1]) => {
      const identifier = recordIdentifier(input.payload)
      const resolved = await resolveFormDefinition(definition, submitted, input, context.record)
      const values = await normalizeValues(resolved.definition, resolved.values, input, context.record)
      await validateRequiredValues(resolved.definition, values, identifier === null)
      await validateOptionValues(resolved.definition, values, input)
      const finalized = await finalizedUploadValues(resolved.definition, values, input, context.record)
      const result = identifier === null ? await executor.create(finalized, input.context) : await executor.update(identifier, finalized, input.context)
      return jsonObject({ record: serializeResourceRecord(result.record), resourceId: definition.id })
    },
  }
  if (!['create', 'delete', 'edit', 'force-delete', 'replicate', 'restore'].includes(action.kind)) return action
  return Object.freeze({
    ...action,
    handle: async (submitted: JsonObject, context: Parameters<typeof action.handle>[1]) => {
      const resolved = await resolveFormDefinition(definition, submitted, input, context.record)
      const values = await normalizeValues(resolved.definition, resolved.values, input, context.record)
      if (action.kind === 'create' || action.kind === 'edit') {
        await validateRequiredValues(resolved.definition, values, action.kind === 'create')
        await validateOptionValues(resolved.definition, values, input)
      }
      if (action.kind === 'create') {
        await executor.create(await finalizedUploadValues(resolved.definition, values, input), input.context)
        return
      }
      if (!context.record) throw new Error('[Holo Panels] Built-in resource actions require a resolved record.')
      const identifier = valueAtPath(context.record.toJSON(), definition.routeKey)
      if (typeof identifier !== 'number' && typeof identifier !== 'string') throw new Error('[Holo Panels] Built-in resource actions require a stable record identifier.')
      if (action.kind === 'delete') await executor.delete(identifier, input.context)
      else if (action.kind === 'edit') await executor.update(identifier, await finalizedUploadValues(resolved.definition, values, input, context.record), input.context)
      else if (action.kind === 'force-delete') await executor.forceDelete(identifier, input.context)
      else if (action.kind === 'restore') await executor.restore(identifier, input.context)
      else if (action.kind === 'replicate') {
        const serialized = context.record.toJSON()
        const replicated = Object.fromEntries(definition.writableAttributes.flatMap(attribute => {
          const value = valueAtPath(serialized, attribute)
          return typeof value === 'undefined' ? [] : [[attribute, value]]
        }))
        await executor.create(replicated, input.context)
      }
    },
  })
}

function actionRecordIds(payload: JsonObject): readonly (number | string)[] {
  if (Array.isArray(payload.recordIds)) {
    if (payload.recordIds.some(value => typeof value !== 'number' && typeof value !== 'string' || typeof value === 'number' && !Number.isFinite(value) || typeof value === 'string' && !value.trim())) throw new Error('Action record IDs must be canonical identifiers')
    return Object.freeze(payload.recordIds as (number | string)[])
  }
  const identifier = recordIdentifier(payload)
  return identifier === null ? Object.freeze([]) : Object.freeze([identifier])
}

function actionInput(payload: JsonObject): JsonObject {
  const value = payload.input
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function recordVersion(record: RuntimeRecord): string | null {
  const values = record.toJSON()
  for (const key of ['version', 'updatedAt', 'updated_at']) {
    const value = values[key]
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'number' || typeof value === 'string') return String(value)
  }
  return null
}

async function executeCustomAction(
  definition: RuntimeDefinition,
  executor: ResourceExecutor<RuntimeDefinition['model'], RuntimeRecord, RuntimeQuery, Readonly<Record<string, unknown>>, object, unknown, boolean>,
  input: GeneratedResourceOperationInput,
  actionId: string,
): Promise<GeneratedResourceOperationResult> {
  const requestedMount = input.payload.mount
  if (!['bulk', 'modal', 'notification', 'page', 'record'].includes(String(requestedMount))) {
    throw new Error('[Holo Panels] Registered action requests require an allow-listed mount.')
  }
  const requestedSource = typeof input.payload.source === 'string' && input.payload.source ? input.payload.source : null
  const registered = configuredAction(definition, actionId, requestedMount as ActionMount, requestedSource)
  const source = typeof Reflect.get(registered, 'source') === 'string' ? String(Reflect.get(registered, 'source')) : null
  const selectionSettings = objectMember(definition.table, 'selection') ?? {}
  const maximum = typeof Reflect.get(selectionSettings, 'maximum') === 'number' ? Number(Reflect.get(selectionSettings, 'maximum')) : 10_000
  if (registered.mount === 'bulk' && actionRecordIds(input.payload).length > maximum) throw new Error('The table selection limit was exceeded')
  const selection = input.payload.selection
  if (selection !== undefined && (!selection || typeof selection !== 'object' || Array.isArray(selection))) throw new Error('The table action selection is invalid')
  if (selection && typeof selection === 'object' && !Array.isArray(selection)) {
    if (registered.mount !== 'bulk' || source !== 'table' || selection.mode !== 'all-matching' || !Array.isArray(selection.excludedRecordIds) || !selection.query || typeof selection.query !== 'object' || Array.isArray(selection.query)) throw new Error('The table action selection is invalid')
    const excluded = actionRecordIds({ recordIds: selection.excludedRecordIds })
    if (Reflect.get(selectionSettings, 'currentPageOnly') === true || Reflect.get(selectionSettings, 'groupsOnly') === true) throw new Error('All-matching selection is disabled for this table')
    if (selection.query.panelId !== undefined && selection.query.panelId !== input.panelId || selection.query.tableId !== undefined && selection.query.tableId !== definition.id) throw new Error('The selection belongs to another table')
    const state = await tableQueryState(definition, { ...input, payload: selection.query })
    const identifiers = await executor.selectTableRecords(state, excluded, input.context)
    const included = selection.recordIds === undefined ? [] : actionRecordIds({ recordIds: selection.recordIds })
    input = { ...input, payload: { ...input.payload, recordIds: [...new Set([...identifiers, ...included])] } }
  }
  if (registered.mount === 'bulk' && source === 'table') {
    const ids = actionRecordIds(input.payload)
    if (ids.length > maximum) throw new Error('The table selection limit was exceeded')
    if (Reflect.get(selectionSettings, 'currentPageOnly') === true) {
      const query = input.payload.tableQuery
      if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('Current-page selection requires its table query')
      const page = await executor.table(await tableQueryState(definition, { ...input, payload: query }), input.context)
      const allowedIds = new Set(page.records.map(record => String(valueAtPath(record, definition.routeKey))))
      if (ids.some(id => !allowedIds.has(String(id)))) throw new Error('Selected records must belong to the current page')
    }
    if (Reflect.get(selectionSettings, 'groupsOnly') === true) {
      const group = arrayMember(definition.table, 'serverGroups')[0]
      const path = Reflect.get(objectMember(group, 'manifest') ?? {}, 'path')
      if (typeof path !== 'string') throw new Error('Group-only selection requires a registered group')
      const keys = new Set<string>()
      for (const id of ids) {
        const record = await executor.resolveActionRecord(id, input.context)
        if (!record) throw new Error('A selected record is not available')
        const value = valueAtPath(record.toJSON(), path)
        if (value === undefined) throw new Error('The selected record group is not available')
        keys.add(JSON.stringify(value))
        if (keys.size > 1) throw new Error('Selected records must belong to the same group')
      }
    }
  }
  const panelPath = input.panel?.manifest.path ?? `/${input.panelId}`
  const route = registered.mount !== 'bulk' && !registered.modal?.schema && !source?.endsWith(':form') && ['create', 'edit', 'view'].includes(registered.kind)
    ? resourceRoutes(definition, `${panelPath === '/' ? '' : panelPath}/${resourceSlug(definition)}`)[registered.kind]
    : null
  const action = registered.url || typeof route === 'string' ? {
    ...registered,
    url: registered.url ?? (() => typeof route === 'string' ? route.replace(':record', encodeURIComponent(String(actionRecordIds(input.payload)[0] ?? ''))) : null),
    handle: async (values: JsonObject, context: Parameters<typeof registered.handle>[1]) => {
      if (registered.kind === 'create') await executor.authorizeCreate(input.context)
      if (registered.kind === 'edit') {
        const identifier = actionRecordIds(input.payload)[0]
        if (identifier === undefined) throw new Error('Edit navigation requires a record')
        await executor.authorizeUpdate(identifier, input.context)
      }
      return registered.handle(values, context)
    },
  } : executableResourceAction(registered, definition, executor, input)
  if (input.panel) await authorizePanelActionPermissions(input.panel, { ...input.context, panelId: input.panelId }, [`${definition.id}.${action.mount === 'page' ? 'viewAny' : 'view'}`, ...actionExecutionPermissions(action), ...resourceActionPermissions(definition.id, action)])
  if (action.mount === 'page') await executor.authorizeViewAny(input.context)
  const engine = new ActionEngine<RuntimeRecord, number | string, object, unknown, undefined>({
    identity: scope => {
      const actor = actionCacheIdentity(scope.actor)
      const tenant = actionCacheIdentity(scope.tenant)
      return actor === null || tenant === null ? null : { actor, tenant }
    },
    records: {
      resolve: (id, scope) => executor.resolveActionRecord(id, { ...input.context, ...scope }),
      resolveMany: (ids, scope) => executor.resolveActionRecords(ids, { ...input.context, ...scope }),
      version: recordVersion,
    },
    transaction: { run: operation => executor.runInTransaction(operation) },
  }, resourceActionState(definition.model, JSON.stringify([input.panelId, input.panel?.guard, input.context.tenantBindings, definition.id, source, action.mount])))
  const expectedVersions = input.payload.expectedVersions && typeof input.payload.expectedVersions === 'object' && !Array.isArray(input.payload.expectedVersions)
    ? Object.fromEntries(Object.entries(input.payload.expectedVersions).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : undefined
  const result = await engine.execute(action, {
    ...(expectedVersions ? { expectedVersions } : {}),
    idempotencyKey: typeof input.payload.idempotencyKey === 'string' && input.payload.idempotencyKey
      ? input.payload.idempotencyKey
      : globalThis.crypto.randomUUID(),
    input: actionInput(input.payload),
    mount: action.mount,
    recordIds: actionRecordIds(input.payload),
  }, {
    actor: input.context.actor,
    services: undefined,
    signal: input.context.signal,
    tenant: input.context.tenant,
  })
  const effects = result.effects
  const formResult = source?.endsWith(':form') ? result.result ?? result.items[0]?.result : null
  const serialized = toJsonValue({ ...result, ...(source?.endsWith(':form') ? { formIntent: Reflect.get(registered, 'formIntent') ?? 'submit' } : {}), ...(formResult && typeof formResult === 'object' && !Array.isArray(formResult) ? formResult : {}), effects })
  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('[Holo Panels] Action results must be JSON-safe objects.')
  return Object.freeze({ data: serialized, effects })
}

async function executeRelationOperation(
  definition: RuntimeDefinition,
  executor: ResourceExecutor<RuntimeDefinition['model'], RuntimeRecord, RuntimeQuery, Readonly<Record<string, unknown>>, object, unknown, boolean>,
  input: GeneratedResourceOperationInput,
): Promise<GeneratedResourceOperationResult> {
  const managerId = typeof input.payload.managerId === 'string' ? input.payload.managerId : ''
  const manager = relationManager(definition, managerId)
  const ownerId = relationIdentifier(input.payload, 'ownerId')
  await executor.authorizeUpdate(ownerId, input.context)
  const owner = await executor.resolveActionRecord(ownerId, input.context)
  if (!owner) throw new Error('[Holo Panels] The relation owner was not found.')
  if (manager.runtime && !await manager.runtime.visible({ ...input.context, owner })) throw new Error('The relation manager is not available')
  const requestedId = typeof input.payload.actionId === 'string' ? input.payload.actionId : null
  const candidates = relationActions(manager.compiled, manager.relation).flatMap(action => requestedId ? findRegisteredAction(action, requestedId) ?? [] : action.kind === input.payload.relationOperation ? [action] : [])
  const action = candidates.length === 1 ? candidates[0] : undefined
  if (!action) throw new Error('[Holo Panels] The relation operation is not registered for this relation manager.')
  if (input.payload.mount !== undefined && input.payload.mount !== action.mount) throw new Error('The relation action mount does not match its registration')
  if (input.panel) await authorizePanelActionPermissions(input.panel, { ...input.context, panelId: input.panelId }, actionExecutionPermissions(action))
  const recordIds = action.mount === 'page' ? [] : Array.isArray(input.payload.relatedIds) ? actionRecordIds({ recordIds: input.payload.relatedIds }) : [relationIdentifier(input.payload, 'relatedId')]
  const engine = new ActionEngine<RuntimeRecord, number | string, object, unknown, undefined>({
    identity: scope => {
      const actor = actionCacheIdentity(scope.actor)
      const tenant = actionCacheIdentity(scope.tenant)
      return actor === null || tenant === null ? null : { actor, tenant }
    },
    records: { resolve: async id => manager.runtime
      ? await new RelationManagerExecutor(manager.runtime).resolveActionRecord(id, action.kind === 'custom' ? 'view' : relationOperation(action.kind), { ...input.context, owner }) as RuntimeRecord
      : ownedRelatedRecord(owner, manager.relationName, manager.relation, id, input.context), version: record => {
        const values = relationRecord(record)
        const version = values.version ?? values.updatedAt ?? values.updated_at
        return typeof version === 'number' || typeof version === 'string' ? String(version) : null
      } },
    transaction: { run: operation => executor.runInTransaction(operation) },
  }, resourceActionState(definition.model, JSON.stringify([input.panelId, input.panel?.guard, input.context.tenantBindings, definition.id, managerId, ownerId, action.mount])))
  const executable = action.usesDefaultHandler === false || action.kind === 'custom' ? action : {
    ...action,
    handle: async (values: JsonObject, context: Parameters<typeof action.handle>[1]) => {
      if (action.kind === 'view') return context.record ? relationRecord(context.record) : null
      const related = relatedDefinition(manager.relation)
      const primaryKey = related && typeof Reflect.get(related, 'primaryKey') === 'string' ? String(Reflect.get(related, 'primaryKey')) : 'id'
      const relatedId = context.record ? relationRecord(context.record)[primaryKey] : input.payload.relatedId
      const result = await performRelationOperation(definition, executor, { ...input, payload: {
        ...input.payload,
        ...(values.values === undefined ? {} : { values: values.values }),
        ...(values.pivot === undefined ? {} : { pivot: values.pivot }),
        ...(relatedId === undefined ? values.relatedId === undefined ? {} : { relatedId: values.relatedId } : { relatedId }),
        relationOperation: action.kind,
      } }).catch((cause: unknown) => {
        if (cause instanceof RelationRecordNotFoundError) throw new ActionExecutionError('record-not-found', 'The requested related record was not found.')
        throw cause
      })
      return result.data
    },
  }
  const result = await engine.execute(executable, {
    idempotencyKey: typeof input.payload.idempotencyKey === 'string' ? input.payload.idempotencyKey : crypto.randomUUID(),
    input: actionInput(input.payload),
    mount: action.mount,
    recordIds,
  }, { ...input.context, owner, services: undefined })
  const refreshed = await executor.resolveActionRecord(ownerId, input.context)
  if (!refreshed) throw new Error('The relation owner is no longer available')
  return { data: jsonObject({ ...result, relations: await resourceRelations(definition, refreshed, input.context, true) }), effects: result.effects }
}

async function performRelationOperation(
  definition: RuntimeDefinition,
  executor: ResourceExecutor<RuntimeDefinition['model'], RuntimeRecord, RuntimeQuery, Readonly<Record<string, unknown>>, object, unknown, boolean>,
  input: GeneratedResourceOperationInput,
): Promise<GeneratedResourceOperationResult> {
  const managerId = typeof input.payload.managerId === 'string' ? input.payload.managerId : ''
  const operation = relationOperation(input.payload.relationOperation)
  const ownerId = relationIdentifier(input.payload, 'ownerId')
  const manager = relationManager(definition, managerId)
  if (!manager.operations.includes(operation)) throw new Error('[Holo Panels] The relation operation is not registered for this relation manager.')
  await executor.authorizeUpdate(ownerId, input.context)
  const owner = await executor.resolveActionRecord(ownerId, input.context)
  if (!owner) throw new Error('[Holo Panels] The relation owner was not found.')
  const context = { actor: input.context.actor, owner, signal: input.context.signal, tenant: input.context.tenant }
  const relatedId = operation === 'create' || operation === 'dissociate' && typeof input.payload.relatedId === 'undefined'
    ? null
    : relationIdentifier(input.payload, 'relatedId')
  const values = relationInput(input.payload, 'values', manager.runtime?.writableInputFields ?? relationWritableFields(manager.relation))
  const automaticPivot = automaticPivotFields(manager.relation, input.context)
  const pivotFields = manager.runtime?.writablePivotFields ?? automaticPivot.writable
  const pivot = relationInput(input.payload, 'pivot', pivotFields)
  const fields = operation === 'create' || operation === 'edit'
    ? relationFields(manager.relation, manager.runtime?.writableInputFields ?? relationWritableFields(manager.relation))
    : operation === 'attach' || operation === 'editPivot' ? relationPivotFields(manager.relation, pivotFields) : []
  const fieldValues = operation === 'create' || operation === 'edit' ? values : pivot
  const prefix = operation === 'create' || operation === 'edit' ? 'values' : 'pivot'
  const errors = await validateFormFields(fields.flatMap(field => typeof field.id === 'string' && typeof field.type === 'string' && (operation === 'create' || fieldValues[field.id] !== undefined)
    ? [{ path: field.id, required: field.required === true, type: field.type, properties: field.type === 'number' ? { inputMode: 'number' } : {} }]
    : []), fieldValues)
  if (Object.keys(errors).length) throw new ValidationException(Object.fromEntries(Object.entries(errors).map(([path, messages]) => [`${prefix}.${path}`, messages])))
  let record: RuntimeRecord | null = null
  if (manager.runtime) {
    const relationExecutor = new RelationManagerExecutor(manager.runtime)
    if (operation === 'create') record = await relationExecutor.create(values, context) as RuntimeRecord
    else if (operation === 'edit') record = await relationExecutor.edit(relatedId!, values, context) as RuntimeRecord
    else if (operation === 'delete') await relationExecutor.delete(relatedId!, context)
    else if (operation === 'associate') await relationExecutor.associate(relatedId!, context)
    else if (operation === 'dissociate') await relationExecutor.dissociate(relatedId ?? undefined, context)
    else if (operation === 'attach') await relationExecutor.attach(relatedId!, pivot, context)
    else if (operation === 'detach') await relationExecutor.detach(relatedId!, context)
    else if (operation === 'editPivot') await relationExecutor.editPivot(relatedId!, pivot, context)
    else throw new Error('[Holo Panels] This relation operation is read-only.')
  } else if (operation === 'create') {
    const model = relatedModel(manager.relation)
    await authorizeHoloPolicy(input.context.actor, 'create', model, input.strictAuthorization)
    const created = await invokeRecord<RuntimeRecord>(model, 'make', [values])
    await invokeRecord(created, 'forceFill', [tenantBindingsForModel(model, input.context)])
    await model.unguarded(async () => {
      if (['belongsToMany', 'morphToMany', 'morphedByMany'].includes(String(Reflect.get(manager.relation, 'kind')))) {
        await invokeRecord(created, 'save', [])
        const relatedId = created.toJSON()[model.definition.primaryKey]
        if (typeof relatedId !== 'number' && typeof relatedId !== 'string') throw new Error('[Holo Panels] Created related records require a stable identifier.')
        await invokeRecord(owner, 'attach', [manager.relationName, relatedId, automaticPivot.bindings])
      } else {
        await invokeRecord(owner, 'saveRelated', [manager.relationName, created])
      }
    })
    await authorizeHoloPolicy(input.context.actor, 'view', created, input.strictAuthorization)
    record = created
  } else if (operation === 'attach') {
    const related = await relatedCandidate(manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'view', related, input.strictAuthorization)
    await invokeRecord(owner, 'attach', [manager.relationName, relatedId, { ...automaticPivot.bindings, ...pivot }])
  } else if (operation === 'detach') {
    const related = await ownedRelatedRecord(owner, manager.relationName, manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'update', related, input.strictAuthorization)
    await invokeRecord(owner, 'detach', [manager.relationName, relatedId])
  } else if (operation === 'associate') {
    const related = await relatedCandidate(manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'update', related, input.strictAuthorization)
    record = await invokeRecord(owner, 'saveRelated', [manager.relationName, related])
  } else if (operation === 'dissociate') {
    if (relatedId === null) throw new Error('[Holo Panels] Automatic relation dissociation requires a related record.')
    const related = await ownedRelatedRecord(owner, manager.relationName, manager.relation, relatedId, input.context)
    await authorizeHoloPolicy(input.context.actor, 'update', related, input.strictAuthorization)
    const foreignKey = 'foreignKey' in manager.relation ? manager.relation.foreignKey : null
    if (!foreignKey) throw new Error('[Holo Panels] This relation does not support automatic dissociation.')
    record = await invokeRecord(related, 'update', [{ [foreignKey]: null }])
  } else if (operation === 'edit') {
    const related = await ownedRelatedRecord(owner, manager.relationName, manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'update', related, input.strictAuthorization)
    record = await invokeRecord(related, 'update', [values])
  } else if (operation === 'delete') {
    const related = await ownedRelatedRecord(owner, manager.relationName, manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'delete', related, input.strictAuthorization)
    await invokeRecord(related, 'delete', [])
  } else if (operation === 'editPivot') {
    const related = await ownedRelatedRecord(owner, manager.relationName, manager.relation, relatedId!, input.context)
    await authorizeHoloPolicy(input.context.actor, 'update', related, input.strictAuthorization)
    await invokeRecord(owner, 'updateExistingPivot', [manager.relationName, relatedId, pivot])
  } else {
    throw new Error('[Holo Panels] This relation operation is read-only.')
  }
  return Object.freeze({
    data: jsonObject({ managerId, operation, ownerId, ...(record ? { record: relationRecord(record) } : {}), relatedId }),
    effects: [],
  })
}

async function tablePresentation(
  definition: RuntimeDefinition,
  records: readonly Readonly<Record<string, unknown>>[],
  context: GeneratedResourceOperationInput['context'],
): Promise<Readonly<{ readonly groups: readonly JsonObject[], readonly summaries: readonly JsonObject[] }>> {
  type SerializedRecord = Readonly<Record<string, unknown>>
  const summaryDefinitions = arrayMember(definition.table, 'serverSummaries') as readonly CompiledSummaryDefinition<SerializedRecord, string | null, GeneratedResourceOperationInput['context']>[]
  const executable = summaryDefinitions.map(asExecutableSummary)
  const results = await executePageSummaries(executable, records, context)
  const summaries = results.map((result) => {
    const definitionValue = summaryDefinitions.find(candidate => candidate.manifest.id === result.id)
    return jsonObject({ id: result.id, label: definitionValue?.manifest.label ?? label(result.id), value: result.value })
  })
  const groupDefinition = arrayMember(definition.table, 'serverGroups')[0] as CompiledGroupDefinition<SerializedRecord, string, GeneratedResourceOperationInput['context']> | undefined
  if (!groupDefinition) return Object.freeze({ groups: Object.freeze([]), summaries: Object.freeze(summaries) })
  const grouped = await groupPageRecords(records, groupDefinition, context)
  const groups = await Promise.all(grouped.map(async (group) => {
    const groupResults = await executePageSummaries(executable, group.records, context)
    return jsonObject({
      collapsed: group.collapsed,
      collapsible: groupDefinition.manifest.collapsible,
      description: group.description,
      key: group.key,
      records: group.records.map(record => jsonObject(record)),
      summaries: groupResults.map(result => ({ id: result.id, label: summaryDefinitions.find(candidate => candidate.manifest.id === result.id)?.manifest.label ?? label(result.id), value: result.value })),
      title: group.title,
    })
  }))
  return Object.freeze({ groups: Object.freeze(groups), summaries: Object.freeze(summaries) })
}

export async function executeGeneratedGlobalSearch(input: GeneratedGlobalSearchInput): Promise<JsonObject> {
  const term = input.term.trim().replace(/\s+/gu, ' ')
  if (term.length < 2 || term.length > 200) throw new Error('[Holo Panels] Global search terms must contain 2 to 200 characters.')
  const results: JsonObject[] = []
  for (const resource of input.resources) {
    if (results.length >= 50) break
    if (input.signal.aborted) throw input.signal.reason
    const definition = resourceDefinition(resource)
    const search = definition.globalSearch ?? (input.resourceOptIn ? undefined : {
      attributes: [definition.recordTitle],
      title: definition.recordTitle,
    })
    if (!search || search.attributes.length === 0) continue
    try {
      await authorizeHoloPolicy(input.actor, 'viewAny', definition.model, input.strictAuthorization)
    } catch (error) {
      if (input.strictAuthorization && isHoloPolicyMissingError(error)) throw error
      continue
    }
    const context = {
      actor: input.actor,
      signal: input.signal,
      tenant: input.tenant,
      ...(input.scopeTenantQuery ? { scopeTenantQuery: input.scopeTenantQuery } : {}),
      ...(input.tenantBindings ? { tenantBindings: input.tenantBindings } : {}),
    }
    let query = definition.baseQuery(definition.model.query(), context)
    if (!definition.shared) {
      if (definition.tenantScope) query = definition.tenantScope(query, context)
      else if (input.scopeTenantQuery) query = input.scopeTenantQuery(query)
      else throw new Error(`Resource "${definition.id}" requires an authenticated tenant scope.`)
    }
    const paths = [search.title, definition.routeKey, ...search.attributes, ...(search.details ?? [])]
    const relations = relationPaths(paths)
    let runtimeQuery = query as RuntimeQuery
    runtimeQuery = applySearch(runtimeQuery, search.attributes, `%${term}%`)
    if (relations.length > 0) runtimeQuery = runtimeQuery.with(relations)
    const limit = Math.min(search.limit ?? 10, 10, 50 - results.length)
    const records = await runtimeQuery.limit(limit).get()
    if (records.length > limit) throw new Error(`[Holo Panels] Global search resource "${definition.id}" exceeded its result limit.`)
    for (const record of records) {
      try {
        await authorizeHoloPolicy(input.actor, 'view', record, input.strictAuthorization)
      } catch (error) {
        if (input.strictAuthorization && isHoloPolicyMissingError(error)) throw error
        continue
      }
      const serialized = record.toJSON()
      const identifier = displayValue(valueAtPath(serialized, definition.routeKey))
      if (!identifier) continue
      const details = Object.fromEntries((search.details ?? []).map(path => [label(path), displayValue(valueAtPath(serialized, path))]))
      results.push({
        actions: [],
        details,
        icon: typeof definition.navigation.icon === 'string' ? definition.navigation.icon : null,
        id: identifier,
        image: null,
        resourceId: definition.id,
        title: displayValue(valueAtPath(serialized, search.title)),
        url: `${input.panelPath === '/' ? '' : input.panelPath}/${encodeURIComponent(resourceSlug(definition))}/${encodeURIComponent(identifier)}`,
      })
    }
  }
  return jsonObject({ panelId: input.panelId, results, term })
}

export async function resolveGeneratedResourceWidget(resource: object, widgetId: string, context: GeneratedResourceOperationInput['context'], strictAuthorization: boolean): Promise<object | null> {
  const definition = resourceDefinition(resource)
  await new ResourceExecutor(definition, { strictAuthorization }).authorizeViewAny(context)
  const matches = compositionArrayMember(definition, 'widgets').map((widget): object => 'compile' in widget && typeof widget.compile === 'function' ? widget.compile() : widget)
    .filter(widget => Reflect.get(widget, 'kind') === 'widget' && Reflect.get(Reflect.get(widget, 'manifest'), 'id') === widgetId)
  if (matches.length > 1) throw new Error('Resource widget IDs must be unique')
  return matches[0] ?? null
}

export async function authorizeGeneratedResourceNotification(resource: object, context: GeneratedResourceOperationInput['context'], strictAuthorization: boolean): Promise<void> {
  await new ResourceExecutor(resourceDefinition(resource), { strictAuthorization }).authorizeViewAny(context)
}

export async function executeGeneratedResourceOperation(
  resource: object,
  input: GeneratedResourceOperationInput,
): Promise<GeneratedResourceOperationResult> {
  const definition = resourceDefinition(resource)
  if (input.payload.resourceId !== definition.id) throw new Error('[Holo Panels] Resource operation does not match its registered resource.')
  const executor = new ResourceExecutor(definition, { strictAuthorization: input.strictAuthorization })
  const identifier = recordIdentifier(input.payload)
  const intent = typeof input.payload.intent === 'string'
    ? input.payload.intent
    : typeof input.payload.mutation === 'string' ? input.payload.mutation : ''
  const actionId = typeof input.payload.actionId === 'string' ? input.payload.actionId : ''
  if (input.operation === 'form-submit') {
    const source = `${identifier === null ? 'create' : 'edit'}:form`
    const actions = resourceFormActions(definition, identifier === null ? 'create' : 'edit')
    const requestedId = actionId || (explicitResourcePages(definition).length === 0 ? identifier === null ? 'create' : 'edit' : '')
    const registered = actions.find(action => findRegisteredAction(action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>, requestedId))
    if (!registered) throw new Error('[Holo Panels] The form action is not registered.')
    const registrations = actions as NonNullable<RuntimeDefinition['actions']>
    return executeCustomAction({ ...definition, actions: [...(definition.actions ?? []).filter(action => Reflect.get(action, 'source') !== source), ...registrations] }, executor, { ...input, payload: { ...input.payload, input: jsonObject(mutationValues(input.payload)), mount: identifier === null ? 'page' : 'record', source } }, requestedId)
  }
  if (input.operation === 'action' && intent === 'relation') {
    return executeRelationOperation(definition, executor, input)
  }
  const actionSource = typeof input.payload.source === 'string' ? input.payload.source : ''
  if (input.operation === 'action' && actionSource.startsWith('form-field:')) {
    const fieldPath = actionSource.slice('form-field:'.length)
    const actionMount = input.payload.mount === 'page' ? 'page' : input.payload.mount === 'record' ? 'record' : null
    if (!fieldPath || !actionMount) throw new Error('[Holo Panels] The form field action request is invalid.')
    const record = identifier === null ? null : await executor.resolveUpdateRecord(identifier, input.context)
    if (identifier === null) await executor.authorizeCreate(input.context)
    const submitted = actionInput(input.payload)
    const resolved = await resolveFormDefinition(definition, submitted, { ...input, payload: { ...input.payload, formOperation: identifier === null ? 'create' : 'edit' } }, record)
    const field = resourceSchemaFields(resolved.definition.form).find(candidate => Reflect.get(candidate, 'path') === fieldPath)
    const registrations: NonNullable<RuntimeDefinition['actions']> = arrayMember(objectMember(field, 'server'), 'actions').map((action) => {
      const registered = action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>
      return Object.freeze({ ...registered, mount: actionMount, source: actionSource })
    })
    if (!registrations.some(action => findRegisteredAction(action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>, actionId))) {
      throw new Error('[Holo Panels] The form field action is not registered.')
    }
    return executeCustomAction({ ...resolved.definition, actions: [...(resolved.definition.actions ?? []).filter(action => Reflect.get(action, 'source') !== actionSource), ...registrations] }, executor, input, actionId)
  }
  if (input.operation === 'action' && (definition.actions ?? []).some(action => findRegisteredAction(action as ActionDefinition<RuntimeRecord, JsonObject, unknown, object, unknown, undefined>, actionId))) {
    return executeCustomAction(definition, executor, input, actionId)
  }
  let data: JsonObject
  if (input.operation === 'options') {
    data = await executeOptions(definition, input)
  } else if (input.operation === 'table-data') {
    const tableState = await tableQueryState(definition, input)
    const result = await executor.table(tableState, input.context, record => resolveGeneratedRowActions(definition, input.context, record))
    const presentation = await tablePresentation(definition, result.records, input.context)
    let selectionData: JsonObject | undefined
    const selection = input.payload.selection
    if (selection && typeof selection === 'object' && !Array.isArray(selection) && selection.mode === 'all-matching') {
      const query = selection.query
      if (!query || typeof query !== 'object' || Array.isArray(query) || query.panelId !== undefined && query.panelId !== input.panelId || query.tableId !== undefined && query.tableId !== definition.id) throw new Error('The selection belongs to another table')
      const matching = await executor.selectTableRecords(await tableQueryState(definition, { ...input, payload: query }), [], input.context)
      const pageIds = new Set(result.records.map(record => String(valueAtPath(record, definition.routeKey))))
      selectionData = { key: JSON.stringify(toJsonValue(selection)), matchingRecordIds: matching.filter(id => pageIds.has(String(id))) }
    }
    data = jsonObject({ groups: presentation.groups, records: result.records, resourceId: definition.id, rowActions: result.recordPresentations, ...(selectionData ? { selection: selectionData } : {}), summaries: presentation.summaries, tableActions: await resolveGeneratedTableActions(definition, input.context), tableState, total: result.total })
  } else {
    throw new Error('[Holo Panels] The generated resource action is not registered.')
  }
  return Object.freeze({ data, effects: Object.freeze([]) })
}

export async function executeGeneratedUploadOperation(
  resource: object,
  input: GeneratedUploadOperationInput,
): Promise<JsonObject> {
  const definition = resourceDefinition(resource)
  if (input.payload.resourceId !== definition.id) throw new Error('[Holo Panels] Upload operation does not match its registered resource.')
  const fieldId = typeof input.payload.fieldId === 'string' ? input.payload.fieldId : ''
  const action = typeof input.payload.action === 'string' ? input.payload.action : ''
  if (!fieldId) throw new Error('[Holo Panels] Upload operations require a field ID.')
  const { service } = uploadService(definition, fieldId, input)
  const context = uploadActorContext(definition, fieldId, input)
  const sessionId = typeof input.payload.sessionId === 'string' ? input.payload.sessionId : ''
  if (!sessionId) throw new Error('[Holo Panels] Upload operations require a session ID.')
  if (action === 'create') {
    const declaredMimeType = typeof input.payload.declaredMimeType === 'string' ? input.payload.declaredMimeType : ''
    const name = typeof input.payload.name === 'string' ? input.payload.name : ''
    const size = input.payload.size
    if (typeof size !== 'number') throw new Error('[Holo Panels] Upload creation requires a numeric size.')
    return jsonObject(await service.create({ ...context, declaredMimeType, name, sessionId, size }))
  }
  const id = typeof input.payload.id === 'string' ? input.payload.id : ''
  const token = typeof input.payload.token === 'string' ? input.payload.token : ''
  if (!id || !token) throw new Error('[Holo Panels] Upload operations require an upload ID and token.')
  if (action === 'write') {
    if (!input.contents) throw new Error('[Holo Panels] Upload writes require binary contents.')
    return jsonObject(await service.write({ ...context, contents: input.contents, id, sessionId, token }))
  }
  if (action === 'resolve') return jsonObject(await service.resolve({ ...context, id, sessionId, token }))
  if (action === 'delete') {
    await service.delete({ ...context, id, sessionId, token })
    return { deleted: true }
  }
  throw new Error('[Holo Panels] Upload action is not supported.')
}
