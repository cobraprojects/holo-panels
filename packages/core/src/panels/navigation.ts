import type { CompiledPageDefinition, PageContext } from '../pages/contracts'
import type { JsonObject } from '../protocol/json'
import type { PanelNavigationSeed } from './contracts'

function compareNavigationSeeds(left: PanelNavigationSeed, right: PanelNavigationSeed): number {
  return left.sort - right.sort || left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
}

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
    .sort(compareNavigationSeeds)
    .map(item => Object.freeze(item)))
}

export async function resolvePanelNavigationSeed<TActor, TTenant, TServices>(
  configured: readonly PanelNavigationSeed[],
  pages: readonly CompiledPageDefinition<JsonObject, TActor, TTenant, TServices>[],
  context: Omit<PageContext<TActor, TTenant, TServices>, 'parameters'>,
): Promise<readonly PanelNavigationSeed[]> {
  const discovered = createNavigationSeed(pages)
  const pageById = new Map(pages.map(page => [page.manifest.id, page]))
  const authorizedIds = new Set((await Promise.all(discovered.map(async item => {
    const page = pageById.get(item.id)!
    return await page.server.authorize({ ...context, parameters: {} }) ? item.id : null
  }))).filter((id): id is string => id !== null))
  const items = new Map(discovered.filter(item => authorizedIds.has(item.id)).map(item => [item.id, item]))
  for (const item of configured) {
    if (!pageById.has(item.id) || authorizedIds.has(item.id)) items.set(item.id, item)
  }
  let removed = true
  while (removed) {
    removed = false
    for (const [id, item] of items) {
      if (item.parent === null || items.has(item.parent)) continue
      items.delete(id)
      removed = true
    }
  }
  return Object.freeze([...items.values()].sort(compareNavigationSeeds).map(item => Object.freeze(item)))
}
