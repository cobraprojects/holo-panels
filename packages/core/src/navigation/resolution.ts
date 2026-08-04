import type {
  NavigationClusterSource,
  NavigationContext,
  NavigationManifest,
  NavigationSource,
  PanelSwitchSource,
  ResolveNavigationOptions,
  ResolvedNavigationCluster,
  ResolvedNavigationGroup,
  ResolvedNavigationItem,
  ResolvedPanelSwitchItem,
} from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function normalizedPath(path: string, label: string): string {
  const control = (value: string): boolean => [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
  if (path !== path.trim() || !path.startsWith('/') || path.includes('\\') || path.includes('//') || path.includes('?') || path.includes('#') || control(path)) {
    throw new Error(`${label} must be a normalized absolute path`)
  }
  const normalized = path === '/' ? path : path.replace(/\/+$/gu, '')
  let decoded = normalized
  for (let depth = 0; depth < 3; depth += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new Error(`${label} must not contain invalid encoding`)
    }
    if (next.includes('\\') || control(next) || next.split('/').length !== decoded.split('/').length || next.split('/').some(segment => segment === '.' || segment === '..')) {
      throw new Error(`${label} must not contain traversal segments`)
    }
    if (next === decoded) return normalized
    decoded = next
  }
  if (decoded.includes('%')) throw new Error(`${label} must not contain ambiguous encoding`)
  return normalized
}

function within(path: string, root: string): boolean {
  return root === '/' || path === root || path.startsWith(`${root}/`)
}

function active(path: string, candidate: string): boolean {
  return path === candidate || path.startsWith(`${candidate}/`)
}

function compare(left: { readonly id: string, readonly label: string, readonly sort: number }, right: { readonly id: string, readonly label: string, readonly sort: number }): number {
  return left.sort - right.sort || left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
}

function assertId(id: string, subject: string): void {
  if (!IDENTIFIER.test(id)) throw new Error(`${subject} requires a stable ID`)
}

function assertUnique<TValue extends { readonly id: string }>(values: readonly TValue[], subject: string): void {
  const ids = new Set<string>()
  for (const value of values) {
    assertId(value.id, subject)
    if (ids.has(value.id)) throw new Error(`Duplicate ${subject.toLowerCase()} ID "${value.id}"`)
    ids.add(value.id)
  }
}

function assertHierarchy<TActor, TTenant>(items: readonly NavigationSource<TActor, TTenant>[]): void {
  const byId = new Map(items.map(item => [item.id, item]))
  for (const item of items) {
    if (item.parent !== undefined && item.parent !== null && !byId.has(item.parent)) {
      throw new Error(`Navigation parent "${item.parent}" is not registered`)
    }
    const visited = new Set([item.id])
    let parent = item.parent
    while (parent !== undefined && parent !== null) {
      if (visited.has(parent)) throw new Error(`Navigation item "${item.id}" has a parent cycle`)
      visited.add(parent)
      parent = byId.get(parent)?.parent
    }
  }
}

async function allowed<TActor, TTenant>(authorize: ((context: NavigationContext<TActor, TTenant>) => boolean | Promise<boolean>) | undefined, context: NavigationContext<TActor, TTenant>): Promise<boolean> {
  return authorize ? authorize(context) : true
}

async function resolveItems<TActor, TTenant>(sources: readonly NavigationSource<TActor, TTenant>[], context: NavigationContext<TActor, TTenant>, clusterIds: ReadonlySet<string>, visibleClusterIds: ReadonlySet<string>): Promise<readonly ResolvedNavigationItem[]> {
  const authorized = await Promise.all(sources.map(async source => {
    const path = normalizedPath(source.path, `Navigation item "${source.id}" path`)
    if (!within(path, context.panelPath)) throw new Error(`Navigation item "${source.id}" must remain inside panel "${context.panelId}"`)
    if (source.cluster && !clusterIds.has(source.cluster)) throw new Error(`Navigation cluster "${source.cluster}" is not registered`)
    if (source.cluster && !visibleClusterIds.has(source.cluster)) return null
    if (!await allowed(source.authorize, context)) return null
    return { path, source }
  }))
  const candidates = authorized.filter((item): item is NonNullable<typeof item> => item !== null)
  const byId = new Map(candidates.map(item => [item.source.id, item]))
  const visible = candidates.filter(item => {
    let parent = item.source.parent
    while (parent !== undefined && parent !== null) {
      const ancestor = byId.get(parent)
      if (!ancestor) return false
      parent = ancestor.source.parent
    }
    return true
  })
  const resolved = await Promise.all(visible.map(async ({ path, source }) => {
    const badge = typeof source.badge === 'function' ? await source.badge(context) : source.badge ?? null
    return Object.freeze({
      active: active(context.activePath, path),
      badge: badge?.trim() || null,
      cluster: source.cluster ?? null,
      group: source.group?.trim() || null,
      icon: source.icon ?? null,
      id: source.id,
      kind: source.kind,
      label: source.label.trim(),
      parent: source.parent ?? null,
      path,
      sort: source.sort ?? 0,
      variant: source.variant ?? null,
    }) satisfies ResolvedNavigationItem
  }))
  return Object.freeze(resolved.sort(compare))
}

