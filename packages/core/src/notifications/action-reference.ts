import { actionPermissionReferences, compileRegisteredActions, findRegisteredAction, type ActionRegistration, type RegisteredAction } from '../actions/registration'
import type { JsonObject } from '../protocol/json'

export interface NotificationActionReference extends JsonObject {
  readonly actionId: string
  readonly resourceId: string
}

interface ResourceActionOwner {
  compile(): { readonly id: string }
}

const owners = new WeakMap<object, ResourceActionOwner>()

export class NotificationActionRegistrationError extends Error {}

function isAction(value: unknown): value is ActionRegistration<object> {
  return typeof value === 'object' && value !== null
    && typeof Reflect.get(value, 'id') === 'string'
    && typeof Reflect.get(value, 'compile') === 'function'
}

function declaredActions(owner: ResourceActionOwner): readonly ActionRegistration<object>[] {
  const actions = new Set<ActionRegistration<object>>()
  let current: object | null = owner
  while (current && current !== Function.prototype) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current))) {
      const value: unknown = descriptor.value
      if (isAction(value) && owners.get(value) === current) actions.add(value)
    }
    current = Object.getPrototypeOf(current) as object | null
  }
  return [...actions]
}

export function bindResourceActionOwner<TResult>(action: TResult, owner: ResourceActionOwner): TResult {
  if (isAction(action)) owners.set(action, owner)
  return action
}

export function notificationActionReference(action: object): NotificationActionReference | null {
  const owner = owners.get(action)
  if (!owner || !isAction(action)) return null
  const candidates = declaredActions(owner).filter(candidate => candidate.id === action.id)
  if (candidates.length !== 1 || candidates[0] !== action) throw new Error('Notification actions require a unique action declared on their resource')
  return Object.freeze({ actionId: action.id, resourceId: owner.compile().id })
}

export function notificationActionOwner(action: object): ResourceActionOwner | null {
  return notificationActionReference(action) ? owners.get(action) ?? null : null
}

export function resourceNotificationPermissionReferences(owner: ResourceActionOwner): readonly string[] {
  return actionPermissionReferences(compileRegisteredActions(declaredActions(owner), 'notification'))
}

export function resolveResourceNotificationAction(owner: object, reference: NotificationActionReference, actionId = reference.actionId): RegisteredAction<object> {
  if (!('compile' in owner) || typeof owner.compile !== 'function') throw new NotificationActionRegistrationError('The notification resource is not registered')
  const resource = owner as ResourceActionOwner
  if (resource.compile().id !== reference.resourceId) throw new NotificationActionRegistrationError('The notification resource does not match its registration')
  const candidates = declaredActions(resource).filter(action => action.id === reference.actionId)
  if (candidates.length !== 1) throw new NotificationActionRegistrationError('The notification action is no longer registered')
  const root = compileRegisteredActions(candidates, 'notification')[0]!
  const action = findRegisteredAction(root, actionId)
  if (!action) throw new NotificationActionRegistrationError('The notification action is no longer registered')
  return action
}
