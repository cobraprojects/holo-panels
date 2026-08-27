import { DB } from '@holo-js/db'
import { ActionEngine, ActionEngineState, ActionExecutionError } from '../actions/engine'
import { compileActionManifest, resolveActionState } from '../actions/action'
import { actionExecutionPermissions, authorizePanelActionPermissions } from '../actions/authorization'
import type { ActionExecutionResult, ActionTransaction } from '../actions/contracts'
import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type { CompiledPanelDefinition } from '../panels/contracts'
import { authorizeGeneratedResourceNotification, type GeneratedResourceOperationInput } from '../resources/generated-pages'
import { resolveResourceNotificationAction } from './action-reference'
import type { PanelNotificationExecutionAction } from './contracts'

export interface NotificationActionExecutionOptions {
  readonly action: PanelNotificationExecutionAction
  readonly actionId?: string
  readonly context: GeneratedResourceOperationInput['context']
  readonly panel: CompiledPanelDefinition<object>
  readonly registry: Readonly<Record<string, () => Promise<object>>>
  readonly transaction?: ActionTransaction
}

const executionStates = new WeakMap<object, ActionEngineState<number | string>>()

async function authorizedDefinition(options: NotificationActionExecutionOptions) {
  const reference = options.action.execution
  const panelId = options.panel.manifest.id
  const loader = reference ? options.registry[`${panelId}:resource:${reference.resourceId}`] : undefined
  if (!reference || !loader) throw new ActionExecutionError('denied', 'The notification resource is not registered')
  const resource = await loader()
  await authorizeGeneratedResourceNotification(resource, options.context, options.panel.manifest.runtime?.strictAuthorization ?? false)
  await authorizePanelActionPermissions(options.panel, { ...options.context, panelId }, [`${reference.resourceId}.viewAny`, `actions.${reference.actionId}.view`])
  const definition = resolveResourceNotificationAction(resource, reference, options.actionId)
  await authorizePanelActionPermissions(options.panel, { ...options.context, panelId }, actionExecutionPermissions(definition))
  return { definition, loader }
}

export async function resolveNotificationActionPresentation(options: NotificationActionExecutionOptions): Promise<PanelNotificationExecutionAction | null> {
  const { definition } = await authorizedDefinition(options)
  const scope = { ...options.context, mount: 'notification' as const, record: null, selectedRecords: [], services: undefined }
  const state = await resolveActionState(definition, scope)
  if (!state.visible) return null
  const manifest = toJsonValue(await compileActionManifest(definition, state.label, scope, state))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Notification action manifests require an object')
  return { ...options.action, label: state.label, actionManifest: manifest }
}

export async function executeNotificationAction(options: NotificationActionExecutionOptions, input: JsonObject, idempotencyKey: string, identity: { readonly actor: string, readonly tenant: string } | null): Promise<ActionExecutionResult<number | string, unknown>> {
  const { definition, loader } = await authorizedDefinition(options)
  const scope = { ...options.context, mount: 'notification' as const, record: null, selectedRecords: [], services: undefined }
  if (!await definition.authorize(scope, input)) throw new ActionExecutionError('denied', 'The action is not authorized')
  const presentation = await resolveActionState(definition, { ...scope, data: input })
  if (!presentation.visible || presentation.disabled) throw new ActionExecutionError('denied', 'The action is not available')
  const state = identity ? executionStates.get(loader) ?? new ActionEngineState<number | string>() : new ActionEngineState<number | string>()
  if (identity) executionStates.set(loader, state)
  const engine = new ActionEngine<object, number | string, object, unknown, undefined>({
    identity: () => identity,
    records: { resolve: async () => null, version: () => null },
    transaction: options.transaction ?? { run: operation => DB.writeTransaction(operation) },
  }, state)
  return engine.execute(definition, { idempotencyKey, input, mount: 'notification' }, { ...options.context, services: undefined })
}