function groups(items: readonly ResolvedNavigationItem[]): readonly ResolvedNavigationGroup[] {
  const resolved = new Map<string, ResolvedNavigationGroup>()
  for (const item of items) {
    if (!item.group) continue
    const current = resolved.get(item.group)
    const candidate = Object.freeze({ active: item.active, id: item.group, label: item.group, sort: item.sort })
    if (!current) resolved.set(item.group, candidate)
    else resolved.set(item.group, Object.freeze({ ...current, active: current.active || item.active, sort: Math.min(current.sort, item.sort) }))
  }
  return Object.freeze([...resolved.values()].sort(compare))
}

function clusters<TActor, TTenant>(sources: readonly NavigationClusterSource<TActor, TTenant>[], items: readonly ResolvedNavigationItem[]): readonly ResolvedNavigationCluster[] {
  return Object.freeze(sources.map(source => Object.freeze({
    active: items.some(item => item.cluster === source.id && item.active),
    collapsible: source.collapsible ?? true,
    icon: source.icon ?? null,
    id: source.id,
    label: source.label.trim(),
    sort: source.sort ?? 0,
  }) satisfies ResolvedNavigationCluster).sort(compare))
}

async function panels<TActor, TTenant>(sources: readonly PanelSwitchSource<TActor, TTenant>[], context: NavigationContext<TActor, TTenant>): Promise<readonly ResolvedPanelSwitchItem[]> {
  const visible = await Promise.all(sources.map(async source => {
    const path = normalizedPath(source.path, `Panel switch item "${source.id}" path`)
    if (!await allowed(source.authorize, context)) return null
    return Object.freeze({ active: source.id === context.panelId, icon: source.icon ?? null, id: source.id, label: source.label.trim(), path, sort: source.sort ?? 0 }) satisfies ResolvedPanelSwitchItem
  }))
  return Object.freeze(visible.filter((panel): panel is ResolvedPanelSwitchItem => panel !== null).sort(compare))
}

export async function resolveNavigation<TActor, TTenant>(options: ResolveNavigationOptions<TActor, TTenant>): Promise<NavigationManifest> {
  const context = { ...options.context, activePath: normalizedPath(options.context.activePath, 'Active navigation path'), panelPath: normalizedPath(options.context.panelPath, 'Panel path') }
  if (!within(context.activePath, context.panelPath)) throw new Error('Active navigation paths must remain inside the panel')
  assertUnique(options.items, 'Navigation item')
  assertHierarchy(options.items)
  assertUnique(options.clusters ?? [], 'Navigation cluster')
  assertUnique(options.panels ?? [], 'Panel switch item')
  const authorizedClusters = (await Promise.all((options.clusters ?? []).map(async cluster => await allowed(cluster.authorize, context) ? cluster : null))).filter((cluster): cluster is NavigationClusterSource<TActor, TTenant> => cluster !== null)
  const clusterIds = new Set((options.clusters ?? []).map(cluster => cluster.id))
  const visibleClusterIds = new Set(authorizedClusters.map(cluster => cluster.id))
  const items = await resolveItems(options.items, context, clusterIds, visibleClusterIds)
  const resolvedClusters = clusters(authorizedClusters, items)
  const visibleItems = items
  const activeItemId = [...visibleItems].filter(item => item.active).sort((left, right) => right.path.length - left.path.length || compare(left, right))[0]?.id ?? null
  return Object.freeze({
    activeItemId,
    clusters: resolvedClusters,
    collapsible: options.collapsible ?? true,
    groups: groups(visibleItems),
    items: visibleItems,
    layout: options.layout ?? 'sidebar',
    panelId: context.panelId,
    panels: await panels(options.panels ?? [], context),
  })
}
