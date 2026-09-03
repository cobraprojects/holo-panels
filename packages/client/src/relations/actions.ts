import { builtInActionPresentation, builtInActionTranslationKeys, createPanelTranslator, toJsonValue, type ActionManifest, type JsonObject, type JsonValue } from '@holo-js/panels-core'
import { ClientActionStore } from '../actions/store'
import { actionManifestCollection, isActionManifest } from '../actions/manifest'
import { OptionStore } from '../options/store'
import { publishPanelActionFailure } from '../notifications/feedback'
import { formValidationErrors } from '../forms/validation'
import type { TableSelectionPayload } from '../tables/contracts'
import type { ClientRelationActionRequest, ClientRelationManager, ClientRelationOption, ClientRelationRecord } from './contracts'

function object(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function relationActionPresentation(value: JsonObject): Pick<ClientRelationManager, 'actions' | 'recordActions'> {
  const manifests = (items: JsonValue | undefined): readonly ActionManifest[] => Array.isArray(items) ? items.flatMap(item => {
    const candidate = object(item)
    return typeof candidate.id === 'string' && isActionManifest(candidate, candidate.id) ? [candidate] : []
  }) : []
  return {
    ...(Array.isArray(value.actions) ? { actions: manifests(value.actions) } : {}),
    ...(Array.isArray(value.recordActions) ? { recordActions: value.recordActions.flatMap(item => {
      const row = object(item)
      return typeof row.recordId === 'number' || typeof row.recordId === 'string' ? [{ recordId: row.recordId, actions: manifests(row.actions) }] : []
    }) } : {}),
  }
}

export function relationActionPayload(request: ClientRelationActionRequest): JsonObject {
  return {
    intent: 'relation', managerId: request.managerId, relationOperation: request.operation,
    ...(request.actionId ? { actionId: request.actionId } : {}),
    ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
    ...(request.input ? { input: request.input } : {}),
    ...(request.mount ? { mount: request.mount } : {}),
    ...(request.recordIds ? { relatedIds: [...request.recordIds] } : {}),
    ...(request.selection ? { selection: toJsonValue(request.selection) } : {}),
    ...(request.recordId === undefined ? {} : { relatedId: request.recordId }),
    ...(request.pivot ? { pivot: { ...request.pivot } } : {}),
    ...(request.values ? { values: { ...request.values } } : {}),
  }
}

function defaults(manager: ClientRelationManager, record: ClientRelationRecord | undefined, locale: string): readonly ActionManifest[] {
  const kinds = record ? ['view', 'edit', 'delete', 'dissociate', 'detach', 'editPivot'] : ['create', 'associate', 'attach']
  return manager.operations.filter(operation => kinds.includes(operation) && operation !== 'list').map(operation => {
    const presentation = builtInActionPresentation(operation)
    const keys = builtInActionTranslationKeys(operation)
    const translate = createPanelTranslator(locale)
    return { badge: null, color: presentation?.color ?? null, confirmation: keys?.confirmation ? translate(keys.confirmation) : presentation?.confirmation ?? null, disabled: false, icon: presentation?.icon ?? null, id: operation === 'editPivot' ? 'edit-pivot' : operation, kind: operation as ActionManifest['kind'], label: keys ? translate(keys.label) : operation === 'editPivot' ? 'Edit pivot' : operation.charAt(0).toUpperCase() + operation.slice(1), modal: null, mount: record ? 'record' : 'page', size: 'medium', tooltip: null, type: operation, visible: true }
  })
}

function formAction(action: ActionManifest, manager: ClientRelationManager, record: ClientRelationRecord | undefined, searchable: boolean, locale: string): ActionManifest {
  if (action.modal?.schema || !['attach', 'associate', 'create', 'edit', 'editPivot', 'view'].includes(action.kind)) return action
  const pivot = action.kind === 'attach' || action.kind === 'editPivot'
  const fields = action.kind === 'view' ? manager.columns.map(column => ({ id: column.key, label: column.label, required: false, type: 'text' })) : pivot ? manager.pivotFields ?? [] : action.kind === 'create' || action.kind === 'edit' ? manager.fields ?? [] : []
  const values = pivot ? object(record?.values.pivot) : record?.values ?? {}
  const schemaFields: JsonObject[] = fields.map((field): JsonObject => ({
    defaultValue: values[field.id] ?? (field.type === 'toggle' ? false : field.type === 'number' ? 0 : ''),
    key: field.id, kind: 'field', label: field.label, path: `${pivot ? 'pivot' : 'values'}.${field.id}`,
    properties: field.type === 'number' ? { inputMode: 'number' } : field.type === 'date-time' ? { mode: 'date-time' } : {},
    readOnly: action.kind === 'view', required: field.required, type: field.type === 'number' ? 'text' : field.type === 'date-time' ? 'date' : field.type,
  }))
  if (action.kind === 'associate' || action.kind === 'attach') schemaFields.unshift({ key: 'relatedId', kind: 'field', label: createPanelTranslator(locale)(searchable ? 'relations.record' : 'relations.recordId'), path: 'relatedId', properties: { preload: true, searchable }, required: true, type: searchable ? 'select' : 'text' })
  return { ...action, modal: {
    alignment: 'center', autofocus: true, cancelActionLabel: null, closeByClickingAway: true, closeByEscaping: true, content: null, description: null, footer: null, heading: null, icon: null, iconColor: null, nestedActions: [], schema: { fields: schemaFields }, slideOver: false, stickyFooter: false, stickyHeader: false, submitActionLabel: action.label, width: 'medium',
    ...action.modal,
    ...(action.modal?.schema ? {} : { schema: { fields: schemaFields } }),
  } }
}

export function relationActionManifests(manager: ClientRelationManager, record?: ClientRelationRecord, searchable = false, locale = 'en'): readonly ActionManifest[] {
  const configured = record ? manager.recordActions?.find(item => String(item.recordId) === String(record.id))?.actions ?? (manager.recordActions ? [] : undefined) : manager.actions
  return (configured ?? defaults(manager, record, locale)).map(action => formAction(action, manager, record, searchable, locale))
}

export function createRelationActionHost(options: {
  readonly execute: (request: ClientRelationActionRequest, signal: AbortSignal) => void | Promise<void>
  readonly loadOptions?: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
  readonly locale?: string
  readonly manager: ClientRelationManager
  readonly panelId?: string
  readonly record?: ClientRelationRecord
  readonly selectedIds?: readonly (number | string)[]
  readonly selection?: () => TableSelectionPayload<number | string>
}) {
  const actions = relationActionManifests(options.manager, options.record, !!options.loadOptions, options.locale).map(action => action.mount === 'bulk' && !options.selection && !options.selectedIds?.length ? { ...action, disabled: true } : action)
  const store = new ClientActionStore({
    createIdempotencyKey: () => crypto.randomUUID(),
    createOptionStore: (field, actionId) => field.path === 'relatedId' && options.loadOptions ? new OptionStore({
      fieldId: field.path, locale: options.locale ?? 'en', panelId: options.panelId ?? 'default', resourceId: `${options.manager.id}:${actionId}`, tenantKey: crypto.randomUUID(),
      transport: {
        list: async request => ({ hasMore: false, options: await options.loadOptions!(options.manager.id, request.search), page: request.page, perPage: request.perPage }),
        hydrateSelected: async (_request, values) => (await options.loadOptions!(options.manager.id, '')).filter(option => values.includes(option.value)),
        validateSelection: async () => true,
      },
    }) : undefined,
    transport: {
      async execute(request, signal) {
        const action = actionManifestCollection(actions).find(candidate => candidate.id === request.actionId)
        if (!action || !action.visible || action.disabled) throw new Error('The relation action is not available')
        const relatedId = request.input.relatedId ?? options.record?.id
        try {
          await options.execute({
            actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, managerId: options.manager.id, mount: request.mount, operation: action.kind as ClientRelationActionRequest['operation'],
            ...(typeof relatedId === 'string' || typeof relatedId === 'number' ? { recordId: relatedId } : {}),
            ...(action.mount === 'bulk' ? options.selection ? { selection: options.selection() } : { recordIds: options.selectedIds ?? [] } : {}),
            ...(request.input.pivot ? { pivot: object(request.input.pivot) } : {}),
            ...(request.input.values ? { values: object(request.input.values) } : {}),
          }, signal)
          return { effects: [], items: [], status: 'succeeded' as const }
        } catch (cause) {
          if (formValidationErrors(cause)) throw cause
          publishPanelActionFailure(options.panelId ?? 'default')
          throw new Error('The relation action could not be completed.')
        }
      },
    },
  })
  return { actions, store }
}
