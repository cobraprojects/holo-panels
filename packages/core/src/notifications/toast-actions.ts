import { createSignedToken, verifySignedToken } from '@holo-js/security'
import { actionCacheIdentity } from '../actions/identity'
import type { CompiledPanelDefinition, PanelAuthenticatedScope } from '../panels/contracts'
import type { GeneratedResourceOperationInput } from '../resources/generated-pages'
import type { JsonObject } from '../protocol/json'
import { notificationActionOwner } from './action-reference'
import { executeNotificationAction, resolveNotificationActionPresentation } from './action-execution'
import { notificationExecution } from './presentation'
import type { PanelNotificationPresentation } from './contracts'
import type { ActionTransaction } from '../actions/contracts'

interface ToastToken extends JsonObject {
  readonly action: JsonObject
  readonly binding: string
  readonly notificationId: string
}

export interface ToastActionScope {
  readonly panel: CompiledPanelDefinition<object>
  readonly scope: PanelAuthenticatedScope<object>
}

const purpose = 'panels.notification.action'

interface ScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & ScopedQuery<TQuery>
}

async function resolveScope(options: ToastActionScope, supplied?: GeneratedResourceOperationInput['context']) {
  const { panel, scope } = options
  if (!scope.actor || typeof scope.actor !== 'object' || scope.panelId !== panel.manifest.id || scope.guard !== panel.guard) throw new Error('The notification action scope is not authorized')
  const tenancy = await panel.server.tenancy?.activeContext(scope)
  const inbox = tenancy ? null : await panel.server.notifications?.inbox?.resolve(scope)
  const actor = actionCacheIdentity(scope.actor)
  if (actor === null) throw new Error('Notification actions require an identifiable actor')
  const binding = JSON.stringify([scope.panelId, scope.guard, scope.provider, actor, tenancy?.tenantId ?? inbox?.tenantId ?? null, tenancy?.tenantBindings ?? null])
  const context: GeneratedResourceOperationInput['context'] = {
    ...supplied,
    actor: scope.actor,
    signal: scope.signal,
    tenant: tenancy?.tenant ?? supplied?.tenant ?? inbox?.tenantId ?? null,
    ...(tenancy ? {
      scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & ScopedQuery<TQuery>),
      tenantBindings: tenancy.tenantBindings,
    } : {}),
  }
  return { actor, binding, context }
}

export async function prepareToastActions(presentation: Readonly<PanelNotificationPresentation>, sources: readonly object[], options: ToastActionScope): Promise<Readonly<PanelNotificationPresentation>> {
  const { binding, context } = await resolveScope(options)
  const actions = await Promise.all(presentation.actions.map(async value => {
    const action = notificationExecution(value)
    if (!action) return value
    const owner = sources.map(notificationActionOwner).find(candidate => candidate?.compile().id === action.execution.resourceId)
    if (!owner) throw new Error('The notification action owner is not registered')
    const registry = { [`${options.panel.manifest.id}:resource:${action.execution.resourceId}`]: async () => owner }
    const resolved = await resolveNotificationActionPresentation({ action, context, panel: options.panel, registry })
    if (!resolved) return null
    const token = createSignedToken<ToastToken>({ action, binding, notificationId: presentation.id }, { expiresAt: new Date(Date.now() + 15 * 60 * 1000), purpose })
    return { ...resolved, token }
  }))
  return { ...presentation, actions: actions.filter(action => action !== null) }
}

export async function executeToastAction(options: ToastActionScope & {
  readonly context?: GeneratedResourceOperationInput['context']
  readonly registry?: Readonly<Record<string, () => Promise<object>>>
  readonly transaction?: ActionTransaction
}, request: { readonly actionId: string, readonly idempotencyKey: string, readonly input: JsonObject, readonly token: string }) {
  const token = verifySignedToken<ToastToken>(request.token, { purpose })
  const action = notificationExecution(token?.action)
  const { actor, binding, context } = await resolveScope(options, options.context)
  if (!token || !action || token.binding !== binding || !options.registry) throw new Error('The notification action is not authorized or has expired')
  if (options.scope.signal.aborted) throw options.scope.signal.reason
  return executeNotificationAction({ action, actionId: request.actionId, context, panel: options.panel, registry: options.registry, transaction: options.transaction }, request.input, request.idempotencyKey, { actor, tenant: JSON.stringify([binding, token.notificationId]) })
}
