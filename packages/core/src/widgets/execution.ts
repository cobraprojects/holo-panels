import { DB } from '@holo-js/db'
import { ActionEngine, ActionEngineState, ActionExecutionError } from '../actions/engine'
import { authorizePanelActionPermissions } from '../actions/authorization'
import type { ActionExecutionRequest, ActionExecutionResult, ActionTransaction } from '../actions/contracts'
import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type { Effect } from '../protocol/effects'
import type { CompiledPanelDefinition } from '../panels/contracts'
import { resolveGeneratedResourceWidget, type GeneratedResourceOperationInput } from '../resources/generated-pages'
import type { CompiledWidgetDefinition, WidgetContext } from './contracts'
import { WidgetAccessError } from './resolution'

const transaction: ActionTransaction = { run: operation => DB.writeTransaction(operation) }
const executionStates = new WeakMap<object, Map<string, ActionEngineState<number | string>>>()

function executionState(widget: object, panelId: string): ActionEngineState<number | string> {
  const panels = executionStates.get(widget) ?? new Map<string, ActionEngineState<number | string>>()
  executionStates.set(widget, panels)
  const state = panels.get(panelId) ?? new ActionEngineState<number | string>()
  panels.set(panelId, state)
  return state
}

function cacheIdentity(value: unknown): string | null {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify([typeof value, value])
  if (typeof value !== 'object') return null
  const constructor = Reflect.get(value, 'constructor')
  const definition = typeof constructor === 'function' ? Reflect.get(constructor, 'definition') : undefined
  const primaryKey = definition && typeof definition === 'object' ? Reflect.get(definition, 'primaryKey') : 'id'
  const identifier = typeof primaryKey === 'string' ? Reflect.get(value, primaryKey) : undefined
  return typeof identifier === 'number' || typeof identifier === 'string'
    ? JSON.stringify([typeof constructor === 'function' ? constructor.name : 'object', typeof identifier, identifier])
    : null
}

function compiledWidget(value: object): CompiledWidgetDefinition<JsonValue, object, unknown, unknown> {
  const definition: object = 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
  if (Reflect.get(definition, 'kind') !== 'widget') throw new Error('The registered definition is not a widget')
  return definition as CompiledWidgetDefinition<JsonValue, object, unknown, unknown>
}

export async function executeGeneratedWidgetOperation(
  registry: Readonly<Record<string, () => Promise<object>>>,
  payload: JsonObject,
  context: WidgetContext<object, unknown, unknown> & Pick<GeneratedResourceOperationInput['context'], 'scopeTenantQuery' | 'tenantBindings'> & { readonly provider?: string | null },
  panel: CompiledPanelDefinition<object>,
  actionTransaction: ActionTransaction = transaction,
): Promise<{ readonly data: JsonObject, readonly effects: readonly Effect[] }> {
  const { actionId, idempotencyKey, input, widgetId } = payload
  if (panel.manifest.id !== context.panelId) throw new Error('Widget actions must match their panel')
  if (typeof widgetId !== 'string' || typeof actionId !== 'string' || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) throw new Error('Widget actions require registered widget and action IDs and an idempotency key')
  if (payload.mount !== 'page' || Array.isArray(payload.recordIds) && payload.recordIds.length > 0) throw new Error('Widget actions require a page mount without record IDs')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Widget actions require an input object')
  const resourceLoader = typeof payload.resourceId === 'string' ? registry[`${context.panelId}:resource:${payload.resourceId}`] : undefined
  if (payload.resourceId !== undefined && !resourceLoader) throw new Error('The widget resource is not registered')
  const resourceWidget = resourceLoader ? await resolveGeneratedResourceWidget(await resourceLoader(), widgetId, context, panel.manifest.runtime?.strictAuthorization ?? false) : null
  const loader = registry[`${context.panelId}:widget:${widgetId}`]
  if (!resourceWidget && !loader) throw new Error('The widget is not registered')
  const widget = compiledWidget(resourceWidget ?? await loader!())
  if (widget.manifest.id !== widgetId) throw new Error('The widget is not registered under the requested ID')
  await authorizePanelActionPermissions(panel, context, [...(typeof payload.resourceId === 'string' ? [`${payload.resourceId}.viewAny`] : []), `widgets.${widgetId}.view`, `actions.${actionId}.view`])
  const result = await executeWidgetAction(widget, { actionId, idempotencyKey, input, mount: 'page' }, context, actionTransaction)
  const data = toJsonValue({ items: result.items, result: result.result ?? null, status: result.status })
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Widget action results require JSON objects')
  return { data, effects: result.effects }
}

export async function executeWidgetAction<TData extends JsonValue, TActor, TTenant, TServices, TRecord extends object>(
  definition: CompiledWidgetDefinition<TData, TActor, TTenant, TServices, TRecord>,
  request: ActionExecutionRequest<JsonObject, number | string> & { readonly actionId: string },
  context: WidgetContext<TActor, TTenant, TServices> & { readonly provider?: string | null },
  actionTransaction: ActionTransaction = transaction,
): Promise<ActionExecutionResult<number | string, unknown>> {
  if (!await definition.server.authorize(context)) throw new WidgetAccessError(definition.manifest.id)
  const action = definition.server.actions?.find(candidate => candidate.id === request.actionId)
  if (!action) throw new Error('The widget action is not registered')
  if (!await action.authorize({ ...context, mount: action.mount, record: null, selectedRecords: [] }, request.input)) throw new ActionExecutionError('denied', 'The action is not authorized')
  const engine = new ActionEngine<TRecord, number | string, TActor, TTenant, TServices>({
    identity: scope => {
      const actor = cacheIdentity(scope.actor)
      const tenant = cacheIdentity(scope.tenant)
      return actor !== null && tenant !== null ? { actor, tenant } : null
    },
    records: { resolve: async () => null, version: () => null },
    transaction: actionTransaction,
  }, executionState(definition, JSON.stringify([context.panelId, context.provider ?? null])))
  return engine.execute(action, request, context)
}
