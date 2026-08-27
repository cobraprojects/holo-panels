import type { JsonObject } from '../protocol/json'
import type { ActionDefinition, ActionKind, ActionMount } from './contracts'

export interface ActionRegistration<TRecord> {
  readonly id: string
  readonly resourceRecordType: TRecord
  compile(): { readonly id: string, readonly kind: ActionKind, readonly mount: ActionMount }
}

export type RegisteredAction<TRecord> = ActionDefinition<TRecord, JsonObject, unknown, unknown, unknown, unknown>

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
