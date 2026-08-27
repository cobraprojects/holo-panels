import type { JsonObject } from '../protocol/json'
import type { ActionDefinition, ActionKind, ActionMount } from './contracts'

export function registeredActionChildren<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  parent: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
): readonly ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>[] {
  const identifiers = new Set<string>()
  return (parent.nestedActions ?? []).map(value => {
    const action = value as ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>
    if (typeof action.id !== 'string' || identifiers.has(action.id) || !parent.modal?.nestedActions?.includes(action.id) || typeof action.authorize !== 'function' || typeof action.handle !== 'function') throw new Error('Nested actions require unique registered execution definitions')
    identifiers.add(action.id)
    return {
      ...action,
      ancestorActionIds: [...(parent.ancestorActionIds ?? []), parent.id],
      mount: parent.mount,
      authorize: async (context, input) => {
        if (!await parent.authorize(context, input)) return false
        const presentation = { ...context, data: input }
        const visible = typeof parent.visible === 'function' ? await parent.visible(presentation) : parent.visible !== false
        const disabled = typeof parent.disabled === 'function' ? await parent.disabled(presentation) : parent.disabled === true
        return visible && !disabled && await action.authorize(context, input)
      },
    }
  })
}

export function findRegisteredAction<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  root: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
  id: string,
  depth = 0,
): ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices> | null {
  if (depth > 10) throw new Error('Nested actions cannot exceed ten levels')
  if (root.id === id) return root
  const matches = registeredActionChildren(root).flatMap(child => findRegisteredAction(child, id, depth + 1) ?? [])
  if (matches.length > 1) throw new Error('Nested action IDs must be unique within their owner')
  return matches[0] ?? null
}

export interface ActionRegistration<TRecord> {
  readonly id: string
  readonly resourceRecordType: TRecord
  compile(): { readonly id: string, readonly kind: ActionKind, readonly mount: ActionMount }
}

export type RegisteredAction<TRecord> = ActionDefinition<TRecord, JsonObject, unknown, unknown, unknown, unknown>

export function actionPermissionReferences(actions: readonly object[], depth = 0): readonly string[] {
  if (depth > 10) throw new Error('Nested actions cannot exceed ten levels')
  return [...new Set(actions.flatMap(action => {
    const id: unknown = Reflect.get(action, 'id')
    const nested: unknown = Reflect.get(action, 'nestedActions')
    return [...(typeof id === 'string' ? [`actions.${id}.view`] : []), ...actionPermissionReferences(Array.isArray(nested) ? nested.filter((value): value is object => !!value && typeof value === 'object') : [], depth + 1)]
  }))]
}

export function compileRegisteredActions<TRecord>(registrations: readonly ActionRegistration<TRecord>[], mount: ActionMount): readonly RegisteredAction<TRecord>[] {
  const identifiers = new Set<string>()
  return Object.freeze(registrations.map((registration) => {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(registration.id)) throw new Error('Actions require stable dot or dash separated IDs')
    if (identifiers.has(registration.id)) throw new Error(`Duplicate action "${registration.id}"`)
    identifiers.add(registration.id)
    const definition = registration.compile()
    if (Reflect.get(definition, 'id') !== registration.id
      || typeof Reflect.get(definition, 'authorize') !== 'function'
      || typeof Reflect.get(definition, 'handle') !== 'function') throw new Error(`Action "${registration.id}" requires a compiled execution definition`)
    return Object.freeze({ ...definition, mount }) as RegisteredAction<TRecord>
  }))
}
