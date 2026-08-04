import type { ActionGroupItem, ActionGroupManifest } from './contracts'

const ACTION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u

function optionalText(value: string | null, name: string): string | null {
  if (value === null) return null
  const normalized = value.trim()
  if (!normalized) throw new Error(`Action group ${name} cannot be empty`)
  return normalized
}

export class ActionGroupBuilder {
  readonly #actions: readonly string[]
  readonly #id: string
  #color: string | null = null
  #compiled?: ActionGroupManifest
  #icon: string | null = null
  #label: string | null = null

  constructor(id: string, actions: readonly ActionGroupItem[]) {
    if (!ACTION_ID.test(id)) throw new Error('Action groups require stable IDs')
    const actionIds = actions.map(action => action.id)
    if (actionIds.some(actionId => !ACTION_ID.test(actionId))) throw new Error('Action groups require stable action IDs')
    if (new Set(actionIds).size !== actionIds.length) throw new Error('Action group actions must be unique')
    this.#actions = Object.freeze(actionIds)
    this.#id = id
  }

  label(value: string | null): this {
    this.assertMutable()
    this.#label = optionalText(value, 'labels')
    return this
  }

  icon(value: string | null): this {
    this.assertMutable()
    this.#icon = optionalText(value, 'icons')
    return this
  }

  color(value: string | null): this {
    this.assertMutable()
    this.#color = optionalText(value, 'colors')
    return this
  }

  compile(): ActionGroupManifest {
    if (!this.#compiled) {
      const compiled: ActionGroupManifest = Object.freeze({ actions: this.#actions, color: this.#color, icon: this.#icon, id: this.#id, label: this.#label })
      this.#compiled = compiled
      return compiled
    }
    return this.#compiled
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('Action groups cannot change after compilation')
  }
}

export function actionGroup(id: string, ...actions: readonly ActionGroupItem[]): ActionGroupBuilder {
  return new ActionGroupBuilder(id, actions)
}
