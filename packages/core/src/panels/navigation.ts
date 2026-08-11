import type { CompiledPageDefinition } from '../pages/contracts'
import type { JsonObject } from '../protocol/json'
import type { PanelNavigationSeed } from './contracts'

export function createNavigationSeed<TData extends JsonObject, TActor, TTenant, TServices>(
  pages: readonly CompiledPageDefinition<TData, TActor, TTenant, TServices>[],
): readonly PanelNavigationSeed[] {
  const items = pages.flatMap(page => page.manifest.navigation
    ? [{
        ...page.manifest.navigation,
        id: page.manifest.id,
        path: page.manifest.path,
      }]
    : [])
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate panel navigation item "${item.id}"`)
    ids.add(item.id)
  }
  for (const item of items) {
    if (item.parent !== null && !ids.has(item.parent)) throw new Error(`Panel navigation parent "${item.parent}" is not registered`)
  }
  return Object.freeze(items
    .sort((left, right) => left.sort - right.sort || left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
    .map(item => Object.freeze(item)))
}
